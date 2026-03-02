/**
 * Accessibility Audit Tests
 *
 * File-content analysis tests that verify accessibility attributes
 * exist across all screen files. Reads .tsx files as strings and
 * checks for required a11y patterns.
 *
 * This does NOT render components -- it verifies the source code
 * contains the expected accessibility props.
 */

import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { resolve } from "path"

// ============================================================================
// HELPERS
// ============================================================================

function readScreen(relativePath: string): string {
  const absolutePath = resolve(__dirname, "../../", relativePath)
  return readFileSync(absolutePath, "utf-8")
}

function countOccurrences(source: string, pattern: string): number {
  const regex = new RegExp(pattern, "g")
  return (source.match(regex) || []).length
}

// ============================================================================
// SCREEN FILES
// ============================================================================

const SCREEN_FILES = {
  home: "app/(tabs)/index.tsx",
  send: "app/(tabs)/send.tsx",
  receive: "app/(tabs)/receive.tsx",
  swap: "app/(tabs)/swap.tsx",
  settings: "app/(tabs)/settings.tsx",
  contacts: "app/contacts/index.tsx",
  addContact: "app/contacts/add.tsx",
  portfolio: "app/portfolio/index.tsx",
  history: "app/history/index.tsx",
  claim: "app/claim/index.tsx",
  scan: "app/scan/index.tsx",
}

const COMPONENT_FILES = {
  button: "src/components/ui/Button.tsx",
  input: "src/components/ui/Input.tsx",
  toggle: "src/components/ui/Toggle.tsx",
  emptyState: "src/components/ui/EmptyState.tsx",
}

// ============================================================================
// TESTS: SCREEN ACCESSIBILITY ATTRIBUTES
// ============================================================================

describe("Accessibility Audit: Screen Files", () => {
  describe("Home Screen", () => {
    const source = readScreen(SCREEN_FILES.home)

    it("should have accessibilityLabel on QuickAction buttons", () => {
      expect(source).toContain("accessibilityLabel={label}")
    })

    it("should have accessibilityRole on QuickAction buttons", () => {
      expect(source).toContain('accessibilityRole="button"')
    })

    it("should have accessibilityLabel on TransactionRow", () => {
      expect(source).toContain("Opens transaction details")
    })

    it("should have accessibilityLabel on copy address button", () => {
      expect(source).toContain("Copy wallet address")
    })

    it("should have accessibilityLabel on setup wallet button", () => {
      expect(source).toContain("Set up wallet")
    })

    it("should have accessibilityLabel on unclaimed payments banner", () => {
      expect(source).toContain("Opens the claim payments screen")
    })

    it("should have accessibilityLabel on view all button", () => {
      expect(source).toContain("View all transactions")
    })
  })

  describe("Send Screen", () => {
    const source = readScreen(SCREEN_FILES.send)

    it("should have accessibilityLabel on MAX button", () => {
      expect(source).toContain("Use maximum amount")
    })

    it("should have accessibilityLabel on Scan QR button", () => {
      expect(source).toContain("Scan QR code")
    })

    it("should have accessibilityLabel on Contacts button", () => {
      expect(source).toContain("Choose from contacts")
    })

    it("should have accessibilityLabel on privacy level button", () => {
      expect(source).toContain("Opens settings to change privacy level")
    })

    it("should have accessibilityLabel on copy tx hash button", () => {
      expect(source).toContain("Copy transaction hash")
    })

    it("should have multiple accessibilityRole=button attributes", () => {
      const count = countOccurrences(source, 'accessibilityRole="button"')
      expect(count).toBeGreaterThanOrEqual(5)
    })
  })

  describe("Receive Screen", () => {
    const source = readScreen(SCREEN_FILES.receive)

    it("should have accessibilityRole=tab on tab switcher", () => {
      const tabCount = countOccurrences(source, 'accessibilityRole="tab"')
      expect(tabCount).toBe(2)
    })

    it("should have accessibilityState on tabs", () => {
      expect(source).toContain("accessibilityState={{ selected:")
    })

    it("should have accessibilityLabel on regenerate button", () => {
      expect(source).toContain("Generate new stealth address")
    })

    it("should have accessibilityLabel on copy button", () => {
      expect(source).toContain("Copy stealth address")
    })

    it("should have accessibilityLabel on share button", () => {
      expect(source).toContain("Share stealth address")
    })

    it("should have accessibilityLabel on scan for payments button", () => {
      expect(source).toContain("Scan for payments")
    })
  })

  describe("Swap Screen", () => {
    const source = readScreen(SCREEN_FILES.swap)

    it("should have accessibilityLabel on swap history icon button", () => {
      expect(source).toContain("Swap history")
    })

    it("should have accessibilityLabel on swap settings icon button", () => {
      expect(source).toContain("Swap settings")
    })

    it("should have accessibilityLabel on swap direction button", () => {
      expect(source).toContain("Swap token direction")
    })

    it("should have accessibilityRole=switch on privacy toggle", () => {
      expect(source).toContain('accessibilityRole="switch"')
    })

    it("should have accessibilityLabel on refresh quote button", () => {
      expect(source).toContain("Refresh quote")
    })

    it("should have accessibilityLabel on token selector", () => {
      expect(source).toContain("Select")
      expect(source).toContain("token, currently")
    })

    it("should have accessibilityLabel on confirm/cancel buttons in modal", () => {
      expect(source).toContain("Cancel swap")
      expect(source).toContain("Confirm swap")
    })

    it("should have accessibilityRole=link on explorer button", () => {
      expect(source).toContain('accessibilityRole="link"')
    })

    it("should have accessibilityLabel on slippage options", () => {
      expect(source).toContain("slippage")
    })
  })

  describe("Settings Screen", () => {
    const source = readScreen(SCREEN_FILES.settings)

    it("should have accessibilityRole on SettingsItem", () => {
      expect(source).toContain('accessibilityRole="button"')
    })

    it("should have accessibilityLabel on SettingsItem", () => {
      // SettingsItem uses template literal label
      expect(source).toContain("accessibilityLabel={`${title}")
    })

    it("should have accessibilityRole=switch on Switch", () => {
      expect(source).toContain('accessibilityRole="switch"')
    })

    it("should have accessibilityState on Switch", () => {
      expect(source).toContain("accessibilityState={{ checked: value")
    })
  })

  describe("Contacts Screen", () => {
    const source = readScreen(SCREEN_FILES.contacts)

    it("should have full a11y on ContactRow", () => {
      expect(source).toContain("accessibilityLabel={`Send payment to")
      expect(source).toContain("accessibilityHint=")
      expect(source).toContain('accessibilityRole="button"')
    })

    it("should have a11y on add contact button", () => {
      expect(source).toContain('accessibilityLabel="Add contact"')
    })
  })

  describe("Add Contact Screen", () => {
    const source = readScreen(SCREEN_FILES.addContact)

    it("should have a11y on back button", () => {
      expect(source).toContain('accessibilityLabel="Go back"')
      expect(source).toContain('accessibilityRole="button"')
    })

    it("should have a11y on save button", () => {
      expect(source).toContain('accessibilityLabel="Save contact"')
    })
  })

  describe("Portfolio Screen", () => {
    const source = readScreen(SCREEN_FILES.portfolio)

    it("should have a11y on token rows", () => {
      expect(source).toContain("accessibilityLabel={`${symbol} balance")
    })

    it("should have a11y on shield button", () => {
      expect(source).toContain("accessibilityLabel={`Shield ${symbol}")
      expect(source).toContain('accessibilityRole="button"')
    })
  })

  describe("History Screen", () => {
    const source = readScreen(SCREEN_FILES.history)

    it("should have a11y on back button", () => {
      expect(source).toContain('accessibilityLabel="Go back"')
    })

    it("should have a11y on TransactionItem", () => {
      expect(source).toContain("Opens transaction details")
    })

    it("should have a11y on FilterChip", () => {
      expect(source).toContain("accessibilityLabel={`Filter: ${label}")
      expect(source).toContain("accessibilityState={{ selected:")
    })

    it("should have a11y on clear search button", () => {
      expect(source).toContain('accessibilityLabel="Clear search"')
    })
  })

  describe("Claim Screen", () => {
    const source = readScreen(SCREEN_FILES.claim)

    it("should have a11y on back buttons", () => {
      const backCount = countOccurrences(source, 'accessibilityLabel="Go back"')
      expect(backCount).toBe(2)
    })

    it("should have accessibilityRole=checkbox on payment rows", () => {
      expect(source).toContain('accessibilityRole="checkbox"')
    })

    it("should have a11y on select all button", () => {
      expect(source).toContain("Select all payments")
    })

    it("should have a11y on try again button", () => {
      expect(source).toContain('accessibilityLabel="Try again"')
    })
  })

  describe("Scan Screen", () => {
    const source = readScreen(SCREEN_FILES.scan)

    it("should have a11y on back buttons", () => {
      const backCount = countOccurrences(source, 'accessibilityLabel="Go back"')
      expect(backCount).toBe(2)
    })

    it("should have a11y on found payment rows", () => {
      expect(source).toContain("Opens payment details to claim")
    })

    it("should have a11y on claim all link", () => {
      expect(source).toContain("Claim all found payments")
    })

    it("should have a11y on view all in history link", () => {
      expect(source).toContain("View all in history")
    })

    it("should have a11y on unclaimed payments banner", () => {
      expect(source).toContain("Opens the claim payments screen")
    })
  })
})

// ============================================================================
// TESTS: SHARED COMPONENT ACCESSIBILITY
// ============================================================================

describe("Accessibility Audit: Shared Components", () => {
  describe("Button component", () => {
    const source = readScreen(COMPONENT_FILES.button)

    it("should have accessibilityRole=button", () => {
      expect(source).toContain('accessibilityRole="button"')
    })

    it("should derive accessibilityLabel from children", () => {
      expect(source).toContain("accessibilityLabel={a11yLabel}")
    })

    it("should support accessibilityHint", () => {
      expect(source).toContain("accessibilityHint={accessibilityHint}")
    })

    it("should report disabled state", () => {
      expect(source).toContain("accessibilityState={{ disabled:")
    })
  })

  describe("Input component", () => {
    const source = readScreen(COMPONENT_FILES.input)

    it("should have accessibilityLabel from label prop", () => {
      expect(source).toContain("accessibilityLabel={label}")
    })

    it("should have accessibilityHint from hint prop", () => {
      expect(source).toContain("accessibilityHint={hint}")
    })

    it("should have accessibilityRole=alert on error text", () => {
      expect(source).toContain('accessibilityRole="alert"')
    })
  })

  describe("Toggle component", () => {
    const source = readScreen(COMPONENT_FILES.toggle)

    it("should have accessibilityRole=switch on both toggles", () => {
      const switchCount = countOccurrences(source, 'accessibilityRole="switch"')
      expect(switchCount).toBe(2)
    })

    it("should have accessibilityState with checked", () => {
      const checkedCount = countOccurrences(source, "accessibilityState={{ checked:")
      expect(checkedCount).toBe(2)
    })
  })

  describe("EmptyState component", () => {
    const source = readScreen(COMPONENT_FILES.emptyState)

    it("should have accessibilityRole=button on action pressable", () => {
      expect(source).toContain('accessibilityRole="button"')
    })

    it("should have accessibilityLabel on action pressable", () => {
      expect(source).toContain("accessibilityLabel={actionLabel}")
    })
  })
})

// ============================================================================
// TESTS: ACCESSIBILITY UTILITY EXISTS
// ============================================================================

describe("Accessibility Audit: Utility Module", () => {
  const source = readScreen("src/utils/accessibility.ts")

  it("should export buttonA11y helper", () => {
    expect(source).toContain("export function buttonA11y")
  })

  it("should export linkA11y helper", () => {
    expect(source).toContain("export function linkA11y")
  })

  it("should export announce function", () => {
    expect(source).toContain("export function announce")
  })

  it("should export formatAmountForA11y", () => {
    expect(source).toContain("export function formatAmountForA11y")
  })

  it("should export formatAddressForA11y", () => {
    expect(source).toContain("export function formatAddressForA11y")
  })

  it("should define MIN_TOUCH_TARGET constant", () => {
    expect(source).toContain("MIN_TOUCH_TARGET")
  })

  it("should define MIN_CONTRAST_RATIO constant", () => {
    expect(source).toContain("MIN_CONTRAST_RATIO")
  })
})

// ============================================================================
// TESTS: CROSS-CUTTING PATTERNS
// ============================================================================

describe("Accessibility Audit: Cross-Cutting Patterns", () => {
  it("every screen with TouchableOpacity should have at least one accessibilityRole", () => {
    for (const [name, path] of Object.entries(SCREEN_FILES)) {
      const source = readScreen(path)
      if (source.includes("TouchableOpacity")) {
        const hasRole = source.includes("accessibilityRole")
        expect(hasRole, `${name} (${path}) has TouchableOpacity but no accessibilityRole`).toBe(true)
      }
    }
  })

  it("every screen with TouchableOpacity should have at least one accessibilityLabel", () => {
    for (const [name, path] of Object.entries(SCREEN_FILES)) {
      const source = readScreen(path)
      if (source.includes("TouchableOpacity")) {
        const hasLabel = source.includes("accessibilityLabel")
        expect(hasLabel, `${name} (${path}) has TouchableOpacity but no accessibilityLabel`).toBe(true)
      }
    }
  })

  it("icon-only buttons should have explicit accessibilityLabel", () => {
    // Swap screen header has icon-only buttons
    const swapSource = readScreen(SCREEN_FILES.swap)
    expect(swapSource).toContain('accessibilityLabel="Swap history"')
    expect(swapSource).toContain('accessibilityLabel="Swap settings"')
    expect(swapSource).toContain('accessibilityLabel="Swap token direction"')
  })

  it("all back navigation buttons should have accessibilityLabel", () => {
    const screensWithBack = ["history", "claim", "scan", "addContact"]
    for (const name of screensWithBack) {
      const source = readScreen(SCREEN_FILES[name as keyof typeof SCREEN_FILES])
      const hasBackLabel =
        source.includes('accessibilityLabel="Go back"') ||
        source.includes("accessibilityLabel=\"Go back\"")
      expect(hasBackLabel, `${name} back button missing accessibilityLabel`).toBe(true)
    }
  })
})
