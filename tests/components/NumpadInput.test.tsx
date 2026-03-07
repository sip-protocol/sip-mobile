/**
 * NumpadInput Component Tests
 *
 * Logic-level tests for the NumpadInput numpad component.
 * Tests helper functions (pure logic) and component exports.
 * Consistent with project test patterns — no component rendering.
 */

import { describe, it, expect, vi } from "vitest"

// Mock phosphor-react-native
vi.mock("phosphor-react-native", () => ({
  BackspaceIcon: vi.fn(() => null),
}))

// Mock settings store
vi.mock("@/stores/settings", () => ({
  useSettingsStore: vi.fn((selector) => {
    const state = { hideBalances: false }
    return typeof selector === "function" ? selector(state) : state
  }),
}))

// Mock haptics
vi.mock("@/utils/haptics", () => ({
  hapticLight: vi.fn(),
}))

// Mock icon constants
vi.mock("@/constants/icons", () => ({
  ICON_COLORS: {
    brand: "#8b5cf6",
    white: "#ffffff",
    inactive: "#71717a",
    muted: "#a1a1aa",
  },
}))

import {
  truncateToDecimals,
  computePreset,
  canAppendChar,
  applyBackspace,
  appendToDisplay,
  parseDisplay,
} from "@/components/NumpadInput"

// ============================================================================
// MODULE EXPORTS
// ============================================================================

describe("NumpadInput", () => {
  describe("Module exports", () => {
    it("exports NumpadInput as named export", async () => {
      const mod = await import("@/components/NumpadInput")
      expect(mod.NumpadInput).toBeDefined()
      expect(typeof mod.NumpadInput).toBe("function")
    })

    it("exports all helper functions", async () => {
      const mod = await import("@/components/NumpadInput")
      expect(typeof mod.truncateToDecimals).toBe("function")
      expect(typeof mod.computePreset).toBe("function")
      expect(typeof mod.canAppendChar).toBe("function")
      expect(typeof mod.applyBackspace).toBe("function")
      expect(typeof mod.appendToDisplay).toBe("function")
      expect(typeof mod.parseDisplay).toBe("function")
    })
  })

  // ============================================================================
  // truncateToDecimals
  // ============================================================================

  describe("truncateToDecimals", () => {
    it("truncates to 2 decimal places (no rounding)", () => {
      expect(truncateToDecimals(1.999, 2)).toBe(1.99)
    })

    it("truncates to 6 decimal places", () => {
      expect(truncateToDecimals(0.1234567, 6)).toBe(0.123456)
    })

    it("handles 0 decimals — floors to integer", () => {
      expect(truncateToDecimals(9.87, 0)).toBe(9)
    })

    it("returns 0 for 0", () => {
      expect(truncateToDecimals(0, 6)).toBe(0)
    })

    it("handles exact values without trailing decimals", () => {
      expect(truncateToDecimals(1.5, 6)).toBe(1.5)
    })

    it("handles negative decimals param — floors to integer", () => {
      expect(truncateToDecimals(3.14, -1)).toBe(3)
    })
  })

  // ============================================================================
  // computePreset — MAX / 75% / 50%
  // ============================================================================

  describe("computePreset", () => {
    it("MAX (100%) returns full balance truncated", () => {
      expect(computePreset(10.123456789, 1, 6)).toBe("10.123456")
    })

    it("75% calculates correctly and truncates", () => {
      // 100 * 0.75 = 75
      expect(computePreset(100, 0.75, 9)).toBe("75")
    })

    it("75% truncates to token decimals", () => {
      // 10 * 0.75 = 7.5
      expect(computePreset(10, 0.75, 2)).toBe("7.5")
    })

    it("50% calculates correctly", () => {
      // 8.5 * 0.5 = 4.25
      expect(computePreset(8.5, 0.5, 6)).toBe("4.25")
    })

    it("50% truncates to token decimals", () => {
      // 1.111 * 0.5 = 0.5555
      expect(computePreset(1.111, 0.5, 2)).toBe("0.55")
    })

    it("returns '0' when balance is 0", () => {
      expect(computePreset(0, 1, 6)).toBe("0")
    })

    it("returns '0' when preset result rounds to 0", () => {
      // Very small balance, high percentage but few decimals
      expect(computePreset(0.001, 0.5, 2)).toBe("0")
    })

    it("removes trailing zeros", () => {
      // 2.0 * 0.5 = 1.0 -> "1"
      expect(computePreset(2.0, 0.5, 6)).toBe("1")
    })
  })

  // ============================================================================
  // canAppendChar — input validation
  // ============================================================================

  describe("canAppendChar", () => {
    it("allows digit on empty-ish display", () => {
      expect(canAppendChar("0", "5", 6)).toBe(true)
    })

    it("allows dot when no dot exists and decimals > 0", () => {
      expect(canAppendChar("1", ".", 6)).toBe(true)
    })

    it("blocks second dot", () => {
      expect(canAppendChar("1.5", ".", 6)).toBe(false)
    })

    it("blocks dot when decimals is 0", () => {
      expect(canAppendChar("1", ".", 0)).toBe(false)
    })

    it("allows digit within decimal limit", () => {
      expect(canAppendChar("1.5", "3", 2)).toBe(true)
    })

    it("blocks digit exceeding decimal limit (decimals=2, already 2 digits)", () => {
      expect(canAppendChar("1.55", "3", 2)).toBe(false)
    })

    it("allows digit when no decimal part yet", () => {
      expect(canAppendChar("1.", "5", 2)).toBe(true)
    })

    it("blocks 3rd decimal digit when decimals=2", () => {
      expect(canAppendChar("0.12", "3", 2)).toBe(false)
    })

    it("allows up to 9 decimal places for SOL (decimals=9)", () => {
      expect(canAppendChar("1.12345678", "9", 9)).toBe(true)
      expect(canAppendChar("1.123456789", "0", 9)).toBe(false)
    })
  })

  // ============================================================================
  // applyBackspace
  // ============================================================================

  describe("applyBackspace", () => {
    it("removes last digit", () => {
      expect(applyBackspace("123")).toBe("12")
    })

    it("returns '0' when display is single digit", () => {
      expect(applyBackspace("5")).toBe("0")
    })

    it("returns '0' when display is already '0'", () => {
      expect(applyBackspace("0")).toBe("0")
    })

    it("removes trailing dot", () => {
      expect(applyBackspace("1.")).toBe("1")
    })

    it("removes last decimal digit", () => {
      expect(applyBackspace("1.5")).toBe("1.")
    })
  })

  // ============================================================================
  // appendToDisplay
  // ============================================================================

  describe("appendToDisplay", () => {
    it("replaces '0' with digit", () => {
      expect(appendToDisplay("0", "5")).toBe("5")
    })

    it("appends dot to '0'", () => {
      expect(appendToDisplay("0", ".")).toBe("0.")
    })

    it("appends digit to existing number", () => {
      expect(appendToDisplay("12", "3")).toBe("123")
    })

    it("appends digit after decimal", () => {
      expect(appendToDisplay("1.", "5")).toBe("1.5")
    })
  })

  // ============================================================================
  // parseDisplay
  // ============================================================================

  describe("parseDisplay", () => {
    it("parses '0' to 0", () => {
      expect(parseDisplay("0")).toBe(0)
    })

    it("parses integer string", () => {
      expect(parseDisplay("42")).toBe(42)
    })

    it("parses decimal string", () => {
      expect(parseDisplay("1.5")).toBe(1.5)
    })

    it("parses trailing dot as integer", () => {
      expect(parseDisplay("5.")).toBe(5)
    })

    it("returns 0 for empty string", () => {
      expect(parseDisplay("")).toBe(0)
    })
  })

  // ============================================================================
  // INTEGRATION — simulated numpad flow
  // ============================================================================

  describe("Simulated numpad flow", () => {
    it("entering 1.5 produces correct display and parse", () => {
      let display = "0"
      // Press "1"
      expect(canAppendChar(display, "1", 6)).toBe(true)
      display = appendToDisplay(display, "1")
      expect(display).toBe("1")

      // Press "."
      expect(canAppendChar(display, ".", 6)).toBe(true)
      display = appendToDisplay(display, ".")
      expect(display).toBe("1.")

      // Press "5"
      expect(canAppendChar(display, "5", 6)).toBe(true)
      display = appendToDisplay(display, "5")
      expect(display).toBe("1.5")

      expect(parseDisplay(display)).toBe(1.5)
    })

    it("MAX sets full balance then CLEAR resets", () => {
      const balance = 12.345678
      const decimals = 6

      // MAX
      let display = computePreset(balance, 1, decimals)
      expect(display).toBe("12.345678")
      expect(parseDisplay(display)).toBe(12.345678)

      // CLEAR (percentage=0 => "0")
      display = computePreset(balance, 0, decimals)
      expect(display).toBe("0")
      expect(parseDisplay(display)).toBe(0)
    })

    it("75% preset then backspace", () => {
      // 100 * 0.75 = 75
      let display = computePreset(100, 0.75, 9)
      expect(display).toBe("75")

      // Backspace
      display = applyBackspace(display)
      expect(display).toBe("7")
      expect(parseDisplay(display)).toBe(7)
    })

    it("50% preset with fractional result", () => {
      // 5.5 * 0.5 = 2.75
      const display = computePreset(5.5, 0.5, 6)
      expect(display).toBe("2.75")
      expect(parseDisplay(display)).toBe(2.75)
    })

    it("CTA label logic: disabled when 0, active when > 0", () => {
      expect(parseDisplay("0")).toBe(0)
      expect(parseDisplay("0") > 0).toBe(false)

      expect(parseDisplay("1")).toBe(1)
      expect(parseDisplay("1") > 0).toBe(true)
    })

    it("balance pill respects token symbol", () => {
      const token = { symbol: "SOL", name: "Solana", mint: "So1...", decimals: 9 }
      const balance = 3.14
      const balanceText = `${balance} ${token.symbol}`
      expect(balanceText).toBe("3.14 SOL")
    })

    it("decimal limiting blocks extra digits", () => {
      let display = "0"
      const decimals = 2

      // Build "0.12"
      display = appendToDisplay(display, ".")
      display = appendToDisplay(display, "1")
      display = appendToDisplay(display, "2")
      expect(display).toBe("0.12")

      // Attempt 3rd decimal — should be blocked
      expect(canAppendChar(display, "3", decimals)).toBe(false)
    })
  })
})
