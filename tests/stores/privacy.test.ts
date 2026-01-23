/**
 * Privacy Store Tests
 */

import { describe, it, expect, beforeEach } from "vitest"
import { usePrivacyStore } from "@/stores/privacy"
import type { PaymentRecord } from "@/types"

describe("Privacy Store", () => {
  beforeEach(() => {
    usePrivacyStore.setState({
      privacyLevel: "shielded",
      spendingPublicKey: null,
      viewingPublicKey: null,
      payments: [],
      isScanning: false,
      lastScanTimestamp: null,
    })
  })

  describe("Privacy Level", () => {
    it("should default to shielded", () => {
      const { privacyLevel } = usePrivacyStore.getState()
      expect(privacyLevel).toBe("shielded")
    })

    it("should set privacy level", () => {
      const { setPrivacyLevel } = usePrivacyStore.getState()

      setPrivacyLevel("transparent")
      expect(usePrivacyStore.getState().privacyLevel).toBe("transparent")

      setPrivacyLevel("compliant")
      expect(usePrivacyStore.getState().privacyLevel).toBe("compliant")
    })
  })

  describe("Stealth Keys", () => {
    it("should set keys", () => {
      const { setKeys } = usePrivacyStore.getState()

      setKeys("spending-key", "viewing-key")

      const state = usePrivacyStore.getState()
      expect(state.spendingPublicKey).toBe("spending-key")
      expect(state.viewingPublicKey).toBe("viewing-key")
    })

    it("should clear keys", () => {
      const { setKeys, clearKeys } = usePrivacyStore.getState()

      setKeys("spending-key", "viewing-key")
      clearKeys()

      const state = usePrivacyStore.getState()
      expect(state.spendingPublicKey).toBeNull()
      expect(state.viewingPublicKey).toBeNull()
    })
  })

  describe("Payment History", () => {
    const mockPayment: PaymentRecord = {
      id: "payment-1",
      type: "send",
      amount: "10",
      token: "SOL",
      status: "completed",
      timestamp: Date.now(),
      privacyLevel: "shielded",
    }

    it("should add payment", () => {
      const { addPayment } = usePrivacyStore.getState()

      addPayment(mockPayment)

      const { payments } = usePrivacyStore.getState()
      expect(payments).toHaveLength(1)
      expect(payments[0].id).toBe("payment-1")
    })

    it("should prepend new payments", () => {
      const { addPayment } = usePrivacyStore.getState()

      addPayment({ ...mockPayment, id: "payment-1" })
      addPayment({ ...mockPayment, id: "payment-2" })

      const { payments } = usePrivacyStore.getState()
      expect(payments[0].id).toBe("payment-2")
    })

    it("should limit to 50 payments", () => {
      const { addPayment } = usePrivacyStore.getState()

      for (let i = 0; i < 55; i++) {
        addPayment({ ...mockPayment, id: `payment-${i}` })
      }

      const { payments } = usePrivacyStore.getState()
      expect(payments).toHaveLength(50)
    })

    it("should update payment", () => {
      const { addPayment, updatePayment } = usePrivacyStore.getState()

      addPayment(mockPayment)
      updatePayment("payment-1", { status: "claimed", claimed: true })

      const { payments } = usePrivacyStore.getState()
      expect(payments[0].status).toBe("claimed")
      expect(payments[0].claimed).toBe(true)
    })

    it("should get payment by id", () => {
      const { addPayment, getPayment } = usePrivacyStore.getState()

      addPayment(mockPayment)

      const payment = getPayment("payment-1")
      expect(payment).toBeDefined()
      expect(payment?.amount).toBe("10")
    })

    it("should clear payments", () => {
      const { addPayment, clearPayments } = usePrivacyStore.getState()

      addPayment(mockPayment)
      clearPayments()

      const { payments } = usePrivacyStore.getState()
      expect(payments).toHaveLength(0)
    })
  })

  describe("Scanning State", () => {
    it("should set scanning state", () => {
      const { setScanning } = usePrivacyStore.getState()

      setScanning(true)
      expect(usePrivacyStore.getState().isScanning).toBe(true)

      setScanning(false)
      expect(usePrivacyStore.getState().isScanning).toBe(false)
    })

    it("should set last scan timestamp", () => {
      const { setLastScanTimestamp } = usePrivacyStore.getState()
      const now = Date.now()

      setLastScanTimestamp(now)

      expect(usePrivacyStore.getState().lastScanTimestamp).toBe(now)
    })
  })
})
