/**
 * Swap History Screen
 *
 * Displays user's complete swap history:
 * - Filterable by status (all/pending/completed/failed)
 * - Privacy badges for shielded swaps
 * - Explorer links for completed transactions
 * - Clear history option
 */

import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Linking,
  RefreshControl,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { useState, useMemo, useCallback } from "react"
import { useSwapStore } from "@/stores/swap"
import { useToastStore } from "@/stores/toast"
import { Modal } from "@/components/ui"
import type { SwapRecord } from "@/types"

// ============================================================================
// TYPES
// ============================================================================

type StatusFilter = "all" | "pending" | "completed" | "failed"

// ============================================================================
// HELPERS
// ============================================================================

function getTokenIcon(symbol: string): string {
  const icons: Record<string, string> = {
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
  return icons[symbol] || "🪙"
}

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)

  if (seconds < 60) return "Just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`

  return new Date(timestamp).toLocaleDateString()
}

function formatAmount(amount: string, symbol: string): string {
  const num = parseFloat(amount)
  if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M ${symbol}`
  if (num >= 1000) return `${(num / 1000).toFixed(2)}K ${symbol}`
  if (num >= 1) return `${num.toFixed(2)} ${symbol}`
  return `${num.toFixed(4)} ${symbol}`
}

// ============================================================================
// COMPONENTS
// ============================================================================

interface SwapItemProps {
  swap: SwapRecord
  onPress: () => void
}

function SwapItem({ swap, onPress }: SwapItemProps) {
  const isShielded = swap.privacyLevel === "shielded"
  const isCompliant = swap.privacyLevel === "compliant"

  const statusConfig = {
    pending: {
      bg: "bg-yellow-500/20",
      text: "text-yellow-400",
      label: "Pending",
    },
    completed: {
      bg: "bg-green-500/20",
      text: "text-green-400",
      label: "Complete",
    },
    failed: {
      bg: "bg-red-500/20",
      text: "text-red-400",
      label: "Failed",
    },
  }

  const { bg, text, label } = statusConfig[swap.status]

  return (
    <TouchableOpacity
      className="bg-dark-900 rounded-xl p-4 mb-3"
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Header Row: Token Pair + Status */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <Text className="text-xl">{getTokenIcon(swap.fromToken)}</Text>
          <Text className="text-dark-400 mx-2">→</Text>
          <Text className="text-xl">{getTokenIcon(swap.toToken)}</Text>
        </View>

        <View className="flex-row items-center gap-2">
          {/* Privacy badge */}
          {(isShielded || isCompliant) && (
            <View className="bg-brand-900/30 px-2 py-0.5 rounded">
              <Text className="text-brand-400 text-xs">
                {isShielded ? "🔒" : "📋"} {isShielded ? "Private" : "Compliant"}
              </Text>
            </View>
          )}

          {/* Preview badge */}
          {swap.isPreview && (
            <View className="bg-dark-700 px-2 py-0.5 rounded">
              <Text className="text-dark-400 text-xs">Preview</Text>
            </View>
          )}

          {/* Status badge */}
          <View className={`${bg} px-2 py-0.5 rounded`}>
            <Text className={`${text} text-xs font-medium`}>{label}</Text>
          </View>
        </View>
      </View>

      {/* Amount Row */}
      <View className="flex-row justify-between items-center mb-2">
        <View>
          <Text className="text-dark-400 text-sm">From</Text>
          <Text className="text-white font-medium">
            {formatAmount(swap.fromAmount, swap.fromToken)}
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-dark-400 text-sm">To</Text>
          <Text className="text-green-400 font-medium">
            {formatAmount(swap.toAmount, swap.toToken)}
          </Text>
        </View>
      </View>

      {/* Footer Row: Time + Error */}
      <View className="flex-row justify-between items-center">
        <Text className="text-dark-500 text-xs">
          {formatRelativeTime(swap.timestamp)}
        </Text>
        {swap.error && (
          <Text className="text-red-400 text-xs flex-1 ml-4" numberOfLines={1}>
            {swap.error}
          </Text>
        )}
        {swap.txSignature && (
          <Text className="text-dark-400 text-xs">
            Tx: {swap.txSignature.slice(0, 8)}...
          </Text>
        )}
      </View>
    </TouchableOpacity>
  )
}

interface FilterChipProps {
  label: string
  count: number
  active: boolean
  onPress: () => void
}

function FilterChip({ label, count, active, onPress }: FilterChipProps) {
  return (
    <TouchableOpacity
      className={`px-4 py-2 rounded-full mr-2 flex-row items-center ${
        active ? "bg-brand-600" : "bg-dark-800"
      }`}
      onPress={onPress}
    >
      <Text className={`font-medium ${active ? "text-white" : "text-dark-300"}`}>
        {label}
      </Text>
      <View
        className={`ml-2 px-1.5 py-0.5 rounded-full ${
          active ? "bg-brand-500" : "bg-dark-700"
        }`}
      >
        <Text
          className={`text-xs font-medium ${
            active ? "text-white" : "text-dark-400"
          }`}
        >
          {count}
        </Text>
      </View>
    </TouchableOpacity>
  )
}

// ============================================================================
// MAIN SCREEN
// ============================================================================

export default function SwapHistoryScreen() {
  const { swaps, clearHistory } = useSwapStore()
  const { addToast } = useToastStore()

  const [filter, setFilter] = useState<StatusFilter>("all")
  const [refreshing, setRefreshing] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedSwap, setSelectedSwap] = useState<SwapRecord | null>(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  // Filter counts
  const counts = useMemo(() => {
    return {
      all: swaps.length,
      pending: swaps.filter((s) => s.status === "pending").length,
      completed: swaps.filter((s) => s.status === "completed").length,
      failed: swaps.filter((s) => s.status === "failed").length,
    }
  }, [swaps])

  // Filtered swaps
  const filteredSwaps = useMemo(() => {
    if (filter === "all") return swaps
    return swaps.filter((s) => s.status === filter)
  }, [swaps, filter])

  const handleSwapPress = useCallback((swap: SwapRecord) => {
    setSelectedSwap(swap)
    setShowDetailModal(true)
  }, [])

  const handleViewExplorer = useCallback(async () => {
    if (selectedSwap?.explorerUrl) {
      try {
        await Linking.openURL(selectedSwap.explorerUrl)
      } catch {
        addToast({
          type: "error",
          title: "Cannot Open Explorer",
          message: "Unable to open the transaction link",
        })
      }
    }
  }, [selectedSwap, addToast])

  const handleClearHistory = useCallback(() => {
    clearHistory()
    setShowClearConfirm(false)
    addToast({
      type: "success",
      title: "History Cleared",
      message: "All swap history has been removed",
    })
  }, [clearHistory, addToast])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    // Simulate refresh (in real app, would re-fetch from blockchain)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setRefreshing(false)
  }, [])

  const renderItem = useCallback(
    ({ item }: { item: SwapRecord }) => (
      <SwapItem swap={item} onPress={() => handleSwapPress(item)} />
    ),
    [handleSwapPress]
  )

  const keyExtractor = useCallback((item: SwapRecord) => item.id, [])

  const ListEmptyComponent = useMemo(
    () => (
      <View className="items-center py-16">
        <Text className="text-6xl mb-4">📊</Text>
        <Text className="text-white text-xl font-semibold mb-2">
          No Swap History
        </Text>
        <Text className="text-dark-400 text-center px-8">
          {filter === "all"
            ? "Your swap transactions will appear here once you make your first swap"
            : `No ${filter} swaps found`}
        </Text>
        <TouchableOpacity
          className="mt-6 bg-brand-600 px-6 py-3 rounded-xl"
          onPress={() => router.back()}
        >
          <Text className="text-white font-medium">Make a Swap</Text>
        </TouchableOpacity>
      </View>
    ),
    [filter]
  )

  return (
    <SafeAreaView className="flex-1 bg-dark-950">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-dark-800">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-3 p-2 -ml-2"
          >
            <Text className="text-2xl">←</Text>
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">Swap History</Text>
        </View>

        {swaps.length > 0 && (
          <TouchableOpacity
            className="p-2"
            onPress={() => setShowClearConfirm(true)}
          >
            <Text className="text-red-400 text-sm">Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Chips */}
      <View className="px-4 py-3">
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[
            { key: "all" as StatusFilter, label: "All" },
            { key: "pending" as StatusFilter, label: "Pending" },
            { key: "completed" as StatusFilter, label: "Completed" },
            { key: "failed" as StatusFilter, label: "Failed" },
          ]}
          renderItem={({ item }) => (
            <FilterChip
              label={item.label}
              count={counts[item.key]}
              active={filter === item.key}
              onPress={() => setFilter(item.key)}
            />
          )}
          keyExtractor={(item) => item.key}
        />
      </View>

      {/* Swap List */}
      <FlatList
        className="flex-1 px-4"
        data={filteredSwaps}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={ListEmptyComponent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#8b5cf6"
            colors={["#8b5cf6"]}
          />
        }
      />

      {/* Swap Detail Modal */}
      <Modal
        visible={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="Swap Details"
      >
        {selectedSwap && (
          <View>
            {/* Token Pair Display */}
            <View className="items-center py-4">
              <View className="flex-row items-center">
                <View className="items-center">
                  <Text className="text-4xl">
                    {getTokenIcon(selectedSwap.fromToken)}
                  </Text>
                  <Text className="text-white font-bold text-lg mt-2">
                    {formatAmount(selectedSwap.fromAmount, selectedSwap.fromToken)}
                  </Text>
                </View>
                <Text className="text-dark-500 text-3xl mx-6">→</Text>
                <View className="items-center">
                  <Text className="text-4xl">
                    {getTokenIcon(selectedSwap.toToken)}
                  </Text>
                  <Text className="text-green-400 font-bold text-lg mt-2">
                    {formatAmount(selectedSwap.toAmount, selectedSwap.toToken)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Details */}
            <View className="bg-dark-800 rounded-xl p-4 my-4">
              <View className="flex-row justify-between mb-3">
                <Text className="text-dark-400">Status</Text>
                <View
                  className={`px-2 py-0.5 rounded ${
                    selectedSwap.status === "completed"
                      ? "bg-green-500/20"
                      : selectedSwap.status === "pending"
                        ? "bg-yellow-500/20"
                        : "bg-red-500/20"
                  }`}
                >
                  <Text
                    className={
                      selectedSwap.status === "completed"
                        ? "text-green-400"
                        : selectedSwap.status === "pending"
                          ? "text-yellow-400"
                          : "text-red-400"
                    }
                  >
                    {selectedSwap.status.charAt(0).toUpperCase() +
                      selectedSwap.status.slice(1)}
                  </Text>
                </View>
              </View>

              <View className="flex-row justify-between mb-3">
                <Text className="text-dark-400">Privacy</Text>
                <Text
                  className={
                    selectedSwap.privacyLevel === "shielded"
                      ? "text-brand-400"
                      : selectedSwap.privacyLevel === "compliant"
                        ? "text-blue-400"
                        : "text-white"
                  }
                >
                  {selectedSwap.privacyLevel === "shielded"
                    ? "🔒 Shielded"
                    : selectedSwap.privacyLevel === "compliant"
                      ? "📋 Compliant"
                      : "🔓 Public"}
                </Text>
              </View>

              <View className="flex-row justify-between mb-3">
                <Text className="text-dark-400">Time</Text>
                <Text className="text-white">
                  {new Date(selectedSwap.timestamp).toLocaleString()}
                </Text>
              </View>

              {selectedSwap.isPreview && (
                <View className="flex-row justify-between mb-3">
                  <Text className="text-dark-400">Mode</Text>
                  <Text className="text-dark-300">Preview (Not Executed)</Text>
                </View>
              )}

              {selectedSwap.txSignature && (
                <View className="mb-3">
                  <Text className="text-dark-400 mb-1">Transaction</Text>
                  <Text className="text-dark-300 text-xs font-mono">
                    {selectedSwap.txSignature}
                  </Text>
                </View>
              )}

              {selectedSwap.error && (
                <View>
                  <Text className="text-dark-400 mb-1">Error</Text>
                  <Text className="text-red-400 text-sm">
                    {selectedSwap.error}
                  </Text>
                </View>
              )}
            </View>

            {/* Actions */}
            <View className="gap-3">
              {selectedSwap.explorerUrl && (
                <TouchableOpacity
                  className="bg-dark-800 py-3 rounded-xl items-center"
                  onPress={handleViewExplorer}
                >
                  <Text className="text-brand-400 font-medium">
                    View on Explorer
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                className="bg-brand-600 py-3 rounded-xl items-center"
                onPress={() => setShowDetailModal(false)}
              >
                <Text className="text-white font-medium">Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>

      {/* Clear Confirmation Modal */}
      <Modal
        visible={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        title="Clear History"
      >
        <View className="items-center py-4">
          <Text className="text-6xl mb-4">🗑️</Text>
          <Text className="text-white text-lg font-semibold text-center mb-2">
            Clear All Swap History?
          </Text>
          <Text className="text-dark-400 text-center mb-6">
            This will remove all {swaps.length} swap records from your device.
            This action cannot be undone.
          </Text>

          <View className="w-full flex-row gap-3">
            <TouchableOpacity
              className="flex-1 bg-dark-800 py-3 rounded-xl items-center"
              onPress={() => setShowClearConfirm(false)}
            >
              <Text className="text-white font-medium">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 bg-red-600 py-3 rounded-xl items-center"
              onPress={handleClearHistory}
            >
              <Text className="text-white font-medium">Clear All</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}
