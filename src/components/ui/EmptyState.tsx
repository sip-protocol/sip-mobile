/**
 * Empty State Component
 *
 * Reusable empty state display with optional action.
 * Uses Phosphor icons for consistency across the app.
 */

import React from "react"
import { View, Text, Pressable } from "react-native"
import { ICONS, ICON_COLORS } from "@/constants/icons"
import type { Icon as PhosphorIcon } from "phosphor-react-native"

// ============================================================================
// TYPES
// ============================================================================

type EmptyIconCategory = keyof typeof ICONS.empty
type IconColor = keyof typeof ICON_COLORS

export interface EmptyStateProps {
  /** Title */
  title: string
  /** Description message */
  message?: string
  /** Icon category from ICONS.empty (e.g., "transactions", "payments", "wallet") */
  iconName?: EmptyIconCategory
  /** Direct Phosphor icon component (for custom icons) */
  IconComponent?: PhosphorIcon
  /** Icon color preset or hex string */
  iconColor?: IconColor | string
  /** Action button text */
  actionLabel?: string
  /** Action callback */
  onAction?: () => void
  /** Custom className */
  className?: string
}

// ============================================================================
// COMPONENT
// ============================================================================

export function EmptyState({
  title,
  message,
  iconName = "folder",
  IconComponent,
  iconColor = "muted",
  actionLabel,
  onAction,
  className = "",
}: EmptyStateProps) {
  // Resolve icon component
  const Icon = IconComponent || ICONS.empty[iconName] || ICONS.empty.folder

  // Resolve color
  const resolvedColor =
    iconColor in ICON_COLORS
      ? ICON_COLORS[iconColor as IconColor]
      : iconColor

  return (
    <View className={`items-center justify-center p-8 ${className}`}>
      <View className="w-20 h-20 bg-dark-800 rounded-full items-center justify-center mb-4">
        <Icon size={40} color={resolvedColor} weight="regular" />
      </View>

      <Text className="text-white text-lg font-semibold text-center mb-2">
        {title}
      </Text>

      {message && (
        <Text className="text-dark-400 text-center mb-6 max-w-[280px]">
          {message}
        </Text>
      )}

      {actionLabel && onAction && (
        <Pressable
          onPress={onAction}
          className="bg-brand-600 px-6 py-3 rounded-xl active:bg-brand-700"
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text className="text-white font-semibold">{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  )
}

// ============================================================================
// PRESET EMPTY STATES
// ============================================================================

/**
 * No transactions empty state
 */
export function NoTransactions({ onSend }: { onSend?: () => void }) {
  return (
    <EmptyState
      title="No Transactions Yet"
      message="Your transaction history will appear here once you send or receive payments."
      iconName="transactions"
      iconColor="success"
      actionLabel={onSend ? "Send Payment" : undefined}
      onAction={onSend}
    />
  )
}

/**
 * No payments empty state
 */
export function NoPayments({ onReceive }: { onReceive?: () => void }) {
  return (
    <EmptyState
      title="No Payments Found"
      message="Scan for incoming payments or generate a receive address to get started."
      iconName="payments"
      iconColor="success"
      actionLabel={onReceive ? "Receive" : undefined}
      onAction={onReceive}
    />
  )
}

/**
 * No swaps empty state
 */
export function NoSwaps({ onSwap }: { onSwap?: () => void }) {
  return (
    <EmptyState
      title="No Swaps Yet"
      message="Your swap history will appear here. Start by exchanging tokens."
      iconName="swaps"
      iconColor="info"
      actionLabel={onSwap ? "Swap Now" : undefined}
      onAction={onSwap}
    />
  )
}

/**
 * No audit events empty state
 */
export function NoAuditEvents() {
  return (
    <EmptyState
      title="No Audit Events"
      message="Activity will be recorded here as you use the app."
      iconName="audit"
      iconColor="brand"
    />
  )
}

/**
 * No disclosures empty state
 */
export function NoDisclosures({ onCreate }: { onCreate?: () => void }) {
  return (
    <EmptyState
      title="No Disclosures"
      message="You haven't shared any viewing keys yet. Disclosures allow trusted parties to view your transaction history."
      iconName="disclosures"
      iconColor="warning"
      actionLabel={onCreate ? "Create Disclosure" : undefined}
      onAction={onCreate}
    />
  )
}

/**
 * Search no results
 */
export function NoSearchResults({ query }: { query: string }) {
  return (
    <EmptyState
      title="No Results"
      message={`No results found for "${query}". Try a different search term.`}
      iconName="search"
      iconColor="muted"
    />
  )
}

/**
 * Wallet not connected
 */
export function WalletNotConnected({ onConnect }: { onConnect?: () => void }) {
  return (
    <EmptyState
      title="Wallet Not Connected"
      message="Connect your wallet to view your balances and make transactions."
      iconName="wallet"
      iconColor="success"
      actionLabel={onConnect ? "Connect Wallet" : undefined}
      onAction={onConnect}
    />
  )
}
