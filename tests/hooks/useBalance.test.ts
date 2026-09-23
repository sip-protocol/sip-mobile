/**
 * useBalance Hook Tests
 *
 * Tests balance logic and formatting functions without Expo dependencies.
 */

import { describe, it, expect } from "vitest"

// ============================================================================
// Type Definitions (mirror from useBalance.ts)
// ============================================================================

interface TokenBalance {
  mint: string
  symbol: string
  name: string
  balance: number
  decimals: number
  usdValue: number
}

type RpcProvider = "helius" | "quicknode" | "triton" | "public"

// ============================================================================
// Re-implemented utility functions for isolated testing
// ============================================================================

const LAMPORTS_PER_SOL = 1_000_000_000

function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL
}

function solToLamports(sol: number): number {
  return Math.floor(sol * LAMPORTS_PER_SOL)
}

function formatBalance(balance: number, decimals: number = 4): string {
  return balance.toFixed(decimals)
}

function formatUsdValue(usdValue: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(usdValue)
}

function calculateUsdValue(solAmount: number, price: number): number {
  return solAmount * price
}

function formatCompactBalance(balance: number): string {
  if (balance >= 1_000_000) {
    return `${(balance / 1_000_000).toFixed(2)}M`
  }
  if (balance >= 1_000) {
    return `${(balance / 1_000).toFixed(2)}K`
  }
  return formatBalance(balance)
}

function getProviderEndpoint(
  provider: RpcProvider,
  network: "mainnet" | "devnet"
): string {
  const endpoints: Record<RpcProvider, Record<string, string>> = {
    helius: {
      mainnet: "https://mainnet.helius-rpc.com",
      devnet: "https://devnet.helius-rpc.com",
    },
    quicknode: {
      mainnet: "https://your-quicknode-mainnet.quiknode.pro",
      devnet: "https://your-quicknode-devnet.quiknode.pro",
    },
    triton: {
      mainnet: "https://mainnet.triton.one",
      devnet: "https://devnet.triton.one",
    },
    public: {
      mainnet: "https://api.mainnet-beta.solana.com",
      devnet: "https://api.devnet.solana.com",
    },
  }
  return endpoints[provider][network]
}

function parseTokenBalance(rawBalance: number, decimals: number): number {
  return rawBalance / Math.pow(10, decimals)
}

function isValidBalance(balance: number): boolean {
  return !isNaN(balance) && isFinite(balance) && balance >= 0
}

function getTotalUsdValue(tokens: TokenBalance[]): number {
  return tokens.reduce((sum, token) => sum + token.usdValue, 0)
}

function sortTokensByValue(tokens: TokenBalance[]): TokenBalance[] {
  return [...tokens].sort((a, b) => b.usdValue - a.usdValue)
}

function filterDustTokens(
  tokens: TokenBalance[],
  minUsdValue: number = 0.01
): TokenBalance[] {
  return tokens.filter((token) => token.usdValue >= minUsdValue)
}

// ============================================================================
// Tests
// ============================================================================

describe("useBalance Utilities", () => {
  describe("lamportsToSol", () => {
    it("should convert lamports to SOL", () => {
      expect(lamportsToSol(1_000_000_000)).toBe(1)
      expect(lamportsToSol(500_000_000)).toBe(0.5)
      expect(lamportsToSol(0)).toBe(0)
    })

    it("should handle large values", () => {
      expect(lamportsToSol(1_000_000_000_000)).toBe(1000)
    })

    it("should handle small values", () => {
      expect(lamportsToSol(1)).toBe(0.000000001)
    })
  })

  describe("solToLamports", () => {
    it("should convert SOL to lamports", () => {
      expect(solToLamports(1)).toBe(1_000_000_000)
      expect(solToLamports(0.5)).toBe(500_000_000)
      expect(solToLamports(0)).toBe(0)
    })

    it("should floor fractional lamports", () => {
      expect(solToLamports(0.0000000015)).toBe(1)
    })
  })

  describe("formatBalance", () => {
    it("should format with default 4 decimals", () => {
      expect(formatBalance(1.23456789)).toBe("1.2346")
      expect(formatBalance(0)).toBe("0.0000")
    })

    it("should format with custom decimals", () => {
      expect(formatBalance(1.23456789, 2)).toBe("1.23")
      expect(formatBalance(1.23456789, 6)).toBe("1.234568")
    })
  })

  describe("formatUsdValue", () => {
    it("should format as USD currency", () => {
      expect(formatUsdValue(1234.56)).toBe("$1,234.56")
      expect(formatUsdValue(0)).toBe("$0.00")
      expect(formatUsdValue(0.5)).toBe("$0.50")
    })

    it("should handle large values", () => {
      expect(formatUsdValue(1_000_000)).toBe("$1,000,000.00")
    })
  })

  describe("calculateUsdValue", () => {
    it("should calculate USD value", () => {
      expect(calculateUsdValue(1, 185)).toBe(185)
      expect(calculateUsdValue(2, 185)).toBe(370)
      expect(calculateUsdValue(0.5, 200)).toBe(100)
    })

    it("should handle zero", () => {
      expect(calculateUsdValue(0, 185)).toBe(0)
    })
  })

  describe("formatCompactBalance", () => {
    it("should format millions", () => {
      expect(formatCompactBalance(1_500_000)).toBe("1.50M")
      expect(formatCompactBalance(10_000_000)).toBe("10.00M")
    })

    it("should format thousands", () => {
      expect(formatCompactBalance(1_500)).toBe("1.50K")
      expect(formatCompactBalance(999_999)).toBe("1000.00K")
    })

    it("should format small numbers normally", () => {
      expect(formatCompactBalance(999)).toBe("999.0000")
      expect(formatCompactBalance(1.5)).toBe("1.5000")
    })
  })

  describe("getProviderEndpoint", () => {
    it("should return correct Helius endpoints", () => {
      expect(getProviderEndpoint("helius", "mainnet")).toContain("helius")
      expect(getProviderEndpoint("helius", "devnet")).toContain("devnet")
    })

    it("should return correct public endpoints", () => {
      expect(getProviderEndpoint("public", "mainnet")).toContain("mainnet-beta")
      expect(getProviderEndpoint("public", "devnet")).toContain("devnet")
    })

    it("should have endpoints for all providers", () => {
      const providers: RpcProvider[] = ["helius", "quicknode", "triton", "public"]
      providers.forEach((provider) => {
        expect(getProviderEndpoint(provider, "mainnet")).toBeDefined()
        expect(getProviderEndpoint(provider, "devnet")).toBeDefined()
      })
    })
  })

  describe("parseTokenBalance", () => {
    it("should parse with various decimals", () => {
      expect(parseTokenBalance(1000000, 6)).toBe(1)
      expect(parseTokenBalance(100000000, 8)).toBe(1)
      expect(parseTokenBalance(1000000000, 9)).toBe(1)
    })

    it("should handle fractional results", () => {
      expect(parseTokenBalance(500000, 6)).toBe(0.5)
    })
  })

  describe("isValidBalance", () => {
    it("should return true for valid balances", () => {
      expect(isValidBalance(0)).toBe(true)
      expect(isValidBalance(100)).toBe(true)
      expect(isValidBalance(0.001)).toBe(true)
    })

    it("should return false for invalid balances", () => {
      expect(isValidBalance(NaN)).toBe(false)
      expect(isValidBalance(Infinity)).toBe(false)
      expect(isValidBalance(-1)).toBe(false)
    })
  })

  describe("getTotalUsdValue", () => {
    it("should sum all token USD values", () => {
      const tokens: TokenBalance[] = [
        { mint: "1", symbol: "SOL", name: "Solana", balance: 1, decimals: 9, usdValue: 185 },
        { mint: "2", symbol: "USDC", name: "USD Coin", balance: 100, decimals: 6, usdValue: 100 },
      ]
      expect(getTotalUsdValue(tokens)).toBe(285)
    })

    it("should return 0 for empty array", () => {
      expect(getTotalUsdValue([])).toBe(0)
    })
  })

  describe("sortTokensByValue", () => {
    it("should sort by USD value descending", () => {
      const tokens: TokenBalance[] = [
        { mint: "1", symbol: "A", name: "A", balance: 1, decimals: 9, usdValue: 50 },
        { mint: "2", symbol: "B", name: "B", balance: 1, decimals: 9, usdValue: 200 },
        { mint: "3", symbol: "C", name: "C", balance: 1, decimals: 9, usdValue: 100 },
      ]
      const sorted = sortTokensByValue(tokens)
      expect(sorted[0].usdValue).toBe(200)
      expect(sorted[1].usdValue).toBe(100)
      expect(sorted[2].usdValue).toBe(50)
    })

    it("should not mutate original array", () => {
      const tokens: TokenBalance[] = [
        { mint: "1", symbol: "A", name: "A", balance: 1, decimals: 9, usdValue: 50 },
        { mint: "2", symbol: "B", name: "B", balance: 1, decimals: 9, usdValue: 200 },
      ]
      const originalFirst = tokens[0].usdValue
      sortTokensByValue(tokens)
      expect(tokens[0].usdValue).toBe(originalFirst)
    })
  })

  describe("filterDustTokens", () => {
    it("should filter out tokens below threshold", () => {
      const tokens: TokenBalance[] = [
        { mint: "1", symbol: "A", name: "A", balance: 1, decimals: 9, usdValue: 100 },
        { mint: "2", symbol: "B", name: "B", balance: 1, decimals: 9, usdValue: 0.001 },
        { mint: "3", symbol: "C", name: "C", balance: 1, decimals: 9, usdValue: 0.02 },
      ]
      const filtered = filterDustTokens(tokens)
      expect(filtered.length).toBe(2)
      expect(filtered.some((t) => t.symbol === "B")).toBe(false)
    })

    it("should use custom threshold", () => {
      const tokens: TokenBalance[] = [
        { mint: "1", symbol: "A", name: "A", balance: 1, decimals: 9, usdValue: 10 },
        { mint: "2", symbol: "B", name: "B", balance: 1, decimals: 9, usdValue: 5 },
      ]
      const filtered = filterDustTokens(tokens, 8)
      expect(filtered.length).toBe(1)
      expect(filtered[0].symbol).toBe("A")
    })
  })
})

describe("useBalance Types", () => {
  describe("TokenBalance", () => {
    it("should have all required fields", () => {
      const token: TokenBalance = {
        mint: "So11111111111111111111111111111111111111112",
        symbol: "SOL",
        name: "Wrapped SOL",
        balance: 1.5,
        decimals: 9,
        usdValue: 277.5,
      }
      expect(token.mint).toBeDefined()
      expect(token.symbol).toBeDefined()
      expect(token.decimals).toBe(9)
    })
  })

  describe("RpcProvider", () => {
    const providers: RpcProvider[] = ["helius", "quicknode", "triton", "public"]

    it("should include all expected providers", () => {
      expect(providers).toContain("helius")
      expect(providers).toContain("quicknode")
      expect(providers).toContain("triton")
      expect(providers).toContain("public")
    })
  })
})
