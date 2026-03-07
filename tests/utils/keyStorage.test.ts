/**
 * Multi-Wallet Key Storage Tests
 *
 * Tests for indexed key storage functions that support multiple wallet accounts.
 * These test the NEW multi-wallet API (registry, per-account keys, legacy migration).
 * Functions under test do not exist yet — tests are expected to FAIL.
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import * as SecureStore from "expo-secure-store"
import type { WalletRegistryEntry } from "@/utils/keyStorage"
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

// ---------------------------------------------------------------------------
// In-memory SecureStore override
// ---------------------------------------------------------------------------
// The global mock (tests/setup.ts) stubs SecureStore with no-op fns.
// We override here with a real in-memory backing store so we can verify
// actual read/write/delete behavior across calls.
// ---------------------------------------------------------------------------

let store: Record<string, string> = {}

beforeEach(() => {
  store = {}

  vi.mocked(SecureStore.getItemAsync).mockImplementation(
    async (key: string) => store[key] ?? null
  )

  vi.mocked(SecureStore.setItemAsync).mockImplementation(
    async (key: string, value: string) => {
      store[key] = value
    }
  )

  vi.mocked(SecureStore.deleteItemAsync).mockImplementation(
    async (key: string) => {
      delete store[key]
    }
  )
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(overrides: Partial<WalletRegistryEntry> = {}): WalletRegistryEntry {
  return {
    id: "wallet-1",
    address: "7EqBVf6rNLbNSCy8h6YGbWk8uXUGKuK6fkR1234567",
    providerType: "native",
    createdAt: "2026-03-06T00:00:00.000Z",
    hasMnemonic: true,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Registry: getWalletRegistry
// ---------------------------------------------------------------------------

describe("getWalletRegistry", () => {
  it("should return empty array when no registry exists", async () => {
    const registry = await getWalletRegistry()
    expect(registry).toEqual([])
  })

  it("should parse stored JSON registry", async () => {
    const entries: WalletRegistryEntry[] = [
      makeEntry({ id: "w1" }),
      makeEntry({ id: "w2", address: "AnotherAddress123" }),
    ]
    store["sip_wallet_registry"] = JSON.stringify(entries)

    const registry = await getWalletRegistry()
    expect(registry).toHaveLength(2)
    expect(registry[0].id).toBe("w1")
    expect(registry[1].id).toBe("w2")
  })

  it("should return empty array for corrupted JSON", async () => {
    store["sip_wallet_registry"] = "{{not-json"

    const registry = await getWalletRegistry()
    expect(registry).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Registry: addToRegistry
// ---------------------------------------------------------------------------

describe("addToRegistry", () => {
  it("should add entry to empty registry", async () => {
    const entry = makeEntry({ id: "first" })
    await addToRegistry(entry)

    const raw = store["sip_wallet_registry"]
    expect(raw).toBeDefined()
    const parsed: WalletRegistryEntry[] = JSON.parse(raw!)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].id).toBe("first")
  })

  it("should append to existing registry", async () => {
    store["sip_wallet_registry"] = JSON.stringify([makeEntry({ id: "existing" })])

    await addToRegistry(makeEntry({ id: "new-one" }))

    const parsed: WalletRegistryEntry[] = JSON.parse(store["sip_wallet_registry"])
    expect(parsed).toHaveLength(2)
    expect(parsed.map((e) => e.id)).toEqual(["existing", "new-one"])
  })

  it("should skip duplicate entries by id", async () => {
    const entry = makeEntry({ id: "dup" })
    await addToRegistry(entry)
    await addToRegistry(entry)

    const parsed: WalletRegistryEntry[] = JSON.parse(store["sip_wallet_registry"])
    expect(parsed).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Registry: removeFromRegistry
// ---------------------------------------------------------------------------

describe("removeFromRegistry", () => {
  it("should remove entry by id", async () => {
    store["sip_wallet_registry"] = JSON.stringify([
      makeEntry({ id: "keep" }),
      makeEntry({ id: "remove-me" }),
    ])

    await removeFromRegistry("remove-me")

    const parsed: WalletRegistryEntry[] = JSON.parse(store["sip_wallet_registry"])
    expect(parsed).toHaveLength(1)
    expect(parsed[0].id).toBe("keep")
  })

  it("should handle removing non-existent id gracefully", async () => {
    store["sip_wallet_registry"] = JSON.stringify([makeEntry({ id: "only" })])

    await expect(removeFromRegistry("ghost")).resolves.toBeUndefined()

    const parsed: WalletRegistryEntry[] = JSON.parse(store["sip_wallet_registry"])
    expect(parsed).toHaveLength(1)
  })

  it("should handle empty registry gracefully", async () => {
    await expect(removeFromRegistry("anything")).resolves.toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Per-account key storage: storeWalletKeys / getPrivateKeyForAccount
// ---------------------------------------------------------------------------

describe("storeWalletKeys", () => {
  it("should store private and public keys with indexed names", async () => {
    await storeWalletKeys("acc-1", "privKeyBase58", "pubKeyBase58")

    expect(store["sip_privkey_acc-1"]).toBe("privKeyBase58")
    expect(store["sip_pubkey_acc-1"]).toBe("pubKeyBase58")
  })

  it("should store optional mnemonic when provided", async () => {
    await storeWalletKeys("acc-2", "priv", "pub", "word1 word2 word3")

    expect(store["sip_mnemonic_acc-2"]).toBe("word1 word2 word3")
  })

  it("should not store mnemonic key when omitted", async () => {
    await storeWalletKeys("acc-3", "priv", "pub")

    expect(store["sip_mnemonic_acc-3"]).toBeUndefined()
  })
})

describe("getPrivateKeyForAccount", () => {
  it("should retrieve private key by account id", async () => {
    store["sip_privkey_myid"] = "secret123"

    const key = await getPrivateKeyForAccount("myid")
    expect(key).toBe("secret123")
  })

  it("should return null for non-existent account", async () => {
    const key = await getPrivateKeyForAccount("no-such-id")
    expect(key).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Per-account key storage: getMnemonicForAccount
// ---------------------------------------------------------------------------

describe("getMnemonicForAccount", () => {
  it("should retrieve mnemonic by account id", async () => {
    store["sip_mnemonic_acc-x"] = "abandon abandon abandon"

    const mnemonic = await getMnemonicForAccount("acc-x")
    expect(mnemonic).toBe("abandon abandon abandon")
  })

  it("should return null when mnemonic was not stored", async () => {
    // Account exists (has private key) but no mnemonic
    store["sip_privkey_acc-y"] = "some-key"

    const mnemonic = await getMnemonicForAccount("acc-y")
    expect(mnemonic).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Per-account key storage: deleteWalletKeys
// ---------------------------------------------------------------------------

describe("deleteWalletKeys", () => {
  it("should delete all keys for an account", async () => {
    store["sip_privkey_del"] = "priv"
    store["sip_pubkey_del"] = "pub"
    store["sip_mnemonic_del"] = "words"

    await deleteWalletKeys("del")

    expect(store["sip_privkey_del"]).toBeUndefined()
    expect(store["sip_pubkey_del"]).toBeUndefined()
    expect(store["sip_mnemonic_del"]).toBeUndefined()
  })

  it("should not affect other accounts", async () => {
    store["sip_privkey_a"] = "key-a"
    store["sip_privkey_b"] = "key-b"

    await deleteWalletKeys("a")

    expect(store["sip_privkey_a"]).toBeUndefined()
    expect(store["sip_privkey_b"]).toBe("key-b")
  })
})

// ---------------------------------------------------------------------------
// Legacy migration: migrateFromLegacy
// ---------------------------------------------------------------------------

describe("migrateFromLegacy", () => {
  it("should migrate legacy single-wallet keys to indexed format", async () => {
    // Legacy keys (from current keyStorage.ts STORAGE_KEYS)
    store["sip_wallet_private_key"] = "legacyPriv"
    store["sip_wallet_public_key"] = "legacyPub"
    store["sip_wallet_mnemonic"] = "legacy mnemonic phrase"
    store["sip_wallet_exists"] = "true"

    const entry = await migrateFromLegacy("migrated-1")

    expect(entry).not.toBeNull()
    expect(entry!.id).toBe("migrated-1")
    expect(entry!.address).toBe("legacyPub")
    expect(entry!.hasMnemonic).toBe(true)

    // Verify new indexed keys were written
    expect(store["sip_privkey_migrated-1"]).toBe("legacyPriv")
    expect(store["sip_pubkey_migrated-1"]).toBe("legacyPub")
    expect(store["sip_mnemonic_migrated-1"]).toBe("legacy mnemonic phrase")

    // Verify entry was added to registry
    const registry: WalletRegistryEntry[] = JSON.parse(store["sip_wallet_registry"])
    expect(registry).toHaveLength(1)
    expect(registry[0].id).toBe("migrated-1")
  })

  it("should return null when no legacy wallet exists", async () => {
    const entry = await migrateFromLegacy("orphan")
    expect(entry).toBeNull()

    // No registry should be created
    expect(store["sip_wallet_registry"]).toBeUndefined()
  })

  it("should handle legacy wallet without mnemonic", async () => {
    store["sip_wallet_private_key"] = "privNoMnemonic"
    store["sip_wallet_public_key"] = "pubNoMnemonic"
    store["sip_wallet_exists"] = "true"
    // No sip_wallet_mnemonic set

    const entry = await migrateFromLegacy("no-mnemonic")

    expect(entry).not.toBeNull()
    expect(entry!.hasMnemonic).toBe(false)
    expect(store["sip_mnemonic_no-mnemonic"]).toBeUndefined()
  })
})
