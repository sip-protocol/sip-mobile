import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import AsyncStorage from "@react-native-async-storage/async-storage"
import type { SwapRecord } from "@/types"
import { MAX_SWAP_HISTORY } from "@/constants/security"

/**
 * Swap execution mode
 */
export type SwapMode = "preview" | "execute"

interface SwapStore {
  // Mode
  mode: SwapMode
  toggleMode: () => void
  setMode: (mode: SwapMode) => void
  isPreviewMode: () => boolean

  // History
  swaps: SwapRecord[]
  addSwap: (swap: SwapRecord) => void
  updateSwap: (id: string, updates: Partial<SwapRecord>) => void
  getSwap: (id: string) => SwapRecord | undefined
  clearHistory: () => void
}

const MAX_HISTORY = MAX_SWAP_HISTORY

export const useSwapStore = create<SwapStore>()(
  persist(
    (set, get) => ({
      // Mode
      mode: "preview", // Default to preview for safety

      toggleMode: () => {
        set((state) => ({
          mode: state.mode === "preview" ? "execute" : "preview",
        }))
      },

      setMode: (mode) => set({ mode }),

      isPreviewMode: () => get().mode === "preview",

      // History
      swaps: [],

      addSwap: (swap) =>
        set((state) => ({
          swaps: [swap, ...state.swaps].slice(0, MAX_HISTORY),
        })),

      updateSwap: (id, updates) =>
        set((state) => ({
          swaps: state.swaps.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        })),

      getSwap: (id) => get().swaps.find((s) => s.id === id),

      clearHistory: () => set({ swaps: [] }),
    }),
    {
      name: "sip-swap",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)
