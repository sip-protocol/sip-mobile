/**
 * Position Card
 *
 * Shows user's position for a token: balance, USD value, and PnL.
 * Respects hideBalances setting for privacy.
 */

import { View, Text } from "react-native"
import { useSettingsStore } from "@/stores/settings"

// ============================================================================
// TYPES
// ============================================================================

export interface PositionCardProps {
  balance: number
  symbol: string
  usdValue: number
  pnlPercent?: number
}

// ============================================================================
// COMPONENT
// ============================================================================

export function PositionCard({ balance, symbol, usdValue, pnlPercent }: PositionCardProps) {
  const hideBalances = useSettingsStore((s) => s.hideBalances)
  const pnlColor = (pnlPercent ?? 0) >= 0 ? "text-green-400" : "text-red-400"

  return (
    <View className="bg-dark-900 rounded-xl p-4">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-dark-400 text-sm font-medium">Position</Text>
      </View>
      <View className="flex-row justify-between items-center">
        <View>
          <Text className="text-white text-lg font-semibold">
            {hideBalances ? "******" : `${balance.toFixed(4)} ${symbol}`}
          </Text>
          <Text className="text-dark-400 text-sm mt-0.5">
            {hideBalances ? "******" : `$${usdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
          </Text>
        </View>
        {pnlPercent !== undefined && (
          <Text className={`text-sm font-medium ${pnlColor}`}>
            {hideBalances ? "****" : `${pnlPercent >= 0 ? "+" : ""}${pnlPercent.toFixed(1)}%`}
          </Text>
        )}
      </View>
    </View>
  )
}
