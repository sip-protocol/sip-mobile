/**
 * Swap Hook for Jupiter DEX
 *
 * Executes token swaps with:
 * - Real Jupiter Swap API integration
 * - Privacy toggle (shielded/transparent)
 * - Swap history tracking
 * - Status updates through the flow
 * - Error handling
 */

import { useState, useCallback, useRef } from "react"
import { Buffer } from "buffer"
import { Connection, PublicKey } from "@solana/web3.js"
import type { SwapQuote, PrivacyLevel } from "@/types"
import { useSwapStore } from "@/stores/swap"
import { useToastStore } from "@/stores/toast"
import { useWalletStore } from "@/stores/wallet"
import { useWallet } from "./useWallet"
import { useNativeWallet } from "./useNativeWallet"
import { useStealth } from "./useStealth"
import { useSettingsStore } from "@/stores/settings"
import { getExplorerTxUrl } from "@/utils/explorer"
import { generateStealthAddress, hexToBytes, ed25519PublicKeyToSolanaAddress } from "@/lib/stealth"
import { getAssociatedTokenAddress } from "@/lib/spl"
import { SipPrivacyClient } from "@/lib/anchor/client"
import type { JupiterQuoteResponse } from "./useQuote"

// ============================================================================
// TYPES
// ============================================================================

export type SwapStatus =
  | "idle"
  | "confirming"
  | "signing"
  | "submitting"
  | "success"
  | "error"

export interface SwapParams {
  quote: SwapQuote
  jupiterQuote: JupiterQuoteResponse
  privacyLevel: PrivacyLevel
}

export interface SwapResult {
  /** Current swap status */
  status: SwapStatus
  /** Transaction signature (Solana) */
  txSignature: string | null
  /** Explorer URL for the transaction */
  explorerUrl: string | null
  /** Error message if any */
  error: string | null
  /** Unique swap ID for tracking */
  swapId: string | null
  /** Execute the swap */
  execute: (params: SwapParams) => Promise<boolean>
  /** Reset the swap state */
  reset: () => void
}

// ============================================================================
// CONSTANTS
// ============================================================================

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Generate a unique swap ID
 */
function generateSwapId(): string {
  return `swap-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Parse swap error messages into user-friendly format
 */
function getSwapErrorMessage(err: unknown): {
  message: string
  title: string
} {
  if (!(err instanceof Error)) {
    return { message: "Transaction failed", title: "Swap Failed" }
  }

  const message = err.message.toLowerCase()

  // User rejected the transaction
  if (
    message.includes("rejected") ||
    message.includes("denied") ||
    message.includes("cancelled") ||
    message.includes("canceled")
  ) {
    return {
      message: "You rejected the transaction in your wallet",
      title: "Transaction Rejected",
    }
  }

  // Insufficient balance
  if (message.includes("insufficient") || message.includes("not enough")) {
    return {
      message: "Insufficient balance for this transaction",
      title: "Insufficient Balance",
    }
  }

  // Quote expired
  if (message.includes("expired") || message.includes("stale")) {
    return {
      message: "Quote has expired. Please get a new quote",
      title: "Quote Expired",
    }
  }

  // Slippage too high
  if (message.includes("slippage") || message.includes("price")) {
    return {
      message: "Price moved too much. Try increasing slippage tolerance",
      title: "Price Changed",
    }
  }

  // Network error
  if (
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("connection")
  ) {
    return {
      message: "Network error. Please check your connection and try again",
      title: "Network Error",
    }
  }

  // Transaction failed on-chain
  if (message.includes("reverted") || message.includes("failed")) {
    return {
      message: "Transaction failed on the network. Please try again",
      title: "Transaction Failed",
    }
  }

  // Default
  return {
    message: err.message || "Transaction failed",
    title: "Swap Failed",
  }
}

/** Jupiter Swap API endpoint */
const JUPITER_SWAP_API = "https://lite-api.jup.ag/swap/v1/swap"

/** RPC endpoint for submitting transactions */
function getRpcEndpoint(network: string): string {
  const isDev = network === "devnet"
  return isDev
    ? "https://api.devnet.solana.com"
    : "https://api.mainnet-beta.solana.com"
}

/**
 * Execute swap using Jupiter API
 */
async function executeJupiterSwap(
  jupiterQuote: JupiterQuoteResponse,
  userPublicKey: string,
  signTransaction: (tx: Uint8Array) => Promise<Uint8Array>,
  network: string,
  destinationTokenAccount?: string
): Promise<string> {
  // 1. Get swap transaction from Jupiter
  const swapBody: Record<string, unknown> = {
    quoteResponse: jupiterQuote,
    userPublicKey,
    wrapAndUnwrapSol: true,
    dynamicComputeUnitLimit: true,
    prioritizationFeeLamports: "auto",
  }

  if (destinationTokenAccount) {
    swapBody.destinationTokenAccount = destinationTokenAccount
    swapBody.wrapAndUnwrapSol = false
  }

  const swapResponse = await fetch(JUPITER_SWAP_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(swapBody),
  })

  if (!swapResponse.ok) {
    const errorText = await swapResponse.text()
    throw new Error(`Failed to get swap transaction: ${errorText}`)
  }

  const swapData = await swapResponse.json()
  const { swapTransaction } = swapData

  // 2. Deserialize the transaction
  const transactionBuffer = Buffer.from(swapTransaction, "base64")
  const transactionBytes = new Uint8Array(transactionBuffer)

  // 3. Sign the transaction
  const signedTransaction = await signTransaction(transactionBytes)

  // 4. Submit to network
  const rpcEndpoint = getRpcEndpoint(network)
  const signedBase64 = Buffer.from(signedTransaction).toString("base64")

  const sendResponse = await fetch(rpcEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "sendTransaction",
      params: [signedBase64, { encoding: "base64", skipPreflight: false }],
    }),
  })

  const sendResult = await sendResponse.json()

  if (sendResult.error) {
    throw new Error(sendResult.error.message || "Transaction failed")
  }

  const signature = sendResult.result
  if (!signature) {
    throw new Error("No signature returned from transaction")
  }

  // 5. Wait for confirmation
  await waitForConfirmation(rpcEndpoint, signature)

  return signature
}

/**
 * Wait for transaction confirmation
 */
async function waitForConfirmation(
  rpcEndpoint: string,
  signature: string,
  maxAttempts = 30,
  intervalMs = 1000
): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(rpcEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getSignatureStatuses",
          params: [[signature], { searchTransactionHistory: true }],
        }),
      })

      const result = await response.json()
      const status = result?.result?.value?.[0]

      if (status) {
        if (status.err) {
          throw new Error("Transaction failed on-chain")
        }
        if (status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized") {
          return
        }
      }
    } catch (err) {
      // Continue polling
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  throw new Error("Transaction confirmation timeout")
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook for executing Jupiter swap transactions
 *
 * @example
 * ```tsx
 * const { status, txSignature, error, execute, reset } = useSwap()
 *
 * const handleSwap = async () => {
 *   const success = await execute({
 *     quote,
 *     privacyLevel: "shielded",
 *   })
 *   if (success) {
 *     // Navigate to success screen
 *   }
 * }
 * ```
 */
export function useSwap(): SwapResult {
  const { isConnected, address, walletType } = useWalletStore()
  const { network, defaultExplorer } = useSettingsStore()
  const { signTransaction: externalSignTransaction } = useWallet()
  const { signTransaction: nativeSignTransaction } = useNativeWallet()
  const { addSwap } = useSwapStore()
  const { addToast } = useToastStore()
  const { getKeys } = useStealth()

  const [status, setStatus] = useState<SwapStatus>("idle")
  const [txSignature, setTxSignature] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [swapId, setSwapId] = useState<string | null>(null)

  const currentSwapId = useRef<string | null>(null)

  const reset = useCallback(() => {
    setStatus("idle")
    setTxSignature(null)
    setError(null)
    setSwapId(null)
    currentSwapId.current = null
  }, [])

  const execute = useCallback(
    async (params: SwapParams): Promise<boolean> => {
      const { quote, jupiterQuote, privacyLevel } = params

      // Validate wallet connection
      if (!isConnected || !address) {
        const msg = "Please connect your wallet first"
        setError(msg)
        setStatus("error")
        addToast({
          type: "warning",
          title: "Wallet Required",
          message: msg,
        })
        return false
      }

      // Validate quote
      if (!quote || !jupiterQuote) {
        const msg = "No quote available. Please refresh and try again"
        setError(msg)
        setStatus("error")
        addToast({
          type: "error",
          title: "Quote Required",
          message: msg,
        })
        return false
      }

      // Check quote expiry
      if (quote.expiresAt < Date.now()) {
        const msg = "Quote has expired. Please get a new quote"
        setError(msg)
        setStatus("error")
        addToast({
          type: "error",
          title: "Quote Expired",
          message: msg,
        })
        return false
      }

      let stealthAddr: string | undefined

      try {
        setError(null)
        setTxSignature(null)

        const newSwapId = generateSwapId()
        currentSwapId.current = newSwapId
        setSwapId(newSwapId)

        setStatus("confirming")

        let signature: string

        if (privacyLevel === "shielded") {
          // ── Private Swap Flow ──
          const keys = await getKeys()
          if (!keys) {
            throw new Error("Stealth keys not available. Please set up privacy keys first.")
          }

          const selfMetaAddress = {
            spendingKey: keys.spendingPublicKey,
            viewingKey: keys.viewingPublicKey,
            chain: "solana" as const,
          }
          const { stealthAddress: stealthResult, ephemeralPrivateKey } =
            await generateStealthAddress(selfMetaAddress)

          const stealthSolanaAddress = ed25519PublicKeyToSolanaAddress(stealthResult.address)
          const stealthPubkey = new PublicKey(stealthSolanaAddress)
          stealthAddr = stealthSolanaAddress

          const outputMint = new PublicKey(jupiterQuote.outputMint)
          const stealthAta = getAssociatedTokenAddress(stealthPubkey, outputMint)

          const rpcEndpoint = getRpcEndpoint(network)
          const connection = new Connection(rpcEndpoint)
          const client = new SipPrivacyClient(connection)
          const senderPubkey = new PublicKey(address)

          const outputDecimals = quote.outputToken.decimals

          const { transaction: announceTx } = await client.buildSwapAnnouncement(
            senderPubkey,
            {
              amount: parseFloat(quote.outputAmount),
              decimals: outputDecimals,
              tokenMint: outputMint,
              stealthPubkey,
              recipientSpendingKey: hexToBytes(keys.spendingPublicKey),
              recipientViewingKey: hexToBytes(keys.viewingPublicKey),
              ephemeralPrivateKey: hexToBytes(ephemeralPrivateKey),
            }
          )

          setStatus("signing")

          // TX1: Sign and send announcement + ATA creation
          if (walletType === "native") {
            const signedAnnounceTx = await nativeSignTransaction(announceTx)
            const announceBase64 = Buffer.from(signedAnnounceTx.serialize()).toString("base64")
            const announceResponse = await fetch(rpcEndpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "sendTransaction",
                params: [announceBase64, { encoding: "base64", skipPreflight: false }],
              }),
            })
            const announceRes = await announceResponse.json()
            if (announceRes.error) {
              throw new Error(announceRes.error.message || "Announcement transaction failed")
            }
            await waitForConfirmation(rpcEndpoint, announceRes.result)
          } else {
            const announceTxBytes = announceTx.serialize({ requireAllSignatures: false })
            const signedBytes = await externalSignTransaction(new Uint8Array(announceTxBytes))
            if (!signedBytes) throw new Error("Transaction signing rejected")
            const announceBase64 = Buffer.from(signedBytes).toString("base64")
            const announceResponse = await fetch(rpcEndpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "sendTransaction",
                params: [announceBase64, { encoding: "base64", skipPreflight: false }],
              }),
            })
            const announceRes = await announceResponse.json()
            if (announceRes.error) {
              throw new Error(announceRes.error.message || "Announcement transaction failed")
            }
            await waitForConfirmation(rpcEndpoint, announceRes.result)
          }

          // TX2: Jupiter swap with output to stealth ATA
          setStatus("submitting")
          signature = await executeJupiterSwap(
            jupiterQuote,
            address,
            async (tx: Uint8Array) => {
              let signed: Uint8Array | null = null
              if (walletType === "native") {
                const { Transaction, VersionedTransaction } = await import("@solana/web3.js")
                let txObj: InstanceType<typeof Transaction> | InstanceType<typeof VersionedTransaction>
                try {
                  txObj = VersionedTransaction.deserialize(tx)
                } catch {
                  txObj = Transaction.from(tx)
                }
                const signedTx = await nativeSignTransaction(txObj)
                signed = signedTx.serialize()
              } else {
                signed = await externalSignTransaction(tx)
              }
              if (!signed) throw new Error("Transaction signing rejected")
              return signed
            },
            network,
            stealthAta.toBase58()
          )
        } else {
          // ── Public Swap Flow (unchanged) ──
          setStatus("signing")
          signature = await executeJupiterSwap(
            jupiterQuote,
            address,
            async (tx: Uint8Array) => {
              let signed: Uint8Array | null = null
              if (walletType === "native") {
                const { Transaction, VersionedTransaction } = await import("@solana/web3.js")
                let txObj: InstanceType<typeof Transaction> | InstanceType<typeof VersionedTransaction>
                try {
                  txObj = VersionedTransaction.deserialize(tx)
                } catch {
                  txObj = Transaction.from(tx)
                }
                const signedTx = await nativeSignTransaction(txObj)
                signed = signedTx.serialize()
              } else {
                signed = await externalSignTransaction(tx)
              }
              if (!signed) throw new Error("Transaction signing rejected")
              setStatus("submitting")
              return signed
            },
            network
          )
        }

        // Success (both paths)
        setTxSignature(signature)
        setStatus("success")

        addSwap({
          id: newSwapId,
          fromToken: quote.inputToken.symbol,
          toToken: quote.outputToken.symbol,
          fromAmount: quote.inputAmount,
          toAmount: quote.outputAmount,
          privacyLevel,
          status: "completed",
          timestamp: Date.now(),
          txSignature: signature,
          explorerUrl: getExplorerTxUrl(signature, network, defaultExplorer),
          isPrivate: privacyLevel === "shielded",
          stealthAddress: stealthAddr,
          claimStatus: privacyLevel === "shielded" ? "unclaimed" : undefined,
        })

        addToast({
          type: "success",
          title: privacyLevel === "shielded" ? "Private Swap Complete" : "Swap Complete",
          message: privacyLevel === "shielded"
            ? `Swapped ${quote.inputAmount} ${quote.inputToken.symbol} to private balance. Claim from Receive tab.`
            : `Swapped ${quote.inputAmount} ${quote.inputToken.symbol} → ${quote.outputAmount} ${quote.outputToken.symbol}`,
        })

        return true
      } catch (err) {
        const { message, title } = getSwapErrorMessage(err)
        setError(message)
        setStatus("error")

        // Add failed swap to history (include stealth info for recovery)
        if (currentSwapId.current) {
          addSwap({
            id: currentSwapId.current,
            fromToken: quote.inputToken.symbol,
            toToken: quote.outputToken.symbol,
            fromAmount: quote.inputAmount,
            toAmount: quote.outputAmount,
            privacyLevel,
            status: "failed",
            timestamp: Date.now(),
            error: message,
            isPrivate: privacyLevel === "shielded" ? true : undefined,
            stealthAddress: stealthAddr || undefined,
            claimStatus: privacyLevel === "shielded" && stealthAddr ? "unclaimed" : undefined,
          })
        }

        addToast({
          type: "error",
          title,
          message,
        })

        return false
      }
    },
    [isConnected, address, network, defaultExplorer, walletType, nativeSignTransaction, externalSignTransaction, addSwap, addToast, getKeys]
  )

  // Generate explorer URL
  const explorerUrl = txSignature ? getExplorerTxUrl(txSignature, network, defaultExplorer) : null

  return {
    status,
    txSignature,
    explorerUrl,
    error,
    swapId,
    execute,
    reset,
  }
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

/**
 * Get human-readable status message
 */
export function getSwapStatusMessage(
  status: SwapStatus,
  isShielded: boolean
): string {
  switch (status) {
    case "confirming":
      return "Preparing transaction..."
    case "signing":
      return "Please approve in your wallet..."
    case "submitting":
      return isShielded ? "Submitting private swap..." : "Submitting swap..."
    case "success":
      return "Swap complete!"
    case "error":
      return "Swap failed"
    default:
      return ""
  }
}

/**
 * Check if status is a final state
 */
export function isSwapComplete(status: SwapStatus): boolean {
  return status === "success" || status === "error"
}

/**
 * Check if swap is in progress
 */
export function isSwapInProgress(status: SwapStatus): boolean {
  return (
    status === "confirming" || status === "signing" || status === "submitting"
  )
}
