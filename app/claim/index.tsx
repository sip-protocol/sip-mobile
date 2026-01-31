/**
 * Claim Screen
 *
 * Claim unclaimed stealth payments:
 * - List of unclaimed payments
 * - Total claimable amount
 * - Claim individual or all
 * - Progress tracking
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
import { useClaim } from "@/hooks/useClaim"
import { useWalletStore } from "@/stores/wallet"
import { useToastStore } from "@/stores/toast"
import { Button } from "@/components/ui"
import type { PaymentRecord } from "@/types"
import {
  ArrowLeft,
  Coins,
  Check,
  CheckCircle,
  Warning,
  LockKey,
  Sparkle,
  MagnifyingGlass,
} from "phosphor-react-native"
import { ICON_COLORS } from "@/constants/icons"

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
  return `${diffDays}d ago`
}

// ============================================================================
// COMPONENTS
// ============================================================================

interface ClaimablePaymentRowProps {
  payment: PaymentRecord
  isSelected: boolean
  onToggle: () => void
  disabled: boolean
}

function ClaimablePaymentRow({
  payment,
  isSelected,
  onToggle,
  disabled,
}: ClaimablePaymentRowProps) {
  return (
    <TouchableOpacity
      className={`flex-row items-center py-4 border-b border-dark-800 ${
        disabled ? "opacity-50" : ""
      }`}
      onPress={onToggle}
      disabled={disabled}
    >
      {/* Selection Checkbox */}
      <View
        className={`w-6 h-6 rounded-md border-2 items-center justify-center mr-3 ${
          isSelected
            ? "bg-brand-600 border-brand-600"
            : "border-dark-600 bg-dark-800"
        }`}
      >
        {isSelected && <Check size={14} color={ICON_COLORS.white} weight="bold" />}
      </View>

      {/* Payment Icon */}
      <View className="w-10 h-10 bg-green-900/30 rounded-full items-center justify-center">
        <Coins size={20} color={ICON_COLORS.success} weight="fill" />
      </View>

      {/* Payment Info */}
      <View className="flex-1 ml-3">
        <Text className="text-white font-medium">Stealth Payment</Text>
        <Text className="text-dark-500 text-sm">
          {formatTimeAgo(payment.timestamp)}
        </Text>
      </View>

      {/* Amount */}
      <View className="items-end">
        <Text className="text-green-400 font-semibold">
          +{parseFloat(payment.amount).toFixed(4)} {payment.token}
        </Text>
      </View>
    </TouchableOpacity>
  )
}

interface ClaimProgressDisplayProps {
  status: string
  message: string
  step: number
  totalSteps: number
}

function ClaimProgressDisplay({
  status,
  message,
  step,
  totalSteps,
}: ClaimProgressDisplayProps) {
  const progressPercent = totalSteps > 0 ? (step / totalSteps) * 100 : 0

  return (
    <View className="bg-dark-900 rounded-2xl border border-dark-800 p-6">
      <View className="items-center">
        <View className="w-16 h-16 bg-brand-600/20 rounded-full items-center justify-center mb-4">
          <ActivityIndicator size="large" color="#8b5cf6" />
        </View>
        <Text className="text-white font-semibold text-lg">Claiming...</Text>
        <Text className="text-dark-400 text-sm mt-1">{message}</Text>
      </View>

      {/* Progress Bar */}
      <View className="mt-4">
        <View className="h-2 bg-dark-800 rounded-full overflow-hidden">
          <View
            className="h-full bg-brand-600 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </View>
        <Text className="text-dark-500 text-xs text-center mt-2">
          Step {step} of {totalSteps}
        </Text>
      </View>

      {/* Step Indicators */}
      <View className="flex-row justify-between mt-4 px-2">
        <StepIndicator
          label="Load"
          completed={step >= 1}
          active={status === "deriving" && step === 1}
        />
        <StepIndicator
          label="Derive"
          completed={step >= 2}
          active={status === "deriving" && step === 2}
        />
        <StepIndicator
          label="Sign"
          completed={step >= 3}
          active={status === "signing"}
        />
        <StepIndicator
          label="Submit"
          completed={step >= 4}
          active={status === "submitting"}
        />
      </View>
    </View>
  )
}

interface StepIndicatorProps {
  label: string
  completed: boolean
  active: boolean
}

function StepIndicator({ label, completed, active }: StepIndicatorProps) {
  return (
    <View className="items-center">
      <View
        className={`w-8 h-8 rounded-full items-center justify-center ${
          completed
            ? "bg-green-600"
            : active
              ? "bg-brand-600"
              : "bg-dark-700"
        }`}
      >
        {completed ? (
          <Check size={14} color={ICON_COLORS.white} weight="bold" />
        ) : (
          <View
            className={`w-2 h-2 rounded-full ${
              active ? "bg-white" : "bg-dark-500"
            }`}
          />
        )}
      </View>
      <Text
        className={`text-xs mt-1 ${
          completed || active ? "text-white" : "text-dark-500"
        }`}
      >
        {label}
      </Text>
    </View>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ClaimScreen() {
  const {
    progress,
    error,
    claim,
    claimMultiple,
    reset,
    getUnclaimedPayments,
    getClaimableAmount,
  } = useClaim()
  const { isConnected } = useWalletStore()
  const { addToast } = useToastStore()

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set())

  const unclaimedPayments = getUnclaimedPayments()
  const { amount: claimableAmount, count: claimableCount } = getClaimableAmount()

  const selectedPayments = unclaimedPayments.filter((p) =>
    selectedIds.has(p.id)
  )
  const selectedAmount = selectedPayments.reduce(
    (sum, p) => sum + parseFloat(p.amount),
    0
  )

  const isClaiming =
    progress.status === "deriving" ||
    progress.status === "signing" ||
    progress.status === "submitting"

  const togglePayment = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const selectAll = () => {
    setSelectedIds(new Set(unclaimedPayments.map((p) => p.id)))
  }

  const deselectAll = () => {
    setSelectedIds(new Set())
  }

  const handleClaimSelected = async () => {
    if (selectedPayments.length === 0) return

    reset()

    if (selectedPayments.length === 1) {
      const result = await claim(selectedPayments[0])
      if (result.success) {
        setClaimedIds((prev) => new Set([...prev, selectedPayments[0].id]))
        setSelectedIds(new Set())
        addToast({
          type: "success",
          title: "Claimed!",
          message: `Successfully claimed ${parseFloat(selectedPayments[0].amount).toFixed(4)} ${selectedPayments[0].token}`,
        })
      } else {
        addToast({
          type: "error",
          title: "Claim failed",
          message: result.error || "Unknown error",
        })
      }
    } else {
      const results = await claimMultiple(selectedPayments)
      const successful = results.filter((r) => r.success)
      const failed = results.filter((r) => !r.success)

      if (successful.length > 0) {
        const claimedPaymentIds = selectedPayments
          .filter((_, i) => results[i].success)
          .map((p) => p.id)
        setClaimedIds((prev) => new Set([...prev, ...claimedPaymentIds]))
        setSelectedIds(new Set())

        addToast({
          type: "success",
          title: `Claimed ${successful.length} payment${successful.length !== 1 ? "s" : ""}`,
          message:
            failed.length > 0
              ? `${failed.length} failed`
              : "All payments claimed successfully",
        })
      } else {
        addToast({
          type: "error",
          title: "Claim failed",
          message: "All claims failed",
        })
      }
    }
  }

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
          <View className="w-20 h-20 rounded-full bg-green-900/30 items-center justify-center mb-4">
            <Coins size={40} color={ICON_COLORS.success} weight="fill" />
          </View>
          <Text className="text-white font-semibold text-lg">Connect Wallet</Text>
          <Text className="text-dark-500 text-center mt-2">
            Connect your wallet to claim payments
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
        <Text className="text-xl font-bold text-white">Claim Payments</Text>
        <View className="w-16" />
      </View>

      <ScrollView className="flex-1">
        <View className="px-6 pt-6">
          {/* Summary Card */}
          <View className="bg-dark-900 rounded-2xl border border-dark-800 p-6">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-dark-400 text-sm">Total Claimable</Text>
                <Text className="text-3xl font-bold text-white mt-1">
                  {claimableAmount.toFixed(4)} SOL
                </Text>
                <Text className="text-dark-500 text-sm mt-1">
                  {claimableCount} payment{claimableCount !== 1 ? "s" : ""}{" "}
                  available
                </Text>
              </View>
              <View className="w-16 h-16 bg-green-900/30 rounded-full items-center justify-center">
                <Coins size={32} color={ICON_COLORS.success} weight="fill" />
              </View>
            </View>
          </View>

          {/* Claiming Progress */}
          {isClaiming && (
            <View className="mt-6">
              <ClaimProgressDisplay
                status={progress.status}
                message={progress.message}
                step={progress.step}
                totalSteps={progress.totalSteps}
              />
            </View>
          )}

          {/* Success State */}
          {progress.status === "confirmed" && (
            <View className="mt-6 bg-green-900/20 border border-green-700 rounded-xl p-4">
              <View className="flex-row items-center gap-3">
                <CheckCircle size={24} color={ICON_COLORS.success} weight="fill" />
                <View className="flex-1">
                  <Text className="text-green-400 font-medium">
                    Claim Successful!
                  </Text>
                  <Text className="text-dark-400 text-sm mt-1">
                    Funds have been transferred to your wallet
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Error State */}
          {error && (
            <View className="mt-6 bg-red-900/20 border border-red-700 rounded-xl p-4">
              <View className="flex-row items-center gap-3">
                <Warning size={24} color={ICON_COLORS.error} weight="fill" />
                <View className="flex-1">
                  <Text className="text-red-400 font-medium">Claim Failed</Text>
                  <Text className="text-dark-400 text-sm mt-1">{error}</Text>
                </View>
              </View>
              <TouchableOpacity
                className="mt-3 bg-red-800 rounded-lg py-2 items-center"
                onPress={reset}
              >
                <Text className="text-white font-medium">Try Again</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Payment List */}
          {unclaimedPayments.length > 0 ? (
            <View className="mt-6">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-white font-semibold text-lg">
                  Unclaimed Payments
                </Text>
                <TouchableOpacity
                  onPress={
                    selectedIds.size === unclaimedPayments.length
                      ? deselectAll
                      : selectAll
                  }
                  disabled={isClaiming}
                >
                  <Text className="text-brand-400">
                    {selectedIds.size === unclaimedPayments.length
                      ? "Deselect All"
                      : "Select All"}
                  </Text>
                </TouchableOpacity>
              </View>

              <View className="bg-dark-900 rounded-xl border border-dark-800 px-4">
                {unclaimedPayments.map((payment) => (
                  <ClaimablePaymentRow
                    key={payment.id}
                    payment={payment}
                    isSelected={selectedIds.has(payment.id)}
                    onToggle={() => togglePayment(payment.id)}
                    disabled={isClaiming || claimedIds.has(payment.id)}
                  />
                ))}
              </View>
            </View>
          ) : (
            <View className="mt-6 items-center py-12">
              <View className="w-20 h-20 rounded-full bg-brand-900/30 items-center justify-center mb-4">
                <Sparkle size={40} color={ICON_COLORS.brand} weight="fill" />
              </View>
              <Text className="text-white font-semibold text-lg">
                All Caught Up!
              </Text>
              <Text className="text-dark-500 text-center mt-2">
                No unclaimed payments. Scan for new payments to find incoming
                funds.
              </Text>
              <Button
                onPress={() => router.push("/scan")}
                style={{ marginTop: 24 }}
              >
                Scan for Payments
              </Button>
            </View>
          )}

          {/* Claim Button */}
          {unclaimedPayments.length > 0 && (
            <View className="mt-6">
              <Button
                fullWidth
                size="lg"
                onPress={handleClaimSelected}
                disabled={selectedIds.size === 0 || isClaiming}
              >
                {isClaiming
                  ? "Claiming..."
                  : selectedIds.size === 0
                    ? "Select Payments to Claim"
                    : `Claim ${selectedIds.size} Payment${selectedIds.size !== 1 ? "s" : ""} (${selectedAmount.toFixed(4)} SOL)`}
              </Button>
            </View>
          )}

          {/* Info Card */}
          <View className="mt-6 mb-8 bg-brand-900/10 border border-brand-800/30 rounded-xl p-4">
            <View className="flex-row items-start gap-3">
              <LockKey size={24} color={ICON_COLORS.brand} weight="fill" />
              <View className="flex-1">
                <Text className="text-brand-400 font-medium">
                  Secure Claiming
                </Text>
                <Text className="text-dark-400 text-sm mt-1">
                  Claims are processed using your spending key derived from the
                  stealth address. Only you can access these funds.
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
