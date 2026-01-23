/**
 * Token Icon Component
 *
 * Displays token icons with fallback to emoji/initials
 */

import { View, Text, Image } from "react-native"
import { useState } from "react"
import type { TokenInfo } from "@/types"

// ============================================================================
// CONSTANTS
// ============================================================================

const TOKEN_EMOJIS: Record<string, string> = {
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

// ============================================================================
// TYPES
// ============================================================================

interface TokenIconProps {
  token: TokenInfo
  size?: "sm" | "md" | "lg" | "xl"
  showBackground?: boolean
}

// ============================================================================
// COMPONENT
// ============================================================================

export function TokenIcon({
  token,
  size = "md",
  showBackground = true,
}: TokenIconProps) {
  const [imageError, setImageError] = useState(false)

  const sizeClasses = {
    sm: { container: "w-6 h-6", text: "text-sm", image: 24 },
    md: { container: "w-10 h-10", text: "text-xl", image: 40 },
    lg: { container: "w-12 h-12", text: "text-2xl", image: 48 },
    xl: { container: "w-16 h-16", text: "text-3xl", image: 64 },
  }

  const { container, text, image } = sizeClasses[size]

  // Try to use logo URI first
  if (token.logoUri && !imageError) {
    return (
      <View
        className={`${container} rounded-full overflow-hidden ${
          showBackground ? "bg-dark-800" : ""
        }`}
      >
        <Image
          source={{ uri: token.logoUri }}
          style={{ width: image, height: image }}
          onError={() => setImageError(true)}
          resizeMode="cover"
        />
      </View>
    )
  }

  // Fallback to emoji or initials
  const emoji = TOKEN_EMOJIS[token.symbol]
  const display = emoji || token.symbol.charAt(0).toUpperCase()

  return (
    <View
      className={`${container} rounded-full items-center justify-center ${
        showBackground ? "bg-dark-800" : ""
      }`}
    >
      <Text className={`${text} ${emoji ? "" : "text-white font-bold"}`}>
        {display}
      </Text>
    </View>
  )
}

// ============================================================================
// HELPER EXPORT
// ============================================================================

export function getTokenEmoji(symbol: string): string {
  return TOKEN_EMOJIS[symbol] || "🪙"
}
