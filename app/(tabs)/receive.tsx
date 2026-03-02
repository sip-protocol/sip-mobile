/**
 * Receive Screen
 *
 * Privacy-focused receive flow:
 * - Generate stealth addresses
 * - Display QR code for scanning
 * - Copy/share stealth address
 * - Optional amount request
 */

import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Share,
  TextInput,
  ActivityIndicator,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import * as Clipboard from "expo-clipboard"
import { useState, useCallback } from "react"
import QRCode from "react-native-qrcode-svg"
import {
  ArrowsClockwise,
  Check,
  ClipboardText,
  Export,
  LockKey,
  MagnifyingGlass,
  ArrowRight,
} from "phosphor-react-native"
import { ICON_COLORS } from "@/constants/icons"
import { useStealth } from "@/hooks/useStealth"
import { useWalletStore } from "@/stores/wallet"
import { usePrivacyStore } from "@/stores/privacy"
import { useToastStore } from "@/stores/toast"
import { Button, ConfirmModal, LoadingState, ErrorState, EmptyState } from "@/components/ui"

type Tab = "address" | "amount"

export default function ReceiveScreen() {
  const {
    stealthAddress,
    isGenerating,
    isLoading,
    error,
    regenerateAddress,
    formatForDisplay,
  } = useStealth()
  const { isConnected } = useWalletStore()
  const { getUnclaimedPaymentsCount } = usePrivacyStore()
  const { addToast } = useToastStore()

  const [activeTab, setActiveTab] = useState<Tab>("address")
  const [requestAmount, setRequestAmount] = useState("")
  const [copied, setCopied] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  // Generate payment request URI with optional amount
  const getPaymentUri = useCallback((): string => {
    if (!stealthAddress) return ""

    if (requestAmount && parseFloat(requestAmount) > 0) {
      return `${stealthAddress.full}?amount=${requestAmount}`
    }
    return stealthAddress.full
  }, [stealthAddress, requestAmount])

  const handleCopy = async () => {
    if (!stealthAddress) return

    const uri = getPaymentUri()
    await Clipboard.setStringAsync(uri)
    setCopied(true)
    addToast({
      type: "success",
      title: "Copied!",
      message: "Stealth address copied to clipboard",
    })

    setTimeout(() => setCopied(false), 2000)
  }

  const handleShare = async () => {
    if (!stealthAddress) return

    const uri = getPaymentUri()
    const message = requestAmount
      ? `Send me ${requestAmount} SOL privately:\n${uri}`
      : `Send me SOL privately:\n${uri}`

    try {
      await Share.share({
        message,
        title: "SIP Privacy Address",
      })
    } catch {
      addToast({
        type: "error",
        title: "Share failed",
        message: "Unable to open share dialog",
      })
    }
  }

  /**
   * Handle regenerate button press
   *
   * Blocks if there are unclaimed payments to prevent fund loss (#72).
   * Shows confirmation modal before proceeding.
   */
  const handleRegeneratePress = () => {
    const unclaimedCount = getUnclaimedPaymentsCount()

    if (unclaimedCount > 0) {
      addToast({
        type: "error",
        title: "Cannot regenerate",
        message: `Claim ${unclaimedCount} pending payment${unclaimedCount > 1 ? "s" : ""} first`,
        duration: 4000,
      })
      return
    }

    setShowConfirmModal(true)
  }

  /**
   * Execute regeneration after user confirmation
   */
  const handleRegenerate = async () => {
    const newAddress = await regenerateAddress()
    if (newAddress) {
      addToast({
        type: "success",
        title: "New address generated",
        message: "Your stealth address has been refreshed",
      })
    }
  }

  if (!isConnected) {
    return (
      <SafeAreaView className="flex-1 bg-dark-950">
        <EmptyState
          title="Connect Wallet"
          message="Connect your wallet to generate a stealth address"
          iconName="wallet"
          iconColor="brand"
          actionLabel="Set Up Wallet"
          onAction={() => router.push("/(auth)/wallet-setup")}
          className="flex-1"
        />
      </SafeAreaView>
    )
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-dark-950">
        <LoadingState message="Loading stealth address..." />
      </SafeAreaView>
    )
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-dark-950">
        <ErrorState
          title="Failed to Load"
          message={error}
          onRetry={handleRegenerate}
          className="flex-1"
        />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView testID="receive-screen" className="flex-1 bg-dark-950">
      <ScrollView testID="receive-scroll-view" className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-6 pt-6">
          {/* Header */}
          <Text className="text-3xl font-bold text-white">Receive</Text>
          <Text className="text-dark-400 mt-1">
            Receive SOL or tokens privately
          </Text>

          {/* Tab Switcher */}
          <View className="flex-row mt-6 bg-dark-900 rounded-xl p-1">
            <TouchableOpacity
              className={`flex-1 py-2 rounded-lg ${
                activeTab === "address" ? "bg-brand-600" : ""
              }`}
              onPress={() => setActiveTab("address")}
              accessibilityRole="tab"
              accessibilityLabel="Address"
              accessibilityState={{ selected: activeTab === "address" }}
            >
              <Text
                className={`text-center font-medium ${
                  activeTab === "address" ? "text-white" : "text-dark-400"
                }`}
              >
                Address
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`flex-1 py-2 rounded-lg ${
                activeTab === "amount" ? "bg-brand-600" : ""
              }`}
              onPress={() => setActiveTab("amount")}
              accessibilityRole="tab"
              accessibilityLabel="Request Amount"
              accessibilityState={{ selected: activeTab === "amount" }}
            >
              <Text
                className={`text-center font-medium ${
                  activeTab === "amount" ? "text-white" : "text-dark-400"
                }`}
              >
                Request Amount
              </Text>
            </TouchableOpacity>
          </View>

          {/* Amount Input (when amount tab active) */}
          {activeTab === "amount" && (
            <View className="mt-6">
              <Text className="text-dark-400 text-sm mb-2">Request Amount (SOL)</Text>
              <View className="flex-row items-center bg-dark-900 border border-dark-800 rounded-xl px-4">
                <TextInput
                  className="flex-1 py-4 text-white text-2xl font-bold"
                  placeholder="0.00"
                  placeholderTextColor="#71717a"
                  keyboardType="decimal-pad"
                  value={requestAmount}
                  onChangeText={setRequestAmount}
                />
                <Text className="text-dark-400 text-lg font-medium">SOL</Text>
              </View>
              {requestAmount && parseFloat(requestAmount) > 0 && (
                <Text className="text-dark-500 text-sm mt-2">
                  QR code will include {requestAmount} SOL request
                </Text>
              )}
            </View>
          )}

          {/* QR Code */}
          <View testID="qr-code-container" className="mt-6 items-center">
            <View className="bg-white rounded-2xl p-6">
              {stealthAddress ? (
                <QRCode
                  value={getPaymentUri()}
                  size={200}
                  backgroundColor="white"
                  color="#0a0a0a"
                />
              ) : (
                <View className="w-[200px] h-[200px] items-center justify-center">
                  <ActivityIndicator size="large" color="#8b5cf6" />
                </View>
              )}
            </View>
            <Text className="text-dark-500 text-sm mt-3">
              Scan to receive privately
            </Text>
          </View>

          {/* Stealth Address Display */}
          <View className="mt-6">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-dark-400 text-sm">Stealth Address</Text>
              <TouchableOpacity
                onPress={handleRegeneratePress}
                disabled={isGenerating}
                className="flex-row items-center gap-1"
                accessibilityRole="button"
                accessibilityLabel="Generate new stealth address"
                accessibilityHint="Creates a fresh one-time stealth address"
              >
                {isGenerating ? (
                  <ActivityIndicator size="small" color="#8b5cf6" />
                ) : (
                  <>
                    <ArrowsClockwise size={16} color={ICON_COLORS.brand} weight="regular" />
                    <Text className="text-brand-400 text-sm">New Address</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
            <View className="bg-dark-900 rounded-xl border border-dark-800 p-4">
              {stealthAddress ? (
                <Text
                  className="text-white font-mono text-sm"
                  numberOfLines={2}
                  selectable
                >
                  {formatForDisplay(stealthAddress)}
                </Text>
              ) : (
                <Text className="text-dark-500 font-mono text-sm">
                  Generating...
                </Text>
              )}
            </View>
          </View>

          {/* Action Buttons */}
          <View className="flex-row gap-3 mt-6">
            <TouchableOpacity
              testID="copy-address-button"
              className={`flex-1 py-4 rounded-xl items-center flex-row justify-center gap-2 ${
                copied ? "bg-green-600" : "bg-dark-800"
              }`}
              onPress={handleCopy}
              disabled={!stealthAddress}
              accessibilityRole="button"
              accessibilityLabel={copied ? "Address copied" : "Copy stealth address"}
              accessibilityHint="Copies the stealth address to clipboard"
            >
              {copied ? (
                <Check size={20} color={ICON_COLORS.white} weight="bold" />
              ) : (
                <ClipboardText size={20} color={ICON_COLORS.white} weight="regular" />
              )}
              <Text className="text-white font-semibold">
                {copied ? "Copied" : "Copy"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="share-address-button"
              className="flex-1 bg-brand-600 py-4 rounded-xl items-center flex-row justify-center gap-2"
              onPress={handleShare}
              disabled={!stealthAddress}
              accessibilityRole="button"
              accessibilityLabel="Share stealth address"
              accessibilityHint="Opens the share dialog to send your address"
            >
              <Export size={20} color={ICON_COLORS.white} weight="regular" />
              <Text className="text-white font-semibold">Share</Text>
            </TouchableOpacity>
          </View>

          {/* Privacy Info Card */}
          <View className="mt-6 bg-brand-900/10 border border-brand-800/30 rounded-xl p-4">
            <View className="flex-row items-start gap-3">
              <LockKey size={24} color={ICON_COLORS.brand} weight="fill" />
              <View className="flex-1">
                <Text className="text-brand-400 font-medium">
                  One-time stealth address
                </Text>
                <Text className="text-dark-400 text-sm mt-1">
                  Each payment uses a unique derived address, making transactions
                  unlinkable and preserving your privacy on-chain.
                </Text>
              </View>
            </View>
          </View>

          {/* Scan for Payments Button */}
          <TouchableOpacity
            className="mt-6 bg-dark-800 border border-dark-700 rounded-xl p-4 flex-row items-center"
            onPress={() => router.push("/scan")}
            accessibilityRole="button"
            accessibilityLabel="Scan for payments"
            accessibilityHint="Opens the payment scanner to find incoming stealth payments"
          >
            <View className="w-10 h-10 bg-brand-900/30 rounded-full items-center justify-center">
              <MagnifyingGlass size={20} color={ICON_COLORS.brand} weight="regular" />
            </View>
            <View className="flex-1 ml-3">
              <Text className="text-white font-medium">Scan for Payments</Text>
              <Text className="text-dark-500 text-sm">
                Check for incoming stealth payments
              </Text>
            </View>
            <ArrowRight size={24} color={ICON_COLORS.dark} weight="regular" />
          </TouchableOpacity>

          {/* How It Works Section */}
          <View className="mt-6 mb-8">
            <Text className="text-white font-semibold mb-4">How it works</Text>

            <View className="flex-row items-start gap-3 mb-4">
              <View className="w-8 h-8 bg-dark-800 rounded-full items-center justify-center">
                <Text className="text-brand-400 font-bold">1</Text>
              </View>
              <View className="flex-1">
                <Text className="text-white font-medium">Share your address</Text>
                <Text className="text-dark-400 text-sm mt-0.5">
                  Send your stealth address or let them scan the QR code
                </Text>
              </View>
            </View>

            <View className="flex-row items-start gap-3 mb-4">
              <View className="w-8 h-8 bg-dark-800 rounded-full items-center justify-center">
                <Text className="text-brand-400 font-bold">2</Text>
              </View>
              <View className="flex-1">
                <Text className="text-white font-medium">They send privately</Text>
                <Text className="text-dark-400 text-sm mt-0.5">
                  Funds go to a derived one-time address only you can access
                </Text>
              </View>
            </View>

            <View className="flex-row items-start gap-3">
              <View className="w-8 h-8 bg-dark-800 rounded-full items-center justify-center">
                <Text className="text-brand-400 font-bold">3</Text>
              </View>
              <View className="flex-1">
                <Text className="text-white font-medium">Scan & claim</Text>
                <Text className="text-dark-400 text-sm mt-0.5">
                  Scan for payments and claim funds to your wallet privately
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Confirmation Modal for Address Regeneration (#72) */}
      <ConfirmModal
        visible={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleRegenerate}
        title="Generate New Address?"
        message="Your current address will be archived. Past payments remain claimable with archived keys."
        confirmText="Generate"
        cancelText="Cancel"
      />
    </SafeAreaView>
  )
}
