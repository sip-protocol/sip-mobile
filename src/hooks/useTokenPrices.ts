/**
 * Token Prices Hook
 *
 * Fetches and caches token prices from Jupiter Price API.
 * Auto-refreshes every 30 seconds when active.
 *
 * @example
 * const { prices, getPrice, isLoading, refresh } = useTokenPrices()
 * const solPrice = getPrice("SOL") // 185.50
 * const usdcPrice = getPrice("USDC") // 1.00
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { AppState, AppStateStatus } from "react-native"
import { getTokenPrices, type TokenPriceData } from "@/lib/rpc"
import { TOKEN_LIST } from "@/data/tokens"
import { debug } from "@/utils/logger"
import {
  TOKEN_PRICE_REFRESH_MS,
  PRICE_STALE_THRESHOLD_MS,
} from "@/constants/security"

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default/fallback prices for common tokens */
const FALLBACK_PRICES: Record<string, number> = {
  SOL: 185.00,
  USDC: 1.00,
  USDT: 1.00,
}

// ============================================================================
// HOOK
// ============================================================================

export interface UseTokenPricesResult {
  /** Map of symbol -> price in USD */
  prices: Record<string, number>
  /** Get price by symbol (with fallback) */
  getPrice: (symbol: string) => number
  /** Get price by mint address (with fallback) */
  getPriceByMint: (mint: string) => number
  /** Calculate USD value for a token amount */
  getUsdValue: (symbol: string, amount: number) => number
  /** Whether prices are loading */
  isLoading: boolean
  /** Whether prices are stale (>2 min old) */
  isStale: boolean
  /** Last update timestamp */
  lastUpdated: number | null
  /** Manually refresh prices */
  refresh: () => Promise<void>
  /** Error if any */
  error: string | null
}

export function useTokenPrices(): UseTokenPricesResult {
  const [priceData, setPriceData] = useState<TokenPriceData>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)

  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const appStateRef = useRef<AppStateStatus>(AppState.currentState)

  // Get all token mints to fetch
  const tokenMints = useMemo(() => TOKEN_LIST.map((t) => t.mint), [])

  // Fetch prices
  const fetchPrices = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const prices = await getTokenPrices(tokenMints)

      if (Object.keys(prices).length > 0) {
        setPriceData(prices)
        setLastUpdated(Date.now())
        debug(`[PRICES] Fetched ${Object.keys(prices).length} token prices`)
      } else {
        debug("[PRICES] No prices returned, using cached/fallback")
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch prices"
      setError(message)
      debug("[PRICES] Error:", message)
    } finally {
      setIsLoading(false)
    }
  }, [tokenMints])

  // Handle app state changes (pause refresh when backgrounded)
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === "active") {
        // App came to foreground, refresh prices
        debug("[PRICES] App foregrounded, refreshing")
        fetchPrices()
      }
      appStateRef.current = nextState
    }

    const subscription = AppState.addEventListener("change", handleAppStateChange)
    return () => subscription.remove()
  }, [fetchPrices])

  // Initial fetch and auto-refresh
  useEffect(() => {
    // Initial fetch
    fetchPrices()

    // Setup auto-refresh
    refreshIntervalRef.current = setInterval(() => {
      if (appStateRef.current === "active") {
        fetchPrices()
      }
    }, TOKEN_PRICE_REFRESH_MS)

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
    }
  }, [fetchPrices])

  // Convert price data to symbol -> price map
  const prices = useMemo(() => {
    const result: Record<string, number> = {}

    for (const token of TOKEN_LIST) {
      const data = priceData[token.mint]
      if (data) {
        result[token.symbol] = data.price
      } else if (FALLBACK_PRICES[token.symbol] !== undefined) {
        result[token.symbol] = FALLBACK_PRICES[token.symbol]
      }
    }

    return result
  }, [priceData])

  // Get price by symbol
  const getPrice = useCallback(
    (symbol: string): number => {
      const upperSymbol = symbol.toUpperCase()

      // Check fetched prices
      if (prices[upperSymbol] !== undefined) {
        return prices[upperSymbol]
      }

      // Fallback prices
      if (FALLBACK_PRICES[upperSymbol] !== undefined) {
        return FALLBACK_PRICES[upperSymbol]
      }

      // Unknown token
      return 0
    },
    [prices]
  )

  // Get price by mint address
  const getPriceByMint = useCallback(
    (mint: string): number => {
      // Check price data directly
      if (priceData[mint]) {
        return priceData[mint].price
      }

      // Find token and get by symbol
      const token = TOKEN_LIST.find((t) => t.mint === mint)
      if (token) {
        return getPrice(token.symbol)
      }

      return 0
    },
    [priceData, getPrice]
  )

  // Calculate USD value
  const getUsdValue = useCallback(
    (symbol: string, amount: number): number => {
      if (isNaN(amount) || amount === 0) return 0
      const price = getPrice(symbol)
      return amount * price
    },
    [getPrice]
  )

  // Check if prices are stale
  const isStale = useMemo(() => {
    if (!lastUpdated) return true
    return Date.now() - lastUpdated > PRICE_STALE_THRESHOLD_MS
  }, [lastUpdated])

  return {
    prices,
    getPrice,
    getPriceByMint,
    getUsdValue,
    isLoading,
    isStale,
    lastUpdated,
    refresh: fetchPrices,
    error,
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format USD value for display
 */
export function formatUsdValue(value: number): string {
  if (isNaN(value) || value === 0) return "$0.00"

  // For very small values
  if (value > 0 && value < 0.01) {
    return `$${value.toFixed(6)}`
  }

  // For large values (1M+)
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`
  }

  // For thousands (1K+)
  if (value >= 1_000) {
    return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  return `$${value.toFixed(2)}`
}
