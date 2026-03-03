/**
 * ComparisonCard Component
 *
 * Swipeable/tappable card that shows public vs private transaction comparison.
 * Used in onboarding to demonstrate privacy at a glance.
 */

import { View, Text, TouchableOpacity } from "react-native"
import { useState } from "react"
import Animated, {
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated"
import {
  EyeIcon,
  EyeSlashIcon,
} from "phosphor-react-native"
import { usePrefersReducedMotion } from "@/hooks"
import { ICON_COLORS } from "@/constants/icons"

// ============================================================================
// TYPES
// ============================================================================

export interface TransactionData {
  from: string
  to: string
  amount: string
}

export interface ComparisonCardProps {
  /** Public transaction data */
  publicData: TransactionData
  /** Private transaction data (usually "???") */
  privateData: TransactionData
  /** Whether to start showing private view */
  initiallyPrivate?: boolean
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ComparisonCard({
  publicData,
  privateData,
  initiallyPrivate = false,
}: ComparisonCardProps) {
  const [isPrivate, setIsPrivate] = useState(initiallyPrivate)
  const shouldReduceMotion = usePrefersReducedMotion()

  const toggle = () => {
    setIsPrivate(!isPrivate)
  }

  // Animated style for content fade
  const contentStyle = useAnimatedStyle(() => ({
    opacity: withTiming(1, { duration: 200, easing: Easing.out(Easing.ease) }),
  }))

  const data = isPrivate ? privateData : publicData
  const IconComponent = isPrivate ? EyeSlashIcon : EyeIcon
  const iconColor = isPrivate ? ICON_COLORS.brand : ICON_COLORS.warning

  return (
    <TouchableOpacity
      onPress={toggle}
      activeOpacity={0.8}
      accessibilityLabel={`Transaction comparison card. Currently showing ${isPrivate ? "private" : "public"} view. Tap to switch.`}
      accessibilityRole="button"
      accessibilityHint="Switches between public and private transaction views"
    >
      <View className="bg-dark-900 rounded-2xl border border-dark-800 overflow-hidden">
        {/* Header with toggle indicator */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-dark-800">
          <View className="flex-row items-center gap-2">
            <IconComponent size={20} color={iconColor} weight="fill" />
            <Text
              className={`font-semibold ${isPrivate ? "text-brand-400" : "text-white"}`}
            >
              {isPrivate ? "PRIVATE" : "PUBLIC"}
            </Text>
          </View>
          <Text className="text-dark-500 text-xs">Tap to compare</Text>
        </View>

        {/* Transaction details */}
        <View className="p-4">
          <Animated.View style={shouldReduceMotion ? undefined : contentStyle}>
            <TransactionDetails data={data} isPrivate={isPrivate} />
          </Animated.View>
        </View>
      </View>
    </TouchableOpacity>
  )
}

// ============================================================================
// HELPER COMPONENT
// ============================================================================

function TransactionDetails({
  data,
  isPrivate,
}: {
  data: TransactionData
  isPrivate: boolean
}) {
  const valueClass = isPrivate ? "text-brand-400" : "text-white"
  const bgClass = isPrivate ? "bg-brand-900/30" : "bg-dark-800"

  return (
    <View className="gap-3">
      <DetailRow label="From" value={data.from} valueClass={valueClass} bgClass={bgClass} />
      <DetailRow label="To" value={data.to} valueClass={valueClass} bgClass={bgClass} />
      <DetailRow
        label="Amount"
        value={data.amount}
        valueClass={valueClass}
        bgClass={bgClass}
      />
    </View>
  )
}

function DetailRow({
  label,
  value,
  valueClass,
  bgClass,
}: {
  label: string
  value: string
  valueClass: string
  bgClass: string
}) {
  return (
    <View className="flex-row items-center">
      <Text className="text-dark-400 w-16 text-sm">{label}:</Text>
      <View className={`flex-1 px-3 py-2 rounded-lg ${bgClass}`}>
        <Text className={`font-mono text-sm ${valueClass}`}>{value}</Text>
      </View>
    </View>
  )
}
