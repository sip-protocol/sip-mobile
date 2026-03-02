/**
 * Privacy Toggle Slide (Slide 2)
 *
 * Demonstrates the privacy toggle with live blockchain visualization.
 * Shows how SIP hides transaction data when privacy is enabled.
 */

import { View, Text, Dimensions } from "react-native"
import { useState } from "react"
import {
  LockSimpleIcon,
} from "phosphor-react-native"
import { PrivacyToggle } from "@/components/ui"
import { BlockchainVisualizer } from "@/components/demos"
import { ICON_COLORS } from "@/constants/icons"

const { width } = Dimensions.get("window")

// ============================================================================
// COMPONENT
// ============================================================================

export function PrivacyToggleSlide() {
  const [isPrivate, setIsPrivate] = useState(true)

  return (
    <View style={{ width }} className="flex-1 justify-center items-center px-6">
      {/* Icon */}
      <View
        className="w-20 h-20 rounded-2xl items-center justify-center mb-6"
        style={{ backgroundColor: "rgba(6, 182, 212, 0.15)" }}
      >
        <LockSimpleIcon size={40} color={ICON_COLORS.cyan} weight="fill" />
      </View>

      {/* Title */}
      <Text className="text-2xl font-bold text-white text-center mb-2">
        Private Payments
      </Text>

      {/* Subtitle */}
      <Text className="text-dark-400 text-center text-base mb-6">
        One toggle to shield your transactions
      </Text>

      {/* Interactive toggle */}
      <View className="w-full mb-4">
        <PrivacyToggle value={isPrivate} onValueChange={setIsPrivate} />
      </View>

      {/* Blockchain visualizer */}
      <View className="w-full">
        <BlockchainVisualizer isPrivate={isPrivate} />
      </View>

      {/* Hint */}
      <Text className="text-dark-500 text-sm text-center mt-4">
        {isPrivate
          ? "Toggle off to see what public transactions reveal"
          : "Toggle on to hide your transaction details"}
      </Text>
    </View>
  )
}
