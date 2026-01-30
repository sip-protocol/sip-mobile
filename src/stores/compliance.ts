import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { MAX_AUDIT_EVENTS, MAX_COMPLIANCE_REPORTS } from "@/constants/security"

/**
 * Audit event types for compliance tracking
 */
export type AuditEventType =
  | "key_export"
  | "key_disclosure"
  | "key_revocation"
  | "key_import"
  | "payment_sent"
  | "payment_received"
  | "payment_claimed"
  | "swap_executed"
  | "scan_performed"
  | "report_generated"

/**
 * Audit event record
 */
export interface AuditEvent {
  id: string
  type: AuditEventType
  timestamp: number
  description: string
  metadata?: Record<string, unknown>
}

/**
 * Privacy score breakdown
 */
export interface PrivacyScoreBreakdown {
  // Components (0-100 each)
  transactionPrivacy: number // % of shielded transactions
  keyManagement: number // Viewing key hygiene
  disclosureControl: number // Disclosure management
  scanningFrequency: number // Regular payment scanning
}

/**
 * Compliance report configuration
 */
export interface ReportConfig {
  dateRange: "7d" | "30d" | "90d" | "all"
  includeTransactions: boolean
  includeDisclosures: boolean
  includeAuditTrail: boolean
  format: "json" | "pdf"
}

interface ComplianceStore {
  // Audit trail
  auditEvents: AuditEvent[]
  addAuditEvent: (
    type: AuditEventType,
    description: string,
    metadata?: Record<string, unknown>
  ) => void
  clearAuditTrail: () => void

  // Privacy score (cached)
  privacyScore: number
  scoreBreakdown: PrivacyScoreBreakdown
  lastScoreUpdate: number | null
  updatePrivacyScore: (score: number, breakdown: PrivacyScoreBreakdown) => void

  // Report history
  reportHistory: Array<{
    id: string
    generatedAt: number
    config: ReportConfig
  }>
  addReportToHistory: (config: ReportConfig) => void
}

const MAX_REPORTS = MAX_COMPLIANCE_REPORTS

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export const useComplianceStore = create<ComplianceStore>()(
  persist(
    (set) => ({
      // Audit trail
      auditEvents: [],

      addAuditEvent: (type, description, metadata) => {
        const event: AuditEvent = {
          id: generateId(),
          type,
          timestamp: Date.now(),
          description,
          metadata,
        }
        set((state) => ({
          auditEvents: [event, ...state.auditEvents].slice(0, MAX_AUDIT_EVENTS),
        }))
      },

      clearAuditTrail: () => set({ auditEvents: [] }),

      // Privacy score
      privacyScore: 0,
      scoreBreakdown: {
        transactionPrivacy: 0,
        keyManagement: 0,
        disclosureControl: 0,
        scanningFrequency: 0,
      },
      lastScoreUpdate: null,

      updatePrivacyScore: (score, breakdown) =>
        set({
          privacyScore: score,
          scoreBreakdown: breakdown,
          lastScoreUpdate: Date.now(),
        }),

      // Report history
      reportHistory: [],

      addReportToHistory: (config) =>
        set((state) => ({
          reportHistory: [
            {
              id: generateId(),
              generatedAt: Date.now(),
              config,
            },
            ...state.reportHistory,
          ].slice(0, MAX_REPORTS),
        })),
    }),
    {
      name: "sip-compliance",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)
