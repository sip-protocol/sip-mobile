/**
 * Payment Claiming Hook
 *
 * Handles the claiming of stealth payments:
 * 1. Derive spending key from stealth address + viewing key
 * 2. Sign claim transaction with stealth private key
 * 3. Submit to network via Anchor program
 * 4. Update payment status
 */

import { useState, useCallback, useMemo } from "react"
import * as SecureStore from "expo-secure-store"
import { Connection, PublicKey, Transaction } from "@solana/web3.js"
import { usePrivacyStore } from "@/stores/privacy"
import { useWalletStore } from "@/stores/wallet"
import { useSettingsStore } from "@/stores/settings"
import { useNativeWallet } from "./useNativeWallet"
import { getKeyById } from "./useStealth"
import type { PaymentRecord, StealthKeys, StealthKeysStorage } from "@/types"
import {
  deriveStealthPrivateKey,
  type StealthAddress,
} from "@/lib/stealth"
import { buildClaimTransfer, signClaimWithStealth } from "@/lib/anchor/client"
import { debug } from "@/utils/logger"
import bs58 from "bs58"

// ============================================================================
// TYPES
// ============================================================================

export interface ClaimResult {
  success: boolean
  txHash?: string
  error?: string
}

export type ClaimStatus =
  | "idle"
  | "deriving"
  | "signing"
  | "submitting"
  | "confirmed"
  | "error"

export interface ClaimProgress {
  status: ClaimStatus
  message: string
  step: number
  totalSteps: number
}

export interface UseClaimReturn {
  // State
  progress: ClaimProgress
  error: string | null

  // Actions
  claim: (payment: PaymentRecord) => Promise<ClaimResult>
  claimMultiple: (payments: PaymentRecord[]) => Promise<ClaimResult[]>
  reset: () => void

  // Queries
  getUnclaimedPayments: () => PaymentRecord[]
  getClaimableAmount: () => { amount: number; count: number }
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SECURE_STORE_KEY_V2 = "sip_stealth_keys_v2"
const LEGACY_STORE_KEY = "sip_stealth_keys"
const CLAIM_STEPS = 4

/**
 * Load stealth keys for claiming a payment
 *
 * If payment has keyId, loads from archived keys.
 * Falls back to active keys for legacy payments. (#72)
 */
async function loadKeysForPayment(payment: PaymentRecord): Promise<StealthKeys | null> {
  // If payment has keyId, load that specific key set (archival system)
  if (payment.keyId) {
    const keyRecord = await getKeyById(payment.keyId)
    if (keyRecord) {
      return keyRecord.keys
    }
    console.warn(`Keys for keyId ${payment.keyId} not found, trying active keys`)
  }

  // Fall back to active keys (for legacy payments or if keyId not found)
  try {
    // Try v2 archival format first
    const storageV2 = await SecureStore.getItemAsync(SECURE_STORE_KEY_V2)
    if (storageV2) {
      const storage = JSON.parse(storageV2) as StealthKeysStorage
      if (storage.activeKeyId) {
        const activeRecord = storage.records.find((r) => r.id === storage.activeKeyId)
        if (activeRecord) {
          return activeRecord.keys
        }
      }
    }

    // Fall back to legacy format
    const legacy = await SecureStore.getItemAsync(LEGACY_STORE_KEY)
    if (legacy) {
      return JSON.parse(legacy) as StealthKeys
    }
  } catch (err) {
    console.error("Failed to load stealth keys:", err)
  }

  return null
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Parse a stealth address string into StealthAddress components
 * Format: sip:solana:<ephemeralPubKey>:derived or just the address
 */
function parsePaymentStealthAddress(addressStr: string | undefined): StealthAddress | null {
  if (!addressStr) return null

  // Try to parse SIP format: sip:solana:<ephemeral>:derived
  if (addressStr.startsWith("sip:")) {
    const parts = addressStr.split(":")
    if (parts.length >= 3) {
      const ephemeralPubKey = parts[2]
      // Derive view tag from ephemeral key (first byte of hash)
      const viewTag = parseInt(ephemeralPubKey.slice(2, 4), 16)
      return {
        address: parts[3] || "", // May not have actual address
        ephemeralPublicKey: ephemeralPubKey.startsWith("0x") ? ephemeralPubKey : `0x${ephemeralPubKey}`,
        viewTag,
      }
    }
  }

  return null
}

/**
 * Derive the stealth private key using real cryptographic operations
 *
 * Uses DKSAP (Dual-Key Stealth Address Protocol):
 * 1. Compute shared secret: S = spending_scalar * ephemeral_pubkey
 * 2. Hash the shared secret
 * 3. Derive: stealth_private = viewing_scalar + hash(S) mod L
 */
async function deriveSpendingKeyFromPayment(
  payment: PaymentRecord,
  spendingPrivateKey: string,
  viewingPrivateKey: string
): Promise<string | null> {
  const stealthAddr = parsePaymentStealthAddress(payment.stealthAddress)
  if (!stealthAddr || !stealthAddr.ephemeralPublicKey) {
    console.error("Invalid stealth address format")
    return null
  }

  try {
    // Use real cryptographic key derivation
    const derivedKey = deriveStealthPrivateKey(
      stealthAddr,
      spendingPrivateKey,
      viewingPrivateKey
    )
    return derivedKey
  } catch (err) {
    console.error("Failed to derive stealth private key:", err)
    return null
  }
}

/**
 * Build and sign the claim transaction
 *
 * In production, this builds a Solana transaction that:
 * 1. Transfers funds from the stealth address to the user's wallet
 * 2. Signs with the derived stealth private key
 */
/**
 * Get RPC URL for network
 */
function getRpcUrl(network: string): string {
  return network === "mainnet-beta"
    ? "https://api.mainnet-beta.solana.com"
    : "https://api.devnet.solana.com"
}

/**
 * Find transfer record PDA from stealth address
 *
 * The stealth address format is: sip:solana:<ephemeralHex>:<stealthBase58>
 * The transfer record pubkey is stored in txHash field as fallback
 */
async function findTransferRecordPubkey(
  payment: PaymentRecord,
  connection: Connection
): Promise<PublicKey | null> {
  // Try to use the txHash which stores the transfer record PDA
  if (payment.txHash && !payment.txHash.startsWith("mock_")) {
    try {
      return new PublicKey(payment.txHash)
    } catch {
      // Not a valid pubkey, continue to search
    }
  }

  // Fallback: search program accounts for this stealth recipient
  // Parse the stealth address to get the recipient pubkey
  const stealthAddr = parsePaymentStealthAddress(payment.stealthAddress)
  if (!stealthAddr || !stealthAddr.address) {
    console.error("Cannot parse stealth address")
    return null
  }

  // The stealthAddr.address is base58 of the stealth recipient
  try {
    const { SIP_PRIVACY_PROGRAM_ID } = await import("@/lib/anchor/types")
    const stealthPubkey = new PublicKey(stealthAddr.address)

    // Search for transfer records with this stealth recipient
    const accounts = await connection.getProgramAccounts(SIP_PRIVACY_PROGRAM_ID, {
      filters: [
        // TransferRecord discriminator
        {
          memcmp: {
            offset: 0,
            bytes: bs58.encode(Buffer.from([0xc8, 0x1f, 0x06, 0x9e, 0xf0, 0x19, 0xf8, 0x35])),
          },
        },
        // stealth_recipient at offset 8 + 32 = 40
        {
          memcmp: {
            offset: 40,
            bytes: stealthPubkey.toBase58(),
          },
        },
      ],
    })

    if (accounts.length > 0) {
      return accounts[0].pubkey
    }
  } catch (err) {
    console.error("Failed to search for transfer record:", err)
  }

  return null
}

// ============================================================================
// HOOK
// ============================================================================

export function useClaim(): UseClaimReturn {
  const { isConnected, address: walletAddress } = useWalletStore()
  const { network } = useSettingsStore()
  const { payments, updatePayment } = usePrivacyStore()
  const { signTransaction } = useNativeWallet()

  const [progress, setProgress] = useState<ClaimProgress>({
    status: "idle",
    message: "Ready to claim",
    step: 0,
    totalSteps: CLAIM_STEPS,
  })
  const [error, setError] = useState<string | null>(null)

  const claim = useCallback(
    async (payment: PaymentRecord): Promise<ClaimResult> => {
      if (!isConnected || !walletAddress) {
        return { success: false, error: "Wallet not connected" }
      }

      if (payment.claimed) {
        return { success: false, error: "Payment already claimed" }
      }

      if (payment.type !== "receive") {
        return { success: false, error: "Can only claim received payments" }
      }

      setError(null)

      try {
        // Step 1: Load keys (supports archived keys via keyId) (#72)
        setProgress({
          status: "deriving",
          message: "Loading stealth keys...",
          step: 1,
          totalSteps: CLAIM_STEPS,
        })

        const keys = await loadKeysForPayment(payment)
        if (!keys) {
          throw new Error("Stealth keys not found. Keys may have been deleted.")
        }

        const { viewingPrivateKey, spendingPrivateKey } = keys

        if (!viewingPrivateKey || !spendingPrivateKey) {
          throw new Error("Invalid stealth keys")
        }

        // Step 2: Derive stealth spending key using real cryptographic operations
        setProgress({
          status: "deriving",
          message: "Deriving stealth private key...",
          step: 2,
          totalSteps: CLAIM_STEPS,
        })

        const derivedKey = await deriveSpendingKeyFromPayment(
          payment,
          spendingPrivateKey,
          viewingPrivateKey
        )

        if (!derivedKey) {
          throw new Error("Failed to derive spending key - invalid stealth address")
        }

        // Parse stealth address to get components
        const stealthAddr = parsePaymentStealthAddress(payment.stealthAddress)
        if (!stealthAddr || !stealthAddr.address) {
          throw new Error("Invalid stealth address format")
        }

        // Get stealth recipient pubkey from the address
        const stealthPubkey = new PublicKey(stealthAddr.address)

        // Step 3: Build claim transaction
        setProgress({
          status: "signing",
          message: "Building claim transaction...",
          step: 3,
          totalSteps: CLAIM_STEPS,
        })

        // Setup connection
        const connection = new Connection(getRpcUrl(network), { commitment: "confirmed" })

        // Find transfer record PDA
        const transferRecordPubkey = await findTransferRecordPubkey(payment, connection)
        if (!transferRecordPubkey) {
          throw new Error("Transfer record not found on-chain")
        }

        // Build the claim transaction
        const recipientPubkey = new PublicKey(walletAddress)
        const { transaction, stealthScalar, stealthPublicKey, nullifier } = await buildClaimTransfer(
          connection,
          {
            transferRecordPubkey,
            stealthAddress: stealthPubkey,
            stealthPrivateKey: derivedKey,
            recipientAddress: recipientPubkey,
          }
        )

        debug("Claim transaction built")
        debug("Nullifier:", bs58.encode(nullifier))
        debug("Stealth pubkey:", bs58.encode(stealthPublicKey))
        debug("Expected stealth pubkey:", stealthPubkey.toBase58())

        // Sign with stealth scalar (custom ed25519 signing with derived scalar)
        const stealthSignedTx = await signClaimWithStealth(
          transaction,
          stealthScalar,
          stealthPublicKey
        )

        // Step 4: Sign with user wallet and submit
        setProgress({
          status: "submitting",
          message: "Requesting wallet signature...",
          step: 4,
          totalSteps: CLAIM_STEPS,
        })

        // Sign with user's wallet (recipient/feePayer)
        const signedTransaction = await signTransaction(stealthSignedTx)

        // Submit the fully signed transaction
        setProgress({
          status: "submitting",
          message: "Submitting to network...",
          step: 4,
          totalSteps: CLAIM_STEPS,
        })

        const signature = await connection.sendRawTransaction(
          (signedTransaction as Transaction).serialize()
        )

        // Wait for confirmation
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
        await connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight,
        })

        debug("Claim transaction submitted:", signature)

        // Update payment status
        // IMPORTANT: Don't overwrite txHash - it's the transfer record PDA used for sync
        updatePayment(payment.id, {
          status: "claimed",
          claimed: true,
          claimedAt: Date.now(),
          claimTxHash: signature,
        })

        setProgress({
          status: "confirmed",
          message: "Claim successful!",
          step: 4,
          totalSteps: CLAIM_STEPS,
        })

        return { success: true, txHash: signature }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Claim failed"
        console.error("Claim error:", err)
        setError(errorMessage)
        setProgress({
          status: "error",
          message: errorMessage,
          step: 0,
          totalSteps: CLAIM_STEPS,
        })
        return { success: false, error: errorMessage }
      }
    },
    [isConnected, walletAddress, network, updatePayment, signTransaction]
  )

  const claimMultiple = useCallback(
    async (paymentsToClaimList: PaymentRecord[]): Promise<ClaimResult[]> => {
      const results: ClaimResult[] = []

      for (const payment of paymentsToClaimList) {
        const result = await claim(payment)
        results.push(result)

        // Small delay between claims
        if (result.success) {
          await new Promise((resolve) => setTimeout(resolve, 200))
        }
      }

      return results
    },
    [claim]
  )

  const reset = useCallback(() => {
    setProgress({
      status: "idle",
      message: "Ready to claim",
      step: 0,
      totalSteps: CLAIM_STEPS,
    })
    setError(null)
  }, [])

  const getUnclaimedPayments = useCallback((): PaymentRecord[] => {
    return payments.filter(
      (p) =>
        p.type === "receive" &&
        p.status === "completed" &&
        !p.claimed
    )
  }, [payments])

  const getClaimableAmount = useCallback((): { amount: number; count: number } => {
    const unclaimed = getUnclaimedPayments()
    const totalAmount = unclaimed.reduce(
      (sum, p) => sum + parseFloat(p.amount),
      0
    )
    return {
      amount: totalAmount,
      count: unclaimed.length,
    }
  }, [getUnclaimedPayments])

  return useMemo(
    () => ({
      progress,
      error,
      claim,
      claimMultiple,
      reset,
      getUnclaimedPayments,
      getClaimableAmount,
    }),
    [progress, error, claim, claimMultiple, reset, getUnclaimedPayments, getClaimableAmount]
  )
}
