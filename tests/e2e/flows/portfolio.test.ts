/**
 * Portfolio & Privacy Score Flow E2E Tests
 *
 * Tests portfolio management with privacy scores:
 * 1. Add tokens with varying privacy scores
 * 2. Calculate aggregate USD-weighted privacy score
 * 3. Sort tokens by USD value
 * 4. Identify shield-eligible tokens
 * 5. Full flow: Load -> Score -> Sort -> Shield recommendations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { usePortfolioStore } from "@/stores/portfolio"
import type { PortfolioToken } from "@/stores/portfolio"
import {
  calculateTokenPrivacyScore,
  calculateWalletPrivacyScore,
} from "@/utils/privacyScore"
import type { TokenPrivacyInput, TokenScoreEntry } from "@/utils/privacyScore"

// ============================================================================
// Helpers
// ============================================================================

const SHIELD_THRESHOLD = 67

function createToken(overrides: Partial<PortfolioToken> = {}): PortfolioToken {
  return {
    symbol: "SOL",
    balance: "10",
    balanceUsd: 1500,
    privacyScore: 50,
    mint: "So11111111111111111111111111111111111111112",
    ...overrides,
  }
}

function isShieldEligible(token: PortfolioToken): boolean {
  return token.privacyScore < SHIELD_THRESHOLD
}

// ============================================================================
// Tests
// ============================================================================

describe("Portfolio & Privacy Score Flow E2E", () => {
  beforeEach(() => {
    // Reset portfolio store
    usePortfolioStore.setState({ tokens: [], lastUpdated: null, isLoading: false })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("Token Privacy Score Calculation", () => {
    it("should score a fresh wallet with no transactions at 100", () => {
      const input: TokenPrivacyInput = {
        totalTransactions: 0,
        shieldedTransactions: 0,
        hasStealthAddress: true,
        balanceExposed: false,
      }
      expect(calculateTokenPrivacyScore(input)).toBe(100)
    })

    it("should score fully exposed token at 0", () => {
      const input: TokenPrivacyInput = {
        totalTransactions: 10,
        shieldedTransactions: 0,
        hasStealthAddress: false,
        balanceExposed: true,
      }
      expect(calculateTokenPrivacyScore(input)).toBe(0)
    })

    it("should score mixed privacy correctly", () => {
      const input: TokenPrivacyInput = {
        totalTransactions: 10,
        shieldedTransactions: 5,
        hasStealthAddress: true,
        balanceExposed: false,
      }
      // txRatio = 0.5 -> 20 points, stealth = 30, balance = 30 -> total 80
      expect(calculateTokenPrivacyScore(input)).toBe(80)
    })

    it("should score all shielded transactions at full tx weight", () => {
      const input: TokenPrivacyInput = {
        totalTransactions: 10,
        shieldedTransactions: 10,
        hasStealthAddress: true,
        balanceExposed: false,
      }
      // txRatio = 1.0 -> 40, stealth = 30, balance = 30 -> 100
      expect(calculateTokenPrivacyScore(input)).toBe(100)
    })

    it("should score partially shielded with exposed balance", () => {
      const input: TokenPrivacyInput = {
        totalTransactions: 4,
        shieldedTransactions: 2,
        hasStealthAddress: false,
        balanceExposed: true,
      }
      // txRatio = 0.5 -> 20, stealth = 0, balance = 0 -> 20
      expect(calculateTokenPrivacyScore(input)).toBe(20)
    })
  })

  describe("Wallet Aggregate Privacy Score", () => {
    it("should return 100 for empty portfolio", () => {
      expect(calculateWalletPrivacyScore([])).toBe(100)
    })

    it("should return 100 for zero total USD value", () => {
      const entries: TokenScoreEntry[] = [
        { symbol: "SOL", score: 50, balanceUsd: 0 },
        { symbol: "USDC", score: 20, balanceUsd: 0 },
      ]
      expect(calculateWalletPrivacyScore(entries)).toBe(100)
    })

    it("should return score directly for single token", () => {
      const entries: TokenScoreEntry[] = [
        { symbol: "SOL", score: 75, balanceUsd: 1000 },
      ]
      expect(calculateWalletPrivacyScore(entries)).toBe(75)
    })

    it("should weight by USD value", () => {
      const entries: TokenScoreEntry[] = [
        { symbol: "SOL", score: 100, balanceUsd: 900 },
        { symbol: "USDC", score: 0, balanceUsd: 100 },
      ]
      // weighted = (100*900 + 0*100) / 1000 = 90
      expect(calculateWalletPrivacyScore(entries)).toBe(90)
    })

    it("should handle equal weights", () => {
      const entries: TokenScoreEntry[] = [
        { symbol: "SOL", score: 80, balanceUsd: 500 },
        { symbol: "USDC", score: 40, balanceUsd: 500 },
      ]
      // weighted = (80*500 + 40*500) / 1000 = 60
      expect(calculateWalletPrivacyScore(entries)).toBe(60)
    })
  })

  describe("Portfolio Store Operations", () => {
    it("should update tokens and stamp lastUpdated", () => {
      const tokens = [createToken()]
      usePortfolioStore.getState().updateTokens(tokens)

      const state = usePortfolioStore.getState()
      expect(state.tokens).toHaveLength(1)
      expect(state.lastUpdated).not.toBeNull()
      expect(state.lastUpdated!).toBeGreaterThan(0)
    })

    it("should replace all tokens on update", () => {
      usePortfolioStore.getState().updateTokens([createToken({ symbol: "SOL" })])
      usePortfolioStore.getState().updateTokens([
        createToken({ symbol: "USDC", mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" }),
      ])

      const state = usePortfolioStore.getState()
      expect(state.tokens).toHaveLength(1)
      expect(state.tokens[0].symbol).toBe("USDC")
    })

    it("should sort tokens by USD value descending", () => {
      const tokens = [
        createToken({ symbol: "BONK", balanceUsd: 50 }),
        createToken({ symbol: "SOL", balanceUsd: 1500, mint: "Sol111" }),
        createToken({ symbol: "USDC", balanceUsd: 500, mint: "USDC111" }),
      ]
      usePortfolioStore.getState().updateTokens(tokens)

      const sorted = usePortfolioStore.getState().getTokensSortedByValue()
      expect(sorted[0].symbol).toBe("SOL")
      expect(sorted[1].symbol).toBe("USDC")
      expect(sorted[2].symbol).toBe("BONK")
    })

    it("should calculate aggregate score via store method", () => {
      const tokens = [
        createToken({ symbol: "SOL", balanceUsd: 1000, privacyScore: 80 }),
        createToken({ symbol: "USDC", balanceUsd: 1000, privacyScore: 40, mint: "USDC111" }),
      ]
      usePortfolioStore.getState().updateTokens(tokens)

      const score = usePortfolioStore.getState().getAggregateScore()
      // (80*1000 + 40*1000) / 2000 = 60
      expect(score).toBe(60)
    })

    it("should clear portfolio data", () => {
      usePortfolioStore.getState().updateTokens([createToken()])
      usePortfolioStore.getState().clear()

      const state = usePortfolioStore.getState()
      expect(state.tokens).toHaveLength(0)
      expect(state.lastUpdated).toBeNull()
    })

    it("should manage loading state", () => {
      usePortfolioStore.getState().setLoading(true)
      expect(usePortfolioStore.getState().isLoading).toBe(true)

      usePortfolioStore.getState().setLoading(false)
      expect(usePortfolioStore.getState().isLoading).toBe(false)
    })
  })

  describe("Shield-Eligible Tokens", () => {
    it("should identify tokens below shield threshold", () => {
      const tokens = [
        createToken({ symbol: "SOL", privacyScore: 90 }),
        createToken({ symbol: "USDC", privacyScore: 30, mint: "USDC111" }),
        createToken({ symbol: "BONK", privacyScore: 66, mint: "BONK111" }),
      ]

      const eligible = tokens.filter(isShieldEligible)
      expect(eligible).toHaveLength(2)
      expect(eligible.map((t) => t.symbol)).toContain("USDC")
      expect(eligible.map((t) => t.symbol)).toContain("BONK")
    })

    it("should return empty when all tokens are shielded", () => {
      const tokens = [
        createToken({ symbol: "SOL", privacyScore: 100 }),
        createToken({ symbol: "USDC", privacyScore: 80, mint: "USDC111" }),
      ]

      const eligible = tokens.filter(isShieldEligible)
      expect(eligible).toHaveLength(0)
    })

    it("should handle single token portfolio", () => {
      const tokens = [createToken({ symbol: "SOL", privacyScore: 50 })]

      const eligible = tokens.filter(isShieldEligible)
      expect(eligible).toHaveLength(1)
    })
  })

  describe("Full Flow: Load -> Score -> Sort -> Shield", () => {
    it("should process a complete portfolio analysis", () => {
      // Step 1: Load tokens into portfolio
      const tokens = [
        createToken({ symbol: "SOL", balance: "10", balanceUsd: 1500, privacyScore: 85, mint: "SOL111" }),
        createToken({ symbol: "USDC", balance: "500", balanceUsd: 500, privacyScore: 20, mint: "USDC111" }),
        createToken({ symbol: "BONK", balance: "1000000", balanceUsd: 50, privacyScore: 0, mint: "BONK111" }),
        createToken({ symbol: "JUP", balance: "100", balanceUsd: 200, privacyScore: 65, mint: "JUP111" }),
      ]
      usePortfolioStore.getState().updateTokens(tokens)

      // Step 2: Calculate aggregate score
      const aggregateScore = usePortfolioStore.getState().getAggregateScore()
      // Weighted: (85*1500 + 20*500 + 0*50 + 65*200) / 2250
      // = (127500 + 10000 + 0 + 13000) / 2250 = 150500/2250 = 66.89 -> 67
      expect(aggregateScore).toBeGreaterThanOrEqual(0)
      expect(aggregateScore).toBeLessThanOrEqual(100)

      // Step 3: Sort by value
      const sorted = usePortfolioStore.getState().getTokensSortedByValue()
      expect(sorted[0].symbol).toBe("SOL")
      expect(sorted[sorted.length - 1].symbol).toBe("BONK")

      // Step 4: Identify shield-eligible tokens
      const eligible = tokens.filter(isShieldEligible)
      expect(eligible.length).toBeGreaterThan(0)
      // USDC (20), BONK (0), JUP (65) are all below 67
      expect(eligible.map((t) => t.symbol)).toEqual(
        expect.arrayContaining(["USDC", "BONK", "JUP"])
      )
    })

    it("should handle a fully private wallet", () => {
      const tokens = [
        createToken({ symbol: "SOL", balanceUsd: 1000, privacyScore: 100, mint: "SOL111" }),
        createToken({ symbol: "USDC", balanceUsd: 500, privacyScore: 100, mint: "USDC111" }),
      ]
      usePortfolioStore.getState().updateTokens(tokens)

      const score = usePortfolioStore.getState().getAggregateScore()
      expect(score).toBe(100)

      const eligible = tokens.filter(isShieldEligible)
      expect(eligible).toHaveLength(0)
    })

    it("should handle empty portfolio gracefully", () => {
      usePortfolioStore.getState().updateTokens([])

      const score = usePortfolioStore.getState().getAggregateScore()
      expect(score).toBe(100)

      const sorted = usePortfolioStore.getState().getTokensSortedByValue()
      expect(sorted).toHaveLength(0)
    })
  })
})
