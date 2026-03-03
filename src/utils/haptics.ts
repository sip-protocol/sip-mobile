/**
 * Haptics Utility
 *
 * Convenience wrapper around expo-haptics for consistent haptic feedback
 * across the app. Each function is a no-op that catches errors silently
 * since haptics may not be available on all devices/simulators.
 */

import * as Haptics from "expo-haptics"

export type HapticType = "light" | "medium" | "heavy" | "success" | "warning" | "error"

/**
 * Light impact feedback — subtle tap for selections, toggles
 */
export async function hapticLight(): Promise<void> {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  } catch {
    // Haptics unavailable — silently ignore
  }
}

/**
 * Medium impact feedback — button presses, confirmations
 */
export async function hapticMedium(): Promise<void> {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
  } catch {
    // Haptics unavailable — silently ignore
  }
}

/**
 * Heavy impact feedback — significant actions, destructive operations
 */
export async function hapticHeavy(): Promise<void> {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
  } catch {
    // Haptics unavailable — silently ignore
  }
}

/**
 * Success notification — transaction confirmed, save completed
 */
export async function hapticSuccess(): Promise<void> {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  } catch {
    // Haptics unavailable — silently ignore
  }
}

/**
 * Warning notification — non-critical alerts
 */
export async function hapticWarning(): Promise<void> {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
  } catch {
    // Haptics unavailable — silently ignore
  }
}

/**
 * Error notification — transaction failed, validation error
 */
export async function hapticError(): Promise<void> {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
  } catch {
    // Haptics unavailable — silently ignore
  }
}

/**
 * Dispatch haptic feedback by type string
 */
export async function triggerHaptic(type: HapticType): Promise<void> {
  switch (type) {
    case "light":
      return hapticLight()
    case "medium":
      return hapticMedium()
    case "heavy":
      return hapticHeavy()
    case "success":
      return hapticSuccess()
    case "warning":
      return hapticWarning()
    case "error":
      return hapticError()
  }
}
