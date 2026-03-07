/**
 * Account Avatar Component
 *
 * Displays an account's emoji avatar at configurable sizes.
 * Falls back to a person silhouette when no emoji is set.
 * Optionally wraps in TouchableOpacity for sidebar trigger.
 */

import { View, Text, TouchableOpacity } from "react-native"

// ============================================================================
// CONSTANTS
// ============================================================================

const FALLBACK_EMOJI = "\u{1F464}" // bust in silhouette

export const SIZES = {
  sm: { container: "w-8 h-8 rounded-lg", text: "text-lg" },
  md: { container: "w-10 h-10 rounded-xl", text: "text-xl" },
  lg: { container: "w-16 h-16 rounded-2xl", text: "text-3xl" },
} as const

// ============================================================================
// TYPES
// ============================================================================

export interface AccountAvatarProps {
  /** Emoji character to display */
  emoji: string
  /** Avatar size variant */
  size?: "sm" | "md" | "lg"
  /** When provided, wraps avatar in a touchable */
  onPress?: () => void
}

// ============================================================================
// HELPERS
// ============================================================================

/** Resolve display emoji, falling back to person icon for empty/undefined */
export function resolveEmoji(emoji: string | undefined): string {
  return emoji || FALLBACK_EMOJI
}

// ============================================================================
// COMPONENT
// ============================================================================

export function AccountAvatar({
  emoji,
  size = "md",
  onPress,
}: AccountAvatarProps) {
  const s = SIZES[size]
  const displayEmoji = resolveEmoji(emoji)

  const content = (
    <View className={`${s.container} bg-dark-800 items-center justify-center`}>
      <Text className={s.text}>{displayEmoji}</Text>
    </View>
  )

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Account avatar"
      >
        {content}
      </TouchableOpacity>
    )
  }

  return content
}
