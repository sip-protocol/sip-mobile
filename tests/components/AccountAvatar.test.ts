/**
 * AccountAvatar Tests
 *
 * Tests for the account avatar helper functions and constants:
 * emoji resolution, size mapping, and fallback behavior.
 */

import { describe, it, expect } from "vitest"
import { resolveEmoji, SIZES } from "@/components/AccountAvatar"

// ============================================================================
// EMOJI RESOLUTION
// ============================================================================

describe("AccountAvatar", () => {
  describe("resolveEmoji", () => {
    it("should return the emoji when provided", () => {
      expect(resolveEmoji("\u{1F680}")).toBe("\u{1F680}")
    })

    it("should return fallback for empty string", () => {
      expect(resolveEmoji("")).toBe("\u{1F464}")
    })

    it("should return fallback for undefined", () => {
      expect(resolveEmoji(undefined)).toBe("\u{1F464}")
    })

    it("should preserve multi-codepoint emojis", () => {
      const flag = "\u{1F1FA}\u{1F1F8}" // US flag
      expect(resolveEmoji(flag)).toBe(flag)
    })

    it("should handle standard emojis", () => {
      const cases = [
        "\u{1F525}", // fire
        "\u{26A1}",  // lightning
        "\u{1F9D1}", // person
        "\u{1F4A1}", // lightbulb
      ]
      for (const emoji of cases) {
        expect(resolveEmoji(emoji)).toBe(emoji)
      }
    })
  })

  // ============================================================================
  // SIZE CONFIGURATION
  // ============================================================================

  describe("SIZES", () => {
    it("should define sm size", () => {
      expect(SIZES.sm).toBeDefined()
      expect(SIZES.sm.container).toContain("w-8")
      expect(SIZES.sm.container).toContain("h-8")
      expect(SIZES.sm.container).toContain("rounded-lg")
      expect(SIZES.sm.text).toBe("text-lg")
    })

    it("should define md size", () => {
      expect(SIZES.md).toBeDefined()
      expect(SIZES.md.container).toContain("w-10")
      expect(SIZES.md.container).toContain("h-10")
      expect(SIZES.md.container).toContain("rounded-xl")
      expect(SIZES.md.text).toBe("text-xl")
    })

    it("should define lg size", () => {
      expect(SIZES.lg).toBeDefined()
      expect(SIZES.lg.container).toContain("w-16")
      expect(SIZES.lg.container).toContain("h-16")
      expect(SIZES.lg.container).toContain("rounded-2xl")
      expect(SIZES.lg.text).toBe("text-3xl")
    })

    it("should have exactly three size variants", () => {
      const keys = Object.keys(SIZES)
      expect(keys).toHaveLength(3)
      expect(keys).toEqual(expect.arrayContaining(["sm", "md", "lg"]))
    })

    it("should increase dimensions from sm to lg", () => {
      // Extract numeric width from container class (e.g., "w-8" -> 8)
      const widthOf = (size: keyof typeof SIZES) => {
        const match = SIZES[size].container.match(/w-(\d+)/)
        return match ? parseInt(match[1], 10) : 0
      }

      expect(widthOf("sm")).toBeLessThan(widthOf("md"))
      expect(widthOf("md")).toBeLessThan(widthOf("lg"))
    })
  })
})
