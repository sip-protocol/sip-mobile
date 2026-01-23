/**
 * Security Store Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  useSecurityStore,
  getAutoLockMs,
  formatAutoLockTimeout,
} from "@/stores/security"

describe("Security Store", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useSecurityStore.setState({
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
      isLocked: false,
      isAuthenticated: false,
      authExpiresAt: null,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe("Biometrics", () => {
    it("should enable biometrics", () => {
      const { setBiometricsEnabled } = useSecurityStore.getState()

      setBiometricsEnabled(true)
      expect(useSecurityStore.getState().biometricsEnabled).toBe(true)
    })

    it("should set biometric type", () => {
      const { setBiometricType } = useSecurityStore.getState()

      setBiometricType("fingerprint")
      expect(useSecurityStore.getState().biometricType).toBe("fingerprint")

      setBiometricType("facial")
      expect(useSecurityStore.getState().biometricType).toBe("facial")
    })

    it("should set require biometrics for operations", () => {
      const { setRequireBiometrics } = useSecurityStore.getState()

      setRequireBiometrics("send", false)
      expect(useSecurityStore.getState().requireBiometricsForSend).toBe(false)

      setRequireBiometrics("claim", false)
      expect(useSecurityStore.getState().requireBiometricsForClaim).toBe(false)

      setRequireBiometrics("export", false)
      expect(useSecurityStore.getState().requireBiometricsForExport).toBe(false)
    })
  })

  describe("PIN Security", () => {
    it("should enable PIN", () => {
      const { setPinEnabled, setPinHash } = useSecurityStore.getState()

      setPinEnabled(true)
      setPinHash("hashed-pin-123")

      const state = useSecurityStore.getState()
      expect(state.pinEnabled).toBe(true)
      expect(state.pinHash).toBe("hashed-pin-123")
    })

    it("should increment PIN attempts", () => {
      const { incrementPinAttempts } = useSecurityStore.getState()

      incrementPinAttempts()
      expect(useSecurityStore.getState().pinAttempts).toBe(1)

      incrementPinAttempts()
      expect(useSecurityStore.getState().pinAttempts).toBe(2)
    })

    it("should lock after 5 failed attempts", () => {
      const { incrementPinAttempts } = useSecurityStore.getState()

      for (let i = 0; i < 5; i++) {
        incrementPinAttempts()
      }

      const state = useSecurityStore.getState()
      expect(state.pinAttempts).toBe(5)
      expect(state.pinLockedUntil).not.toBeNull()
    })

    it("should reset PIN attempts", () => {
      const { incrementPinAttempts, resetPinAttempts } =
        useSecurityStore.getState()

      incrementPinAttempts()
      incrementPinAttempts()
      resetPinAttempts()

      const state = useSecurityStore.getState()
      expect(state.pinAttempts).toBe(0)
      expect(state.pinLockedUntil).toBeNull()
    })

    it("should lock PIN until specific time", () => {
      const { lockPin } = useSecurityStore.getState()
      const lockUntil = Date.now() + 60000

      lockPin(lockUntil)
      expect(useSecurityStore.getState().pinLockedUntil).toBe(lockUntil)
    })
  })

  describe("Auto Lock", () => {
    it("should enable auto lock", () => {
      const { setAutoLockEnabled } = useSecurityStore.getState()

      setAutoLockEnabled(false)
      expect(useSecurityStore.getState().autoLockEnabled).toBe(false)

      setAutoLockEnabled(true)
      expect(useSecurityStore.getState().autoLockEnabled).toBe(true)
    })

    it("should set auto lock timeout", () => {
      const { setAutoLockTimeout } = useSecurityStore.getState()

      setAutoLockTimeout("1min")
      expect(useSecurityStore.getState().autoLockTimeout).toBe("1min")

      setAutoLockTimeout("never")
      expect(useSecurityStore.getState().autoLockTimeout).toBe("never")
    })

    it("should update last activity", () => {
      const { updateLastActivity } = useSecurityStore.getState()
      const before = useSecurityStore.getState().lastActivityAt

      vi.advanceTimersByTime(1000)
      updateLastActivity()

      expect(useSecurityStore.getState().lastActivityAt).toBeGreaterThan(before)
    })
  })

  describe("App Security", () => {
    it("should toggle hide balance on background", () => {
      const { setHideBalanceOnBackground } = useSecurityStore.getState()

      setHideBalanceOnBackground(false)
      expect(useSecurityStore.getState().hideBalanceOnBackground).toBe(false)
    })

    it("should toggle screenshot protection", () => {
      const { setScreenshotProtection } = useSecurityStore.getState()

      setScreenshotProtection(false)
      expect(useSecurityStore.getState().screenshotProtection).toBe(false)
    })
  })

  describe("Authentication", () => {
    it("should lock app", () => {
      const { lock } = useSecurityStore.getState()

      lock()

      const state = useSecurityStore.getState()
      expect(state.isLocked).toBe(true)
      expect(state.isAuthenticated).toBe(false)
      expect(state.authExpiresAt).toBeNull()
    })

    it("should unlock app", () => {
      const { lock, unlock } = useSecurityStore.getState()

      lock()
      unlock()

      const state = useSecurityStore.getState()
      expect(state.isLocked).toBe(false)
      expect(state.isAuthenticated).toBe(true)
      expect(state.authExpiresAt).not.toBeNull()
    })

    it("should authenticate with custom expiry", () => {
      const { authenticate } = useSecurityStore.getState()
      const now = Date.now()

      authenticate(60000) // 1 minute

      const state = useSecurityStore.getState()
      expect(state.isAuthenticated).toBe(true)
      expect(state.authExpiresAt).toBeGreaterThanOrEqual(now + 60000)
    })

    it("should check auth expiry", () => {
      const { authenticate, checkAuthExpiry } = useSecurityStore.getState()

      authenticate(1000)
      expect(checkAuthExpiry()).toBe(true)

      // Simulate time passing
      vi.advanceTimersByTime(2000)
      expect(useSecurityStore.getState().checkAuthExpiry()).toBe(false)
    })

    it("should return false for unauthenticated", () => {
      const { checkAuthExpiry } = useSecurityStore.getState()
      expect(checkAuthExpiry()).toBe(false)
    })
  })

  describe("Reset", () => {
    it("should reset all security settings", () => {
      const { setBiometricsEnabled, setPinEnabled, setPinHash, resetSecurity } =
        useSecurityStore.getState()

      setBiometricsEnabled(true)
      setPinEnabled(true)
      setPinHash("test-hash")

      resetSecurity()

      const state = useSecurityStore.getState()
      expect(state.biometricsEnabled).toBe(false)
      expect(state.pinEnabled).toBe(false)
      expect(state.pinHash).toBeNull()
      expect(state.isLocked).toBe(false)
      expect(state.isAuthenticated).toBe(false)
    })
  })
})

describe("Security Helpers", () => {
  describe("getAutoLockMs", () => {
    it("should return correct milliseconds", () => {
      expect(getAutoLockMs("immediate")).toBe(0)
      expect(getAutoLockMs("1min")).toBe(60000)
      expect(getAutoLockMs("5min")).toBe(300000)
      expect(getAutoLockMs("15min")).toBe(900000)
      expect(getAutoLockMs("30min")).toBe(1800000)
      expect(getAutoLockMs("never")).toBe(Infinity)
    })
  })

  describe("formatAutoLockTimeout", () => {
    it("should return human-readable strings", () => {
      expect(formatAutoLockTimeout("immediate")).toBe("Immediately")
      expect(formatAutoLockTimeout("1min")).toBe("1 minute")
      expect(formatAutoLockTimeout("5min")).toBe("5 minutes")
      expect(formatAutoLockTimeout("15min")).toBe("15 minutes")
      expect(formatAutoLockTimeout("30min")).toBe("30 minutes")
      expect(formatAutoLockTimeout("never")).toBe("Never")
    })
  })
})
