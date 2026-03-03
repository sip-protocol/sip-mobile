/**
 * PrivacyScoreBadge Tests
 *
 * Tests for the privacy score badge helper functions:
 * tier classification, color mapping, and edge cases.
 */

import { describe, it, expect } from "vitest"
import { getScoreTier, getScoreColor, getScoreLabel } from "@/components/PrivacyScoreBadge"
import type { ScoreTier } from "@/components/PrivacyScoreBadge"

// ============================================================================
// TIER CLASSIFICATION
// ============================================================================

describe("PrivacyScoreBadge", () => {
  describe("getScoreTier", () => {
    it("should return exposed for score 0", () => {
      expect(getScoreTier(0)).toBe("exposed")
    })

    it("should return exposed for score 33", () => {
      expect(getScoreTier(33)).toBe("exposed")
    })

    it("should return exposed for scores 1-32", () => {
      expect(getScoreTier(1)).toBe("exposed")
      expect(getScoreTier(15)).toBe("exposed")
      expect(getScoreTier(32)).toBe("exposed")
    })

    it("should return partial for score 34", () => {
      expect(getScoreTier(34)).toBe("partial")
    })

    it("should return partial for score 66", () => {
      expect(getScoreTier(66)).toBe("partial")
    })

    it("should return partial for scores 35-65", () => {
      expect(getScoreTier(35)).toBe("partial")
      expect(getScoreTier(50)).toBe("partial")
      expect(getScoreTier(65)).toBe("partial")
    })

    it("should return shielded for score 67", () => {
      expect(getScoreTier(67)).toBe("shielded")
    })

    it("should return shielded for score 100", () => {
      expect(getScoreTier(100)).toBe("shielded")
    })

    it("should return shielded for scores 68-99", () => {
      expect(getScoreTier(68)).toBe("shielded")
      expect(getScoreTier(85)).toBe("shielded")
      expect(getScoreTier(99)).toBe("shielded")
    })

    it("should clamp scores below 0 to exposed", () => {
      expect(getScoreTier(-1)).toBe("exposed")
      expect(getScoreTier(-50)).toBe("exposed")
      expect(getScoreTier(-100)).toBe("exposed")
    })

    it("should clamp scores above 100 to shielded", () => {
      expect(getScoreTier(101)).toBe("shielded")
      expect(getScoreTier(150)).toBe("shielded")
      expect(getScoreTier(999)).toBe("shielded")
    })
  })

  // ============================================================================
  // COLOR MAPPING
  // ============================================================================

  describe("getScoreColor", () => {
    it("should return red for exposed", () => {
      expect(getScoreColor("exposed")).toBe("#ef4444")
    })

    it("should return yellow for partial", () => {
      expect(getScoreColor("partial")).toBe("#eab308")
    })

    it("should return green for shielded", () => {
      expect(getScoreColor("shielded")).toBe("#22c55e")
    })
  })

  // ============================================================================
  // LABEL MAPPING
  // ============================================================================

  describe("getScoreLabel", () => {
    it("should return Exposed for exposed tier", () => {
      expect(getScoreLabel("exposed")).toBe("Exposed")
    })

    it("should return Partial for partial tier", () => {
      expect(getScoreLabel("partial")).toBe("Partial")
    })

    it("should return Shielded for shielded tier", () => {
      expect(getScoreLabel("shielded")).toBe("Shielded")
    })
  })

  // ============================================================================
  // INTEGRATION — tier → color mapping end-to-end
  // ============================================================================

  describe("tier to color integration", () => {
    it("should map low scores to red", () => {
      const tier = getScoreTier(20)
      expect(getScoreColor(tier)).toBe("#ef4444")
    })

    it("should map mid scores to yellow", () => {
      const tier = getScoreTier(50)
      expect(getScoreColor(tier)).toBe("#eab308")
    })

    it("should map high scores to green", () => {
      const tier = getScoreTier(85)
      expect(getScoreColor(tier)).toBe("#22c55e")
    })
  })
})
