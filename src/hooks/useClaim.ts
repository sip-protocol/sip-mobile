/**
 * Payment Claiming Hook
 *
 * Handles the claiming of stealth payments:
 * 1. Derive spending key from stealth address + viewing key
 * 2. Sign claim transaction
 * 3. Submit to network
 * 4. Update payment status
 */

import { useState, useCallback, useMemo } from "react"
import * as SecureStore from "expo-secure-store"
import { usePrivacyStore } from "@/stores/privacy"
import { useWalletStore } from "@/stores/wallet"
import type { PaymentRecord } from "@/types"

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

const SECURE_STORE_KEY = "sip_stealth_keys"
const CLAIM_STEPS = 4

// ============================================================================
// HELPERS
// ============================================================================

function generateRandomHex(length: number): string {
  const array = new Uint8Array(length)
  for (let i = 0; i < length; i++) {
    array[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/**
 * Mock derive spending key from stealth address
 * In production: ECDH(viewingPrivKey, ephemeralPubKey) + spendingPrivKey
 */
async function deriveSpendingKey(
  _stealthAddress: string,
  _viewingPrivateKey: string,
  _spendingPrivateKey: string
): Promise<string> {
  // Simulate derivation delay
  await new Promise((resolve) => setTimeout(resolve, 300))
  return generateRandomHex(32)
}

/**
 * Mock sign claim transaction
 * In production: Sign with derived spending key
 */
async function signClaimTransaction(
  _payment: PaymentRecord,
  _derivedKey: string
): Promise<Uint8Array> {
  // Simulate signing delay
  await new Promise((resolve) => setTimeout(resolve, 300))
  return new Uint8Array(64).fill(1)
}

/**
 * Mock submit claim transaction
 * In production: Submit to Solana network
 */
async function submitClaimTransaction(
  _signature: Uint8Array
): Promise<string> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 800))
  return generateRandomHex(64)
}

// ============================================================================
// HOOK
// ============================================================================

export function useClaim(): UseClaimReturn {
  const { isConnected, address: walletAddress } = useWalletStore()
  const { payments, updatePayment } = usePrivacyStore()

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
        // Step 1: Load keys
        setProgress({
          status: "deriving",
          message: "Loading stealth keys...",
          step: 1,
          totalSteps: CLAIM_STEPS,
        })

        const storedKeys = await SecureStore.getItemAsync(SECURE_STORE_KEY)
        if (!storedKeys) {
          throw new Error("Stealth keys not found")
        }

        const keys = JSON.parse(storedKeys)
        const { viewingPrivateKey, spendingPrivateKey } = keys

        if (!viewingPrivateKey || !spendingPrivateKey) {
          throw new Error("Invalid stealth keys")
        }

        // Step 2: Derive spending key
        setProgress({
          status: "deriving",
          message: "Deriving spending key...",
          step: 2,
          totalSteps: CLAIM_STEPS,
        })

        const derivedKey = await deriveSpendingKey(
          payment.stealthAddress || "",
          viewingPrivateKey,
          spendingPrivateKey
        )

        // Step 3: Sign transaction
        setProgress({
          status: "signing",
          message: "Signing claim transaction...",
          step: 3,
          totalSteps: CLAIM_STEPS,
        })

        const signature = await signClaimTransaction(payment, derivedKey)

        // Step 4: Submit transaction
        setProgress({
          status: "submitting",
          message: "Submitting to network...",
          step: 4,
          totalSteps: CLAIM_STEPS,
        })

        const txHash = await submitClaimTransaction(signature)

        // Update payment status
        updatePayment(payment.id, {
          status: "claimed",
          claimed: true,
          claimedAt: Date.now(),
          txHash: txHash,
        })

        setProgress({
          status: "confirmed",
          message: "Claim successful!",
          step: 4,
          totalSteps: CLAIM_STEPS,
        })

        return { success: true, txHash }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Claim failed"
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
    [isConnected, walletAddress, updatePayment]
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
