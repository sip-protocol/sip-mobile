/**
 * Portfolio Store Tests
 *
 * TDD — covers all state, actions, and computed getters
 * for the privacy-first token portfolio store.
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { usePortfolioStore } from "@/stores/portfolio"
import type { PortfolioToken } from "@/stores/portfolio"

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

describe("Portfolio Store", () => {
  beforeEach(() => {
    usePortfolioStore.setState({
      tokens: [],
      lastUpdated: null,
      isLoading: false,
    })
  })

  describe("initial state", () => {
    it("should start with empty tokens", () => {
      const { tokens } = usePortfolioStore.getState()
      expect(tokens).toEqual([])
    })

    it("should start with lastUpdated null", () => {
      const { lastUpdated } = usePortfolioStore.getState()
      expect(lastUpdated).toBeNull()
    })

    it("should start with isLoading false", () => {
      const { isLoading } = usePortfolioStore.getState()
      expect(isLoading).toBe(false)
    })
  })

  describe("updateTokens", () => {
    it("should set tokens array", () => {
      const { updateTokens } = usePortfolioStore.getState()

      updateTokens([SOL_TOKEN, USDC_TOKEN])

      const { tokens } = usePortfolioStore.getState()
      expect(tokens).toHaveLength(2)
      expect(tokens[0].symbol).toBe("SOL")
      expect(tokens[1].symbol).toBe("USDC")
    })

    it("should set lastUpdated to current timestamp", () => {
      vi.useFakeTimers()
      const now = 1709337600000 // fixed timestamp
      vi.setSystemTime(now)

      const { updateTokens } = usePortfolioStore.getState()
      updateTokens([SOL_TOKEN])

      const { lastUpdated } = usePortfolioStore.getState()
      expect(lastUpdated).toBe(now)

      vi.useRealTimers()
    })

    it("should replace existing tokens completely", () => {
      const { updateTokens } = usePortfolioStore.getState()

      updateTokens([SOL_TOKEN, USDC_TOKEN])
      expect(usePortfolioStore.getState().tokens).toHaveLength(2)

      updateTokens([SKR_TOKEN])
      const { tokens } = usePortfolioStore.getState()
      expect(tokens).toHaveLength(1)
      expect(tokens[0].symbol).toBe("SKR")
    })

    it("should handle empty array", () => {
      const { updateTokens } = usePortfolioStore.getState()

      updateTokens([SOL_TOKEN])
      updateTokens([])

      const { tokens, lastUpdated } = usePortfolioStore.getState()
      expect(tokens).toEqual([])
      expect(lastUpdated).not.toBeNull()
    })
  })

  describe("getAggregateScore", () => {
    it("should return 100 for empty portfolio", () => {
      const { getAggregateScore } = usePortfolioStore.getState()
      expect(getAggregateScore()).toBe(100)
    })

    it("should return token score for single token", () => {
      const { updateTokens, getAggregateScore } = usePortfolioStore.getState()

      updateTokens([SOL_TOKEN]) // score 80

      expect(usePortfolioStore.getState().getAggregateScore()).toBe(80)
    })

    it("should return USD-weighted average for multiple tokens", () => {
      const { updateTokens } = usePortfolioStore.getState()

      // SOL: $1500 @ score 80, USDC: $500 @ score 40
      // weighted = (80*1500 + 40*500) / (1500+500) = (120000 + 20000) / 2000 = 70
      updateTokens([SOL_TOKEN, USDC_TOKEN])

      expect(usePortfolioStore.getState().getAggregateScore()).toBe(70)
    })

    it("should weight higher-value tokens more heavily", () => {
      const { updateTokens } = usePortfolioStore.getState()

      // SOL: $1500 @ 80, USDC: $500 @ 40, SKR: $200 @ 95
      // weighted = (80*1500 + 40*500 + 95*200) / (1500+500+200)
      //          = (120000 + 20000 + 19000) / 2200
      //          = 159000 / 2200 = 72.27 → 72
      updateTokens([SOL_TOKEN, USDC_TOKEN, SKR_TOKEN])

      expect(usePortfolioStore.getState().getAggregateScore()).toBe(72)
    })

    it("should return 100 when all tokens have zero USD value", () => {
      const { updateTokens } = usePortfolioStore.getState()

      updateTokens([
        { ...SOL_TOKEN, balanceUsd: 0 },
        { ...USDC_TOKEN, balanceUsd: 0 },
      ])

      expect(usePortfolioStore.getState().getAggregateScore()).toBe(100)
    })
  })

  describe("getTokensSortedByValue", () => {
    it("should return empty array when no tokens", () => {
      const { getTokensSortedByValue } = usePortfolioStore.getState()
      expect(getTokensSortedByValue()).toEqual([])
    })

    it("should return tokens sorted by balanceUsd descending", () => {
      const { updateTokens } = usePortfolioStore.getState()

      // Insert in non-sorted order
      updateTokens([USDC_TOKEN, SKR_TOKEN, SOL_TOKEN])

      const sorted = usePortfolioStore.getState().getTokensSortedByValue()
      expect(sorted[0].symbol).toBe("SOL")     // $1500
      expect(sorted[1].symbol).toBe("USDC")    // $500
      expect(sorted[2].symbol).toBe("SKR")     // $200
    })

    it("should return a copy (not mutate state)", () => {
      const { updateTokens } = usePortfolioStore.getState()

      updateTokens([USDC_TOKEN, SOL_TOKEN])

      const sorted = usePortfolioStore.getState().getTokensSortedByValue()
      const original = usePortfolioStore.getState().tokens

      // Sorted should be SOL first, but original order preserved
      expect(sorted[0].symbol).toBe("SOL")
      expect(original[0].symbol).toBe("USDC")
    })

    it("should handle tokens with equal USD value", () => {
      const { updateTokens } = usePortfolioStore.getState()

      const tokenA = { ...SOL_TOKEN, balanceUsd: 100 }
      const tokenB = { ...USDC_TOKEN, balanceUsd: 100 }

      updateTokens([tokenA, tokenB])

      const sorted = usePortfolioStore.getState().getTokensSortedByValue()
      expect(sorted).toHaveLength(2)
      // Both have same value — just verify no crash and length is correct
    })
  })

  describe("setLoading", () => {
    it("should set isLoading to true", () => {
      const { setLoading } = usePortfolioStore.getState()

      setLoading(true)

      expect(usePortfolioStore.getState().isLoading).toBe(true)
    })

    it("should set isLoading to false", () => {
      usePortfolioStore.setState({ isLoading: true })

      const { setLoading } = usePortfolioStore.getState()
      setLoading(false)

      expect(usePortfolioStore.getState().isLoading).toBe(false)
    })
  })

  describe("clear", () => {
    it("should reset tokens to empty array", () => {
      const { updateTokens, clear } = usePortfolioStore.getState()

      updateTokens([SOL_TOKEN, USDC_TOKEN])
      usePortfolioStore.getState().clear()

      expect(usePortfolioStore.getState().tokens).toEqual([])
    })

    it("should reset lastUpdated to null", () => {
      const { updateTokens } = usePortfolioStore.getState()

      updateTokens([SOL_TOKEN])
      expect(usePortfolioStore.getState().lastUpdated).not.toBeNull()

      usePortfolioStore.getState().clear()
      expect(usePortfolioStore.getState().lastUpdated).toBeNull()
    })

    it("should not affect isLoading", () => {
      usePortfolioStore.setState({ isLoading: true })

      usePortfolioStore.getState().updateTokens([SOL_TOKEN])
      usePortfolioStore.getState().clear()

      // isLoading is independent — clear only resets portfolio data
      expect(usePortfolioStore.getState().isLoading).toBe(true)
    })
  })
})
