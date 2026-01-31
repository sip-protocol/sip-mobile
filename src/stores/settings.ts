import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import AsyncStorage from "@react-native-async-storage/async-storage"
import type { PrivacyLevel } from "@/types"
import type { PrivacyProviderType } from "@/privacy-providers"

/**
 * Slippage presets (as percentages)
 */
export const SLIPPAGE_PRESETS = [0.1, 0.5, 1.0, 3.0] as const

// Re-export PrivacyProviderType for convenience
export type { PrivacyProviderType } from "@/privacy-providers"

export type ExplorerType = "solscan" | "solana-explorer"

interface SettingsStore {
  // Hydration tracking (for gate logic)
  _hasHydrated: boolean

  // Onboarding (mandatory education)
  hasCompletedOnboarding: boolean
  setOnboardingCompleted: () => void
  resetOnboarding: () => void

  // Swap settings
  slippage: number
  setSlippage: (slippage: number) => void
  getSlippageDecimal: () => number

  // Privacy settings
  defaultPrivacyLevel: PrivacyLevel
  setDefaultPrivacyLevel: (level: PrivacyLevel) => void

  // Privacy Provider (#73)
  privacyProvider: PrivacyProviderType
  setPrivacyProvider: (provider: PrivacyProviderType) => void

  // App settings
  biometricsEnabled: boolean
  setBiometricsEnabled: (enabled: boolean) => void

  // Network
  network: "mainnet-beta" | "devnet" | "testnet"
  setNetwork: (network: "mainnet-beta" | "devnet" | "testnet") => void

  // RPC Provider
  rpcProvider: "helius" | "quicknode" | "triton" | "publicnode"
  setRpcProvider: (provider: "helius" | "quicknode" | "triton" | "publicnode") => void

  // Explorer preference
  defaultExplorer: ExplorerType
  setDefaultExplorer: (explorer: ExplorerType) => void

  // API Keys (user overrides)
  heliusApiKey: string | null
  setHeliusApiKey: (key: string | null) => void
  quicknodeApiKey: string | null
  setQuicknodeApiKey: (key: string | null) => void
  tritonEndpoint: string | null
  setTritonEndpoint: (endpoint: string | null) => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      // Hydration tracking
      _hasHydrated: false,

      // Onboarding (mandatory education)
      hasCompletedOnboarding: false,
      setOnboardingCompleted: () => set({ hasCompletedOnboarding: true }),
      resetOnboarding: () => set({ hasCompletedOnboarding: false }),

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

      // Privacy Provider (#73) - "OpenRouter for Privacy"
      privacyProvider: "sip-native",
      setPrivacyProvider: (provider) => set({ privacyProvider: provider }),

      // App settings
      biometricsEnabled: false,
      setBiometricsEnabled: (enabled) => set({ biometricsEnabled: enabled }),

      // Network
      network: "devnet",
      setNetwork: (network) => set({ network }),

      // RPC Provider
      rpcProvider: "helius",
      setRpcProvider: (provider) => set({ rpcProvider: provider }),

      // Explorer preference
      defaultExplorer: "solscan",
      setDefaultExplorer: (explorer) => set({ defaultExplorer: explorer }),

      // API Keys (user overrides)
      heliusApiKey: null,
      setHeliusApiKey: (key) => set({ heliusApiKey: key }),
      quicknodeApiKey: null,
      setQuicknodeApiKey: (key) => set({ quicknodeApiKey: key }),
      tritonEndpoint: null,
      setTritonEndpoint: (endpoint) => set({ tritonEndpoint: endpoint }),
    }),
    {
      name: "sip-settings",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        slippage: state.slippage,
        defaultPrivacyLevel: state.defaultPrivacyLevel,
        privacyProvider: state.privacyProvider,
        biometricsEnabled: state.biometricsEnabled,
        network: state.network,
        rpcProvider: state.rpcProvider,
        defaultExplorer: state.defaultExplorer,
        heliusApiKey: state.heliusApiKey,
        quicknodeApiKey: state.quicknodeApiKey,
        tritonEndpoint: state.tritonEndpoint,
      }),
      onRehydrateStorage: () => () => {
        useSettingsStore.setState({ _hasHydrated: true })
      },
    }
  )
)
