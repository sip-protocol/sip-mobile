/**
 * Privacy Cash Adapter
 *
 * Pool-based mixing with ZK proofs using the Privacy Cash SDK.
 * SDK: privacycash (npm) - audited by Zigtur
 *
 * Features:
 * - Pool-based deposits and withdrawals
 * - ZK proofs for privacy (snarkjs)
 * - Supports SOL, USDC, USDT
 *
 * Flow:
 * - Send: deposit(lamports) → withdraw(to recipient)
 *
 * Note: SIP adds viewing keys on top for compliance.
 *
 * @see https://github.com/Privacy-Cash/privacy-cash-sdk
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

// ============================================================================
// TYPES
// ============================================================================

/**
 * Privacy Cash SDK class
 * From: privacycash npm package
 */
interface PrivacyCashClient {
  deposit(params: { lamports: number }): Promise<{ tx: string }>
  withdraw(params: {
    lamports: number
    recipientAddress?: string
    referrer?: string
  }): Promise<{
    isPartial: boolean
    tx: string
    recipient: string
    amount_in_lamports: number
    fee_in_lamports: number
  }>
  getPrivateBalance(abortSignal?: AbortSignal): Promise<{ lamports: number }>
  depositSPL(params: {
    base_units?: number
    amount?: number
    mintAddress: string
  }): Promise<{ tx: string }>
  withdrawSPL(params: {
    base_units?: number
    amount?: number
    mintAddress: string
    recipientAddress?: string
    referrer?: string
  }): Promise<{
    isPartial: boolean
    tx: string
    recipient: string
    base_units: number
    fee_base_units: number
  }>
  getPrivateBalanceSpl(mintAddress: string): Promise<{
    base_units: number
    amount: number
    lamports: number
  }>
  clearCache(): Promise<void>
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Supported SPL tokens */
const SUPPORTED_TOKENS: Record<string, { mint: string; decimals: number }> = {
  USDC: { mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
  USDT: { mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6 },
}

/** SOL decimals */
const SOL_DECIMALS = 9

// ============================================================================
// PRIVACY CASH ADAPTER
// ============================================================================

export class PrivacyCashAdapter implements PrivacyProviderAdapter {
  readonly id = "privacy-cash" as const
  readonly name = "Privacy Cash"

  private options: AdapterOptions
  private initialized = false
  private client: PrivacyCashClient | null = null

  constructor(options: AdapterOptions) {
    this.options = options
  }

  async initialize(): Promise<void> {
    try {
      // Privacy Cash SDK requires a Keypair for signing
      // This is a security-sensitive operation that needs the private key
      //
      // INTEGRATION NOTE:
      // The SDK signs transactions internally, so we need to pass the keypair.
      // For mobile, this means extracting the key from SecureStore.
      // This should only happen with user biometric authentication.
      //
      // Example initialization (when private key is available):
      // const { PrivacyCash } = await import("privacycash")
      // this.client = new PrivacyCash({
      //   RPC_url: getRpcEndpoint(this.options.network),
      //   owner: keypairFromPrivateKey,
      //   enableDebug: __DEV__,
      // })

      debug("Privacy Cash SDK installed - awaiting keypair integration")
      this.initialized = true
    } catch (err) {
      debug("Privacy Cash initialization failed:", err)
      this.initialized = true
    }
  }

  isReady(): boolean {
    return this.initialized
  }

  supportsFeature(feature: "send" | "swap" | "viewingKeys" | "compliance"): boolean {
    switch (feature) {
      case "send":
        return true
      case "swap":
        return false // Privacy Cash focuses on transfers, not DEX
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

    // Privacy Cash uses standard Solana addresses
    const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
    if (SOLANA_ADDRESS_REGEX.test(address.trim())) {
      return { isValid: true, type: "pool" }
    }

    return { isValid: false, type: "invalid", error: "Invalid Solana address" }
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

    // Check if SDK client is available
    if (!this.client) {
      onStatusChange?.("error")
      return {
        success: false,
        error: "Privacy Cash requires keypair integration. Coming soon!",
        providerData: {
          status: "awaiting_keypair_integration",
          reason: "SDK requires direct keypair access for signing",
          package: "privacycash@1.1.11",
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

      // Convert amount to lamports (SOL) or base_units (SPL)
      const amount = parseFloat(params.amount)
      const isSPL = params.tokenMint && params.tokenMint !== "So11111111111111111111111111111111111111112"

      if (isSPL) {
        // SPL token transfer
        const tokenInfo = Object.values(SUPPORTED_TOKENS).find(t => t.mint === params.tokenMint)
        if (!tokenInfo) {
          throw new Error("Token not supported by Privacy Cash (only USDC, USDT)")
        }

        const baseUnits = Math.floor(amount * Math.pow(10, tokenInfo.decimals))

        onStatusChange?.("signing")

        // Deposit to pool
        debug("Privacy Cash: Depositing SPL to pool...")
        await this.client.depositSPL({
          base_units: baseUnits,
          mintAddress: params.tokenMint!,
        })

        onStatusChange?.("submitting")

        // Withdraw to recipient
        debug("Privacy Cash: Withdrawing SPL to recipient...")
        const result = await this.client.withdrawSPL({
          base_units: baseUnits,
          mintAddress: params.tokenMint!,
          recipientAddress: params.recipient,
        })

        onStatusChange?.("confirmed")

        return {
          success: true,
          txHash: result.tx,
          providerData: {
            provider: "privacy-cash",
            isPartial: result.isPartial,
            fee: result.fee_base_units,
          },
        }
      } else {
        // SOL transfer
        const lamports = Math.floor(amount * Math.pow(10, SOL_DECIMALS))

        onStatusChange?.("signing")

        // Deposit to pool
        debug("Privacy Cash: Depositing SOL to pool...")
        await this.client.deposit({ lamports })

        onStatusChange?.("submitting")

        // Withdraw to recipient
        debug("Privacy Cash: Withdrawing SOL to recipient...")
        const result = await this.client.withdraw({
          lamports,
          recipientAddress: params.recipient,
        })

        onStatusChange?.("confirmed")

        return {
          success: true,
          txHash: result.tx,
          providerData: {
            provider: "privacy-cash",
            isPartial: result.isPartial,
            fee: result.fee_in_lamports,
          },
        }
      }
    } catch (err) {
      onStatusChange?.("error")
      return {
        success: false,
        error: err instanceof Error ? err.message : "Privacy Cash send failed",
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SWAP OPERATION (Not supported by Privacy Cash)
  // ─────────────────────────────────────────────────────────────────────────

  async swap(
    _params: PrivacySwapParams,
    _signTransaction: (tx: Uint8Array) => Promise<Uint8Array | null>,
    onStatusChange?: (status: PrivacySwapStatus) => void
  ): Promise<PrivacySwapResult> {
    onStatusChange?.("error")
    return {
      success: false,
      error: "Privacy Cash does not support swaps. Use SIP Native for private swaps.",
      providerData: {
        provider: "privacy-cash",
        reason: "Privacy Cash focuses on private transfers, not DEX operations",
      },
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BALANCE QUERY
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get private balance in Privacy Cash pool
   * This is additional functionality not in the base adapter interface
   */
  async getPrivateBalance(): Promise<{ sol: number; usdc?: number; usdt?: number }> {
    if (!this.client) {
      return { sol: 0 }
    }

    try {
      const solBalance = await this.client.getPrivateBalance()
      const usdcBalance = await this.client.getPrivateBalanceSpl(SUPPORTED_TOKENS.USDC.mint)
      const usdtBalance = await this.client.getPrivateBalanceSpl(SUPPORTED_TOKENS.USDT.mint)

      return {
        sol: solBalance.lamports / Math.pow(10, SOL_DECIMALS),
        usdc: usdcBalance.amount,
        usdt: usdtBalance.amount,
      }
    } catch (err) {
      debug("Failed to get private balance:", err)
      return { sol: 0 }
    }
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createPrivacyCashAdapter(options: AdapterOptions): PrivacyCashAdapter {
  return new PrivacyCashAdapter(options)
}
