/**
 * Compliance Store Tests
 */

import { describe, it, expect, beforeEach } from "vitest"
import { useComplianceStore } from "@/stores/compliance"

describe("Compliance Store", () => {
  beforeEach(() => {
    // Reset store state before each test
    useComplianceStore.setState({
      auditEvents: [],
      privacyScore: 0,
      scoreBreakdown: {
        transactionPrivacy: 0,
        keyManagement: 0,
        disclosureControl: 0,
        scanningFrequency: 0,
      },
      lastScoreUpdate: null,
      reportHistory: [],
    })
  })

  describe("Audit Events", () => {
    it("should add audit event", () => {
      const { addAuditEvent } = useComplianceStore.getState()

      addAuditEvent("key_export", "Exported viewing key")

      const { auditEvents } = useComplianceStore.getState()
      expect(auditEvents).toHaveLength(1)
      expect(auditEvents[0].type).toBe("key_export")
      expect(auditEvents[0].description).toBe("Exported viewing key")
    })

    it("should add audit event with metadata", () => {
      const { addAuditEvent } = useComplianceStore.getState()

      addAuditEvent("payment_sent", "Sent 10 SOL", { amount: 10, token: "SOL" })

      const { auditEvents } = useComplianceStore.getState()
      expect(auditEvents[0].metadata).toEqual({ amount: 10, token: "SOL" })
    })

    it("should prepend new events", () => {
      const { addAuditEvent } = useComplianceStore.getState()

      addAuditEvent("key_export", "First event")
      addAuditEvent("payment_sent", "Second event")

      const { auditEvents } = useComplianceStore.getState()
      expect(auditEvents[0].description).toBe("Second event")
      expect(auditEvents[1].description).toBe("First event")
    })

    it("should limit to 100 events", () => {
      const { addAuditEvent } = useComplianceStore.getState()

      // Add 105 events
      for (let i = 0; i < 105; i++) {
        addAuditEvent("scan_performed", `Event ${i}`)
      }

      const { auditEvents } = useComplianceStore.getState()
      expect(auditEvents).toHaveLength(100)
      expect(auditEvents[0].description).toBe("Event 104")
    })

    it("should clear audit trail", () => {
      const { addAuditEvent, clearAuditTrail } = useComplianceStore.getState()

      addAuditEvent("key_export", "Event 1")
      addAuditEvent("key_export", "Event 2")

      clearAuditTrail()

      const { auditEvents } = useComplianceStore.getState()
      expect(auditEvents).toHaveLength(0)
    })
  })

  describe("Privacy Score", () => {
    it("should update privacy score with breakdown", () => {
      const { updatePrivacyScore } = useComplianceStore.getState()

      const breakdown = {
        transactionPrivacy: 80,
        keyManagement: 70,
        disclosureControl: 90,
        scanningFrequency: 60,
      }

      updatePrivacyScore(75, breakdown)

      const state = useComplianceStore.getState()
      expect(state.privacyScore).toBe(75)
      expect(state.scoreBreakdown).toEqual(breakdown)
      expect(state.lastScoreUpdate).toBeTruthy()
    })
  })

  describe("Report History", () => {
    it("should add report to history", () => {
      const { addReportToHistory } = useComplianceStore.getState()

      addReportToHistory({
        dateRange: "30d",
        includeTransactions: true,
        includeDisclosures: true,
        includeAuditTrail: false,
        format: "json",
      })

      const { reportHistory } = useComplianceStore.getState()
      expect(reportHistory).toHaveLength(1)
      expect(reportHistory[0].config.dateRange).toBe("30d")
      expect(reportHistory[0].config.includeTransactions).toBe(true)
    })

    it("should limit to 10 reports", () => {
      const { addReportToHistory } = useComplianceStore.getState()

      for (let i = 0; i < 15; i++) {
        addReportToHistory({
          dateRange: "7d",
          includeTransactions: true,
          includeDisclosures: false,
          includeAuditTrail: false,
          format: "json",
        })
      }

      const { reportHistory } = useComplianceStore.getState()
      expect(reportHistory).toHaveLength(10)
    })
  })
})
