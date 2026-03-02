/**
 * Portfolio Screen
 *
 * Privacy-first token portfolio displaying:
 * - Aggregate wallet privacy score (large badge)
 * - Per-token privacy scores with shield actions
 * - Tokens sorted by USD value descending
 */

import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { ShieldCheckIcon } from "phosphor-react-native"
import { ICON_COLORS } from "@/constants/icons"
import { usePortfolioStore } from "@/stores/portfolio"
import { PrivacyScoreBadge } from "@/components/PrivacyScoreBadge"
import { EmptyState } from "@/components/ui/EmptyState"
import { TokenIcon } from "@/components/TokenIcon"

// ============================================================================
// TOKEN ROW
// ============================================================================

function TokenRow({
  symbol,
  mint,
  balance,
  balanceUsd,
  privacyScore,
}: {
  symbol: string
  mint: string
  balance: string
  balanceUsd: number
  privacyScore: number
}) {
  const needsShield = privacyScore < 67

  return (
    <View
      className="flex-row items-center bg-dark-900 rounded-xl p-4 mb-2 border border-dark-800"
      accessibilityLabel={`${symbol} balance ${balance}, valued at $${balanceUsd.toFixed(2)}, privacy score ${privacyScore}`}
    >
      {/* Token icon */}
      <View className="mr-3">
        <TokenIcon token={{ symbol, name: symbol, mint, decimals: 9 }} size="md" />
      </View>

      {/* Token info */}
      <View className="flex-1 mr-3">
        <Text className="text-white font-semibold text-base" numberOfLines={1}>
          {symbol}
        </Text>
        <Text className="text-dark-400 text-sm mt-0.5" numberOfLines={1}>
          {balance} {symbol} &middot; ${balanceUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      </View>

      {/* Privacy score badge */}
      <View className="mr-3">
        <PrivacyScoreBadge score={privacyScore} size="sm" />
      </View>

      {/* Shield button (only for low-score tokens) */}
      {needsShield && (
        <TouchableOpacity
          className="bg-brand-600 px-3 py-1.5 rounded-lg"
          activeOpacity={0.7}
          onPress={() => router.push("/(tabs)/send")}
          accessibilityLabel={`Shield ${symbol}`}
          accessibilityHint="Navigate to shield this token for better privacy"
          accessibilityRole="button"
        >
          <Text className="text-white text-xs font-semibold">Shield</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

// ============================================================================
// SCREEN
// ============================================================================

export default function PortfolioScreen() {
  const tokens = usePortfolioStore((s) => s.tokens)
  const isLoading = usePortfolioStore((s) => s.isLoading)
  const getAggregateScore = usePortfolioStore((s) => s.getAggregateScore)
  const getTokensSortedByValue = usePortfolioStore((s) => s.getTokensSortedByValue)

  const aggregateScore = getAggregateScore()
  const sortedTokens = getTokensSortedByValue()

  return (
    <SafeAreaView className="flex-1 bg-dark-950">
      {/* Header */}
      <View className="px-6 pt-6 pb-2">
        <Text className="text-3xl font-bold text-white">Portfolio</Text>
      </View>

      {/* Loading State */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={ICON_COLORS.brand} />
          <Text className="text-dark-400 mt-4">Loading portfolio...</Text>
        </View>
      ) : tokens.length === 0 ? (
        /* Empty State */
        <EmptyState
          title="No Tokens Yet"
          message="Your portfolio will appear here once you add tokens to your wallet."
          iconName="wallet"
          className="flex-1"
        />
      ) : (
        <ScrollView
          className="flex-1 px-6"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
        >
          {/* Aggregate Privacy Score */}
          <View className="items-center py-6">
            <PrivacyScoreBadge score={aggregateScore} size="lg" showLabel />
            <Text className="text-dark-400 text-base mt-3">
              Your wallet is {aggregateScore}% private
            </Text>
          </View>

          {/* Section header */}
          <View className="flex-row items-center gap-1.5 mb-3">
            <ShieldCheckIcon size={16} color={ICON_COLORS.brand} weight="fill" />
            <Text className="text-dark-400 text-sm font-medium">Token Privacy</Text>
          </View>

          {/* Token List */}
          {sortedTokens.map((token) => (
            <TokenRow
              key={token.mint}
              symbol={token.symbol}
              mint={token.mint}
              balance={token.balance}
              balanceUsd={token.balanceUsd}
              privacyScore={token.privacyScore}
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
