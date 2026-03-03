/**
 * Token Registry Tests
 *
 * Verifies token data integrity, especially SKR (Seeker) token
 * required for MONOLITH hackathon bonus track.
 */

import { describe, it, expect } from "vitest"
import { TOKENS, POPULAR_TOKENS, getToken, getTokenByMint } from "@/data/tokens"

describe("Token Registry", () => {
  describe("SKR (Seeker) token", () => {
    it("should exist in TOKENS registry", () => {
      expect(TOKENS.SKR).toBeDefined()
    })

    it("should have correct symbol", () => {
      expect(TOKENS.SKR.symbol).toBe("SKR")
    })

    it("should have correct name", () => {
      expect(TOKENS.SKR.name).toBe("Seeker")
    })

    it("should have correct mint address", () => {
      expect(TOKENS.SKR.mint).toBe(
        "SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3"
      )
    })

    it("should have correct decimals", () => {
      expect(TOKENS.SKR.decimals).toBe(6)
    })

    it("should have coingeckoId set to seeker", () => {
      expect(TOKENS.SKR.coingeckoId).toBe("seeker")
    })

    it("should have a logo URI", () => {
      expect(TOKENS.SKR.logoUri).toBeDefined()
      expect(TOKENS.SKR.logoUri).toContain("seeker")
    })

    it("should be included in POPULAR_TOKENS", () => {
      expect(POPULAR_TOKENS).toContain("SKR")
    })
  })

  describe("getToken", () => {
    it("should return SKR for 'SKR'", () => {
      const token = getToken("SKR")
      expect(token).toBeDefined()
      expect(token!.symbol).toBe("SKR")
    })

    it("should return SKR case-insensitively", () => {
      const token = getToken("skr")
      expect(token).toBeDefined()
      expect(token!.mint).toBe("SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3")
    })
  })

  describe("getTokenByMint", () => {
    it("should return SKR for its mint address", () => {
      const token = getTokenByMint("SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3")
      expect(token).toBeDefined()
      expect(token!.symbol).toBe("SKR")
      expect(token!.name).toBe("Seeker")
    })
  })

  describe("registry integrity", () => {
    it("should have at least 11 tokens", () => {
      expect(Object.keys(TOKENS).length).toBeGreaterThanOrEqual(11)
    })

    it("should have all tokens with required fields", () => {
      for (const [key, token] of Object.entries(TOKENS)) {
        expect(token.symbol, `${key} missing symbol`).toBeTruthy()
        expect(token.name, `${key} missing name`).toBeTruthy()
        expect(token.mint, `${key} missing mint`).toBeTruthy()
        expect(token.decimals, `${key} missing decimals`).toBeGreaterThanOrEqual(0)
      }
    })
  })
})
