/**
 * SKR in Transaction Flows — Tests
 *
 * Verifies that SKR (Seeker) token is available and discoverable
 * across all transaction flows: send, receive, and swap.
 *
 * The send and receive screens are currently SOL-focused (no token picker),
 * but the swap screen has a token selector that reads from POPULAR_TOKENS
 * and TOKEN_LIST. SKR must appear in both the inline modal and the
 * full-screen token selector.
 */

import { describe, it, expect } from "vitest"
import {
  TOKENS,
  TOKEN_LIST,
  POPULAR_TOKENS,
  FEATURED_TOKENS,
  getToken,
  getTokenByMint,
  formatTokenAmount,
} from "@/data/tokens"

// ============================================================================
// SKR REGISTRY PRESENCE
// ============================================================================

describe("SKR in Transaction Flows", () => {
  describe("Token registry", () => {
    it("should have SKR in TOKENS record", () => {
      expect(TOKENS.SKR).toBeDefined()
      expect(TOKENS.SKR.symbol).toBe("SKR")
    })

    it("should have correct SKR mint address", () => {
      expect(TOKENS.SKR.mint).toBe("SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3")
    })

    it("should have correct SKR decimals", () => {
      expect(TOKENS.SKR.decimals).toBe(6)
    })

    it("should have SKR name as Seeker", () => {
      expect(TOKENS.SKR.name).toBe("Seeker")
    })

    it("should have SKR in TOKEN_LIST array", () => {
      const skr = TOKEN_LIST.find((t) => t.symbol === "SKR")
      expect(skr).toBeDefined()
      expect(skr!.mint).toBe("SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3")
    })

    it("should resolve SKR via getToken helper", () => {
      const skr = getToken("SKR")
      expect(skr).toBeDefined()
      expect(skr!.symbol).toBe("SKR")
      expect(skr!.mint).toBe("SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3")
    })

    it("should resolve SKR via case-insensitive getToken", () => {
      expect(getToken("skr")).toBeDefined()
      expect(getToken("Skr")).toBeDefined()
    })

    it("should resolve SKR via getTokenByMint", () => {
      const skr = getTokenByMint("SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3")
      expect(skr).toBeDefined()
      expect(skr!.symbol).toBe("SKR")
    })

    it("should have a logo URI for display", () => {
      expect(TOKENS.SKR.logoUri).toBeDefined()
      expect(TOKENS.SKR.logoUri!.length).toBeGreaterThan(0)
    })

    it("should have a coingeckoId for price lookups", () => {
      expect(TOKENS.SKR.coingeckoId).toBe("seeker")
    })
  })

  // ============================================================================
  // POPULAR TOKENS (used by swap token selector modal)
  // ============================================================================

  describe("Swap token selector — POPULAR_TOKENS", () => {
    it("should include SKR in POPULAR_TOKENS", () => {
      expect(POPULAR_TOKENS).toContain("SKR")
    })

    it("should have every POPULAR_TOKEN resolvable in TOKENS", () => {
      for (const symbol of POPULAR_TOKENS) {
        expect(TOKENS[symbol], `${symbol} missing from TOKENS`).toBeDefined()
      }
    })

    it("should include core swap tokens alongside SKR", () => {
      expect(POPULAR_TOKENS).toContain("SOL")
      expect(POPULAR_TOKENS).toContain("USDC")
      expect(POPULAR_TOKENS).toContain("SKR")
    })
  })

  // ============================================================================
  // FEATURED TOKENS (home screen, cross-referenced by swap)
  // ============================================================================

  describe("Featured tokens list", () => {
    it("should include SKR in FEATURED_TOKENS", () => {
      expect(FEATURED_TOKENS).toContain("SKR")
    })

    it("should include SOL in FEATURED_TOKENS", () => {
      expect(FEATURED_TOKENS).toContain("SOL")
    })
  })

  // ============================================================================
  // SWAP FLOW — TOKEN_LIST drives full token selector
  // ============================================================================

  describe("Full token selector — TOKEN_LIST", () => {
    it("should include SKR in TOKEN_LIST used by swap/tokens screen", () => {
      const symbols = TOKEN_LIST.map((t) => t.symbol)
      expect(symbols).toContain("SKR")
    })

    it("should have SKR searchable by name", () => {
      const query = "seeker"
      const results = TOKEN_LIST.filter(
        (t) =>
          t.symbol.toLowerCase().includes(query) ||
          t.name.toLowerCase().includes(query)
      )
      expect(results.length).toBeGreaterThanOrEqual(1)
      expect(results[0].symbol).toBe("SKR")
    })

    it("should have SKR searchable by symbol", () => {
      const query = "skr"
      const results = TOKEN_LIST.filter(
        (t) =>
          t.symbol.toLowerCase().includes(query) ||
          t.name.toLowerCase().includes(query)
      )
      expect(results.length).toBeGreaterThanOrEqual(1)
      expect(results[0].symbol).toBe("SKR")
    })

    it("should have SKR searchable by mint address", () => {
      const query = "skrbvo6gf7g"
      const results = TOKEN_LIST.filter(
        (t) => t.mint.toLowerCase().includes(query)
      )
      expect(results.length).toBe(1)
      expect(results[0].symbol).toBe("SKR")
    })
  })

  // ============================================================================
  // SEND FLOW — currently SOL-only, SKR in registry for future use
  // ============================================================================

  describe("Send flow — token availability", () => {
    it("should have SKR available when send adds token selection", () => {
      // Send screen is currently SOL-only, but SKR is in the registry
      // so when token selection is added, SKR will be available
      const skr = getToken("SKR")
      expect(skr).toBeDefined()
      expect(skr!.decimals).toBe(6)
    })

    it("should format SKR amounts correctly for send input", () => {
      expect(formatTokenAmount(100, 6)).toBe("100")
      expect(formatTokenAmount(0.5, 6)).toBe("0.5")
      expect(formatTokenAmount(1234567.89, 6)).toBe("1,234,567.89")
    })
  })

  // ============================================================================
  // RECEIVE FLOW — stealth address generation, token-agnostic
  // ============================================================================

  describe("Receive flow — token availability", () => {
    it("should have SKR mint for SPL token receive", () => {
      const skr = getToken("SKR")
      expect(skr).toBeDefined()
      expect(skr!.mint).toBe("SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3")
    })

    it("should have SKR decimals for amount display on receive", () => {
      const skr = getToken("SKR")
      expect(skr!.decimals).toBe(6)
    })
  })

  // ============================================================================
  // SWAP FLOW — inline modal iterates POPULAR_TOKENS
  // ============================================================================

  describe("Swap inline token selector", () => {
    it("should render SKR from POPULAR_TOKENS iteration", () => {
      // The swap screen inline modal does: POPULAR_TOKENS.map(symbol => TOKENS[symbol])
      const rendered = POPULAR_TOKENS.map((symbol) => TOKENS[symbol])
      const skrEntry = rendered.find((t) => t.symbol === "SKR")
      expect(skrEntry).toBeDefined()
      expect(skrEntry!.name).toBe("Seeker")
    })

    it("should allow SKR as fromToken", () => {
      const fromToken = TOKENS.SKR
      expect(fromToken).toBeDefined()
      expect(fromToken.symbol).toBe("SKR")
    })

    it("should allow SKR as toToken", () => {
      const toToken = TOKENS.SKR
      expect(toToken).toBeDefined()
      expect(toToken.symbol).toBe("SKR")
    })

    it("should allow SKR selection via params (full-screen selector)", () => {
      // The swap screen handles params: if (TOKENS[params.fromToken]) setFromToken(...)
      const paramSymbol = "SKR"
      expect(TOKENS[paramSymbol]).toBeDefined()
      expect(TOKENS[paramSymbol].symbol).toBe("SKR")
    })
  })

  // ============================================================================
  // POPULAR TOKENS — chips in full-screen selector
  // ============================================================================

  describe("Full-screen token selector — popular chips", () => {
    it("should build popular token chip list including SKR", () => {
      // tokens.tsx does: POPULAR_TOKENS.map(symbol => TOKENS[symbol]).filter(Boolean)
      const popularTokenList = POPULAR_TOKENS
        .map((symbol) => TOKENS[symbol])
        .filter((token): token is NonNullable<typeof token> => token !== undefined)

      const symbols = popularTokenList.map((t) => t.symbol)
      expect(symbols).toContain("SKR")
    })

    it("should have no undefined entries in popular token list", () => {
      const popularTokenList = POPULAR_TOKENS.map((symbol) => TOKENS[symbol])
      for (const token of popularTokenList) {
        expect(token).toBeDefined()
      }
    })
  })
})
