/**
 * Performance Utilities
 *
 * Startup time measurement and performance monitoring.
 * Target: <3s startup time
 */

// Store startup timestamps
const performanceMarks: Record<string, number> = {}
const startTime = Date.now()

/**
 * Mark a performance milestone
 */
export function markPerformance(name: string): void {
  performanceMarks[name] = Date.now() - startTime
  if (__DEV__) {
    console.log(`[Perf] ${name}: ${performanceMarks[name]}ms`)
  }
}

/**
 * Get time since app start
 */
export function getElapsedTime(): number {
  return Date.now() - startTime
}

/**
 * Get all performance marks
 */
export function getPerformanceMarks(): Record<string, number> {
  return { ...performanceMarks }
}

/**
 * Get startup time (time to first meaningful paint)
 */
export function getStartupTime(): number | null {
  return performanceMarks["app_ready"] ?? null
}

/**
 * Check if startup was fast (<3s)
 */
export function isStartupFast(): boolean {
  const startup = getStartupTime()
  return startup !== null && startup < 3000
}

/**
 * Log performance summary (dev only)
 */
export function logPerformanceSummary(): void {
  if (!__DEV__) return

  const marks = getPerformanceMarks()
  console.log("\n========== PERFORMANCE SUMMARY ==========")

  const sortedMarks = Object.entries(marks).sort((a, b) => a[1] - b[1])

  for (const [name, time] of sortedMarks) {
    const status = time < 1000 ? "✅" : time < 2000 ? "🟡" : "🔴"
    console.log(`${status} ${name}: ${time}ms`)
  }

  const startupTime = marks["app_ready"]
  if (startupTime !== undefined) {
    const status = startupTime < 3000 ? "✅ FAST" : "🔴 SLOW"
    console.log(`\n${status} Total startup: ${startupTime}ms (target: <3000ms)`)
  }

  console.log("==========================================\n")
}

/**
 * Defer a callback to next frame (for non-blocking init)
 * Falls back to setTimeout in environments without requestAnimationFrame
 */
export function deferToNextFrame(callback: () => void): void {
  const raf =
    typeof requestAnimationFrame !== "undefined"
      ? requestAnimationFrame
      : (cb: () => void) => setTimeout(cb, 16)

  raf(() => {
    setTimeout(callback, 0)
  })
}

/**
 * Batch multiple deferred operations
 * Falls back to setTimeout in environments without requestAnimationFrame
 */
export function deferBatch(callbacks: Array<() => void>): void {
  const raf =
    typeof requestAnimationFrame !== "undefined"
      ? requestAnimationFrame
      : (cb: () => void) => setTimeout(cb, 16)

  raf(() => {
    setTimeout(() => {
      for (const callback of callbacks) {
        callback()
      }
    }, 0)
  })
}

/**
 * Measure async operation time
 */
export async function measureAsync<T>(
  name: string,
  operation: () => Promise<T>
): Promise<T> {
  const start = Date.now()
  try {
    const result = await operation()
    const duration = Date.now() - start
    if (__DEV__) {
      console.log(`[Perf] ${name}: ${duration}ms`)
    }
    return result
  } catch (error) {
    const duration = Date.now() - start
    if (__DEV__) {
      console.log(`[Perf] ${name} (failed): ${duration}ms`)
    }
    throw error
  }
}

/**
 * Create a lazy initializer that defers work
 */
export function createLazyInit<T>(
  init: () => T,
  name?: string
): () => T {
  let value: T | undefined
  let initialized = false

  return () => {
    if (!initialized) {
      const start = Date.now()
      value = init()
      initialized = true
      if (__DEV__ && name) {
        console.log(`[Perf] Lazy init ${name}: ${Date.now() - start}ms`)
      }
    }
    return value as T
  }
}
