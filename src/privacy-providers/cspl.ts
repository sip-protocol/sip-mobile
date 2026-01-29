/**
 * C-SPL (Confidential SPL) Adapter
 *
 * Privacy provider using Solana Token-2022 Confidential Transfer extension.
 * C-SPL encrypts token AMOUNTS while keeping addresses PUBLIC.
 *
 * Key Differences from SIP Native:
 * - C-SPL: Hidden amounts, PUBLIC addresses
 * - SIP Native: Hidden sender/recipient/amount via stealth addresses
 *
 * For full privacy (hidden everything), combine C-SPL with SIP Native:
 * 1. Wrap SPL to C-SPL (encrypted amounts)
 * 2. Transfer C-SPL to stealth address (hidden recipient)
 *
 * Flow:
 * 1. Wrap SPL token to C-SPL (encrypted balance)
 * 2. Encrypt transfer amount (Twisted ElGamal)
 * 3. Execute confidential transfer
 * 4. Recipient applies pending balance to make funds spendable
 *
 * Note: Token-2022 Confidential Transfers require ZK proofs.
 * Currently using simulated encryption as ZK ElGamal program
 * is disabled on Solana devnet/mainnet (expected Q1 2026).
 *
 * @see https://spl.solana.com/confidential-token
 * @see https://docs.arcium.com
 */

import type {
  PrivacyProviderAdapter,
  PrivacySendParams,
  PrivacySendResult,
  PrivacySendStatus,
  PrivacySwapParams,
  PrivacySwapResult,
  PrivacySwapStatus,
  AdapterOptions,
} from "./types"
import { debug } from "@/utils/logger"
import { storeComplianceRecord } from "@/lib/compliance-records"

// ============================================================================
// TYPES
// ============================================================================

/**
 * C-SPL Token configuration
 */
interface CSPLToken {
  /** Original SPL token mint address */
  mint: string
  /** C-SPL wrapped mint address */
  confidentialMint: string
  /** Token decimals */
  decimals: number
  /** Token symbol */
  symbol?: string
  /** Whether this is native SOL wrap */
  isNativeWrap?: boolean
}

/**
 * Encrypted amount with metadata
 */
interface EncryptedAmount {
  /** Encrypted ciphertext */
  ciphertext: Uint8Array
  /** Encryption nonce */
  nonce: Uint8Array
  /** Encryption type used */
  encryptionType: "twisted-elgamal" | "simulated"
}

/**
 * SDK interface for C-SPL operations
 * Wraps @sip-protocol/sdk CSPLTokenService when available
 */
interface CSPLService {
  initialize(): Promise<void>
  isConnected(): boolean
  wrap(params: {
    mint: string
    amount: bigint
    owner: string
  }): Promise<{
    success: boolean
    signature?: string
    csplMint?: string
    encryptedBalance?: Uint8Array
    error?: string
  }>
  transfer(params: {
    csplMint: string
    from: string
    to: string
    encryptedAmount: Uint8Array
    memo?: string
  }): Promise<{
    success: boolean
    signature?: string
    error?: string
  }>
  encryptAmount(amount: bigint): Promise<EncryptedAmount>
  disconnect(): Promise<void>
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Well-known C-SPL token configurations */
const CSPL_TOKENS: Record<string, CSPLToken> = {
  "C-wSOL": {
    mint: "So11111111111111111111111111111111111111112",
    confidentialMint: "cspl_So111111",
    decimals: 9,
    symbol: "C-wSOL",
    isNativeWrap: true,
  },
  "C-USDC": {
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    confidentialMint: "cspl_EPjFWdd5",
    decimals: 6,
    symbol: "C-USDC",
  },
  "C-USDT": {
    mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    confidentialMint: "cspl_Es9vMFrz",
    decimals: 6,
    symbol: "C-USDT",
  },
}

/** Solana address regex for validation */
const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

// ============================================================================
// SIMULATED C-SPL SERVICE
// ============================================================================

/**
 * Simulated C-SPL service for development/hackathon
 *
 * Uses the SDK's CSPLTokenService when available, otherwise provides
 * a simulated implementation that demonstrates the integration architecture.
 *
 * IMPORTANT: In production, this will use real Token-2022 Confidential
 * Transfer extension once ZK ElGamal proofs are enabled on Solana.
 */
class SimulatedCSPLService implements CSPLService {
  private connected = false

  constructor(_rpcUrl: string) {
    // RPC URL stored for future production use
  }

  async initialize(): Promise<void> {
    // In production: Initialize connection to Solana and verify RPC
    this.connected = true
    debug("C-SPL: Service initialized (simulated mode)")
  }

  isConnected(): boolean {
    return this.connected
  }

  async wrap(params: {
    mint: string
    amount: bigint
    owner: string
  }): Promise<{
    success: boolean
    signature?: string
    csplMint?: string
    encryptedBalance?: Uint8Array
    error?: string
  }> {
    if (!this.connected) {
      return { success: false, error: "Service not initialized" }
    }

    // Find or create C-SPL token config
    let csplToken: CSPLToken | undefined
    for (const [, config] of Object.entries(CSPL_TOKENS)) {
      if (config.mint === params.mint) {
        csplToken = config
        break
      }
    }

    if (!csplToken) {
      // Create generic config for unknown token
      csplToken = {
        mint: params.mint,
        confidentialMint: `cspl_${params.mint.slice(0, 8)}`,
        decimals: 9,
      }
    }

    // Simulate encryption of balance
    const encrypted = await this.encryptAmount(params.amount)

    // Simulate transaction signature
    const signature = `cspl_wrap_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`

    debug(`C-SPL: Wrapped ${params.amount} to ${csplToken.confidentialMint}`)

    return {
      success: true,
      signature,
      csplMint: csplToken.confidentialMint,
      encryptedBalance: encrypted.ciphertext,
    }
  }

  async transfer(params: {
    csplMint: string
    from: string
    to: string
    encryptedAmount: Uint8Array
    memo?: string
  }): Promise<{
    success: boolean
    signature?: string
    error?: string
  }> {
    if (!this.connected) {
      return { success: false, error: "Service not initialized" }
    }

    // Simulate confidential transfer
    // In production: Build and submit Token-2022 confidential transfer instruction

    const signature = `cspl_tx_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`

    debug(`C-SPL: Confidential transfer from ${params.from.slice(0, 8)}... to ${params.to.slice(0, 8)}...`)

    return {
      success: true,
      signature,
    }
  }

  async encryptAmount(amount: bigint): Promise<EncryptedAmount> {
    // Simulate Twisted ElGamal encryption
    // In production: Use actual cryptographic encryption from Token-2022

    const encoder = new TextEncoder()
    const combined = `simulated:${amount.toString()}:${Date.now()}`
    const ciphertext = encoder.encode(combined)

    // Generate random nonce
    const nonce = new Uint8Array(12)
    for (let i = 0; i < 12; i++) {
      nonce[i] = Math.floor(Math.random() * 256)
    }

    return {
      ciphertext,
      nonce,
      encryptionType: "simulated",
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false
  }
}

// ============================================================================
// C-SPL ADAPTER
// ============================================================================

export class CSPLAdapter implements PrivacyProviderAdapter {
  readonly id = "cspl" as const
  readonly name = "C-SPL Confidential Tokens"

  private options: AdapterOptions
  private initialized = false
  private service: CSPLService | null = null

  constructor(options: AdapterOptions) {
    this.options = options
  }

  async initialize(): Promise<void> {
    try {
      const rpcEndpoint = this.getRpcEndpoint()

      // NOTE: Token-2022 Confidential Transfers require ZK ElGamal proofs
      // which are currently disabled on Solana devnet/mainnet.
      // Using simulated service that demonstrates the integration architecture.
      // When C-SPL launches fully, this will use real Token-2022 instructions.
      //
      // TODO: Once CSPLTokenService is exported from @sip-protocol/sdk main entry,
      // uncomment and use:
      // const { CSPLTokenService } = await import("@sip-protocol/sdk")
      // this.service = new CSPLTokenService({ rpcUrl: rpcEndpoint })

      this.service = new SimulatedCSPLService(rpcEndpoint)
      await this.service.initialize()
      debug("C-SPL: Initialized with simulated service (Token-2022 ZK not yet enabled)")

      this.initialized = true
      debug("C-SPL: Adapter initialized")
    } catch (err) {
      debug("C-SPL: Initialization error:", err)
      // Still mark as initialized but with simulated service
      this.service = new SimulatedCSPLService(this.getRpcEndpoint())
      await this.service.initialize()
      this.initialized = true
    }
  }

  isReady(): boolean {
    return this.initialized && this.service !== null && this.service.isConnected()
  }

  supportsFeature(feature: "send" | "swap" | "viewingKeys" | "compliance"): boolean {
    switch (feature) {
      case "send":
        return true // Encrypted confidential transfers
      case "swap":
        return false // Use Arcium MPC for confidential swaps
      case "viewingKeys":
        return false // SIP Native adds viewing keys on top
      case "compliance":
        return true // Auditor keys for compliance
      default:
        return false
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ADDRESS VALIDATION
  // ─────────────────────────────────────────────────────────────────────────

  async validateRecipient(address: string): Promise<{
    isValid: boolean
    type: "stealth" | "pool" | "regular" | "invalid"
    error?: string
  }> {
    if (!address || address.trim() === "") {
      return { isValid: false, type: "invalid", error: "Address is required" }
    }

    const trimmed = address.trim()

    // C-SPL uses regular Solana addresses (amounts are encrypted, not addresses)
    // Stealth addresses should use SIP Native, not C-SPL directly
    if (trimmed.startsWith("sip:")) {
      return {
        isValid: false,
        type: "invalid",
        error: "C-SPL uses regular Solana addresses. For stealth addresses, combine with SIP Native.",
      }
    }

    // Validate Solana address format
    if (SOLANA_ADDRESS_REGEX.test(trimmed)) {
      return { isValid: true, type: "regular" }
    }

    return { isValid: false, type: "invalid", error: "Invalid Solana address format" }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WRAP/UNWRAP OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Wrap SPL tokens to C-SPL (encrypted balance)
   *
   * This is the entry point for confidential tokens.
   * After wrapping, balances are encrypted on-chain.
   */
  async wrapToken(params: {
    mint: string
    amount: string
    owner: string
  }): Promise<{
    success: boolean
    signature?: string
    csplMint?: string
    encryptedBalance?: Uint8Array
    error?: string
  }> {
    if (!this.service || !this.service.isConnected()) {
      return { success: false, error: "C-SPL service not initialized" }
    }

    // Find token config to get decimals
    let decimals = 9 // Default for SOL
    for (const [, config] of Object.entries(CSPL_TOKENS)) {
      if (config.mint === params.mint) {
        decimals = config.decimals
        break
      }
    }

    // Convert string amount to bigint (smallest units)
    const amount = BigInt(Math.floor(parseFloat(params.amount) * Math.pow(10, decimals)))

    return this.service.wrap({
      mint: params.mint,
      amount,
      owner: params.owner,
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SEND OPERATION
  // ─────────────────────────────────────────────────────────────────────────

  async send(
    params: PrivacySendParams,
    _signTransaction: (tx: Uint8Array) => Promise<Uint8Array | null>,
    onStatusChange?: (status: PrivacySendStatus) => void
  ): Promise<PrivacySendResult> {
    onStatusChange?.("validating")

    // Check if service is ready
    if (!this.service || !this.service.isConnected()) {
      onStatusChange?.("error")
      return {
        success: false,
        error: "C-SPL service not initialized. Please try again.",
        providerData: { status: "service_not_ready" },
      }
    }

    try {
      // Validate recipient
      const validation = await this.validateRecipient(params.recipient)
      if (!validation.isValid) {
        throw new Error(validation.error || "Invalid address")
      }

      onStatusChange?.("preparing")

      // Determine token configuration
      let csplMint: string = CSPL_TOKENS["C-wSOL"].confidentialMint
      let decimals = 9

      if (params.tokenMint) {
        // Find C-SPL mint for this token
        let found = false
        for (const [, config] of Object.entries(CSPL_TOKENS)) {
          if (config.mint === params.tokenMint) {
            csplMint = config.confidentialMint
            decimals = config.decimals
            found = true
            break
          }
        }
        if (!found) {
          // Create dynamic C-SPL mint for unknown token
          csplMint = `cspl_${params.tokenMint.slice(0, 8)}`
          decimals = 6 // Default for tokens
        }
      }
      // else: Default is already C-wSOL from initialization

      // Convert amount to smallest units
      const amount = BigInt(Math.floor(parseFloat(params.amount) * Math.pow(10, decimals)))

      // Encrypt the transfer amount
      debug("C-SPL: Encrypting transfer amount...")
      const encrypted = await this.service.encryptAmount(amount)

      onStatusChange?.("signing")

      // Execute confidential transfer
      // In production: This would build actual Token-2022 confidential transfer
      const result = await this.service.transfer({
        csplMint,
        from: this.options.walletAddress,
        to: params.recipient,
        encryptedAmount: encrypted.ciphertext,
        memo: params.memo,
      })

      if (!result.success) {
        throw new Error(result.error || "Confidential transfer failed")
      }

      onStatusChange?.("submitting")

      // Store compliance record
      const recordId = await storeComplianceRecord({
        provider: "cspl",
        txHash: result.signature || "pending",
        amount: params.amount,
        token: params.tokenMint ? "TOKEN" : "SOL",
        recipient: params.recipient,
        metadata: {
          transferType: "external",
          encryptedAmount: true,
          csplMint,
        },
      })

      debug("C-SPL: Compliance record stored:", recordId)

      onStatusChange?.("confirmed")

      return {
        success: true,
        txHash: result.signature,
        providerData: {
          provider: "cspl",
          csplMint,
          encryptionType: encrypted.encryptionType,
          complianceRecordId: recordId,
          note: encrypted.encryptionType === "simulated"
            ? "Using simulated encryption. Real Twisted ElGamal requires Token-2022 ZK program."
            : undefined,
        },
      }
    } catch (err) {
      onStatusChange?.("error")
      return {
        success: false,
        error: err instanceof Error ? err.message : "C-SPL transfer failed",
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SWAP OPERATION
  // ─────────────────────────────────────────────────────────────────────────

  async swap(
    _params: PrivacySwapParams,
    _signTransaction: (tx: Uint8Array) => Promise<Uint8Array | null>,
    onStatusChange?: (status: PrivacySwapStatus) => void
  ): Promise<PrivacySwapResult> {
    onStatusChange?.("error")

    // C-SPL alone cannot do swaps - need Arcium MPC for confidential swap logic
    return {
      success: false,
      error: "C-SPL does not support swaps directly. Use Arcium adapter for confidential swaps with C-SPL tokens.",
      providerData: {
        suggestion: "For confidential swaps, use the combined flow: C-SPL (encrypted amounts) + Arcium (MPC swap validation)",
      },
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VIEWING KEY INTEGRATION
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Generate viewing key proof for C-SPL transfers
   *
   * C-SPL supports auditor keys natively via the Confidential Transfer extension.
   * This method provides compatibility with SIP's viewing key layer.
   */
  async generateViewingKeyProof(
    txHash: string,
    _viewingPrivateKey: string
  ): Promise<{
    proof: string
    metadata: Record<string, unknown>
  }> {
    // C-SPL uses auditor keys for compliance
    // This proof indicates the transfer is auditable via C-SPL's native mechanism
    return {
      proof: `cspl:${txHash}:auditable`,
      metadata: {
        provider: "cspl",
        txHash,
        auditMechanism: "confidential-transfer-auditor-key",
        note: "C-SPL uses Token-2022 auditor keys. For full viewing key support, combine with SIP Native.",
      },
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  private getRpcEndpoint(): string {
    if (this.options.rpcEndpoint) {
      return this.options.rpcEndpoint
    }

    switch (this.options.network) {
      case "mainnet-beta":
        return "https://api.mainnet-beta.solana.com"
      case "devnet":
        return "https://api.devnet.solana.com"
      case "testnet":
        return "https://api.testnet.solana.com"
      default:
        return "https://api.devnet.solana.com"
    }
  }

  /**
   * Get list of supported C-SPL tokens
   */
  getSupportedTokens(): CSPLToken[] {
    return Object.values(CSPL_TOKENS)
  }

  /**
   * Check if a token has C-SPL support
   */
  isTokenSupported(mint: string): boolean {
    return Object.values(CSPL_TOKENS).some((t) => t.mint === mint)
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createCSPLAdapter(options: AdapterOptions): CSPLAdapter {
  return new CSPLAdapter(options)
}
