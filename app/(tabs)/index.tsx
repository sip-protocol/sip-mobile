/**
 * Home Screen
 *
 * Main dashboard showing:
 * - Wallet balance
 * - Quick actions (Shield, History, Keys)
 * - Recent transaction activity
 */

import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Image } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { useCallback, useState, useMemo, useEffect } from "react"
import { markPerformance } from "@/utils/performance"
import { hapticLight } from "@/utils/haptics"

// Mark when home screen module loads
markPerformance("home_module_load")
import * as Clipboard from "expo-clipboard"
import { useWalletStore, formatAddress } from "@/stores/wallet"
import { usePrivacyStore } from "@/stores/privacy"
import { useSettingsStore } from "@/stores/settings"
import { useClaim } from "@/hooks/useClaim"
import { useBalance } from "@/hooks/useBalance"
import { useToastStore } from "@/stores/toast"
import { AccountIndicator } from "@/components/AccountSwitcher"
import { FEATURED_TOKENS, getToken, formatTokenAmount } from "@/data/tokens"
import {
  ShieldCheckIcon,
  ClockCounterClockwiseIcon,
  KeyIcon,
  CoinsIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  ListChecksIcon,
  ShieldStarIcon,
  ClockIcon,
  LockIcon,
  EyeIcon,
} from "phosphor-react-native"
import type { IconProps } from "phosphor-react-native"
import type { ComponentType } from "react"
import type { PaymentRecord } from "@/types"

// ============================================================================
// HELPERS
// ============================================================================

function formatTimeAgo(timestamp: number): string {
  const now = Date.now()
  const diffMs = now - timestamp
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

function getStatusColor(status: PaymentRecord["status"]): string {
  switch (status) {
    case "completed":
    case "claimed":
      return "text-green-400"
    case "pending":
      return "text-yellow-400"
    case "failed":
      return "text-red-400"
    default:
      return "text-dark-400"
  }
}

function getNetworkDisplayName(network: "mainnet-beta" | "devnet" | "testnet"): string {
  switch (network) {
    case "mainnet-beta":
      return "Mainnet"
    case "devnet":
      return "Devnet"
    case "testnet":
      return "Testnet"
    default:
      return "Unknown"
  }
}

function getNetworkBadgeColor(network: "mainnet-beta" | "devnet" | "testnet"): string {
  switch (network) {
    case "mainnet-beta":
      return "bg-green-900/30 text-green-400"
    case "devnet":
      return "bg-yellow-900/30 text-yellow-400"
    case "testnet":
      return "bg-orange-900/30 text-orange-400"
    default:
      return "bg-dark-800 text-dark-400"
  }
}

// ============================================================================
// COMPONENTS
// ============================================================================

interface QuickActionProps {
  Icon: ComponentType<IconProps>
  label: string
  sublabel: string
  variant?: "primary" | "default"
  onPress: () => void
}

function QuickAction({
  Icon,
  label,
  sublabel,
  variant = "default",
  onPress,
}: QuickActionProps) {
  return (
    <TouchableOpacity
      className={`flex-1 rounded-xl p-4 items-center ${
        variant === "primary"
          ? "bg-brand-900/20 border border-brand-800/30"
          : "bg-dark-900 border border-dark-800"
      }`}
      onPress={() => {
        hapticLight()
        onPress()
      }}
    >
      <Icon
        size={28}
        weight="duotone"
        color={variant === "primary" ? "#a78bfa" : "#e4e4e7"}
      />
      <Text
        className={`mt-2 font-medium ${
          variant === "primary" ? "text-brand-400" : "text-white"
        }`}
      >
        {label}
      </Text>
      <Text className="text-dark-500 text-xs mt-1">{sublabel}</Text>
    </TouchableOpacity>
  )
}

interface TransactionRowProps {
  payment: PaymentRecord
  onPress: () => void
}

function TransactionRow({ payment, onPress }: TransactionRowProps) {
  const isReceive = payment.type === "receive"

  // Privacy level indicator
  const PrivacyIcon =
    payment.privacyLevel === "compliant"
      ? LockIcon
      : payment.privacyLevel === "transparent"
      ? EyeIcon
      : ShieldCheckIcon
  const privacyColor =
    payment.privacyLevel === "compliant"
      ? "#22d3ee" // cyan
      : payment.privacyLevel === "transparent"
      ? "#71717a" // gray
      : "#a78bfa" // purple

  return (
    <TouchableOpacity
      className="flex-row items-center py-3 border-b border-dark-900"
      onPress={onPress}
    >
      <View
        className={`w-10 h-10 rounded-full items-center justify-center ${
          isReceive ? "bg-green-900/30" : "bg-brand-900/30"
        }`}
      >
        {isReceive ? (
          <ArrowDownIcon size={20} weight="bold" color="#4ade80" />
        ) : (
          <ArrowUpIcon size={20} weight="bold" color="#a78bfa" />
        )}
      </View>
      <View className="flex-1 ml-3">
        <Text className="text-white font-medium">
          {isReceive ? "Received" : "Sent"}
        </Text>
        <View className="flex-row items-center gap-1">
          <Text className="text-dark-500 text-sm">
            {formatTimeAgo(payment.timestamp)}
          </Text>
          <Text className="text-dark-600">•</Text>
          <PrivacyIcon size={12} weight="fill" color={privacyColor} />
        </View>
      </View>
      <View className="items-end">
        <Text
          className={`font-semibold ${isReceive ? "text-green-400" : "text-white"}`}
        >
          {isReceive ? "+" : "-"}
          {parseFloat(payment.amount).toFixed(4)} {payment.token}
        </Text>
        <Text className={`text-xs ${getStatusColor(payment.status)}`}>
          {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
        </Text>
      </View>
    </TouchableOpacity>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function HomeScreen() {
  const { isConnected, address } = useWalletStore()
  const { payments } = usePrivacyStore()
  const { network } = useSettingsStore()
  const { addToast } = useToastStore()
  const { getClaimableAmount } = useClaim()
  const { balance, usdValue, isLoading: balanceLoading, refresh: refreshBalance } = useBalance()
  const [refreshing, setRefreshing] = useState(false)

  // Mark when home screen first renders
  useEffect(() => {
    markPerformance("home_first_render")
  }, [])

  // Filter payments by current network (legacy payments without network field are treated as devnet)
  const networkPayments = useMemo(() =>
    payments.filter((p) => (p.network || "devnet") === network),
    [payments, network]
  )

  // Memoize expensive computations (now using network-filtered payments)
  const recentPayments = useMemo(() => networkPayments.slice(0, 5), [networkPayments])
  const claimable = useMemo(() => getClaimableAmount(), [payments])
  const { count: unclaimedCount, amount: unclaimedAmount } = claimable

  // Memoize privacy stats (now using network-filtered payments)
  const privacyStats = useMemo(() => ({
    total: networkPayments.length,
    private: networkPayments.filter((p) => p.privacyLevel !== "transparent").length,
    pending: networkPayments.filter((p) => p.status === "pending").length,
  }), [networkPayments])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await refreshBalance()
    setRefreshing(false)
  }, [refreshBalance])

  const handleTransactionPress = useCallback((payment: PaymentRecord) => {
    router.push(`/history/${payment.id}`)
  }, [])

  const handleCopyAddress = useCallback(async () => {
    if (!address) return
    await Clipboard.setStringAsync(address)
    addToast({
      type: "success",
      title: "Address Copied",
      message: "Wallet address copied to clipboard",
    })
  }, [address, addToast])

  return (
    <SafeAreaView className="flex-1 bg-dark-950">
      <ScrollView
        testID="home-scroll-view"
        className="flex-1 px-4"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#8b5cf6"
            colors={["#8b5cf6"]}
          />
        }
      >
        {/* Header */}
        <View className="pt-6 pb-4 flex-row items-center justify-between">
          <View>
            <View className="flex-row items-center">
              <Image
                source={require("../../assets/logo-mark.png")}
                style={{ width: 36, height: 36 }}
                resizeMode="contain"
              />
              <Text className="text-3xl font-bold text-white ml-2">SIP Privacy</Text>
            </View>
            <Text className="text-dark-400 mt-1">
              Private transactions on Solana
            </Text>
          </View>
          {isConnected && (
            <AccountIndicator onPress={() => router.push("/settings/accounts")} />
          )}
        </View>

        {/* Balance Card */}
        <View className="bg-dark-900 rounded-2xl p-6 mt-4 border border-dark-800">
          <View className="flex-row items-center justify-between">
            <Text className="text-dark-400 text-sm">Total Balance</Text>
            {isConnected && (
              <View className="flex-row items-center gap-2">
                <View className="flex-row items-center">
                  <View className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                  <Text className="text-dark-500 text-sm">Connected</Text>
                </View>
                <View className={`px-2 py-0.5 rounded-full ${getNetworkBadgeColor(network)}`}>
                  <Text className={`text-xs font-medium ${getNetworkBadgeColor(network).split(' ')[1]}`}>
                    {getNetworkDisplayName(network)}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {isConnected ? (
            <>
              <Text testID="wallet-balance" className="text-4xl font-bold text-white mt-2">
                {balanceLoading ? "..." : balance.toFixed(4)} SOL
              </Text>
              <Text className="text-dark-500 mt-1">
                ≈ ${usdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </Text>
              <TouchableOpacity
                className="flex-row items-center mt-3 pt-3 border-t border-dark-800"
                onPress={handleCopyAddress}
                activeOpacity={0.7}
              >
                <Text className="text-dark-500 text-sm">
                  {formatAddress(address)}
                </Text>
                <Text className="text-dark-600 text-xs ml-2">Tap to copy</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text className="text-4xl font-bold text-white mt-2">---.-- SOL</Text>
              <Text className="text-dark-500 mt-1">Connect wallet to view</Text>
              <TouchableOpacity
                testID="setup-wallet-button"
                className="mt-4 bg-brand-600 rounded-xl py-3 items-center"
                onPress={() => router.push("/wallet-setup")}
              >
                <Text className="text-white font-semibold">Set Up Wallet</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Quick Actions */}
        <View className="flex-row mt-6 gap-3">
          <QuickAction
            Icon={ShieldCheckIcon}
            label="Private"
            sublabel="Shield funds"
            variant="primary"
            onPress={() => router.push("/(tabs)/send")}
          />
          <QuickAction
            Icon={ClockCounterClockwiseIcon}
            label="History"
            sublabel="View activity"
            onPress={() => router.push("/history")}
          />
          <QuickAction
            Icon={KeyIcon}
            label="Keys"
            sublabel="Manage keys"
            onPress={() => router.push("/settings/viewing-keys")}
          />
        </View>

        {/* Featured Tokens */}
        {isConnected && (
          <View className="mt-6">
            <Text className="text-lg font-semibold text-white mb-3">
              Featured Tokens
            </Text>
            <View className="flex-row gap-3">
              {FEATURED_TOKENS.map((symbol) => {
                const token = getToken(symbol)
                if (!token) return null
                const isSol = symbol === "SOL"
                const tokenBalance = isSol ? balance : 0
                const tokenUsd = isSol ? usdValue : 0
                return (
                  <View
                    key={symbol}
                    className="flex-1 bg-dark-900 rounded-xl p-4 border border-dark-800"
                  >
                    <View className="flex-row items-center gap-2">
                      <Text className="text-white font-bold text-base">
                        {token.symbol}
                      </Text>
                      {symbol === "SKR" && (
                        <View className="bg-brand-900/30 px-1.5 py-0.5 rounded">
                          <Text className="text-brand-400 text-[10px] font-semibold">
                            Seeker
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-white text-lg mt-2">
                      {balanceLoading && isSol
                        ? "..."
                        : formatTokenAmount(tokenBalance, token.decimals)}
                    </Text>
                    <Text className="text-dark-500 text-sm mt-0.5">
                      ${tokenUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </Text>
                  </View>
                )
              })}
            </View>
          </View>
        )}

        {/* Unclaimed Payments Banner */}
        {isConnected && unclaimedCount > 0 && (
          <TouchableOpacity
            className="mt-6 bg-green-900/20 border border-green-700/50 rounded-xl p-4 flex-row items-center"
            onPress={() => router.push("/claim")}
          >
            <View className="w-12 h-12 bg-green-900/30 rounded-full items-center justify-center">
              <CoinsIcon size={24} weight="duotone" color="#4ade80" />
            </View>
            <View className="flex-1 ml-3">
              <Text className="text-green-400 font-semibold">
                {unclaimedCount} Unclaimed Payment{unclaimedCount !== 1 ? "s" : ""}
              </Text>
              <Text className="text-dark-400 text-sm">
                {unclaimedAmount.toFixed(4)} SOL ready to claim
              </Text>
            </View>
            <ArrowDownIcon size={24} weight="bold" color="#4ade80" style={{ transform: [{ rotate: '-90deg' }] }} />
          </TouchableOpacity>
        )}

        {/* Privacy Stats */}
        {isConnected && privacyStats.total > 0 && (
          <View className="flex-row mt-6 gap-3">
            <View className="flex-1 bg-dark-900 rounded-xl p-4 border border-dark-800">
              <View className="flex-row items-center gap-1.5">
                <ListChecksIcon size={14} weight="bold" color="#a1a1aa" />
                <Text className="text-dark-500 text-sm">Transfers</Text>
              </View>
              <Text className="text-2xl font-bold text-white mt-1">
                {privacyStats.total}
              </Text>
            </View>
            <View className="flex-1 bg-dark-900 rounded-xl p-4 border border-dark-800">
              <View className="flex-row items-center gap-1.5">
                <ShieldStarIcon size={14} weight="bold" color="#a78bfa" />
                <Text className="text-dark-500 text-sm">Private</Text>
              </View>
              <Text className="text-2xl font-bold text-brand-400 mt-1">
                {privacyStats.private}
              </Text>
            </View>
            <View className="flex-1 bg-dark-900 rounded-xl p-4 border border-dark-800">
              <View className="flex-row items-center gap-1.5">
                <ClockIcon size={14} weight="bold" color="#facc15" />
                <Text className="text-dark-500 text-sm">Pending</Text>
              </View>
              <Text className="text-2xl font-bold text-yellow-400 mt-1">
                {privacyStats.pending}
              </Text>
            </View>
          </View>
        )}

        {/* Recent Activity */}
        <View className="mt-8 mb-8">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-semibold text-white">
              Recent Activity
            </Text>
            {privacyStats.total > 0 && (
              <TouchableOpacity onPress={() => router.push("/history")}>
                <Text className="text-brand-400">View All</Text>
              </TouchableOpacity>
            )}
          </View>

          {recentPayments.length > 0 ? (
            <View className="bg-dark-900 rounded-xl border border-dark-800 px-4">
              {recentPayments.map((payment) => (
                <TransactionRow
                  key={payment.id}
                  payment={payment}
                  onPress={() => handleTransactionPress(payment)}
                />
              ))}
            </View>
          ) : (
            <View className="bg-dark-900 rounded-xl border border-dark-800 p-6 items-center">
              <Text className="text-dark-500">No transactions yet</Text>
              <Text className="text-dark-600 text-sm mt-2 text-center">
                {isConnected
                  ? "Send or receive to see activity here"
                  : "Connect your wallet to get started"}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
