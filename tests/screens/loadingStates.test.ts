/**
 * Loading States Tests
 *
 * Verifies loading state color constants match expected contract.
 * Tests the ICON_COLORS values that loading indicators depend on.
 *
 * Note: Cannot import from @/constants/icons directly because it
 * re-exports phosphor icon components which hang in Node.
 * Instead, we read the source file and validate the exported values.
 */

import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"

// Read ICON_COLORS directly from source to avoid phosphor import chain
function getIconColors(): Record<string, string> {
  const src = fs.readFileSync(
    path.resolve(__dirname, "../../src/constants/icons.ts"),
    "utf-8",
  )
  const match = src.match(/export const ICON_COLORS = \{([\s\S]*?)\} as const/)
  if (!match) throw new Error("ICON_COLORS not found in icons.ts")

  const colors: Record<string, string> = {}
  const lines = match[1].split("\n")
  for (const line of lines) {
    const kvMatch = line.match(/^\s*(\w+):\s*"(#[0-9a-fA-F]{6})"/)
    if (kvMatch) {
      colors[kvMatch[1]] = kvMatch[2]
    }
  }
  return colors
}

describe("Loading States", () => {
  const ICON_COLORS = getIconColors()

  describe("Icon Colors", () => {
    it("should define brand purple for primary loading indicators", () => {
      expect(ICON_COLORS.brand).toBeDefined()
      expect(ICON_COLORS.brand).toMatch(/^#[0-9a-fA-F]{6}$/)
    })

    it("should define muted color for secondary indicators", () => {
      expect(ICON_COLORS.muted).toBeDefined()
      expect(typeof ICON_COLORS.muted).toBe("string")
    })

    it("should define error color for failed states", () => {
      expect(ICON_COLORS.error).toBeDefined()
      expect(typeof ICON_COLORS.error).toBe("string")
    })

    it("should define success color for completed states", () => {
      expect(ICON_COLORS.success).toBeDefined()
      expect(typeof ICON_COLORS.success).toBe("string")
    })

    it("should define warning color for pending states", () => {
      expect(ICON_COLORS.warning).toBeDefined()
      expect(typeof ICON_COLORS.warning).toBe("string")
    })

    it("should have distinct colors for different states", () => {
      const colors = [ICON_COLORS.brand, ICON_COLORS.error, ICON_COLORS.success, ICON_COLORS.warning]
      const unique = new Set(colors)
      expect(unique.size).toBe(colors.length)
    })
  })
})
