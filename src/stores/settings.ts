import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import AsyncStorage from "@react-native-async-storage/async-storage"
import type { PrivacyLevel } from "@/types"

/**
 * Slippage presets (as percentages)
 */
export const SLIPPAGE_PRESETS = [0.1, 0.5, 1.0, 3.0] as const

interface SettingsStore {
  // Swap settings
  slippage: number
  setSlippage: (slippage: number) => void
  getSlippageDecimal: () => number

  // Privacy settings
  defaultPrivacyLevel: PrivacyLevel
  setDefaultPrivacyLevel: (level: PrivacyLevel) => void

  // App settings
  biometricsEnabled: boolean
  setBiometricsEnabled: (enabled: boolean) => void

  // Network
  network: "mainnet" | "devnet"
  setNetwork: (network: "mainnet" | "devnet") => void

  // RPC Provider
  rpcProvider: "helius" | "quicknode" | "triton" | "generic"
  setRpcProvider: (provider: "helius" | "quicknode" | "triton" | "generic") => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      // Swap settings
      slippage: 1.0, // Default 1%

      setSlippage: (slippage) => {
        const clamped = Math.max(0.01, Math.min(50, slippage))
        set({ slippage: clamped })
      },

      getSlippageDecimal: () => get().slippage / 100,

      // Privacy settings
      defaultPrivacyLevel: "shielded",
      setDefaultPrivacyLevel: (level) => set({ defaultPrivacyLevel: level }),

      // App settings
      biometricsEnabled: false,
      setBiometricsEnabled: (enabled) => set({ biometricsEnabled: enabled }),

      // Network
      network: "devnet",
      setNetwork: (network) => set({ network }),

      // RPC Provider
      rpcProvider: "helius",
      setRpcProvider: (provider) => set({ rpcProvider: provider }),
    }),
    {
      name: "sip-settings",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)
