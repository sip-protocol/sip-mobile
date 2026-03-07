/**
 * Token Stats Grid
 *
 * Horizontal row showing Market Cap, Liquidity, Holders, Privacy Score.
 * Compact stat cards with dividers, Jupiter-style.
 */

import { View, Text } from "react-native"

// ============================================================================
// TYPES
// ============================================================================

export interface TokenStatsProps {
  marketCap?: number
  liquidity?: number
  holders?: number
  privacyScore?: number
}

// ============================================================================
// HELPERS
// ============================================================================

export function formatLargeNumber(n?: number): string {
  if (n === undefined || n === null) return "\u2014"
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`
  return `$${n.toFixed(2)}`
}

function formatHolders(n?: number): string {
  if (n === undefined || n === null) return "\u2014"
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return n.toString()
}

// ============================================================================
// COMPONENT
// ============================================================================

export function TokenStats({ marketCap, liquidity, holders, privacyScore }: TokenStatsProps) {
  const stats = [
    { label: "Mkt Cap", value: formatLargeNumber(marketCap) },
    { label: "Liquidity", value: formatLargeNumber(liquidity) },
    { label: "Holders", value: formatHolders(holders) },
    { label: "Privacy", value: privacyScore !== undefined ? `${privacyScore}%` : "\u2014" },
  ]

  return (
    <View className="flex-row bg-dark-900 rounded-xl p-3">
      {stats.map((s, i) => (
        <View key={s.label} className={`flex-1 items-center ${i > 0 ? "border-l border-dark-800" : ""}`}>
          <Text className="text-dark-500 text-xs">{s.label}</Text>
          <Text className="text-white text-sm font-medium mt-0.5">{s.value}</Text>
        </View>
      ))}
    </View>
  )
}
