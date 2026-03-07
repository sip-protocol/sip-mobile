/**
 * SIP Privacy Program Client
 *
 * Client for interacting with the sip-privacy program.
 * Handles shielded transfers with Pedersen commitments and stealth addresses.
 */

import { web3 } from "@coral-xyz/anchor"
import { Connection, PublicKey, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js"
import { debug } from "@/utils/logger"
import {
  SIP_PRIVACY_PROGRAM_ID,
  getConfigPda,
  getTransferRecordPda,
  getNullifierPda,
  type Config,
  type ShieldedTransferArgs,
} from "./types"
import {
  createCommitment,
  encryptAmount,
  computeViewingKeyHash,
  deriveSharedSecret,
  generateMockProof,
  generateEphemeralKeyPair,
} from "./crypto"
import {
  getAssociatedTokenAddress,
  tokenAccountExists,
  createAssociatedTokenAccountInstruction,
  createIdempotentAtaInstruction,
  createTransferCheckedInstruction,
  createCloseAccountInstruction,
  getTokenAccountBalance,
  TOKEN_PROGRAM_ID,
} from "@/lib/spl"

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ShieldedTransferParams {
  /** Amount in SOL */
  amount: number
  /** Stealth recipient address (ed25519 public key) */
  stealthPubkey: PublicKey
  /** Recipient's spending public key (for shared secret derivation) */
  recipientSpendingKey: Uint8Array
  /** Recipient's viewing public key */
  recipientViewingKey: Uint8Array
  /** Optional memo (not used in current implementation) */
  memo?: string
  /**
   * Optional ephemeral private key from generateStealthAddress.
   * If provided, uses this key for shared secret derivation instead of generating new one.
   * CRITICAL: Must be the same key used to derive the stealthPubkey!
   */
  ephemeralPrivateKey?: Uint8Array
}

export interface ShieldedTokenTransferParams {
  /** Amount in token units (e.g., 5.0 for 5 tokens) */
  amount: number
  /** Token decimals */
  decimals: number
  /** Token mint address */
  tokenMint: PublicKey
  /** Stealth recipient address (ed25519 public key) */
  stealthPubkey: PublicKey
  /** Recipient's spending public key (for shared secret derivation) */
  recipientSpendingKey: Uint8Array
  /** Recipient's viewing public key */
  recipientViewingKey: Uint8Array
  /** Ephemeral private key from generateStealthAddress */
  ephemeralPrivateKey: Uint8Array
}

export interface ShieldedTransferResult {
  /** Transaction signature */
  signature: string
  /** Transfer record PDA */
  transferRecord: PublicKey
  /** Ephemeral public key (for recipient to derive shared secret) */
  ephemeralPubkey: Uint8Array
}

export interface ProgramState {
  config: Config | null
  isInitialized: boolean
  totalTransfers: bigint
  feeBps: number
  authority: PublicKey | null
}

// ─── Client Class ──────────────────────────────────────────────────────────

export class SipPrivacyClient {
  private connection: Connection
  private programId: PublicKey

  constructor(
    connection: Connection,
    programId: PublicKey = SIP_PRIVACY_PROGRAM_ID
  ) {
    this.connection = connection
    this.programId = programId
  }

  /**
   * Fetch the program config account
   */
  async fetchConfig(): Promise<Config | null> {
    try {
      const [configPda] = getConfigPda(this.programId)
      const accountInfo = await this.connection.getAccountInfo(configPda)

      if (!accountInfo) {
        debug("Config account not found")
        return null
      }

      // Parse the account data
      // Skip the 8-byte discriminator
      const data = accountInfo.data.slice(8)

      // Parse fields according to the IDL struct layout:
      // authority: pubkey (32 bytes)
      // fee_bps: u16 (2 bytes)
      // paused: bool (1 byte)
      // total_transfers: u64 (8 bytes)
      // bump: u8 (1 byte)
      // Total: 44 bytes

      const authority = new PublicKey(data.slice(0, 32))
      const feeBps = data.readUInt16LE(32)
      const paused = data[34] === 1
      const totalTransfers = data.readBigUInt64LE(35)
      const bump = data[43]

      return {
        authority,
        feeBps,
        paused,
        totalTransfers,
        bump,
      }
    } catch (err) {
      console.error("Failed to fetch config:", err)
      return null
    }
  }

  /**
   * Get program state summary
   */
  async getState(): Promise<ProgramState> {
    const config = await this.fetchConfig()

    return {
      config,
      isInitialized: config !== null,
      totalTransfers: config?.totalTransfers ?? 0n,
      feeBps: config?.feeBps ?? 0,
      authority: config?.authority ?? null,
    }
  }

  /**
   * Build a shielded transfer instruction
   *
   * This creates the instruction data but does NOT sign or send the transaction.
   * The caller is responsible for signing with the sender's wallet.
   */
  async buildShieldedTransfer(
    sender: PublicKey,
    params: ShieldedTransferParams
  ): Promise<{
    transaction: Transaction
    transferRecord: PublicKey
    ephemeralPubkey: Uint8Array
  }> {
    // Fetch current config to get totalTransfers
    debug(`Fetching SIP Privacy config from ${this.programId.toBase58()}`)
    const config = await this.fetchConfig()
    if (!config) {
      const [configPda] = getConfigPda(this.programId)
      console.error(`[SIP Privacy] Config not found at PDA: ${configPda.toBase58()}`)
      throw new Error(`Program not initialized - config account ${configPda.toBase58()} not found`)
    }
    debug(`SIP Privacy config found: feeBps=${config.feeBps}, totalTransfers=${config.totalTransfers}`)

    if (config.paused) {
      throw new Error("Program is paused")
    }

    // Convert SOL to lamports
    const lamports = BigInt(Math.floor(params.amount * LAMPORTS_PER_SOL))

    // Use provided ephemeral key or generate new one
    // CRITICAL: If stealth address was pre-generated, must use the same ephemeral key!
    let ephemeralKeyPair: { privateKey: Uint8Array; publicKey: Uint8Array }
    if (params.ephemeralPrivateKey) {
      // Use provided ephemeral key from generateStealthAddress
      const { ed25519 } = await import("@noble/curves/ed25519")
      const publicKeyRaw = ed25519.getPublicKey(params.ephemeralPrivateKey)
      // Convert to 33-byte compressed format (0x02 prefix + 32 bytes)
      const publicKey = new Uint8Array(33)
      publicKey[0] = 0x02
      publicKey.set(publicKeyRaw, 1)
      ephemeralKeyPair = {
        privateKey: params.ephemeralPrivateKey,
        publicKey,
      }
      debug("Using provided ephemeral key for stealth transfer")
    } else {
      // Generate new ephemeral keypair (only for non-stealth transfers)
      ephemeralKeyPair = await generateEphemeralKeyPair()
      debug("Generated new ephemeral key (no pre-generated key provided)")
    }

    // Derive shared secret for amount encryption
    const sharedSecret = deriveSharedSecret(
      ephemeralKeyPair.privateKey,
      params.recipientSpendingKey
    )

    // Create Pedersen commitment for the amount
    const { commitment, blindingFactor } = await createCommitment(lamports)

    // Encrypt the amount for the recipient
    const encryptedAmount = await encryptAmount(lamports, sharedSecret)

    // Compute viewing key hash
    const viewingKeyHash = computeViewingKeyHash(params.recipientViewingKey)

    // Mock proof — real Noir/Barretenberg proofs planned for M19-M21
    const proof = await generateMockProof(commitment, blindingFactor, lamports)

    // Derive PDAs
    const [configPda] = getConfigPda(this.programId)
    const [transferRecordPda] = getTransferRecordPda(
      sender,
      config.totalTransfers,
      this.programId
    )

    // Build instruction data
    // For simplicity without full Anchor, we'll create a raw instruction
    const instructionData = this.encodeShieldedTransferData({
      amountCommitment: Array.from(commitment),
      stealthPubkey: params.stealthPubkey,
      ephemeralPubkey: Array.from(ephemeralKeyPair.publicKey),
      viewingKeyHash: Array.from(viewingKeyHash),
      encryptedAmount: Buffer.concat([
        encryptedAmount.nonce,
        encryptedAmount.ciphertext,
      ]),
      proof: Buffer.from(proof),
      actualAmount: lamports,
    })

    // Fee collector is the authority address (treasury)
    // For devnet, fees go to the program authority
    const feeCollector = config.authority

    // Create the instruction
    const instruction = new web3.TransactionInstruction({
      keys: [
        { pubkey: configPda, isSigner: false, isWritable: true },
        { pubkey: transferRecordPda, isSigner: false, isWritable: true },
        { pubkey: sender, isSigner: true, isWritable: true },
        { pubkey: params.stealthPubkey, isSigner: false, isWritable: true },
        { pubkey: feeCollector, isSigner: false, isWritable: true },
        { pubkey: web3.SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: instructionData,
    })

    // Build transaction
    const transaction = new Transaction().add(instruction)

    // Get recent blockhash
    const { blockhash } = await this.connection.getLatestBlockhash()
    transaction.recentBlockhash = blockhash
    transaction.feePayer = sender

    return {
      transaction,
      transferRecord: transferRecordPda,
      ephemeralPubkey: ephemeralKeyPair.publicKey,
    }
  }

  /**
   * Build a shielded token transfer instruction (SPL tokens via SIP Privacy Program)
   *
   * Creates a TransferRecord PDA on-chain so the scanner can discover SPL stealth payments.
   * Uses the program's shielded_token_transfer instruction.
   */
  async buildShieldedTokenTransfer(
    sender: PublicKey,
    params: ShieldedTokenTransferParams
  ): Promise<{
    transaction: Transaction
    transferRecord: PublicKey
    ephemeralPubkey: Uint8Array
  }> {
    const config = await this.fetchConfig()
    if (!config) {
      throw new Error("Program not initialized")
    }
    if (config.paused) {
      throw new Error("Program is paused")
    }

    // Convert token amount to smallest units
    const rawAmount = BigInt(Math.floor(params.amount * Math.pow(10, params.decimals)))

    // Build ephemeral key from provided private key
    const { ed25519 } = await import("@noble/curves/ed25519")
    const publicKeyRaw = ed25519.getPublicKey(params.ephemeralPrivateKey)
    const ephemeralPubkey = new Uint8Array(33)
    ephemeralPubkey[0] = 0x02
    ephemeralPubkey.set(publicKeyRaw, 1)

    // Derive shared secret
    const sharedSecret = deriveSharedSecret(
      params.ephemeralPrivateKey,
      params.recipientSpendingKey
    )

    // Create Pedersen commitment
    const { commitment, blindingFactor } = await createCommitment(rawAmount)

    // Encrypt amount
    const encryptedAmount = await encryptAmount(rawAmount, sharedSecret)

    // Compute viewing key hash
    const viewingKeyHash = computeViewingKeyHash(params.recipientViewingKey)

    // Mock proof
    const proof = await generateMockProof(commitment, blindingFactor, rawAmount)

    // Derive PDAs
    const [configPda] = getConfigPda(this.programId)
    const [transferRecordPda] = getTransferRecordPda(
      sender,
      config.totalTransfers,
      this.programId
    )

    // Build instruction data (same layout as shielded_transfer, different discriminator)
    const instructionData = this.encodeShieldedTransferData({
      amountCommitment: Array.from(commitment),
      stealthPubkey: params.stealthPubkey,
      ephemeralPubkey: Array.from(ephemeralPubkey),
      viewingKeyHash: Array.from(viewingKeyHash),
      encryptedAmount: Buffer.concat([
        encryptedAmount.nonce,
        encryptedAmount.ciphertext,
      ]),
      proof: Buffer.from(proof),
      actualAmount: rawAmount,
    })

    // Override discriminator for shielded_token_transfer
    Buffer.from([0x6e, 0x31, 0xe7, 0xe8, 0x5d, 0x8d, 0x58, 0xab])
      .copy(instructionData, 0)

    // Derive ATAs
    const senderAta = getAssociatedTokenAddress(sender, params.tokenMint)
    const stealthAta = getAssociatedTokenAddress(params.stealthPubkey, params.tokenMint)
    const feeCollectorAta = getAssociatedTokenAddress(config.authority, params.tokenMint)

    const transaction = new Transaction()

    // Create stealth ATA if needed
    if (!(await tokenAccountExists(this.connection, stealthAta))) {
      transaction.add(
        createAssociatedTokenAccountInstruction(sender, stealthAta, params.stealthPubkey, params.tokenMint)
      )
    }

    // Create fee collector ATA if needed
    if (!(await tokenAccountExists(this.connection, feeCollectorAta))) {
      transaction.add(
        createAssociatedTokenAccountInstruction(sender, feeCollectorAta, config.authority, params.tokenMint)
      )
    }

    // Add the shielded_token_transfer instruction
    const instruction = new web3.TransactionInstruction({
      keys: [
        { pubkey: configPda, isSigner: false, isWritable: true },
        { pubkey: transferRecordPda, isSigner: false, isWritable: true },
        { pubkey: sender, isSigner: true, isWritable: true },
        { pubkey: params.tokenMint, isSigner: false, isWritable: false },
        { pubkey: senderAta, isSigner: false, isWritable: true },
        { pubkey: stealthAta, isSigner: false, isWritable: true },
        { pubkey: feeCollectorAta, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: web3.SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: instructionData,
    })

    transaction.add(instruction)

    const { blockhash } = await this.connection.getLatestBlockhash()
    transaction.recentBlockhash = blockhash
    transaction.feePayer = sender

    return {
      transaction,
      transferRecord: transferRecordPda,
      ephemeralPubkey,
    }
  }

  /**
   * Build a TransferRecord announcement for a private swap.
   *
   * Uses the `create_transfer_announcement` instruction which creates
   * the on-chain record without any token transfer CPI. The actual
   * token movement is handled by Jupiter via `destinationTokenAccount`.
   * Also creates the stealth ATA if it doesn't exist yet.
   */
  async buildSwapAnnouncement(
    sender: PublicKey,
    params: {
      amount: number
      decimals: number
      tokenMint: PublicKey
      stealthPubkey: PublicKey
      recipientSpendingKey: Uint8Array
      recipientViewingKey: Uint8Array
      ephemeralPrivateKey: Uint8Array
    }
  ): Promise<{
    transaction: Transaction
    transferRecord: PublicKey
    ephemeralPubkey: Uint8Array
  }> {
    const config = await this.fetchConfig()
    if (!config) {
      throw new Error("Program not initialized")
    }
    if (config.paused) {
      throw new Error("Program is paused")
    }

    const rawAmount = BigInt(Math.floor(params.amount * Math.pow(10, params.decimals)))

    const { ed25519 } = await import("@noble/curves/ed25519")
    const publicKeyRaw = ed25519.getPublicKey(params.ephemeralPrivateKey)
    const ephemeralPubkey = new Uint8Array(33)
    ephemeralPubkey[0] = 0x02
    ephemeralPubkey.set(publicKeyRaw, 1)

    const sharedSecret = deriveSharedSecret(
      params.ephemeralPrivateKey,
      params.recipientSpendingKey
    )

    const { commitment } = await createCommitment(rawAmount)
    const encryptedAmount = await encryptAmount(rawAmount, sharedSecret)
    const viewingKeyHash = computeViewingKeyHash(params.recipientViewingKey)

    const [configPda] = getConfigPda(this.programId)
    const [transferRecordPda] = getTransferRecordPda(
      sender,
      config.totalTransfers,
      this.programId
    )

    // Encode create_transfer_announcement instruction data:
    // [8] discriminator + [33] commitment + [32] stealth_pubkey +
    // [33] ephemeral_pubkey + [32] viewing_key_hash +
    // [4 + n] encrypted_amount (vec) + [32] token_mint
    const encryptedAmountBytes = Buffer.concat([
      encryptedAmount.nonce,
      encryptedAmount.ciphertext,
    ])
    const dataSize = 8 + 33 + 32 + 33 + 32 + 4 + encryptedAmountBytes.length + 32
    const instructionData = Buffer.alloc(dataSize)
    let offset = 0

    // Discriminator: sha256("global:create_transfer_announcement")[0..8]
    Buffer.from([0x9b, 0x34, 0xb1, 0x8f, 0xd3, 0x5b, 0xcd, 0x66]).copy(instructionData, offset)
    offset += 8

    // amount_commitment: [u8; 33]
    Buffer.from(commitment).copy(instructionData, offset)
    offset += 33

    // stealth_pubkey: Pubkey
    params.stealthPubkey.toBuffer().copy(instructionData, offset)
    offset += 32

    // ephemeral_pubkey: [u8; 33]
    Buffer.from(ephemeralPubkey).copy(instructionData, offset)
    offset += 33

    // viewing_key_hash: [u8; 32]
    Buffer.from(viewingKeyHash).copy(instructionData, offset)
    offset += 32

    // encrypted_amount: Vec<u8> (4-byte LE length prefix + data)
    instructionData.writeUInt32LE(encryptedAmountBytes.length, offset)
    offset += 4
    encryptedAmountBytes.copy(instructionData, offset)
    offset += encryptedAmountBytes.length

    // token_mint: Pubkey
    params.tokenMint.toBuffer().copy(instructionData, offset)

    const stealthAta = getAssociatedTokenAddress(params.stealthPubkey, params.tokenMint)

    const transaction = new Transaction()

    // Create stealth ATA if needed (Jupiter will send output here)
    if (!(await tokenAccountExists(this.connection, stealthAta))) {
      transaction.add(
        createAssociatedTokenAccountInstruction(sender, stealthAta, params.stealthPubkey, params.tokenMint)
      )
    }

    // create_transfer_announcement: 4 accounts only (no token accounts)
    const instruction = new web3.TransactionInstruction({
      keys: [
        { pubkey: configPda, isSigner: false, isWritable: true },
        { pubkey: transferRecordPda, isSigner: false, isWritable: true },
        { pubkey: sender, isSigner: true, isWritable: true },
        { pubkey: web3.SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: instructionData,
    })

    transaction.add(instruction)

    const { blockhash } = await this.connection.getLatestBlockhash()
    transaction.recentBlockhash = blockhash
    transaction.feePayer = sender

    return {
      transaction,
      transferRecord: transferRecordPda,
      ephemeralPubkey,
    }
  }

  /**
   * Encode shielded transfer instruction data
   *
   * Layout:
   * - 8 bytes: instruction discriminator (from IDL)
   * - 33 bytes: amount_commitment
   * - 32 bytes: stealth_pubkey
   * - 33 bytes: ephemeral_pubkey
   * - 32 bytes: viewing_key_hash
   * - 4 bytes: encrypted_amount length (u32 LE)
   * - variable: encrypted_amount
   * - 4 bytes: proof length (u32 LE)
   * - variable: proof
   * - 8 bytes: actual_amount (u64 LE)
   */
  private encodeShieldedTransferData(args: ShieldedTransferArgs): Buffer {
    // Discriminator from IDL: [191, 130, 5, 127, 124, 187, 238, 188]
    const discriminator = Buffer.from([
      0xbf, 0x82, 0x05, 0x7f, 0x7c, 0xbb, 0xee, 0xbc,
    ])

    // Calculate total buffer size
    const encryptedAmountLen = args.encryptedAmount.length
    const proofLen = args.proof.length
    const totalSize =
      8 + // discriminator
      33 + // amount_commitment
      32 + // stealth_pubkey
      33 + // ephemeral_pubkey
      32 + // viewing_key_hash
      4 + encryptedAmountLen + // encrypted_amount (length prefix + data)
      4 + proofLen + // proof (length prefix + data)
      8 // actual_amount

    const buffer = Buffer.alloc(totalSize)
    let offset = 0

    // Write discriminator
    discriminator.copy(buffer, offset)
    offset += 8

    // Write amount_commitment (33 bytes)
    Buffer.from(args.amountCommitment).copy(buffer, offset)
    offset += 33

    // Write stealth_pubkey (32 bytes)
    args.stealthPubkey.toBuffer().copy(buffer, offset)
    offset += 32

    // Write ephemeral_pubkey (33 bytes)
    Buffer.from(args.ephemeralPubkey).copy(buffer, offset)
    offset += 33

    // Write viewing_key_hash (32 bytes)
    Buffer.from(args.viewingKeyHash).copy(buffer, offset)
    offset += 32

    // Write encrypted_amount (length-prefixed)
    buffer.writeUInt32LE(encryptedAmountLen, offset)
    offset += 4
    args.encryptedAmount.copy(buffer, offset)
    offset += encryptedAmountLen

    // Write proof (length-prefixed)
    buffer.writeUInt32LE(proofLen, offset)
    offset += 4
    args.proof.copy(buffer, offset)
    offset += proofLen

    // Write actual_amount (u64 LE)
    buffer.writeBigUInt64LE(args.actualAmount, offset)

    return buffer
  }

  /**
   * Send a signed transaction
   */
  async sendTransaction(signedTransaction: Transaction): Promise<string> {
    const signature = await this.connection.sendRawTransaction(
      signedTransaction.serialize()
    )

    // Wait for confirmation using new API
    const { blockhash, lastValidBlockHeight } =
      await this.connection.getLatestBlockhash()
    await this.connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    })

    return signature
  }

  /**
   * Estimate transaction fee
   */
  async estimateFee(transaction: Transaction): Promise<number> {
    const { value } = await this.connection.getFeeForMessage(
      transaction.compileMessage()
    )
    return value ?? 5000 // Default to 5000 lamports if estimation fails
  }

  /**
   * Calculate protocol fee for an amount
   */
  calculateProtocolFee(amount: number, feeBps: number): number {
    return (amount * feeBps) / 10000
  }
}

// ─── Factory Function ──────────────────────────────────────────────────────

let clientInstance: SipPrivacyClient | null = null

/**
 * Get or create the SIP Privacy client
 */
export function getSipPrivacyClient(
  connection: Connection,
  programId?: PublicKey
): SipPrivacyClient {
  if (!clientInstance) {
    clientInstance = new SipPrivacyClient(connection, programId)
  }
  return clientInstance
}

/**
 * Reset the client (useful when changing networks)
 */
export function resetSipPrivacyClient(): void {
  clientInstance = null
}

// ─── Transfer Record Types & Parsing ─────────────────────────────────────────

export interface TransferRecordData {
  pubkey: PublicKey
  sender: PublicKey
  stealthRecipient: PublicKey
  amountCommitment: Uint8Array
  ephemeralPubkey: Uint8Array
  viewingKeyHash: Uint8Array
  encryptedAmount: {
    nonce: Uint8Array
    ciphertext: Uint8Array
  }
  timestamp: bigint
  claimed: boolean
  tokenMint: PublicKey | null
  bump: number
}

// Transfer record discriminator: SHA256("account:TransferRecord").slice(0, 8)
const TRANSFER_RECORD_DISCRIMINATOR = Buffer.from([
  0xc8, 0x1f, 0x06, 0x9e, 0xf0, 0x19, 0xf8, 0x35,
])

/**
 * Parse a TransferRecord account
 *
 * Layout (after 8-byte discriminator):
 * - 32 bytes: sender
 * - 32 bytes: stealth_recipient
 * - 33 bytes: amount_commitment
 * - 33 bytes: ephemeral_pubkey
 * - 32 bytes: viewing_key_hash
 * - 4 bytes: encrypted_amount length (u32 LE)
 * - variable: encrypted_amount (nonce 24 bytes + ciphertext)
 * - 8 bytes: timestamp (i64 LE)
 * - 1 byte: claimed (bool)
 * - 1 byte: token_mint option flag
 * - 32 bytes: token_mint (if option flag is 1)
 * - 1 byte: bump
 */
function parseTransferRecord(
  pubkey: PublicKey,
  data: Buffer
): TransferRecordData | null {
  try {
    // Check discriminator
    const discriminator = data.slice(0, 8)
    if (!discriminator.equals(TRANSFER_RECORD_DISCRIMINATOR)) {
      return null
    }

    let offset = 8

    // sender (32 bytes)
    const sender = new PublicKey(data.slice(offset, offset + 32))
    offset += 32

    // stealth_recipient (32 bytes)
    const stealthRecipient = new PublicKey(data.slice(offset, offset + 32))
    offset += 32

    // amount_commitment (33 bytes)
    const amountCommitment = new Uint8Array(data.slice(offset, offset + 33))
    offset += 33

    // ephemeral_pubkey (33 bytes)
    const ephemeralPubkey = new Uint8Array(data.slice(offset, offset + 33))
    offset += 33

    // viewing_key_hash (32 bytes)
    const viewingKeyHash = new Uint8Array(data.slice(offset, offset + 32))
    offset += 32

    // encrypted_amount (length-prefixed)
    const encryptedLen = data.readUInt32LE(offset)
    offset += 4
    const encryptedData = data.slice(offset, offset + encryptedLen)
    offset += encryptedLen

    // NaCl secretbox: nonce (24 bytes) + ciphertext (rest)
    const nonce = new Uint8Array(encryptedData.slice(0, 24))
    const ciphertext = new Uint8Array(encryptedData.slice(24))

    // timestamp (i64 LE)
    const timestamp = data.readBigInt64LE(offset)
    offset += 8

    // claimed (bool)
    const claimed = data[offset] === 1
    offset += 1

    // token_mint (Option<Pubkey>)
    const tokenMintFlag = data[offset]
    offset += 1
    let tokenMint: PublicKey | null = null
    if (tokenMintFlag === 1) {
      tokenMint = new PublicKey(data.slice(offset, offset + 32))
      offset += 32
    }

    // bump
    const bump = data[offset]

    return {
      pubkey,
      sender,
      stealthRecipient,
      amountCommitment,
      ephemeralPubkey,
      viewingKeyHash,
      encryptedAmount: { nonce, ciphertext },
      timestamp,
      claimed,
      tokenMint,
      bump,
    }
  } catch (err) {
    console.error("Failed to parse transfer record:", err)
    return null
  }
}

/**
 * Fetch all transfer records from the program
 */
export async function fetchAllTransferRecords(
  connection: Connection,
  programId: PublicKey = SIP_PRIVACY_PROGRAM_ID
): Promise<TransferRecordData[]> {
  try {
    // Get all accounts owned by the program
    const accounts = await connection.getProgramAccounts(programId, {
      filters: [
        // Filter by discriminator to get only TransferRecord accounts
        {
          memcmp: {
            offset: 0,
            bytes: bs58.encode(TRANSFER_RECORD_DISCRIMINATOR),
          },
        },
      ],
    })

    debug(`Found ${accounts.length} transfer record accounts`)

    const records: TransferRecordData[] = []

    for (const { pubkey, account } of accounts) {
      const record = parseTransferRecord(pubkey, account.data as Buffer)
      if (record) {
        records.push(record)
      }
    }

    // Sort by timestamp (newest first)
    records.sort((a, b) => Number(b.timestamp - a.timestamp))

    return records
  } catch (err) {
    console.error("Failed to fetch transfer records:", err)
    return []
  }
}

// Re-export bs58 for use in fetchAllTransferRecords
import bs58 from "bs58"

// ─── Claim Transfer ──────────────────────────────────────────────────────────

export interface ClaimTransferParams {
  /** Transfer record public key */
  transferRecordPubkey: PublicKey
  /** Stealth recipient address (must match transfer record) */
  stealthAddress: PublicKey
  /** Stealth private key (scalar, hex string with 0x prefix) */
  stealthPrivateKey: string
  /** Recipient wallet address (receives the funds) */
  recipientAddress: PublicKey
}

export interface ClaimTransferResult {
  /** Transaction signature */
  signature: string
  /** Nullifier used */
  nullifier: Uint8Array
}

/**
 * Build a claim transfer transaction
 *
 * This creates a transaction to claim funds from a stealth address.
 * The stealth_account must sign to prove ownership.
 *
 * Returns:
 * - transaction: The unsigned transaction
 * - stealthScalar: The stealth private key scalar for custom signing
 * - stealthPublicKey: The stealth public key bytes
 * - nullifier: The nullifier hash
 */
export async function buildClaimTransfer(
  connection: Connection,
  params: ClaimTransferParams,
  programId: PublicKey = SIP_PRIVACY_PROGRAM_ID
): Promise<{
  transaction: Transaction
  stealthScalar: Uint8Array
  stealthPublicKey: Uint8Array
  nullifier: Uint8Array
}> {
  const { sha256 } = await import("@noble/hashes/sha256")
  const { hexToBytes } = await import("@/lib/stealth")

  // Parse stealth private key (it's a scalar, not a seed)
  const stealthPrivateKeyBytes = hexToBytes(params.stealthPrivateKey)

  // Compute public key from scalar to verify
  const stealthPublicKeyBytes = getPublicKeyFromScalar(stealthPrivateKeyBytes)
  const computedPubkey = new PublicKey(stealthPublicKeyBytes)

  // Verify the computed public key matches the expected stealth address
  if (!computedPubkey.equals(params.stealthAddress)) {
    console.error(
      "Derived stealth pubkey doesn't match!",
      "\nExpected:", params.stealthAddress.toBase58(),
      "\nGot:", computedPubkey.toBase58()
    )
    throw new Error("Stealth private key doesn't match stealth address")
  }

  // Compute nullifier: SHA256(transfer_record_pubkey || stealth_private_key)
  const nullifierPreimage = new Uint8Array([
    ...params.transferRecordPubkey.toBytes(),
    ...stealthPrivateKeyBytes,
  ])
  const nullifier = sha256(nullifierPreimage)

  // Derive PDAs
  const [configPda] = getConfigPda(programId)
  const [nullifierPda] = getNullifierPda(nullifier, programId)

  // Mock proof — real Noir/Barretenberg ZK proofs planned for M19-M21
  const mockProof = sha256(new Uint8Array([...nullifier, ...Buffer.from("CLAIM_PROOF")]))

  // Encode claim_transfer instruction data
  // Discriminator = SHA256("global:claim_transfer")[0..8]
  const discriminator = Buffer.from([
    0xca, 0xb2, 0x3a, 0xbe, 0xe6, 0xea, 0xe5, 0x11,
  ])

  const proofLen = mockProof.length
  const instructionData = Buffer.alloc(8 + 32 + 4 + proofLen)
  let offset = 0

  // Discriminator
  discriminator.copy(instructionData, offset)
  offset += 8

  // Nullifier (32 bytes)
  Buffer.from(nullifier).copy(instructionData, offset)
  offset += 32

  // Proof (length-prefixed Vec<u8>)
  instructionData.writeUInt32LE(proofLen, offset)
  offset += 4
  Buffer.from(mockProof).copy(instructionData, offset)

  // Create instruction
  const instruction = new web3.TransactionInstruction({
    keys: [
      { pubkey: configPda, isSigner: false, isWritable: false },
      { pubkey: params.transferRecordPubkey, isSigner: false, isWritable: true },
      { pubkey: nullifierPda, isSigner: false, isWritable: true },
      { pubkey: params.stealthAddress, isSigner: true, isWritable: true },
      { pubkey: params.recipientAddress, isSigner: true, isWritable: true },
      { pubkey: web3.SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId,
    data: instructionData,
  })

  // Build transaction
  const transaction = new Transaction().add(instruction)

  // Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash()
  transaction.recentBlockhash = blockhash
  transaction.feePayer = params.recipientAddress

  return {
    transaction,
    stealthScalar: stealthPrivateKeyBytes,
    stealthPublicKey: stealthPublicKeyBytes,
    nullifier,
  }
}

/**
 * Build an SPL token claim transfer transaction
 *
 * For SPL stealth payments, we do a direct token transfer from stealth ATA
 * to recipient ATA, signed by the stealth address. This avoids the PDA-owned
 * ATA mismatch with the program's claim_token_transfer instruction.
 */
export async function buildSplClaimTransfer(
  connection: Connection,
  params: {
    stealthAddress: PublicKey
    stealthPrivateKey: string
    recipientAddress: PublicKey
    tokenMint: PublicKey
    decimals: number
  }
): Promise<{
  transaction: Transaction
  stealthScalar: Uint8Array
  stealthPublicKey: Uint8Array
}> {
  const { hexToBytes } = await import("@/lib/stealth")

  const stealthPrivateKeyBytes = hexToBytes(params.stealthPrivateKey)
  const stealthPublicKeyBytes = getPublicKeyFromScalar(stealthPrivateKeyBytes)
  const computedPubkey = new PublicKey(stealthPublicKeyBytes)

  if (!computedPubkey.equals(params.stealthAddress)) {
    throw new Error("Stealth private key doesn't match stealth address")
  }

  // Derive ATAs
  const stealthAta = getAssociatedTokenAddress(params.stealthAddress, params.tokenMint)
  const recipientAta = getAssociatedTokenAddress(params.recipientAddress, params.tokenMint)

  // Get token balance from stealth ATA
  const balance = await getTokenAccountBalance(connection, stealthAta)
  if (balance <= 0n) {
    throw new Error("No token balance in stealth address")
  }

  const transaction = new Transaction()

  // Idempotent ATA create — safe even if account already exists (no-ops)
  // Avoids race condition where tokenAccountExists returns false due to RPC caching
  transaction.add(
    createIdempotentAtaInstruction(
      params.recipientAddress,
      recipientAta,
      params.recipientAddress,
      params.tokenMint
    )
  )

  // TransferChecked from stealth ATA to recipient ATA
  transaction.add(
    createTransferCheckedInstruction(
      stealthAta,
      params.tokenMint,
      recipientAta,
      params.stealthAddress, // authority (stealth address signs)
      balance,
      params.decimals
    )
  )

  // Close empty stealth ATA → reclaim rent SOL to fee payer (recipient)
  // This offsets the cost of creating the recipient ATA
  transaction.add(
    createCloseAccountInstruction(
      stealthAta,
      params.recipientAddress, // rent SOL goes to fee payer
      params.stealthAddress    // stealth address is the authority
    )
  )

  const { blockhash } = await connection.getLatestBlockhash()
  transaction.recentBlockhash = blockhash
  transaction.feePayer = params.recipientAddress

  return {
    transaction,
    stealthScalar: stealthPrivateKeyBytes,
    stealthPublicKey: stealthPublicKeyBytes,
  }
}

/**
 * Sign the stealth account portion of a claim transaction
 *
 * This adds the stealth address signature to the transaction using
 * custom ed25519 signing with the scalar (not a seed).
 */
export async function signClaimWithStealth(
  transaction: Transaction,
  stealthScalar: Uint8Array,
  stealthPublicKey: Uint8Array
): Promise<Transaction> {
  // Get the message to sign
  const message = transaction.serializeMessage()

  // Sign with the scalar
  const signature = await signWithScalar(message, stealthScalar, stealthPublicKey)

  // Add signature to transaction
  const stealthPubkey = new PublicKey(stealthPublicKey)
  transaction.addSignature(stealthPubkey, Buffer.from(signature))

  return transaction
}

/**
 * Sign a transaction message with an ed25519 scalar (not a seed)
 *
 * The stealth private key is a scalar (result of s_view + hash(S) mod L),
 * not a seed. Standard ed25519 signing expects a seed which gets hashed
 * to derive the scalar. We need custom signing that uses the scalar directly.
 *
 * ed25519 signing algorithm:
 * 1. r = SHA512(prefix || message) mod L  (nonce)
 * 2. R = r * G  (nonce point)
 * 3. k = SHA512(R || A || message) mod L
 * 4. S = (r + k * scalar) mod L
 * 5. signature = R || S (64 bytes)
 *
 * Since we don't have the original prefix, we generate a deterministic one
 * from the scalar: prefix = SHA512(scalar || "SIP-NONCE-PREFIX")[32:64]
 */
async function signWithScalar(
  message: Uint8Array,
  scalarBytes: Uint8Array,
  publicKeyBytes: Uint8Array
): Promise<Uint8Array> {
  const { ed25519 } = await import("@noble/curves/ed25519")
  const { sha512 } = await import("@noble/hashes/sha512")

  const ED25519_ORDER = BigInt(
    "0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed"
  )

  // Convert scalar bytes to bigint (little-endian)
  let scalar = 0n
  for (let i = scalarBytes.length - 1; i >= 0; i--) {
    scalar = (scalar << 8n) | BigInt(scalarBytes[i])
  }
  scalar = scalar % ED25519_ORDER

  // Generate deterministic prefix from scalar
  const prefixInput = new Uint8Array([...scalarBytes, ...Buffer.from("SIP-NONCE-PREFIX")])
  const prefixHash = sha512(prefixInput)
  const prefix = prefixHash.slice(32, 64) // Use second half as prefix

  // r = SHA512(prefix || message) mod L
  const rInput = new Uint8Array([...prefix, ...message])
  const rHash = sha512(rInput)
  let r = 0n
  for (let i = rHash.length - 1; i >= 0; i--) {
    r = (r << 8n) | BigInt(rHash[i])
  }
  r = r % ED25519_ORDER

  // R = r * G
  const R = ed25519.ExtendedPoint.BASE.multiply(r)
  const RBytes = R.toRawBytes()

  // k = SHA512(R || A || message) mod L
  const kInput = new Uint8Array([...RBytes, ...publicKeyBytes, ...message])
  const kHash = sha512(kInput)
  let k = 0n
  for (let i = kHash.length - 1; i >= 0; i--) {
    k = (k << 8n) | BigInt(kHash[i])
  }
  k = k % ED25519_ORDER

  // S = (r + k * scalar) mod L
  const S = (r + k * scalar) % ED25519_ORDER

  // Convert S to bytes (little-endian)
  const SBytes = new Uint8Array(32)
  let tempS = S
  for (let i = 0; i < 32; i++) {
    SBytes[i] = Number(tempS & 0xffn)
    tempS >>= 8n
  }

  // signature = R || S (64 bytes)
  const signature = new Uint8Array(64)
  signature.set(RBytes, 0)
  signature.set(SBytes, 32)

  return signature
}

/**
 * Get public key bytes from scalar
 */
function getPublicKeyFromScalar(scalarBytes: Uint8Array): Uint8Array {
  const { ed25519 } = require("@noble/curves/ed25519")

  const ED25519_ORDER = BigInt(
    "0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed"
  )

  // Convert scalar bytes to bigint (little-endian)
  let scalar = 0n
  for (let i = scalarBytes.length - 1; i >= 0; i--) {
    scalar = (scalar << 8n) | BigInt(scalarBytes[i])
  }
  scalar = scalar % ED25519_ORDER

  // Compute public key: P = scalar * G
  const publicKeyPoint = ed25519.ExtendedPoint.BASE.multiply(scalar)
  return publicKeyPoint.toRawBytes()
}


