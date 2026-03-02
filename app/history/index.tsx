/**
 * History Screen
 *
 * Transaction history with filtering:
 * - Filter by type (send/receive)
 * - Filter by status (pending/completed/failed/claimed)
 * - Filter by privacy level
 * - Search by address or tx hash
 */

import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  TextInput,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { useState, useMemo, useCallback } from "react"
import { usePrivacyStore } from "@/stores/privacy"
import { useWalletStore } from "@/stores/wallet"
import { useSettingsStore } from "@/stores/settings"
import type { PaymentRecord, PrivacyLevel } from "@/types"
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  MagnifyingGlass,
  X,
  ShieldCheck,
  Lock,
  Eye,
  ClipboardText,
} from "phosphor-react-native"
import { ICON_COLORS } from "@/constants/icons"

// ============================================================================
// TYPES
// ============================================================================

type FilterType = "all" | "send" | "receive"
type FilterStatus = "all" | "pending" | "completed" | "failed" | "claimed"
type FilterPrivacy = "all" | "shielded" | "compliant" | "transparent"

// ============================================================================
// HELPERS
// ============================================================================

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  })
}

function formatAmount(amount: string, type: "send" | "receive"): string {
  const num = parseFloat(amount)
  if (isNaN(num)) return amount
  const prefix = type === "send" ? "-" : "+"
  return `${prefix}${num.toFixed(4)}`
}

function getStatusColor(status: PaymentRecord["status"]): string {
  switch (status) {
    case "completed":
      return "text-green-400"
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

function getPrivacyIcon(level: PrivacyLevel): React.ReactNode {
  switch (level) {
    case "shielded":
      return <ShieldCheck size={14} color={ICON_COLORS.success} weight="fill" />
    case "compliant":
      return <Lock size={14} color={ICON_COLORS.brand} weight="fill" />
    case "transparent":
      return <Eye size={14} color={ICON_COLORS.muted} weight="fill" />
  }
}

// ============================================================================
// COMPONENTS
// ============================================================================

interface TransactionItemProps {
  payment: PaymentRecord
  onPress: () => void
}

function TransactionItem({ payment, onPress }: TransactionItemProps) {
  const isReceive = payment.type === "receive"

  return (
    <TouchableOpacity
      className="flex-row items-center py-4 px-4 border-b border-dark-900"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${isReceive ? "Received" : "Sent"} ${formatAmount(payment.amount, payment.type)} ${payment.token}, ${payment.status}`}
      accessibilityHint="Opens transaction details"
    >
      {/* Icon */}
      <View
        className={`w-10 h-10 rounded-full items-center justify-center ${
          isReceive ? "bg-green-900/30" : "bg-brand-900/30"
        }`}
      >
        {isReceive ? (
          <ArrowDown size={20} color={ICON_COLORS.success} weight="bold" />
        ) : (
          <ArrowUp size={20} color={ICON_COLORS.brand} weight="bold" />
        )}
      </View>

      {/* Details */}
      <View className="flex-1 ml-3">
        <View className="flex-row items-center">
          <Text className="text-white font-medium">
            {isReceive ? "Received" : "Sent"}
          </Text>
          <Text className="text-dark-600 mx-1">•</Text>
          <Text className={`text-sm ${getStatusColor(payment.status)}`}>
            {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
          </Text>
        </View>
        <View className="flex-row items-center mt-0.5">
          <Text className="text-dark-500 text-sm">{formatDate(payment.timestamp)}</Text>
          <Text className="text-dark-600 mx-1">•</Text>
          <View className="flex-row items-center">
            {getPrivacyIcon(payment.privacyLevel)}
          </View>
        </View>
      </View>

      {/* Amount */}
      <View className="items-end">
        <Text
          className={`font-semibold ${
            isReceive ? "text-green-400" : "text-white"
          }`}
        >
          {formatAmount(payment.amount, payment.type)} {payment.token}
        </Text>
        {payment.stealthAddress && (
          <Text className="text-dark-600 text-xs">Stealth</Text>
        )}
      </View>
    </TouchableOpacity>
  )
}

interface FilterChipProps {
  label: string
  isActive: boolean
  onPress: () => void
}

function FilterChip({ label, isActive, onPress }: FilterChipProps) {
  return (
    <TouchableOpacity
      className={`px-4 py-2 rounded-full mr-2 ${
        isActive ? "bg-brand-600" : "bg-dark-800"
      }`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Filter: ${label}`}
      accessibilityState={{ selected: isActive }}
    >
      <Text className={isActive ? "text-white font-medium" : "text-dark-400"}>
        {label}
      </Text>
    </TouchableOpacity>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function HistoryScreen() {
  const { payments, isScanning } = usePrivacyStore()
  const { isConnected } = useWalletStore()
  const { network } = useSettingsStore()

  const [filterType, setFilterType] = useState<FilterType>("all")
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all")
  const [filterPrivacy, setFilterPrivacy] = useState<FilterPrivacy>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [refreshing, setRefreshing] = useState(false)

  // Filter payments by current network (legacy payments without network field are treated as devnet)
  const networkPayments = useMemo(() =>
    payments.filter((p) => (p.network || "devnet") === network),
    [payments, network]
  )

  // Filter payments
  const filteredPayments = useMemo(() => {
    let result = [...networkPayments]

    // Filter by type
    if (filterType !== "all") {
      result = result.filter((p) => p.type === filterType)
    }

    // Filter by status
    if (filterStatus !== "all") {
      result = result.filter((p) => p.status === filterStatus)
    }

    // Filter by privacy level
    if (filterPrivacy !== "all") {
      result = result.filter((p) => p.privacyLevel === filterPrivacy)
    }

    // Search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (p) =>
          p.txHash?.toLowerCase().includes(query) ||
          p.stealthAddress?.toLowerCase().includes(query) ||
          p.id.toLowerCase().includes(query)
      )
    }

    // Sort by timestamp (newest first)
    result.sort((a, b) => b.timestamp - a.timestamp)

    return result
  }, [networkPayments, filterType, filterStatus, filterPrivacy, searchQuery])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    // Simulate refresh - in production, this would trigger a scan
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setRefreshing(false)
  }, [])

  const handleTransactionPress = useCallback((payment: PaymentRecord) => {
    router.push(`/history/${payment.id}`)
  }, [])

  const renderEmptyState = () => (
    <View className="flex-1 items-center justify-center py-20">
      <View className="w-20 h-20 rounded-full bg-dark-800 items-center justify-center mb-4">
        <ClipboardText size={40} color={ICON_COLORS.inactive} weight="fill" />
      </View>
      <Text className="text-white font-semibold text-lg">No Transactions</Text>
      <Text className="text-dark-500 text-center mt-2 px-8">
        {!isConnected
          ? "Connect your wallet to view transaction history"
          : filterType !== "all" || filterStatus !== "all"
          ? "No transactions match your filters"
          : "Your transaction history will appear here"}
      </Text>
    </View>
  )

  const renderHeader = () => (
    <View className="px-4 pb-4">
      {/* Search Bar */}
      <View className="bg-dark-900 border border-dark-800 rounded-xl px-4 py-3 flex-row items-center">
        <MagnifyingGlass size={18} color={ICON_COLORS.inactive} weight="bold" />
        <TextInput
          className="flex-1 text-white ml-2"
          placeholder="Search by tx hash or address"
          placeholderTextColor="#71717a"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchQuery("")}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <X size={18} color={ICON_COLORS.inactive} weight="bold" />
          </TouchableOpacity>
        )}
      </View>

      {/* Type Filters */}
      <View className="flex-row mt-4">
        <FilterChip
          label="All"
          isActive={filterType === "all"}
          onPress={() => setFilterType("all")}
        />
        <FilterChip
          label="Sent"
          isActive={filterType === "send"}
          onPress={() => setFilterType("send")}
        />
        <FilterChip
          label="Received"
          isActive={filterType === "receive"}
          onPress={() => setFilterType("receive")}
        />
      </View>

      {/* Status Filters */}
      <View className="flex-row mt-3">
        <FilterChip
          label="All Status"
          isActive={filterStatus === "all"}
          onPress={() => setFilterStatus("all")}
        />
        <FilterChip
          label="Pending"
          isActive={filterStatus === "pending"}
          onPress={() => setFilterStatus("pending")}
        />
        <FilterChip
          label="Completed"
          isActive={filterStatus === "completed"}
          onPress={() => setFilterStatus("completed")}
        />
      </View>

      {/* Privacy Level Filters */}
      <View className="flex-row mt-3">
        <FilterChip
          label="All Privacy"
          isActive={filterPrivacy === "all"}
          onPress={() => setFilterPrivacy("all")}
        />
        <FilterChip
          label="🛡️ Private"
          isActive={filterPrivacy === "shielded"}
          onPress={() => setFilterPrivacy("shielded")}
        />
        <FilterChip
          label="🔒 Compliant"
          isActive={filterPrivacy === "compliant"}
          onPress={() => setFilterPrivacy("compliant")}
        />
      </View>

      {/* Results Count */}
      <View className="flex-row items-center justify-between mt-4 pt-4 border-t border-dark-900">
        <Text className="text-dark-500">
          {filteredPayments.length} transaction
          {filteredPayments.length !== 1 ? "s" : ""}
        </Text>
        {isScanning && (
          <View className="flex-row items-center">
            <Text className="text-brand-400 text-sm">Scanning...</Text>
          </View>
        )}
      </View>
    </View>
  )

  return (
    <SafeAreaView className="flex-1 bg-dark-950">
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4">
        <TouchableOpacity
          className="flex-row items-center"
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={24} color={ICON_COLORS.white} weight="bold" />
          <Text className="text-white ml-4 text-lg">Back</Text>
        </TouchableOpacity>
        <Text className="text-xl font-bold text-white">History</Text>
        <View className="w-16" />
      </View>

      {/* Transaction List */}
      <FlatList
        data={filteredPayments}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TransactionItem
            payment={item}
            onPress={() => handleTransactionPress(item)}
          />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#8b5cf6"
            colors={["#8b5cf6"]}
          />
        }
        contentContainerStyle={filteredPayments.length === 0 ? { flex: 1 } : undefined}
      />
    </SafeAreaView>
  )
}
