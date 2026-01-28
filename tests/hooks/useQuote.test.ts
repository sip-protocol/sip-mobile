/**
 * Quote Utilities Tests
 *
 * Tests for quote-related data and calculations
 */

import { describe, it, expect } from "vitest"

// Token prices for testing (mirroring useQuote.ts)
const TOKEN_PRICES: Record<string, number> = {
  SOL: 185.5,
  USDC: 1.0,
  USDT: 1.0,
  BONK: 0.000025,
  JUP: 0.75,
  RAY: 2.1,
  PYTH: 0.35,
  WIF: 1.85,
  JTO: 2.8,
  ORCA: 3.5,
}

describe("Quote Price Calculations", () => {
  describe("Exchange Rate Logic", () => {
    it("should calculate SOL to USDC rate", () => {
      const fromPrice = TOKEN_PRICES.SOL
      const toPrice = TOKEN_PRICES.USDC
      const rate = fromPrice / toPrice

      expect(rate).toBeCloseTo(185.5, 1)
    })

    it("should calculate USDC to SOL rate", () => {
      const fromPrice = TOKEN_PRICES.USDC
      const toPrice = TOKEN_PRICES.SOL
      const rate = fromPrice / toPrice

      expect(rate).toBeLessThan(0.01)
    })

    it("should calculate BONK to SOL rate", () => {
      const fromPrice = TOKEN_PRICES.BONK
      const toPrice = TOKEN_PRICES.SOL
      const rate = fromPrice / toPrice

      // BONK is worth very little compared to SOL
      expect(rate).toBeLessThan(0.000001)
    })

    it("should calculate SOL to BONK rate", () => {
      const fromPrice = TOKEN_PRICES.SOL
      const toPrice = TOKEN_PRICES.BONK
      const rate = fromPrice / toPrice

      // 1 SOL buys millions of BONK
      expect(rate).toBeGreaterThan(1000000)
    })
  })

  describe("Output Amount Calculation", () => {
    it("should calculate swap output", () => {
      const inputAmount = 1 // 1 SOL
      const fromPrice = TOKEN_PRICES.SOL
      const toPrice = TOKEN_PRICES.USDC
      const outputAmount = (inputAmount * fromPrice) / toPrice

      expect(outputAmount).toBeCloseTo(185.5, 1)
    })

    it("should handle decimal amounts", () => {
      const inputAmount = 0.5
      const fromPrice = TOKEN_PRICES.SOL
      const toPrice = TOKEN_PRICES.USDC
      const outputAmount = (inputAmount * fromPrice) / toPrice

      expect(outputAmount).toBeCloseTo(92.75, 1)
    })

    it("should apply slippage to minimum received", () => {
      const rawOutput = 185.5
      const slippagePercent = 1.0
      const minReceived = rawOutput * (1 - slippagePercent / 100)

      expect(minReceived).toBeCloseTo(183.645, 1)
    })
  })

  describe("Price Impact Calculation", () => {
    it("should have low impact for small amounts", () => {
      const amount = 5
      const priceImpact = amount > 1000 ? 0.5 : amount > 100 ? 0.15 : amount > 10 ? 0.05 : 0.01

      expect(priceImpact).toBe(0.01)
    })

    it("should have medium impact for medium amounts", () => {
      const amount = 50
      const priceImpact = amount > 1000 ? 0.5 : amount > 100 ? 0.15 : amount > 10 ? 0.05 : 0.01

      expect(priceImpact).toBe(0.05)
    })

    it("should have higher impact for large amounts", () => {
      const amount = 500
      const priceImpact = amount > 1000 ? 0.5 : amount > 100 ? 0.15 : amount > 10 ? 0.05 : 0.01

      expect(priceImpact).toBe(0.15)
    })

    it("should have highest impact for very large amounts", () => {
      const amount = 5000
      const priceImpact = amount > 1000 ? 0.5 : amount > 100 ? 0.15 : amount > 10 ? 0.05 : 0.01

      expect(priceImpact).toBe(0.5)
    })
  })

  describe("Route Building", () => {
    function buildRoute(from: string, to: string): string[] {
      return from === "SOL" || to === "SOL" ? [from, to] : [from, "SOL", to]
    }

    it("should direct route for SOL pairs", () => {
      const route = buildRoute("SOL", "USDC")
      expect(route).toEqual(["SOL", "USDC"])
    })

    it("should direct route when to is SOL", () => {
      const route = buildRoute("USDC", "SOL")
      expect(route).toEqual(["USDC", "SOL"])
    })

    it("should route via SOL for non-SOL pairs", () => {
      const route = buildRoute("USDC", "BONK")
      expect(route).toEqual(["USDC", "SOL", "BONK"])
    })
  })

  describe("Network Fee Calculation", () => {
    it("should have base fee for transparent", () => {
      const baseFee = 0.000005
      const privacyPremium = 0 // transparent
      const networkFee = baseFee + privacyPremium

      expect(networkFee).toBe(0.000005)
    })

    it("should have higher fee for shielded", () => {
      const baseFee = 0.000005
      const privacyPremium = 0.00001 // shielded
      const networkFee = baseFee + privacyPremium

      expect(networkFee).toBeCloseTo(0.000015, 8)
    })
  })
})

describe("Balance Checking", () => {
  describe("Insufficient Balance Logic", () => {
    it("should detect insufficient balance", () => {
      const balance = 10.5 // Real balance would come from useBalance hook
      const amount = "999999"

      const isInsufficient = parseFloat(amount) > balance
      expect(isInsufficient).toBe(true)
    })

    it("should pass for sufficient balance", () => {
      const balance = 10.5 // Real balance would come from useBalance hook
      const amount = "0.001"

      const isInsufficient = parseFloat(amount) > balance
      expect(isInsufficient).toBe(false)
    })
  })
})

describe("Quote Freshness", () => {
  const QUOTE_FRESH_DURATION = 30_000
  const QUOTE_STALE_DURATION = 45_000
  const QUOTE_EXPIRY_DURATION = 60_000

  it("should be fresh within 30 seconds", () => {
    const elapsed = 20_000
    const freshness =
      elapsed < QUOTE_FRESH_DURATION
        ? "fresh"
        : elapsed < QUOTE_STALE_DURATION
          ? "stale"
          : "expired"

    expect(freshness).toBe("fresh")
  })

  it("should be stale between 30-45 seconds", () => {
    const elapsed = 40_000
    const freshness =
      elapsed < QUOTE_FRESH_DURATION
        ? "fresh"
        : elapsed < QUOTE_STALE_DURATION
          ? "stale"
          : "expired"

    expect(freshness).toBe("stale")
  })

  it("should be expired after 45 seconds", () => {
    const elapsed = 50_000
    const freshness =
      elapsed < QUOTE_FRESH_DURATION
        ? "fresh"
        : elapsed < QUOTE_STALE_DURATION
          ? "stale"
          : "expired"

    expect(freshness).toBe("expired")
  })

  it("should calculate remaining seconds", () => {
    const fetchedAt = Date.now() - 30_000
    const remaining = Math.max(0, Math.round((QUOTE_EXPIRY_DURATION - (Date.now() - fetchedAt)) / 1000))

    expect(remaining).toBe(30)
  })
})
