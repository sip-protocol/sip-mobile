/**
 * Home Screen — Featured Tokens Tests
 *
 * Tests the featured tokens data/logic for the Home dashboard:
 * - SKR and SOL presence in featured tokens list
 * - Token data integrity for featured tokens
 * - Featured tokens ordering (SOL first, SKR second)
 * - Balance formatting for display
 */

import { describe, it, expect } from "vitest"
import {
  TOKENS,
  FEATURED_TOKENS,
  getToken,
  formatTokenAmount,
} from "@/data/tokens"

// ============================================================================
// FEATURED TOKENS DATA
// ============================================================================

describe("Home Screen — Featured Tokens", () => {
  describe("FEATURED_TOKENS list", () => {
    it("should include SOL", () => {
      expect(FEATURED_TOKENS).toContain("SOL")
    })

    it("should include SKR", () => {
      expect(FEATURED_TOKENS).toContain("SKR")
    })

    it("should have SOL as first token", () => {
      expect(FEATURED_TOKENS[0]).toBe("SOL")
    })

    it("should have SKR as second token", () => {
      expect(FEATURED_TOKENS[1]).toBe("SKR")
    })

    it("should have exactly 2 featured tokens", () => {
      expect(FEATURED_TOKENS).toHaveLength(2)
    })

    it("should have all featured tokens in TOKENS registry", () => {
      for (const symbol of FEATURED_TOKENS) {
        expect(getToken(symbol), `${symbol} not in registry`).toBeDefined()
      }
    })
  })

  describe("SKR token data for display", () => {
    it("should have correct symbol", () => {
      const skr = getToken("SKR")
      expect(skr).toBeDefined()
      expect(skr!.symbol).toBe("SKR")
    })

    it("should have correct mint address", () => {
      const skr = getToken("SKR")
      expect(skr!.mint).toBe("SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3")
    })

    it("should have 6 decimals", () => {
      const skr = getToken("SKR")
      expect(skr!.decimals).toBe(6)
    })

    it("should have a logo URI for card display", () => {
      const skr = getToken("SKR")
      expect(skr!.logoUri).toBeDefined()
      expect(skr!.logoUri!.length).toBeGreaterThan(0)
    })

    it("should have name 'Seeker'", () => {
      const skr = getToken("SKR")
      expect(skr!.name).toBe("Seeker")
    })
  })

  describe("SOL token data for display", () => {
    it("should have correct symbol", () => {
      const sol = getToken("SOL")
      expect(sol).toBeDefined()
      expect(sol!.symbol).toBe("SOL")
    })

    it("should have 9 decimals", () => {
      const sol = getToken("SOL")
      expect(sol!.decimals).toBe(9)
    })

    it("should have a logo URI for card display", () => {
      const sol = getToken("SOL")
      expect(sol!.logoUri).toBeDefined()
    })
  })

  describe("Balance formatting for featured tokens", () => {
    it("should format zero balance for SKR", () => {
      expect(formatTokenAmount(0, 6)).toBe("0")
    })

    it("should format fractional SKR balance", () => {
      expect(formatTokenAmount(1234.567, 6)).toBe("1,234.567")
    })

    it("should format whole SOL balance", () => {
      expect(formatTokenAmount(12.5, 9)).toBe("12.5")
    })

    it("should format very small amounts in scientific notation", () => {
      const result = formatTokenAmount(0.00001, 6)
      expect(result).toBe("1.00e-5")
    })

    it("should handle large token balances", () => {
      const result = formatTokenAmount(1000000, 6)
      expect(result).toBe("1,000,000")
    })
  })

  describe("Featured token card data construction", () => {
    it("should build display data for each featured token", () => {
      const featuredData = FEATURED_TOKENS.map((symbol) => {
        const token = getToken(symbol)
        return {
          symbol: token!.symbol,
          name: token!.name,
          mint: token!.mint,
          decimals: token!.decimals,
          balance: 0,
          usdValue: 0,
        }
      })

      expect(featuredData).toHaveLength(2)
      expect(featuredData[0].symbol).toBe("SOL")
      expect(featuredData[1].symbol).toBe("SKR")
      expect(featuredData[1].mint).toBe(
        "SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3"
      )
    })

    it("should provide decimals needed for balance display", () => {
      const sol = getToken("SOL")
      const skr = getToken("SKR")
      expect(sol!.decimals).toBe(9)
      expect(skr!.decimals).toBe(6)
    })
  })
})
