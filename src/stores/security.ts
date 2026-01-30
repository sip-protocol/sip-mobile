/**
 * Security Store
 *
 * Manages security settings:
 * - Biometric authentication state
 * - PIN lock settings
 * - Auto-lock timeout
 * - Secure storage preferences
 */

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import AsyncStorage from "@react-native-async-storage/async-storage"
import {
  DEFAULT_AUTH_EXPIRY_MS,
  MAX_PIN_ATTEMPTS,
  PIN_LOCKOUT_MS,
  AUTOLOCK_PRESETS,
} from "@/constants/security"

// ============================================================================
// TYPES
// ============================================================================

export type BiometricType = "fingerprint" | "facial" | "iris" | "none"

export type AutoLockTimeout =
  | "immediate"
  | "1min"
  | "5min"
  | "15min"
  | "30min"
  | "never"

export interface SecuritySettings {
  // Biometrics
  biometricsEnabled: boolean
  biometricType: BiometricType
  requireBiometricsForSend: boolean
  requireBiometricsForClaim: boolean
  requireBiometricsForExport: boolean

  // PIN
  pinEnabled: boolean
  pinHash: string | null
  pinAttempts: number
  pinLockedUntil: number | null

  // Auto-lock
  autoLockEnabled: boolean
  autoLockTimeout: AutoLockTimeout
  lastActivityAt: number

  // App security
  hideBalanceOnBackground: boolean
  screenshotProtection: boolean
}

export interface SecurityState extends SecuritySettings {
  // State
  isLocked: boolean
  isAuthenticated: boolean
  authExpiresAt: number | null

  // Actions
  setBiometricsEnabled: (enabled: boolean) => void
  setBiometricType: (type: BiometricType) => void
  setRequireBiometrics: (
    operation: "send" | "claim" | "export",
    required: boolean
  ) => void

  setPinEnabled: (enabled: boolean) => void
  setPinHash: (hash: string | null) => void
  incrementPinAttempts: () => void
  resetPinAttempts: () => void
  lockPin: (until: number) => void

  setAutoLockEnabled: (enabled: boolean) => void
  setAutoLockTimeout: (timeout: AutoLockTimeout) => void
  updateLastActivity: () => void

  setHideBalanceOnBackground: (hide: boolean) => void
  setScreenshotProtection: (enabled: boolean) => void

  // Auth actions
  lock: () => void
  unlock: (expiresInMs?: number) => void
  authenticate: (expiresInMs?: number) => void
  checkAuthExpiry: () => boolean

  // Reset
  resetSecurity: () => void
}

// ============================================================================
// CONSTANTS
// ============================================================================

const initialSettings: SecuritySettings = {
  biometricsEnabled: false,
  biometricType: "none",
  requireBiometricsForSend: true,
  requireBiometricsForClaim: true,
  requireBiometricsForExport: true,

  pinEnabled: false,
  pinHash: null,
  pinAttempts: 0,
  pinLockedUntil: null,

  autoLockEnabled: true,
  autoLockTimeout: "5min",
  lastActivityAt: Date.now(),

  hideBalanceOnBackground: true,
  screenshotProtection: true,
}

// ============================================================================
// STORE
// ============================================================================

export const useSecurityStore = create<SecurityState>()(
  persist(
    (set, get) => ({
      ...initialSettings,
      isLocked: false,
      isAuthenticated: false,
      authExpiresAt: null,

      setBiometricsEnabled: (enabled) =>
        set({ biometricsEnabled: enabled }),

      setBiometricType: (type) =>
        set({ biometricType: type }),

      setRequireBiometrics: (operation, required) => {
        switch (operation) {
          case "send":
            set({ requireBiometricsForSend: required })
            break
          case "claim":
            set({ requireBiometricsForClaim: required })
            break
          case "export":
            set({ requireBiometricsForExport: required })
            break
        }
      },

      setPinEnabled: (enabled) =>
        set({ pinEnabled: enabled }),

      setPinHash: (hash) =>
        set({ pinHash: hash }),

      incrementPinAttempts: () => {
        const attempts = get().pinAttempts + 1
        if (attempts >= MAX_PIN_ATTEMPTS) {
          set({
            pinAttempts: attempts,
            pinLockedUntil: Date.now() + PIN_LOCKOUT_MS,
          })
        } else {
          set({ pinAttempts: attempts })
        }
      },

      resetPinAttempts: () =>
        set({ pinAttempts: 0, pinLockedUntil: null }),

      lockPin: (until) =>
        set({ pinLockedUntil: until }),

      setAutoLockEnabled: (enabled) =>
        set({ autoLockEnabled: enabled }),

      setAutoLockTimeout: (timeout) =>
        set({ autoLockTimeout: timeout }),

      updateLastActivity: () =>
        set({ lastActivityAt: Date.now() }),

      setHideBalanceOnBackground: (hide) =>
        set({ hideBalanceOnBackground: hide }),

      setScreenshotProtection: (enabled) =>
        set({ screenshotProtection: enabled }),

      lock: () =>
        set({ isLocked: true, isAuthenticated: false, authExpiresAt: null }),

      unlock: (expiresInMs = DEFAULT_AUTH_EXPIRY_MS) => {
        set({
          isLocked: false,
          isAuthenticated: true,
          authExpiresAt: Date.now() + expiresInMs,
          lastActivityAt: Date.now(),
        })
      },

      authenticate: (expiresInMs = DEFAULT_AUTH_EXPIRY_MS) => {
        set({
          isAuthenticated: true,
          authExpiresAt: Date.now() + expiresInMs,
          lastActivityAt: Date.now(),
        })
      },

      checkAuthExpiry: () => {
        const { authExpiresAt, isAuthenticated } = get()
        if (!isAuthenticated) return false
        if (!authExpiresAt) return true
        if (Date.now() > authExpiresAt) {
          set({ isAuthenticated: false, authExpiresAt: null })
          return false
        }
        return true
      },

      resetSecurity: () =>
        set({
          ...initialSettings,
          isLocked: false,
          isAuthenticated: false,
          authExpiresAt: null,
        }),
    }),
    {
      name: "sip-security-store",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        biometricsEnabled: state.biometricsEnabled,
        biometricType: state.biometricType,
        requireBiometricsForSend: state.requireBiometricsForSend,
        requireBiometricsForClaim: state.requireBiometricsForClaim,
        requireBiometricsForExport: state.requireBiometricsForExport,
        pinEnabled: state.pinEnabled,
        pinHash: state.pinHash,
        autoLockEnabled: state.autoLockEnabled,
        autoLockTimeout: state.autoLockTimeout,
        hideBalanceOnBackground: state.hideBalanceOnBackground,
        screenshotProtection: state.screenshotProtection,
      }),
    }
  )
)

// ============================================================================
// HELPERS
// ============================================================================

export function getAutoLockMs(timeout: AutoLockTimeout): number {
  return AUTOLOCK_PRESETS[timeout]
}

export function formatAutoLockTimeout(timeout: AutoLockTimeout): string {
  switch (timeout) {
    case "immediate":
      return "Immediately"
    case "1min":
      return "1 minute"
    case "5min":
      return "5 minutes"
    case "15min":
      return "15 minutes"
    case "30min":
      return "30 minutes"
    case "never":
      return "Never"
  }
}
