/**
 * Token Utilities Tests
 */

import { describe, it, expect } from "vitest"
import {
  TOKENS,
  TOKEN_LIST,
  POPULAR_TOKENS,
  getToken,
  getTokenByMint,
  formatTokenAmount,
  parseTokenAmount,
} from "@/data/tokens"

describe("Token Data", () => {
  describe("TOKENS", () => {
    it("should have all popular tokens", () => {
      expect(TOKENS.SOL).toBeDefined()
      expect(TOKENS.USDC).toBeDefined()
      expect(TOKENS.USDT).toBeDefined()
      expect(TOKENS.BONK).toBeDefined()
      expect(TOKENS.JUP).toBeDefined()
    })

    it("should have valid token info", () => {
      const sol = TOKENS.SOL
      expect(sol.symbol).toBe("SOL")
      expect(sol.name).toBe("Solana")
      expect(sol.decimals).toBe(9)
      expect(sol.mint).toBeTruthy()
    })
  })

  describe("TOKEN_LIST", () => {
    it("should be an array of all tokens", () => {
      expect(Array.isArray(TOKEN_LIST)).toBe(true)
      expect(TOKEN_LIST.length).toBe(Object.keys(TOKENS).length)
    })
  })

  describe("POPULAR_TOKENS", () => {
    it("should contain expected symbols", () => {
      expect(POPULAR_TOKENS).toContain("SOL")
      expect(POPULAR_TOKENS).toContain("USDC")
    })
  })
})

describe("Token Helpers", () => {
  describe("getToken", () => {
    it("should return token by symbol", () => {
      const sol = getToken("SOL")
      expect(sol).toBeDefined()
      expect(sol?.symbol).toBe("SOL")
    })

    it("should be case insensitive", () => {
      expect(getToken("sol")).toBeDefined()
      expect(getToken("Sol")).toBeDefined()
      expect(getToken("SOL")).toBeDefined()
    })

    it("should return undefined for unknown symbol", () => {
      expect(getToken("UNKNOWN")).toBeUndefined()
    })
  })

  describe("getTokenByMint", () => {
    it("should return token by mint address", () => {
      const sol = getTokenByMint("So11111111111111111111111111111111111111112")
      expect(sol).toBeDefined()
      expect(sol?.symbol).toBe("SOL")
    })

    it("should return undefined for unknown mint", () => {
      expect(getTokenByMint("unknown-mint")).toBeUndefined()
    })
  })

  describe("formatTokenAmount", () => {
    it("should format whole numbers", () => {
      expect(formatTokenAmount("100", 9)).toBe("100")
      expect(formatTokenAmount(100, 9)).toBe("100")
    })

    it("should format decimal numbers", () => {
      expect(formatTokenAmount("100.1234", 9)).toBe("100.1234")
      expect(formatTokenAmount("100.12345678", 9)).toBe("100.1235") // rounds
    })

    it("should handle custom display decimals", () => {
      expect(formatTokenAmount("100.123456", 9, 2)).toBe("100.12")
    })

    it("should handle very small numbers", () => {
      const result = formatTokenAmount("0.00001", 9)
      expect(result).toContain("e")
    })

    it("should return 0 for NaN", () => {
      expect(formatTokenAmount("invalid", 9)).toBe("0")
    })

    it("should format with locale separators", () => {
      const result = formatTokenAmount("1000000", 9)
      expect(result).toBe("1,000,000")
    })
  })

  describe("parseTokenAmount", () => {
    it("should parse whole numbers", () => {
      expect(parseTokenAmount("100", 9)).toBe(100_000_000_000n)
    })

    it("should parse decimal numbers", () => {
      expect(parseTokenAmount("1.5", 9)).toBe(1_500_000_000n)
    })

    it("should handle numbers with more decimals than token", () => {
      expect(parseTokenAmount("1.123456789012", 9)).toBe(1_123_456_789n)
    })

    it("should handle numbers with fewer decimals", () => {
      expect(parseTokenAmount("1.1", 9)).toBe(1_100_000_000n)
    })

    it("should parse 6-decimal tokens correctly", () => {
      expect(parseTokenAmount("100", 6)).toBe(100_000_000n)
      expect(parseTokenAmount("1.5", 6)).toBe(1_500_000n)
    })
  })

})
