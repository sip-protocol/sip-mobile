/**
 * Private DeFi Hook
 *
 * Orchestrates full-stack privacy for DeFi operations by combining:
 * - Arcium: MPC-based confidential swap validation
 * - SIP Native: Stealth addresses for hidden recipients
 *
 * ## Privacy Layers
 *
 * | Layer | What it hides | Provider |
 * |-------|---------------|----------|
 * | Arcium | Swap logic/validation | MPC Network |
 * | SIP Native | Sender/Recipient | Stealth Addresses |
 *
 * ## Flow: Full Privacy Swap
 *
 * ```
 * 1. Get real quote from Jupiter
 * 2. Validate swap via Arcium MPC (encrypted validation)
 * 3. Execute swap via Jupiter
 * 4. Send output to stealth address (hidden recipient)
 * ```
 *
 * @example
 * ```tsx
 * const { privateSwap, isReady } = usePrivateDeFi()
 *
 * const result = await privateSwap({
 *   inputToken: SOL_TOKEN,
 *   outputToken: USDC_TOKEN,
 *   amount: "1.0",
 *   recipient: "sip:solana:...", // Stealth address
 *   slippageBps: 50,
 *   jupiterQuote: quoteFromUseQuote, // Real Jupiter quote
 * })
 * ```
 */

import { useState, useCallback, useMemo } from "react"
import { useSettingsStore } from "@/stores/settings"
import { useWalletStore } from "@/stores/wallet"
import { useNativeWallet } from "./useNativeWallet"
import {
  type PrivacySwapStatus,
  type AdapterOptions,
} from "@/privacy-providers"
import { ArciumAdapter } from "@/privacy-providers/arcium"
import { SipNativeAdapter } from "@/privacy-providers/sip-native"
import { storeComplianceRecord } from "@/lib/compliance-records"
import { debug } from "@/utils/logger"
import type { PrivacyLevel, TokenInfo, SwapQuote } from "@/types"
import type { JupiterQuoteResponse } from "./useQuote"

// ============================================================================
// TYPES
// ============================================================================

/**
 * Status of a private DeFi operation
 */
export type PrivateDeFiStatus =
  | "idle"
  | "validating" // Validating swap via Arcium MPC
  | "swapping" // Executing swap via Jupiter
  | "transferring" // Sending to stealth address
  | "confirming" // Waiting for confirmation
  | "success"
  | "error"

/**
 * Parameters for a full privacy swap
 */
export interface PrivateSwapParams {
  /** Input token info */
  inputToken: TokenInfo
  /** Output token info */
  outputToken: TokenInfo
  /** Amount to swap (in UI units, e.g., "1.5") */
  amount: string
  /** Recipient (stealth meta-address or regular address) */
  recipient: string
  /** Slippage tolerance in basis points (default: 50 = 0.5%) */
  slippageBps?: number
  /** Privacy level for the final transfer */
  privacyLevel?: PrivacyLevel
  /** Optional memo */
  memo?: string
  /** Real Jupiter quote (required) */
  jupiterQuote: JupiterQuoteResponse
  /** Parsed swap quote */
  quote: SwapQuote
}

/**
 * Result of a private DeFi operation
 */
export interface PrivateDeFiResult {
  success: boolean
  /** Final transaction hash */
  txHash?: string
  /** Step results for debugging */
  steps?: {
    validation?: { success: boolean; computationId?: string }
    swap?: { success: boolean; signature?: string }
    transfer?: { success: boolean; signature?: string }
  }
  /** Error message */
  error?: string
  /** Compliance record ID */
  complianceRecordId?: string | null
}

/**
 * Return type of usePrivateDeFi
 */
export interface UsePrivateDeFiReturn {
  /** Whether all adapters are ready */
  isReady: boolean
  /** Whether an operation is in progress */
  isLoading: boolean
  /** Current status */
  status: PrivateDeFiStatus
  /** Error message */
  error: string | null

  /**
   * Execute a full privacy swap
   *
   * Flow: Jupiter Quote → Arcium MPC Validation → Jupiter Swap → Stealth Transfer
   */
  privateSwap: (
    params: PrivateSwapParams,
    onStatusChange?: (status: PrivateDeFiStatus) => void
  ) => Promise<PrivateDeFiResult>
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Jupiter Swap API endpoint */
const JUPITER_SWAP_API = "https://quote-api.jup.ag/v6/swap"

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Execute swap using Jupiter API
 */
async function executeJupiterSwap(
  jupiterQuote: JupiterQuoteResponse,
  walletAddress: string,
  signTransaction: (tx: Uint8Array) => Promise<Uint8Array | null>
): Promise<{ success: boolean; signature?: string; error?: string }> {
  try {
    // 1. Get swap transaction from Jupiter
    const swapResponse = await fetch(JUPITER_SWAP_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteResponse: jupiterQuote,
        userPublicKey: walletAddress,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: "auto",
      }),
    })

    if (!swapResponse.ok) {
      const errorText = await swapResponse.text()
      throw new Error(`Jupiter swap API error: ${errorText}`)
    }

    const { swapTransaction } = await swapResponse.json()

    // 2. Deserialize and sign
    const txBuffer = Buffer.from(swapTransaction, "base64")
    const signedTx = await signTransaction(new Uint8Array(txBuffer))

    if (!signedTx) {
      throw new Error("Transaction signing cancelled")
    }

    // 3. Send transaction
    const { Connection } = await import("@solana/web3.js")
    const connection = new Connection("https://api.mainnet-beta.solana.com")

    const signature = await connection.sendRawTransaction(signedTx, {
      skipPreflight: false,
      maxRetries: 3,
    })

    // 4. Confirm
    const latestBlockhash = await connection.getLatestBlockhash()
    await connection.confirmTransaction({
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    })

    return { success: true, signature }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Jupiter swap failed",
    }
  }
}

// ============================================================================
// HOOK
// ============================================================================

export function usePrivateDeFi(): UsePrivateDeFiReturn {
  const { network } = useSettingsStore()
  const { address: walletAddress, isConnected } = useWalletStore()
  const { signTransaction } = useNativeWallet()

  const [status, setStatus] = useState<PrivateDeFiStatus>("idle")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check if we have the prerequisites
  const isReady = useMemo(
    () => isConnected && !!walletAddress,
    [isConnected, walletAddress]
  )

  // Create adapter options
  const getAdapterOptions = useCallback((): AdapterOptions => ({
    network,
    walletAddress: walletAddress || "",
  }), [network, walletAddress])

  // Wrapped sign transaction
  const wrappedSignTransaction = useCallback(
    async (tx: Uint8Array): Promise<Uint8Array | null> => {
      if (!signTransaction) {
        throw new Error("Wallet not connected")
      }

      const { Transaction } = await import("@solana/web3.js")
      const transaction = Transaction.from(tx)
      const signed = await signTransaction(transaction)

      if (!signed) {
        return null
      }

      return signed.serialize()
    },
    [signTransaction]
  )

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE SWAP (FULL PRIVACY)
  // ─────────────────────────────────────────────────────────────────────────

  const privateSwap = useCallback(
    async (
      params: PrivateSwapParams,
      onStatusChange?: (status: PrivateDeFiStatus) => void
    ): Promise<PrivateDeFiResult> => {
      if (!isReady || !walletAddress) {
        return { success: false, error: "Wallet not connected" }
      }

      if (!params.jupiterQuote) {
        return { success: false, error: "Jupiter quote required" }
      }

      setIsLoading(true)
      setError(null)

      const steps: PrivateDeFiResult["steps"] = {}

      try {
        const options = getAdapterOptions()

        // ─────────────────────────────────────────────────────────────────
        // STEP 1: Validate swap via Arcium MPC (encrypted validation)
        // ─────────────────────────────────────────────────────────────────

        setStatus("validating")
        onStatusChange?.("validating")
        debug("PrivateDeFi: Step 1 - Validating swap via Arcium MPC")

        const arciumAdapter = new ArciumAdapter(options)
        await arciumAdapter.initialize()

        // Use real quote data
        const validationResult = await arciumAdapter.swap(
          {
            quote: params.quote,
            privacyLevel: params.privacyLevel || "shielded",
            jupiterQuote: params.jupiterQuote,
          },
          wrappedSignTransaction,
          (swapStatus: PrivacySwapStatus) => {
            debug("Arcium validation status:", swapStatus)
          }
        )

        if (!validationResult.success) {
          throw new Error(validationResult.error || "MPC swap validation failed")
        }

        steps.validation = {
          success: true,
          computationId: validationResult.providerData?.computationId as string,
        }

        debug("PrivateDeFi: Swap validated via MPC:", validationResult.providerData)

        // ─────────────────────────────────────────────────────────────────
        // STEP 2: Execute swap via Jupiter
        // ─────────────────────────────────────────────────────────────────

        setStatus("swapping")
        onStatusChange?.("swapping")
        debug("PrivateDeFi: Step 2 - Executing swap via Jupiter")

        const swapResult = await executeJupiterSwap(
          params.jupiterQuote,
          walletAddress,
          wrappedSignTransaction
        )

        if (!swapResult.success) {
          throw new Error(swapResult.error || "Jupiter swap failed")
        }

        steps.swap = {
          success: true,
          signature: swapResult.signature,
        }

        debug("PrivateDeFi: Swap executed:", swapResult.signature)

        // ─────────────────────────────────────────────────────────────────
        // STEP 3: Send output to stealth address (hidden recipient)
        // ─────────────────────────────────────────────────────────────────

        setStatus("transferring")
        onStatusChange?.("transferring")
        debug("PrivateDeFi: Step 3 - Sending to stealth address")

        // Check if recipient is a stealth address
        const isStealth = params.recipient.startsWith("sip:")

        let transferResult
        if (isStealth) {
          // Use SIP Native for stealth transfer
          const sipAdapter = new SipNativeAdapter(options)
          await sipAdapter.initialize()

          transferResult = await sipAdapter.send(
            {
              amount: params.quote.outputAmount,
              recipient: params.recipient,
              privacyLevel: params.privacyLevel || "shielded",
              memo: params.memo,
              tokenMint: params.outputToken.mint,
            },
            wrappedSignTransaction
          )
        } else {
          // Regular address - direct transfer after swap
          // Swap already sent to wallet, just record compliance
          transferResult = {
            success: true,
            txHash: swapResult.signature,
          }
        }

        if (!transferResult.success) {
          throw new Error(transferResult.error || "Final transfer failed")
        }

        steps.transfer = {
          success: true,
          signature: transferResult.txHash,
        }

        debug("PrivateDeFi: Transfer complete")

        // ─────────────────────────────────────────────────────────────────
        // STEP 4: Store compliance record
        // ─────────────────────────────────────────────────────────────────

        setStatus("confirming")
        onStatusChange?.("confirming")

        const complianceRecordId = await storeComplianceRecord({
          provider: isStealth ? "sip-native" : "arcium",
          txHash: transferResult.txHash || swapResult.signature || "unknown",
          amount: params.amount,
          token: params.inputToken.symbol,
          recipient: params.recipient,
          metadata: {
            transferType: "external",
            outputToken: params.outputToken.symbol,
            slippageBps: params.slippageBps || 50,
            computationType: "private_swap",
            arciumValidation: true,
            jupiterSwap: swapResult.signature,
          },
        })

        setStatus("success")
        onStatusChange?.("success")

        return {
          success: true,
          txHash: transferResult.txHash || swapResult.signature,
          steps,
          complianceRecordId,
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Private swap failed"
        setError(errorMsg)
        setStatus("error")
        onStatusChange?.("error")

        debug("PrivateDeFi: Error:", errorMsg)

        return {
          success: false,
          error: errorMsg,
          steps,
        }
      } finally {
        setIsLoading(false)
      }
    },
    [isReady, walletAddress, getAdapterOptions, wrappedSignTransaction]
  )

  return useMemo(
    () => ({
      isReady,
      isLoading,
      status,
      error,
      privateSwap,
    }),
    [isReady, isLoading, status, error, privateSwap]
  )
}
