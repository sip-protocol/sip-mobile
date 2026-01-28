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

const SECURE_STORE_KEY = "sip_stealth_keys_v2" // New versioned key
const LEGACY_STORE_KEY = "sip_stealth_keys" // For migration
const SIP_CHAIN = "solana"

// ============================================================================
// STORAGE HELPERS
// ============================================================================

/**
 * Load stealth keys storage from SecureStore
 */
async function loadStorage(): Promise<StealthKeysStorage | null> {
  try {
    const stored = await SecureStore.getItemAsync(SECURE_STORE_KEY)
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
async function saveStorage(storage: StealthKeysStorage): Promise<void> {
  await SecureStore.setItemAsync(SECURE_STORE_KEY, JSON.stringify(storage))
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

    // Save new format
    await saveStorage(storage)

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
 * Get a specific key record by ID
 * Exported for use by useClaim hook
 */
export async function getKeyById(keyId: string): Promise<StealthKeysRecord | null> {
  const storage = await loadStorage()
  if (!storage) return null
  return storage.records.find((r) => r.id === keyId) ?? null
}

/**
 * Get the active key record
 */
async function getActiveKeyRecord(): Promise<StealthKeysRecord | null> {
  const storage = await loadStorage()
  if (!storage || !storage.activeKeyId) return null
  return storage.records.find((r) => r.id === storage.activeKeyId) ?? null
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
      loadOrGenerateKeys()
    } else {
      setStealthAddress(null)
      setKeys(null)
      setActiveKeyId(null)
      setIsLoading(false)
    }
  }, [isConnected, address])

  const loadOrGenerateKeys = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Try to load existing storage
      let storage = await loadStorage()

      // Migrate legacy keys if needed
      if (!storage) {
        storage = await migrateLegacyKeys()
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
      await generateNewAddressInternal()
    } catch (err) {
      console.error("Failed to load stealth keys:", err)
      setError("Failed to load stealth keys")
    } finally {
      setIsLoading(false)
    }
  }, [])

  const generateNewAddressInternal = useCallback(async (): Promise<StealthAddress | null> => {
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
      let storage = await loadStorage()

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
      await saveStorage(storage)

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
  }, [])

  const generateNewAddress = useCallback(async (): Promise<StealthAddress | null> => {
    if (!isConnected) {
      setError("Wallet not connected")
      return null
    }
    return generateNewAddressInternal()
  }, [isConnected, generateNewAddressInternal])

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

    const activeRecord = await getActiveKeyRecord()
    return activeRecord?.keys ?? null
  }, [keys])

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
