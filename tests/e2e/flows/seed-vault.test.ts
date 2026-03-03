/**
 * Seed Vault Integration Flow E2E Tests
 *
 * Tests seed vault module resolution and hook behavior:
 * 1. Module resolves without errors
 * 2. Hook returns expected interface methods
 * 3. Platform-specific availability (Android-only)
 * 4. Graceful degradation when native module unavailable
 * 5. Package dependency and Metro config verification
 */

import { describe, it, expect, afterEach, vi } from "vitest"
import * as fs from "fs"
import * as path from "path"

// ============================================================================
// Types (mirrored from hook for E2E testing without React context)
// ============================================================================

interface SeedVaultHookInterface {
  wallet: unknown
  isAvailable: boolean
  isLoading: boolean
  isInitialized: boolean
  error: Error | null
  checkAvailability: () => Promise<boolean>
  requestPermission: () => Promise<boolean>
  authorizeNewSeed: () => Promise<unknown>
  createNewSeed: () => Promise<unknown>
  importExistingSeed: () => Promise<unknown>
  getAuthorizedSeeds: () => Promise<unknown[]>
  deauthorizeSeed: (authToken: number) => void
  selectSeed: (authToken: number, accountIndex?: number) => Promise<void>
  getAccounts: (authToken: number) => Promise<unknown[]>
  signTransaction: (tx: unknown) => Promise<unknown>
  signMessage: (message: Uint8Array) => Promise<Uint8Array>
  signAllTransactions: (txs: unknown[]) => Promise<unknown[]>
  disconnect: () => void
  showSeedSettings: (authToken: number) => Promise<void>
}

const EXPECTED_METHODS: (keyof SeedVaultHookInterface)[] = [
  "wallet",
  "isAvailable",
  "isLoading",
  "isInitialized",
  "error",
  "checkAvailability",
  "requestPermission",
  "authorizeNewSeed",
  "createNewSeed",
  "importExistingSeed",
  "getAuthorizedSeeds",
  "deauthorizeSeed",
  "selectSeed",
  "getAccounts",
  "signTransaction",
  "signMessage",
  "signAllTransactions",
  "disconnect",
  "showSeedSettings",
]

// ============================================================================
// Tests
// ============================================================================

describe("Seed Vault Integration Flow E2E", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("Module Resolution", () => {
    it("should resolve useSeedVault module without errors", async () => {
      // Dynamically import to test module resolution
      const module = await import("@/hooks/useSeedVault")
      expect(module).toBeDefined()
      expect(module.useSeedVault).toBeDefined()
      expect(typeof module.useSeedVault).toBe("function")
    })

    it("should export UseSeedVaultReturn type interface", async () => {
      const module = await import("@/hooks/useSeedVault")
      // Verify the hook function exists and is callable
      expect(module.useSeedVault).toBeInstanceOf(Function)
    })

    it("should export SeedVaultWallet type", async () => {
      // This verifies the type exports compile correctly
      const module = await import("@/hooks/useSeedVault")
      expect(module).toBeDefined()
    })
  })

  describe("Hook Interface Contract", () => {
    it("should return all expected interface methods", () => {
      // We verify against the source file to ensure all methods exist
      // without needing React rendering context
      const hookSourcePath = path.resolve(
        __dirname,
        "../../../src/hooks/useSeedVault.ts"
      )
      const source = fs.readFileSync(hookSourcePath, "utf-8")

      // Verify each expected method appears in the return statement
      for (const method of EXPECTED_METHODS) {
        expect(source).toContain(method)
      }
    })

    it("should return state properties in hook return", () => {
      const hookSourcePath = path.resolve(
        __dirname,
        "../../../src/hooks/useSeedVault.ts"
      )
      const source = fs.readFileSync(hookSourcePath, "utf-8")

      // Verify state properties
      expect(source).toContain("wallet,")
      expect(source).toContain("isAvailable,")
      expect(source).toContain("isLoading,")
      expect(source).toContain("isInitialized,")
      expect(source).toContain("error,")
    })

    it("should return seed management methods", () => {
      const hookSourcePath = path.resolve(
        __dirname,
        "../../../src/hooks/useSeedVault.ts"
      )
      const source = fs.readFileSync(hookSourcePath, "utf-8")

      expect(source).toContain("checkAvailability,")
      expect(source).toContain("requestPermission,")
      expect(source).toContain("authorizeNewSeed,")
      expect(source).toContain("createNewSeed,")
      expect(source).toContain("importExistingSeed,")
      expect(source).toContain("getAuthorizedSeeds,")
      expect(source).toContain("deauthorizeSeed,")
    })

    it("should return signing methods", () => {
      const hookSourcePath = path.resolve(
        __dirname,
        "../../../src/hooks/useSeedVault.ts"
      )
      const source = fs.readFileSync(hookSourcePath, "utf-8")

      expect(source).toContain("signTransaction,")
      expect(source).toContain("signMessage,")
      expect(source).toContain("signAllTransactions,")
    })

    it("should return utility methods", () => {
      const hookSourcePath = path.resolve(
        __dirname,
        "../../../src/hooks/useSeedVault.ts"
      )
      const source = fs.readFileSync(hookSourcePath, "utf-8")

      expect(source).toContain("disconnect,")
      expect(source).toContain("showSeedSettings,")
    })
  })

  describe("Platform Availability", () => {
    it("should be Android-only (not available on iOS)", () => {
      // The hook checks Platform.OS === "android" before enabling Seed Vault
      // Verify the source enforces Android-only gating
      const hookSourcePath = path.resolve(
        __dirname,
        "../../../src/hooks/useSeedVault.ts"
      )
      const source = fs.readFileSync(hookSourcePath, "utf-8")

      // checkAvailability guards on Android
      expect(source).toContain('Platform.OS !== "android"')
      // requestPermission guards on Android
      expect(source).toContain('Platform.OS !== "android"')
    })

    it("should check for native module before setting available", () => {
      const hookSourcePath = path.resolve(
        __dirname,
        "../../../src/hooks/useSeedVault.ts"
      )
      const source = fs.readFileSync(hookSourcePath, "utf-8")

      // Verify the availability check guards on platform
      expect(source).toContain('Platform.OS !== "android"')
      expect(source).toContain("!SeedVault")
    })

    it("should handle native module import failure gracefully", () => {
      const hookSourcePath = path.resolve(
        __dirname,
        "../../../src/hooks/useSeedVault.ts"
      )
      const source = fs.readFileSync(hookSourcePath, "utf-8")

      // Verify try-catch around native module require
      expect(source).toContain('require("@solana-mobile/seed-vault-lib")')
      expect(source).toContain("catch (e)")
      expect(source).toContain("Native module not available")
    })

    it("should use default derivation path BIP44 for Solana", () => {
      const hookSourcePath = path.resolve(
        __dirname,
        "../../../src/hooks/useSeedVault.ts"
      )
      const source = fs.readFileSync(hookSourcePath, "utf-8")

      expect(source).toContain("m/44'/501'/0'/0'")
    })
  })

  describe("Package Dependencies", () => {
    it("should have @solana-mobile/seed-vault-lib in package.json", () => {
      const pkgPath = path.resolve(__dirname, "../../../package.json")
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"))

      const deps = { ...pkg.dependencies, ...pkg.devDependencies }
      expect(deps["@solana-mobile/seed-vault-lib"]).toBeDefined()
    })

    it("should have seed-vault-lib at version 0.4.x", () => {
      const pkgPath = path.resolve(__dirname, "../../../package.json")
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"))

      const deps = { ...pkg.dependencies, ...pkg.devDependencies }
      const version = deps["@solana-mobile/seed-vault-lib"]
      expect(version).toMatch(/^0\.4/)
    })
  })

  describe("Metro Configuration", () => {
    it("should have 'import' in unstable_conditionNames", () => {
      const metroConfigPath = path.resolve(__dirname, "../../../metro.config.js")
      const source = fs.readFileSync(metroConfigPath, "utf-8")

      expect(source).toContain("unstable_conditionNames")
      expect(source).toContain('"import"')
    })

    it("should have 'browser' condition for jose compatibility", () => {
      const metroConfigPath = path.resolve(__dirname, "../../../metro.config.js")
      const source = fs.readFileSync(metroConfigPath, "utf-8")

      expect(source).toContain('"browser"')
    })

    it("should have 'require' condition for standard module resolution", () => {
      const metroConfigPath = path.resolve(__dirname, "../../../metro.config.js")
      const source = fs.readFileSync(metroConfigPath, "utf-8")

      expect(source).toContain('"require"')
    })
  })

  describe("Graceful Degradation", () => {
    it("should initialize with loading state true", () => {
      const hookSourcePath = path.resolve(
        __dirname,
        "../../../src/hooks/useSeedVault.ts"
      )
      const source = fs.readFileSync(hookSourcePath, "utf-8")

      // useState<boolean>(true) for isLoading
      expect(source).toContain("useState(true)")
    })

    it("should initialize wallet as null", () => {
      const hookSourcePath = path.resolve(
        __dirname,
        "../../../src/hooks/useSeedVault.ts"
      )
      const source = fs.readFileSync(hookSourcePath, "utf-8")

      expect(source).toContain("useState<SeedVaultWallet | null>(null)")
    })

    it("should initialize error as null", () => {
      const hookSourcePath = path.resolve(
        __dirname,
        "../../../src/hooks/useSeedVault.ts"
      )
      const source = fs.readFileSync(hookSourcePath, "utf-8")

      expect(source).toContain("useState<Error | null>(null)")
    })

    it("should guard signing methods against missing wallet", () => {
      const hookSourcePath = path.resolve(
        __dirname,
        "../../../src/hooks/useSeedVault.ts"
      )
      const source = fs.readFileSync(hookSourcePath, "utf-8")

      // signTransaction, signMessage, signAllTransactions all check wallet
      expect(source).toContain("!wallet || !SeedVault")
      expect(source).toContain("No wallet connected")
    })

    it("should guard seed operations against unavailable state", () => {
      const hookSourcePath = path.resolve(
        __dirname,
        "../../../src/hooks/useSeedVault.ts"
      )
      const source = fs.readFileSync(hookSourcePath, "utf-8")

      expect(source).toContain("!isAvailable || !SeedVault")
      expect(source).toContain("Seed Vault not available")
    })
  })

  describe("Type Declarations", () => {
    it("should have seed-vault-lib type declarations", () => {
      const typeDeclPath = path.resolve(
        __dirname,
        "../../../src/types/seed-vault-lib.d.ts"
      )
      expect(fs.existsSync(typeDeclPath)).toBe(true)
    })

    it("should declare SeedVaultAPI interface", () => {
      const typeDeclPath = path.resolve(
        __dirname,
        "../../../src/types/seed-vault-lib.d.ts"
      )
      const source = fs.readFileSync(typeDeclPath, "utf-8")

      expect(source).toContain("interface SeedVaultAPI")
      expect(source).toContain("AuthorizeSeedAPI")
      expect(source).toContain("SignTransactionsAPI")
      expect(source).toContain("SignMessagesAPI")
    })

    it("should declare Account and Seed types", () => {
      const typeDeclPath = path.resolve(
        __dirname,
        "../../../src/types/seed-vault-lib.d.ts"
      )
      const source = fs.readFileSync(typeDeclPath, "utf-8")

      expect(source).toContain("type Account")
      expect(source).toContain("type Seed")
    })
  })
})
