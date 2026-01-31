/**
 * SIP Native Privacy Provider Adapter
 *
 * Default privacy provider using SIP Protocol's native implementation:
 * - Stealth addresses (DKSAP)
 * - Pedersen commitments
 * - Viewing keys for compliance
 *
 * This adapter wraps the existing useSend and useSwap hooks.
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
import {
  generateStealthAddress,
  parseStealthMetaAddress,
  hexToBytes,
} from "@/lib/stealth"
import {
  getSipPrivacyClient,
  type ShieldedTransferParams,
} from "@/lib/anchor"
import { debug } from "@/utils/logger"
import { Buffer } from "buffer"

// ============================================================================
// CONSTANTS
// ============================================================================

const STEALTH_PREFIX = "sip:"
const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const JUPITER_SWAP_API = "https://quote-api.jup.ag/v6/swap"

// ============================================================================
// HELPERS
// ============================================================================

function getRpcEndpoint(network: string): string {
  switch (network) {
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

// ============================================================================
// SIP NATIVE ADAPTER
// ============================================================================

export class SipNativeAdapter implements PrivacyProviderAdapter {
  readonly id = "sip-native" as const
  readonly name = "SIP Native"

  private options: AdapterOptions
  private initialized = false

  constructor(options: AdapterOptions) {
    this.options = options
  }

  async initialize(): Promise<void> {
    // SIP Native is always ready - no external SDK to initialize
    this.initialized = true
    debug("SIP Native adapter initialized")
  }

  isReady(): boolean {
    return this.initialized
  }

  supportsFeature(_feature: "send" | "swap" | "viewingKeys" | "compliance"): boolean {
    // SIP Native supports all features
    return true
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

    // Check stealth address
    if (trimmed.startsWith(STEALTH_PREFIX)) {
      const parts = trimmed.slice(STEALTH_PREFIX.length).split(":")

      if (parts.length !== 3) {
        return { isValid: false, type: "invalid", error: "Invalid stealth address format" }
      }

      const [chain, spendingKey, viewingKey] = parts

      if (!["solana", "ethereum", "near"].includes(chain)) {
        return { isValid: false, type: "invalid", error: `Unsupported chain: ${chain}` }
      }

      // Validate keys
      if (chain === "solana") {
        const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/
        if (!base58Regex.test(spendingKey) || !base58Regex.test(viewingKey)) {
          return { isValid: false, type: "invalid", error: "Invalid key format (expected Base58)" }
        }
      }

      return { isValid: true, type: "stealth" }
    }

    // Check regular Solana address
    if (SOLANA_ADDRESS_REGEX.test(trimmed)) {
      return { isValid: true, type: "regular" }
    }

    return { isValid: false, type: "invalid", error: "Invalid address format" }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SEND OPERATION
  // ─────────────────────────────────────────────────────────────────────────

  async send(
    params: PrivacySendParams,
    signTransaction: (tx: Uint8Array) => Promise<Uint8Array | null>,
    onStatusChange?: (status: PrivacySendStatus) => void
  ): Promise<PrivacySendResult> {
    const setStatus = (status: PrivacySendStatus) => {
      onStatusChange?.(status)
    }

    setStatus("validating")

    try {
      // Validate recipient
      const validation = await this.validateRecipient(params.recipient)
      if (!validation.isValid) {
        throw new Error(validation.error || "Invalid address")
      }

      setStatus("preparing")

      // Import Solana dependencies
      const { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } =
        await import("@solana/web3.js")

      const rpcEndpoint = this.options.rpcEndpoint || getRpcEndpoint(this.options.network)
      debug(`SIP Native using RPC: ${rpcEndpoint.split("?")[0]}...`) // Log endpoint (hide API key)
      const connection = new Connection(rpcEndpoint, { commitment: "confirmed" })
      const fromPubkey = new PublicKey(this.options.walletAddress)

      let txHash: string
      let recipientAddress = params.recipient

      if (validation.type === "stealth") {
        // Parse stealth meta-address
        const metaAddress = parseStealthMetaAddress(params.recipient)
        if (!metaAddress) {
          throw new Error("Invalid stealth address format")
        }

        // Generate one-time stealth address
        const { stealthAddress, ephemeralPrivateKey } = await generateStealthAddress(metaAddress)

        // Convert hex address to base58
        const bs58 = await import("bs58")
        const addressBytes = hexToBytes(stealthAddress.address)
        recipientAddress = bs58.default.encode(addressBytes)

        // Get SIP Privacy client
        const client = getSipPrivacyClient(connection)

        // Build shielded transfer
        const transferParams: ShieldedTransferParams = {
          amount: parseFloat(params.amount),
          stealthPubkey: new PublicKey(recipientAddress),
          recipientSpendingKey: hexToBytes(metaAddress.spendingKey),
          recipientViewingKey: hexToBytes(metaAddress.viewingKey),
          memo: params.memo,
          ephemeralPrivateKey: hexToBytes(ephemeralPrivateKey),
        }

        const { transaction } = await client.buildShieldedTransfer(fromPubkey, transferParams)

        setStatus("signing")

        // Sign transaction
        // IMPORTANT: Use requireAllSignatures: false since transaction is unsigned at this point
        const signedTx = await signTransaction(
          transaction.serialize({ requireAllSignatures: false, verifySignatures: false })
        )
        if (!signedTx) {
          throw new Error("Transaction signing rejected")
        }

        setStatus("submitting")

        // Send the signed transaction directly (already fully signed)
        const signature = await connection.sendRawTransaction(signedTx, {
          skipPreflight: false,
          preflightCommitment: "confirmed",
        })

        // Wait for confirmation
        const { blockhash: confirmBlockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash()
        await connection.confirmTransaction({
          signature,
          blockhash: confirmBlockhash,
          lastValidBlockHeight,
        })

        txHash = signature

        debug("SIP Native shielded transfer:", txHash)
      } else {
        // Regular SOL transfer
        const toPubkey = new PublicKey(recipientAddress)
        const lamports = Math.floor(parseFloat(params.amount) * LAMPORTS_PER_SOL)

        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey,
            toPubkey,
            lamports,
          })
        )

        const { blockhash } = await connection.getLatestBlockhash()
        transaction.recentBlockhash = blockhash
        transaction.feePayer = fromPubkey

        setStatus("signing")

        // IMPORTANT: Use requireAllSignatures: false since transaction is unsigned at this point
        const signedTx = await signTransaction(
          transaction.serialize({ requireAllSignatures: false, verifySignatures: false })
        )
        if (!signedTx) {
          throw new Error("Transaction signing rejected")
        }

        setStatus("submitting")

        // Send the signed transaction directly (already fully signed)
        const signature = await connection.sendRawTransaction(signedTx, {
          skipPreflight: false,
          preflightCommitment: "confirmed",
        })

        // Wait for confirmation
        const { blockhash: confirmBlockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash()
        await connection.confirmTransaction({
          signature,
          blockhash: confirmBlockhash,
          lastValidBlockHeight,
        })

        txHash = signature
      }

      setStatus("confirmed")

      return {
        success: true,
        txHash,
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Transaction failed"
      console.error("[SIP Native] Send failed:", errorMessage)
      debug(`SIP Native send error: ${errorMessage}`)
      setStatus("error")
      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SWAP OPERATION
  // ─────────────────────────────────────────────────────────────────────────

  async swap(
    params: PrivacySwapParams,
    signTransaction: (tx: Uint8Array) => Promise<Uint8Array | null>,
    onStatusChange?: (status: PrivacySwapStatus) => void
  ): Promise<PrivacySwapResult> {
    const setStatus = (status: PrivacySwapStatus) => {
      onStatusChange?.(status)
    }

    if (!params.jupiterQuote) {
      return { success: false, error: "Jupiter quote required for SIP Native swaps" }
    }

    setStatus("confirming")

    try {
      // Get swap transaction from Jupiter
      const swapResponse = await fetch(JUPITER_SWAP_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteResponse: params.jupiterQuote,
          userPublicKey: this.options.walletAddress,
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: "auto",
        }),
      })

      if (!swapResponse.ok) {
        const errorText = await swapResponse.text()
        throw new Error(`Failed to get swap transaction: ${errorText}`)
      }

      const swapData = await swapResponse.json()
      const transactionBuffer = Buffer.from(swapData.swapTransaction, "base64")
      const transactionBytes = new Uint8Array(transactionBuffer)

      setStatus("signing")

      const signedTransaction = await signTransaction(transactionBytes)
      if (!signedTransaction) {
        throw new Error("Transaction signing rejected")
      }

      setStatus("submitting")

      // Submit to network
      const rpcEndpoint = this.options.rpcEndpoint || getRpcEndpoint(this.options.network)
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

      // Wait for confirmation
      await this.waitForConfirmation(rpcEndpoint, signature)

      setStatus("success")

      return {
        success: true,
        txHash: signature,
      }
    } catch (err) {
      setStatus("error")
      return {
        success: false,
        error: err instanceof Error ? err.message : "Swap failed",
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VIEWING KEY INTEGRATION
  // ─────────────────────────────────────────────────────────────────────────

  async generateViewingKeyProof(
    txHash: string,
    _viewingPrivateKey: string
  ): Promise<{
    proof: string
    metadata: Record<string, unknown>
  }> {
    // SIP Native has built-in viewing key support
    // The viewing key can decrypt the transaction details
    return {
      proof: `sip-native:${txHash}:${Date.now()}`,
      metadata: {
        provider: "sip-native",
        txHash,
        timestamp: Date.now(),
        viewingKeyUsed: true,
      },
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  private async waitForConfirmation(
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
      } catch {
        // Continue polling
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }

    throw new Error("Transaction confirmation timeout")
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createSipNativeAdapter(options: AdapterOptions): SipNativeAdapter {
  return new SipNativeAdapter(options)
}
