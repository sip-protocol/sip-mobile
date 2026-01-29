/**
 * Private DeFi Hook
 *
 * Orchestrates full-stack privacy for DeFi operations by combining:
 * - C-SPL: Encrypted token amounts (Token-2022 Confidential Transfers)
 * - Arcium: MPC-based confidential swap validation
 * - SIP Native: Stealth addresses for hidden recipients
 *
 * ## Privacy Layers
 *
 * | Layer | What it hides | Provider |
 * |-------|---------------|----------|
 * | C-SPL | Token amounts | Token-2022 Confidential Transfers |
 * | Arcium | Swap logic/validation | MPC Network |
 * | SIP Native | Sender/Recipient | Stealth Addresses |
 *
 * ## Flow: Full Privacy Swap
 *
 * ```
 * 1. Wrap SPL → C-SPL (encrypted balance)
 * 2. Execute swap via Arcium MPC (encrypted validation)
 * 3. Send output to stealth address (hidden recipient)
 * ```
 *
 * @example
 * ```tsx
 * const { privateSwap, isReady } = usePrivateDeFi()
 *
 * const result = await privateSwap({
 *   inputToken: "SOL",
 *   outputToken: "USDC",
 *   amount: "1.0",
 *   recipient: "sip:solana:...", // Stealth address
 *   slippageBps: 50,
 * })
 * ```
 */

import { useState, useCallback, useMemo } from "react"
import { useSettingsStore } from "@/stores/settings"
import { useWalletStore } from "@/stores/wallet"
import { useNativeWallet } from "./useNativeWallet"
import {
  type PrivacySendStatus,
  type PrivacySwapStatus,
  type AdapterOptions,
} from "@/privacy-providers"
import { CSPLAdapter } from "@/privacy-providers/cspl"
import { ArciumAdapter } from "@/privacy-providers/arcium"
import { SipNativeAdapter } from "@/privacy-providers/sip-native"
import { storeComplianceRecord } from "@/lib/compliance-records"
import { debug } from "@/utils/logger"
import type { PrivacyLevel } from "@/types"

// ============================================================================
// TYPES
// ============================================================================

/**
 * Status of a private DeFi operation
 */
export type PrivateDeFiStatus =
  | "idle"
  | "wrapping" // Wrapping SPL to C-SPL
  | "encrypting" // Encrypting swap inputs
  | "swapping" // Executing swap via Arcium MPC
  | "transferring" // Sending to stealth address
  | "confirming" // Waiting for confirmation
  | "success"
  | "error"

/**
 * Parameters for a full privacy swap
 */
export interface PrivateSwapParams {
  /** Input token mint (or "SOL" for native) */
  inputToken: string
  /** Output token mint (or "SOL" for native) */
  outputToken: string
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
    wrap?: { success: boolean; signature?: string; csplMint?: string }
    swap?: { success: boolean; signature?: string }
    transfer?: { success: boolean; signature?: string }
  }
  /** Error message */
  error?: string
  /** Compliance record ID */
  complianceRecordId?: string | null
}

/**
 * Parameters for a confidential transfer (C-SPL only)
 */
export interface ConfidentialTransferParams {
  /** Token mint address */
  tokenMint?: string
  /** Amount to transfer */
  amount: string
  /** Recipient address (regular Solana address) */
  recipient: string
  /** Optional memo */
  memo?: string
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
   * Flow: SPL → C-SPL → Arcium Swap → Stealth Transfer
   */
  privateSwap: (
    params: PrivateSwapParams,
    onStatusChange?: (status: PrivateDeFiStatus) => void
  ) => Promise<PrivateDeFiResult>

  /**
   * Send a confidential transfer (C-SPL only)
   *
   * Hides amount but NOT recipient address.
   * For full privacy, use SIP Native stealth addresses.
   */
  confidentialTransfer: (
    params: ConfidentialTransferParams,
    onStatusChange?: (status: PrivateDeFiStatus) => void
  ) => Promise<PrivateDeFiResult>

  /**
   * Wrap SPL tokens to C-SPL
   *
   * First step for confidential token operations.
   */
  wrapToCSPL: (params: {
    tokenMint: string
    amount: string
  }) => Promise<{ success: boolean; csplMint?: string; error?: string }>
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
  // WRAP TO C-SPL
  // ─────────────────────────────────────────────────────────────────────────

  const wrapToCSPL = useCallback(
    async (params: {
      tokenMint: string
      amount: string
    }): Promise<{ success: boolean; csplMint?: string; error?: string }> => {
      if (!isReady || !walletAddress) {
        return { success: false, error: "Wallet not connected" }
      }

      try {
        const options = getAdapterOptions()
        const csplAdapter = new CSPLAdapter(options)
        await csplAdapter.initialize()

        const result = await csplAdapter.wrapToken({
          mint: params.tokenMint,
          amount: params.amount,
          owner: walletAddress,
        })

        return result
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : "Wrap failed",
        }
      }
    },
    [isReady, walletAddress, getAdapterOptions]
  )

  // ─────────────────────────────────────────────────────────────────────────
  // CONFIDENTIAL TRANSFER (C-SPL ONLY)
  // ─────────────────────────────────────────────────────────────────────────

  const confidentialTransfer = useCallback(
    async (
      params: ConfidentialTransferParams,
      onStatusChange?: (status: PrivateDeFiStatus) => void
    ): Promise<PrivateDeFiResult> => {
      if (!isReady || !walletAddress) {
        return { success: false, error: "Wallet not connected" }
      }

      setIsLoading(true)
      setError(null)
      setStatus("encrypting")
      onStatusChange?.("encrypting")

      try {
        const options = getAdapterOptions()
        const csplAdapter = new CSPLAdapter(options)
        await csplAdapter.initialize()

        setStatus("transferring")
        onStatusChange?.("transferring")

        // Execute confidential transfer
        const result = await csplAdapter.send(
          {
            amount: params.amount,
            recipient: params.recipient,
            privacyLevel: "shielded",
            memo: params.memo,
            tokenMint: params.tokenMint,
          },
          wrappedSignTransaction,
          (sendStatus: PrivacySendStatus) => {
            // Map send status to DeFi status
            if (sendStatus === "signing") setStatus("transferring")
            if (sendStatus === "submitting") setStatus("confirming")
          }
        )

        if (!result.success) {
          throw new Error(result.error || "Confidential transfer failed")
        }

        setStatus("success")
        onStatusChange?.("success")

        return {
          success: true,
          txHash: result.txHash,
          steps: {
            transfer: { success: true, signature: result.txHash },
          },
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Transfer failed"
        setError(errorMsg)
        setStatus("error")
        onStatusChange?.("error")
        return { success: false, error: errorMsg }
      } finally {
        setIsLoading(false)
      }
    },
    [isReady, walletAddress, getAdapterOptions, wrappedSignTransaction]
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

      setIsLoading(true)
      setError(null)

      const steps: PrivateDeFiResult["steps"] = {}

      try {
        const options = getAdapterOptions()

        // ─────────────────────────────────────────────────────────────────
        // STEP 1: Wrap input token to C-SPL (encrypted balance)
        // ─────────────────────────────────────────────────────────────────

        setStatus("wrapping")
        onStatusChange?.("wrapping")
        debug("PrivateDeFi: Step 1 - Wrapping to C-SPL")

        const csplAdapter = new CSPLAdapter(options)
        await csplAdapter.initialize()

        // Determine input mint
        const inputMint = params.inputToken === "SOL"
          ? "So11111111111111111111111111111111111111112"
          : params.inputToken

        const wrapResult = await csplAdapter.wrapToken({
          mint: inputMint,
          amount: params.amount,
          owner: walletAddress,
        })

        if (!wrapResult.success) {
          throw new Error(wrapResult.error || "Failed to wrap to C-SPL")
        }

        steps.wrap = {
          success: true,
          signature: wrapResult.signature,
          csplMint: wrapResult.csplMint,
        }

        debug("PrivateDeFi: Wrapped to C-SPL:", wrapResult.csplMint)

        // ─────────────────────────────────────────────────────────────────
        // STEP 2: Execute swap via Arcium MPC (encrypted validation)
        // ─────────────────────────────────────────────────────────────────

        setStatus("swapping")
        onStatusChange?.("swapping")
        debug("PrivateDeFi: Step 2 - Executing swap via Arcium MPC")

        const arciumAdapter = new ArciumAdapter(options)
        await arciumAdapter.initialize()

        // Build swap quote
        const inputAmount = parseFloat(params.amount)
        // Mock output calculation (in production, get real quote from Jupiter)
        const outputAmount = inputAmount * 0.98 // ~2% simulated slippage

        const swapResult = await arciumAdapter.swap(
          {
            quote: {
              inputToken: {
                symbol: params.inputToken,
                name: params.inputToken === "SOL" ? "Solana" : params.inputToken,
                mint: inputMint,
                decimals: 9,
              },
              outputToken: {
                symbol: params.outputToken,
                name: params.outputToken === "USDC" ? "USD Coin" : params.outputToken,
                mint: params.outputToken,
                decimals: 6,
              },
              inputAmount: params.amount,
              outputAmount: outputAmount.toString(),
              minimumReceived: (outputAmount * 0.995).toString(), // 0.5% slippage
              route: [params.inputToken, params.outputToken],
              priceImpact: 0.5,
              fees: {
                networkFee: "0.000005",
                platformFee: "0",
              },
              estimatedTime: 30,
              expiresAt: Date.now() + 60000, // 1 minute
            },
            privacyLevel: params.privacyLevel || "shielded",
          },
          wrappedSignTransaction,
          (_swapStatus: PrivacySwapStatus) => {
            // Already in swapping state
          }
        )

        if (!swapResult.success) {
          throw new Error(swapResult.error || "MPC swap validation failed")
        }

        steps.swap = {
          success: true,
          signature: swapResult.txHash,
        }

        debug("PrivateDeFi: Swap validated via MPC")

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
              amount: outputAmount.toString(),
              recipient: params.recipient,
              privacyLevel: params.privacyLevel || "shielded",
              memo: params.memo,
            },
            wrappedSignTransaction
          )
        } else {
          // Regular address - use C-SPL for encrypted amount
          transferResult = await csplAdapter.send(
            {
              amount: outputAmount.toString(),
              recipient: params.recipient,
              privacyLevel: params.privacyLevel || "shielded",
              memo: params.memo,
              tokenMint: params.outputToken === "SOL" ? undefined : params.outputToken,
            },
            wrappedSignTransaction
          )
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
          provider: isStealth ? "sip-native" : "cspl",
          txHash: transferResult.txHash || "combined",
          amount: params.amount,
          token: params.inputToken,
          recipient: params.recipient,
          metadata: {
            transferType: "external",
            outputToken: params.outputToken,
            slippageBps: params.slippageBps || 50,
            computationType: "private_swap",
            encrypted: true,
          },
        })

        setStatus("success")
        onStatusChange?.("success")

        return {
          success: true,
          txHash: transferResult.txHash,
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
      confidentialTransfer,
      wrapToCSPL,
    }),
    [isReady, isLoading, status, error, privateSwap, confidentialTransfer, wrapToCSPL]
  )
}
