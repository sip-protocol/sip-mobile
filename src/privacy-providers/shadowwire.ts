/**
 * ShadowWire Adapter
 *
 * Bulletproofs + transfers using the Radr ShadowWire SDK.
 * SDK: @radr/shadowwire@1.1.15
 *
 * Features:
 * - Bulletproof ZK proofs for amount hiding
 * - Internal (fully private) and external (sender anonymous) transfers
 * - 22 supported tokens
 * - Uses signMessage (wallet adapter compatible!)
 *
 * Transfer Types:
 * - internal: Amount hidden via ZK proofs
 * - external: Visible amount, sender anonymous
 *
 * Note: SIP adds viewing keys on top for compliance.
 *
 * @see https://github.com/radrdotfun/ShadowWire
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

// ============================================================================
// TYPES (from @radr/shadowwire)
// ============================================================================

type TransferType = "internal" | "external"

interface TransferRequest {
  sender: string
  recipient: string
  amount: number
  token: string
  type: TransferType
  wallet?: {
    signMessage: (message: Uint8Array) => Promise<Uint8Array>
  }
}

interface TransferResponse {
  success: boolean
  tx_signature: string
  amount_sent: number | null
  amount_hidden: boolean
}

interface PoolBalance {
  wallet: string
  available: number
  deposited: number
  withdrawn_to_escrow: number
  migrated: boolean
  pool_address: string
}

interface ShadowWireClientType {
  getBalance(wallet: string, token?: string): Promise<PoolBalance>
  deposit(params: { wallet: string; amount: number; token?: string }): Promise<{ txHash: string }>
  withdraw(params: { wallet: string; amount: number; token?: string }): Promise<{ txHash: string }>
  transfer(params: TransferRequest): Promise<TransferResponse>
  getFeePercentage(token: string): number
  getMinimumAmount(token: string): number
  calculateFee(amount: number, token: string): { fee: number; total: number }
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default transfer type - use internal for maximum privacy */
const DEFAULT_TRANSFER_TYPE: TransferType = "internal"

/** Supported tokens from ShadowWire (22 total) */
const SUPPORTED_TOKENS: Record<string, { decimals: number; fee: number }> = {
  SOL: { decimals: 9, fee: 0.5 },
  USDC: { decimals: 6, fee: 1.0 },
  USD1: { decimals: 6, fee: 1.0 }, // WLFI USD1 stablecoin - hackathon bounty
  BONK: { decimals: 5, fee: 1.0 },
  ORE: { decimals: 11, fee: 0.3 },
  RADR: { decimals: 9, fee: 0.3 },
  JIM: { decimals: 9, fee: 1.0 },
  ANON: { decimals: 9, fee: 1.0 },
  ZEC: { decimals: 9, fee: 1.0 },
}

// ============================================================================
// SHADOWWIRE ADAPTER
// ============================================================================

export class ShadowWireAdapter implements PrivacyProviderAdapter {
  readonly id = "shadowwire" as const
  readonly name = "ShadowWire"

  private options: AdapterOptions
  private initialized = false
  private client: ShadowWireClientType | null = null

  constructor(options: AdapterOptions) {
    this.options = options
  }

  async initialize(): Promise<void> {
    try {
      // Import ShadowWire SDK
      const { ShadowWireClient } = await import("@radr/shadowwire")

      // Cast through unknown since we only use a subset of the SDK's features
      this.client = new ShadowWireClient({
        debug: false,
      }) as unknown as ShadowWireClientType

      debug("ShadowWire SDK initialized successfully")
      this.initialized = true
    } catch (err) {
      debug("ShadowWire SDK initialization failed:", err)
      // Still mark as initialized so we can show proper error messages
      this.initialized = true
    }
  }

  isReady(): boolean {
    return this.initialized && this.client !== null
  }

  supportsFeature(feature: "send" | "swap" | "viewingKeys" | "compliance"): boolean {
    switch (feature) {
      case "send":
        return true
      case "swap":
        return false // ShadowWire focuses on transfers, not DEX
      case "viewingKeys":
        return false // SIP adds this on top
      case "compliance":
        return false
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

    // ShadowWire uses standard Solana addresses
    const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
    if (SOLANA_ADDRESS_REGEX.test(address.trim())) {
      return { isValid: true, type: "regular" }
    }

    return { isValid: false, type: "invalid", error: "Invalid Solana address" }
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

    // Check if SDK client is available
    if (!this.client) {
      onStatusChange?.("error")
      return {
        success: false,
        error: "ShadowWire SDK not initialized. Please try again.",
        providerData: {
          status: "sdk_not_initialized",
          package: "@radr/shadowwire@1.1.15",
        },
      }
    }

    try {
      // Validate recipient
      const validation = await this.validateRecipient(params.recipient)
      if (!validation.isValid) {
        throw new Error(validation.error || "Invalid address")
      }

      onStatusChange?.("preparing")

      // Determine token (default to SOL)
      const token = this.getTokenSymbol(params.tokenMint) || "SOL"
      const tokenInfo = SUPPORTED_TOKENS[token]

      if (!tokenInfo) {
        throw new Error(`Token ${token} not supported by ShadowWire`)
      }

      const amount = parseFloat(params.amount)

      // Check minimum amount
      const minimum = this.client.getMinimumAmount(token)
      if (amount < minimum) {
        throw new Error(`Amount below minimum (${minimum} ${token})`)
      }

      // Calculate fee
      const feeInfo = this.client.calculateFee(amount, token)
      debug(`ShadowWire fee: ${feeInfo.fee} ${token} (${tokenInfo.fee}%)`)

      onStatusChange?.("signing")

      // Create signMessage wrapper for ShadowWire
      // ShadowWire uses signMessage (not signTransaction), which is compatible!
      const signMessage = async (message: Uint8Array): Promise<Uint8Array> => {
        // ShadowWire passes message bytes, we can use the same pattern
        const signed = await signTransaction(message)
        if (!signed) {
          throw new Error("Message signing rejected")
        }
        return signed
      }

      onStatusChange?.("submitting")

      // Execute transfer using ShadowWire
      const result = await this.client.transfer({
        sender: this.options.walletAddress,
        recipient: params.recipient,
        amount,
        token,
        type: DEFAULT_TRANSFER_TYPE,
        wallet: { signMessage },
      })

      if (!result.success) {
        throw new Error("Transfer failed")
      }

      debug("ShadowWire transfer:", result.tx_signature)

      // Store compliance record with viewing key encryption
      // This is SIP's unique value-add: compliance layer on top of ShadowWire
      const recordId = await storeComplianceRecord({
        provider: "shadowwire",
        txHash: result.tx_signature,
        amount: params.amount,
        token,
        recipient: params.recipient,
        metadata: {
          transferType: DEFAULT_TRANSFER_TYPE,
          fee: `${tokenInfo.fee}%`,
        },
      })

      debug("Compliance record stored:", recordId)

      onStatusChange?.("confirmed")

      return {
        success: true,
        txHash: result.tx_signature,
        providerData: {
          provider: "shadowwire",
          transferType: DEFAULT_TRANSFER_TYPE,
          token,
          fee: `${tokenInfo.fee}%`,
          amountHidden: result.amount_hidden,
          complianceRecordId: recordId,
        },
      }
    } catch (err) {
      onStatusChange?.("error")
      return {
        success: false,
        error: err instanceof Error ? err.message : "ShadowWire send failed",
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SWAP OPERATION (Not supported - ShadowWire focuses on transfers)
  // ─────────────────────────────────────────────────────────────────────────

  async swap(
    _params: PrivacySwapParams,
    _signTransaction: (tx: Uint8Array) => Promise<Uint8Array | null>,
    onStatusChange?: (status: PrivacySwapStatus) => void
  ): Promise<PrivacySwapResult> {
    onStatusChange?.("error")
    return {
      success: false,
      error: "ShadowWire does not support swaps. Use SIP Native for private swaps.",
      providerData: {
        provider: "shadowwire",
        reason: "ShadowWire focuses on private transfers, not DEX operations",
      },
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BALANCE QUERY
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get private balance in ShadowWire
   */
  async getPrivateBalance(token: string = "SOL"): Promise<number> {
    if (!this.client) {
      return 0
    }

    try {
      const balance = await this.client.getBalance(this.options.walletAddress, token)
      return balance.available
    } catch (err) {
      debug("Failed to get ShadowWire balance:", err)
      return 0
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

    const MINT_TO_SYMBOL: Record<string, string> = {
      So11111111111111111111111111111111111111112: "SOL",
      EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "USDC",
      "4oRwqhNroh7kgwNXCnu9idZ861zdbWLVfv7aERUcuzU3": "USD1", // WLFI USD1 - hackathon bounty
      DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: "BONK",
      oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp: "ORE",
    }
    return MINT_TO_SYMBOL[mint] || null
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createShadowWireAdapter(options: AdapterOptions): ShadowWireAdapter {
  return new ShadowWireAdapter(options)
}
