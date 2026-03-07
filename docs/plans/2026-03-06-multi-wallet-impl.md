# Multi-Wallet Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable unlimited wallet accounts — create, import, switch, and delete multiple wallets with indexed SecureStore key storage.

**Architecture:** Hybrid key storage — lightweight JSON registry in one SecureStore key for account enumeration, individual biometric-protected SecureStore entries per private key. Zustand store already supports multi-account; this plan wires the key storage and UI layers.

**Tech Stack:** Expo SecureStore, Zustand, React Native, Vitest

**Design doc:** `docs/plans/2026-03-06-multi-wallet-design.md`

---

### Task 1: Indexed Key Storage — Tests

**Files:**
- Create: `tests/utils/keyStorage.test.ts`

**Step 1: Write the failing tests**

```typescript
/**
 * Key Storage Tests (Multi-Wallet)
 *
 * Tests indexed key storage functions.
 * SecureStore is mocked globally in tests/setup.ts.
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import * as SecureStore from "expo-secure-store"
import {
  getWalletRegistry,
  addToRegistry,
  removeFromRegistry,
  storeWalletKeys,
  getPrivateKeyForAccount,
  getMnemonicForAccount,
  deleteWalletKeys,
  migrateFromLegacy,
} from "@/utils/keyStorage"

// Reset SecureStore mock between tests
const store: Record<string, string> = {}

vi.mocked(SecureStore.getItemAsync).mockImplementation(async (key) => store[key] ?? null)
vi.mocked(SecureStore.setItemAsync).mockImplementation(async (key, value) => { store[key] = value })
vi.mocked(SecureStore.deleteItemAsync).mockImplementation(async (key) => { delete store[key] })

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k])
})

describe("Wallet Registry", () => {
  it("returns empty array when no registry exists", async () => {
    expect(await getWalletRegistry()).toEqual([])
  })

  it("adds entry to registry", async () => {
    const entry = {
      id: "acc_1",
      address: "7FzbAkPMxJ",
      providerType: "native",
      createdAt: "2026-03-06T00:00:00.000Z",
      hasMnemonic: true,
    }
    await addToRegistry(entry)
    const registry = await getWalletRegistry()
    expect(registry).toHaveLength(1)
    expect(registry[0].id).toBe("acc_1")
  })

  it("adds multiple entries", async () => {
    await addToRegistry({ id: "acc_1", address: "ADDR1", providerType: "native", createdAt: "2026-01-01T00:00:00.000Z", hasMnemonic: true })
    await addToRegistry({ id: "acc_2", address: "ADDR2", providerType: "native", createdAt: "2026-01-02T00:00:00.000Z", hasMnemonic: false })
    expect(await getWalletRegistry()).toHaveLength(2)
  })

  it("does not add duplicate id", async () => {
    const entry = { id: "acc_1", address: "ADDR1", providerType: "native", createdAt: "2026-01-01T00:00:00.000Z", hasMnemonic: true }
    await addToRegistry(entry)
    await addToRegistry(entry)
    expect(await getWalletRegistry()).toHaveLength(1)
  })

  it("removes entry from registry", async () => {
    await addToRegistry({ id: "acc_1", address: "ADDR1", providerType: "native", createdAt: "2026-01-01T00:00:00.000Z", hasMnemonic: true })
    await addToRegistry({ id: "acc_2", address: "ADDR2", providerType: "native", createdAt: "2026-01-02T00:00:00.000Z", hasMnemonic: false })
    await removeFromRegistry("acc_1")
    const registry = await getWalletRegistry()
    expect(registry).toHaveLength(1)
    expect(registry[0].id).toBe("acc_2")
  })

  it("handles removing non-existent id gracefully", async () => {
    await removeFromRegistry("nonexistent")
    expect(await getWalletRegistry()).toEqual([])
  })
})

describe("Per-Account Key Storage", () => {
  it("stores and retrieves private key by account id", async () => {
    await storeWalletKeys("acc_1", "PRIVATE_KEY_BASE58", "PUBLIC_KEY_BASE58", "word1 word2 word3")
    expect(await getPrivateKeyForAccount("acc_1")).toBe("PRIVATE_KEY_BASE58")
  })

  it("stores and retrieves mnemonic by account id", async () => {
    await storeWalletKeys("acc_1", "PK", "PUBK", "tilt coral violin include average armor assist nuclear oven state modify rule")
    expect(await getMnemonicForAccount("acc_1")).toBe("tilt coral violin include average armor assist nuclear oven state modify rule")
  })

  it("stores without mnemonic for private key imports", async () => {
    await storeWalletKeys("acc_1", "PK", "PUBK")
    expect(await getMnemonicForAccount("acc_1")).toBeNull()
  })

  it("deletes all keys for an account", async () => {
    await storeWalletKeys("acc_1", "PK", "PUBK", "mnemonic words here")
    await deleteWalletKeys("acc_1")
    expect(await getPrivateKeyForAccount("acc_1")).toBeNull()
    expect(await getMnemonicForAccount("acc_1")).toBeNull()
  })

  it("isolates keys between accounts", async () => {
    await storeWalletKeys("acc_1", "PK_1", "PUBK_1", "mnemonic one")
    await storeWalletKeys("acc_2", "PK_2", "PUBK_2", "mnemonic two")
    expect(await getPrivateKeyForAccount("acc_1")).toBe("PK_1")
    expect(await getPrivateKeyForAccount("acc_2")).toBe("PK_2")
    expect(await getMnemonicForAccount("acc_1")).toBe("mnemonic one")
    expect(await getMnemonicForAccount("acc_2")).toBe("mnemonic two")
  })
})

describe("Legacy Migration", () => {
  it("migrates single-wallet keys to indexed format", async () => {
    // Simulate legacy keys
    store["sip_wallet_private_key"] = "LEGACY_PK"
    store["sip_wallet_mnemonic"] = "legacy mnemonic words"
    store["sip_wallet_public_key"] = "LEGACY_PUBK"
    store["sip_wallet_exists"] = "true"

    const entry = await migrateFromLegacy("migrated_id")
    expect(entry).not.toBeNull()
    expect(entry!.id).toBe("migrated_id")
    expect(entry!.address).toBe("LEGACY_PUBK")
    expect(entry!.hasMnemonic).toBe(true)

    // Verify indexed keys exist
    expect(await getPrivateKeyForAccount("migrated_id")).toBe("LEGACY_PK")
    expect(await getMnemonicForAccount("migrated_id")).toBe("legacy mnemonic words")

    // Verify legacy keys deleted
    expect(store["sip_wallet_private_key"]).toBeUndefined()
    expect(store["sip_wallet_mnemonic"]).toBeUndefined()
    expect(store["sip_wallet_public_key"]).toBeUndefined()
    expect(store["sip_wallet_exists"]).toBeUndefined()
  })

  it("returns null when no legacy wallet exists", async () => {
    const entry = await migrateFromLegacy("some_id")
    expect(entry).toBeNull()
  })

  it("handles legacy wallet without mnemonic (private key import)", async () => {
    store["sip_wallet_private_key"] = "LEGACY_PK"
    store["sip_wallet_public_key"] = "LEGACY_PUBK"
    store["sip_wallet_exists"] = "true"

    const entry = await migrateFromLegacy("migrated_id")
    expect(entry!.hasMnemonic).toBe(false)
    expect(await getMnemonicForAccount("migrated_id")).toBeNull()
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/rector/local-dev/sip-mobile && pnpm test:run tests/utils/keyStorage.test.ts`
Expected: FAIL — functions not exported from `@/utils/keyStorage`

**Step 3: Commit test file**

```bash
git add tests/utils/keyStorage.test.ts
git commit -m "test: add multi-wallet key storage tests"
```

---

### Task 2: Indexed Key Storage — Implementation

**Files:**
- Modify: `src/utils/keyStorage.ts`

**Step 1: Add registry types and storage key constants**

Add below existing `STORAGE_KEYS`:

```typescript
// Indexed storage key helpers
const walletKey = (id: string, suffix: string) => `sip_${suffix}_${id}`

const REGISTRY_KEY = "sip_wallet_registry"

export interface WalletRegistryEntry {
  id: string
  address: string
  providerType: string
  createdAt: string
  hasMnemonic: boolean
}
```

**Step 2: Add registry CRUD functions**

Add after `clearSensitiveData`:

```typescript
/**
 * Get all wallet entries from registry
 */
export async function getWalletRegistry(): Promise<WalletRegistryEntry[]> {
  try {
    const raw = await SecureStore.getItemAsync(REGISTRY_KEY, STANDARD_OPTIONS)
    if (!raw) return []
    return JSON.parse(raw) as WalletRegistryEntry[]
  } catch {
    return []
  }
}

/**
 * Add wallet entry to registry (no-op if id already exists)
 */
export async function addToRegistry(entry: WalletRegistryEntry): Promise<void> {
  const registry = await getWalletRegistry()
  if (registry.some((e) => e.id === entry.id)) return
  registry.push(entry)
  await SecureStore.setItemAsync(REGISTRY_KEY, JSON.stringify(registry), STANDARD_OPTIONS)
}

/**
 * Remove wallet entry from registry by id
 */
export async function removeFromRegistry(id: string): Promise<void> {
  const registry = await getWalletRegistry()
  const filtered = registry.filter((e) => e.id !== id)
  await SecureStore.setItemAsync(REGISTRY_KEY, JSON.stringify(filtered), STANDARD_OPTIONS)
}
```

**Step 3: Add per-account key storage functions**

```typescript
/**
 * Store all keys for an account
 */
export async function storeWalletKeys(
  id: string,
  privateKeyBase58: string,
  publicKeyBase58: string,
  mnemonic?: string
): Promise<void> {
  await SecureStore.setItemAsync(walletKey(id, "privkey"), privateKeyBase58, SECURE_OPTIONS)
  await SecureStore.setItemAsync(walletKey(id, "pubkey"), publicKeyBase58, STANDARD_OPTIONS)
  if (mnemonic) {
    await SecureStore.setItemAsync(walletKey(id, "mnemonic"), mnemonic, SECURE_OPTIONS)
  }
}

/**
 * Get private key for a specific account (requires biometric)
 */
export async function getPrivateKeyForAccount(id: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(walletKey(id, "privkey"), SECURE_OPTIONS)
  } catch (error) {
    const msg = error instanceof Error ? error.message : ""
    if (msg.includes("authentication") || msg.includes("canceled")) {
      throw { code: "AUTH_FAILED", message: "Biometric authentication failed" } as KeyStorageError
    }
    return null
  }
}

/**
 * Get mnemonic for a specific account (requires biometric)
 */
export async function getMnemonicForAccount(id: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(walletKey(id, "mnemonic"), SECURE_OPTIONS)
  } catch (error) {
    const msg = error instanceof Error ? error.message : ""
    if (msg.includes("authentication") || msg.includes("canceled")) {
      throw { code: "AUTH_FAILED", message: "Biometric authentication failed" } as KeyStorageError
    }
    return null
  }
}

/**
 * Delete all keys for an account
 */
export async function deleteWalletKeys(id: string): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(walletKey(id, "privkey")),
    SecureStore.deleteItemAsync(walletKey(id, "pubkey")),
    SecureStore.deleteItemAsync(walletKey(id, "mnemonic")),
  ])
}
```

**Step 4: Add legacy migration function**

```typescript
/**
 * Migrate single-wallet legacy keys to indexed format.
 * Returns the registry entry if migration happened, null otherwise.
 */
export async function migrateFromLegacy(accountId: string): Promise<WalletRegistryEntry | null> {
  try {
    const exists = await SecureStore.getItemAsync(STORAGE_KEYS.WALLET_EXISTS, STANDARD_OPTIONS)
    if (exists !== "true") return null

    const publicKey = await SecureStore.getItemAsync(STORAGE_KEYS.PUBLIC_KEY, STANDARD_OPTIONS)
    if (!publicKey) return null

    // Read legacy keys
    let privateKey: string | null = null
    try {
      privateKey = await SecureStore.getItemAsync(STORAGE_KEYS.PRIVATE_KEY, SECURE_OPTIONS)
    } catch {
      // Biometric may fail — can't migrate private key without auth
      return null
    }
    if (!privateKey) return null

    let mnemonic: string | null = null
    try {
      mnemonic = await SecureStore.getItemAsync(STORAGE_KEYS.MNEMONIC, SECURE_OPTIONS)
    } catch {
      // Mnemonic might not exist (private key import)
    }

    // Store in new indexed format
    await storeWalletKeys(accountId, privateKey, publicKey, mnemonic ?? undefined)

    // Create registry entry
    const createdAt = await SecureStore.getItemAsync(STORAGE_KEYS.WALLET_CREATED_AT, STANDARD_OPTIONS)
    const entry: WalletRegistryEntry = {
      id: accountId,
      address: publicKey,
      providerType: "native",
      createdAt: createdAt || new Date().toISOString(),
      hasMnemonic: !!mnemonic,
    }
    await addToRegistry(entry)

    // Delete legacy keys
    await Promise.all([
      SecureStore.deleteItemAsync(STORAGE_KEYS.PRIVATE_KEY),
      SecureStore.deleteItemAsync(STORAGE_KEYS.MNEMONIC),
      SecureStore.deleteItemAsync(STORAGE_KEYS.PUBLIC_KEY),
      SecureStore.deleteItemAsync(STORAGE_KEYS.WALLET_EXISTS),
      SecureStore.deleteItemAsync(STORAGE_KEYS.WALLET_CREATED_AT),
    ])

    return entry
  } catch {
    return null
  }
}
```

**Step 5: Run tests**

Run: `cd /Users/rector/local-dev/sip-mobile && pnpm test:run tests/utils/keyStorage.test.ts`
Expected: ALL PASS

**Step 6: Run full test suite**

Run: `cd /Users/rector/local-dev/sip-mobile && pnpm test:run`
Expected: All 1268+ tests pass

**Step 7: Commit**

```bash
git add src/utils/keyStorage.ts
git commit -m "feat: indexed key storage for multi-wallet support"
```

---

### Task 3: Refactor useNativeWallet Hook

**Files:**
- Modify: `src/hooks/useNativeWallet.ts`

**Step 1: Update `init()` to use registry + migration**

Replace the `useEffect` init block (lines 134-171) with:

```typescript
useEffect(() => {
  async function init() {
    try {
      setIsLoading(true)

      const biometricAvailable = await isBiometricAvailable()
      setHasBiometrics(biometricAvailable)

      // Check for legacy single-wallet and migrate
      const walletStore = useWalletStore.getState()
      const existingAccountId = walletStore.activeAccountId
      const legacyExists = await hasWallet()

      if (legacyExists && existingAccountId) {
        // Migrate legacy keys to indexed format
        const migrated = await migrateFromLegacy(existingAccountId)
        if (migrated) {
          setWallet({ publicKey: new PublicKey(migrated.address) })
          setIsInitialized(true)
          return
        }
      }

      // Load from registry
      const registry = await getWalletRegistry()
      if (registry.length > 0 && existingAccountId) {
        const entry = registry.find((e) => e.id === existingAccountId)
        if (entry) {
          setWallet({ publicKey: new PublicKey(entry.address) })
        } else {
          // Active account not in registry, use first
          setWallet({ publicKey: new PublicKey(registry[0].address) })
          connectToWalletStore(registry[0].address)
        }
      } else if (registry.length > 0) {
        // No active account set, use first from registry
        const first = registry[0]
        setWallet({ publicKey: new PublicKey(first.address) })
        connectToWalletStore(first.address)
      }

      setIsInitialized(true)
    } catch (err) {
      console.error("Failed to initialize native wallet:", err)
      setError({ code: "STORAGE_ERROR", message: "Failed to initialize wallet" })
    } finally {
      setIsLoading(false)
    }
  }

  init()
}, [])
```

Add imports at top of file:

```typescript
import {
  hasWallet,
  storeWalletKeys,
  getPrivateKeyForAccount,
  getMnemonicForAccount,
  deleteWalletKeys,
  getWalletRegistry,
  addToRegistry,
  removeFromRegistry,
  migrateFromLegacy,
  isBiometricAvailable,
  authenticateUser,
  clearSensitiveData,
  type KeyStorageError,
} from "@/utils/keyStorage"
```

Remove old imports: `storePrivateKey`, `getPrivateKey`, `storeMnemonic`, `getMnemonic`, `storePublicKey`, `getPublicKey`, `setWalletExists`, `deleteWallet as deleteWalletStorage`.

**Step 2: Update `createWallet` — remove WALLET_EXISTS guard, use indexed storage**

Replace the `createWallet` callback (lines 176-228) — key changes:
- Remove `hasWallet()` check and `WALLET_EXISTS` throw
- Use `storeWalletKeys(accountId, ...)` instead of individual store calls
- Add to registry
- Return `accountId` in the result

```typescript
const createWallet = useCallback(
  async (wordCount: 12 | 24 = 12): Promise<{ wallet: NativeWallet; mnemonic: string; accountId: string }> => {
    try {
      setIsLoading(true)
      setError(null)

      const strength = wordCount === 24 ? 256 : 128
      const mnemonic = generateMnemonic(wordlist, strength)
      const keypair = deriveKeypairFromMnemonic(mnemonic)
      const publicKeyBase58 = keypair.publicKey.toBase58()
      const privateKeyBase58 = bs58.encode(keypair.secretKey)

      // Connect to store first to get the account ID
      connectToWalletStore(publicKeyBase58)
      const accountId = useWalletStore.getState().activeAccountId!

      // Store keys indexed by account ID
      await storeWalletKeys(accountId, privateKeyBase58, publicKeyBase58, mnemonic)

      // Add to registry
      await addToRegistry({
        id: accountId,
        address: publicKeyBase58,
        providerType: "native",
        createdAt: new Date().toISOString(),
        hasMnemonic: true,
      })

      const newWallet: NativeWallet = { publicKey: keypair.publicKey }
      setWallet(newWallet)
      clearSensitiveData(keypair.secretKey)

      return { wallet: newWallet, mnemonic, accountId }
    } catch (err) {
      const walletError = err as NativeWalletError
      setError(walletError)
      throw walletError
    } finally {
      setIsLoading(false)
    }
  },
  []
)
```

**Step 3: Update `importFromSeed` — remove WALLET_EXISTS guard**

Same pattern: remove `hasWallet()` check, use `storeWalletKeys`, add to registry.

```typescript
const importFromSeed = useCallback(
  async (mnemonic: string): Promise<NativeWallet> => {
    try {
      setIsLoading(true)
      setError(null)

      const normalizedMnemonic = mnemonic.trim().toLowerCase()
      if (!validateMnemonic(normalizedMnemonic, wordlist)) {
        throw { code: "INVALID_MNEMONIC", message: "Invalid seed phrase. Please check and try again." } as NativeWalletError
      }

      const keypair = deriveKeypairFromMnemonic(normalizedMnemonic)
      const publicKeyBase58 = keypair.publicKey.toBase58()
      const privateKeyBase58 = bs58.encode(keypair.secretKey)

      connectToWalletStore(publicKeyBase58)
      const accountId = useWalletStore.getState().activeAccountId!

      await storeWalletKeys(accountId, privateKeyBase58, publicKeyBase58, normalizedMnemonic)
      await addToRegistry({
        id: accountId,
        address: publicKeyBase58,
        providerType: "native",
        createdAt: new Date().toISOString(),
        hasMnemonic: true,
      })

      const newWallet: NativeWallet = { publicKey: keypair.publicKey }
      setWallet(newWallet)
      clearSensitiveData(keypair.secretKey)

      return newWallet
    } catch (err) {
      const walletError = err as NativeWalletError
      setError(walletError)
      throw walletError
    } finally {
      setIsLoading(false)
    }
  },
  []
)
```

**Step 4: Update `importFromPrivateKey` — same pattern**

Remove `hasWallet()` check, use `storeWalletKeys`, `addToRegistry`. Set `hasMnemonic: false`.

**Step 5: Update `signTransaction` and `signMessage` — use active account's key**

Replace `getPrivateKey()` calls with:

```typescript
const accountId = useWalletStore.getState().activeAccountId
if (!accountId) {
  throw { code: "NO_WALLET", message: "No active account" } as NativeWalletError
}
const privateKeyBase58 = await getPrivateKeyForAccount(accountId)
```

Apply this to `signTransaction`, `signMessage`, and `signAllTransactions`.

**Step 6: Update `exportMnemonic` — use active account's key**

```typescript
const exportMnemonic = useCallback(async (): Promise<string | null> => {
  try {
    setError(null)
    const accountId = useWalletStore.getState().activeAccountId
    if (!accountId) {
      throw { code: "NO_WALLET", message: "No active account" } as NativeWalletError
    }
    return await getMnemonicForAccount(accountId)
  } catch (err) {
    if ((err as KeyStorageError).code === "AUTH_FAILED") {
      setError({ code: "AUTH_FAILED", message: "Authentication failed" })
    }
    return null
  }
}, [])
```

**Step 7: Update `deleteWallet` — delete specific account's keys**

```typescript
const deleteWalletFn = useCallback(async (accountId?: string): Promise<void> => {
  try {
    setIsLoading(true)
    setError(null)

    const authenticated = await authenticateUser("Authenticate to delete wallet")
    if (!authenticated) {
      throw { code: "AUTH_FAILED", message: "Authentication required to delete wallet" } as NativeWalletError
    }

    const targetId = accountId || useWalletStore.getState().activeAccountId
    if (!targetId) return

    await deleteWalletKeys(targetId)
    await removeFromRegistry(targetId)

    // Remove from store
    useWalletStore.getState().removeAccount(targetId)

    // If no accounts left, clear wallet state
    const remaining = await getWalletRegistry()
    if (remaining.length === 0) {
      setWallet(null)
    } else {
      // Switch to first remaining account
      const next = remaining[0]
      setWallet({ publicKey: new PublicKey(next.address) })
    }
  } catch (err) {
    const walletError = err as NativeWalletError
    setError(walletError)
    throw walletError
  } finally {
    setIsLoading(false)
  }
}, [])
```

**Step 8: Run full test suite**

Run: `cd /Users/rector/local-dev/sip-mobile && pnpm test:run`
Expected: All tests pass (existing wallet tests should still work since the store API hasn't changed)

**Step 9: Commit**

```bash
git add src/hooks/useNativeWallet.ts
git commit -m "feat: refactor useNativeWallet for multi-wallet support"
```

---

### Task 4: Update Create & Import Flows

**Files:**
- Modify: `app/(auth)/create-wallet.tsx`
- Modify: `app/(auth)/import-wallet.tsx`

**Step 1: Update `create-wallet.tsx` — skip verification for additional wallets**

Add at top of `CreateWalletScreen`:

```typescript
const { accounts } = useWalletStore()
const isAdditionalWallet = accounts.length > 0
```

Add import: `import { useWalletStore } from "@/stores/wallet"`

Remove the `WALLET_EXISTS` retry block (lines 69-81) — no longer needed.

Change the "I've Written It Down" button behavior. Replace `handleContinueToVerify`:

```typescript
const handleContinueToVerify = () => {
  if (isAdditionalWallet) {
    // Skip verification for 2nd+ wallets
    setStep("complete")
  } else {
    setSelectedWords(["", "", ""])
    setVerifyError(null)
    setStep("verify")
  }
}
```

Change the button label on the display step:

```typescript
<Button fullWidth size="lg" onPress={handleContinueToVerify}>
  {isAdditionalWallet ? "I've Saved My Recovery Phrase" : "I've Written It Down"}
</Button>
```

**Step 2: Update `import-wallet.tsx` — no changes needed**

The `WALLET_EXISTS` error was thrown by `useNativeWallet.importFromSeed()` which we already fixed in Task 3. The import screen's `handleImport` will just work now.

**Step 3: Run full test suite**

Run: `cd /Users/rector/local-dev/sip-mobile && pnpm test:run`
Expected: All tests pass

**Step 4: Commit**

```bash
git add app/(auth)/create-wallet.tsx
git commit -m "feat: skip backup verification for additional wallets"
```

---

### Task 5: Account Switcher in Sidebar

**Files:**
- Modify: `src/components/Sidebar.tsx`

**Step 1: Add account picker state and account list**

Add inside the `Sidebar` function, after existing state:

```typescript
const [showAccountPicker, setShowAccountPicker] = React.useState(false)
```

**Step 2: Replace the "Switch" button and account header area**

Replace the current `<TouchableOpacity onPress={() => navigate("/settings/accounts")} ...>Switch</TouchableOpacity>` block with:

```typescript
<TouchableOpacity
  onPress={() => setShowAccountPicker(!showAccountPicker)}
  className="bg-zinc-800 px-4 py-2 rounded-full"
  accessibilityRole="button"
  accessibilityLabel="Switch account"
>
  <Text className="text-zinc-300 text-sm font-medium">
    {showAccountPicker ? "Close" : "Switch"}
  </Text>
</TouchableOpacity>
```

After the account header `</View>` (the one with `pt-16 pb-4 px-4`), add the account picker:

```typescript
{/* Account Picker */}
{showAccountPicker && (
  <View className="border-b border-zinc-800">
    {accounts.map((account) => (
      <TouchableOpacity
        key={account.id}
        onPress={() => {
          if (account.id !== activeAccountId) {
            useWalletStore.getState().setActiveAccount(account.id)
          }
          setShowAccountPicker(false)
        }}
        className="flex-row items-center px-4 py-3"
        accessibilityRole="button"
        accessibilityLabel={`Switch to ${account.nickname}`}
      >
        <AccountAvatar emoji={account.emoji || ""} size="sm" />
        <View className="flex-1 ml-3">
          <Text className="text-zinc-200 text-sm">{account.nickname}</Text>
          <Text className="text-zinc-500 text-xs">{formatAddress(account.address)}</Text>
        </View>
        {account.id === activeAccountId && (
          <ICONS.status.confirmed size={18} color={ICON_COLORS.brand} />
        )}
      </TouchableOpacity>
    ))}
    <TouchableOpacity
      onPress={() => {
        onClose()
        setTimeout(() => router.push("/(auth)/wallet-setup?addAccount=true" as any), 150)
      }}
      className="flex-row items-center px-4 py-3"
      accessibilityRole="button"
      accessibilityLabel="Add another wallet"
    >
      <View className="w-8 h-8 rounded-full bg-zinc-800 items-center justify-center">
        <Text className="text-zinc-400 text-lg">+</Text>
      </View>
      <Text className="text-zinc-400 text-sm ml-3">Add Wallet</Text>
    </TouchableOpacity>
  </View>
)}
```

Add `useWalletStore` import if not already present.

**Step 3: Run full test suite**

Run: `cd /Users/rector/local-dev/sip-mobile && pnpm test:run`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat: account switcher in sidebar"
```

---

### Task 6: Enable Manage Accounts Button

**Files:**
- Modify: `app/settings/accounts.tsx`

**Step 1: Enable the button, remove "coming soon"**

Replace the disabled button block (lines 265-279) with:

```typescript
{/* Add Account Button */}
<View className="py-6">
  <Button
    fullWidth
    variant="secondary"
    onPress={() => router.push("/(auth)/wallet-setup?addAccount=true" as any)}
  >
    + Add Another Account
  </Button>
</View>
```

**Step 2: Update `handleRemoveAccount` to use account-specific deletion**

The existing `handleRemoveAccount` calls `deleteWallet()` from `useNativeWallet`. Update it to pass the account ID:

Replace `await deleteWallet()` with `await deleteWallet(account.id)` inside the `onPress` handler (line 86-89 area).

Note: The `useNativeWallet.deleteWallet` signature was updated in Task 3 to accept an optional `accountId` parameter.

**Step 3: Run full test suite**

Run: `cd /Users/rector/local-dev/sip-mobile && pnpm test:run`
Expected: All tests pass

**Step 4: Commit**

```bash
git add app/settings/accounts.tsx
git commit -m "feat: enable multi-wallet in manage accounts"
```

---

### Task 7: Integration Test & Final Verification

**Step 1: Run full test suite**

Run: `cd /Users/rector/local-dev/sip-mobile && pnpm test:run`
Expected: All tests pass (1268+ original + new keyStorage tests)

**Step 2: Type check**

Run: `cd /Users/rector/local-dev/sip-mobile && pnpm typecheck`
Expected: No errors

**Step 3: Build APK for Seeker testing**

Run: `cd /Users/rector/local-dev/sip-mobile && eas build --platform android --profile production --local`
Expected: APK builds successfully

**Step 4: Install and test on Seeker**

```bash
adb uninstall org.sip_protocol.privacy
adb install build-*.apk
```

Manual test checklist:
- [ ] App launches, existing wallet migrated (if any)
- [ ] Home shows correct active account
- [ ] Sidebar opens, shows account info
- [ ] Sidebar "Switch" expands account picker
- [ ] Tap "+ Add Wallet" navigates to wallet-setup
- [ ] Create second wallet — seed phrase shown, no verification quiz
- [ ] Home now shows second wallet as active
- [ ] Sidebar switch shows both accounts, tap to switch
- [ ] Manage Accounts shows both, rename/remove works
- [ ] Send from wallet 1 to wallet 2's address
- [ ] Switch to wallet 2, verify received

**Step 5: Final commit (if any fixes needed)**

```bash
git commit -m "fix: integration fixes for multi-wallet"
```

**Step 6: Push and update PR**

```bash
git push
```
