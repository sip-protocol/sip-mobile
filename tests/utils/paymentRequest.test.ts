/**
 * Payment Request URL Utility Tests
 *
 * Tests for creating and parsing sipprotocol:// deep link URLs
 * used for sharing payment requests between SIP wallets.
 */

import { describe, it, expect } from "vitest"
import {
  createPaymentRequest,
  parsePaymentRequest,
} from "@/utils/paymentRequest"

describe("Payment Request", () => {
  const TEST_STEALTH = "sip:solana:FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr:7nYBTm4PZ3Gk2Fv8RJxoLp9QWNhCdDmE5A1k3B6wVxRf"

  describe("createPaymentRequest", () => {
    it("should create URL with all params", () => {
      const url = createPaymentRequest({
        stealthAddress: TEST_STEALTH,
        amount: "1.5",
        token: "SOL",
        memo: "Coffee payment",
      })

      expect(url).toContain("sipprotocol://pay?")
      expect(url).toContain(`address=${encodeURIComponent(TEST_STEALTH)}`)
      expect(url).toContain("amount=1.5")
      expect(url).toContain("token=SOL")
      expect(url).toContain(`memo=${encodeURIComponent("Coffee payment")}`)
    })

    it("should create URL with only required params (stealthAddress)", () => {
      const url = createPaymentRequest({
        stealthAddress: TEST_STEALTH,
      })

      expect(url).toBe(`sipprotocol://pay?address=${encodeURIComponent(TEST_STEALTH)}`)
      expect(url).not.toContain("amount=")
      expect(url).not.toContain("token=")
      expect(url).not.toContain("memo=")
    })

    it("should omit undefined optional params", () => {
      const url = createPaymentRequest({
        stealthAddress: TEST_STEALTH,
        amount: "10",
        token: undefined,
        memo: undefined,
      })

      expect(url).toContain("address=")
      expect(url).toContain("amount=10")
      expect(url).not.toContain("token=")
      expect(url).not.toContain("memo=")
    })

    it("should URL-encode special characters in memo", () => {
      const url = createPaymentRequest({
        stealthAddress: TEST_STEALTH,
        memo: "Pay for lunch & dinner = $25",
      })

      expect(url).not.toContain("&dinner")
      expect(url).toContain(encodeURIComponent("Pay for lunch & dinner = $25"))
    })

    it("should handle stealth address format with colons", () => {
      const url = createPaymentRequest({
        stealthAddress: TEST_STEALTH,
      })

      // Colons in stealth address should be encoded
      expect(url).toContain("address=")
      // Parsing back should recover the original
      const parsed = parsePaymentRequest(url)
      expect(parsed.stealthAddress).toBe(TEST_STEALTH)
    })

    it("should handle amount with decimals", () => {
      const url = createPaymentRequest({
        stealthAddress: TEST_STEALTH,
        amount: "0.001",
      })

      expect(url).toContain("amount=0.001")
    })

    it("should handle token symbols with uppercase", () => {
      const url = createPaymentRequest({
        stealthAddress: TEST_STEALTH,
        token: "USDC",
      })

      expect(url).toContain("token=USDC")
    })
  })

  describe("parsePaymentRequest", () => {
    it("should parse URL with all params", () => {
      const url = `sipprotocol://pay?address=${encodeURIComponent(TEST_STEALTH)}&amount=2.5&token=USDC&memo=${encodeURIComponent("Test payment")}`

      const result = parsePaymentRequest(url)

      expect(result.stealthAddress).toBe(TEST_STEALTH)
      expect(result.amount).toBe("2.5")
      expect(result.token).toBe("USDC")
      expect(result.memo).toBe("Test payment")
    })

    it("should parse URL with only address", () => {
      const url = `sipprotocol://pay?address=${encodeURIComponent(TEST_STEALTH)}`

      const result = parsePaymentRequest(url)

      expect(result.stealthAddress).toBe(TEST_STEALTH)
      expect(result.amount).toBeUndefined()
      expect(result.token).toBeUndefined()
      expect(result.memo).toBeUndefined()
    })

    it("should return undefined for missing optional params", () => {
      const url = `sipprotocol://pay?address=${encodeURIComponent(TEST_STEALTH)}&amount=5`

      const result = parsePaymentRequest(url)

      expect(result.stealthAddress).toBe(TEST_STEALTH)
      expect(result.amount).toBe("5")
      expect(result.token).toBeUndefined()
      expect(result.memo).toBeUndefined()
    })

    it("should handle URL-encoded values", () => {
      const memo = "Hello World & Friends = great"
      const url = `sipprotocol://pay?address=${encodeURIComponent(TEST_STEALTH)}&memo=${encodeURIComponent(memo)}`

      const result = parsePaymentRequest(url)

      expect(result.memo).toBe(memo)
    })

    it("should throw for invalid URL format — wrong scheme", () => {
      expect(() => parsePaymentRequest("https://pay?address=abc")).toThrow()
    })

    it("should throw for invalid URL format — missing scheme", () => {
      expect(() => parsePaymentRequest("pay?address=abc")).toThrow()
    })

    it("should throw for invalid URL format — wrong path", () => {
      expect(() => parsePaymentRequest("sipprotocol://send?address=abc")).toThrow()
    })

    it("should throw for missing address param", () => {
      expect(() => parsePaymentRequest("sipprotocol://pay?amount=5")).toThrow()
    })

    it("should throw for empty address param", () => {
      expect(() => parsePaymentRequest("sipprotocol://pay?address=")).toThrow()
    })

    it("should handle params in any order", () => {
      const url = `sipprotocol://pay?memo=test&address=${encodeURIComponent(TEST_STEALTH)}&token=SOL&amount=1`

      const result = parsePaymentRequest(url)

      expect(result.stealthAddress).toBe(TEST_STEALTH)
      expect(result.amount).toBe("1")
      expect(result.token).toBe("SOL")
      expect(result.memo).toBe("test")
    })
  })

  describe("roundtrip", () => {
    it("should create and parse back to same values", () => {
      const params = {
        stealthAddress: TEST_STEALTH,
        amount: "42.069",
        token: "SOL",
        memo: "Payment for services",
      }

      const url = createPaymentRequest(params)
      const parsed = parsePaymentRequest(url)

      expect(parsed.stealthAddress).toBe(params.stealthAddress)
      expect(parsed.amount).toBe(params.amount)
      expect(parsed.token).toBe(params.token)
      expect(parsed.memo).toBe(params.memo)
    })

    it("should roundtrip with special characters", () => {
      const params = {
        stealthAddress: TEST_STEALTH,
        memo: "Café payment — 50% off! (limited time) #deal",
      }

      const url = createPaymentRequest(params)
      const parsed = parsePaymentRequest(url)

      expect(parsed.stealthAddress).toBe(params.stealthAddress)
      expect(parsed.memo).toBe(params.memo)
      expect(parsed.amount).toBeUndefined()
      expect(parsed.token).toBeUndefined()
    })

    it("should roundtrip with minimum params", () => {
      const params = {
        stealthAddress: TEST_STEALTH,
      }

      const url = createPaymentRequest(params)
      const parsed = parsePaymentRequest(url)

      expect(parsed.stealthAddress).toBe(params.stealthAddress)
      expect(parsed.amount).toBeUndefined()
      expect(parsed.token).toBeUndefined()
      expect(parsed.memo).toBeUndefined()
    })

    it("should roundtrip with unicode memo", () => {
      const params = {
        stealthAddress: TEST_STEALTH,
        amount: "100",
        memo: "Terima kasih banyak",
      }

      const url = createPaymentRequest(params)
      const parsed = parsePaymentRequest(url)

      expect(parsed.stealthAddress).toBe(params.stealthAddress)
      expect(parsed.amount).toBe(params.amount)
      expect(parsed.memo).toBe(params.memo)
    })
  })
})
