/**
 * Background Payment Scanning Service
 *
 * Scans for incoming stealth payments in the background using Expo Task Manager.
 * Sends push notifications when new payments are found.
 *
 * Features:
 * - Periodic background scanning (every 15 minutes when enabled)
 * - Local push notifications for new payments
 * - Battery-efficient (respects system constraints)
 * - Persists scan state across app restarts
 *
 * @see https://docs.expo.dev/versions/latest/sdk/task-manager/
 * @see https://docs.expo.dev/versions/latest/sdk/background-fetch/
 */

import * as TaskManager from "expo-task-manager"
import * as BackgroundFetch from "expo-background-fetch"
import * as Notifications from "expo-notifications"
import * as SecureStore from "expo-secure-store"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { Connection } from "@solana/web3.js"
import { fetchAllTransferRecords, type TransferRecordData } from "@/lib/anchor/client"
import { bytesToHex } from "@/lib/stealth"
import { decryptAmount, deriveSharedSecret } from "@/lib/anchor/crypto"
import { getRpcClient, type RpcConfig } from "@/lib/rpc"
import { getRpcApiKey } from "@/lib/config"
import { ed25519 } from "@noble/curves/ed25519"
import { sha512 } from "@noble/hashes/sha512"
import type { StealthKeysStorage } from "@/types"
import {
  MIN_BACKGROUND_SCAN_INTERVAL_SEC,
  MAX_HASH_HISTORY,
} from "@/constants/security"

// ============================================================================
// CONSTANTS
// ============================================================================

export const BACKGROUND_SCAN_TASK = "BACKGROUND_PAYMENT_SCAN"
const SECURE_STORE_KEY_V2 = "sip_stealth_keys_v2"
const LAST_SCAN_KEY = "background_scan_last_timestamp"
const SCAN_ENABLED_KEY = "background_scan_enabled"
const FOUND_PAYMENTS_KEY = "background_scan_found_payments"
const SETTINGS_STORAGE_KEY = "settings-storage"

/** Minimum interval between background scans */
const MIN_INTERVAL = MIN_BACKGROUND_SCAN_INTERVAL_SEC

// ============================================================================
// NOTIFICATION SETUP
// ============================================================================

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

/**
 * Request notification permissions
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync()

  if (existingStatus === "granted") {
    return true
  }

  const { status } = await Notifications.requestPermissionsAsync()
  return status === "granted"
}

/**
 * Send a local notification for found payments
 */
async function sendPaymentNotification(count: number, totalAmount: number): Promise<void> {
  const amountStr = totalAmount.toFixed(4)

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "New Payment Received!",
      body:
        count === 1
          ? `You received ${amountStr} SOL`
          : `You received ${count} payments (${amountStr} SOL total)`,
      data: { type: "payment_received", count, amount: totalAmount },
      sound: true,
      badge: count,
    },
    trigger: null, // Immediate
  })
}

// ============================================================================
// SETTINGS HELPERS (for background context)
// ============================================================================

interface StoredSettings {
  state: {
    network: "mainnet-beta" | "devnet" | "testnet"
    rpcProvider: "helius" | "quicknode" | "triton" | "publicnode"
    heliusApiKey: string | null
    quicknodeApiKey: string | null
    tritonEndpoint: string | null
  }
}

/**
 * Get RPC config from stored settings (for background context)
 */
async function getRpcConfigFromStorage(): Promise<RpcConfig> {
  try {
    const stored = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!stored) {
      return { provider: "publicnode", cluster: "devnet" }
    }

    const settings: StoredSettings = JSON.parse(stored)
    const { network, rpcProvider, heliusApiKey, quicknodeApiKey, tritonEndpoint } = settings.state

    let apiKey: string | undefined
    let customEndpoint: string | undefined

    switch (rpcProvider) {
      case "helius":
        apiKey = heliusApiKey || getRpcApiKey("helius") || undefined
        break
      case "quicknode":
        apiKey = quicknodeApiKey || undefined
        break
      case "triton":
        customEndpoint = tritonEndpoint || undefined
        break
    }

    return {
      provider: rpcProvider,
      cluster: network,
      apiKey,
      customEndpoint,
    }
  } catch {
    return { provider: "publicnode", cluster: "devnet" }
  }
}

// ============================================================================
// BACKGROUND SCAN LOGIC
// ============================================================================

/**
 * Load stealth keys from secure storage
 */
async function loadStealthKeys(): Promise<StealthKeysStorage | null> {
  try {
    const stored = await SecureStore.getItemAsync(SECURE_STORE_KEY_V2)
    if (!stored) return null
    return JSON.parse(stored) as StealthKeysStorage
  } catch {
    return null
  }
}

/**
 * Get the last scan timestamp
 */
async function getLastScanTimestamp(): Promise<number> {
  try {
    const stored = await AsyncStorage.getItem(LAST_SCAN_KEY)
    return stored ? parseInt(stored, 10) : 0
  } catch {
    return 0
  }
}

/**
 * Save the last scan timestamp
 */
async function saveLastScanTimestamp(timestamp: number): Promise<void> {
  await AsyncStorage.setItem(LAST_SCAN_KEY, timestamp.toString())
}

/**
 * Get existing payment hashes to avoid duplicates
 */
async function getExistingPaymentHashes(): Promise<Set<string>> {
  try {
    const stored = await AsyncStorage.getItem(FOUND_PAYMENTS_KEY)
    if (!stored) return new Set()
    const hashes = JSON.parse(stored) as string[]
    return new Set(hashes)
  } catch {
    return new Set()
  }
}

/**
 * Save found payment hashes
 */
async function saveFoundPaymentHashes(hashes: Set<string>): Promise<void> {
  const arr = Array.from(hashes).slice(-MAX_HASH_HISTORY)
  await AsyncStorage.setItem(FOUND_PAYMENTS_KEY, JSON.stringify(arr))
}

/**
 * Check if a transfer record belongs to the user
 */
function checkRecordOwnership(
  record: TransferRecordData,
  viewingPrivateKey: Uint8Array,
  spendingPublicKey: Uint8Array
): boolean {
  try {
    // Get ephemeral public key from record (stored as 33-byte compressed key)
    const ephemeralPubKey = record.ephemeralPubkey

    // Derive shared secret using viewing private key
    const sharedSecret = deriveSharedSecret(viewingPrivateKey, ephemeralPubKey)

    // Derive stealth private key scalar using SHA-512
    const hashInput = new Uint8Array([...sharedSecret])
    const hash = sha512(hashInput)
    const scalarBytes = hash.slice(0, 32)

    // Clamp scalar for ed25519
    scalarBytes[0] &= 248
    scalarBytes[31] &= 127
    scalarBytes[31] |= 64

    // Get scalar as bigint
    let scalar = BigInt(0)
    for (let i = 0; i < 32; i++) {
      scalar += BigInt(scalarBytes[i]) << BigInt(8 * i)
    }

    // Reduce modulo L
    const L = BigInt("7237005577332262213973186563042994240857116359379907606001950938285454250989")
    scalar = scalar % L

    // Convert spending public key to point and add scalar * G
    const spendingPoint = ed25519.ExtendedPoint.fromHex(spendingPublicKey)
    const scalarPoint = ed25519.ExtendedPoint.BASE.multiply(scalar)
    const stealthPoint = spendingPoint.add(scalarPoint)
    const derivedStealthPubKey = stealthPoint.toRawBytes()

    // Compare with record's stealth address (PublicKey.toBytes())
    const recordStealthBytes = record.stealthRecipient.toBytes()
    return bytesToHex(derivedStealthPubKey) === bytesToHex(recordStealthBytes)
  } catch {
    return false
  }
}

/**
 * Main background scan function
 */
async function performBackgroundScan(): Promise<BackgroundFetch.BackgroundFetchResult> {
  console.log("[BackgroundScan] Starting background scan...")

  try {
    // Load stealth keys
    const keysStorage = await loadStealthKeys()
    if (!keysStorage || keysStorage.records.length === 0) {
      console.log("[BackgroundScan] No stealth keys found, skipping")
      return BackgroundFetch.BackgroundFetchResult.NoData
    }

    // Get RPC config from storage and create connection
    const rpcConfig = await getRpcConfigFromStorage()
    const rpcClient = getRpcClient(rpcConfig)
    const connection = rpcClient.getConnection()

    // Get last scan timestamp
    const lastScan = await getLastScanTimestamp()

    // Fetch transfer records
    const records = await fetchAllTransferRecords(connection)
    if (!records || records.length === 0) {
      console.log("[BackgroundScan] No transfer records found")
      await saveLastScanTimestamp(Date.now())
      return BackgroundFetch.BackgroundFetchResult.NoData
    }

    // Filter records newer than last scan
    const newRecords = records.filter((r) => {
      const recordTime = Number(r.timestamp) * 1000
      return recordTime > lastScan
    })

    if (newRecords.length === 0) {
      console.log("[BackgroundScan] No new records since last scan")
      await saveLastScanTimestamp(Date.now())
      return BackgroundFetch.BackgroundFetchResult.NoData
    }

    console.log(`[BackgroundScan] Scanning ${newRecords.length} new records...`)

    // Get existing payment hashes
    const existingHashes = await getExistingPaymentHashes()

    // Check each record against each key
    let foundCount = 0
    let totalAmount = 0
    const newHashes: string[] = []

    for (const record of newRecords) {
      const recordHash = bytesToHex(record.stealthRecipient.toBytes())

      // Skip if already processed
      if (existingHashes.has(recordHash)) continue

      // Check against each stealth key record
      for (const keyRecord of keysStorage.records) {
        const viewingPrivateKey = Uint8Array.from(
          keyRecord.keys.viewingPrivateKey.match(/.{2}/g)!.map((b: string) => parseInt(b, 16))
        )
        const spendingPublicKey = Uint8Array.from(
          keyRecord.keys.spendingPublicKey.match(/.{2}/g)!.map((b: string) => parseInt(b, 16))
        )

        const isOwned = checkRecordOwnership(record, viewingPrivateKey, spendingPublicKey)

        if (isOwned) {
          // Decrypt amount
          let amount = 0
          try {
            // Derive shared secret for decryption
            const sharedSecret = deriveSharedSecret(viewingPrivateKey, record.ephemeralPubkey)
            const decrypted = decryptAmount(record.encryptedAmount, sharedSecret)
            amount = Number(decrypted) / 1e9 // Convert lamports to SOL
          } catch {
            // Decryption failed, use a placeholder
            console.warn("[BackgroundScan] Failed to decrypt amount")
            amount = 0
          }

          foundCount++
          totalAmount += amount
          newHashes.push(recordHash)

          console.log(`[BackgroundScan] Found payment: ${amount.toFixed(4)} SOL`)
          break // Found owner, no need to check other keys
        }
      }
    }

    // Save found hashes
    if (newHashes.length > 0) {
      newHashes.forEach((h) => existingHashes.add(h))
      await saveFoundPaymentHashes(existingHashes)
    }

    // Update last scan timestamp
    await saveLastScanTimestamp(Date.now())

    // Send notification if payments found
    if (foundCount > 0) {
      console.log(`[BackgroundScan] Found ${foundCount} payments, sending notification`)
      await sendPaymentNotification(foundCount, totalAmount)
      return BackgroundFetch.BackgroundFetchResult.NewData
    }

    console.log("[BackgroundScan] Scan complete, no new payments")
    return BackgroundFetch.BackgroundFetchResult.NoData
  } catch (error) {
    console.error("[BackgroundScan] Error:", error)
    return BackgroundFetch.BackgroundFetchResult.Failed
  }
}

// ============================================================================
// TASK REGISTRATION
// ============================================================================

/**
 * Define the background task
 */
TaskManager.defineTask(BACKGROUND_SCAN_TASK, async () => {
  return await performBackgroundScan()
})

/**
 * Register background fetch task
 */
export async function registerBackgroundScan(): Promise<boolean> {
  try {
    // Check if already registered
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SCAN_TASK)
    if (isRegistered) {
      console.log("[BackgroundScan] Task already registered")
      return true
    }

    // Register background fetch
    await BackgroundFetch.registerTaskAsync(BACKGROUND_SCAN_TASK, {
      minimumInterval: MIN_INTERVAL,
      stopOnTerminate: false,
      startOnBoot: true,
    })

    console.log("[BackgroundScan] Task registered successfully")
    return true
  } catch (error) {
    console.error("[BackgroundScan] Failed to register task:", error)
    return false
  }
}

/**
 * Unregister background fetch task
 */
export async function unregisterBackgroundScan(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SCAN_TASK)
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_SCAN_TASK)
      console.log("[BackgroundScan] Task unregistered")
    }
  } catch (error) {
    console.error("[BackgroundScan] Failed to unregister task:", error)
  }
}

/**
 * Check if background scan is enabled
 */
export async function isBackgroundScanEnabled(): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(SCAN_ENABLED_KEY)
    return stored === "true"
  } catch {
    return false
  }
}

/**
 * Enable or disable background scanning
 */
export async function setBackgroundScanEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(SCAN_ENABLED_KEY, enabled ? "true" : "false")

  if (enabled) {
    await registerBackgroundScan()
  } else {
    await unregisterBackgroundScan()
  }
}

/**
 * Get background fetch status
 */
export async function getBackgroundFetchStatus(): Promise<BackgroundFetch.BackgroundFetchStatus | null> {
  try {
    return await BackgroundFetch.getStatusAsync()
  } catch {
    return null
  }
}

/**
 * Trigger an immediate background scan (for testing)
 */
export async function triggerBackgroundScan(): Promise<void> {
  console.log("[BackgroundScan] Triggering immediate scan...")
  await performBackgroundScan()
}
