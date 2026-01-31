/**
 * Transaction Detail Screen
 *
 * Shows full details of a transaction:
 * - Amount and status
 * - Privacy level
 * - Addresses (stealth/regular)
 * - Transaction hash with explorer link
 * - Timestamps
 * - Actions (claim, view on explorer)
 */

import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Linking,
  Share,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router, useLocalSearchParams } from "expo-router"
import * as Clipboard from "expo-clipboard"
import { usePrivacyStore } from "@/stores/privacy"
import { useToastStore } from "@/stores/toast"
import { useSettingsStore } from "@/stores/settings"
import { getExplorerTxUrl } from "@/utils/explorer"
import { Button } from "@/components/ui"
import type { PaymentRecord, PrivacyLevel } from "@/types"
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  ShieldCheck,
  Lock,
  Eye,
  MagnifyingGlass,
  ShareNetwork,
  Check,
  Clock,
  X,
  Question,
} from "phosphor-react-native"
import { ICON_COLORS } from "@/constants/icons"

// ============================================================================
// HELPERS
// ============================================================================

function formatFullDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

function formatAddress(address: string): string {
  if (address.length <= 20) return address
  return `${address.slice(0, 12)}...${address.slice(-8)}`
}

function getStatusInfo(status: PaymentRecord["status"]) {
  switch (status) {
    case "completed":
      return { color: "bg-green-600", textColor: "text-green-400", label: "Completed", icon: Check }
    case "claimed":
      return { color: "bg-green-600", textColor: "text-green-400", label: "Claimed", icon: Check }
    case "pending":
      return { color: "bg-yellow-600", textColor: "text-yellow-400", label: "Pending", icon: Clock }
    case "failed":
      return { color: "bg-red-600", textColor: "text-red-400", label: "Failed", icon: X }
    default:
      return { color: "bg-dark-600", textColor: "text-dark-400", label: status, icon: Question }
  }
}

function getPrivacyInfo(level: PrivacyLevel) {
  switch (level) {
    case "shielded":
      return { icon: ShieldCheck, label: "Private", description: "Amount and recipient hidden" }
    case "compliant":
      return { icon: Lock, label: "Compliant", description: "Private with viewing key" }
    case "transparent":
      return { icon: Eye, label: "Public", description: "Fully visible on-chain" }
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { getPayment, updatePayment } = usePrivacyStore()
  const { addToast } = useToastStore()
  const { network, defaultExplorer } = useSettingsStore()

  const payment = id ? getPayment(id) : undefined

  if (!payment) {
    return (
      <SafeAreaView className="flex-1 bg-dark-950">
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-20 h-20 rounded-full bg-dark-800 items-center justify-center mb-4">
            <MagnifyingGlass size={40} color={ICON_COLORS.inactive} weight="bold" />
          </View>
          <Text className="text-white font-semibold text-lg">
            Transaction Not Found
          </Text>
          <Text className="text-dark-500 text-center mt-2">
            This transaction may have been removed or doesn't exist
          </Text>
          <Button onPress={() => router.back()} style={{ marginTop: 24 }}>
            Go Back
          </Button>
        </View>
      </SafeAreaView>
    )
  }

  const isReceive = payment.type === "receive"
  const statusInfo = getStatusInfo(payment.status)
  const privacyInfo = getPrivacyInfo(payment.privacyLevel)

  const handleCopyTxHash = async () => {
    if (payment.txHash) {
      await Clipboard.setStringAsync(payment.txHash)
      addToast({
        type: "success",
        title: "Copied!",
        message: "Transaction hash copied to clipboard",
      })
    }
  }

  const handleCopyAddress = async (address: string) => {
    await Clipboard.setStringAsync(address)
    addToast({
      type: "success",
      title: "Copied!",
      message: "Address copied to clipboard",
    })
  }

  const handleViewOnExplorer = () => {
    if (payment.txHash) {
      const explorerUrl = getExplorerTxUrl(payment.txHash, network, defaultExplorer)
      Linking.openURL(explorerUrl)
    }
  }

  const handleShare = async () => {
    const message = [
      `SIP ${isReceive ? "Received" : "Sent"} ${payment.amount} ${payment.token}`,
      `Status: ${statusInfo.label}`,
      `Privacy: ${privacyInfo.label}`,
      payment.txHash ? `TX: ${payment.txHash}` : null,
    ]
      .filter(Boolean)
      .join("\n")

    try {
      await Share.share({ message, title: "Transaction Details" })
    } catch {
      addToast({
        type: "error",
        title: "Share failed",
        message: "Unable to share transaction details",
      })
    }
  }

  const handleClaim = async () => {
    // Simulate claiming
    addToast({
      type: "info",
      title: "Claiming...",
      message: "Processing your claim request",
    })

    await new Promise((resolve) => setTimeout(resolve, 2000))

    updatePayment(payment.id, {
      status: "claimed",
      claimed: true,
      claimedAt: Date.now(),
    })

    addToast({
      type: "success",
      title: "Claimed!",
      message: "Funds have been added to your wallet",
    })
  }

  return (
    <SafeAreaView className="flex-1 bg-dark-950">
      {/* Header */}
      <View className="flex-row items-center px-6 py-4 border-b border-dark-900">
        <TouchableOpacity
          className="flex-row items-center"
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={ICON_COLORS.white} weight="bold" />
          <Text className="text-white ml-4 text-lg">Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-6">
        {/* Amount & Status Header */}
        <View className="items-center py-8">
          <View
            className={`w-16 h-16 rounded-full items-center justify-center mb-4 ${
              isReceive ? "bg-green-900/30" : "bg-brand-900/30"
            }`}
          >
            {isReceive ? (
              <ArrowDown size={32} color={ICON_COLORS.success} weight="bold" />
            ) : (
              <ArrowUp size={32} color={ICON_COLORS.brand} weight="bold" />
            )}
          </View>

          <Text
            className={`text-4xl font-bold ${
              isReceive ? "text-green-400" : "text-white"
            }`}
          >
            {isReceive ? "+" : "-"}
            {payment.amount} {payment.token}
          </Text>

          <View className="flex-row items-center mt-3">
            <View className={`w-2 h-2 rounded-full ${statusInfo.color} mr-2`} />
            <Text className={statusInfo.textColor}>{statusInfo.label}</Text>
          </View>
        </View>

        {/* Details Card */}
        <View className="bg-dark-900 rounded-xl border border-dark-800 overflow-hidden">
          {/* Type */}
          <View className="flex-row justify-between p-4 border-b border-dark-800">
            <Text className="text-dark-500">Type</Text>
            <Text className="text-white font-medium">
              {isReceive ? "Receive" : "Send"}
            </Text>
          </View>

          {/* Privacy Level */}
          <View className="flex-row justify-between items-center p-4 border-b border-dark-800">
            <Text className="text-dark-500">Privacy Level</Text>
            <View className="flex-row items-center">
              <privacyInfo.icon size={18} color={ICON_COLORS.brand} weight="fill" />
              <Text className="text-white font-medium ml-2">{privacyInfo.label}</Text>
            </View>
          </View>

          {/* Token */}
          <View className="flex-row justify-between p-4 border-b border-dark-800">
            <Text className="text-dark-500">Token</Text>
            <Text className="text-white font-medium">{payment.token}</Text>
          </View>

          {/* Timestamp */}
          <View className="flex-row justify-between p-4 border-b border-dark-800">
            <Text className="text-dark-500">Date</Text>
            <Text className="text-white">{formatFullDate(payment.timestamp)}</Text>
          </View>

          {/* Claimed At (if applicable) */}
          {payment.claimedAt && (
            <View className="flex-row justify-between p-4 border-b border-dark-800">
              <Text className="text-dark-500">Claimed At</Text>
              <Text className="text-white">{formatFullDate(payment.claimedAt)}</Text>
            </View>
          )}

          {/* Stealth Address */}
          {payment.stealthAddress && (
            <TouchableOpacity
              className="p-4 border-b border-dark-800"
              onPress={() => handleCopyAddress(payment.stealthAddress!)}
            >
              <View className="flex-row justify-between items-center">
                <Text className="text-dark-500">Stealth Address</Text>
                <Text className="text-brand-400 text-xs">Tap to copy</Text>
              </View>
              <Text className="text-white font-mono text-sm mt-2">
                {formatAddress(payment.stealthAddress)}
              </Text>
            </TouchableOpacity>
          )}

          {/* Transaction Hash */}
          {payment.txHash && (
            <TouchableOpacity
              className="p-4"
              onPress={handleCopyTxHash}
            >
              <View className="flex-row justify-between items-center">
                <Text className="text-dark-500">Transaction Hash</Text>
                <Text className="text-brand-400 text-xs">Tap to copy</Text>
              </View>
              <Text
                className="text-white font-mono text-sm mt-2"
                numberOfLines={2}
              >
                {payment.txHash}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Privacy Info */}
        <View className="mt-6 bg-brand-900/10 border border-brand-800/30 rounded-xl p-4">
          <View className="flex-row items-start gap-3">
            <privacyInfo.icon size={24} color={ICON_COLORS.brand} weight="fill" />
            <View className="flex-1">
              <Text className="text-brand-400 font-medium">
                {privacyInfo.label} Transaction
              </Text>
              <Text className="text-dark-400 text-sm mt-1">
                {privacyInfo.description}
              </Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View className="mt-6 mb-8 gap-3">
          {/* Claim Button (for unclaimed received payments) */}
          {isReceive && payment.status === "completed" && !payment.claimed && (
            <Button fullWidth size="lg" onPress={handleClaim}>
              Claim to Wallet
            </Button>
          )}

          {/* View on Explorer */}
          {payment.txHash && (
            <Button
              fullWidth
              variant="secondary"
              onPress={handleViewOnExplorer}
            >
              View on Explorer
            </Button>
          )}

          {/* Share */}
          <TouchableOpacity
            className="flex-row items-center justify-center py-3"
            onPress={handleShare}
          >
            <ShareNetwork size={18} color={ICON_COLORS.inactive} weight="fill" />
            <Text className="text-dark-400 ml-2">Share Details</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
