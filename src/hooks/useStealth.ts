/**
 * Stealth Address Hook
 *
 * Manages stealth address generation and scanning for SIP privacy.
 * Uses DKSAP (Dual-Key Stealth Address Protocol) with ed25519 curve.
 *
 * Based on EIP-5564 style stealth addresses adapted for Solana.
 *
 * IMPORTANT: Keys are NEVER deleted - only archived when regenerated.
 * This prevents fund loss from orphaned payments. (#72)
 */

import { useState, useCallback, useEffect, useMemo } from "react"
import * as SecureStore from "expo-secure-store"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useWalletStore } from "@/stores/wallet"
import {
  generateStealthKeys,
  formatStealthMetaAddress,
  ed25519PublicKeyToSolanaAddress,
  type StealthMetaAddress,
} from "@/lib/stealth"
import type {
  StealthKeys,
  StealthKeysRecord,
  StealthKeysStorage,
} from "@/types"
import { debug } from "@/utils/logger"

// ============================================================================
// TYPES
// ============================================================================

export type { StealthKeys } from "@/types"

export interface StealthAddress {
  full: string
  encoded: string
  chain: string
  spendingKey: string
  viewingKey: string
  solanaAddress: string // Base58 Solana address derived from stealth
}

export interface UseStealthReturn {
  // State
  stealthAddress: StealthAddress | null
  activeKeyId: string | null
  isGenerating: boolean
  isLoading: boolean
  error: string | null

  // Actions
  generateNewAddress: () => Promise<StealthAddress | null>
  regenerateAddress: () => Promise<StealthAddress | null>
  getKeys: () => Promise<StealthKeys | null>
  getActiveKeyId: () => string | null
  formatForDisplay: (address: StealthAddress) => string
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SECURE_STORE_KEY_V2 = "sip_stealth_keys_v2" // Previous shared key
const LEGACY_STORE_KEY = "sip_stealth_keys" // For v1 migration
const SIP_CHAIN = "solana"
const NEEDS_BACKUP_KEY = "sip_stealth_needs_backup"

/**
 * Generate wallet-scoped storage key
 */
function getStoreKey(walletAddress: string): string {
  return `sip_stealth_keys_v3_${walletAddress}`
}

// ============================================================================
// STORAGE HELPERS
// ============================================================================

/**
 * Load stealth keys storage from SecureStore
 */
async function loadStorage(walletAddress: string): Promise<StealthKeysStorage | null> {
  try {
    const stored = await SecureStore.getItemAsync(getStoreKey(walletAddress))
    if (!stored) return null
    return JSON.parse(stored) as StealthKeysStorage
  } catch (err) {
    console.error("Failed to load stealth keys storage:", err)
    return null
  }
}

/**
 * Save stealth keys storage to SecureStore
 */
async function saveStorage(walletAddress: string, storage: StealthKeysStorage): Promise<void> {
  await SecureStore.setItemAsync(getStoreKey(walletAddress), JSON.stringify(storage))
}

/**
 * Migrate legacy keys to new archival format
 * Returns migrated storage or null if no legacy keys
 */
async function migrateLegacyKeys(): Promise<StealthKeysStorage | null> {
  try {
    const legacyData = await SecureStore.getItemAsync(LEGACY_STORE_KEY)
    if (!legacyData) return null

    debug("Migrating legacy stealth keys to archival format...")

    const legacyKeys = JSON.parse(legacyData) as StealthKeys
    const keyId = `keys_${Date.now()}`

    const storage: StealthKeysStorage = {
      version: 1,
      activeKeyId: keyId,
      records: [
        {
          id: keyId,
          keys: legacyKeys,
          createdAt: Date.now(),
          archivedAt: null,
          isActive: true,
        },
      ],
    }

    // Clean up legacy key
    await SecureStore.deleteItemAsync(LEGACY_STORE_KEY)

    debug("Legacy keys migrated successfully")
    return storage
  } catch (err) {
    console.error("Failed to migrate legacy keys:", err)
    return null
  }
}

/**
 * Migrate v2 shared storage to v3 wallet-scoped storage
 */
async function migrateV2ToV3(walletAddress: string): Promise<StealthKeysStorage | null> {
  try {
    const v2Data = await SecureStore.getItemAsync(SECURE_STORE_KEY_V2)
    if (!v2Data) return null

    debug("Migrating v2 shared keys to wallet-scoped v3...")

    const v2Storage = JSON.parse(v2Data) as StealthKeysStorage

    // Save under wallet-scoped key
    await saveStorage(walletAddress, v2Storage)

    // Set backup flag
    await AsyncStorage.setItem(NEEDS_BACKUP_KEY, "true")

    // Delete old shared key
    await SecureStore.deleteItemAsync(SECURE_STORE_KEY_V2)

    debug(`v2 → v3 migration complete for wallet ${walletAddress.slice(0, 8)}...`)
    return v2Storage
  } catch (err) {
    console.error("Failed to migrate v2 to v3:", err)
    return null
  }
}

/**
 * Get a specific key record by ID
 * Exported for use by useClaim hook
 */
export async function getKeyById(
  keyId: string,
  walletAddress?: string
): Promise<StealthKeysRecord | null> {
  const targetAddress = walletAddress || useWalletStore.getState().address
  if (!targetAddress) return null

  const storage = await loadStorage(targetAddress)
  if (!storage) return null
  return storage.records.find((r) => r.id === keyId) ?? null
}

/**
 * Check if stealth backup is needed (post-migration)
 */
export async function needsStealthBackup(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(NEEDS_BACKUP_KEY)
    return value === "true"
  } catch {
    return false
  }
}

/**
 * Clear the stealth backup needed flag
 */
export async function clearStealthBackupFlag(): Promise<void> {
  await AsyncStorage.removeItem(NEEDS_BACKUP_KEY)
}

/**
 * Export current wallet's stealth storage as JSON (for backup encryption)
 */
export async function exportStealthStorage(walletAddress: string): Promise<string | null> {
  const storage = await loadStorage(walletAddress)
  if (!storage) return null
  return JSON.stringify(storage)
}

/**
 * Import stealth storage from decrypted JSON (for backup restore)
 */
export async function importStealthStorage(
  walletAddress: string,
  storageJson: string
): Promise<boolean> {
  try {
    const storage = JSON.parse(storageJson) as StealthKeysStorage
    if (!storage.version || !Array.isArray(storage.records)) {
      return false
    }
    await saveStorage(walletAddress, storage)
    return true
  } catch {
    return false
  }
}

// ============================================================================
// ADDRESS HELPERS
// ============================================================================

/**
 * Format stealth address from keys
 * Format: sip:<chain>:<spendingKey>:<viewingKey>
 */
function formatStealthAddress(
  chain: string,
  spendingPublicKey: string,
  viewingPublicKey: string
): StealthAddress {
  const metaAddress: StealthMetaAddress = {
    chain,
    spendingKey: spendingPublicKey,
    viewingKey: viewingPublicKey,
  }

  const full = formatStealthMetaAddress(metaAddress)
  const solanaAddress = ed25519PublicKeyToSolanaAddress(viewingPublicKey)

  return {
    full,
    encoded: full,
    chain,
    spendingKey: spendingPublicKey,
    viewingKey: viewingPublicKey,
    solanaAddress,
  }
}

// ============================================================================
// HOOK
// ============================================================================

export function useStealth(): UseStealthReturn {
  const { isConnected, address } = useWalletStore()

  const [stealthAddress, setStealthAddress] = useState<StealthAddress | null>(null)
  const [activeKeyId, setActiveKeyId] = useState<string | null>(null)
  const [keys, setKeys] = useState<StealthKeys | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load or generate keys on mount
  useEffect(() => {
    if (isConnected && address) {
      loadOrGenerateKeys(address)
    } else {
      setStealthAddress(null)
      setKeys(null)
      setActiveKeyId(null)
      setIsLoading(false)
    }
  }, [isConnected, address])

  const loadOrGenerateKeys = useCallback(async (walletAddress: string) => {
    setIsLoading(true)
    setError(null)

    try {
      // Try to load wallet-scoped v3 storage
      let storage = await loadStorage(walletAddress)

      // Migrate v2 shared keys to v3 wallet-scoped
      if (!storage) {
        storage = await migrateV2ToV3(walletAddress)
      }

      // Migrate v1 legacy keys to v3 wallet-scoped
      if (!storage) {
        const legacyStorage = await migrateLegacyKeys()
        if (legacyStorage) {
          await saveStorage(walletAddress, legacyStorage)
          await AsyncStorage.setItem(NEEDS_BACKUP_KEY, "true")
          storage = legacyStorage
        }
      }

      if (storage && storage.activeKeyId) {
        const activeRecord = storage.records.find(
          (r) => r.id === storage!.activeKeyId
        )

        if (activeRecord) {
          setKeys(activeRecord.keys)
          setActiveKeyId(activeRecord.id)

          // Generate address from stored keys
          const addr = formatStealthAddress(
            SIP_CHAIN,
            activeRecord.keys.spendingPublicKey,
            activeRecord.keys.viewingPublicKey
          )
          setStealthAddress(addr)
          return
        }
      }

      // No keys found, generate new ones
      await generateNewAddressInternal(walletAddress)
    } catch (err) {
      console.error("Failed to load stealth keys:", err)
      setError("Failed to load stealth keys")
    } finally {
      setIsLoading(false)
    }
  }, [])

  const generateNewAddressInternal = useCallback(async (walletAddr?: string): Promise<StealthAddress | null> => {
    const targetAddress = walletAddr || address
    if (!targetAddress) {
      setError("No wallet address available")
      return null
    }

    setIsGenerating(true)
    setError(null)

    try {
      // Generate new stealth keys using real cryptography
      const newKeys = await generateStealthKeys()
      const keyId = `keys_${Date.now()}`

      // Create new key record
      const newRecord: StealthKeysRecord = {
        id: keyId,
        keys: newKeys,
        createdAt: Date.now(),
        archivedAt: null,
        isActive: true,
      }

      // Load or create storage
      let storage = await loadStorage(targetAddress)

      if (storage) {
        // Archive all currently active keys
        storage.records = storage.records.map((r) => ({
          ...r,
          isActive: false,
          archivedAt: r.isActive ? Date.now() : r.archivedAt,
        }))
        storage.records.push(newRecord)
        storage.activeKeyId = keyId
      } else {
        // Create new storage
        storage = {
          version: 1,
          activeKeyId: keyId,
          records: [newRecord],
        }
      }

      // Save to SecureStore
      await saveStorage(targetAddress, storage)

      setKeys(newKeys)
      setActiveKeyId(keyId)

      // Create stealth address
      const addr = formatStealthAddress(
        SIP_CHAIN,
        newKeys.spendingPublicKey,
        newKeys.viewingPublicKey
      )

      setStealthAddress(addr)
      return addr
    } catch (err) {
      console.error("Failed to generate stealth address:", err)
      setError("Failed to generate stealth address")
      return null
    } finally {
      setIsGenerating(false)
    }
  }, [address])

  const generateNewAddress = useCallback(async (): Promise<StealthAddress | null> => {
    if (!isConnected || !address) {
      setError("Wallet not connected")
      return null
    }
    return generateNewAddressInternal(address)
  }, [isConnected, address, generateNewAddressInternal])

  /**
   * Regenerate stealth address by archiving current and creating new
   *
   * IMPORTANT: This archives the current key instead of deleting it.
   * Old payments remain claimable via getKeyById(). (#72)
   *
   * The caller should check for unclaimed payments BEFORE calling this.
   */
  const regenerateAddress = useCallback(async (): Promise<StealthAddress | null> => {
    // Note: Unclaimed payment check is done by the caller (receive.tsx)
    // This allows for user confirmation flow
    return generateNewAddress()
  }, [generateNewAddress])

  const getKeys = useCallback(async (): Promise<StealthKeys | null> => {
    if (keys) return keys

    if (!address) return null
    const storage = await loadStorage(address)
    if (!storage || !storage.activeKeyId) return null
    const activeRecord = storage.records.find((r) => r.id === storage.activeKeyId)
    return activeRecord?.keys ?? null
  }, [keys, address])

  const getActiveKeyIdCallback = useCallback((): string | null => {
    return activeKeyId
  }, [activeKeyId])

  const formatForDisplay = useCallback((addr: StealthAddress): string => {
    // Use the full address which is already properly formatted (base58 for Solana)
    // Truncate the keys portion for display
    const parts = addr.full.split(":")
    if (parts.length === 4) {
      const [prefix, chain, spending, viewing] = parts
      const spendingShort = `${spending.slice(0, 8)}...${spending.slice(-6)}`
      const viewingShort = `${viewing.slice(0, 8)}...${viewing.slice(-6)}`
      return `${prefix}:${chain}:${spendingShort}:${viewingShort}`
    }
    return addr.full
  }, [])

  return useMemo(
    () => ({
      stealthAddress,
      activeKeyId,
      isGenerating,
      isLoading,
      error,
      generateNewAddress,
      regenerateAddress,
      getKeys,
      getActiveKeyId: getActiveKeyIdCallback,
      formatForDisplay,
    }),
    [
      stealthAddress,
      activeKeyId,
      isGenerating,
      isLoading,
      error,
      generateNewAddress,
      regenerateAddress,
      getKeys,
      getActiveKeyIdCallback,
      formatForDisplay,
    ]
  )
}
