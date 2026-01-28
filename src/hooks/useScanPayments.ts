/**
 * Payment Scanning Hook
 *
 * Scans the blockchain for incoming stealth payments using viewing keys.
 * Implements EIP-5564 style scanning with Ed25519/secp256k1 support.
 *
 * Scanning process:
 * 1. Fetch transfer records from the SIP program
 * 2. For each record, compute shared secret with spending private key
 * 3. Derive expected stealth address
 * 4. Check if derived address matches the record's stealth recipient
 * 5. If match, user owns this payment - decrypt amount and add to store
 */

import { useState, useCallback, useRef, useMemo } from "react"
import * as SecureStore from "expo-secure-store"
import { Connection, LAMPORTS_PER_SOL } from "@solana/web3.js"
import { usePrivacyStore } from "@/stores/privacy"
import { useWalletStore } from "@/stores/wallet"
import { useSettingsStore } from "@/stores/settings"
import type { PaymentRecord, StealthKeysStorage } from "@/types"
import {
  checkStealthAddress,
  bytesToHex,
  type StealthAddress,
} from "@/lib/stealth"
import {
  fetchAllTransferRecords,
  type TransferRecordData,
} from "@/lib/anchor/client"
import { decryptAmount, deriveSharedSecret } from "@/lib/anchor/crypto"
import { ed25519 } from "@noble/curves/ed25519"
import { sha256 } from "@noble/hashes/sha256"
import { sha512 } from "@noble/hashes/sha512"

// ============================================================================
// TYPES
// ============================================================================

export interface ScanResult {
  found: number
  scanned: number
  newPayments: PaymentRecord[]
  errors: string[]
}

export interface ScanProgress {
  stage: "idle" | "fetching" | "scanning" | "processing" | "complete" | "error"
  current: number
  total: number
  message: string
}

export interface ScanOptions {
  fromTimestamp?: number
  limit?: number
  includeCompleted?: boolean
}

export interface UseScanPaymentsReturn {
  // State
  isScanning: boolean
  progress: ScanProgress
  lastScanResult: ScanResult | null
  error: string | null

  // Actions
  scan: (options?: ScanOptions) => Promise<ScanResult>
  cancelScan: () => void
  getLastScanTime: () => number | null
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SECURE_STORE_KEY_V2 = "sip_stealth_keys_v2"
const LEGACY_STORE_KEY = "sip_stealth_keys"
const BATCH_SIZE = 50
const SCAN_DELAY_MS = 100 // Delay between batches for UI responsiveness

/**
 * Load keys from storage (handles both v2 archival and legacy formats)
 * Returns keys and activeKeyId (null for legacy format)
 */
async function loadKeysFromStorage(): Promise<{
  viewingPrivateKey: string
  spendingPrivateKey: string
  viewingPublicKey: string
  spendingPublicKey: string
  activeKeyId: string | null
} | null> {
  // Try v2 archival format first
  const storageV2 = await SecureStore.getItemAsync(SECURE_STORE_KEY_V2)
  if (storageV2) {
    const storage = JSON.parse(storageV2) as StealthKeysStorage
    if (storage.activeKeyId) {
      const activeRecord = storage.records.find((r) => r.id === storage.activeKeyId)
      if (activeRecord) {
        return {
          ...activeRecord.keys,
          activeKeyId: activeRecord.id,
        }
      }
    }
  }

  // Fall back to legacy format
  const legacy = await SecureStore.getItemAsync(LEGACY_STORE_KEY)
  if (legacy) {
    const keys = JSON.parse(legacy)
    return {
      ...keys,
      activeKeyId: null, // Legacy payments won't have keyId
    }
  }

  return null
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Check if a transfer record belongs to the user using cryptographic verification
 *
 * Uses the stealth library's checkStealthAddress which performs:
 * 1. ECDH with spending private key and ephemeral public key
 * 2. Hash the shared secret
 * 3. Quick view tag check
 * 4. Full derivation and comparison if view tag matches
 */
function checkRecordOwnership(
  record: TransferRecordData,
  spendingPrivateKey: string,
  viewingPrivateKey: string
): boolean {
  try {
    // Extract ephemeral pubkey (skip 1-byte prefix for ed25519 format)
    const ephemeralBytes = new Uint8Array(record.ephemeralPubkey.slice(1))
    const ephemeralHex = `0x${bytesToHex(ephemeralBytes)}`

    // Get stealth recipient address
    const stealthBytes = record.stealthRecipient.toBytes()
    const stealthHex = `0x${bytesToHex(stealthBytes)}`

    console.log("=== Checking ownership for record ===")
    console.log("Stealth recipient:", record.stealthRecipient.toBase58())
    console.log("Ephemeral pubkey:", ephemeralHex.slice(0, 24) + "...")

    // Derive spending scalar from private key
    // IMPORTANT: ed25519 uses SHA512, not SHA256! (RFC 8032)
    const spendingPrivBytes = hexToBytes(spendingPrivateKey)
    const spendHash = sha512(spendingPrivBytes)
    const scalar = new Uint8Array(32)
    scalar.set(spendHash.slice(0, 32))
    // Clamp as per ed25519 spec
    scalar[0] &= 248
    scalar[31] &= 127
    scalar[31] |= 64

    // Convert to BigInt (little-endian)
    let scalarBigInt = 0n
    for (let i = 31; i >= 0; i--) {
      scalarBigInt = (scalarBigInt << 8n) | BigInt(scalar[i])
    }
    const ED25519_ORDER = BigInt("0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed")
    scalarBigInt = scalarBigInt % ED25519_ORDER

    // Compute shared secret: S = spending_scalar * ephemeral_pubkey
    const ephemeralPoint = ed25519.ExtendedPoint.fromHex(ephemeralBytes)
    const sharedSecretPoint = ephemeralPoint.multiply(scalarBigInt)
    const sharedSecretHash = sha256(sharedSecretPoint.toRawBytes())

    // View tag is first byte of shared secret hash
    const viewTag = sharedSecretHash[0]
    console.log("Computed view tag:", viewTag)

    const stealthAddr: StealthAddress = {
      address: stealthHex,
      ephemeralPublicKey: ephemeralHex,
      viewTag,
    }

    const isOwner = checkStealthAddress(stealthAddr, spendingPrivateKey, viewingPrivateKey)
    console.log("Ownership result:", isOwner)
    console.log("=== End ownership check ===")

    return isOwner
  } catch (err) {
    console.error("!!! Failed to check record ownership:", err)
    return false
  }
}

/**
 * Derive shared secret from ephemeral pubkey and spending private key
 * Then decrypt the amount
 */
function decryptRecordAmount(
  record: TransferRecordData,
  spendingPrivateKey: string
): bigint | null {
  try {
    // Import crypto utilities
    const { deriveSharedSecret } = require("@/lib/anchor/crypto")

    // Get spending private key bytes
    const spendingBytes = hexToBytes(spendingPrivateKey)

    // Ephemeral pubkey (skip 1-byte prefix)
    const ephemeralBytes = record.ephemeralPubkey.slice(1)

    // Derive shared secret
    const sharedSecret = deriveSharedSecret(spendingBytes, ephemeralBytes)

    // Decrypt amount
    return decryptAmount(record.encryptedAmount, sharedSecret)
  } catch (err) {
    // Use warn instead of error to avoid red toast in dev mode
    // Fallback to RPC balance fetch will handle this gracefully
    console.warn("[SCAN] Amount decryption failed (will fetch balance):", err)
    return null
  }
}

// Import hexToBytes from stealth
function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex
  const bytes = new Uint8Array(cleanHex.length / 2)
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.slice(i, i + 2), 16)
  }
  return bytes
}

// ============================================================================
// HOOK
// ============================================================================

export function useScanPayments(): UseScanPaymentsReturn {
  const { isConnected } = useWalletStore()
  const { network } = useSettingsStore()
  const {
    payments,
    addPayment,
    updatePayment,
    setScanning,
    setLastScanTimestamp,
    lastScanTimestamp,
  } = usePrivacyStore()

  const [isScanning, setIsScanning] = useState(false)
  const [progress, setProgress] = useState<ScanProgress>({
    stage: "idle",
    current: 0,
    total: 0,
    message: "Ready to scan",
  })
  const [lastScanResult, setLastScanResult] = useState<ScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cancelRef = useRef(false)

  const scan = useCallback(
    async (options: ScanOptions = {}): Promise<ScanResult> => {
      if (!isConnected) {
        const result: ScanResult = {
          found: 0,
          scanned: 0,
          newPayments: [],
          errors: ["Wallet not connected"],
        }
        setLastScanResult(result)
        return result
      }

      // Reset state
      setIsScanning(true)
      setScanning(true)
      setError(null)
      cancelRef.current = false

      const result: ScanResult = {
        found: 0,
        scanned: 0,
        newPayments: [],
        errors: [],
      }

      try {
        // Stage 1: Fetch viewing keys
        setProgress({
          stage: "fetching",
          current: 0,
          total: 0,
          message: "Loading stealth keys...",
        })

        const keysData = await loadKeysFromStorage()
        if (!keysData) {
          throw new Error("No stealth keys found. Generate an address first.")
        }

        const { viewingPrivateKey, spendingPrivateKey, viewingPublicKey, spendingPublicKey, activeKeyId } = keysData

        if (!viewingPrivateKey || !spendingPrivateKey) {
          throw new Error("Stealth keys not found")
        }

        // Debug: verify stored keys match derived public keys
        console.log("=== Stored keys debug ===")
        console.log("Spending pub (stored):", spendingPublicKey?.slice(0, 24) + "...")
        console.log("Viewing pub (stored):", viewingPublicKey?.slice(0, 24) + "...")

        // Derive public keys from private keys to verify consistency
        const spendPrivBytes = hexToBytes(spendingPrivateKey)
        const viewPrivBytes = hexToBytes(viewingPrivateKey)
        const derivedSpendPub = ed25519.getPublicKey(spendPrivBytes)
        const derivedViewPub = ed25519.getPublicKey(viewPrivBytes)
        console.log("Spending pub (derived):", "0x" + bytesToHex(derivedSpendPub).slice(0, 20) + "...")
        console.log("Viewing pub (derived):", "0x" + bytesToHex(derivedViewPub).slice(0, 20) + "...")
        console.log("=== End keys debug ===")

        // Check for cancellation
        if (cancelRef.current) {
          throw new Error("Scan cancelled")
        }

        // Stage 2: Fetch transfer records from blockchain
        setProgress({
          stage: "fetching",
          current: 0,
          total: 0,
          message: "Fetching on-chain transfer records...",
        })

        // Setup connection
        const connection = new Connection(
          network === "mainnet-beta"
            ? "https://api.mainnet-beta.solana.com"
            : "https://api.devnet.solana.com",
          { commitment: "confirmed" }
        )

        // Fetch all transfer records from the SIP program
        const records = await fetchAllTransferRecords(connection)
        console.log(`Fetched ${records.length} transfer records from chain`)

        // Filter by timestamp if provided
        const filteredRecords = options.fromTimestamp
          ? records.filter(
              (r) => Number(r.timestamp) * 1000 > options.fromTimestamp!
            )
          : records

        // Apply limit
        const limit = options.limit || 100
        const limitedRecords = filteredRecords.slice(0, limit)

        const total = limitedRecords.length

        if (total === 0) {
          setProgress({
            stage: "complete",
            current: 0,
            total: 0,
            message: "No transfer records found on-chain",
          })
          setLastScanResult(result)
          return result
        }

        // Stage 3: Scan records for ownership
        setProgress({
          stage: "scanning",
          current: 0,
          total,
          message: `Scanning ${total} transfer records...`,
        })

        // Get existing payment IDs to avoid duplicates
        // Use txHash (transfer record PDA) as the unique identifier
        const existingRecordPDAs = new Set(
          payments
            .filter((p) => p.txHash && !p.txHash.startsWith("mock_"))
            .map((p) => p.txHash)
        )

        // Process in batches
        for (let i = 0; i < total; i += BATCH_SIZE) {
          // Check for cancellation
          if (cancelRef.current) {
            throw new Error("Scan cancelled")
          }

          const batch = limitedRecords.slice(i, i + BATCH_SIZE)

          for (const record of batch) {
            result.scanned++
            const recordId = record.pubkey.toBase58()
            console.warn(`[SCAN] Processing record ${result.scanned}: ${recordId}`)

            // If claimed on-chain, sync local status and skip
            if (record.claimed) {
              console.warn("[SCAN] Record claimed on-chain")
              // Find local payment and mark as claimed if exists
              const localPayment = payments.find((p) => p.txHash === recordId)
              if (localPayment && !localPayment.claimed) {
                console.warn("[SCAN] Syncing claimed status to local store")
                updatePayment(localPayment.id, {
                  status: "claimed",
                  claimed: true,
                  claimedAt: Date.now(),
                })
              }
              continue
            }

            // Check if we already have this payment (by transfer record PDA)
            if (existingRecordPDAs.has(recordId)) {
              console.warn("[SCAN] Skipping - already in store")
              continue
            }

            console.warn("[SCAN] Checking ownership...")
            // Check ownership using stealth keys
            const isOurs = checkRecordOwnership(
              record,
              spendingPrivateKey,
              viewingPrivateKey
            )
            console.warn(`[SCAN] Ownership result: ${isOurs}`)

            if (isOurs) {
              result.found++

              // Try to decrypt the amount
              let amountSol = "0"
              const decryptedAmount = decryptRecordAmount(
                record,
                spendingPrivateKey
              )
              if (decryptedAmount !== null) {
                amountSol = (Number(decryptedAmount) / LAMPORTS_PER_SOL).toFixed(
                  4
                )
              } else {
                // Fallback: fetch stealth address balance directly
                console.warn("[SCAN] Decryption failed, fetching balance from RPC...")
                try {
                  const balance = await connection.getBalance(record.stealthRecipient)
                  if (balance > 0) {
                    amountSol = (balance / LAMPORTS_PER_SOL).toFixed(4)
                    console.warn(`[SCAN] Fetched balance: ${amountSol} SOL`)
                  }
                } catch (balanceErr) {
                  console.error("[SCAN] Failed to fetch balance:", balanceErr)
                }
              }

              // Build stealth address in claim-compatible format
              // Format: sip:solana:<ephemeralPubKeyHex>:<stealthRecipientBase58>
              // Skip first byte of ephemeralPubkey (0x02 prefix)
              const ephemeralBytes = record.ephemeralPubkey.slice(1)
              const ephemeralHex = `0x${bytesToHex(ephemeralBytes)}`
              const stealthRecipientBase58 = record.stealthRecipient.toBase58()
              const claimableStealthAddress = `sip:solana:${ephemeralHex}:${stealthRecipientBase58}`

              // Create payment record with keyId for archival claim support (#72)
              const payment: PaymentRecord = {
                id: `payment_${Date.now()}_${result.found}`,
                type: "receive",
                amount: amountSol,
                token: record.tokenMint ? "SPL" : "SOL",
                status: "completed",
                stealthAddress: claimableStealthAddress,
                txHash: record.pubkey.toBase58(), // Use PDA as reference
                timestamp: Number(record.timestamp) * 1000, // Convert to ms
                privacyLevel: "shielded",
                claimed: false,
                keyId: activeKeyId ?? undefined, // Link to active key set for claiming
              }

              result.newPayments.push(payment)
              addPayment(payment)
              console.log(`Found payment: ${amountSol} SOL to ${record.stealthRecipient.toBase58()}`)
            }
          }

          // Update progress
          setProgress({
            stage: "scanning",
            current: Math.min(i + BATCH_SIZE, total),
            total,
            message: `Scanned ${Math.min(i + BATCH_SIZE, total)}/${total} records, found ${result.found}`,
          })

          // Small delay for UI responsiveness
          await new Promise((resolve) => setTimeout(resolve, SCAN_DELAY_MS))
        }

        // Stage 4: Complete
        setProgress({
          stage: "complete",
          current: total,
          total,
          message: `Found ${result.found} payment${result.found !== 1 ? "s" : ""} in ${total} records`,
        })

        setLastScanTimestamp(Date.now())
        setLastScanResult(result)

        return result
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Scan failed"

        if (errorMessage !== "Scan cancelled") {
          result.errors.push(errorMessage)
          setError(errorMessage)
          setProgress({
            stage: "error",
            current: 0,
            total: 0,
            message: errorMessage,
          })
        } else {
          setProgress({
            stage: "idle",
            current: 0,
            total: 0,
            message: "Scan cancelled",
          })
        }

        setLastScanResult(result)
        return result
      } finally {
        setIsScanning(false)
        setScanning(false)
      }
    },
    [isConnected, network, payments, addPayment, updatePayment, setScanning, setLastScanTimestamp]
  )

  const cancelScan = useCallback(() => {
    cancelRef.current = true
  }, [])

  const getLastScanTime = useCallback((): number | null => {
    return lastScanTimestamp
  }, [lastScanTimestamp])

  return useMemo(
    () => ({
      isScanning,
      progress,
      lastScanResult,
      error,
      scan,
      cancelScan,
      getLastScanTime,
    }),
    [isScanning, progress, lastScanResult, error, scan, cancelScan, getLastScanTime]
  )
}
