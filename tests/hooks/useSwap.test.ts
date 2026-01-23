/**
 * useSwap Hook Tests
 */

import { describe, it, expect } from "vitest"
import {
  getSwapStatusMessage,
  isSwapComplete,
  isSwapInProgress,
  type SwapStatus,
} from "@/hooks/useSwap"

describe("useSwap Utilities", () => {
  describe("getSwapStatusMessage", () => {
    it("should return confirming message", () => {
      expect(getSwapStatusMessage("confirming", false)).toBe("Preparing transaction...")
      expect(getSwapStatusMessage("confirming", true)).toBe("Preparing transaction...")
    })

    it("should return signing message", () => {
      expect(getSwapStatusMessage("signing", false)).toBe("Please approve in your wallet...")
      expect(getSwapStatusMessage("signing", true)).toBe("Please approve in your wallet...")
    })

    it("should return submitting message with privacy variant", () => {
      expect(getSwapStatusMessage("submitting", false)).toBe("Submitting swap...")
      expect(getSwapStatusMessage("submitting", true)).toBe("Submitting private swap...")
    })

    it("should return success message", () => {
      expect(getSwapStatusMessage("success", false)).toBe("Swap complete!")
      expect(getSwapStatusMessage("success", true)).toBe("Swap complete!")
    })

    it("should return error message", () => {
      expect(getSwapStatusMessage("error", false)).toBe("Swap failed")
      expect(getSwapStatusMessage("error", true)).toBe("Swap failed")
    })

    it("should return empty for idle", () => {
      expect(getSwapStatusMessage("idle", false)).toBe("")
    })
  })

  describe("isSwapComplete", () => {
    it("should return true for success", () => {
      expect(isSwapComplete("success")).toBe(true)
    })

    it("should return true for error", () => {
      expect(isSwapComplete("error")).toBe(true)
    })

    it("should return false for other statuses", () => {
      const inProgressStatuses: SwapStatus[] = ["idle", "confirming", "signing", "submitting"]
      inProgressStatuses.forEach((status) => {
        expect(isSwapComplete(status)).toBe(false)
      })
    })
  })

  describe("isSwapInProgress", () => {
    it("should return true for confirming", () => {
      expect(isSwapInProgress("confirming")).toBe(true)
    })

    it("should return true for signing", () => {
      expect(isSwapInProgress("signing")).toBe(true)
    })

    it("should return true for submitting", () => {
      expect(isSwapInProgress("submitting")).toBe(true)
    })

    it("should return false for idle", () => {
      expect(isSwapInProgress("idle")).toBe(false)
    })

    it("should return false for success", () => {
      expect(isSwapInProgress("success")).toBe(false)
    })

    it("should return false for error", () => {
      expect(isSwapInProgress("error")).toBe(false)
    })
  })
})
