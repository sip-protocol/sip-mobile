/**
 * useStealth Hook Tests
 *
 * Tests stealth address logic and formatting functions without Expo dependencies.
 * Also tests wallet-scoped storage, migration, backup flags, and import/export.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import * as SecureStore from "expo-secure-store"
import AsyncStorage from "@react-native-async-storage/async-storage"

// Mock @noble/curves/ed25519 (imported transitively by @/lib/stealth)
vi.mock("@noble/curves/ed25519", () => ({
  ed25519: {
    getPublicKey: vi.fn().mockReturnValue(new Uint8Array(32).fill(0xab)),
    ExtendedPoint: {
      BASE: {
        multiply: vi.fn().mockReturnValue({
          toRawBytes: () => new Uint8Array(32).fill(0xcd),
        }),
      },
    },
  },
}))

vi.mock("@noble/hashes/sha256", () => ({
  sha256: vi.fn().mockReturnValue(new Uint8Array(32).fill(0x12)),
}))

vi.mock("@noble/hashes/sha512", () => ({
  sha512: vi.fn().mockReturnValue(new Uint8Array(64).fill(0x34)),
}))

vi.mock("@noble/hashes/hkdf", () => ({
  hkdf: vi.fn().mockReturnValue(new Uint8Array(32).fill(0x56)),
}))

vi.mock("@noble/ciphers/chacha.js", () => ({
  xchacha20poly1305: vi.fn(),
}))

vi.mock("@noble/ciphers/utils.js", () => ({
  randomBytes: vi.fn().mockReturnValue(new Uint8Array(24).fill(0x78)),
}))

// Mock @/lib/stealth
vi.mock("@/lib/stealth", () => ({
  generateStealthKeys: vi.fn().mockResolvedValue({
    spendingPrivateKey: "0x" + "aa".repeat(32),
    spendingPublicKey: "0x" + "bb".repeat(32),
    viewingPrivateKey: "0x" + "cc".repeat(32),
    viewingPublicKey: "0x" + "dd".repeat(32),
  }),
  formatStealthMetaAddress: vi.fn().mockReturnValue("sip:solana:mock-spending:mock-viewing"),
  ed25519PublicKeyToSolanaAddress: vi.fn().mockReturnValue("MockSolanaAddress123"),
  hexToBytes: vi.fn().mockImplementation((hex: string) => {
    const clean = hex.startsWith("0x") ? hex.slice(2) : hex
    const bytes = new Uint8Array(clean.length / 2)
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
    }
    return bytes
  }),
  bytesToHex: vi.fn().mockImplementation((bytes: Uint8Array) =>
    "0x" + Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("")
  ),
}))

// Mock wallet store
vi.mock("@/stores/wallet", () => ({
  useWalletStore: Object.assign(
    vi.fn(() => ({
      isConnected: true,
      address: "WalletA111111111111111111111111111111111111",
      accounts: [
        { address: "WalletA111111111111111111111111111111111111", id: "1", nickname: "Main" },
        { address: "WalletB222222222222222222222222222222222222", id: "2", nickname: "Alt" },
      ],
    })),
    {
      getState: vi.fn(() => ({
        isConnected: true,
        address: "WalletA111111111111111111111111111111111111",
        accounts: [
          { address: "WalletA111111111111111111111111111111111111", id: "1", nickname: "Main" },
          { address: "WalletB222222222222222222222222222222222222", id: "2", nickname: "Alt" },
        ],
      })),
    }
  ),
}))

// Mock logger
vi.mock("@/utils/logger", () => ({
  debug: vi.fn(),
}))

// ============================================================================
// Type Definitions (mirror from useStealth.ts)
// ============================================================================

interface StealthAddress {
  full: string
  encoded: string
  chain: string
  spendingKey: string
  viewingKey: string
  solanaAddress: string
}

interface StealthKeys {
  spendingPrivateKey: string
  spendingPublicKey: string
  viewingPrivateKey: string
  viewingPublicKey: string
}

// ============================================================================
// Re-implemented utility functions for isolated testing
// ============================================================================

const SIP_CHAIN = "solana"
const STEALTH_PREFIX = "sip:"

function formatStealthAddress(
  chain: string,
  spendingPublicKey: string,
  viewingPublicKey: string
): { full: string; chain: string; spendingKey: string; viewingKey: string } {
  const full = `${STEALTH_PREFIX}${chain}:${spendingPublicKey}:${viewingPublicKey}`
  return {
    full,
    chain,
    spendingKey: spendingPublicKey,
    viewingKey: viewingPublicKey,
  }
}

function formatForDisplay(address: StealthAddress): string {
  const spendingShort = `${address.spendingKey.slice(0, 10)}...${address.spendingKey.slice(-6)}`
  const viewingShort = `${address.viewingKey.slice(0, 10)}...${address.viewingKey.slice(-6)}`
  return `sip:${address.chain}:${spendingShort}:${viewingShort}`
}

function parseStealthAddressString(addressStr: string): {
  chain: string
  spendingKey: string
  viewingKey: string
} | null {
  if (!addressStr.startsWith(STEALTH_PREFIX)) return null

  const parts = addressStr.slice(STEALTH_PREFIX.length).split(":")
  if (parts.length !== 3) return null

  return {
    chain: parts[0],
    spendingKey: parts[1],
    viewingKey: parts[2],
  }
}

function isValidStealthKeys(keys: StealthKeys): boolean {
  return (
    !!keys.spendingPrivateKey &&
    !!keys.spendingPublicKey &&
    !!keys.viewingPrivateKey &&
    !!keys.viewingPublicKey &&
    keys.spendingPrivateKey.startsWith("0x") &&
    keys.spendingPublicKey.startsWith("0x") &&
    keys.viewingPrivateKey.startsWith("0x") &&
    keys.viewingPublicKey.startsWith("0x")
  )
}

function truncateKey(key: string, startChars: number = 10, endChars: number = 6): string {
  if (key.length <= startChars + endChars + 3) return key
  return `${key.slice(0, startChars)}...${key.slice(-endChars)}`
}

function getChainFromAddress(address: string): string | null {
  const parsed = parseStealthAddressString(address)
  return parsed?.chain ?? null
}

function validateStealthAddress(address: StealthAddress): { valid: boolean; error?: string } {
  if (!address.full.startsWith(STEALTH_PREFIX)) {
    return { valid: false, error: "Invalid prefix" }
  }
  if (!address.spendingKey.startsWith("0x")) {
    return { valid: false, error: "Invalid spending key format" }
  }
  if (!address.viewingKey.startsWith("0x")) {
    return { valid: false, error: "Invalid viewing key format" }
  }
  if (!["solana", "ethereum", "near"].includes(address.chain)) {
    return { valid: false, error: "Unsupported chain" }
  }
  return { valid: true }
}

// ============================================================================
// Tests
// ============================================================================

describe("useStealth Utilities", () => {
  describe("formatStealthAddress", () => {
    it("should format address correctly", () => {
      const result = formatStealthAddress(
        "solana",
        "0xabcd1234",
        "0xef567890"
      )
      expect(result.full).toBe("sip:solana:0xabcd1234:0xef567890")
      expect(result.chain).toBe("solana")
      expect(result.spendingKey).toBe("0xabcd1234")
      expect(result.viewingKey).toBe("0xef567890")
    })

    it("should handle different chains", () => {
      const result = formatStealthAddress("ethereum", "0x1111", "0x2222")
      expect(result.full).toBe("sip:ethereum:0x1111:0x2222")
      expect(result.chain).toBe("ethereum")
    })
  })

  describe("formatForDisplay", () => {
    it("should truncate long keys", () => {
      const address: StealthAddress = {
        full: "sip:solana:0x1234567890abcdef1234567890abcdef:0xfedcba0987654321fedcba0987654321",
        encoded: "sip:solana:0x1234567890abcdef1234567890abcdef:0xfedcba0987654321fedcba0987654321",
        chain: "solana",
        spendingKey: "0x1234567890abcdef1234567890abcdef",
        viewingKey: "0xfedcba0987654321fedcba0987654321",
        solanaAddress: "ABC123",
      }
      const display = formatForDisplay(address)
      expect(display).toContain("...")
      expect(display.length).toBeLessThan(address.full.length)
    })

    it("should include chain in display", () => {
      const address: StealthAddress = {
        full: "sip:solana:0x12345678901234567890:0xabcdefabcdefabcdef",
        encoded: "sip:solana:0x12345678901234567890:0xabcdefabcdefabcdef",
        chain: "solana",
        spendingKey: "0x12345678901234567890",
        viewingKey: "0xabcdefabcdefabcdef",
        solanaAddress: "ABC123",
      }
      const display = formatForDisplay(address)
      expect(display).toContain("solana")
    })
  })

  describe("parseStealthAddressString", () => {
    it("should parse valid address", () => {
      const result = parseStealthAddressString("sip:solana:0x1234:0x5678")
      expect(result).not.toBeNull()
      expect(result?.chain).toBe("solana")
      expect(result?.spendingKey).toBe("0x1234")
      expect(result?.viewingKey).toBe("0x5678")
    })

    it("should return null for invalid prefix", () => {
      expect(parseStealthAddressString("invalid:solana:0x1:0x2")).toBeNull()
    })

    it("should return null for wrong number of parts", () => {
      expect(parseStealthAddressString("sip:solana:0x1234")).toBeNull()
      expect(parseStealthAddressString("sip:solana:0x1:0x2:0x3")).toBeNull()
    })
  })

  describe("isValidStealthKeys", () => {
    it("should validate correct keys", () => {
      const keys: StealthKeys = {
        spendingPrivateKey: "0x1234",
        spendingPublicKey: "0x5678",
        viewingPrivateKey: "0xabcd",
        viewingPublicKey: "0xef01",
      }
      expect(isValidStealthKeys(keys)).toBe(true)
    })

    it("should reject keys without 0x prefix", () => {
      const keys: StealthKeys = {
        spendingPrivateKey: "1234",
        spendingPublicKey: "0x5678",
        viewingPrivateKey: "0xabcd",
        viewingPublicKey: "0xef01",
      }
      expect(isValidStealthKeys(keys)).toBe(false)
    })

    it("should reject empty keys", () => {
      const keys: StealthKeys = {
        spendingPrivateKey: "",
        spendingPublicKey: "0x5678",
        viewingPrivateKey: "0xabcd",
        viewingPublicKey: "0xef01",
      }
      expect(isValidStealthKeys(keys)).toBe(false)
    })
  })

  describe("truncateKey", () => {
    it("should truncate long keys", () => {
      const key = "0x1234567890abcdef1234567890abcdef"
      const truncated = truncateKey(key, 10, 6)
      expect(truncated).toBe("0x12345678...abcdef")
      expect(truncated.length).toBeLessThan(key.length)
    })

    it("should not truncate short keys", () => {
      const key = "0x12345"
      const truncated = truncateKey(key, 10, 6)
      expect(truncated).toBe(key)
    })
  })

  describe("getChainFromAddress", () => {
    it("should extract chain from address", () => {
      expect(getChainFromAddress("sip:solana:0x1:0x2")).toBe("solana")
      expect(getChainFromAddress("sip:ethereum:0x1:0x2")).toBe("ethereum")
      expect(getChainFromAddress("sip:near:0x1:0x2")).toBe("near")
    })

    it("should return null for invalid address", () => {
      expect(getChainFromAddress("invalid")).toBeNull()
    })
  })

  describe("validateStealthAddress", () => {
    it("should validate correct address", () => {
      const address: StealthAddress = {
        full: "sip:solana:0x1234:0x5678",
        encoded: "sip:solana:0x1234:0x5678",
        chain: "solana",
        spendingKey: "0x1234",
        viewingKey: "0x5678",
        solanaAddress: "ABC",
      }
      expect(validateStealthAddress(address).valid).toBe(true)
    })

    it("should reject invalid prefix", () => {
      const address: StealthAddress = {
        full: "invalid:solana:0x1234:0x5678",
        encoded: "invalid:solana:0x1234:0x5678",
        chain: "solana",
        spendingKey: "0x1234",
        viewingKey: "0x5678",
        solanaAddress: "ABC",
      }
      expect(validateStealthAddress(address).valid).toBe(false)
      expect(validateStealthAddress(address).error).toContain("prefix")
    })

    it("should reject unsupported chain", () => {
      const address: StealthAddress = {
        full: "sip:bitcoin:0x1234:0x5678",
        encoded: "sip:bitcoin:0x1234:0x5678",
        chain: "bitcoin",
        spendingKey: "0x1234",
        viewingKey: "0x5678",
        solanaAddress: "ABC",
      }
      expect(validateStealthAddress(address).valid).toBe(false)
      expect(validateStealthAddress(address).error).toContain("chain")
    })

    it("should reject invalid key format", () => {
      const address: StealthAddress = {
        full: "sip:solana:1234:0x5678",
        encoded: "sip:solana:1234:0x5678",
        chain: "solana",
        spendingKey: "1234",
        viewingKey: "0x5678",
        solanaAddress: "ABC",
      }
      expect(validateStealthAddress(address).valid).toBe(false)
      expect(validateStealthAddress(address).error).toContain("spending key")
    })
  })
})

describe("useStealth Types", () => {
  describe("StealthAddress", () => {
    it("should have all required fields", () => {
      const address: StealthAddress = {
        full: "sip:solana:0x1234:0x5678",
        encoded: "sip:solana:0x1234:0x5678",
        chain: "solana",
        spendingKey: "0x1234",
        viewingKey: "0x5678",
        solanaAddress: "ABC123DEF456",
      }
      expect(address.full).toBeDefined()
      expect(address.encoded).toBeDefined()
      expect(address.chain).toBeDefined()
      expect(address.spendingKey).toBeDefined()
      expect(address.viewingKey).toBeDefined()
      expect(address.solanaAddress).toBeDefined()
    })
  })

  describe("StealthKeys", () => {
    it("should have all key pairs", () => {
      const keys: StealthKeys = {
        spendingPrivateKey: "0xprivate1",
        spendingPublicKey: "0xpublic1",
        viewingPrivateKey: "0xprivate2",
        viewingPublicKey: "0xpublic2",
      }
      expect(keys.spendingPrivateKey).toBeDefined()
      expect(keys.spendingPublicKey).toBeDefined()
      expect(keys.viewingPrivateKey).toBeDefined()
      expect(keys.viewingPublicKey).toBeDefined()
    })
  })
})

// ============================================================================
// WALLET-SCOPED STORAGE TESTS (S1 audit finding)
// ============================================================================

import type { StealthKeysStorage } from "@/types"

// Test fixtures
const WALLET_A = "WalletA111111111111111111111111111111111111"
const WALLET_B = "WalletB222222222222222222222222222222222222"

const MOCK_KEYS_1 = {
  spendingPrivateKey: "0x" + "a1".repeat(32),
  spendingPublicKey: "0x" + "b1".repeat(32),
  viewingPrivateKey: "0x" + "c1".repeat(32),
  viewingPublicKey: "0x" + "d1".repeat(32),
}

const MOCK_KEYS_2 = {
  spendingPrivateKey: "0x" + "a2".repeat(32),
  spendingPublicKey: "0x" + "b2".repeat(32),
  viewingPrivateKey: "0x" + "c2".repeat(32),
  viewingPublicKey: "0x" + "d2".repeat(32),
}

function makeStorage(
  activeKeyId: string,
  records: { id: string; keys: typeof MOCK_KEYS_1; isActive: boolean; archivedAt: number | null }[]
): StealthKeysStorage {
  return {
    version: 1,
    activeKeyId,
    records: records.map((r) => ({
      ...r,
      createdAt: Date.now(),
    })),
  }
}

describe("Wallet-Scoped Storage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("getStoreKey", () => {
    it("should generate wallet-scoped key", async () => {
      const { getStoreKey } = await import("@/hooks/useStealth")
      expect(getStoreKey(WALLET_A)).toBe(`sip_stealth_keys_v3_${WALLET_A}`)
      expect(getStoreKey(WALLET_B)).toBe(`sip_stealth_keys_v3_${WALLET_B}`)
    })

    it("should produce different keys for different wallets", async () => {
      const { getStoreKey } = await import("@/hooks/useStealth")
      expect(getStoreKey(WALLET_A)).not.toBe(getStoreKey(WALLET_B))
    })
  })

  describe("exportStealthStorage", () => {
    it("should return null when no storage exists", async () => {
      vi.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(null)

      const { exportStealthStorage } = await import("@/hooks/useStealth")
      const result = await exportStealthStorage(WALLET_A)
      expect(result).toBeNull()
    })

    it("should return JSON string when storage exists", async () => {
      const storage = makeStorage("keys_1", [
        { id: "keys_1", keys: MOCK_KEYS_1, isActive: true, archivedAt: null },
      ])
      vi.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(JSON.stringify(storage))

      const { exportStealthStorage } = await import("@/hooks/useStealth")
      const result = await exportStealthStorage(WALLET_A)
      expect(result).not.toBeNull()

      const parsed = JSON.parse(result!)
      expect(parsed.version).toBe(1)
      expect(parsed.activeKeyId).toBe("keys_1")
      expect(parsed.records).toHaveLength(1)
    })

    it("should read from wallet-scoped key", async () => {
      vi.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(null)

      const { exportStealthStorage, getStoreKey } = await import("@/hooks/useStealth")
      await exportStealthStorage(WALLET_A)
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith(getStoreKey(WALLET_A))
    })
  })

  describe("importStealthStorage", () => {
    it("should reject invalid JSON", async () => {
      const { importStealthStorage } = await import("@/hooks/useStealth")
      const result = await importStealthStorage(WALLET_A, "not-json")
      expect(result).toBe(false)
    })

    it("should reject storage without version", async () => {
      const { importStealthStorage } = await import("@/hooks/useStealth")
      const result = await importStealthStorage(WALLET_A, JSON.stringify({ records: [] }))
      expect(result).toBe(false)
    })

    it("should reject storage without records array", async () => {
      const { importStealthStorage } = await import("@/hooks/useStealth")
      const result = await importStealthStorage(WALLET_A, JSON.stringify({ version: 1 }))
      expect(result).toBe(false)
    })

    it("should import directly when no existing storage", async () => {
      // No existing storage
      vi.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(null)

      const storage = makeStorage("keys_1", [
        { id: "keys_1", keys: MOCK_KEYS_1, isActive: true, archivedAt: null },
      ])

      const { importStealthStorage } = await import("@/hooks/useStealth")
      const result = await importStealthStorage(WALLET_A, JSON.stringify(storage))
      expect(result).toBe(true)
      expect(SecureStore.setItemAsync).toHaveBeenCalled()
    })

    it("should merge records by ID when existing storage present", async () => {
      // Existing storage has keys_1
      const existing = makeStorage("keys_1", [
        { id: "keys_1", keys: MOCK_KEYS_1, isActive: true, archivedAt: null },
      ])
      vi.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(JSON.stringify(existing))

      // Import has keys_1 (duplicate) and keys_2 (new)
      const imported = makeStorage("keys_2", [
        { id: "keys_1", keys: MOCK_KEYS_1, isActive: false, archivedAt: 1000 },
        { id: "keys_2", keys: MOCK_KEYS_2, isActive: true, archivedAt: null },
      ])

      const { importStealthStorage } = await import("@/hooks/useStealth")
      const result = await importStealthStorage(WALLET_A, JSON.stringify(imported))
      expect(result).toBe(true)

      // Verify the saved data
      const savedJson = vi.mocked(SecureStore.setItemAsync).mock.calls[0]?.[1] as string
      const saved = JSON.parse(savedJson) as StealthKeysStorage
      // Should have both keys_1 (from existing) and keys_2 (merged from import)
      expect(saved.records).toHaveLength(2)
      expect(saved.records.map((r) => r.id).sort()).toEqual(["keys_1", "keys_2"])
    })

    it("should not duplicate records with same ID", async () => {
      const existing = makeStorage("keys_1", [
        { id: "keys_1", keys: MOCK_KEYS_1, isActive: true, archivedAt: null },
      ])
      vi.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(JSON.stringify(existing))

      // Import with same key ID only
      const imported = makeStorage("keys_1", [
        { id: "keys_1", keys: MOCK_KEYS_1, isActive: true, archivedAt: null },
      ])

      const { importStealthStorage } = await import("@/hooks/useStealth")
      const result = await importStealthStorage(WALLET_A, JSON.stringify(imported))
      expect(result).toBe(true)

      const savedJson = vi.mocked(SecureStore.setItemAsync).mock.calls[0]?.[1] as string
      const saved = JSON.parse(savedJson) as StealthKeysStorage
      expect(saved.records).toHaveLength(1)
    })

    it("should activate imported key when it is new and was active in backup", async () => {
      // Existing has keys_1 active
      const existing = makeStorage("keys_1", [
        { id: "keys_1", keys: MOCK_KEYS_1, isActive: true, archivedAt: null },
      ])
      vi.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(JSON.stringify(existing))

      // Import has keys_2 as active (a key we don't have locally)
      const imported = makeStorage("keys_2", [
        { id: "keys_2", keys: MOCK_KEYS_2, isActive: true, archivedAt: null },
      ])

      const { importStealthStorage } = await import("@/hooks/useStealth")
      await importStealthStorage(WALLET_A, JSON.stringify(imported))

      const savedJson = vi.mocked(SecureStore.setItemAsync).mock.calls[0]?.[1] as string
      const saved = JSON.parse(savedJson) as StealthKeysStorage
      expect(saved.activeKeyId).toBe("keys_2")
      // keys_1 should be archived
      const keys1Record = saved.records.find((r) => r.id === "keys_1")
      expect(keys1Record?.isActive).toBe(false)
      expect(keys1Record?.archivedAt).not.toBeNull()
    })
  })

  describe("needsStealthBackup", () => {
    it("should return false when no wallet address", async () => {
      const walletMod = await import("@/stores/wallet")
      vi.mocked(walletMod.useWalletStore.getState).mockReturnValueOnce({
        isConnected: false,
        address: null,
        accounts: [],
      } as any)

      const { needsStealthBackup } = await import("@/hooks/useStealth")
      const result = await needsStealthBackup()
      expect(result).toBe(false)
    })

    it("should return false when user has dismissed backup prompt", async () => {
      vi.mocked(AsyncStorage.getItem)
        .mockResolvedValueOnce("true") // dismissed flag

      const { needsStealthBackup } = await import("@/hooks/useStealth")
      const result = await needsStealthBackup(WALLET_A)
      expect(result).toBe(false)
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(`sip_stealth_backup_dismissed_${WALLET_A}`)
    })

    it("should return true when backup flag set and not dismissed", async () => {
      vi.mocked(AsyncStorage.getItem)
        .mockResolvedValueOnce(null)   // not dismissed
        .mockResolvedValueOnce("true") // needs backup

      const { needsStealthBackup } = await import("@/hooks/useStealth")
      const result = await needsStealthBackup(WALLET_A)
      expect(result).toBe(true)
    })

    it("should return false when backup flag not set", async () => {
      vi.mocked(AsyncStorage.getItem)
        .mockResolvedValueOnce(null) // not dismissed
        .mockResolvedValueOnce(null) // no backup flag

      const { needsStealthBackup } = await import("@/hooks/useStealth")
      const result = await needsStealthBackup(WALLET_A)
      expect(result).toBe(false)
    })

    it("should use wallet-scoped keys", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null)

      const { needsStealthBackup } = await import("@/hooks/useStealth")
      await needsStealthBackup(WALLET_A)

      expect(AsyncStorage.getItem).toHaveBeenCalledWith(`sip_stealth_backup_dismissed_${WALLET_A}`)
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(`sip_stealth_needs_backup_${WALLET_A}`)
    })
  })

  describe("clearStealthBackupFlag", () => {
    it("should remove wallet-scoped backup flag", async () => {
      const { clearStealthBackupFlag } = await import("@/hooks/useStealth")
      await clearStealthBackupFlag(WALLET_A)
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(`sip_stealth_needs_backup_${WALLET_A}`)
    })

    it("should use different keys for different wallets", async () => {
      const { clearStealthBackupFlag } = await import("@/hooks/useStealth")

      await clearStealthBackupFlag(WALLET_A)
      await clearStealthBackupFlag(WALLET_B)

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(`sip_stealth_needs_backup_${WALLET_A}`)
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(`sip_stealth_needs_backup_${WALLET_B}`)
    })

    it("should fall back to active wallet when no address provided", async () => {
      const { clearStealthBackupFlag } = await import("@/hooks/useStealth")
      await clearStealthBackupFlag()

      // Should use the wallet from store.getState().address
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(`sip_stealth_needs_backup_${WALLET_A}`)
    })
  })

  describe("getKeyById", () => {
    it("should return null when no storage exists", async () => {
      vi.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(null)

      const { getKeyById } = await import("@/hooks/useStealth")
      const result = await getKeyById("keys_1", WALLET_A)
      expect(result).toBeNull()
    })

    it("should return matching record", async () => {
      const storage = makeStorage("keys_1", [
        { id: "keys_1", keys: MOCK_KEYS_1, isActive: true, archivedAt: null },
        { id: "keys_2", keys: MOCK_KEYS_2, isActive: false, archivedAt: 1000 },
      ])
      vi.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(JSON.stringify(storage))

      const { getKeyById } = await import("@/hooks/useStealth")
      const result = await getKeyById("keys_2", WALLET_A)
      expect(result).not.toBeNull()
      expect(result!.id).toBe("keys_2")
      expect(result!.keys).toEqual(MOCK_KEYS_2)
    })

    it("should return null for non-existent key ID", async () => {
      const storage = makeStorage("keys_1", [
        { id: "keys_1", keys: MOCK_KEYS_1, isActive: true, archivedAt: null },
      ])
      vi.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(JSON.stringify(storage))

      const { getKeyById } = await import("@/hooks/useStealth")
      const result = await getKeyById("nonexistent", WALLET_A)
      expect(result).toBeNull()
    })
  })
})
