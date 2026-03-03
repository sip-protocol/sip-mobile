/**
 * Haptics Utility Tests
 *
 * Tests for the haptic feedback convenience wrapper.
 * Verifies correct expo-haptics methods are called and
 * that failures are silently caught.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// Use vi.hoisted to create mocks that survive vi.mock hoisting
const { mockImpactAsync, mockNotificationAsync } = vi.hoisted(() => ({
  mockImpactAsync: vi.fn(),
  mockNotificationAsync: vi.fn(),
}))

vi.mock("expo-haptics", () => ({
  impactAsync: mockImpactAsync,
  notificationAsync: mockNotificationAsync,
  ImpactFeedbackStyle: {
    Light: "Light",
    Medium: "Medium",
    Heavy: "Heavy",
  },
  NotificationFeedbackType: {
    Success: "Success",
    Warning: "Warning",
    Error: "Error",
  },
}))

import {
  hapticLight,
  hapticMedium,
  hapticHeavy,
  hapticSuccess,
  hapticWarning,
  hapticError,
  triggerHaptic,
} from "@/utils/haptics"

describe("Haptics Utility", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockImpactAsync.mockResolvedValue(undefined)
    mockNotificationAsync.mockResolvedValue(undefined)
  })

  describe("Impact feedback functions", () => {
    it("hapticLight calls impactAsync with Light style", async () => {
      await hapticLight()
      expect(mockImpactAsync).toHaveBeenCalledWith("Light")
      expect(mockImpactAsync).toHaveBeenCalledTimes(1)
    })

    it("hapticMedium calls impactAsync with Medium style", async () => {
      await hapticMedium()
      expect(mockImpactAsync).toHaveBeenCalledWith("Medium")
      expect(mockImpactAsync).toHaveBeenCalledTimes(1)
    })

    it("hapticHeavy calls impactAsync with Heavy style", async () => {
      await hapticHeavy()
      expect(mockImpactAsync).toHaveBeenCalledWith("Heavy")
      expect(mockImpactAsync).toHaveBeenCalledTimes(1)
    })
  })

  describe("Notification feedback functions", () => {
    it("hapticSuccess calls notificationAsync with Success type", async () => {
      await hapticSuccess()
      expect(mockNotificationAsync).toHaveBeenCalledWith("Success")
      expect(mockNotificationAsync).toHaveBeenCalledTimes(1)
    })

    it("hapticWarning calls notificationAsync with Warning type", async () => {
      await hapticWarning()
      expect(mockNotificationAsync).toHaveBeenCalledWith("Warning")
      expect(mockNotificationAsync).toHaveBeenCalledTimes(1)
    })

    it("hapticError calls notificationAsync with Error type", async () => {
      await hapticError()
      expect(mockNotificationAsync).toHaveBeenCalledWith("Error")
      expect(mockNotificationAsync).toHaveBeenCalledTimes(1)
    })
  })

  describe("Error resilience", () => {
    it("hapticLight does not throw when expo-haptics fails", async () => {
      mockImpactAsync.mockRejectedValueOnce(new Error("Haptics unavailable"))
      await expect(hapticLight()).resolves.toBeUndefined()
    })

    it("hapticMedium does not throw when expo-haptics fails", async () => {
      mockImpactAsync.mockRejectedValueOnce(new Error("Haptics unavailable"))
      await expect(hapticMedium()).resolves.toBeUndefined()
    })

    it("hapticHeavy does not throw when expo-haptics fails", async () => {
      mockImpactAsync.mockRejectedValueOnce(new Error("Haptics unavailable"))
      await expect(hapticHeavy()).resolves.toBeUndefined()
    })

    it("hapticSuccess does not throw when expo-haptics fails", async () => {
      mockNotificationAsync.mockRejectedValueOnce(new Error("Haptics unavailable"))
      await expect(hapticSuccess()).resolves.toBeUndefined()
    })

    it("hapticWarning does not throw when expo-haptics fails", async () => {
      mockNotificationAsync.mockRejectedValueOnce(new Error("Haptics unavailable"))
      await expect(hapticWarning()).resolves.toBeUndefined()
    })

    it("hapticError does not throw when expo-haptics fails", async () => {
      mockNotificationAsync.mockRejectedValueOnce(new Error("Haptics unavailable"))
      await expect(hapticError()).resolves.toBeUndefined()
    })
  })

  describe("triggerHaptic dispatcher", () => {
    it("dispatches 'light' to hapticLight (impactAsync Light)", async () => {
      await triggerHaptic("light")
      expect(mockImpactAsync).toHaveBeenCalledWith("Light")
    })

    it("dispatches 'medium' to hapticMedium (impactAsync Medium)", async () => {
      await triggerHaptic("medium")
      expect(mockImpactAsync).toHaveBeenCalledWith("Medium")
    })

    it("dispatches 'heavy' to hapticHeavy (impactAsync Heavy)", async () => {
      await triggerHaptic("heavy")
      expect(mockImpactAsync).toHaveBeenCalledWith("Heavy")
    })

    it("dispatches 'success' to hapticSuccess (notificationAsync Success)", async () => {
      await triggerHaptic("success")
      expect(mockNotificationAsync).toHaveBeenCalledWith("Success")
    })

    it("dispatches 'warning' to hapticWarning (notificationAsync Warning)", async () => {
      await triggerHaptic("warning")
      expect(mockNotificationAsync).toHaveBeenCalledWith("Warning")
    })

    it("dispatches 'error' to hapticError (notificationAsync Error)", async () => {
      await triggerHaptic("error")
      expect(mockNotificationAsync).toHaveBeenCalledWith("Error")
    })

    it("triggerHaptic does not throw when haptics unavailable", async () => {
      mockImpactAsync.mockRejectedValueOnce(new Error("Haptics unavailable"))
      await expect(triggerHaptic("light")).resolves.toBeUndefined()
    })
  })
})
