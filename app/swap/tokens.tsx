/**
 * Token Selector Screen
 *
 * Full-screen token selection with:
 * - Search by name/symbol/address
 * - Popular tokens section
 * - All tokens with balances
 * - Recent selections
 */

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Keyboard,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router, useLocalSearchParams } from "expo-router"
import { useState, useMemo, useCallback, useEffect } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import {
  TOKEN_LIST,
  TOKENS,
  POPULAR_TOKENS,
  formatTokenAmount,
} from "@/data/tokens"
import { useBalance } from "@/hooks"
import { useWalletStore } from "@/stores/wallet"
import { useCustomTokensStore } from "@/stores/customTokens"
import type { TokenInfo } from "@/types"
import {
  ArrowLeftIcon,
  MagnifyingGlassIcon,
  XIcon,
} from "phosphor-react-native"
import { ICON_COLORS } from "@/constants/icons"

// ============================================================================
// CONSTANTS
// ============================================================================

const RECENT_TOKENS_KEY = "sip_recent_tokens"
const MAX_RECENT_TOKENS = 5

// ============================================================================
// HELPERS
// ============================================================================

function getTokenIcon(symbol: string): string {
  const icons: Record<string, string> = {
    SOL: "◎",
    USDC: "💵",
    USDT: "💲",
    BONK: "🐕",
    JUP: "🪐",
    RAY: "☀️",
    PYTH: "🔮",
    WIF: "🎩",
    JTO: "⚡",
    ORCA: "🐋",
  }
  return icons[symbol] || "🪙"
}


// ============================================================================
// COMPONENTS
// ============================================================================

interface TokenRowProps {
  token: TokenInfo
  balance?: string
  usdValue?: number
  isSelected?: boolean
  onPress: () => void
}

function TokenRow({
  token,
  balance,
  usdValue,
  isSelected,
  onPress,
}: TokenRowProps) {
  return (
    <TouchableOpacity
      className={`flex-row items-center px-4 py-3 border-b border-dark-900 ${
        isSelected ? "bg-brand-900/20" : ""
      }`}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Token Icon */}
      <View className="w-10 h-10 bg-dark-800 rounded-full items-center justify-center mr-3">
        <Text className="text-xl">{getTokenIcon(token.symbol)}</Text>
      </View>

      {/* Token Info */}
      <View className="flex-1">
        <View className="flex-row items-center">
          <Text className="text-white font-semibold text-base">
            {token.symbol}
          </Text>
          {isSelected && (
            <View className="ml-2 bg-brand-600 px-1.5 py-0.5 rounded">
              <Text className="text-white text-xs">Selected</Text>
            </View>
          )}
        </View>
        <Text className="text-dark-500 text-sm">{token.name}</Text>
      </View>

      {/* Balance */}
      {balance && (
        <View className="items-end">
          <Text className="text-white font-medium">
            {formatTokenAmount(balance, token.decimals)}
          </Text>
          {usdValue !== undefined && usdValue > 0 && (
            <Text className="text-dark-500 text-sm">
              ${usdValue.toLocaleString("en-US", { maximumFractionDigits: 2 })}
            </Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  )
}

interface SectionHeaderProps {
  title: string
}

function SectionHeader({ title }: SectionHeaderProps) {
  return (
    <View className="px-4 py-2 bg-dark-950">
      <Text className="text-dark-400 text-sm font-medium uppercase">
        {title}
      </Text>
    </View>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function TokenSelectorScreen() {
  const params = useLocalSearchParams<{
    direction?: string
    selected?: string
  }>()

  // Real balance from RPC
  const { isConnected } = useWalletStore()
  const { balance: solBalance, tokenBalances, solPrice } = useBalance()

  // Helper to get balance for a token symbol
  const getTokenBalance = useCallback(
    (symbol: string): { balance: string; usdValue: number } | undefined => {
      if (!isConnected) return undefined

      if (symbol === "SOL") {
        return {
          balance: solBalance.toFixed(4),
          usdValue: solBalance * solPrice,
        }
      }

      // Find SPL token by mint
      const tokenInfo = TOKENS[symbol]
      if (!tokenInfo) return undefined

      const tokenBalance = tokenBalances.find((t) => t.mint === tokenInfo.mint)
      if (!tokenBalance) return { balance: "0", usdValue: 0 }

      return {
        balance: tokenBalance.uiAmount.toString(),
        usdValue: 0,
      }
    },
    [isConnected, solBalance, solPrice, tokenBalances]
  )

  const [searchQuery, setSearchQuery] = useState("")
  const [recentTokens, setRecentTokens] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const direction = params.direction || "from"
  const selectedToken = params.selected

  // Load recent tokens
  useEffect(() => {
    loadRecentTokens()
  }, [])

  const loadRecentTokens = async () => {
    try {
      const stored = await AsyncStorage.getItem(RECENT_TOKENS_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        // Validate parsed data is an array of strings
        if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
          setRecentTokens(parsed)
        } else {
          // Invalid format, clear corrupted data
          console.warn("Invalid recent tokens format, clearing...")
          await AsyncStorage.removeItem(RECENT_TOKENS_KEY)
        }
      }
    } catch (err) {
      console.error("Failed to load recent tokens:", err)
      // Clear corrupted data on parse error
      await AsyncStorage.removeItem(RECENT_TOKENS_KEY).catch(() => {})
    } finally {
      setIsLoading(false)
    }
  }

  const saveRecentToken = async (symbol: string) => {
    try {
      const updated = [
        symbol,
        ...recentTokens.filter((s) => s !== symbol),
      ].slice(0, MAX_RECENT_TOKENS)
      setRecentTokens(updated)
      await AsyncStorage.setItem(RECENT_TOKENS_KEY, JSON.stringify(updated))
    } catch (err) {
      console.error("Failed to save recent token:", err)
    }
  }

  // Get custom tokens
  const { tokens: customTokens } = useCustomTokensStore()

  // Combine default and custom tokens
  const allTokens = useMemo(() => {
    return [...TOKEN_LIST, ...customTokens]
  }, [customTokens])

  // Filter tokens based on search
  const filteredTokens = useMemo(() => {
    if (!searchQuery.trim()) {
      return allTokens
    }

    const query = searchQuery.toLowerCase().trim()
    return allTokens.filter(
      (token) =>
        token.symbol.toLowerCase().includes(query) ||
        token.name.toLowerCase().includes(query) ||
        token.mint.toLowerCase().includes(query)
    )
  }, [searchQuery, allTokens])

  // Get tokens with balances (sorted by USD value)
  const tokensWithBalances = useMemo(() => {
    return filteredTokens
      .map((token) => {
        const balanceInfo = getTokenBalance(token.symbol)
        return {
          token,
          balance: balanceInfo?.balance,
          usdValue: balanceInfo?.usdValue,
        }
      })
      .sort((a, b) => {
        // Sort by USD value descending, tokens without balance go last
        if (a.usdValue && b.usdValue) return b.usdValue - a.usdValue
        if (a.usdValue) return -1
        if (b.usdValue) return 1
        return 0
      })
  }, [filteredTokens])

  // Get recent tokens that exist
  const recentTokenList = useMemo(() => {
    return recentTokens
      .map((symbol) => TOKENS[symbol])
      .filter((token): token is TokenInfo => token !== undefined)
  }, [recentTokens])

  // Get popular tokens
  const popularTokenList = useMemo(() => {
    return POPULAR_TOKENS.map((symbol) => TOKENS[symbol]).filter(
      (token): token is TokenInfo => token !== undefined
    )
  }, [])

  const handleTokenSelect = useCallback(
    (token: TokenInfo) => {
      Keyboard.dismiss()
      saveRecentToken(token.symbol)

      // Navigate back with selected token
      router.back()
      // Use a small delay to ensure navigation completes
      setTimeout(() => {
        router.setParams({
          [`${direction}Token`]: token.symbol,
        })
      }, 100)
    },
    [direction, saveRecentToken]
  )

  const renderToken = useCallback(
    ({ item }: { item: { token: TokenInfo; balance?: string; usdValue?: number } }) => (
      <TokenRow
        token={item.token}
        balance={item.balance}
        usdValue={item.usdValue}
        isSelected={item.token.symbol === selectedToken}
        onPress={() => handleTokenSelect(item.token)}
      />
    ),
    [selectedToken, handleTokenSelect]
  )

  const renderPopularToken = useCallback(
    (token: TokenInfo) => {
      // Popular tokens shown as chips - no balance display needed
      return (
        <TouchableOpacity
          key={token.symbol}
          className={`mr-2 px-3 py-2 rounded-xl flex-row items-center ${
            token.symbol === selectedToken
              ? "bg-brand-600"
              : "bg-dark-800 border border-dark-700"
          }`}
          onPress={() => handleTokenSelect(token)}
        >
          <Text className="text-lg mr-1.5">{getTokenIcon(token.symbol)}</Text>
          <Text
            className={`font-medium ${
              token.symbol === selectedToken ? "text-white" : "text-dark-300"
            }`}
          >
            {token.symbol}
          </Text>
        </TouchableOpacity>
      )
    },
    [selectedToken, handleTokenSelect]
  )

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-dark-950">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#8b5cf6" />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-dark-950">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-dark-900">
        <TouchableOpacity
          className="p-2 -ml-2"
          onPress={() => router.back()}
        >
          <ArrowLeftIcon size={24} color={ICON_COLORS.white} weight="bold" />
        </TouchableOpacity>
        <Text className="flex-1 text-xl font-bold text-white text-center mr-8">
          Select Token
        </Text>
      </View>

      {/* Search Input */}
      <View className="px-4 py-3">
        <View className="flex-row items-center bg-dark-900 border border-dark-800 rounded-xl px-4">
          <MagnifyingGlassIcon size={18} color={ICON_COLORS.inactive} weight="bold" />
          <TextInput
            className="flex-1 py-3 text-white text-base ml-2"
            placeholder="Search by name, symbol, or address"
            placeholderTextColor="#71717a"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <XIcon size={18} color={ICON_COLORS.inactive} weight="bold" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content */}
      {searchQuery.length > 0 ? (
        // Search Results
        <FlatList
          data={tokensWithBalances}
          keyExtractor={(item) => item.token.mint}
          renderItem={renderToken}
          ListEmptyComponent={
            <View className="items-center py-12">
              <View className="w-20 h-20 rounded-full bg-dark-800 items-center justify-center mb-4">
                <MagnifyingGlassIcon size={40} color={ICON_COLORS.inactive} weight="bold" />
              </View>
              <Text className="text-white font-medium">No tokens found</Text>
              <Text className="text-dark-500 text-sm mt-1">
                Try a different search term
              </Text>
            </View>
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />
      ) : (
        // Default View with sections
        <FlatList
          data={tokensWithBalances}
          keyExtractor={(item) => item.token.mint}
          renderItem={renderToken}
          ListHeaderComponent={
            <>
              {/* Popular Tokens */}
              <View className="px-4 py-3">
                <Text className="text-dark-400 text-sm font-medium mb-3">
                  POPULAR
                </Text>
                <View className="flex-row flex-wrap">
                  {popularTokenList.map(renderPopularToken)}
                </View>
              </View>

              {/* Recent Tokens */}
              {recentTokenList.length > 0 && (
                <View className="mb-2">
                  <SectionHeader title="Recent" />
                  {recentTokenList.map((token) => {
                    const balanceInfo = getTokenBalance(token.symbol)
                    return (
                      <TokenRow
                        key={token.symbol}
                        token={token}
                        balance={balanceInfo?.balance}
                        usdValue={balanceInfo?.usdValue}
                        isSelected={token.symbol === selectedToken}
                        onPress={() => handleTokenSelect(token)}
                      />
                    )
                  })}
                </View>
              )}

              {/* All Tokens Header */}
              <SectionHeader title="All Tokens" />
            </>
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Import Token Button */}
      <View className="px-4 py-3 border-t border-dark-900">
        <TouchableOpacity
          className="flex-row items-center justify-center py-3 bg-dark-800 rounded-xl"
          onPress={() => router.push("/swap/import-token")}
        >
          <Text className="text-brand-400 font-medium">+ Import Custom Token</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}
