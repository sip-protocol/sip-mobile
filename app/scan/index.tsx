/**
 * Scan Payments Screen
 *
 * Scans the blockchain for incoming stealth payments:
 * - Progress indicator during scan
 * - Results summary
 * - Found payments list
 * - Last scan time display
 */

import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { useState } from "react"
import { useScanPayments } from "@/hooks/useScanPayments"
import { useClaim } from "@/hooks/useClaim"
import { useWalletStore } from "@/stores/wallet"
import { useToastStore } from "@/stores/toast"
import { Button } from "@/components/ui"
import type { PaymentRecord } from "@/types"
import {
  ArrowLeft,
  MagnifyingGlass,
  Coins,
  Confetti,
  CheckCircle,
  ArrowRight,
  Lock,
} from "phosphor-react-native"
import { ICON_COLORS } from "@/constants/icons"

// ============================================================================
// HELPERS
// ============================================================================

function formatLastScan(timestamp: number | null): string {
  if (!timestamp) return "Never"

  const now = Date.now()
  const diffMs = now - timestamp
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`

  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatTimeAgo(timestamp: number): string {
  const now = Date.now()
  const diffMs = now - timestamp
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

// ============================================================================
// COMPONENTS
// ============================================================================

interface FoundPaymentRowProps {
  payment: PaymentRecord
  onPress: () => void
}

function FoundPaymentRow({ payment, onPress }: FoundPaymentRowProps) {
  return (
    <TouchableOpacity
      className="flex-row items-center py-3 border-b border-dark-800"
      onPress={onPress}
    >
      <View className="w-10 h-10 bg-green-900/30 rounded-full items-center justify-center">
        <Coins size={20} color={ICON_COLORS.success} weight="fill" />
      </View>
      <View className="flex-1 ml-3">
        <Text className="text-white font-medium">New Payment Found</Text>
        <Text className="text-dark-500 text-sm">
          {formatTimeAgo(payment.timestamp)}
        </Text>
      </View>
      <View className="items-end">
        <Text className="text-green-400 font-semibold">
          +{parseFloat(payment.amount).toFixed(4)} {payment.token}
        </Text>
        <Text className="text-dark-600 text-xs">Tap to claim</Text>
      </View>
    </TouchableOpacity>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ScanScreen() {
  const {
    isScanning,
    progress,
    lastScanResult,
    error,
    scan,
    cancelScan,
    getLastScanTime,
  } = useScanPayments()
  const { getClaimableAmount } = useClaim()
  const { isConnected } = useWalletStore()
  const { addToast } = useToastStore()

  // Get unclaimed payments count
  const { amount: unclaimedAmount, count: unclaimedCount } = getClaimableAmount()

  const [hasScannedOnce, setHasScannedOnce] = useState(false)

  const lastScanTime = getLastScanTime()

  const handleScan = async () => {
    const result = await scan()
    setHasScannedOnce(true)

    if (result.found > 0) {
      addToast({
        type: "success",
        title: `Found ${result.found} payment${result.found !== 1 ? "s" : ""}!`,
        message: "Tap to view and claim your funds",
      })
    } else if (result.errors.length === 0) {
      addToast({
        type: "info",
        title: "Scan complete",
        message: "No new payments found",
      })
    }
  }

  const handlePaymentPress = (payment: PaymentRecord) => {
    router.push(`/history/${payment.id}`)
  }

  // Calculate progress percentage
  const progressPercent =
    progress.total > 0 ? (progress.current / progress.total) * 100 : 0

  if (!isConnected) {
    return (
      <SafeAreaView className="flex-1 bg-dark-950">
        <View className="flex-row items-center px-6 py-4 border-b border-dark-900">
          <TouchableOpacity
            className="flex-row items-center"
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color={ICON_COLORS.white} weight="bold" />
            <Text className="text-white ml-4 text-lg">Back</Text>
          </TouchableOpacity>
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-20 h-20 rounded-full bg-dark-800 items-center justify-center mb-4">
            <MagnifyingGlass size={40} color={ICON_COLORS.inactive} weight="bold" />
          </View>
          <Text className="text-white font-semibold text-lg">Connect Wallet</Text>
          <Text className="text-dark-500 text-center mt-2">
            Connect your wallet to scan for incoming payments
          </Text>
          <Button
            onPress={() => router.push("/(auth)/wallet-setup")}
            style={{ marginTop: 24 }}
          >
            Connect Wallet
          </Button>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-dark-950">
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-dark-900">
        <TouchableOpacity
          className="flex-row items-center"
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={ICON_COLORS.white} weight="bold" />
          <Text className="text-white ml-4 text-lg">Back</Text>
        </TouchableOpacity>
        <Text className="text-xl font-bold text-white">Scan Payments</Text>
        <View className="w-16" />
      </View>

      <ScrollView className="flex-1">
        <View className="px-6 pt-6">
          {/* Scan Status Card */}
          <View className="bg-dark-900 rounded-2xl border border-dark-800 overflow-hidden">
            {/* Animated Header */}
            <View
              className={`p-6 items-center ${
                isScanning ? "bg-brand-900/20" : "bg-dark-900"
              }`}
            >
              {isScanning ? (
                <>
                  <View className="w-20 h-20 bg-brand-600/20 rounded-full items-center justify-center mb-4">
                    <ActivityIndicator size="large" color="#8b5cf6" />
                  </View>
                  <Text className="text-white font-semibold text-lg">
                    Scanning...
                  </Text>
                  <Text className="text-dark-400 text-sm mt-1">
                    {progress.message}
                  </Text>
                </>
              ) : lastScanResult && hasScannedOnce ? (
                <>
                  <View
                    className={`w-20 h-20 rounded-full items-center justify-center mb-4 ${
                      lastScanResult.found > 0
                        ? "bg-green-600/20"
                        : "bg-dark-800"
                    }`}
                  >
                    {lastScanResult.found > 0 ? (
                      <Confetti size={40} color={ICON_COLORS.success} weight="fill" />
                    ) : (
                      <CheckCircle size={40} color={ICON_COLORS.success} weight="fill" />
                    )}
                  </View>
                  <Text className="text-white font-semibold text-lg">
                    {lastScanResult.found > 0
                      ? `Found ${lastScanResult.found} Payment${lastScanResult.found !== 1 ? "s" : ""}!`
                      : "No New Payments"}
                  </Text>
                  <Text className="text-dark-400 text-sm mt-1">
                    Scanned {lastScanResult.scanned} announcements
                  </Text>
                </>
              ) : (
                <>
                  <View className="w-20 h-20 bg-dark-800 rounded-full items-center justify-center mb-4">
                    <MagnifyingGlass size={40} color={ICON_COLORS.muted} weight="bold" />
                  </View>
                  <Text className="text-white font-semibold text-lg">
                    Ready to Scan
                  </Text>
                  <Text className="text-dark-400 text-sm mt-1">
                    Find incoming stealth payments
                  </Text>
                </>
              )}
            </View>

            {/* Progress Bar */}
            {isScanning && progress.total > 0 && (
              <View className="px-6 pb-4">
                <View className="h-2 bg-dark-800 rounded-full overflow-hidden">
                  <View
                    className="h-full bg-brand-600 rounded-full"
                    style={{ width: `${progressPercent}%` }}
                  />
                </View>
                <Text className="text-dark-500 text-xs text-center mt-2">
                  {progress.current} / {progress.total}
                </Text>
              </View>
            )}

            {/* Stats */}
            <View className="flex-row border-t border-dark-800">
              <View className="flex-1 p-4 items-center border-r border-dark-800">
                <Text className="text-dark-500 text-sm">Last Scan</Text>
                <Text className="text-white font-medium mt-1">
                  {formatLastScan(lastScanTime)}
                </Text>
              </View>
              <View className="flex-1 p-4 items-center">
                <Text className="text-dark-500 text-sm">Found Today</Text>
                <Text className="text-green-400 font-medium mt-1">
                  {lastScanResult?.found || 0}
                </Text>
              </View>
            </View>
          </View>

          {/* Error Display */}
          {error && (
            <View className="mt-4 bg-red-900/20 border border-red-700 rounded-xl p-4">
              <Text className="text-red-400">{error}</Text>
            </View>
          )}

          {/* Unclaimed Payments Banner - shows when no new payments but unclaimed exist */}
          {hasScannedOnce &&
            lastScanResult?.found === 0 &&
            unclaimedCount > 0 &&
            !isScanning && (
              <TouchableOpacity
                className="mt-4 bg-green-900/20 border border-green-700 rounded-xl p-4"
                onPress={() => router.push("/claim")}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3">
                    <Coins size={24} color={ICON_COLORS.success} weight="fill" />
                    <View>
                      <Text className="text-green-400 font-medium">
                        {unclaimedCount} Unclaimed Payment{unclaimedCount !== 1 ? "s" : ""}
                      </Text>
                      <Text className="text-dark-400 text-sm">
                        {unclaimedAmount.toFixed(4)} SOL ready to claim
                      </Text>
                    </View>
                  </View>
                  <ArrowRight size={20} color={ICON_COLORS.success} weight="bold" />
                </View>
              </TouchableOpacity>
            )}

          {/* Scan Button */}
          <View className="mt-6">
            {isScanning ? (
              <Button
                fullWidth
                variant="secondary"
                onPress={cancelScan}
              >
                Cancel Scan
              </Button>
            ) : (
              <Button fullWidth size="lg" onPress={handleScan}>
                Scan for Payments
              </Button>
            )}
          </View>

          {/* Found Payments */}
          {lastScanResult &&
            lastScanResult.newPayments.length > 0 &&
            !isScanning && (
              <View className="mt-8">
                <View className="flex-row items-center justify-between mb-4">
                  <Text className="text-white font-semibold text-lg">
                    Newly Found Payments
                  </Text>
                  <TouchableOpacity onPress={() => router.push("/claim")}>
                    <Text className="text-green-400 font-medium">
                      Claim All →
                    </Text>
                  </TouchableOpacity>
                </View>
                <View className="bg-dark-900 rounded-xl border border-dark-800 px-4">
                  {lastScanResult.newPayments.map((payment) => (
                    <FoundPaymentRow
                      key={payment.id}
                      payment={payment}
                      onPress={() => handlePaymentPress(payment)}
                    />
                  ))}
                </View>
                <TouchableOpacity
                  className="mt-4 items-center"
                  onPress={() => router.push("/history")}
                >
                  <Text className="text-brand-400">View All in History →</Text>
                </TouchableOpacity>
              </View>
            )}

          {/* How It Works */}
          <View className="mt-8 mb-8">
            <Text className="text-white font-semibold mb-4">How it works</Text>

            <View className="bg-dark-900 rounded-xl border border-dark-800 p-4 gap-4">
              <View className="flex-row items-start gap-3">
                <View className="w-8 h-8 bg-brand-900/30 rounded-full items-center justify-center">
                  <Text className="text-brand-400 font-bold">1</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-white font-medium">
                    Fetch Announcements
                  </Text>
                  <Text className="text-dark-500 text-sm mt-0.5">
                    Get payment announcements from the blockchain
                  </Text>
                </View>
              </View>

              <View className="flex-row items-start gap-3">
                <View className="w-8 h-8 bg-brand-900/30 rounded-full items-center justify-center">
                  <Text className="text-brand-400 font-bold">2</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-white font-medium">
                    Check Ownership
                  </Text>
                  <Text className="text-dark-500 text-sm mt-0.5">
                    Use your viewing key to check if payments are yours
                  </Text>
                </View>
              </View>

              <View className="flex-row items-start gap-3">
                <View className="w-8 h-8 bg-brand-900/30 rounded-full items-center justify-center">
                  <Text className="text-brand-400 font-bold">3</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-white font-medium">Claim Funds</Text>
                  <Text className="text-dark-500 text-sm mt-0.5">
                    Found payments can be claimed to your wallet
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Privacy Note */}
          <View className="mb-8 bg-brand-900/10 border border-brand-800/30 rounded-xl p-4">
            <View className="flex-row items-start gap-3">
              <Lock size={24} color={ICON_COLORS.brand} weight="fill" />
              <View className="flex-1">
                <Text className="text-brand-400 font-medium">
                  Privacy Preserved
                </Text>
                <Text className="text-dark-400 text-sm mt-1">
                  Scanning happens locally on your device. Your viewing key
                  never leaves your phone.
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
