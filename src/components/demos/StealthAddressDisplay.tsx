/**
 * StealthAddressDisplay Component
 *
 * Displays a formatted SIP stealth address with character reveal animation.
 * Used in onboarding to show real cryptographic output.
 */

import { View, Text, TouchableOpacity } from "react-native"
import { useState, useEffect, useCallback } from "react"
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated"
import {
  ArrowsClockwiseIcon,
  CopyIcon,
  CheckCircleIcon,
} from "phosphor-react-native"
import * as Clipboard from "expo-clipboard"
import { usePrefersReducedMotion } from "@/hooks"
import { ICON_COLORS } from "@/constants/icons"

// ============================================================================
// TYPES
// ============================================================================

export interface StealthAddressDisplayProps {
  /** Full formatted address (sip:solana:...) */
  address: string | null
  /** Whether currently generating */
  isGenerating?: boolean
  /** Callback when generate button is pressed */
  onGenerate?: () => void
  /** Show copy button */
  showCopy?: boolean
  /** Compact mode (less padding) */
  compact?: boolean
}

// ============================================================================
// CONSTANTS
// ============================================================================

// ============================================================================
// COMPONENT
// ============================================================================

export function StealthAddressDisplay({
  address,
  isGenerating = false,
  onGenerate,
  showCopy = false,
  compact = false,
}: StealthAddressDisplayProps) {
  const shouldReduceMotion = usePrefersReducedMotion()
  const [copied, setCopied] = useState(false)

  // Animation for new address reveal
  const opacity = useSharedValue(0)
  const scale = useSharedValue(0.95)

  useEffect(() => {
    if (address) {
      if (shouldReduceMotion) {
        opacity.value = 1
        scale.value = 1
      } else {
        opacity.value = 0
        scale.value = 0.95
        opacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.ease) })
        scale.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.back(1.5)) })
      }
    }
  }, [address, shouldReduceMotion, opacity, scale])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }))

  // Parse address into parts
  const parsedAddress = parseStealthAddress(address)

  const handleCopy = useCallback(async () => {
    if (!address) return
    await Clipboard.setStringAsync(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [address])

  const paddingClass = compact ? "p-3" : "p-4"

  return (
    <View className="bg-dark-900 rounded-xl border border-dark-800 overflow-hidden">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-2 border-b border-dark-800 bg-dark-850">
        <Text className="text-dark-400 text-xs font-medium uppercase tracking-wider">
          Generated Address
        </Text>
        {showCopy && address && (
          <TouchableOpacity
            onPress={handleCopy}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel={copied ? "Copied" : "CopyIcon address"}
          >
            {copied ? (
              <CheckCircleIcon size={16} color={ICON_COLORS.success} />
            ) : (
              <CopyIcon size={16} color={ICON_COLORS.muted} />
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Address content */}
      <View className={paddingClass}>
        {isGenerating ? (
          <LoadingState />
        ) : address && parsedAddress ? (
          <Animated.View style={animatedStyle}>
            <AddressLines {...parsedAddress} />
          </Animated.View>
        ) : (
          <EmptyState />
        )}
      </View>

      {/* Generate button */}
      {onGenerate && (
        <View className="px-4 pb-4">
          <TouchableOpacity
            onPress={onGenerate}
            disabled={isGenerating}
            className={`flex-row items-center justify-center gap-2 py-2 px-4 rounded-lg ${
              isGenerating ? "bg-dark-800" : "bg-brand-600"
            }`}
            accessibilityLabel="Generate new address"
            accessibilityRole="button"
          >
            <ArrowsClockwiseIcon
              size={18}
              color={isGenerating ? ICON_COLORS.muted : ICON_COLORS.white}
              weight={isGenerating ? "regular" : "bold"}
            />
            <Text
              className={`font-medium ${
                isGenerating ? "text-dark-500" : "text-white"
              }`}
            >
              {isGenerating ? "Generating..." : "Generate New"}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function AddressLines({
  prefix,
  chain,
  spendingKey,
  viewingKey,
}: {
  prefix: string
  chain: string
  spendingKey: string
  viewingKey: string
}) {
  return (
    <View className="gap-1">
      <View className="flex-row">
        <Text className="font-mono text-sm text-brand-400">{prefix}:</Text>
        <Text className="font-mono text-sm text-cyan-400">{chain}:</Text>
      </View>
      <Text className="font-mono text-xs text-white break-all">
        {spendingKey}:
      </Text>
      <Text className="font-mono text-xs text-white break-all">
        {viewingKey}
      </Text>
    </View>
  )
}

function LoadingState() {
  return (
    <View className="gap-1">
      <View className="h-4 w-24 bg-dark-800 rounded animate-pulse" />
      <View className="h-4 w-full bg-dark-800 rounded animate-pulse" />
      <View className="h-4 w-full bg-dark-800 rounded animate-pulse" />
    </View>
  )
}

function EmptyState() {
  return (
    <View className="items-center py-4">
      <Text className="text-dark-500 text-sm">No address generated</Text>
    </View>
  )
}

// ============================================================================
// UTILITIES
// ============================================================================

interface ParsedAddress {
  prefix: string
  chain: string
  spendingKey: string
  viewingKey: string
}

function parseStealthAddress(address: string | null): ParsedAddress | null {
  if (!address) return null

  // Format: sip:chain:spendingKey:viewingKey
  const parts = address.split(":")
  if (parts.length !== 4) return null

  return {
    prefix: parts[0],
    chain: parts[1],
    spendingKey: parts[2],
    viewingKey: parts[3],
  }
}

