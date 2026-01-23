/**
 * Swap Store Tests
 */

import { describe, it, expect, beforeEach } from "vitest"
import { useSwapStore } from "@/stores/swap"
import type { SwapRecord } from "@/types"

describe("Swap Store", () => {
  beforeEach(() => {
    useSwapStore.setState({
      mode: "preview",
      swaps: [],
    })
  })

  describe("Mode", () => {
    it("should default to preview mode", () => {
      const { mode, isPreviewMode } = useSwapStore.getState()
      expect(mode).toBe("preview")
      expect(isPreviewMode()).toBe(true)
    })

    it("should toggle mode", () => {
      const { toggleMode } = useSwapStore.getState()

      toggleMode()
      expect(useSwapStore.getState().mode).toBe("execute")

      toggleMode()
      expect(useSwapStore.getState().mode).toBe("preview")
    })

    it("should set mode directly", () => {
      const { setMode } = useSwapStore.getState()

      setMode("execute")
      expect(useSwapStore.getState().mode).toBe("execute")

      setMode("preview")
      expect(useSwapStore.getState().mode).toBe("preview")
    })
  })

  describe("Swap History", () => {
    const mockSwap: SwapRecord = {
      id: "swap-1",
      fromToken: "SOL",
      toToken: "USDC",
      fromAmount: "1",
      toAmount: "100",
      status: "completed",
      timestamp: Date.now(),
      privacyLevel: "shielded",
    }

    it("should add swap to history", () => {
      const { addSwap } = useSwapStore.getState()

      addSwap(mockSwap)

      const { swaps } = useSwapStore.getState()
      expect(swaps).toHaveLength(1)
      expect(swaps[0].id).toBe("swap-1")
    })

    it("should prepend new swaps", () => {
      const { addSwap } = useSwapStore.getState()

      addSwap({ ...mockSwap, id: "swap-1" })
      addSwap({ ...mockSwap, id: "swap-2" })

      const { swaps } = useSwapStore.getState()
      expect(swaps[0].id).toBe("swap-2")
      expect(swaps[1].id).toBe("swap-1")
    })

    it("should limit to 20 swaps", () => {
      const { addSwap } = useSwapStore.getState()

      for (let i = 0; i < 25; i++) {
        addSwap({ ...mockSwap, id: `swap-${i}` })
      }

      const { swaps } = useSwapStore.getState()
      expect(swaps).toHaveLength(20)
      expect(swaps[0].id).toBe("swap-24")
    })

    it("should update swap", () => {
      const { addSwap, updateSwap } = useSwapStore.getState()

      addSwap(mockSwap)
      updateSwap("swap-1", { status: "failed", error: "Transaction failed" })

      const { swaps } = useSwapStore.getState()
      expect(swaps[0].status).toBe("failed")
      expect(swaps[0].error).toBe("Transaction failed")
    })

    it("should get swap by id", () => {
      const { addSwap, getSwap } = useSwapStore.getState()

      addSwap(mockSwap)

      const swap = getSwap("swap-1")
      expect(swap).toBeDefined()
      expect(swap?.fromToken).toBe("SOL")
    })

    it("should return undefined for non-existent swap", () => {
      const { getSwap } = useSwapStore.getState()
      const swap = getSwap("non-existent")
      expect(swap).toBeUndefined()
    })

    it("should clear history", () => {
      const { addSwap, clearHistory } = useSwapStore.getState()

      addSwap(mockSwap)
      addSwap({ ...mockSwap, id: "swap-2" })

      clearHistory()

      const { swaps } = useSwapStore.getState()
      expect(swaps).toHaveLength(0)
    })
  })
})
