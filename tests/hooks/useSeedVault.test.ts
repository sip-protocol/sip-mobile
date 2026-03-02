/**
 * Seed Vault Integration Tests
 *
 * Tests for the useSeedVault hook and its dependency resolution.
 * Issue: #70 — seed-vault-lib was never installed and its exports map
 * only defines "import" condition, incompatible with Metro's default CJS "require".
 * Fix: installed package + added "import" to Metro's unstable_conditionNames.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// ============================================================================
// MODULE RESOLUTION
// ============================================================================

describe("Seed Vault Module Resolution", () => {
  it("should have @solana-mobile/seed-vault-lib in dependencies", async () => {
    const pkg = await import("../../package.json")
    const deps = pkg.dependencies || {}
    expect(deps).toHaveProperty("@solana-mobile/seed-vault-lib")
  })

  it("should resolve seed-vault-lib package.json", () => {
    const pkg = require("@solana-mobile/seed-vault-lib/package.json")
    expect(pkg.name).toBe("@solana-mobile/seed-vault-lib")
    expect(pkg.version).toBe("0.4.0")
  })

  it("should have exports map with import condition", () => {
    const pkg = require("@solana-mobile/seed-vault-lib/package.json")
    expect(pkg.exports).toBeDefined()
    expect(pkg.exports["."]).toBeDefined()
    expect(pkg.exports["."].import).toBeDefined()
    expect(pkg.exports["."].import).toContain("index.native.js")
  })

  it("should NOT have require condition in exports (this is the root cause of #70)", () => {
    const pkg = require("@solana-mobile/seed-vault-lib/package.json")
    expect(pkg.exports["."].require).toBeUndefined()
  })
})

// ============================================================================
// METRO CONFIG
// ============================================================================

describe("Metro Config Resolution", () => {
  it("should include 'import' in unstable_conditionNames", () => {
    // Read the metro config as text to verify the fix
    const fs = require("fs")
    const path = require("path")
    const configPath = path.resolve(__dirname, "../../metro.config.js")
    const configText = fs.readFileSync(configPath, "utf-8")

    expect(configText).toContain('"import"')
    expect(configText).toContain("unstable_conditionNames")
  })

  it("should have unstable_enablePackageExports enabled", () => {
    const fs = require("fs")
    const path = require("path")
    const configPath = path.resolve(__dirname, "../../metro.config.js")
    const configText = fs.readFileSync(configPath, "utf-8")

    expect(configText).toContain("unstable_enablePackageExports = true")
  })

  it("should have all required condition names", () => {
    const fs = require("fs")
    const path = require("path")
    const configPath = path.resolve(__dirname, "../../metro.config.js")
    const configText = fs.readFileSync(configPath, "utf-8")

    // All four conditions needed for our dependency graph
    expect(configText).toContain('"browser"')
    expect(configText).toContain('"require"')
    expect(configText).toContain('"import"')
    expect(configText).toContain('"react-native"')
  })
})

// ============================================================================
// HOOK TYPES & EXPORTS
// ============================================================================

describe("useSeedVault Hook Structure", () => {
  it("should export useSeedVault function", async () => {
    const mod = await import("../../src/hooks/useSeedVault")
    expect(mod.useSeedVault).toBeDefined()
    expect(typeof mod.useSeedVault).toBe("function")
  })

  it("should export SeedVaultWallet type at runtime", async () => {
    // SeedVaultWallet is an interface, so it won't exist at runtime
    // But the hook module should still be importable
    const mod = await import("../../src/hooks/useSeedVault")
    expect(mod).toBeDefined()
  })

  it("should have conditional import with graceful fallback", () => {
    const fs = require("fs")
    const path = require("path")
    const hookPath = path.resolve(__dirname, "../../src/hooks/useSeedVault.ts")
    const hookText = fs.readFileSync(hookPath, "utf-8")

    // Verify try/catch pattern for conditional import
    expect(hookText).toContain('require("@solana-mobile/seed-vault-lib")')
    expect(hookText).toContain("catch (e)")
    expect(hookText).toContain("[SeedVault] Native module not available")
  })
})

// ============================================================================
// HOOK BEHAVIOR (non-device environment)
// ============================================================================

describe("useSeedVault Non-Device Behavior", () => {
  // Mock React hooks for non-component context
  vi.mock("react", () => ({
    useState: (initial: unknown) => [initial, vi.fn()],
    useCallback: (fn: unknown) => fn,
    useEffect: vi.fn(),
    useRef: (initial: unknown) => ({ current: initial }),
  }))

  vi.mock("react-native", () => ({
    Platform: { OS: "ios" },
    PermissionsAndroid: {
      request: vi.fn(),
      RESULTS: { GRANTED: "granted" },
    },
  }))

  vi.mock("@solana/web3.js", () => ({
    PublicKey: class MockPublicKey {
      constructor(public key: string) {}
      toBase58() { return this.key }
    },
    Transaction: class {},
    VersionedTransaction: class {},
  }))

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return isAvailable=false on non-Android devices", async () => {
    const { useSeedVault } = await import("../../src/hooks/useSeedVault")
    const result = useSeedVault()

    expect(result.isAvailable).toBe(false)
    expect(result.wallet).toBeNull()
  })

  it("should expose all required interface methods", async () => {
    const { useSeedVault } = await import("../../src/hooks/useSeedVault")
    const result = useSeedVault()

    // State
    expect(result).toHaveProperty("wallet")
    expect(result).toHaveProperty("isAvailable")
    expect(result).toHaveProperty("isLoading")
    expect(result).toHaveProperty("isInitialized")
    expect(result).toHaveProperty("error")

    // Seed management
    expect(typeof result.checkAvailability).toBe("function")
    expect(typeof result.requestPermission).toBe("function")
    expect(typeof result.authorizeNewSeed).toBe("function")
    expect(typeof result.createNewSeed).toBe("function")
    expect(typeof result.importExistingSeed).toBe("function")
    expect(typeof result.getAuthorizedSeeds).toBe("function")
    expect(typeof result.deauthorizeSeed).toBe("function")

    // Account selection
    expect(typeof result.selectSeed).toBe("function")
    expect(typeof result.getAccounts).toBe("function")

    // Signing
    expect(typeof result.signTransaction).toBe("function")
    expect(typeof result.signMessage).toBe("function")
    expect(typeof result.signAllTransactions).toBe("function")

    // Utility
    expect(typeof result.disconnect).toBe("function")
    expect(typeof result.showSeedSettings).toBe("function")
  })

  it("should start in loading state", async () => {
    const { useSeedVault } = await import("../../src/hooks/useSeedVault")
    const result = useSeedVault()

    expect(result.isLoading).toBe(true)
    expect(result.isInitialized).toBe(false)
  })

  it("should have null error initially", async () => {
    const { useSeedVault } = await import("../../src/hooks/useSeedVault")
    const result = useSeedVault()

    expect(result.error).toBeNull()
  })
})

// ============================================================================
// TYPE DECLARATIONS
// ============================================================================

describe("Type Declarations", () => {
  it("should have ambient type declarations for seed-vault-lib", () => {
    const fs = require("fs")
    const path = require("path")
    const typesPath = path.resolve(__dirname, "../../src/types/seed-vault-lib.d.ts")

    expect(fs.existsSync(typesPath)).toBe(true)

    const content = fs.readFileSync(typesPath, "utf-8")
    expect(content).toContain("@solana-mobile/seed-vault-lib")
    expect(content).toContain("SeedVaultAPI")
    expect(content).toContain("SeedVaultEvent")
    expect(content).toContain("SeedVaultContentChange")
  })
})
