/**
 * Portfolio Screen Logic Tests
 *
 * Tests the portfolio screen's data logic:
 * - Aggregate score computation
 * - Token sorting by USD value
 * - Shield-eligible token identification
 * - Empty portfolio handling
 * - Loading state handling
 */

import { describe, it, expect, beforeEach } from "vitest"
import { usePortfolioStore } from "@/stores/portfolio"
import type { PortfolioToken } from "@/stores/portfolio"
import { getScoreTier } from "@/components/PrivacyScoreBadge"

// ============================================================================
// TEST DATA
// ============================================================================

const SOL_TOKEN: PortfolioToken = {
  symbol: "SOL",
  balance: "12.5",
  balanceUsd: 1500,
  privacyScore: 80,
  mint: "So11111111111111111111111111111111111111112",
}

const USDC_TOKEN: PortfolioToken = {
  symbol: "USDC",
  balance: "500",
  balanceUsd: 500,
  privacyScore: 40,
  mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
}

const SKR_TOKEN: PortfolioToken = {
  symbol: "SKR",
  balance: "10000",
  balanceUsd: 200,
  privacyScore: 95,
  mint: "SKRt4GZgVJsMuWAhMEYCFfB5YANrVXSbFDxyDJktp77",
}

const LOW_SCORE_TOKEN: PortfolioToken = {
  symbol: "BONK",
  balance: "1000000",
  balanceUsd: 50,
  privacyScore: 10,
  mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
}

// Helper: identify tokens needing shielding (score < 67)
function getTokensNeedingShield(tokens: PortfolioToken[]): PortfolioToken[] {
  return tokens.filter((t) => t.privacyScore < 67)
}

// ============================================================================
// TESTS
// ============================================================================

describe("Portfolio Screen Logic", () => {
  beforeEach(() => {
    usePortfolioStore.setState({
      tokens: [],
      lastUpdated: null,
      isLoading: false,
    })
  })

  // --------------------------------------------------------------------------
  // Aggregate score
  // --------------------------------------------------------------------------

  describe("aggregate score computation", () => {
    it("should compute aggregate score from token list", () => {
      usePortfolioStore.getState().updateTokens([SOL_TOKEN, USDC_TOKEN])

      // SOL: $1500 @ 80, USDC: $500 @ 40
      // weighted = (80*1500 + 40*500) / 2000 = 140000/2000 = 70
      const score = usePortfolioStore.getState().getAggregateScore()
      expect(score).toBe(70)
    })

    it("should return 100 for empty portfolio", () => {
      const score = usePortfolioStore.getState().getAggregateScore()
      expect(score).toBe(100)
    })

    it("should classify aggregate score into correct tier", () => {
      usePortfolioStore.getState().updateTokens([SOL_TOKEN, USDC_TOKEN])
      const score = usePortfolioStore.getState().getAggregateScore()
      expect(getScoreTier(score)).toBe("shielded") // 70 > 66
    })

    it("should classify low aggregate into exposed tier", () => {
      usePortfolioStore.getState().updateTokens([
        { ...USDC_TOKEN, privacyScore: 10, balanceUsd: 1000 },
        { ...LOW_SCORE_TOKEN, balanceUsd: 1000 },
      ])
      const score = usePortfolioStore.getState().getAggregateScore()
      // (10*1000 + 10*1000) / 2000 = 10
      expect(getScoreTier(score)).toBe("exposed")
    })
  })

  // --------------------------------------------------------------------------
  // Token sorting
  // --------------------------------------------------------------------------

  describe("token sorting by USD value", () => {
    it("should sort tokens by USD value descending", () => {
      usePortfolioStore.getState().updateTokens([
        LOW_SCORE_TOKEN, // $50
        USDC_TOKEN,      // $500
        SKR_TOKEN,       // $200
        SOL_TOKEN,       // $1500
      ])

      const sorted = usePortfolioStore.getState().getTokensSortedByValue()
      expect(sorted[0].symbol).toBe("SOL")
      expect(sorted[1].symbol).toBe("USDC")
      expect(sorted[2].symbol).toBe("SKR")
      expect(sorted[3].symbol).toBe("BONK")
    })

    it("should return empty array for empty portfolio", () => {
      const sorted = usePortfolioStore.getState().getTokensSortedByValue()
      expect(sorted).toEqual([])
    })

    it("should handle single token", () => {
      usePortfolioStore.getState().updateTokens([SKR_TOKEN])

      const sorted = usePortfolioStore.getState().getTokensSortedByValue()
      expect(sorted).toHaveLength(1)
      expect(sorted[0].symbol).toBe("SKR")
    })
  })

  // --------------------------------------------------------------------------
  // Shield-eligible tokens
  // --------------------------------------------------------------------------

  describe("tokens needing shielding", () => {
    it("should identify tokens needing shielding (score < 67)", () => {
      const tokens = [SOL_TOKEN, USDC_TOKEN, SKR_TOKEN, LOW_SCORE_TOKEN]
      const needShield = getTokensNeedingShield(tokens)

      // USDC (40) and BONK (10) need shielding
      expect(needShield).toHaveLength(2)
      expect(needShield.map((t) => t.symbol)).toContain("USDC")
      expect(needShield.map((t) => t.symbol)).toContain("BONK")
    })

    it("should return empty when all tokens are shielded", () => {
      const tokens = [SOL_TOKEN, SKR_TOKEN] // both >= 67
      const needShield = getTokensNeedingShield(tokens)
      expect(needShield).toHaveLength(0)
    })

    it("should return all tokens when none are shielded", () => {
      const tokens = [USDC_TOKEN, LOW_SCORE_TOKEN] // both < 67
      const needShield = getTokensNeedingShield(tokens)
      expect(needShield).toHaveLength(2)
    })

    it("should treat score 66 as needing shielding", () => {
      const token = { ...SOL_TOKEN, privacyScore: 66 }
      const needShield = getTokensNeedingShield([token])
      expect(needShield).toHaveLength(1)
    })

    it("should treat score 67 as not needing shielding", () => {
      const token = { ...SOL_TOKEN, privacyScore: 67 }
      const needShield = getTokensNeedingShield([token])
      expect(needShield).toHaveLength(0)
    })

    it("should handle empty token list", () => {
      const needShield = getTokensNeedingShield([])
      expect(needShield).toHaveLength(0)
    })
  })

  // --------------------------------------------------------------------------
  // Loading state
  // --------------------------------------------------------------------------

  describe("loading state", () => {
    it("should handle loading state", () => {
      usePortfolioStore.getState().setLoading(true)
      expect(usePortfolioStore.getState().isLoading).toBe(true)
    })

    it("should clear loading state", () => {
      usePortfolioStore.getState().setLoading(true)
      usePortfolioStore.getState().setLoading(false)
      expect(usePortfolioStore.getState().isLoading).toBe(false)
    })

    it("should have empty tokens while loading", () => {
      usePortfolioStore.getState().setLoading(true)
      expect(usePortfolioStore.getState().tokens).toEqual([])
    })
  })
})
