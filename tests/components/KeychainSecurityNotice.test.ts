/**
 * KeychainSecurityNotice Component Tests (#138)
 *
 * Logic-level tests consistent with project test patterns — no component
 * rendering. Covers the module contract and the pure display derivation
 * `resolveNoticeView` (what the notice shows per keychain/device state).
 * The underlying keyStorage behavior is covered by tests/utils/keyStorage.
 */

import { describe, it, expect, vi } from "vitest"

// Mock expo-router (useFocusEffect is a no-op at module level)
vi.mock("expo-router", () => ({
  useFocusEffect: vi.fn(),
}))

// Mock phosphor-react-native
vi.mock("phosphor-react-native", () => ({
  ShieldWarningIcon: vi.fn(() => null),
}))

// Mock icon constants
vi.mock("@/constants/icons", () => ({
  ICON_COLORS: {
    warning: "#f59e0b",
    white: "#ffffff",
  },
}))

// Mock stores (selector-style, same convention as NumpadInput tests)
vi.mock("@/stores/wallet", () => ({
  useWalletStore: vi.fn((selector) => {
    const state = { activeAccountId: "acc-1" }
    return typeof selector === "function" ? selector(state) : state
  }),
}))

vi.mock("@/stores/toast", () => ({
  useToastStore: vi.fn((selector) => {
    const state = { addToast: vi.fn() }
    return typeof selector === "function" ? selector(state) : state
  }),
}))

import { KeychainSecurityNotice, resolveNoticeView } from "@/components/KeychainSecurityNotice"

describe("KeychainSecurityNotice", () => {
  describe("Module exports", () => {
    it("exports KeychainSecurityNotice as a function component", () => {
      expect(typeof KeychainSecurityNotice).toBe("function")
    })

    it("exports resolveNoticeView as a function", () => {
      expect(typeof resolveNoticeView).toBe("function")
    })
  })

  describe("resolveNoticeView", () => {
    it("renders nothing before the level is loaded (null)", () => {
      const view = resolveNoticeView({ level: null, deviceEnrolled: false })
      expect(view.visible).toBe(false)
      expect(view.canUpgrade).toBe(false)
    })

    it("renders nothing for biometric-protected wallets", () => {
      const view = resolveNoticeView({ level: "BIOMETRIC", deviceEnrolled: true })
      expect(view.visible).toBe(false)
    })

    it("shows the notice with device-settings CTA for STANDARD keys on unenrolled devices", () => {
      const view = resolveNoticeView({ level: "STANDARD", deviceEnrolled: false })
      expect(view.visible).toBe(true)
      expect(view.canUpgrade).toBe(false)
    })

    it("shows the notice with upgrade CTA for STANDARD keys once enrollment exists", () => {
      const view = resolveNoticeView({ level: "STANDARD", deviceEnrolled: true })
      expect(view.visible).toBe(true)
      expect(view.canUpgrade).toBe(true)
    })
  })
})
