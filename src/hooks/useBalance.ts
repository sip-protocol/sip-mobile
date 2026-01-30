/**
 * Balance Hook
 *
 * Fetches real SOL balance from Solana RPC.
 * Supports multiple RPC providers and automatic refresh.
 */

import { useState, useCallback, useEffect, useMemo, useRef } from "react"
import { useWalletStore } from "@/stores/wallet"
import { useSettingsStore } from "@/stores/settings"
import {
  getRpcClient,
  getSolPrice,
  type TokenBalance,
  type RpcConfig,
} from "@/lib/rpc"
import { getRpcApiKey } from "@/lib/config"
import {
  BALANCE_REFRESH_INTERVAL_MS,
  PRICE_REFRESH_INTERVAL_MS,
} from "@/constants/security"

// ─── Types ─────────────────────────────────────────────────────────────────

export interface UseBalanceReturn {
  // SOL Balance
  balance: number
  balanceLamports: number
  isLoading: boolean
  error: string | null

  // USD Value
  usdValue: number
  solPrice: number

  // Token balances
  tokenBalances: TokenBalance[]

  // Actions
  refresh: () => Promise<void>
  refreshSilently: () => Promise<void>
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useBalance(): UseBalanceReturn {
  const { isConnected, address } = useWalletStore()
  const { rpcProvider, network, heliusApiKey, quicknodeApiKey, tritonEndpoint } = useSettingsStore()

  const [balance, setBalance] = useState(0)
  const [balanceLamports, setBalanceLamports] = useState(0)
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([])
  const [solPrice, setSolPrice] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const priceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Calculate USD value
  const usdValue = useMemo(() => {
    return balance * solPrice
  }, [balance, solPrice])

  // Get RPC config from settings (user override) or app config (build default)
  const rpcConfig: RpcConfig = useMemo(() => {
    const provider = rpcProvider as "helius" | "quicknode" | "triton" | "publicnode"

    // Get API key based on provider
    let apiKey: string | undefined
    let customEndpoint: string | undefined

    switch (provider) {
      case "helius":
        apiKey = heliusApiKey || getRpcApiKey("helius") || undefined
        break
      case "quicknode":
        apiKey = quicknodeApiKey || undefined
        break
      case "triton":
        customEndpoint = tritonEndpoint || undefined
        break
      case "publicnode":
      default:
        // No key needed
        break
    }

    return {
      provider,
      cluster: network as "mainnet-beta" | "devnet" | "testnet",
      apiKey,
      customEndpoint,
    }
  }, [rpcProvider, network, heliusApiKey, quicknodeApiKey, tritonEndpoint])

  // Fetch balance
  const fetchBalance = useCallback(async (silent = false) => {
    if (!isConnected || !address) {
      setBalance(0)
      setBalanceLamports(0)
      setTokenBalances([])
      return
    }

    if (!silent) {
      setIsLoading(true)
    }
    setError(null)

    try {
      const client = getRpcClient(rpcConfig)

      // Fetch SOL balance
      const result = await client.getBalance(address)
      if (result.error) {
        throw new Error(result.error)
      }

      setBalance(result.sol)
      setBalanceLamports(result.lamports)

      // Fetch token balances
      const tokens = await client.getTokenBalances(address)
      setTokenBalances(tokens)
    } catch (err) {
      console.error("Failed to fetch balance:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch balance")
    } finally {
      if (!silent) {
        setIsLoading(false)
      }
    }
  }, [isConnected, address, rpcConfig])

  // Fetch price
  const fetchPrice = useCallback(async () => {
    try {
      const price = await getSolPrice()
      setSolPrice(price)
    } catch (err) {
      console.error("Failed to fetch price:", err)
    }
  }, [])

  // Public refresh function
  // Uses Promise.allSettled to ensure both complete independently
  const refresh = useCallback(async () => {
    await Promise.allSettled([fetchBalance(false), fetchPrice()])
  }, [fetchBalance, fetchPrice])

  // Silent refresh (no loading state)
  // Uses Promise.allSettled to ensure both complete independently
  const refreshSilently = useCallback(async () => {
    await Promise.allSettled([fetchBalance(true), fetchPrice()])
  }, [fetchBalance, fetchPrice])

  // Initial fetch and setup auto-refresh
  useEffect(() => {
    if (isConnected && address) {
      // Initial fetch
      refresh()

      // Setup auto-refresh for balance
      refreshIntervalRef.current = setInterval(() => {
        fetchBalance(true)
      }, BALANCE_REFRESH_INTERVAL_MS)

      // Setup auto-refresh for price
      priceIntervalRef.current = setInterval(() => {
        fetchPrice()
      }, PRICE_REFRESH_INTERVAL_MS)
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
      if (priceIntervalRef.current) {
        clearInterval(priceIntervalRef.current)
      }
    }
  }, [isConnected, address, rpcConfig])

  // Cleanup on disconnect
  useEffect(() => {
    if (!isConnected) {
      setBalance(0)
      setBalanceLamports(0)
      setTokenBalances([])
      setError(null)
    }
  }, [isConnected])

  return useMemo(
    () => ({
      balance,
      balanceLamports,
      isLoading,
      error,
      usdValue,
      solPrice,
      tokenBalances,
      refresh,
      refreshSilently,
    }),
    [
      balance,
      balanceLamports,
      isLoading,
      error,
      usdValue,
      solPrice,
      tokenBalances,
      refresh,
      refreshSilently,
    ]
  )
}
