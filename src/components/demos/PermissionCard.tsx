/**
 * PermissionCard Component
 *
 * Expandable card showing permission levels for viewing keys.
 * Used in onboarding to explain who sees what.
 */

import { View, Text, TouchableOpacity } from "react-native"
import { useState, useCallback } from "react"
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated"
import type { Icon as PhosphorIcon } from "phosphor-react-native"
import {
  CaretDownIcon,
} from "phosphor-react-native"
import { usePrefersReducedMotion } from "@/hooks"
import { ICON_COLORS } from "@/constants/icons"

// ============================================================================
// TYPES
// ============================================================================

export type PermissionLevel = "full" | "partial" | "none"

export interface PermissionCardProps {
  /** Icon component to display */
  icon: PhosphorIcon
  /** Title of the permission holder */
  title: string
  /** Short description of access level */
  accessLabel: string
  /** Permission level indicator */
  level: PermissionLevel
  /** Icon color override */
  iconColor?: string
  /** Expanded description (shown on tap) */
  expandedDescription?: string
}

// ============================================================================
// CONSTANTS
// ============================================================================

const LEVEL_INDICATORS: Record<PermissionLevel, { symbol: string; color: string }> = {
  full: { symbol: "\u2713", color: ICON_COLORS.success }, // checkmark
  partial: { symbol: "\u2299", color: ICON_COLORS.warning }, // circled dot
  none: { symbol: "\u2717", color: ICON_COLORS.error }, // x mark
}

// ============================================================================
// COMPONENT
// ============================================================================

export function PermissionCard({
  icon: IconComponent,
  title,
  accessLabel,
  level,
  iconColor = ICON_COLORS.white,
  expandedDescription,
}: PermissionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const shouldReduceMotion = usePrefersReducedMotion()

  // Animation values
  const expandProgress = useSharedValue(0)
  const rotateProgress = useSharedValue(0)

  const toggle = useCallback(() => {
    if (!expandedDescription) return

    const newExpanded = !isExpanded
    setIsExpanded(newExpanded)

    if (shouldReduceMotion) {
      expandProgress.value = newExpanded ? 1 : 0
      rotateProgress.value = newExpanded ? 1 : 0
    } else {
      expandProgress.value = withTiming(newExpanded ? 1 : 0, {
        duration: 200,
        easing: Easing.inOut(Easing.ease),
      })
      rotateProgress.value = withTiming(newExpanded ? 1 : 0, {
        duration: 200,
        easing: Easing.out(Easing.ease),
      })
    }
  }, [isExpanded, expandedDescription, shouldReduceMotion, expandProgress, rotateProgress])

  // Animated styles - 110px height to fit 3-4 lines of description
  const expandedStyle = useAnimatedStyle(() => ({
    height: expandProgress.value * 110,
    opacity: expandProgress.value,
    overflow: "hidden" as const,
  }))

  const caretStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotateProgress.value * 180}deg` }],
  }))

  const indicator = LEVEL_INDICATORS[level]
  const hasExpandable = Boolean(expandedDescription)

  return (
    <TouchableOpacity
      onPress={toggle}
      activeOpacity={hasExpandable ? 0.7 : 1}
      disabled={!hasExpandable}
      accessibilityLabel={`${title}: ${accessLabel}${hasExpandable ? ". Tap to learn more" : ""}`}
      accessibilityRole={hasExpandable ? "button" : "text"}
      accessibilityState={{ expanded: isExpanded }}
    >
      <View className="bg-dark-900 rounded-xl border border-dark-800 overflow-hidden">
        {/* Main row */}
        <View className="flex-row items-center p-4">
          {/* Icon */}
          <View className="w-10 h-10 rounded-full bg-dark-800 items-center justify-center mr-3">
            <IconComponent size={20} color={iconColor} weight="fill" />
          </View>

          {/* Content */}
          <View className="flex-1">
            <Text className="text-white font-medium">{title}</Text>
            <Text className="text-dark-500 text-sm">{accessLabel}</Text>
          </View>

          {/* Level indicator */}
          <View className="flex-row items-center gap-2">
            <Text
              className="text-lg font-bold"
              style={{ color: indicator.color }}
            >
              {indicator.symbol}
            </Text>

            {hasExpandable && (
              <Animated.View style={caretStyle}>
                <CaretDownIcon size={16} color={ICON_COLORS.muted} />
              </Animated.View>
            )}
          </View>
        </View>

        {/* Expandable content */}
        {hasExpandable && (
          <Animated.View style={expandedStyle}>
            <View className="px-4 pb-4 pt-0">
              <View className="bg-dark-850 rounded-lg p-3">
                <Text className="text-dark-400 text-sm leading-5">
                  {expandedDescription}
                </Text>
              </View>
            </View>
          </Animated.View>
        )}
      </View>
    </TouchableOpacity>
  )
}
