/**
 * Viewing Keys Management Hook
 *
 * Manages viewing key operations for compliance and selective disclosure:
 * - Export viewing key for auditors
 * - Import viewing keys from others
 * - Track disclosure history
 * - Manage imported keys
 */

import { useState, useCallback, useEffect, useMemo } from "react"
import * as SecureStore from "expo-secure-store"
import { useWalletStore } from "@/stores/wallet"
import type {
  ViewingKeyDisclosure,
  ImportedViewingKey,
  ViewingKeyExport,
  ChainType,
} from "@/types"
import { useSettingsStore } from "@/stores/settings"
import { Connection } from "@solana/web3.js"
import { fetchAllTransferRecords } from "@/lib/anchor/client"
import { scanRecordsForOwner } from "@/services/recordOwnership"
import { hexToBytes } from "@/lib/stealth"

// ============================================================================
// TYPES
// ============================================================================

export interface UseViewingKeysReturn {
  // State
  disclosures: ViewingKeyDisclosure[]
  importedKeys: ImportedViewingKey[]
  isLoading: boolean
  error: string | null

  // Export Actions
  exportViewingKey: (options?: ExportOptions) => Promise<ViewingKeyExport | null>
  getExportString: (options?: ExportOptions) => Promise<string | null>

  // Disclosure Actions
  recordDisclosure: (disclosure: DisclosureInput) => Promise<ViewingKeyDisclosure>
  revokeDisclosure: (id: string) => Promise<void>
  deleteDisclosure: (id: string) => Promise<void>

  // Import Actions
  importViewingKey: (input: ImportKeyInput) => Promise<ImportedViewingKey | null>
  removeImportedKey: (id: string) => Promise<void>
  updateImportedKey: (id: string, updates: Partial<ImportedViewingKey>) => Promise<void>
  scanImportedKey: (id: string) => Promise<{ found: number; scanned: number } | null>

  // Queries
  getActiveDisclosures: () => ViewingKeyDisclosure[]
  hasViewingKey: () => Promise<boolean>
}

export interface ExportOptions {
  expiresInDays?: number
  includeMetadata?: boolean
}

export interface DisclosureInput {
  recipientName: string
  recipientAddress?: string
  purpose: "compliance" | "audit" | "personal" | "other"
  note?: string
  expiresInDays?: number
}

export interface ImportKeyInput {
  label: string
  viewingKeyData: string // JSON or base64 encoded ViewingKeyExport
  ownerAddress?: string
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STEALTH_KEYS_STORE_V2 = "sip_stealth_keys_v2"
const STEALTH_KEYS_STORE_LEGACY = "sip_stealth_keys"
const DISCLOSURES_STORE = "sip_viewing_disclosures"
const IMPORTED_KEYS_STORE = "sip_imported_viewing_keys"
const EXPORT_VERSION = 1

// ============================================================================
// HELPERS
// ============================================================================

function generateId(): string {
  return `vk_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Load stealth keys from storage (v3 wallet-scoped → v2 → legacy)
 * Returns the keys object with viewing/spending keys
 */
async function loadStealthKeys(walletAddress?: string | null): Promise<{
  viewingPublicKey: string
  viewingPrivateKey: string
  spendingPublicKey: string
} | null> {
  // Try v3 wallet-scoped format first
  if (walletAddress) {
    const storedV3 = await SecureStore.getItemAsync(`sip_stealth_keys_v3_${walletAddress}`)
    if (storedV3) {
      try {
        const storage = JSON.parse(storedV3)
        if (storage.activeKeyId && storage.records) {
          const activeRecord = storage.records.find(
            (r: { id: string }) => r.id === storage.activeKeyId
          )
          if (activeRecord?.keys) {
            return activeRecord.keys
          }
        }
        // No activeKeyId but has records — use the first
        if (storage.records?.length > 0) {
          return storage.records[0].keys
        }
      } catch {
        // Continue to v2
      }
    }
  }

  // Fall back to v2 format (archival storage)
  const storedV2 = await SecureStore.getItemAsync(STEALTH_KEYS_STORE_V2)
  if (storedV2) {
    try {
      const storage = JSON.parse(storedV2)
      // V2 format has records array with activeKeyId
      if (storage.activeKeyId && storage.records) {
        const activeRecord = storage.records.find(
          (r: { id: string }) => r.id === storage.activeKeyId
        )
        if (activeRecord?.keys) {
          return activeRecord.keys
        }
      }
    } catch {
      // Continue to legacy
    }
  }

  // Fall back to legacy format
  const storedLegacy = await SecureStore.getItemAsync(STEALTH_KEYS_STORE_LEGACY)
  if (storedLegacy) {
    try {
      return JSON.parse(storedLegacy)
    } catch {
      return null
    }
  }

  return null
}

function encodeExport(data: ViewingKeyExport): string {
  const json = JSON.stringify(data)
  // In production, use proper base64 encoding
  return btoa(json)
}

function decodeExport(encoded: string): ViewingKeyExport | null {
  try {
    // Try base64 first
    const json = atob(encoded)
    return JSON.parse(json) as ViewingKeyExport
  } catch {
    // Try direct JSON
    try {
      return JSON.parse(encoded) as ViewingKeyExport
    } catch {
      return null
    }
  }
}

/**
 * Build an ImportedViewingKey from a decoded export.
 *
 * Pure mapping (exported for testing). Carries `spendingPublicKey` from the export so the
 * imported key can be scanned view-only — detection needs the viewing private key + the
 * owner's spending public key (#86).
 */
export function buildImportedViewingKey(
  exportData: ViewingKeyExport,
  input: { label: string; ownerAddress?: string },
  id: string,
  importedAt: number
): ImportedViewingKey {
  return {
    id,
    label: input.label,
    viewingPublicKey: exportData.viewingPublicKey,
    viewingPrivateKey: exportData.viewingPrivateKey,
    spendingPublicKey: exportData.spendingPublicKey,
    ownerAddress: input.ownerAddress,
    chain: exportData.chain,
    importedAt,
    paymentsFound: 0,
  }
}

// ============================================================================
// HOOK
// ============================================================================

export function useViewingKeys(): UseViewingKeysReturn {
  const { isConnected, address } = useWalletStore()

  const [disclosures, setDisclosures] = useState<ViewingKeyDisclosure[]>([])
  const [importedKeys, setImportedKeys] = useState<ImportedViewingKey[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load data on mount
  useEffect(() => {
    if (isConnected) {
      loadData()
    } else {
      setDisclosures([])
      setImportedKeys([])
      setIsLoading(false)
    }
  }, [isConnected])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Load disclosures
      const storedDisclosures = await SecureStore.getItemAsync(DISCLOSURES_STORE)
      if (storedDisclosures) {
        setDisclosures(JSON.parse(storedDisclosures))
      }

      // Load imported keys
      const storedImported = await SecureStore.getItemAsync(IMPORTED_KEYS_STORE)
      if (storedImported) {
        setImportedKeys(JSON.parse(storedImported))
      }
    } catch (err) {
      console.error("Failed to load viewing keys data:", err)
      setError("Failed to load viewing keys")
    } finally {
      setIsLoading(false)
    }
  }, [])

  const saveDisclosures = useCallback(
    async (newDisclosures: ViewingKeyDisclosure[]) => {
      await SecureStore.setItemAsync(
        DISCLOSURES_STORE,
        JSON.stringify(newDisclosures)
      )
      setDisclosures(newDisclosures)
    },
    []
  )

  const saveImportedKeys = useCallback(
    async (newKeys: ImportedViewingKey[]) => {
      await SecureStore.setItemAsync(IMPORTED_KEYS_STORE, JSON.stringify(newKeys))
      setImportedKeys(newKeys)
    },
    []
  )

  // ============================================================================
  // EXPORT ACTIONS
  // ============================================================================

  const exportViewingKey = useCallback(
    async (options?: ExportOptions): Promise<ViewingKeyExport | null> => {
      if (!isConnected) {
        setError("Wallet not connected")
        return null
      }

      try {
        const keys = await loadStealthKeys(address)
        if (!keys) {
          setError("No stealth keys found. Generate a stealth address first.")
          return null
        }

        const now = Date.now()

        const exportData: ViewingKeyExport = {
          version: EXPORT_VERSION,
          chain: "solana" as ChainType,
          viewingPublicKey: keys.viewingPublicKey,
          viewingPrivateKey: keys.viewingPrivateKey,
          spendingPublicKey: keys.spendingPublicKey,
          exportedAt: now,
        }

        if (options?.expiresInDays) {
          exportData.expiresAt = now + options.expiresInDays * 24 * 60 * 60 * 1000
        }

        return exportData
      } catch (err) {
        console.error("Failed to export viewing key:", err)
        setError("Failed to export viewing key")
        return null
      }
    },
    [isConnected, address]
  )

  const getExportString = useCallback(
    async (options?: ExportOptions): Promise<string | null> => {
      const exportData = await exportViewingKey(options)
      if (!exportData) return null
      return encodeExport(exportData)
    },
    [exportViewingKey]
  )

  // ============================================================================
  // DISCLOSURE ACTIONS
  // ============================================================================

  const recordDisclosure = useCallback(
    async (input: DisclosureInput): Promise<ViewingKeyDisclosure> => {
      const now = Date.now()

      const disclosure: ViewingKeyDisclosure = {
        id: generateId(),
        recipientName: input.recipientName,
        recipientAddress: input.recipientAddress,
        purpose: input.purpose,
        note: input.note,
        disclosedAt: now,
        expiresAt: input.expiresInDays
          ? now + input.expiresInDays * 24 * 60 * 60 * 1000
          : undefined,
        revoked: false,
      }

      const newDisclosures = [disclosure, ...disclosures]
      await saveDisclosures(newDisclosures)

      return disclosure
    },
    [disclosures, saveDisclosures]
  )

  const revokeDisclosure = useCallback(
    async (id: string): Promise<void> => {
      const newDisclosures = disclosures.map((d) =>
        d.id === id ? { ...d, revoked: true, revokedAt: Date.now() } : d
      )
      await saveDisclosures(newDisclosures)
    },
    [disclosures, saveDisclosures]
  )

  const deleteDisclosure = useCallback(
    async (id: string): Promise<void> => {
      const newDisclosures = disclosures.filter((d) => d.id !== id)
      await saveDisclosures(newDisclosures)
    },
    [disclosures, saveDisclosures]
  )

  // ============================================================================
  // IMPORT ACTIONS
  // ============================================================================

  const importViewingKey = useCallback(
    async (input: ImportKeyInput): Promise<ImportedViewingKey | null> => {
      try {
        const exportData = decodeExport(input.viewingKeyData)
        if (!exportData) {
          setError("Invalid viewing key format")
          return null
        }

        // Check if expired
        if (exportData.expiresAt && exportData.expiresAt < Date.now()) {
          setError("This viewing key has expired")
          return null
        }

        // Check for duplicates
        const isDuplicate = importedKeys.some(
          (k) => k.viewingPublicKey === exportData.viewingPublicKey
        )
        if (isDuplicate) {
          setError("This viewing key has already been imported")
          return null
        }

        const importedKey = buildImportedViewingKey(
          exportData,
          { label: input.label, ownerAddress: input.ownerAddress },
          generateId(),
          Date.now()
        )

        const newKeys = [importedKey, ...importedKeys]
        await saveImportedKeys(newKeys)

        return importedKey
      } catch (err) {
        console.error("Failed to import viewing key:", err)
        setError("Failed to import viewing key")
        return null
      }
    },
    [importedKeys, saveImportedKeys]
  )

  const removeImportedKey = useCallback(
    async (id: string): Promise<void> => {
      const newKeys = importedKeys.filter((k) => k.id !== id)
      await saveImportedKeys(newKeys)
    },
    [importedKeys, saveImportedKeys]
  )

  const updateImportedKey = useCallback(
    async (id: string, updates: Partial<ImportedViewingKey>): Promise<void> => {
      const newKeys = importedKeys.map((k) =>
        k.id === id ? { ...k, ...updates } : k
      )
      await saveImportedKeys(newKeys)
    },
    [importedKeys, saveImportedKeys]
  )

  /**
   * Scan the chain for payments to an imported viewing key — VIEW-ONLY.
   *
   * Fetches transfer records and filters them with the canonical view-only check using the
   * imported key's viewing private key + the owner's spending public key (never a spending
   * private key). Updates the key's `lastScannedAt` / `paymentsFound`. Keys imported before
   * `spendingPublicKey` was persisted cannot be scanned until re-imported.
   */
  const scanImportedKey = useCallback(
    async (id: string): Promise<{ found: number; scanned: number } | null> => {
      const key = importedKeys.find((k) => k.id === id)
      if (!key) {
        setError("Imported key not found")
        return null
      }
      if (!key.spendingPublicKey) {
        setError(
          "This key was imported before view-only scanning was supported. Re-import it to scan."
        )
        return null
      }

      try {
        const network = useSettingsStore.getState().network
        const connection = new Connection(
          network === "mainnet-beta"
            ? "https://api.mainnet-beta.solana.com"
            : "https://api.devnet.solana.com",
          { commitment: "confirmed" }
        )

        const records = await fetchAllTransferRecords(connection)
        const owned = scanRecordsForOwner(
          records,
          hexToBytes(key.viewingPrivateKey),
          hexToBytes(key.spendingPublicKey)
        )

        await updateImportedKey(id, {
          lastScannedAt: Date.now(),
          paymentsFound: owned.length,
        })

        return { found: owned.length, scanned: records.length }
      } catch (err) {
        console.error("Failed to scan imported viewing key:", err)
        setError("Failed to scan. Check your network connection and try again.")
        return null
      }
    },
    [importedKeys, updateImportedKey]
  )

  // ============================================================================
  // QUERIES
  // ============================================================================

  const getActiveDisclosures = useCallback((): ViewingKeyDisclosure[] => {
    const now = Date.now()
    return disclosures.filter(
      (d) => !d.revoked && (!d.expiresAt || d.expiresAt > now)
    )
  }, [disclosures])

  const hasViewingKey = useCallback(async (): Promise<boolean> => {
    try {
      const keys = await loadStealthKeys(address)
      return Boolean(keys?.viewingPrivateKey)
    } catch {
      return false
    }
  }, [address])

  return useMemo(
    () => ({
      disclosures,
      importedKeys,
      isLoading,
      error,
      exportViewingKey,
      getExportString,
      recordDisclosure,
      revokeDisclosure,
      deleteDisclosure,
      importViewingKey,
      removeImportedKey,
      updateImportedKey,
      scanImportedKey,
      getActiveDisclosures,
      hasViewingKey,
    }),
    [
      disclosures,
      importedKeys,
      isLoading,
      error,
      exportViewingKey,
      getExportString,
      recordDisclosure,
      revokeDisclosure,
      deleteDisclosure,
      importViewingKey,
      removeImportedKey,
      updateImportedKey,
      scanImportedKey,
      getActiveDisclosures,
      hasViewingKey,
    ]
  )
}
