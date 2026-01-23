/**
 * Quote Hook for Jupiter DEX
 *
 * Fetches and manages swap quotes with:
 * - Auto-refresh to keep quotes fresh
 * - Freshness tracking (fresh/stale/expired)
 * - Countdown timer for expiry
 * - Mock implementation (to be replaced with real Jupiter API)
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import type { TokenInfo, SwapQuote, PrivacyLevel } from "@/types"
import { getMockBalance } from "@/data/tokens"

// ============================================================================
// TYPES
// ============================================================================

export interface QuoteParams {
  fromToken: TokenInfo
  toToken: TokenInfo
  amount: string
  slippage: number
  privacyLevel: PrivacyLevel
}

export type QuoteFreshness = "fresh" | "stale" | "expired"

export interface QuoteResult {
  /** The swap quote */
  quote: SwapQuote | null
  /** Whether quote is loading */
  isLoading: boolean
  /** Error message if any */
  error: string | null
  /** Quote freshness status */
  freshness: QuoteFreshness
  /** Seconds until quote expires (for countdown display) */
  expiresIn: number | null
  /** Timestamp when quote was fetched */
  fetchedAt: number | null
  /** Whether auto-refresh is enabled */
  autoRefreshEnabled: boolean
  /** Toggle auto-refresh */
  setAutoRefresh: (enabled: boolean) => void
  /** Manually refresh the quote */
  refresh: () => Promise<void>
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Quote is fresh for 30 seconds */
const QUOTE_FRESH_DURATION = 30_000

/** Quote becomes stale after 45 seconds */
const QUOTE_STALE_DURATION = 45_000

/** Quote expires after 60 seconds */
const QUOTE_EXPIRY_DURATION = 60_000

/** Auto-refresh every 25 seconds to stay fresh */
const AUTO_REFRESH_INTERVAL = 25_000

/** Debounce time for param changes */
const DEBOUNCE_MS = 500

// Mock price data (will be replaced with real Jupiter prices)
const TOKEN_PRICES: Record<string, number> = {
  SOL: 185.5,
  USDC: 1.0,
  USDT: 1.0,
  BONK: 0.000025,
  JUP: 0.75,
  RAY: 2.1,
  PYTH: 0.35,
  WIF: 1.85,
  JTO: 2.8,
  ORCA: 3.5,
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Calculate mock quote data
 * TODO: Replace with real Jupiter API call
 */
function calculateMockQuote(
  fromToken: TokenInfo,
  toToken: TokenInfo,
  amount: string,
  slippage: number,
  privacyLevel: PrivacyLevel
): SwapQuote {
  const inputAmount = parseFloat(amount) || 0
  const fromPrice = TOKEN_PRICES[fromToken.symbol] || 1
  const toPrice = TOKEN_PRICES[toToken.symbol] || 1

  // Calculate output based on price ratio
  const rawOutput = (inputAmount * fromPrice) / toPrice
  const outputAmount = rawOutput.toFixed(toToken.decimals > 6 ? 4 : 6)

  // Calculate minimum received with slippage
  const minReceived = rawOutput * (1 - slippage / 100)
  const minimumReceived = minReceived.toFixed(toToken.decimals > 6 ? 4 : 6)

  // Price impact increases with larger amounts
  const priceImpact =
    inputAmount > 1000 ? 0.5 : inputAmount > 100 ? 0.15 : inputAmount > 10 ? 0.05 : 0.01

  // Build route (direct or via SOL)
  const route =
    fromToken.symbol === "SOL" || toToken.symbol === "SOL"
      ? [fromToken.symbol, toToken.symbol]
      : [fromToken.symbol, "SOL", toToken.symbol]

  // Network fee estimate (base + privacy premium)
  const baseFee = 0.000005 // ~5000 lamports
  const privacyPremium = privacyLevel === "shielded" ? 0.00001 : 0
  const networkFee = (baseFee + privacyPremium).toFixed(6)

  return {
    inputToken: fromToken,
    outputToken: toToken,
    inputAmount: amount,
    outputAmount,
    minimumReceived,
    priceImpact,
    route,
    fees: {
      networkFee,
      platformFee: "0", // No platform fee for now
    },
    estimatedTime: privacyLevel === "shielded" ? 8 : 5, // seconds
    expiresAt: Date.now() + QUOTE_EXPIRY_DURATION,
  }
}

/**
 * Parse error message for user display
 */
function getQuoteErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return "Failed to fetch quote"

  const message = err.message.toLowerCase()

  if (message.includes("expired") || message.includes("stale")) {
    return "Quote expired. Please refresh"
  }
  if (message.includes("liquidity") || message.includes("insufficient")) {
    return "Insufficient liquidity for this amount"
  }
  if (message.includes("rate limit") || message.includes("too many")) {
    return "Too many requests. Please wait"
  }
  if (message.includes("network") || message.includes("timeout")) {
    return "Network error. Please try again"
  }
  if (message.includes("minimum") || message.includes("too small")) {
    return "Amount is below minimum"
  }

  return err.message || "Failed to fetch quote"
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook for fetching Jupiter swap quotes
 *
 * @example
 * ```tsx
 * const { quote, isLoading, error, freshness, expiresIn, refresh } = useQuote({
 *   fromToken: TOKENS.SOL,
 *   toToken: TOKENS.USDC,
 *   amount: "1.5",
 *   slippage: 0.5,
 *   privacyLevel: "shielded",
 * })
 * ```
 */
export function useQuote(params: QuoteParams | null): QuoteResult {
  const [quote, setQuote] = useState<SwapQuote | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true)
  const [freshness, setFreshness] = useState<QuoteFreshness>("expired")
  const [expiresIn, setExpiresIn] = useState<number | null>(null)

  // Refs for intervals and debounce tracking
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const freshnessIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const debounceActiveRef = useRef<boolean>(false)

  // Fetch quote function
  const fetchQuote = useCallback(async () => {
    // Skip if no params or invalid amount
    if (!params || !params.amount || parseFloat(params.amount) <= 0) {
      setQuote(null)
      setError(null)
      setFreshness("expired")
      setExpiresIn(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 300))

      // Calculate mock quote (will be replaced with Jupiter API)
      const newQuote = calculateMockQuote(
        params.fromToken,
        params.toToken,
        params.amount,
        params.slippage,
        params.privacyLevel
      )

      setQuote(newQuote)
      setFetchedAt(Date.now())
      setFreshness("fresh")
      setExpiresIn(Math.round(QUOTE_EXPIRY_DURATION / 1000))
    } catch (err) {
      const errorMessage = getQuoteErrorMessage(err)
      setError(errorMessage)
      setQuote(null)
      setFreshness("expired")
      setExpiresIn(null)
    } finally {
      setIsLoading(false)
    }
  }, [params])

  // Fetch quote when params change (debounced)
  useEffect(() => {
    debounceActiveRef.current = true
    const timeoutId = setTimeout(() => {
      debounceActiveRef.current = false
      fetchQuote()
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timeoutId)
      debounceActiveRef.current = false
    }
  }, [fetchQuote])

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefreshEnabled || !params || !quote) {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current)
        autoRefreshRef.current = null
      }
      return
    }

    // Set up auto-refresh interval
    autoRefreshRef.current = setInterval(() => {
      // Skip if loading or debounce is active
      if (!isLoading && !debounceActiveRef.current) {
        fetchQuote()
      }
    }, AUTO_REFRESH_INTERVAL)

    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current)
        autoRefreshRef.current = null
      }
    }
  }, [autoRefreshEnabled, params, quote, isLoading, fetchQuote])

  // Freshness tracking effect
  useEffect(() => {
    if (!fetchedAt || !quote) {
      setFreshness("expired")
      setExpiresIn(null)
      return
    }

    const updateFreshness = () => {
      const elapsed = Date.now() - fetchedAt
      const remaining = Math.max(
        0,
        Math.round((QUOTE_EXPIRY_DURATION - elapsed) / 1000)
      )

      setExpiresIn(remaining)

      if (elapsed < QUOTE_FRESH_DURATION) {
        setFreshness("fresh")
      } else if (elapsed < QUOTE_STALE_DURATION) {
        setFreshness("stale")
      } else {
        setFreshness("expired")
      }
    }

    // Update immediately
    updateFreshness()

    // Update every second for countdown
    freshnessIntervalRef.current = setInterval(updateFreshness, 1000)

    return () => {
      if (freshnessIntervalRef.current) {
        clearInterval(freshnessIntervalRef.current)
        freshnessIntervalRef.current = null
      }
    }
  }, [fetchedAt, quote])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current)
      if (freshnessIntervalRef.current) clearInterval(freshnessIntervalRef.current)
    }
  }, [])

  return {
    quote,
    isLoading,
    error,
    freshness,
    expiresIn,
    fetchedAt,
    autoRefreshEnabled,
    setAutoRefresh: setAutoRefreshEnabled,
    refresh: fetchQuote,
  }
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Hook to get exchange rate between two tokens
 */
export function useExchangeRate(
  fromSymbol: string,
  toSymbol: string
): { rate: number; formatted: string } {
  return useMemo(() => {
    const fromPrice = TOKEN_PRICES[fromSymbol] || 1
    const toPrice = TOKEN_PRICES[toSymbol] || 1
    const rate = fromPrice / toPrice
    const formatted = rate >= 1 ? rate.toFixed(4) : rate.toFixed(8)
    return { rate, formatted }
  }, [fromSymbol, toSymbol])
}

/**
 * Hook to check if user has sufficient balance for swap
 */
export function useInsufficientBalance(
  tokenSymbol: string,
  amount: string
): boolean {
  return useMemo(() => {
    if (!amount || parseFloat(amount) <= 0) return false
    const balance = getMockBalance(tokenSymbol)
    if (!balance) return true
    return parseFloat(amount) > parseFloat(balance.balance)
  }, [tokenSymbol, amount])
}
