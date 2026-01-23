/**
 * Home Screen
 *
 * Main dashboard showing:
 * - Wallet balance
 * - Quick actions (Shield, History, Keys)
 * - Recent transaction activity
 */

import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { useState, useCallback } from "react"
import { useWalletStore, formatAddress } from "@/stores/wallet"
import { usePrivacyStore } from "@/stores/privacy"
import { useClaim } from "@/hooks/useClaim"
import { AccountIndicator } from "@/components/AccountSwitcher"
import type { PaymentRecord } from "@/types"

// Mock balance for demo
const MOCK_BALANCE = 12.45
const MOCK_USD_BALANCE = 2308.12

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

// ============================================================================
// COMPONENTS
// ============================================================================

interface QuickActionProps {
  icon: string
  label: string
  sublabel: string
  variant?: "primary" | "default"
  onPress: () => void
}

function QuickAction({
  icon,
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
      onPress={onPress}
    >
      <Text className="text-2xl">{icon}</Text>
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
        <Text className="text-lg">{isReceive ? "↓" : "↑"}</Text>
      </View>
      <View className="flex-1 ml-3">
        <Text className="text-white font-medium">
          {isReceive ? "Received" : "Sent"}
        </Text>
        <Text className="text-dark-500 text-sm">
          {formatTimeAgo(payment.timestamp)}
        </Text>
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
  const { getClaimableAmount } = useClaim()
  const [refreshing, setRefreshing] = useState(false)

  // Get recent payments (last 5)
  const recentPayments = payments.slice(0, 5)
  const { count: unclaimedCount, amount: unclaimedAmount } = getClaimableAmount()

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setRefreshing(false)
  }, [])

  const handleTransactionPress = useCallback((payment: PaymentRecord) => {
    router.push(`/history/${payment.id}`)
  }, [])

  return (
    <SafeAreaView className="flex-1 bg-dark-950">
      <ScrollView
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
            <Text className="text-3xl font-bold text-white">SIP Privacy</Text>
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
              <View className="flex-row items-center">
                <View className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                <Text className="text-dark-500 text-sm">Connected</Text>
              </View>
            )}
          </View>

          {isConnected ? (
            <>
              <Text className="text-4xl font-bold text-white mt-2">
                {MOCK_BALANCE.toFixed(4)} SOL
              </Text>
              <Text className="text-dark-500 mt-1">
                ≈ ${MOCK_USD_BALANCE.toLocaleString()}
              </Text>
              <View className="flex-row items-center mt-3 pt-3 border-t border-dark-800">
                <Text className="text-dark-500 text-sm">
                  {formatAddress(address)}
                </Text>
              </View>
            </>
          ) : (
            <>
              <Text className="text-4xl font-bold text-white mt-2">---.-- SOL</Text>
              <Text className="text-dark-500 mt-1">Connect wallet to view</Text>
              <TouchableOpacity
                className="mt-4 bg-brand-600 rounded-xl py-3 items-center"
                onPress={() => router.push("/(auth)/login")}
              >
                <Text className="text-white font-semibold">Connect Wallet</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Quick Actions */}
        <View className="flex-row mt-6 gap-3">
          <QuickAction
            icon="🔒"
            label="Private"
            sublabel="Shield funds"
            variant="primary"
            onPress={() => router.push("/(tabs)/send")}
          />
          <QuickAction
            icon="📊"
            label="History"
            sublabel="View activity"
            onPress={() => router.push("/history")}
          />
          <QuickAction
            icon="🔑"
            label="Keys"
            sublabel="Manage keys"
            onPress={() => {
              // TODO: Navigate to viewing keys screen
              router.push("/(tabs)/settings")
            }}
          />
        </View>

        {/* Unclaimed Payments Banner */}
        {isConnected && unclaimedCount > 0 && (
          <TouchableOpacity
            className="mt-6 bg-green-900/20 border border-green-700/50 rounded-xl p-4 flex-row items-center"
            onPress={() => router.push("/claim")}
          >
            <View className="w-12 h-12 bg-green-900/30 rounded-full items-center justify-center">
              <Text className="text-2xl">💰</Text>
            </View>
            <View className="flex-1 ml-3">
              <Text className="text-green-400 font-semibold">
                {unclaimedCount} Unclaimed Payment{unclaimedCount !== 1 ? "s" : ""}
              </Text>
              <Text className="text-dark-400 text-sm">
                {unclaimedAmount.toFixed(4)} SOL ready to claim
              </Text>
            </View>
            <Text className="text-green-400 text-2xl">→</Text>
          </TouchableOpacity>
        )}

        {/* Privacy Stats */}
        {isConnected && payments.length > 0 && (
          <View className="flex-row mt-6 gap-3">
            <View className="flex-1 bg-dark-900 rounded-xl p-4 border border-dark-800">
              <Text className="text-dark-500 text-sm">Total Transactions</Text>
              <Text className="text-2xl font-bold text-white mt-1">
                {payments.length}
              </Text>
            </View>
            <View className="flex-1 bg-dark-900 rounded-xl p-4 border border-dark-800">
              <Text className="text-dark-500 text-sm">Private</Text>
              <Text className="text-2xl font-bold text-brand-400 mt-1">
                {payments.filter((p) => p.privacyLevel !== "transparent").length}
              </Text>
            </View>
            <View className="flex-1 bg-dark-900 rounded-xl p-4 border border-dark-800">
              <Text className="text-dark-500 text-sm">Pending</Text>
              <Text className="text-2xl font-bold text-yellow-400 mt-1">
                {payments.filter((p) => p.status === "pending").length}
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
            {payments.length > 0 && (
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
