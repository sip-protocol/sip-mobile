/**
 * useCompliance Hook Tests
 */

import { describe, it, expect, beforeEach } from "vitest"
import { useComplianceStore } from "@/stores/compliance"
import { usePrivacyStore } from "@/stores/privacy"
import type { PaymentRecord } from "@/types"

// Test the compliance store directly since the hook depends on stores
describe("Compliance Store Integration", () => {
  beforeEach(() => {
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

    usePrivacyStore.setState({
      privacyLevel: "shielded",
      spendingPublicKey: null,
      viewingPublicKey: null,
      payments: [],
      isScanning: false,
      lastScanTimestamp: null,
    })
  })

  describe("Audit Event Types", () => {
    it("should track key_export events", () => {
      const { addAuditEvent } = useComplianceStore.getState()

      addAuditEvent("key_export", "Exported viewing key to auditor")

      const { auditEvents } = useComplianceStore.getState()
      expect(auditEvents[0].type).toBe("key_export")
    })

    it("should track payment_sent events", () => {
      const { addAuditEvent } = useComplianceStore.getState()

      addAuditEvent("payment_sent", "Sent 10 SOL", { amount: 10, token: "SOL" })

      const { auditEvents } = useComplianceStore.getState()
      expect(auditEvents[0].type).toBe("payment_sent")
      expect(auditEvents[0].metadata?.amount).toBe(10)
    })

    it("should track scan_performed events", () => {
      const { addAuditEvent } = useComplianceStore.getState()

      addAuditEvent("scan_performed", "Scanned for incoming payments")

      const { auditEvents } = useComplianceStore.getState()
      expect(auditEvents[0].type).toBe("scan_performed")
    })

    it("should track swap_executed events", () => {
      const { addAuditEvent } = useComplianceStore.getState()

      addAuditEvent("swap_executed", "Swapped 1 SOL for 185 USDC", {
        fromToken: "SOL",
        toToken: "USDC",
        fromAmount: 1,
        toAmount: 185,
      })

      const { auditEvents } = useComplianceStore.getState()
      expect(auditEvents[0].type).toBe("swap_executed")
    })
  })

  describe("Privacy Score Calculation Logic", () => {
    it("should track score with breakdown", () => {
      const { updatePrivacyScore } = useComplianceStore.getState()

      const breakdown = {
        transactionPrivacy: 85,
        keyManagement: 70,
        disclosureControl: 90,
        scanningFrequency: 60,
      }

      updatePrivacyScore(76, breakdown)

      const state = useComplianceStore.getState()
      expect(state.privacyScore).toBe(76)
      expect(state.scoreBreakdown.transactionPrivacy).toBe(85)
    })

    it("should update score timestamp", () => {
      const { updatePrivacyScore } = useComplianceStore.getState()
      const before = Date.now()

      updatePrivacyScore(50, {
        transactionPrivacy: 50,
        keyManagement: 50,
        disclosureControl: 50,
        scanningFrequency: 50,
      })

      const { lastScoreUpdate } = useComplianceStore.getState()
      expect(lastScoreUpdate).toBeGreaterThanOrEqual(before)
    })
  })

  describe("Report Configuration", () => {
    it("should store report with all options enabled", () => {
      const { addReportToHistory } = useComplianceStore.getState()

      addReportToHistory({
        dateRange: "90d",
        includeTransactions: true,
        includeDisclosures: true,
        includeAuditTrail: true,
        format: "json",
      })

      const { reportHistory } = useComplianceStore.getState()
      expect(reportHistory[0].config.includeTransactions).toBe(true)
      expect(reportHistory[0].config.includeDisclosures).toBe(true)
      expect(reportHistory[0].config.includeAuditTrail).toBe(true)
    })

    it("should support PDF format", () => {
      const { addReportToHistory } = useComplianceStore.getState()

      addReportToHistory({
        dateRange: "7d",
        includeTransactions: true,
        includeDisclosures: false,
        includeAuditTrail: false,
        format: "pdf",
      })

      const { reportHistory } = useComplianceStore.getState()
      expect(reportHistory[0].config.format).toBe("pdf")
    })

    it("should support different date ranges", () => {
      const { addReportToHistory } = useComplianceStore.getState()

      addReportToHistory({
        dateRange: "all",
        includeTransactions: true,
        includeDisclosures: true,
        includeAuditTrail: true,
        format: "json",
      })

      const { reportHistory } = useComplianceStore.getState()
      expect(reportHistory[0].config.dateRange).toBe("all")
    })
  })

  describe("Privacy Level Impact", () => {
    it("should track shielded transactions", () => {
      const { addPayment } = usePrivacyStore.getState()
      const { addAuditEvent } = useComplianceStore.getState()

      const payment: PaymentRecord = {
        id: "pay-1",
        type: "send",
        amount: "10",
        token: "SOL",
        status: "completed",
        timestamp: Date.now(),
        privacyLevel: "shielded",
      }

      addPayment(payment)
      addAuditEvent("payment_sent", "Sent 10 SOL (shielded)", {
        privacyLevel: "shielded",
      })

      const { payments } = usePrivacyStore.getState()
      const { auditEvents } = useComplianceStore.getState()

      expect(payments[0].privacyLevel).toBe("shielded")
      expect(auditEvents[0].metadata?.privacyLevel).toBe("shielded")
    })

    it("should track transparent transactions", () => {
      const { addPayment } = usePrivacyStore.getState()
      const { addAuditEvent } = useComplianceStore.getState()

      const payment: PaymentRecord = {
        id: "pay-2",
        type: "send",
        amount: "5",
        token: "USDC",
        status: "completed",
        timestamp: Date.now(),
        privacyLevel: "transparent",
      }

      addPayment(payment)
      addAuditEvent("payment_sent", "Sent 5 USDC (transparent)", {
        privacyLevel: "transparent",
      })

      const { auditEvents } = useComplianceStore.getState()
      expect(auditEvents[0].metadata?.privacyLevel).toBe("transparent")
    })
  })

  describe("Key Management Tracking", () => {
    it("should track key disclosure", () => {
      const { addAuditEvent } = useComplianceStore.getState()

      addAuditEvent("key_disclosure", "Disclosed viewing key to auditor", {
        recipient: "auditor@example.com",
        expiresAt: Date.now() + 86400000,
      })

      const { auditEvents } = useComplianceStore.getState()
      expect(auditEvents[0].type).toBe("key_disclosure")
      expect(auditEvents[0].metadata?.recipient).toBe("auditor@example.com")
    })

    it("should track key revocation", () => {
      const { addAuditEvent } = useComplianceStore.getState()

      addAuditEvent("key_revocation", "Revoked viewing key access")

      const { auditEvents } = useComplianceStore.getState()
      expect(auditEvents[0].type).toBe("key_revocation")
    })

    it("should track key import", () => {
      const { addAuditEvent } = useComplianceStore.getState()

      addAuditEvent("key_import", "Imported viewing key from backup")

      const { auditEvents } = useComplianceStore.getState()
      expect(auditEvents[0].type).toBe("key_import")
    })
  })
})
