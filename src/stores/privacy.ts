import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import AsyncStorage from "@react-native-async-storage/async-storage"
import type { PrivacyLevel, PaymentRecord } from "@/types"
import { MAX_CACHED_PAYMENTS } from "@/constants/security"

interface PrivacyStore {
  // Current privacy level for new transactions
  privacyLevel: PrivacyLevel
  setPrivacyLevel: (level: PrivacyLevel) => void

  // Stealth address management
  spendingPublicKey: string | null
  viewingPublicKey: string | null
  setKeys: (spending: string, viewing: string) => void
  clearKeys: () => void

  // Payment history
  payments: PaymentRecord[]
  addPayment: (payment: PaymentRecord) => void
  updatePayment: (id: string, updates: Partial<PaymentRecord>) => void
  getPayment: (id: string) => PaymentRecord | undefined
  clearPayments: () => void

  // Payment queries
  getUnclaimedPaymentsCount: () => number

  // Scanning state
  isScanning: boolean
  lastScanTimestamp: number | null
  setScanning: (scanning: boolean) => void
  setLastScanTimestamp: (timestamp: number) => void
}

const MAX_PAYMENTS = MAX_CACHED_PAYMENTS

export const usePrivacyStore = create<PrivacyStore>()(
  persist(
    (set, get) => ({
      // Privacy level
      privacyLevel: "shielded",
      setPrivacyLevel: (level) => set({ privacyLevel: level }),

      // Stealth keys (NOT persisted for security - handled separately)
      spendingPublicKey: null,
      viewingPublicKey: null,
      setKeys: (spending, viewing) =>
        set({ spendingPublicKey: spending, viewingPublicKey: viewing }),
      clearKeys: () =>
        set({ spendingPublicKey: null, viewingPublicKey: null }),

      // Payment history
      payments: [],
      addPayment: (payment) =>
        set((state) => ({
          payments: [payment, ...state.payments].slice(0, MAX_PAYMENTS),
        })),
      updatePayment: (id, updates) =>
        set((state) => ({
          payments: state.payments.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        })),
      getPayment: (id) => get().payments.find((p) => p.id === id),
      clearPayments: () => set({ payments: [] }),

      // Payment queries
      getUnclaimedPaymentsCount: () =>
        get().payments.filter(
          (p) => p.type === "receive" && !p.claimed && p.status !== "failed"
        ).length,

      // Scanning
      isScanning: false,
      lastScanTimestamp: null,
      setScanning: (scanning) => set({ isScanning: scanning }),
      setLastScanTimestamp: (timestamp) =>
        set({ lastScanTimestamp: timestamp }),
    }),
    {
      name: "sip-privacy",
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist certain fields - keys are handled by SecureStore
      partialize: (state) => ({
        privacyLevel: state.privacyLevel,
        payments: state.payments,
        lastScanTimestamp: state.lastScanTimestamp,
      }),
    }
  )
)
