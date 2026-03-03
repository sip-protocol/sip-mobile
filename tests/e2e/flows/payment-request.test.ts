/**
 * Payment Request Flow E2E Tests
 *
 * Tests payment request URL generation and parsing:
 * 1. Create sipprotocol:// deep link URLs
 * 2. Parse URLs back to params
 * 3. Roundtrip: create -> parse -> verify
 * 4. Handle edge cases (unicode, decimals, invalid schemes)
 * 5. Full flow: Sender creates request -> URL shared -> Receiver parses
 */

import { describe, it, expect, afterEach, vi } from "vitest"
import {
  createPaymentRequest,
  parsePaymentRequest,
} from "@/utils/paymentRequest"
import type { PaymentRequestParams } from "@/utils/paymentRequest"

// ============================================================================
// Constants
// ============================================================================

const STEALTH_ADDRESS = "3Jv9fzVuYxE3FzLhD8WtMnNYcLYQdCQn9GhT5RrAnS1Y"
const VALID_TOKEN = "SOL"

// ============================================================================
// Tests
// ============================================================================

describe("Payment Request Flow E2E", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("Create Payment Request", () => {
    it("should create URL with all params", () => {
      const params: PaymentRequestParams = {
        stealthAddress: STEALTH_ADDRESS,
        amount: "1.5",
        token: "SOL",
        memo: "Coffee payment",
      }

      const url = createPaymentRequest(params)

      expect(url).toContain("sipprotocol://pay?")
      expect(url).toContain(`address=${encodeURIComponent(STEALTH_ADDRESS)}`)
      expect(url).toContain("amount=1.5")
      expect(url).toContain("token=SOL")
      expect(url).toContain(`memo=${encodeURIComponent("Coffee payment")}`)
    })

    it("should create minimal URL with address only", () => {
      const params: PaymentRequestParams = {
        stealthAddress: STEALTH_ADDRESS,
      }

      const url = createPaymentRequest(params)

      expect(url).toBe(`sipprotocol://pay?address=${encodeURIComponent(STEALTH_ADDRESS)}`)
      expect(url).not.toContain("amount=")
      expect(url).not.toContain("token=")
      expect(url).not.toContain("memo=")
    })

    it("should URL-encode special characters in memo", () => {
      const params: PaymentRequestParams = {
        stealthAddress: STEALTH_ADDRESS,
        memo: "Hello & goodbye = test",
      }

      const url = createPaymentRequest(params)
      expect(url).toContain("memo=Hello%20%26%20goodbye%20%3D%20test")
    })

    it("should include amount and token without memo", () => {
      const params: PaymentRequestParams = {
        stealthAddress: STEALTH_ADDRESS,
        amount: "10",
        token: "USDC",
      }

      const url = createPaymentRequest(params)
      expect(url).toContain("amount=10")
      expect(url).toContain("token=USDC")
      expect(url).not.toContain("memo=")
    })
  })

  describe("Parse Payment Request", () => {
    it("should parse URL with all params", () => {
      const url = `sipprotocol://pay?address=${STEALTH_ADDRESS}&amount=2.5&token=SOL&memo=Payment`

      const parsed = parsePaymentRequest(url)

      expect(parsed.stealthAddress).toBe(STEALTH_ADDRESS)
      expect(parsed.amount).toBe("2.5")
      expect(parsed.token).toBe("SOL")
      expect(parsed.memo).toBe("Payment")
    })

    it("should parse minimal URL with address only", () => {
      const url = `sipprotocol://pay?address=${STEALTH_ADDRESS}`

      const parsed = parsePaymentRequest(url)

      expect(parsed.stealthAddress).toBe(STEALTH_ADDRESS)
      expect(parsed.amount).toBeUndefined()
      expect(parsed.token).toBeUndefined()
      expect(parsed.memo).toBeUndefined()
    })

    it("should decode URL-encoded memo", () => {
      const url = `sipprotocol://pay?address=${STEALTH_ADDRESS}&memo=Hello%20World%21`

      const parsed = parsePaymentRequest(url)
      expect(parsed.memo).toBe("Hello World!")
    })

    it("should throw on invalid scheme", () => {
      const url = `https://pay?address=${STEALTH_ADDRESS}`

      expect(() => parsePaymentRequest(url)).toThrow("expected scheme")
    })

    it("should throw on missing scheme separator", () => {
      const url = `sipprotocol//pay?address=${STEALTH_ADDRESS}`

      expect(() => parsePaymentRequest(url)).toThrow("missing scheme")
    })

    it("should throw on wrong host/path", () => {
      const url = `sipprotocol://send?address=${STEALTH_ADDRESS}`

      expect(() => parsePaymentRequest(url)).toThrow('expected path "pay"')
    })

    it("should throw on missing address param", () => {
      const url = "sipprotocol://pay?amount=1.0&token=SOL"

      expect(() => parsePaymentRequest(url)).toThrow("missing required 'address'")
    })

    it("should throw on missing query params entirely", () => {
      const url = "sipprotocol://pay"

      expect(() => parsePaymentRequest(url)).toThrow("missing query parameters")
    })
  })

  describe("Roundtrip: Create -> Parse -> Verify", () => {
    it("should roundtrip with all params", () => {
      const original: PaymentRequestParams = {
        stealthAddress: STEALTH_ADDRESS,
        amount: "5.25",
        token: "USDC",
        memo: "Lunch split",
      }

      const url = createPaymentRequest(original)
      const parsed = parsePaymentRequest(url)

      expect(parsed.stealthAddress).toBe(original.stealthAddress)
      expect(parsed.amount).toBe(original.amount)
      expect(parsed.token).toBe(original.token)
      expect(parsed.memo).toBe(original.memo)
    })

    it("should roundtrip with address only", () => {
      const original: PaymentRequestParams = {
        stealthAddress: STEALTH_ADDRESS,
      }

      const url = createPaymentRequest(original)
      const parsed = parsePaymentRequest(url)

      expect(parsed.stealthAddress).toBe(original.stealthAddress)
      expect(parsed.amount).toBeUndefined()
      expect(parsed.token).toBeUndefined()
      expect(parsed.memo).toBeUndefined()
    })

    it("should roundtrip with unicode memo", () => {
      const original: PaymentRequestParams = {
        stealthAddress: STEALTH_ADDRESS,
        memo: "Thanks for the pizza! Gracias amigo",
      }

      const url = createPaymentRequest(original)
      const parsed = parsePaymentRequest(url)
      expect(parsed.memo).toBe(original.memo)
    })

    it("should roundtrip with emoji in memo", () => {
      const original: PaymentRequestParams = {
        stealthAddress: STEALTH_ADDRESS,
        memo: "Coffee time",
      }

      const url = createPaymentRequest(original)
      const parsed = parsePaymentRequest(url)
      expect(parsed.memo).toBe(original.memo)
    })
  })

  describe("Decimal Amount Handling", () => {
    it("should handle very small amount (0.001)", () => {
      const original: PaymentRequestParams = {
        stealthAddress: STEALTH_ADDRESS,
        amount: "0.001",
      }

      const url = createPaymentRequest(original)
      const parsed = parsePaymentRequest(url)
      expect(parsed.amount).toBe("0.001")
    })

    it("should handle fractional amount (1.5)", () => {
      const original: PaymentRequestParams = {
        stealthAddress: STEALTH_ADDRESS,
        amount: "1.5",
      }

      const url = createPaymentRequest(original)
      const parsed = parsePaymentRequest(url)
      expect(parsed.amount).toBe("1.5")
    })

    it("should handle whole number amount (100)", () => {
      const original: PaymentRequestParams = {
        stealthAddress: STEALTH_ADDRESS,
        amount: "100",
      }

      const url = createPaymentRequest(original)
      const parsed = parsePaymentRequest(url)
      expect(parsed.amount).toBe("100")
    })

    it("should handle large amount with decimals", () => {
      const original: PaymentRequestParams = {
        stealthAddress: STEALTH_ADDRESS,
        amount: "999999.999999",
      }

      const url = createPaymentRequest(original)
      const parsed = parsePaymentRequest(url)
      expect(parsed.amount).toBe("999999.999999")
    })
  })

  describe("Full Flow: Sender Creates -> Receiver Parses -> Pre-fills Send", () => {
    it("should simulate complete payment request flow", () => {
      // Step 1: Receiver creates a payment request on the Receive screen
      const receiverParams: PaymentRequestParams = {
        stealthAddress: STEALTH_ADDRESS,
        amount: "2.0",
        token: VALID_TOKEN,
        memo: "Monthly subscription",
      }
      const requestUrl = createPaymentRequest(receiverParams)

      // Step 2: URL is shared (via QR, text message, etc.)
      expect(requestUrl).toContain("sipprotocol://")

      // Step 3: Sender opens URL, app parses it
      const senderParams = parsePaymentRequest(requestUrl)

      // Step 4: Pre-fill send form with parsed params
      const sendFormState = {
        recipient: senderParams.stealthAddress,
        amount: senderParams.amount || "",
        selectedToken: senderParams.token || "SOL",
        memo: senderParams.memo || "",
      }

      expect(sendFormState.recipient).toBe(STEALTH_ADDRESS)
      expect(sendFormState.amount).toBe("2.0")
      expect(sendFormState.selectedToken).toBe("SOL")
      expect(sendFormState.memo).toBe("Monthly subscription")
    })

    it("should handle payment request without amount (flexible donation)", () => {
      // Receiver just wants any amount
      const receiverParams: PaymentRequestParams = {
        stealthAddress: STEALTH_ADDRESS,
        memo: "Tip jar",
      }
      const requestUrl = createPaymentRequest(receiverParams)
      const senderParams = parsePaymentRequest(requestUrl)

      const sendFormState = {
        recipient: senderParams.stealthAddress,
        amount: senderParams.amount || "",
        selectedToken: senderParams.token || "SOL",
        memo: senderParams.memo || "",
      }

      expect(sendFormState.recipient).toBe(STEALTH_ADDRESS)
      expect(sendFormState.amount).toBe("")
      expect(sendFormState.selectedToken).toBe("SOL")
      expect(sendFormState.memo).toBe("Tip jar")
    })
  })
})
