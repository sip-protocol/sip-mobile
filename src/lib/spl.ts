/**
 * SPL Token Transfer Helpers
 *
 * Manual instruction construction for SPL token transfers.
 * Avoids @solana/spl-token dependency — constructs raw instructions.
 *
 * Supports:
 * - Associated Token Account (ATA) derivation and creation
 * - SPL Token Transfer (TransferChecked instruction)
 * - Works with both regular and stealth addresses
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js"

// ─── Constants ─────────────────────────────────────────────────────────────

export const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
)

export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
)

// ─── ATA Derivation ────────────────────────────────────────────────────────

/**
 * Derive the Associated Token Account address for a wallet + mint
 */
export function getAssociatedTokenAddress(
  owner: PublicKey,
  mint: PublicKey
): PublicKey {
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  )
  return ata
}

// ─── Instructions ──────────────────────────────────────────────────────────

/**
 * Create an Associated Token Account instruction
 *
 * Accounts:
 *   0. payer (signer, writable) — pays for account creation
 *   1. associatedToken (writable) — the ATA to create
 *   2. owner — the wallet that owns the ATA
 *   3. mint — the token mint
 *   4. SystemProgram
 *   5. TokenProgram
 */
export function createAssociatedTokenAccountInstruction(
  payer: PublicKey,
  associatedToken: PublicKey,
  owner: PublicKey,
  mint: PublicKey
): TransactionInstruction {
  return new TransactionInstruction({
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: associatedToken, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    data: Buffer.alloc(0), // No data needed for create ATA
  })
}

/**
 * Create a TransferChecked instruction (SPL Token instruction index 12)
 *
 * Data layout: [12, amount (u64 LE), decimals (u8)]
 *
 * Accounts:
 *   0. source (writable) — sender's ATA
 *   1. mint — the token mint
 *   2. destination (writable) — recipient's ATA
 *   3. authority (signer) — owner of source ATA
 */
export function createTransferCheckedInstruction(
  source: PublicKey,
  mint: PublicKey,
  destination: PublicKey,
  authority: PublicKey,
  amount: bigint,
  decimals: number
): TransactionInstruction {
  const data = Buffer.alloc(10) // 1 + 8 + 1
  data.writeUInt8(12, 0) // TransferChecked instruction index
  data.writeBigUInt64LE(amount, 1)
  data.writeUInt8(decimals, 9)

  return new TransactionInstruction({
    keys: [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    programId: TOKEN_PROGRAM_ID,
    data,
  })
}

// ─── Token Account Helpers ─────────────────────────────────────────────────

/**
 * Check if a token account exists
 */
export async function tokenAccountExists(
  connection: Connection,
  tokenAccount: PublicKey
): Promise<boolean> {
  const info = await connection.getAccountInfo(tokenAccount)
  return info !== null
}

/**
 * Get token balance for a specific ATA
 * Returns the raw amount (smallest units)
 */
export async function getTokenAccountBalance(
  connection: Connection,
  tokenAccount: PublicKey
): Promise<bigint> {
  try {
    const info = await connection.getAccountInfo(tokenAccount)
    if (!info || info.data.length < 72) return 0n

    // Token account data layout: offset 64 = amount (u64 LE)
    const amount = info.data.readBigUInt64LE(64)
    return amount
  } catch {
    return 0n
  }
}

/**
 * Get mint decimals from on-chain data
 */
export async function getMintDecimals(
  connection: Connection,
  mint: PublicKey
): Promise<number> {
  const info = await connection.getAccountInfo(mint)
  if (!info) throw new Error(`Mint not found: ${mint.toBase58()}`)

  // Mint data layout: offset 44 = decimals (u8)
  return info.data[44]
}

// ─── High-Level Transfer ───────────────────────────────────────────────────

/**
 * Build an SPL token transfer transaction
 *
 * Handles:
 * - ATA derivation for sender and recipient
 * - Creates recipient ATA if it doesn't exist
 * - TransferChecked instruction with proper decimals
 *
 * @param connection - Solana connection
 * @param sender - Sender wallet address
 * @param recipient - Recipient wallet address (regular Solana address)
 * @param mint - Token mint address
 * @param amount - Amount in token units (e.g., 1.5 for 1.5 tokens)
 * @param decimals - Token decimals (if known, skips on-chain lookup)
 * @returns Transaction ready for signing
 */
export async function buildSplTransferTransaction(
  connection: Connection,
  sender: PublicKey,
  recipient: PublicKey,
  mint: PublicKey,
  amount: number,
  decimals?: number
): Promise<Transaction> {
  // Get decimals from mint if not provided
  const tokenDecimals = decimals ?? await getMintDecimals(connection, mint)

  // Convert to smallest units
  const rawAmount = BigInt(Math.floor(amount * Math.pow(10, tokenDecimals)))

  // Derive ATAs
  const senderAta = getAssociatedTokenAddress(sender, mint)
  const recipientAta = getAssociatedTokenAddress(recipient, mint)

  const transaction = new Transaction()

  // Create recipient ATA if it doesn't exist
  const recipientAtaExists = await tokenAccountExists(connection, recipientAta)
  if (!recipientAtaExists) {
    transaction.add(
      createAssociatedTokenAccountInstruction(sender, recipientAta, recipient, mint)
    )
  }

  // Add transfer instruction
  transaction.add(
    createTransferCheckedInstruction(
      senderAta,
      mint,
      recipientAta,
      sender,
      rawAmount,
      tokenDecimals
    )
  )

  // Set recent blockhash and fee payer
  const { blockhash } = await connection.getLatestBlockhash()
  transaction.recentBlockhash = blockhash
  transaction.feePayer = sender

  return transaction
}
