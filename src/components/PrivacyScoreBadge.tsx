/**
 * Privacy Score Badge
 *
 * Circular badge displaying a privacy score (0-100) with
 * color-coded tiers: Exposed (red), Partial (yellow), Shielded (green).
 *
 * Helper functions are exported for testability.
 */

import React from "react"
import { View, Text } from "react-native"

// ============================================================================
// TYPES
// ============================================================================

export type ScoreTier = "exposed" | "partial" | "shielded"

export interface PrivacyScoreBadgeProps {
  /** Privacy score 0-100 */
  score: number
  /** Badge size: sm=32, md=48, lg=72 */
  size?: "sm" | "md" | "lg"
  /** Show tier label below the badge */
  showLabel?: boolean
}

// ============================================================================
// HELPERS
// ============================================================================

const TIER_COLORS: Record<ScoreTier, string> = {
  exposed: "#ef4444",
  partial: "#eab308",
  shielded: "#22c55e",
}

const TIER_LABELS: Record<ScoreTier, string> = {
  exposed: "Exposed",
  partial: "Partial",
  shielded: "Shielded",
}

const SIZE_MAP = {
  sm: 32,
  md: 48,
  lg: 72,
} as const

const FONT_SIZE_MAP = {
  sm: 11,
  md: 16,
  lg: 24,
} as const

const BORDER_WIDTH_MAP = {
  sm: 2,
  md: 3,
  lg: 4,
} as const

const LABEL_FONT_SIZE_MAP = {
  sm: 9,
  md: 11,
  lg: 13,
} as const

/** Classify a score into a privacy tier. Clamps to [0, 100]. */
export function getScoreTier(score: number): ScoreTier {
  const clamped = Math.max(0, Math.min(100, score))
  if (clamped <= 33) return "exposed"
  if (clamped <= 66) return "partial"
  return "shielded"
}

/** Return the hex color for a given score tier. */
export function getScoreColor(tier: ScoreTier): string {
  return TIER_COLORS[tier]
}

/** Return the human-readable label for a given score tier. */
export function getScoreLabel(tier: ScoreTier): string {
  return TIER_LABELS[tier]
}

// ============================================================================
// COMPONENT
// ============================================================================

export function PrivacyScoreBadge({
  score,
  size = "md",
  showLabel = false,
}: PrivacyScoreBadgeProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)))
  const tier = getScoreTier(clamped)
  const color = getScoreColor(tier)
  const label = getScoreLabel(tier)
  const dimension = SIZE_MAP[size]
  const fontSize = FONT_SIZE_MAP[size]
  const borderWidth = BORDER_WIDTH_MAP[size]
  const labelFontSize = LABEL_FONT_SIZE_MAP[size]

  return (
    <View className="items-center">
      <View
        style={{
          width: dimension,
          height: dimension,
          borderRadius: dimension / 2,
          borderWidth,
          borderColor: color,
        }}
        className="items-center justify-center bg-dark-900"
        accessibilityLabel={`Privacy score ${clamped}, ${label}`}
        accessibilityRole="text"
      >
        <Text
          style={{ fontSize, color }}
          className="font-bold"
        >
          {clamped}
        </Text>
      </View>
      {showLabel && (
        <Text
          style={{ fontSize: labelFontSize, color }}
          className="font-medium mt-1"
        >
          {label}
        </Text>
      )}
    </View>
  )
}
