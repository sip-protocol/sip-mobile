/**
 * Error State Component
 *
 * Reusable error display with optional retry action.
 * Uses Phosphor icons for consistency across the app.
 */

import React from "react"
import { View, Text, Pressable } from "react-native"
import {
  WarningCircleIcon,
  CloudSlashIcon,
  LockKeyIcon,
  XCircleIcon,
} from "phosphor-react-native"
import type { Icon as PhosphorIcon } from "phosphor-react-native"
import { ICONS, ICON_COLORS } from "@/constants/icons"

// ============================================================================
// TYPES
// ============================================================================

type ErrorIconCategory = keyof typeof ICONS.status
type IconColor = keyof typeof ICON_COLORS

export interface ErrorStateProps {
  /** Error title */
  title?: string
  /** Error message */
  message?: string
  /** Retry callback */
  onRetry?: () => void
  /** Icon category from ICONS.status (e.g., "failed", "warning") */
  iconName?: ErrorIconCategory
  /** Direct Phosphor icon component (for custom icons) */
  IconComponent?: PhosphorIcon
  /** Icon color preset or hex string */
  iconColor?: IconColor | string
  /** Full screen mode */
  fullScreen?: boolean
  /** Custom className */
  className?: string
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ErrorState({
  title = "Something went wrong",
  message = "An unexpected error occurred. Please try again.",
  onRetry,
  iconName = "failed",
  IconComponent,
  iconColor = "error",
  fullScreen = false,
  className = "",
}: ErrorStateProps) {
  // Resolve icon component
  const Icon = IconComponent || ICONS.status[iconName] || WarningCircleIcon

  // Resolve color
  const resolvedColor =
    iconColor in ICON_COLORS
      ? ICON_COLORS[iconColor as IconColor]
      : iconColor

  const content = (
    <View className={`items-center p-8 ${className}`}>
      <View className="w-16 h-16 bg-red-500/20 rounded-full items-center justify-center mb-4">
        <Icon size={32} color={resolvedColor} weight="fill" />
      </View>

      <Text className="text-white text-lg font-semibold text-center mb-2">
        {title}
      </Text>

      <Text className="text-dark-400 text-center mb-6">{message}</Text>

      {onRetry && (
        <Pressable
          onPress={onRetry}
          className="bg-brand-600 px-6 py-3 rounded-xl active:bg-brand-700"
        >
          <Text className="text-white font-semibold">Try Again</Text>
        </Pressable>
      )}
    </View>
  )

  if (fullScreen) {
    return (
      <View className="flex-1 items-center justify-center bg-dark-950">
        {content}
      </View>
    )
  }

  return content
}

// ============================================================================
// PRESET ERROR STATES
// ============================================================================

/**
 * Network error variant
 */
export function NetworkError({ onRetry }: { onRetry?: () => void }) {
  return (
    <ErrorState
      title="No Connection"
      message="Please check your internet connection and try again."
      IconComponent={CloudSlashIcon}
      iconColor="warning"
      onRetry={onRetry}
    />
  )
}

/**
 * Permission denied variant
 */
export function PermissionDenied({
  permission,
  onRetry,
}: {
  permission: string
  onRetry?: () => void
}) {
  return (
    <ErrorState
      title="Permission Required"
      message={`Please grant ${permission} permission to continue.`}
      IconComponent={LockKeyIcon}
      iconColor="brand"
      onRetry={onRetry}
    />
  )
}

/**
 * Transaction failed variant
 */
export function TransactionFailed({
  message,
  onRetry,
}: {
  message?: string
  onRetry?: () => void
}) {
  return (
    <ErrorState
      title="Transaction Failed"
      message={message || "The transaction could not be completed. Please try again."}
      IconComponent={XCircleIcon}
      iconColor="error"
      onRetry={onRetry}
    />
  )
}
