/**
 * Toast Store Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { useToastStore, toast } from "@/stores/toast"

describe("Toast Store", () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe("addToast", () => {
    it("should add toast", () => {
      const { addToast } = useToastStore.getState()

      addToast({ type: "success", title: "Test" })

      const { toasts } = useToastStore.getState()
      expect(toasts).toHaveLength(1)
      expect(toasts[0].type).toBe("success")
      expect(toasts[0].title).toBe("Test")
    })

    it("should generate unique id", () => {
      const { addToast } = useToastStore.getState()

      addToast({ type: "success", title: "Toast 1" })
      addToast({ type: "info", title: "Toast 2" })

      const { toasts } = useToastStore.getState()
      expect(toasts[0].id).not.toBe(toasts[1].id)
    })

    it("should include optional message", () => {
      const { addToast } = useToastStore.getState()

      addToast({ type: "error", title: "Error", message: "Something went wrong" })

      const { toasts } = useToastStore.getState()
      expect(toasts[0].message).toBe("Something went wrong")
    })

    it("should auto-remove after duration", () => {
      const { addToast } = useToastStore.getState()

      addToast({ type: "success", title: "Test", duration: 3000 })

      expect(useToastStore.getState().toasts).toHaveLength(1)

      vi.advanceTimersByTime(3000)

      expect(useToastStore.getState().toasts).toHaveLength(0)
    })

    it("should use default 5s duration", () => {
      const { addToast } = useToastStore.getState()

      addToast({ type: "success", title: "Test" })

      vi.advanceTimersByTime(4999)
      expect(useToastStore.getState().toasts).toHaveLength(1)

      vi.advanceTimersByTime(2)
      expect(useToastStore.getState().toasts).toHaveLength(0)
    })

    it("should not auto-remove with duration 0", () => {
      const { addToast } = useToastStore.getState()

      addToast({ type: "success", title: "Persistent", duration: 0 })

      vi.advanceTimersByTime(10000)

      expect(useToastStore.getState().toasts).toHaveLength(1)
    })
  })

  describe("removeToast", () => {
    it("should remove specific toast", () => {
      const { addToast, removeToast } = useToastStore.getState()

      addToast({ type: "success", title: "Toast 1", duration: 0 })
      addToast({ type: "info", title: "Toast 2", duration: 0 })

      const toastId = useToastStore.getState().toasts[0].id
      removeToast(toastId)

      const { toasts } = useToastStore.getState()
      expect(toasts).toHaveLength(1)
      expect(toasts[0].title).toBe("Toast 2")
    })
  })

  describe("clearToasts", () => {
    it("should clear all toasts", () => {
      const { addToast, clearToasts } = useToastStore.getState()

      addToast({ type: "success", title: "Toast 1", duration: 0 })
      addToast({ type: "info", title: "Toast 2", duration: 0 })
      addToast({ type: "error", title: "Toast 3", duration: 0 })

      clearToasts()

      expect(useToastStore.getState().toasts).toHaveLength(0)
    })
  })
})

describe("Toast Helper", () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it("should create success toast", () => {
    toast.success("Success!", "Operation completed")

    const { toasts } = useToastStore.getState()
    expect(toasts[0].type).toBe("success")
    expect(toasts[0].title).toBe("Success!")
    expect(toasts[0].message).toBe("Operation completed")
  })

  it("should create error toast", () => {
    toast.error("Error", "Something failed")

    const { toasts } = useToastStore.getState()
    expect(toasts[0].type).toBe("error")
    expect(toasts[0].title).toBe("Error")
  })

  it("should create warning toast", () => {
    toast.warning("Warning", "Be careful")

    const { toasts } = useToastStore.getState()
    expect(toasts[0].type).toBe("warning")
  })

  it("should create info toast", () => {
    toast.info("Info", "Just FYI")

    const { toasts } = useToastStore.getState()
    expect(toasts[0].type).toBe("info")
  })

  it("should work without message", () => {
    toast.success("Title only")

    const { toasts } = useToastStore.getState()
    expect(toasts[0].title).toBe("Title only")
    expect(toasts[0].message).toBeUndefined()
  })
})
