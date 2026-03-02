/**
 * SKR Token Integration Flow E2E Tests
 *
 * Tests SKR (Seeker) token across all app flows:
 * 1. Token registry presence and metadata
 * 2. Featured and popular token lists
 * 3. Token lookup by symbol and mint
 * 4. Decimal precision and formatting
 * 5. Full flow: Find -> Format -> Prepare send/swap params
 */

import { describe, it, expect, afterEach, vi } from "vitest"
import {
  TOKENS,
  TOKEN_LIST,
  POPULAR_TOKENS,
  FEATURED_TOKENS,
  getToken,
  getTokenByMint,
  formatTokenAmount,
  parseTokenAmount,
} from "@/data/tokens"

// ============================================================================
// Constants
// ============================================================================

const SKR_MINT = "SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3"
const SKR_DECIMALS = 6
const SOL_MINT = "So11111111111111111111111111111111111111112"
const SOL_DECIMALS = 9

// ============================================================================
// Tests
// ============================================================================

describe("SKR Token Integration Flow E2E", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("Token Registry Presence", () => {
    it("should have SKR in TOKENS registry", () => {
      expect(TOKENS.SKR).toBeDefined()
    })

    it("should have correct SKR metadata", () => {
      const skr = TOKENS.SKR
      expect(skr.symbol).toBe("SKR")
      expect(skr.name).toBe("Seeker")
      expect(skr.mint).toBe(SKR_MINT)
      expect(skr.decimals).toBe(SKR_DECIMALS)
      expect(skr.coingeckoId).toBe("seeker")
    })

    it("should have SKR in TOKEN_LIST array", () => {
      const found = TOKEN_LIST.find((t) => t.symbol === "SKR")
      expect(found).toBeDefined()
      expect(found!.mint).toBe(SKR_MINT)
    })

    it("should have logoUri defined for SKR", () => {
      expect(TOKENS.SKR.logoUri).toBeDefined()
      expect(TOKENS.SKR.logoUri!.length).toBeGreaterThan(0)
    })
  })

  describe("Featured and Popular Token Lists", () => {
    it("should include SKR in FEATURED_TOKENS", () => {
      expect(FEATURED_TOKENS).toContain("SKR")
    })

    it("should include SKR in POPULAR_TOKENS", () => {
      expect(POPULAR_TOKENS).toContain("SKR")
    })

    it("should include SOL in FEATURED_TOKENS alongside SKR", () => {
      expect(FEATURED_TOKENS).toContain("SOL")
      expect(FEATURED_TOKENS).toContain("SKR")
    })

    it("should have FEATURED_TOKENS as subset of POPULAR_TOKENS", () => {
      for (const featured of FEATURED_TOKENS) {
        expect(POPULAR_TOKENS).toContain(featured)
      }
    })
  })

  describe("Token Lookup", () => {
    it("should find SKR by symbol (exact case)", () => {
      const token = getToken("SKR")
      expect(token).toBeDefined()
      expect(token!.symbol).toBe("SKR")
    })

    it("should find SKR by symbol (lowercase)", () => {
      const token = getToken("skr")
      expect(token).toBeDefined()
      expect(token!.symbol).toBe("SKR")
    })

    it("should find SKR by mint address", () => {
      const token = getTokenByMint(SKR_MINT)
      expect(token).toBeDefined()
      expect(token!.symbol).toBe("SKR")
    })

    it("should return undefined for non-existent token", () => {
      const token = getToken("FAKECOIN")
      expect(token).toBeUndefined()
    })

    it("should return undefined for non-existent mint", () => {
      const token = getTokenByMint("FakeMint11111111111111111111111111111111111")
      expect(token).toBeUndefined()
    })
  })

  describe("Decimal Precision", () => {
    it("should have SKR at 6 decimals (not 9 like SOL)", () => {
      expect(TOKENS.SKR.decimals).toBe(6)
      expect(TOKENS.SOL.decimals).toBe(9)
      expect(TOKENS.SKR.decimals).not.toBe(TOKENS.SOL.decimals)
    })

    it("should have same decimals as USDC", () => {
      expect(TOKENS.SKR.decimals).toBe(TOKENS.USDC.decimals)
    })
  })

  describe("Token Amount Formatting", () => {
    it("should format SKR amount with 6 decimal precision", () => {
      const formatted = formatTokenAmount("1234.567890", SKR_DECIMALS)
      // Default displayDecimals is 4
      expect(formatted).toBeDefined()
      expect(formatted).not.toBe("0")
    })

    it("should format zero SKR balance", () => {
      const formatted = formatTokenAmount("0", SKR_DECIMALS)
      expect(formatted).toBe("0")
    })

    it("should format very small SKR amount in scientific notation", () => {
      const formatted = formatTokenAmount("0.00001", SKR_DECIMALS)
      // Very small numbers use exponential
      expect(formatted).toContain("e")
    })

    it("should format large SKR balance", () => {
      const formatted = formatTokenAmount("1000000", SKR_DECIMALS)
      expect(formatted).toContain("1,000,000") // locale formatting
    })

    it("should handle NaN input gracefully", () => {
      const formatted = formatTokenAmount("not-a-number", SKR_DECIMALS)
      expect(formatted).toBe("0")
    })
  })

  describe("Token Amount Parsing", () => {
    it("should parse SKR amount to raw lamports with 6 decimals", () => {
      const raw = parseTokenAmount("1.5", SKR_DECIMALS)
      // 1.5 * 10^6 = 1500000
      expect(raw).toBe(1500000n)
    })

    it("should parse whole number SKR amount", () => {
      const raw = parseTokenAmount("100", SKR_DECIMALS)
      expect(raw).toBe(100000000n)
    })

    it("should parse SOL amount with 9 decimals", () => {
      const raw = parseTokenAmount("1.5", SOL_DECIMALS)
      // 1.5 * 10^9 = 1500000000
      expect(raw).toBe(1500000000n)
    })

    it("should handle max precision for SKR (6 decimal places)", () => {
      const raw = parseTokenAmount("1.123456", SKR_DECIMALS)
      expect(raw).toBe(1123456n)
    })

    it("should truncate excess decimals beyond token precision", () => {
      const raw = parseTokenAmount("1.1234567890", SKR_DECIMALS)
      // Should only use first 6 decimal places
      expect(raw).toBe(1123456n)
    })
  })

  describe("SKR in Send/Swap Flows", () => {
    it("should prepare send params with SKR token", () => {
      const skr = getToken("SKR")
      expect(skr).toBeDefined()

      const sendParams = {
        token: skr!.symbol,
        mint: skr!.mint,
        decimals: skr!.decimals,
        amount: "50",
        recipient: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      }

      expect(sendParams.mint).toBe(SKR_MINT)
      expect(sendParams.decimals).toBe(6)

      // Verify raw amount conversion
      const rawAmount = parseTokenAmount(sendParams.amount, sendParams.decimals)
      expect(rawAmount).toBe(50000000n)
    })

    it("should prepare swap params: SOL -> SKR", () => {
      const sol = getToken("SOL")
      const skr = getToken("SKR")
      expect(sol).toBeDefined()
      expect(skr).toBeDefined()

      const swapParams = {
        fromToken: { symbol: sol!.symbol, mint: sol!.mint, decimals: sol!.decimals },
        toToken: { symbol: skr!.symbol, mint: skr!.mint, decimals: skr!.decimals },
        amount: "1.0",
        slippageBps: 50,
      }

      expect(swapParams.fromToken.mint).toBe(SOL_MINT)
      expect(swapParams.toToken.mint).toBe(SKR_MINT)
      expect(swapParams.fromToken.decimals).not.toBe(swapParams.toToken.decimals)
    })
  })

  describe("Full Flow: Find SKR -> Format Balance -> Prepare Send", () => {
    it("should complete the full SKR token flow", () => {
      // Step 1: Find SKR in registry
      const skr = getToken("SKR")
      expect(skr).toBeDefined()
      expect(skr!.name).toBe("Seeker")

      // Step 2: Format a display balance
      const balance = "2500.123456"
      const displayBalance = formatTokenAmount(balance, skr!.decimals)
      expect(displayBalance).toBeDefined()
      expect(displayBalance).not.toBe("0")

      // Step 3: Parse amount for on-chain transaction
      const sendAmount = "100.5"
      const rawAmount = parseTokenAmount(sendAmount, skr!.decimals)
      expect(rawAmount).toBe(100500000n)

      // Step 4: Verify SKR is valid for recipient selection
      const recipientAddress = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
      const txParams = {
        mint: skr!.mint,
        rawAmount: rawAmount.toString(),
        recipient: recipientAddress,
      }

      expect(txParams.mint).toBe(SKR_MINT)
      expect(txParams.rawAmount).toBe("100500000")
    })
  })
})
