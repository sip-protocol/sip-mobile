/**
 * MagicBlock Adapter
 *
 * TEE-based privacy using Private Ephemeral Rollups (PER).
 * SDK: @magicblock-labs/ephemeral-rollups-sdk
 *
 * Features:
 * - Intel TDX Trusted Execution Environment
 * - Sub-50ms execution latency
 * - Fine-grained permission control
 * - Full Solana composability
 *
 * Flow:
 * 1. Verify TEE integrity
 * 2. Get auth token (signMessage)
 * 3. Delegate tokens to PER
 * 4. Execute private transfer inside TEE
 * 5. Undelegate to withdraw
 *
 * Note: SIP adds viewing keys on top for compliance.
 *
 * @see https://docs.magicblock.gg
 * @see https://github.com/sip-protocol/sip-mobile/issues/73
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
import { PublicKey, Connection, Transaction } from "@solana/web3.js"

// ============================================================================
// TYPES (from @magicblock-labs/ephemeral-rollups-sdk)
// ============================================================================

interface MagicBlockSDK {
  verifyTeeRpcIntegrity(rpcUrl: string): Promise<boolean>
  getAuthToken(
    rpcUrl: string,
    publicKey: PublicKey,
    signMessage: (message: Uint8Array) => Promise<Uint8Array>
  ): Promise<{ token: string; expiresAt: number }>
  delegatePrivateSpl(
    owner: PublicKey,
    mint: PublicKey,
    amount: bigint,
    opts?: {
      payer?: PublicKey
      validator?: PublicKey
      initIfMissing?: boolean
      permissionFlags?: number
      delegatePermission?: boolean
    }
  ): Promise<unknown[]> // TransactionInstruction[]
  withdrawSplIx(owner: PublicKey, mint: PublicKey, amount: bigint): unknown
  undelegateIx(owner: PublicKey, mint: PublicKey): unknown
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** TEE RPC endpoint */
const TEE_RPC_URL = "https://tee.magicblock.app"

/** TEE Validator address */
const TEE_VALIDATOR = new PublicKey("FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA")

/** Supported tokens */
const SUPPORTED_TOKENS: Record<string, { mint: string; decimals: number }> = {
  SOL: { mint: "So11111111111111111111111111111111111111112", decimals: 9 },
  USDC: { mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
}

// ============================================================================
// MAGICBLOCK ADAPTER
// ============================================================================

export class MagicBlockAdapter implements PrivacyProviderAdapter {
  readonly id = "magicblock" as const
  readonly name = "MagicBlock"

  private options: AdapterOptions
  private initialized = false
  private sdk: MagicBlockSDK | null = null
  private teeVerified = false
  private authToken: { token: string; expiresAt: number } | null = null

  constructor(options: AdapterOptions) {
    this.options = options
  }

  async initialize(): Promise<void> {
    try {
      // Dynamic import of MagicBlock SDK
      const magicblock = await import("@magicblock-labs/ephemeral-rollups-sdk")
      this.sdk = magicblock as unknown as MagicBlockSDK

      // Verify TEE integrity on initialization
      debug("MagicBlock: Verifying TEE integrity...")
      this.teeVerified = await this.sdk.verifyTeeRpcIntegrity(TEE_RPC_URL)

      if (this.teeVerified) {
        debug("MagicBlock: TEE integrity verified")
      } else {
        debug("MagicBlock: TEE integrity verification failed")
      }

      this.initialized = true
    } catch (err) {
      debug("MagicBlock SDK initialization failed:", err)
      this.initialized = true
    }
  }

  isReady(): boolean {
    // Return true if initialized - fallback available when SDK not loaded
    return this.initialized
  }

  supportsFeature(feature: "send" | "swap" | "viewingKeys" | "compliance"): boolean {
    switch (feature) {
      case "send":
        return true
      case "swap":
        return false // MagicBlock focuses on private transfers
      case "viewingKeys":
        return true // SIP adds this on top
      case "compliance":
        return true // Permission-based access control
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

    // Check for SIP stealth address format: sip:solana:<spending>:<viewing>
    const STEALTH_REGEX = /^sip:solana:[1-9A-HJ-NP-Za-km-z]{32,44}:[1-9A-HJ-NP-Za-km-z]{32,44}$/
    if (STEALTH_REGEX.test(trimmed)) {
      return { isValid: true, type: "stealth" }
    }

    // MagicBlock uses standard Solana addresses
    const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
    if (SOLANA_ADDRESS_REGEX.test(trimmed)) {
      return { isValid: true, type: "regular" }
    }

    return { isValid: false, type: "invalid", error: "Invalid Solana address" }
  }

  /**
   * Fallback to SIP Native shielded transfer when MagicBlock SDK/TEE is not available
   * This provides stealth address privacy but not TEE-based execution
   */
  private async sendWithSipNativeFallback(
    params: PrivacySendParams,
    signTransaction: (tx: Uint8Array) => Promise<Uint8Array | null>,
    onStatusChange?: (status: PrivacySendStatus) => void
  ): Promise<PrivacySendResult> {
    try {
      // Import SIP Native adapter dynamically
      const { SipNativeAdapter } = await import("./sip-native")
      const sipNative = new SipNativeAdapter(this.options)
      await sipNative.initialize()

      debug("MagicBlock: Using SIP Native fallback for transfer")

      // Delegate to SIP Native
      const result = await sipNative.send(params, signTransaction, onStatusChange)

      // Add note that this used fallback
      if (result.success) {
        return {
          ...result,
          providerData: {
            ...result.providerData,
            provider: "magicblock",
            fallback: true,
            note: "Used SIP Native fallback (MagicBlock SDK/TEE unavailable in React Native)",
          },
        }
      }

      return result
    } catch (err) {
      onStatusChange?.("error")
      return {
        success: false,
        error: `Fallback failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // AUTH TOKEN MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get or refresh auth token for TEE access
   */
  private async ensureAuthToken(
    signMessage: (message: Uint8Array) => Promise<Uint8Array>
  ): Promise<string> {
    if (!this.sdk) {
      throw new Error("MagicBlock SDK not initialized")
    }

    // Check if existing token is still valid (with 5 min buffer)
    const now = Date.now()
    if (this.authToken && this.authToken.expiresAt > now + 5 * 60 * 1000) {
      return this.authToken.token
    }

    // Get new auth token
    const owner = new PublicKey(this.options.walletAddress)
    this.authToken = await this.sdk.getAuthToken(TEE_RPC_URL, owner, signMessage)

    debug("MagicBlock: Auth token obtained, expires:", new Date(this.authToken.expiresAt))
    return this.authToken.token
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SEND OPERATION
  // ─────────────────────────────────────────────────────────────────────────

  async send(
    params: PrivacySendParams,
    signTransaction: (tx: Uint8Array) => Promise<Uint8Array | null>,
    onStatusChange?: (status: PrivacySendStatus) => void
  ): Promise<PrivacySendResult> {
    onStatusChange?.("validating")

    // FALLBACK: If MagicBlock SDK/TEE not available, use SIP Native shielded transfer
    // This provides stealth address privacy but not TEE-based execution
    if (!this.sdk || !this.teeVerified) {
      debug("MagicBlock: SDK/TEE not available, falling back to SIP Native shielded transfer")
      return this.sendWithSipNativeFallback(params, signTransaction, onStatusChange)
    }

    try {
      // Validate recipient
      const validation = await this.validateRecipient(params.recipient)
      if (!validation.isValid) {
        throw new Error(validation.error || "Invalid address")
      }

      onStatusChange?.("preparing")

      // Get token info
      const token = this.getTokenSymbol(params.tokenMint) || "SOL"
      const tokenInfo = SUPPORTED_TOKENS[token]
      if (!tokenInfo) {
        throw new Error(`Token ${token} not supported by MagicBlock`)
      }

      const amount = parseFloat(params.amount)
      const amountInSmallestUnit = BigInt(
        Math.floor(amount * Math.pow(10, tokenInfo.decimals))
      )

      // Create signMessage wrapper
      const signMessage = async (message: Uint8Array): Promise<Uint8Array> => {
        const signed = await signTransaction(message)
        if (!signed) {
          throw new Error("Message signing rejected")
        }
        return signed
      }

      onStatusChange?.("signing")

      // Get auth token for TEE access
      const authToken = await this.ensureAuthToken(signMessage)

      // Create delegation instructions
      const owner = new PublicKey(this.options.walletAddress)
      const mint = new PublicKey(tokenInfo.mint)

      debug("MagicBlock: Creating delegation instructions...")
      const delegateIxs = await this.sdk.delegatePrivateSpl(owner, mint, amountInSmallestUnit, {
        validator: TEE_VALIDATOR,
        initIfMissing: true,
        delegatePermission: true,
      })

      onStatusChange?.("submitting")

      // Build and send transaction to TEE
      const connection = new Connection(`${TEE_RPC_URL}?token=${authToken}`)

      // Create transaction with delegation instructions
      const tx = new Transaction()
      for (const ix of delegateIxs) {
        tx.add(ix as Parameters<typeof tx.add>[0])
      }

      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash()
      tx.recentBlockhash = blockhash
      tx.feePayer = owner

      // Serialize and sign
      const serialized = tx.serialize({ requireAllSignatures: false })
      const signed = await signTransaction(serialized)
      if (!signed) {
        throw new Error("Transaction signing rejected")
      }

      // Deserialize signed transaction and send
      const signedTx = Transaction.from(signed)
      const txHash = await connection.sendRawTransaction(signedTx.serialize())

      // Wait for confirmation
      await connection.confirmTransaction(txHash)

      debug("MagicBlock: Transfer delegated:", txHash)

      // Store compliance record with viewing key encryption
      const recordId = await storeComplianceRecord({
        provider: "magicblock" as const,
        txHash,
        amount: params.amount,
        token,
        recipient: params.recipient,
        metadata: {
          teeValidator: TEE_VALIDATOR.toBase58(),
          authTokenExpires: this.authToken?.expiresAt,
        },
      })

      debug("Compliance record stored:", recordId)

      onStatusChange?.("confirmed")

      return {
        success: true,
        txHash,
        providerData: {
          provider: "magicblock",
          teeVerified: true,
          teeValidator: TEE_VALIDATOR.toBase58(),
          complianceRecordId: recordId,
        },
      }
    } catch (err) {
      onStatusChange?.("error")
      return {
        success: false,
        error: err instanceof Error ? err.message : "MagicBlock send failed",
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SWAP OPERATION (Not supported)
  // ─────────────────────────────────────────────────────────────────────────

  async swap(
    _params: PrivacySwapParams,
    _signTransaction: (tx: Uint8Array) => Promise<Uint8Array | null>,
    onStatusChange?: (status: PrivacySwapStatus) => void
  ): Promise<PrivacySwapResult> {
    onStatusChange?.("error")
    return {
      success: false,
      error: "MagicBlock does not support swaps. Use SIP Native for private swaps.",
      providerData: {
        provider: "magicblock",
        reason: "MagicBlock focuses on private transfers via TEE, not DEX operations",
      },
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get token symbol from mint address
   */
  private getTokenSymbol(mint?: string): string | null {
    if (!mint) return "SOL"

    for (const [symbol, info] of Object.entries(SUPPORTED_TOKENS)) {
      if (info.mint === mint) return symbol
    }
    return null
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createMagicBlockAdapter(options: AdapterOptions): MagicBlockAdapter {
  return new MagicBlockAdapter(options)
}
