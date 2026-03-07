/**
 * Quote Hook for Jupiter DEX
 *
 * Fetches and manages swap quotes with:
 * - Real Jupiter Quote API v6 integration
 * - Auto-refresh to keep quotes fresh
 * - Freshness tracking (fresh/stale/expired)
 * - Countdown timer for expiry
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import type { TokenInfo, SwapQuote, PrivacyLevel } from "@/types"
import { useBalance } from "./useBalance"

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
  /** Raw Jupiter quote response (for swap execution) */
  jupiterQuote: JupiterQuoteResponse | null
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

/** Jupiter Quote API response */
export interface JupiterQuoteResponse {
  inputMint: string
  inAmount: string
  outputMint: string
  outAmount: string
  otherAmountThreshold: string
  swapMode: string
  slippageBps: number
  platformFee: null | { amount: string; feeBps: number }
  priceImpactPct: string
  routePlan: Array<{
    swapInfo: {
      ammKey: string
      label: string
      inputMint: string
      outputMint: string
      inAmount: string
      outAmount: string
      feeAmount: string
      feeMint: string
    }
    percent: number
  }>
  contextSlot: number
  timeTaken: number
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Jupiter Quote API endpoint (lite = free, no API key required) */
const JUPITER_QUOTE_API = "https://lite-api.jup.ag/swap/v1/quote"

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

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Fetch quote from Jupiter API
 */
async function fetchJupiterQuote(
  fromToken: TokenInfo,
  toToken: TokenInfo,
  amount: string,
  slippageBps: number
): Promise<JupiterQuoteResponse> {
  // Convert amount to lamports/smallest unit
  const inputAmount = parseFloat(amount)
  if (isNaN(inputAmount) || inputAmount <= 0) {
    throw new Error("Invalid amount")
  }

  const amountInSmallestUnit = Math.floor(inputAmount * Math.pow(10, fromToken.decimals))

  const params = new URLSearchParams({
    inputMint: fromToken.mint,
    outputMint: toToken.mint,
    amount: amountInSmallestUnit.toString(),
    slippageBps: slippageBps.toString(),
    swapMode: "ExactIn",
  })

  const response = await fetch(`${JUPITER_QUOTE_API}?${params}`)

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Jupiter API error: ${errorText}`)
  }

  return response.json()
}

/**
 * Convert Jupiter quote to our SwapQuote interface
 */
function jupiterToSwapQuote(
  jupiterQuote: JupiterQuoteResponse,
  fromToken: TokenInfo,
  toToken: TokenInfo,
  inputAmount: string,
  privacyLevel: PrivacyLevel
): SwapQuote {
  // Convert output amount from smallest unit
  const outAmountNum = parseInt(jupiterQuote.outAmount, 10) / Math.pow(10, toToken.decimals)
  const outputAmount = outAmountNum.toFixed(toToken.decimals > 6 ? 4 : 6)

  // Convert minimum received (otherAmountThreshold)
  const minReceivedNum = parseInt(jupiterQuote.otherAmountThreshold, 10) / Math.pow(10, toToken.decimals)
  const minimumReceived = minReceivedNum.toFixed(toToken.decimals > 6 ? 4 : 6)

  // Parse price impact
  const priceImpact = parseFloat(jupiterQuote.priceImpactPct)

  // Build route from routePlan
  const route = buildRouteFromPlan(jupiterQuote.routePlan, fromToken, toToken)

  // Network fee estimate (base + privacy premium)
  const baseFee = 0.000005 // ~5000 lamports
  const privacyPremium = privacyLevel === "shielded" ? 0.00001 : 0
  const networkFee = (baseFee + privacyPremium).toFixed(6)

  // Platform fee from Jupiter response
  const platformFee = jupiterQuote.platformFee
    ? (parseInt(jupiterQuote.platformFee.amount, 10) / Math.pow(10, toToken.decimals)).toFixed(6)
    : "0"

  return {
    inputToken: fromToken,
    outputToken: toToken,
    inputAmount,
    outputAmount,
    minimumReceived,
    priceImpact,
    route,
    fees: {
      networkFee,
      platformFee,
    },
    estimatedTime: privacyLevel === "shielded" ? 8 : 5,
    expiresAt: Date.now() + QUOTE_EXPIRY_DURATION,
  }
}

/**
 * Build human-readable route from Jupiter route plan
 */
function buildRouteFromPlan(
  routePlan: JupiterQuoteResponse["routePlan"],
  fromToken: TokenInfo,
  toToken: TokenInfo
): string[] {
  if (!routePlan || routePlan.length === 0) {
    return [fromToken.symbol, toToken.symbol]
  }

  // For simple routes, just show from -> to
  if (routePlan.length === 1) {
    return [fromToken.symbol, toToken.symbol]
  }

  // For multi-hop routes, show the intermediary (simplified)
  // Jupiter uses AMM labels, but we just show token symbols
  const route = [fromToken.symbol]

  // Add intermediate tokens if multi-hop
  if (routePlan.length > 1) {
    route.push("...") // Indicate multi-hop
  }

  route.push(toToken.symbol)
  return route
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
  const [jupiterQuote, setJupiterQuote] = useState<JupiterQuoteResponse | null>(null)
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
      setJupiterQuote(null)
      setError(null)
      setFreshness("expired")
      setExpiresIn(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Convert slippage from percentage to basis points (0.5% -> 50 bps)
      const slippageBps = Math.round(params.slippage * 100)

      // Fetch real quote from Jupiter
      const jupQuote = await fetchJupiterQuote(
        params.fromToken,
        params.toToken,
        params.amount,
        slippageBps
      )

      // Store raw Jupiter quote for swap execution
      setJupiterQuote(jupQuote)

      // Convert to our SwapQuote interface
      const newQuote = jupiterToSwapQuote(
        jupQuote,
        params.fromToken,
        params.toToken,
        params.amount,
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
      setJupiterQuote(null)
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
    jupiterQuote,
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
 * Hook to get exchange rate between two tokens using Jupiter Price API
 */
export function useExchangeRate(
  fromToken: TokenInfo | null,
  toToken: TokenInfo | null
): { rate: number; formatted: string; isLoading: boolean } {
  const [rate, setRate] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!fromToken || !toToken) {
      setRate(0)
      return
    }

    const fetchRate = async () => {
      setIsLoading(true)
      try {
        // Derive rate from a small Jupiter quote (free lite-api, no key needed)
        const oneUnit = Math.pow(10, fromToken.decimals)
        const params = new URLSearchParams({
          inputMint: fromToken.mint,
          outputMint: toToken.mint,
          amount: oneUnit.toString(),
          slippageBps: "50",
        })
        const response = await fetch(`${JUPITER_QUOTE_API}?${params}`)
        if (response.ok) {
          const data = await response.json()
          const outAmount = parseInt(data.outAmount, 10) / Math.pow(10, toToken.decimals)
          if (outAmount > 0) {
            setRate(outAmount)
          }
        }
      } catch (err) {
        console.error("Failed to fetch exchange rate:", err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchRate()
  }, [fromToken?.mint, toToken?.mint])

  const formatted = useMemo(() => {
    if (rate === 0) return "..."
    return rate >= 1 ? rate.toFixed(4) : rate.toFixed(8)
  }, [rate])

  return { rate, formatted, isLoading }
}

/**
 * Hook to check if user has sufficient balance for swap
 */
export function useInsufficientBalance(
  tokenSymbol: string,
  amount: string
): boolean {
  const { balance, tokenBalances } = useBalance()

  return useMemo(() => {
    if (!amount || parseFloat(amount) <= 0) return false

    const amountNum = parseFloat(amount)

    // Check SOL balance
    if (tokenSymbol === "SOL") {
      return amountNum > balance
    }

    // Check SPL token balance
    const tokenBalance = tokenBalances.find((t) => t.symbol === tokenSymbol)
    if (!tokenBalance) return true

    return amountNum > tokenBalance.uiAmount
  }, [tokenSymbol, amount, balance, tokenBalances])
}
