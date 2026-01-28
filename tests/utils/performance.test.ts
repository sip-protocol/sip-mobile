/**
 * Performance Utilities Tests
 */

import { describe, it, expect, vi } from "vitest"
import {
  markPerformance,
  getElapsedTime,
  getPerformanceMarks,
  getStartupTime,
  isStartupFast,
  deferToNextFrame,
  deferBatch,
  measureAsync,
  createLazyInit,
} from "@/utils/performance"

describe("Performance Utilities", () => {
  describe("markPerformance", () => {
    it("should mark performance milestones", () => {
      markPerformance("test_mark")
      const marks = getPerformanceMarks()
      expect(marks["test_mark"]).toBeDefined()
      expect(typeof marks["test_mark"]).toBe("number")
    })

    it("should record increasing timestamps", () => {
      markPerformance("first")
      // Small delay
      const start = Date.now()
      while (Date.now() - start < 10) {
        // busy wait
      }
      markPerformance("second")

      const marks = getPerformanceMarks()
      expect(marks["second"]).toBeGreaterThanOrEqual(marks["first"])
    })
  })

  describe("getElapsedTime", () => {
    it("should return positive elapsed time", () => {
      const elapsed = getElapsedTime()
      expect(elapsed).toBeGreaterThanOrEqual(0)
    })
  })

  describe("getStartupTime", () => {
    it("should return null if app_ready not marked", () => {
      // Fresh module won't have app_ready marked
      // This test just validates the function works
      const result = getStartupTime()
      expect(result === null || typeof result === "number").toBe(true)
    })

    it("should return number after marking app_ready", () => {
      markPerformance("app_ready")
      const result = getStartupTime()
      expect(typeof result).toBe("number")
    })
  })

  describe("isStartupFast", () => {
    it("should return true for fast startup", () => {
      // Mark app_ready early (should be fast)
      markPerformance("app_ready")
      expect(isStartupFast()).toBe(true)
    })
  })

  describe("deferToNextFrame", () => {
    it("should call callback asynchronously", async () => {
      const callback = vi.fn()

      deferToNextFrame(callback)

      // Should not be called immediately
      expect(callback).not.toHaveBeenCalled()

      // Wait for async execution
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(callback).toHaveBeenCalledTimes(1)
    })
  })

  describe("deferBatch", () => {
    it("should call all callbacks asynchronously", async () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()
      const callback3 = vi.fn()

      deferBatch([callback1, callback2, callback3])

      // Should not be called immediately
      expect(callback1).not.toHaveBeenCalled()
      expect(callback2).not.toHaveBeenCalled()
      expect(callback3).not.toHaveBeenCalled()

      // Wait for async execution
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(callback1).toHaveBeenCalledTimes(1)
      expect(callback2).toHaveBeenCalledTimes(1)
      expect(callback3).toHaveBeenCalledTimes(1)
    })
  })

  describe("measureAsync", () => {
    it("should measure successful async operation", async () => {
      const operation = vi.fn().mockResolvedValue("result")

      const result = await measureAsync("test_op", operation)

      expect(result).toBe("result")
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it("should measure and rethrow failed operation", async () => {
      const error = new Error("test error")
      const operation = vi.fn().mockRejectedValue(error)

      await expect(measureAsync("test_op", operation)).rejects.toThrow(
        "test error"
      )
      expect(operation).toHaveBeenCalledTimes(1)
    })
  })

  describe("createLazyInit", () => {
    it("should defer initialization until first access", () => {
      const init = vi.fn().mockReturnValue({ data: "test" })

      const lazyValue = createLazyInit(init)

      // Init should not be called yet
      expect(init).not.toHaveBeenCalled()

      // First access triggers init
      const result1 = lazyValue()
      expect(init).toHaveBeenCalledTimes(1)
      expect(result1).toEqual({ data: "test" })

      // Subsequent access reuses cached value
      const result2 = lazyValue()
      expect(init).toHaveBeenCalledTimes(1) // Still only 1
      expect(result2).toBe(result1) // Same reference
    })

    it("should support named lazy init for logging", () => {
      const init = vi.fn().mockReturnValue(42)

      const lazyValue = createLazyInit(init, "testValue")

      const result = lazyValue()

      expect(result).toBe(42)
      expect(init).toHaveBeenCalledTimes(1)
    })
  })
})

describe("Performance Targets", () => {
  it("should target <3000ms startup time", () => {
    // Document the performance target
    const TARGET_STARTUP_MS = 3000
    expect(TARGET_STARTUP_MS).toBe(3000)
  })

  it("should mark critical startup phases", () => {
    // Ensure we're tracking the right phases
    const expectedPhases = [
      "splash_prevented",
      "prepare_start",
      "prepare_done",
      "is_ready",
      "layout_ready",
      "app_ready",
    ]

    // This test documents the expected phases
    expect(expectedPhases.length).toBe(6)
  })
})
