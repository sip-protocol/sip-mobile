/**
 * TokenStats Tests
 *
 * Tests for the formatLargeNumber helper used in the stats grid.
 */

import { describe, it, expect } from "vitest"
import { formatLargeNumber } from "@/components/TokenStats"

// ============================================================================
// FORMAT LARGE NUMBER
// ============================================================================

describe("TokenStats", () => {
  describe("formatLargeNumber", () => {
    it("returns em-dash for undefined", () => {
      expect(formatLargeNumber(undefined)).toBe("\u2014")
    })

    it("formats zero as $0.00", () => {
      expect(formatLargeNumber(0)).toBe("$0.00")
    })

    it("formats billions", () => {
      expect(formatLargeNumber(49_700_000_000)).toBe("$49.70B")
    })

    it("formats single-digit billions", () => {
      expect(formatLargeNumber(1_230_000_000)).toBe("$1.23B")
    })

    it("formats millions", () => {
      expect(formatLargeNumber(646_200_000)).toBe("$646.20M")
    })

    it("formats single-digit millions", () => {
      expect(formatLargeNumber(2_500_000)).toBe("$2.50M")
    })

    it("formats thousands", () => {
      expect(formatLargeNumber(5_430)).toBe("$5.43K")
    })

    it("formats exact thousand boundary", () => {
      expect(formatLargeNumber(1_000)).toBe("$1.00K")
    })

    it("formats small numbers below 1000", () => {
      expect(formatLargeNumber(87.25)).toBe("$87.25")
    })

    it("formats numbers just below 1000", () => {
      expect(formatLargeNumber(999.99)).toBe("$999.99")
    })

    it("formats very small positive numbers", () => {
      expect(formatLargeNumber(0.01)).toBe("$0.01")
    })

    it("formats exact billion boundary", () => {
      expect(formatLargeNumber(1_000_000_000)).toBe("$1.00B")
    })

    it("formats exact million boundary", () => {
      expect(formatLargeNumber(1_000_000)).toBe("$1.00M")
    })
  })
})
