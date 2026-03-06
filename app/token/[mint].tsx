/**
 * Token Detail Page
 *
 * Shows token info, price, stats grid, user position, and action bar.
 * Accessible via /token/[mint] route.
 */

import { View, Text, TouchableOpacity, ScrollView } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router, useLocalSearchParams } from "expo-router"
import * as Clipboard from "expo-clipboard"
import { ArrowLeftIcon, ShareIcon, StarIcon } from "phosphor-react-native"
import { ICON_COLORS } from "@/constants/icons"
import { TokenIcon } from "@/components/TokenIcon"
import { TokenStats } from "@/components/TokenStats"
import { PositionCard } from "@/components/PositionCard"
import { useBalance } from "@/hooks/useBalance"
import { useSettingsStore } from "@/stores/settings"
import { toast } from "@/stores/toast"
import { getTokenByMint, TOKENS } from "@/data/tokens"
import { formatAddress } from "@/stores/wallet"
import { hapticLight } from "@/utils/haptics"

// ============================================================================
// MOCK DATA (placeholder until Jupiter Price API integration)
// ============================================================================

const MOCK_PRICES: Record<string, number> = __DEV__
  ? {
      SOL: 178.42, USDC: 1.0, USDT: 1.0, BONK: 0.0000234, JUP: 1.87,
      RAY: 5.12, PYTH: 0.48, WIF: 2.34, JTO: 3.67, ORCA: 4.21, SKR: 0.015,
    }
  : {}

const MOCK_STATS: Record<string, { marketCap: number; liquidity: number; holders: number; privacyScore: number }> = __DEV__
  ? {
      SOL: { marketCap: 49_700_000_000, liquidity: 646_200_000, holders: 2_340_000, privacyScore: 45 },
      USDC: { marketCap: 32_100_000_000, liquidity: 1_200_000_000, holders: 5_100_000, privacyScore: 30 },
      USDT: { marketCap: 83_200_000_000, liquidity: 890_000_000, holders: 4_800_000, privacyScore: 25 },
      BONK: { marketCap: 1_450_000_000, liquidity: 23_400_000, holders: 890_000, privacyScore: 60 },
      JUP: { marketCap: 2_530_000_000, liquidity: 45_600_000, holders: 1_200_000, privacyScore: 55 },
      RAY: { marketCap: 1_340_000_000, liquidity: 34_500_000, holders: 450_000, privacyScore: 50 },
      PYTH: { marketCap: 720_000_000, liquidity: 12_300_000, holders: 320_000, privacyScore: 40 },
      WIF: { marketCap: 2_340_000_000, liquidity: 56_700_000, holders: 670_000, privacyScore: 65 },
      JTO: { marketCap: 450_000_000, liquidity: 8_900_000, holders: 180_000, privacyScore: 35 },
      ORCA: { marketCap: 380_000_000, liquidity: 7_600_000, holders: 120_000, privacyScore: 42 },
      SKR: { marketCap: 15_000_000, liquidity: 2_100_000, holders: 45_000, privacyScore: 70 },
    }
  : {}

const MOCK_CHANGE_24H: Record<string, number> = __DEV__
  ? {
      SOL: 3.42, USDC: 0.01, USDT: -0.02, BONK: -5.67, JUP: 8.12,
      RAY: 2.34, PYTH: -1.23, WIF: 12.45, JTO: -3.21, ORCA: 1.56, SKR: 15.8,
    }
  : {}

// ============================================================================
// HELPERS
// ============================================================================

function formatPrice(price: number): string {
  if (price >= 1) return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (price >= 0.01) return `$${price.toFixed(4)}`
  if (price >= 0.0001) return `$${price.toFixed(6)}`
  return `$${price.toFixed(8)}`
}

// ============================================================================
// SCREEN
// ============================================================================

export default function TokenDetailScreen() {
  const { mint } = useLocalSearchParams<{ mint: string }>()
  const { balance, usdValue, tokenBalances } = useBalance()
  const { hideBalances } = useSettingsStore()

  // Look up token by mint address
  const token = mint ? getTokenByMint(mint) : undefined

  if (!token) {
    return (
      <SafeAreaView className="flex-1 bg-dark-950 items-center justify-center">
        <Text className="text-dark-400 text-base">Token not found</Text>
        <TouchableOpacity
          className="mt-4 px-6 py-2 bg-dark-800 rounded-lg"
          onPress={() => router.back()}
        >
          <Text className="text-white text-sm">Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  const symbol = token.symbol
  const price = MOCK_PRICES[symbol] ?? 0
  const stats = MOCK_STATS[symbol]
  const change24h = MOCK_CHANGE_24H[symbol] ?? 0
  const changeColor = change24h >= 0 ? "text-green-400" : "text-red-400"

  // Get user's balance for this token
  let tokenBalance = 0
  let tokenUsdValue = 0

  if (symbol === "SOL") {
    tokenBalance = balance
    tokenUsdValue = usdValue
  } else {
    // Check SPL token balances
    const spl = tokenBalances.find((tb) => tb.mint === token.mint)
    if (spl) {
      tokenBalance = spl.uiAmount
      tokenUsdValue = spl.uiAmount * price
    }
  }

  const handleCopyMint = async () => {
    await Clipboard.setStringAsync(token.mint)
    hapticLight()
    toast.success("Copied", "Mint address copied to clipboard")
  }

  const handleSend = () => {
    hapticLight()
    router.push({
      pathname: "/send",
      params: { token: symbol },
    })
  }

  const handleSell = () => {
    hapticLight()
    router.push({
      pathname: "/swap",
      params: { inputToken: symbol, outputToken: "USDC" },
    })
  }

  const handleBuy = () => {
    hapticLight()
    router.push({
      pathname: "/swap",
      params: { inputToken: "USDC", outputToken: symbol },
    })
  }

  return (
    <SafeAreaView className="flex-1 bg-dark-950" edges={["top"]}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3">
          <TouchableOpacity
            onPress={() => {
              hapticLight()
              router.back()
            }}
            className="w-10 h-10 items-center justify-center rounded-full bg-dark-900"
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <ArrowLeftIcon size={20} color={ICON_COLORS.white} />
          </TouchableOpacity>

          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              className="w-10 h-10 items-center justify-center rounded-full bg-dark-900"
              accessibilityLabel="Favorite"
              accessibilityRole="button"
              onPress={() => {
                hapticLight()
                toast.info("Coming soon", "Favorites will be available in a future update")
              }}
            >
              <StarIcon size={20} color={ICON_COLORS.muted} />
            </TouchableOpacity>
            <TouchableOpacity
              className="w-10 h-10 items-center justify-center rounded-full bg-dark-900"
              accessibilityLabel="Share"
              accessibilityRole="button"
              onPress={() => {
                hapticLight()
                toast.info("Coming soon", "Share will be available in a future update")
              }}
            >
              <ShareIcon size={20} color={ICON_COLORS.muted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Token Identity */}
        <View className="items-center px-6 mt-2">
          <TokenIcon token={token} size="xl" />

          <View className="flex-row items-center mt-3 gap-1.5">
            <Text className="text-white text-xl font-bold">{token.name}</Text>
          </View>

          <TouchableOpacity onPress={handleCopyMint} activeOpacity={0.7}>
            <Text className="text-dark-500 text-xs mt-1">{formatAddress(token.mint)}</Text>
          </TouchableOpacity>
        </View>

        {/* Price */}
        <View className="items-center px-6 mt-4">
          <Text className="text-white text-3xl font-bold">
            {hideBalances ? "******" : formatPrice(price)}
          </Text>
          <Text className={`text-sm font-medium mt-1 ${changeColor}`}>
            {hideBalances ? "****" : `${change24h >= 0 ? "+" : ""}${change24h.toFixed(2)}% (24h)`}
          </Text>
        </View>

        {/* Chart Placeholder */}
        <View className="h-48 bg-dark-900 rounded-xl items-center justify-center mx-6 mt-4">
          <Text className="text-dark-500">Price chart coming soon</Text>
        </View>

        {/* Stats Grid */}
        <View className="px-6 mt-4">
          <TokenStats
            marketCap={stats?.marketCap}
            liquidity={stats?.liquidity}
            holders={stats?.holders}
            privacyScore={stats?.privacyScore}
          />
        </View>

        {/* Position Card */}
        <View className="px-6 mt-4 mb-6">
          <PositionCard
            balance={tokenBalance}
            symbol={symbol}
            usdValue={tokenUsdValue}
            pnlPercent={change24h}
          />
        </View>
      </ScrollView>

      {/* Action Bar (sticky bottom) */}
      <SafeAreaView edges={["bottom"]} className="bg-dark-950 border-t border-dark-900">
        <View className="flex-row px-6 py-3 gap-3">
          <TouchableOpacity
            onPress={handleSend}
            className="flex-1 bg-dark-800 rounded-xl py-3.5 items-center"
            accessibilityLabel={`Send ${symbol}`}
            accessibilityRole="button"
          >
            <Text className="text-white text-sm font-semibold">Send</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSell}
            className="flex-1 bg-dark-800 rounded-xl py-3.5 items-center"
            accessibilityLabel={`Sell ${symbol}`}
            accessibilityRole="button"
          >
            <Text className="text-red-400 text-sm font-semibold">Sell</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleBuy}
            className="flex-1 bg-brand-500 rounded-xl py-3.5 items-center"
            accessibilityLabel={`Buy ${symbol}`}
            accessibilityRole="button"
          >
            <Text className="text-white text-sm font-semibold">Buy</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </SafeAreaView>
  )
}
