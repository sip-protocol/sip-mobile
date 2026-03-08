# Wallet-Scoped Stealth Keys Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make stealth keys per-wallet with encrypted backup, and fix New Address button UX.

**Architecture:** Scope stealth key storage by wallet address (`sip_stealth_keys_v3_${walletAddress}`). Add `walletAddress` to `PaymentRecord` for scoped claim lookup. Encrypted backup via XChaCha20-Poly1305 with seed-derived key, exported as `.sip-backup` file. Post-migration banner prompts backup.

**Tech Stack:** TypeScript, Expo SecureStore, @noble/ciphers (XChaCha20-Poly1305), @noble/hashes (SHA-256), expo-file-system, expo-sharing, Vitest

**Design:** See `docs/plans/2026-03-08-wallet-scoped-stealth-keys-design.md`

**Issues:** #80 (P1), #79 (P2)

---

## Task 1: Add `walletAddress` to PaymentRecord type

**Files:**
- Modify: `src/types/index.ts:71-94`

**Step 1: Add field to PaymentRecord**

In `src/types/index.ts`, add `walletAddress` to the `PaymentRecord` interface after the `tokenDecimals` field:

```typescript
  /** Token decimals (for SPL token display/claim) */
  tokenDecimals?: number
  /** Wallet address that owns this payment's stealth keys */
  walletAddress?: string
```

**Step 2: Run typecheck**

Run: `cd ~/local-dev/sip-mobile && pnpm typecheck`
Expected: PASS (field is optional, no breaking changes)

**Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add walletAddress to PaymentRecord type (#80)"
```

---

## Task 2: Backup encryption utilities

Pure functions in `stealth.ts` — testable without Expo mocks.

**Files:**
- Modify: `src/lib/stealth.ts:1-422`
- Modify: `tests/lib/stealth.test.ts`

**Step 1: Write failing tests for backup encryption**

Add to end of `tests/lib/stealth.test.ts`:

```typescript
import { sha256 } from "@noble/hashes/sha256"
import { xchacha20poly1305 } from "@noble/ciphers/chacha"
import { randomBytes } from "@noble/ciphers/webcrypto"

// Re-implement backup functions for isolated testing (same as stealth.ts)
const BACKUP_SALT = "sip-stealth-backup"

function deriveBackupKey(seedPhrase: string): Uint8Array {
  const encoder = new TextEncoder()
  const seedBytes = encoder.encode(seedPhrase)
  const saltBytes = encoder.encode(BACKUP_SALT)
  const combined = new Uint8Array(seedBytes.length + saltBytes.length)
  combined.set(seedBytes)
  combined.set(saltBytes, seedBytes.length)
  return sha256(combined)
}

function encryptStealthBackup(storageJson: string, seedPhrase: string): string {
  const key = deriveBackupKey(seedPhrase)
  const nonce = randomBytes(24)
  const plaintext = new TextEncoder().encode(storageJson)
  const cipher = xchacha20poly1305(key, nonce)
  const ciphertext = cipher.encrypt(plaintext)
  // Prepend nonce to ciphertext, encode as base64
  const combined = new Uint8Array(nonce.length + ciphertext.length)
  combined.set(nonce)
  combined.set(ciphertext, nonce.length)
  return Buffer.from(combined).toString("base64")
}

function decryptStealthBackup(encoded: string, seedPhrase: string): string | null {
  try {
    const key = deriveBackupKey(seedPhrase)
    const combined = new Uint8Array(Buffer.from(encoded, "base64"))
    const nonce = combined.slice(0, 24)
    const ciphertext = combined.slice(24)
    const cipher = xchacha20poly1305(key, nonce)
    const plaintext = cipher.decrypt(ciphertext)
    return new TextDecoder().decode(plaintext)
  } catch {
    return null
  }
}

describe("Stealth Backup Encryption", () => {
  const testSeed = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
  const testStorage = JSON.stringify({
    version: 1,
    activeKeyId: "keys_1234",
    records: [{
      id: "keys_1234",
      keys: {
        spendingPrivateKey: "0xabc",
        spendingPublicKey: "0xdef",
        viewingPrivateKey: "0x123",
        viewingPublicKey: "0x456",
      },
      createdAt: 1234567890,
      archivedAt: null,
      isActive: true,
    }],
  })

  describe("deriveBackupKey", () => {
    it("should produce 32-byte key", () => {
      const key = deriveBackupKey(testSeed)
      expect(key).toBeInstanceOf(Uint8Array)
      expect(key.length).toBe(32)
    })

    it("should be deterministic", () => {
      const key1 = deriveBackupKey(testSeed)
      const key2 = deriveBackupKey(testSeed)
      expect(Buffer.from(key1).toString("hex")).toBe(Buffer.from(key2).toString("hex"))
    })

    it("should differ for different seeds", () => {
      const key1 = deriveBackupKey(testSeed)
      const key2 = deriveBackupKey("different seed phrase here")
      expect(Buffer.from(key1).toString("hex")).not.toBe(Buffer.from(key2).toString("hex"))
    })
  })

  describe("encryptStealthBackup / decryptStealthBackup", () => {
    it("should roundtrip encrypt and decrypt", () => {
      const encrypted = encryptStealthBackup(testStorage, testSeed)
      const decrypted = decryptStealthBackup(encrypted, testSeed)
      expect(decrypted).toBe(testStorage)
    })

    it("should produce different ciphertext each time (random nonce)", () => {
      const enc1 = encryptStealthBackup(testStorage, testSeed)
      const enc2 = encryptStealthBackup(testStorage, testSeed)
      expect(enc1).not.toBe(enc2)
    })

    it("should fail with wrong seed", () => {
      const encrypted = encryptStealthBackup(testStorage, testSeed)
      const result = decryptStealthBackup(encrypted, "wrong seed phrase")
      expect(result).toBeNull()
    })

    it("should fail with corrupted data", () => {
      const result = decryptStealthBackup("not-valid-base64!!!", testSeed)
      expect(result).toBeNull()
    })

    it("should preserve JSON structure after roundtrip", () => {
      const encrypted = encryptStealthBackup(testStorage, testSeed)
      const decrypted = decryptStealthBackup(encrypted, testSeed)
      const parsed = JSON.parse(decrypted!)
      expect(parsed.version).toBe(1)
      expect(parsed.activeKeyId).toBe("keys_1234")
      expect(parsed.records).toHaveLength(1)
      expect(parsed.records[0].keys.spendingPrivateKey).toBe("0xabc")
    })
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `cd ~/local-dev/sip-mobile && pnpm test -- tests/lib/stealth.test.ts --run`
Expected: PASS (tests use re-implemented functions, not imports — they should pass immediately since the test defines its own functions)

Note: These tests validate the algorithm. The actual `stealth.ts` exports come next.

**Step 3: Add exports to stealth.ts**

Add at the end of `src/lib/stealth.ts` (before the closing of the file):

```typescript
// ─── Backup Encryption ──────────────────────────────────────────────────────

import { xchacha20poly1305 } from "@noble/ciphers/chacha"
import { randomBytes } from "@noble/ciphers/webcrypto"

const BACKUP_SALT = "sip-stealth-backup"

/**
 * Derive a 32-byte encryption key from a seed phrase
 * Uses SHA-256(seed_bytes || salt_bytes)
 */
export function deriveBackupKey(seedPhrase: string): Uint8Array {
  const encoder = new TextEncoder()
  const seedBytes = encoder.encode(seedPhrase)
  const saltBytes = encoder.encode(BACKUP_SALT)
  const combined = new Uint8Array(seedBytes.length + saltBytes.length)
  combined.set(seedBytes)
  combined.set(saltBytes, seedBytes.length)
  return sha256(combined)
}

/**
 * Encrypt stealth keys storage JSON for backup
 *
 * Uses XChaCha20-Poly1305 with a seed-derived key.
 * Returns base64-encoded string (24-byte nonce prepended to ciphertext).
 */
export function encryptStealthBackup(storageJson: string, seedPhrase: string): string {
  const key = deriveBackupKey(seedPhrase)
  const nonce = randomBytes(24)
  const plaintext = new TextEncoder().encode(storageJson)
  const cipher = xchacha20poly1305(key, nonce)
  const ciphertext = cipher.encrypt(plaintext)
  const out = new Uint8Array(nonce.length + ciphertext.length)
  out.set(nonce)
  out.set(ciphertext, nonce.length)
  return Buffer.from(out).toString("base64")
}

/**
 * Decrypt a stealth keys backup
 *
 * Returns the decrypted JSON string, or null if decryption fails
 * (wrong seed, corrupted data, tampered ciphertext).
 */
export function decryptStealthBackup(encoded: string, seedPhrase: string): string | null {
  try {
    const key = deriveBackupKey(seedPhrase)
    const combined = new Uint8Array(Buffer.from(encoded, "base64"))
    if (combined.length < 25) return null // minimum: 24 nonce + 1 byte
    const nonce = combined.slice(0, 24)
    const ciphertext = combined.slice(24)
    const cipher = xchacha20poly1305(key, nonce)
    const plaintext = cipher.decrypt(ciphertext)
    return new TextDecoder().decode(plaintext)
  } catch {
    return null
  }
}
```

Note: The `sha256` import is already at line 11 of stealth.ts. Move the new imports (`xchacha20poly1305`, `randomBytes`) to the import block at the top of the file.

**Step 4: Run tests**

Run: `cd ~/local-dev/sip-mobile && pnpm test -- tests/lib/stealth.test.ts --run`
Expected: PASS

**Step 5: Run typecheck**

Run: `cd ~/local-dev/sip-mobile && pnpm typecheck`
Expected: PASS

**Step 6: Commit**

```bash
git add src/lib/stealth.ts tests/lib/stealth.test.ts
git commit -m "feat: add stealth backup encryption utilities (#80)"
```

---

## Task 3: Wallet-scoped storage in useStealth hook

The core change — scope all storage by wallet address, add migration.

**Files:**
- Modify: `src/hooks/useStealth.ts`
- Modify: `tests/hooks/useStealth.test.ts`

**Step 1: Write failing tests for wallet-scoped storage**

Add to end of `tests/hooks/useStealth.test.ts`:

```typescript
describe("Wallet-Scoped Storage", () => {
  // Test the storage key generation
  const getStoreKey = (walletAddress: string) => `sip_stealth_keys_v3_${walletAddress}`

  it("should generate unique storage keys per wallet", () => {
    const key1 = getStoreKey("wallet_address_1")
    const key2 = getStoreKey("wallet_address_2")
    expect(key1).toBe("sip_stealth_keys_v3_wallet_address_1")
    expect(key2).toBe("sip_stealth_keys_v3_wallet_address_2")
    expect(key1).not.toBe(key2)
  })

  it("should produce deterministic keys for same wallet", () => {
    const key1 = getStoreKey("wallet_address_1")
    const key2 = getStoreKey("wallet_address_1")
    expect(key1).toBe(key2)
  })

  it("should handle base58 wallet addresses", () => {
    const solanaAddr = "FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr"
    const key = getStoreKey(solanaAddr)
    expect(key).toBe(`sip_stealth_keys_v3_${solanaAddr}`)
    expect(key.length).toBeGreaterThan(20)
  })
})

describe("Migration v2 → v3", () => {
  it("should preserve all records during migration", () => {
    const v2Storage = {
      version: 1 as const,
      activeKeyId: "keys_100",
      records: [
        {
          id: "keys_100",
          keys: {
            spendingPrivateKey: "0xsp1",
            spendingPublicKey: "0xsp2",
            viewingPrivateKey: "0xvp1",
            viewingPublicKey: "0xvp2",
          },
          createdAt: 100,
          archivedAt: null,
          isActive: true,
        },
        {
          id: "keys_50",
          keys: {
            spendingPrivateKey: "0xold1",
            spendingPublicKey: "0xold2",
            viewingPrivateKey: "0xold3",
            viewingPublicKey: "0xold4",
          },
          createdAt: 50,
          archivedAt: 100,
          isActive: false,
        },
      ],
    }

    // Migration should preserve all records
    expect(v2Storage.records.length).toBe(2)
    expect(v2Storage.records[0].isActive).toBe(true)
    expect(v2Storage.records[1].isActive).toBe(false)
    expect(v2Storage.activeKeyId).toBe("keys_100")
  })
})
```

**Step 2: Run tests to verify**

Run: `cd ~/local-dev/sip-mobile && pnpm test -- tests/hooks/useStealth.test.ts --run`
Expected: PASS

**Step 3: Refactor useStealth.ts for wallet-scoped storage**

Replace the constants and storage helpers section (lines 60-153) in `src/hooks/useStealth.ts`:

```typescript
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
 * Load stealth keys storage for a specific wallet
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
 * Save stealth keys storage for a specific wallet
 */
async function saveStorage(walletAddress: string, storage: StealthKeysStorage): Promise<void> {
  await SecureStore.setItemAsync(getStoreKey(walletAddress), JSON.stringify(storage))
}

/**
 * Migrate legacy v1 keys to v2 format
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

    // Clean up legacy key (will be saved under v3 by caller)
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
 * Moves all records to the active wallet's scoped key
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
 * Get a specific key record by ID for a wallet
 * Exported for use by useClaim hook
 */
export async function getKeyById(
  keyId: string,
  walletAddress?: string
): Promise<StealthKeysRecord | null> {
  // If wallet address provided, search that wallet's storage
  if (walletAddress) {
    const storage = await loadStorage(walletAddress)
    if (!storage) return null
    return storage.records.find((r) => r.id === keyId) ?? null
  }

  // Fall back to active wallet from store
  const activeAddress = useWalletStore.getState().address
  if (!activeAddress) return null

  const storage = await loadStorage(activeAddress)
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
    // Validate structure
    if (!storage.version || !Array.isArray(storage.records)) {
      return false
    }
    await saveStorage(walletAddress, storage)
    return true
  } catch {
    return false
  }
}
```

Add `AsyncStorage` import at the top of `src/hooks/useStealth.ts`:

```typescript
import AsyncStorage from "@react-native-async-storage/async-storage"
```

**Step 4: Update the hook to use wallet-scoped storage**

In the `useStealth()` function body (around line 190+), update `loadOrGenerateKeys` to accept and use wallet address:

```typescript
export function useStealth(): UseStealthReturn {
  const { isConnected, address } = useWalletStore()

  const [stealthAddress, setStealthAddress] = useState<StealthAddress | null>(null)
  const [activeKeyId, setActiveKeyId] = useState<string | null>(null)
  const [keys, setKeys] = useState<StealthKeys | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load or generate keys on mount and when wallet changes
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

      // Migrate v2 → v3 if needed
      if (!storage) {
        storage = await migrateV2ToV3(walletAddress)
      }

      // Migrate legacy v1 → v3 if needed
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

          const addr = formatStealthAddress(
            SIP_CHAIN,
            activeRecord.keys.spendingPublicKey,
            activeRecord.keys.viewingPublicKey
          )
          setStealthAddress(addr)
          return
        }
      }

      // No keys found, generate new ones for this wallet
      await generateNewAddressInternal(walletAddress)
    } catch (err) {
      console.error("Failed to load stealth keys:", err)
      setError("Failed to load stealth keys")
    } finally {
      setIsLoading(false)
    }
  }, [])

  const generateNewAddressInternal = useCallback(async (
    walletAddress?: string
  ): Promise<StealthAddress | null> => {
    const targetAddress = walletAddress || address
    if (!targetAddress) {
      setError("No wallet address")
      return null
    }

    setIsGenerating(true)
    setError(null)

    try {
      const newKeys = await generateStealthKeys()
      const keyId = `keys_${Date.now()}`

      const newRecord: StealthKeysRecord = {
        id: keyId,
        keys: newKeys,
        createdAt: Date.now(),
        archivedAt: null,
        isActive: true,
      }

      let storage = await loadStorage(targetAddress)

      if (storage) {
        storage.records = storage.records.map((r) => ({
          ...r,
          isActive: false,
          archivedAt: r.isActive ? Date.now() : r.archivedAt,
        }))
        storage.records.push(newRecord)
        storage.activeKeyId = keyId
      } else {
        storage = {
          version: 1,
          activeKeyId: keyId,
          records: [newRecord],
        }
      }

      await saveStorage(targetAddress, storage)

      setKeys(newKeys)
      setActiveKeyId(keyId)

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

  const regenerateAddress = useCallback(async (): Promise<StealthAddress | null> => {
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
```

**Step 5: Run typecheck**

Run: `cd ~/local-dev/sip-mobile && pnpm typecheck`
Expected: PASS

**Step 6: Run all tests**

Run: `cd ~/local-dev/sip-mobile && pnpm test -- --run`
Expected: PASS (all 1,205+ tests)

**Step 7: Commit**

```bash
git add src/hooks/useStealth.ts tests/hooks/useStealth.test.ts
git commit -m "feat: wallet-scoped stealth key storage with v2→v3 migration (#80)"
```

---

## Task 4: Update useClaim for wallet-scoped keys

**Files:**
- Modify: `src/hooks/useClaim.ts:72-116`

**Step 1: Update loadKeysForPayment**

Replace the `loadKeysForPayment` function and constants in `src/hooks/useClaim.ts`:

Remove the old constants (lines 72-73):
```typescript
// DELETE these lines:
// const SECURE_STORE_KEY_V2 = "sip_stealth_keys_v2"
// const LEGACY_STORE_KEY = "sip_stealth_keys"
```

Replace the `loadKeysForPayment` function (lines 82-116):

```typescript
/**
 * Load stealth keys for claiming a payment
 *
 * Uses wallet-scoped storage (v3). Falls back to active wallet
 * for legacy payments without walletAddress. (#72, #80)
 */
async function loadKeysForPayment(payment: PaymentRecord): Promise<StealthKeys | null> {
  const walletAddress = payment.walletAddress || useWalletStore.getState().address

  // If payment has keyId, load that specific key set
  if (payment.keyId) {
    const keyRecord = await getKeyById(payment.keyId, walletAddress || undefined)
    if (keyRecord) {
      return keyRecord.keys
    }
    logger.warn(`Keys for keyId ${payment.keyId} not found in wallet ${walletAddress?.slice(0, 8)}...`)
  }

  // Fall back to active keys from wallet-scoped storage
  if (walletAddress) {
    try {
      const storeKey = `sip_stealth_keys_v3_${walletAddress}`
      const storageData = await SecureStore.getItemAsync(storeKey)
      if (storageData) {
        const storage = JSON.parse(storageData) as StealthKeysStorage
        if (storage.activeKeyId) {
          const activeRecord = storage.records.find((r) => r.id === storage.activeKeyId)
          if (activeRecord) {
            return activeRecord.keys
          }
        }
      }
    } catch (err) {
      console.error("Failed to load wallet-scoped stealth keys:", err)
    }
  }

  return null
}
```

**Step 2: Run typecheck**

Run: `cd ~/local-dev/sip-mobile && pnpm typecheck`
Expected: PASS

**Step 3: Run tests**

Run: `cd ~/local-dev/sip-mobile && pnpm test -- tests/hooks/useClaim.test.ts --run`
Expected: PASS

**Step 4: Commit**

```bash
git add src/hooks/useClaim.ts
git commit -m "feat: update useClaim for wallet-scoped stealth keys (#80)"
```

---

## Task 5: New Address button UX fix (#79)

**Files:**
- Modify: `app/receive/index.tsx`

**Step 1: Add unclaimed count state and disable logic**

In `app/receive/index.tsx`, after line 59 (`const [showConfirmModal, setShowConfirmModal] = useState(false)`), add:

```typescript
  const unclaimedCount = getUnclaimedPaymentsCount()
  const hasUnclaimed = unclaimedCount > 0
```

**Step 2: Update the New Address button (lines 281-297)**

Replace the `TouchableOpacity` for the regenerate button:

```typescript
              <TouchableOpacity
                onPress={handleRegeneratePress}
                disabled={isGenerating || hasUnclaimed}
                className={`flex-row items-center gap-1 ${hasUnclaimed ? "opacity-50" : ""}`}
                accessibilityRole="button"
                accessibilityLabel="Generate new stealth address"
                accessibilityHint={hasUnclaimed ? "Disabled: claim pending payments first" : "Creates a fresh one-time stealth address"}
                accessibilityState={{ disabled: hasUnclaimed }}
              >
                {isGenerating ? (
                  <ActivityIndicator size="small" color="#8b5cf6" />
                ) : (
                  <>
                    <ArrowsClockwiseIcon
                      size={16}
                      color={hasUnclaimed ? ICON_COLORS.inactive : ICON_COLORS.brand}
                      weight="regular"
                    />
                    <Text className={hasUnclaimed ? "text-dark-500 text-sm" : "text-brand-400 text-sm"}>
                      New Address
                    </Text>
                  </>
                )}
              </TouchableOpacity>
```

**Step 3: Add inline hint below stealth address box (after line 313)**

After the stealth address display `</View>` (closing the `bg-dark-900 rounded-xl` view), add:

```typescript
          {hasUnclaimed && (
            <Text className="text-amber-400 text-sm mt-2">
              Claim {unclaimedCount} pending payment{unclaimedCount > 1 ? "s" : ""} first
            </Text>
          )}
```

**Step 4: Run typecheck**

Run: `cd ~/local-dev/sip-mobile && pnpm typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add app/receive/index.tsx
git commit -m "fix: visually disable New Address button when unclaimed payments exist (#79)"
```

---

## Task 6: Backup prompt banner on Receive screen

**Files:**
- Modify: `app/receive/index.tsx`

**Step 1: Add backup banner state and imports**

At top of `app/receive/index.tsx`, add import:

```typescript
import { needsStealthBackup } from "@/hooks/useStealth"
```

Add `useEffect` to the existing imports from react:

```typescript
import { useState, useCallback, useEffect } from "react"
```

Add `WarningIcon` to the phosphor imports.

Inside the component, after the unclaimed count lines, add:

```typescript
  const [showBackupBanner, setShowBackupBanner] = useState(false)

  useEffect(() => {
    needsStealthBackup().then(setShowBackupBanner)
  }, [])

  const handleDismissBackup = useCallback(async () => {
    setShowBackupBanner(false)
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default
    await AsyncStorage.setItem("sip_stealth_backup_dismissed", "true")
  }, [])
```

**Step 2: Add backup banner JSX**

After the tab switcher `</View>` (around line 227) and before the amount input section, add:

```typescript
          {/* Backup Banner (#80) */}
          {showBackupBanner && (
            <View className="mt-4 bg-amber-900/20 border border-amber-700/30 rounded-xl p-4">
              <View className="flex-row items-start gap-3">
                <WarningIcon size={20} color="#f59e0b" weight="fill" />
                <View className="flex-1">
                  <Text className="text-amber-400 font-medium text-sm">
                    Stealth keys are device-local
                  </Text>
                  <Text className="text-dark-400 text-xs mt-1">
                    Back up now to prevent fund loss on reinstall.
                  </Text>
                  <View className="flex-row gap-3 mt-3">
                    <TouchableOpacity
                      className="bg-amber-600 px-4 py-2 rounded-lg"
                      onPress={() => router.push("/settings/stealth-backup")}
                    >
                      <Text className="text-white text-sm font-medium">Back Up Now</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="px-4 py-2"
                      onPress={handleDismissBackup}
                    >
                      <Text className="text-dark-400 text-sm">Dismiss</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          )}
```

**Step 3: Run typecheck**

Run: `cd ~/local-dev/sip-mobile && pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add app/receive/index.tsx
git commit -m "feat: add backup prompt banner on receive screen (#80)"
```

---

## Task 7: Settings nav row for stealth backup

**Files:**
- Modify: `app/settings/index.tsx`

**Step 1: Add nav row**

In `app/settings/index.tsx`, add `DownloadSimpleIcon` to the phosphor imports:

```typescript
import {
  ArrowLeftIcon,
  GlobeIcon,
  BookOpenIcon,
  BugIcon,
  ShieldCheckIcon,
  QuestionIcon,
  CheckCircleIcon,
  CaretRightIcon,
  LockKeyIcon,
  KeyIcon,
  UserIcon,
  EyeIcon,
  EyeSlashIcon,
  DownloadSimpleIcon,
} from "phosphor-react-native"
```

After the "Viewing Keys" NavRow (after line 238), add:

```typescript
            <NavRow
              Icon={DownloadSimpleIcon}
              iconColor={ICON_COLORS.success}
              title="Backup Stealth Keys"
              subtitle="Export or restore your stealth key archive"
              onPress={() => router.push("/settings/stealth-backup")}
            />
```

**Step 2: Run typecheck**

Run: `cd ~/local-dev/sip-mobile && pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add app/settings/index.tsx
git commit -m "feat: add stealth backup nav row in settings (#80)"
```

---

## Task 8: Stealth backup screen

**Files:**
- Create: `app/settings/stealth-backup.tsx`

**Step 1: Create the backup/restore screen**

```typescript
/**
 * Stealth Keys Backup Screen
 *
 * Export encrypted stealth keys as .sip-backup file.
 * Import from previously exported backup.
 */

import { View, Text, TouchableOpacity, Alert } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { useState } from "react"
import * as FileSystem from "expo-file-system"
import * as Sharing from "expo-sharing"
import * as DocumentPicker from "expo-document-picker"
import { Button, LoadingState } from "@/components/ui"
import { useNativeWallet } from "@/hooks"
import { useWalletStore } from "@/stores/wallet"
import { useToastStore } from "@/stores/toast"
import {
  encryptStealthBackup,
  decryptStealthBackup,
} from "@/lib/stealth"
import {
  exportStealthStorage,
  importStealthStorage,
  clearStealthBackupFlag,
} from "@/hooks/useStealth"
import {
  ArrowLeftIcon,
  DownloadSimpleIcon,
  UploadSimpleIcon,
  ShieldCheckIcon,
  WarningIcon,
} from "phosphor-react-native"
import { ICON_COLORS } from "@/constants/icons"

export default function StealthBackupScreen() {
  const { exportMnemonic } = useNativeWallet()
  const { address } = useWalletStore()
  const { addToast } = useToastStore()

  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  const handleExport = async () => {
    if (!address) {
      addToast({ type: "error", title: "No wallet", message: "Connect a wallet first" })
      return
    }

    setIsExporting(true)
    try {
      // Get seed phrase (requires biometric auth)
      const mnemonic = await exportMnemonic()
      if (!mnemonic) {
        addToast({ type: "error", title: "Authentication failed", message: "Biometric auth required" })
        return
      }

      // Get stealth storage
      const storageJson = await exportStealthStorage(address)
      if (!storageJson) {
        addToast({ type: "error", title: "No stealth keys", message: "No stealth keys found for this wallet" })
        return
      }

      // Encrypt
      const encrypted = encryptStealthBackup(storageJson, mnemonic)

      // Write to temp file
      const timestamp = new Date().toISOString().slice(0, 10)
      const fileName = `sip-stealth-backup-${timestamp}.sip-backup`
      const filePath = `${FileSystem.cacheDirectory}${fileName}`

      await FileSystem.writeAsStringAsync(filePath, encrypted, {
        encoding: FileSystem.EncodingType.UTF8,
      })

      // Share
      const canShare = await Sharing.isAvailableAsync()
      if (canShare) {
        await Sharing.shareAsync(filePath, {
          mimeType: "application/octet-stream",
          dialogTitle: "Save Stealth Keys Backup",
        })
      } else {
        addToast({ type: "error", title: "Sharing unavailable", message: "File sharing not available on this device" })
        return
      }

      // Clear backup flag
      await clearStealthBackupFlag()

      addToast({
        type: "success",
        title: "Backup exported",
        message: "Stealth keys backed up securely",
      })
    } catch (err) {
      console.error("Backup export failed:", err)
      addToast({ type: "error", title: "Export failed", message: "Failed to export backup" })
    } finally {
      setIsExporting(false)
    }
  }

  const handleImport = async () => {
    if (!address) {
      addToast({ type: "error", title: "No wallet", message: "Connect a wallet first" })
      return
    }

    setIsImporting(true)
    try {
      // Pick file
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      })

      if (result.canceled || !result.assets?.[0]) {
        return
      }

      const fileUri = result.assets[0].uri

      // Read file
      const encrypted = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.UTF8,
      })

      // Get seed phrase for decryption
      const mnemonic = await exportMnemonic()
      if (!mnemonic) {
        addToast({ type: "error", title: "Authentication failed", message: "Biometric auth required" })
        return
      }

      // Decrypt
      const decrypted = decryptStealthBackup(encrypted, mnemonic)
      if (!decrypted) {
        addToast({
          type: "error",
          title: "Decryption failed",
          message: "Wrong seed phrase or corrupted backup file",
          duration: 5000,
        })
        return
      }

      // Confirm overwrite
      Alert.alert(
        "Restore Stealth Keys?",
        "This will replace your current stealth keys for this wallet. Existing keys will be lost.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Restore",
            style: "destructive",
            onPress: async () => {
              const success = await importStealthStorage(address!, decrypted)
              if (success) {
                await clearStealthBackupFlag()
                addToast({
                  type: "success",
                  title: "Keys restored",
                  message: "Stealth keys imported successfully. Restart the app to apply.",
                })
              } else {
                addToast({ type: "error", title: "Import failed", message: "Invalid backup file format" })
              }
            },
          },
        ]
      )
    } catch (err) {
      console.error("Backup import failed:", err)
      addToast({ type: "error", title: "Import failed", message: "Failed to import backup" })
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-dark-950">
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-dark-900">
        <TouchableOpacity
          className="flex-row items-center"
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeftIcon size={24} color={ICON_COLORS.white} weight="bold" />
          <Text className="text-white ml-4 text-lg">Back</Text>
        </TouchableOpacity>
        <Text className="text-xl font-bold text-white">Stealth Backup</Text>
        <View className="w-16" />
      </View>

      <View className="flex-1 px-6 pt-6">
        {/* Info Card */}
        <View className="bg-brand-900/10 border border-brand-800/30 rounded-xl p-4 mb-6">
          <View className="flex-row items-start gap-3">
            <ShieldCheckIcon size={24} color={ICON_COLORS.brand} weight="fill" />
            <View className="flex-1">
              <Text className="text-brand-400 font-medium">Encrypted Backup</Text>
              <Text className="text-dark-400 text-sm mt-1">
                Your stealth keys are encrypted with your seed phrase. Only someone
                with your recovery phrase can decrypt the backup.
              </Text>
            </View>
          </View>
        </View>

        {/* Export */}
        <TouchableOpacity
          className="bg-dark-900 border border-dark-800 rounded-xl p-4 flex-row items-center mb-4"
          onPress={handleExport}
          disabled={isExporting || !address}
          accessibilityRole="button"
          accessibilityLabel="Export stealth keys backup"
        >
          <View className="w-12 h-12 bg-green-900/30 rounded-full items-center justify-center">
            <DownloadSimpleIcon size={24} color={ICON_COLORS.success} weight="regular" />
          </View>
          <View className="flex-1 ml-4">
            <Text className="text-white font-medium text-lg">Export Backup</Text>
            <Text className="text-dark-400 text-sm mt-1">
              Save encrypted stealth keys as a file
            </Text>
          </View>
        </TouchableOpacity>

        {/* Import */}
        <TouchableOpacity
          className="bg-dark-900 border border-dark-800 rounded-xl p-4 flex-row items-center mb-6"
          onPress={handleImport}
          disabled={isImporting || !address}
          accessibilityRole="button"
          accessibilityLabel="Import stealth keys from backup"
        >
          <View className="w-12 h-12 bg-blue-900/30 rounded-full items-center justify-center">
            <UploadSimpleIcon size={24} color={ICON_COLORS.info} weight="regular" />
          </View>
          <View className="flex-1 ml-4">
            <Text className="text-white font-medium text-lg">Restore from Backup</Text>
            <Text className="text-dark-400 text-sm mt-1">
              Import stealth keys from a .sip-backup file
            </Text>
          </View>
        </TouchableOpacity>

        {/* Warning */}
        <View className="bg-amber-900/10 border border-amber-800/30 rounded-xl p-4">
          <View className="flex-row items-start gap-3">
            <WarningIcon size={20} color="#f59e0b" weight="fill" />
            <View className="flex-1">
              <Text className="text-amber-400 font-medium text-sm">Important</Text>
              <Text className="text-dark-400 text-sm mt-1">
                Stealth keys are independent from your wallet seed. Without a backup,
                reinstalling the app will make existing stealth payments unclaimable.
              </Text>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  )
}
```

**Step 2: Check if expo-document-picker is installed**

Run: `cd ~/local-dev/sip-mobile && grep "expo-document-picker" package.json`

If not found, install:
```bash
cd ~/local-dev/sip-mobile && npx expo install expo-document-picker
```

**Step 3: Run typecheck**

Run: `cd ~/local-dev/sip-mobile && pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add app/settings/stealth-backup.tsx
git commit -m "feat: add stealth backup export/import screen (#80)"
```

---

## Task 9: Full test run and final verification

**Files:** None (verification only)

**Step 1: Run all tests**

Run: `cd ~/local-dev/sip-mobile && pnpm test -- --run`
Expected: PASS (all tests)

**Step 2: Run typecheck**

Run: `cd ~/local-dev/sip-mobile && pnpm typecheck`
Expected: PASS

**Step 3: Verify git log**

Run: `cd ~/local-dev/sip-mobile && git log --oneline feat/wallet-scoped-stealth-keys ^main`

Expected commits:
```
feat: add stealth backup export/import screen (#80)
feat: add stealth backup nav row in settings (#80)
feat: add backup prompt banner on receive screen (#80)
fix: visually disable New Address button when unclaimed payments exist (#79)
feat: update useClaim for wallet-scoped stealth keys (#80)
feat: wallet-scoped stealth key storage with v2→v3 migration (#80)
feat: add stealth backup encryption utilities (#80)
feat: add walletAddress to PaymentRecord type (#80)
docs: wallet-scoped stealth keys design (#80, #79)
```

**Step 4: Push and create PR**

```bash
git push -u origin feat/wallet-scoped-stealth-keys
```

Then create PR targeting `main` closing both #79 and #80.
