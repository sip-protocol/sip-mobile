/**
 * Send Screen
 *
 * Privacy-aware transfer flow using Privacy Provider architecture:
 * - Supports multiple privacy backends (SIP Native, Arcium, Privacy Cash, etc.)
 * - Amount input with USD conversion
 * - Recipient address (stealth or regular)
 * - Privacy level selection
 * - Confirmation modal
 * - Transaction progress
 *
 * @see https://github.com/sip-protocol/sip-mobile/issues/73
 */

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useState, useCallback, useEffect } from "react"
import { router, useLocalSearchParams } from "expo-router"
import * as Clipboard from "expo-clipboard"
import { usePrivacyProvider } from "@/hooks/usePrivacyProvider"
import { useWalletStore } from "@/stores/wallet"
import { useSettingsStore } from "@/stores/settings"
import { useToastStore } from "@/stores/toast"
import { useBalance } from "@/hooks/useBalance"
import { Button, Modal, EmptyState } from "@/components/ui"
import type { PrivacyLevel } from "@/types"
import type { PrivacySendStatus } from "@/privacy-providers"

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const STEALTH_ADDRESS_REGEX = /^sip:solana:[1-9A-HJ-NP-Za-km-z]{32,44}:[1-9A-HJ-NP-Za-km-z]{32,44}$/

function validateAddress(address: string): { isValid: boolean; error?: string } {
  if (!address || address.trim() === "") {
    return { isValid: false, error: "Address is required" }
  }

  const trimmed = address.trim()

  // Check stealth address format
  if (trimmed.startsWith("sip:")) {
    if (STEALTH_ADDRESS_REGEX.test(trimmed)) {
      return { isValid: true }
    }
    return { isValid: false, error: "Invalid stealth address format" }
  }

  // Check regular Solana address
  if (SOLANA_ADDRESS_REGEX.test(trimmed)) {
    return { isValid: true }
  }

  return { isValid: false, error: "Invalid Solana address" }
}

function validateAmount(
  amount: string,
  balance: number
): { isValid: boolean; error?: string } {
  if (!amount || amount.trim() === "") {
    return { isValid: false, error: "Amount is required" }
  }

  const numAmount = parseFloat(amount)

  if (isNaN(numAmount) || numAmount <= 0) {
    return { isValid: false, error: "Invalid amount" }
  }

  if (numAmount > balance) {
    return { isValid: false, error: "Insufficient balance" }
  }

  // Minimum 0.000001 SOL
  if (numAmount < 0.000001) {
    return { isValid: false, error: "Amount too small (min: 0.000001 SOL)" }
  }

  return { isValid: true }
}

function isStealthAddress(address: string): boolean {
  return address?.startsWith("sip:") && STEALTH_ADDRESS_REGEX.test(address.trim())
}

function formatUsdValue(amount: string, solPrice: number): string {
  const num = parseFloat(amount)
  if (isNaN(num) || num === 0 || solPrice === 0) return "$0.00"
  return `$${(num * solPrice).toFixed(2)}`
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function SendScreen() {
  // Handle scanned address from QR scanner
  const { scannedAddress } = useLocalSearchParams<{ scannedAddress?: string }>()

  // Privacy Provider (supports Arcium, Privacy Cash, ShadowWire, etc.)
  const {
    send,
    isReady: providerReady,
    isInitializing: providerInitializing,
    error: providerError,
    providerInfo,
  } = usePrivacyProvider()

  const { isConnected } = useWalletStore()
  const { defaultPrivacyLevel } = useSettingsStore()
  const { addToast } = useToastStore()
  const { balance, usdValue, solPrice } = useBalance()

  // Form state
  const [amount, setAmount] = useState("")
  const [recipient, setRecipient] = useState("")
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)

  // Transaction state
  const [status, setStatus] = useState<PrivacySendStatus>("idle")
  const [txHash, setTxHash] = useState<string | null>(null)
  const [txError, setTxError] = useState<string | null>(null)

  // Validation state
  const [addressError, setAddressError] = useState<string | null>(null)
  const [amountError, setAmountError] = useState<string | null>(null)

  // Reset on success
  useEffect(() => {
    if (status === "confirmed" && txHash) {
      setShowConfirmModal(false)
      setShowSuccessModal(true)
    }
  }, [status, txHash])

  const handleAmountChange = useCallback(
    (value: string) => {
      // Only allow valid decimal numbers
      if (value && !/^\d*\.?\d*$/.test(value)) return

      setAmount(value)
      if (value) {
        const validation = validateAmount(value, balance)
        setAmountError(validation.isValid ? null : validation.error || null)
      } else {
        setAmountError(null)
      }
    },
    [balance]
  )

  const handleRecipientChange = useCallback((value: string) => {
    setRecipient(value)
    if (value && value.length > 10) {
      const validation = validateAddress(value)
      setAddressError(validation.isValid ? null : validation.error || null)
    } else {
      setAddressError(null)
    }
  }, [])

  // Handle scanned address from QR scanner
  useEffect(() => {
    if (scannedAddress) {
      setRecipient(scannedAddress)
      handleRecipientChange(scannedAddress)
    }
  }, [scannedAddress, handleRecipientChange])

  const handleMaxAmount = useCallback(() => {
    const maxAmount = Math.max(0, balance - 0.001).toFixed(6) // Leave for fees
    setAmount(maxAmount)
    setAmountError(null)
  }, [balance])

  const handleReview = useCallback(() => {
    Keyboard.dismiss()

    // Final validation
    const addrValidation = validateAddress(recipient)
    if (!addrValidation.isValid) {
      setAddressError(addrValidation.error || "Invalid address")
      return
    }

    const amtValidation = validateAmount(amount, balance)
    if (!amtValidation.isValid) {
      setAmountError(amtValidation.error || "Invalid amount")
      return
    }

    // Check provider readiness
    if (!providerReady) {
      addToast({
        type: "error",
        title: "Provider not ready",
        message: providerError || "Please wait for provider to initialize",
      })
      return
    }

    setShowConfirmModal(true)
  }, [recipient, amount, balance, providerReady, providerError, addToast])

  const handleConfirmSend = useCallback(async () => {
    // Reset state
    setStatus("idle")
    setTxError(null)
    setTxHash(null)

    // Execute send via Privacy Provider
    const result = await send(
      {
        amount,
        recipient,
        privacyLevel: defaultPrivacyLevel,
      },
      (newStatus) => setStatus(newStatus)
    )

    if (result.success && result.txHash) {
      setTxHash(result.txHash)
      setStatus("confirmed")
    } else {
      setTxError(result.error || "Transaction failed")
      setStatus("error")
      addToast({
        type: "error",
        title: "Transaction failed",
        message: result.error || "Unknown error",
      })
    }
  }, [send, amount, recipient, defaultPrivacyLevel, addToast])

  const handleCloseSuccess = useCallback(() => {
    setShowSuccessModal(false)
    setAmount("")
    setRecipient("")
    setStatus("idle")
    setTxHash(null)
    setTxError(null)
  }, [])

  const reset = useCallback(() => {
    setStatus("idle")
    setTxHash(null)
    setTxError(null)
  }, [])

  const getPrivacyLevelInfo = (level: PrivacyLevel) => {
    switch (level) {
      case "shielded":
        return {
          icon: "🔒",
          title: "Private Transfer",
          description: "Amount and recipient hidden on-chain",
          color: "brand",
        }
      case "compliant":
        return {
          icon: "🔐",
          title: "Compliant Transfer",
          description: "Private with viewing key for auditors",
          color: "cyan",
        }
      case "transparent":
        return {
          icon: "🔓",
          title: "Public Transfer",
          description: "Fully visible on-chain",
          color: "dark",
        }
    }
  }

  const isValid = !addressError && !amountError && amount && recipient
  const isStealth = recipient && isStealthAddress(recipient)

  if (!isConnected) {
    return (
      <SafeAreaView className="flex-1 bg-dark-950">
        <EmptyState
          title="Connect Wallet"
          message="Connect your wallet to send SOL privately"
          icon="wallet-outline"
          iconColor="#8b5cf6"
          actionLabel="Set Up Wallet"
          onAction={() => router.push("/wallet-setup")}
          className="flex-1"
        />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-dark-950">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
          <View className="px-6 pt-6 pb-4">
            {/* Header */}
            <Text className="text-3xl font-bold text-white">Send</Text>
            <Text className="text-dark-400 mt-1">
              Send SOL or tokens privately
            </Text>

            {/* Provider Badge */}
            {providerInfo && (
              <View className="mt-3 flex-row items-center">
                <View className="bg-dark-800 px-3 py-1.5 rounded-lg flex-row items-center">
                  <Text className="text-dark-400 text-xs mr-2">Provider:</Text>
                  <Text className="text-white text-xs font-medium">
                    {providerInfo.name}
                  </Text>
                  {providerInitializing && (
                    <ActivityIndicator size="small" color="#8b5cf6" style={{ marginLeft: 8 }} />
                  )}
                </View>
              </View>
            )}

            {/* Balance Display */}
            <View className="mt-4 flex-row items-center justify-between bg-dark-900 rounded-xl p-4 border border-dark-800">
              <View>
                <Text className="text-dark-500 text-sm">Available Balance</Text>
                <Text className="text-white text-xl font-bold mt-0.5">
                  {balance.toFixed(4)} SOL
                </Text>
              </View>
              <Text className="text-dark-400">
                ≈ ${usdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </Text>
            </View>

            {/* Amount Input */}
            <View className="mt-6">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-dark-400 text-sm">Amount</Text>
                <TouchableOpacity onPress={handleMaxAmount}>
                  <Text className="text-brand-400 text-sm">MAX</Text>
                </TouchableOpacity>
              </View>
              <View
                className={`bg-dark-900 rounded-xl border p-4 ${
                  amountError ? "border-red-500" : "border-dark-800"
                }`}
              >
                <View className="flex-row items-center">
                  <TextInput
                    className="flex-1 text-3xl font-bold text-white"
                    placeholder="0.00"
                    placeholderTextColor="#71717a"
                    keyboardType="decimal-pad"
                    value={amount}
                    onChangeText={handleAmountChange}
                  />
                  <Text className="text-dark-400 text-xl font-medium ml-2">SOL</Text>
                </View>
                <Text className="text-dark-500 mt-2">{formatUsdValue(amount, solPrice)}</Text>
              </View>
              {amountError && (
                <Text className="text-red-400 text-sm mt-2">{amountError}</Text>
              )}
            </View>

            {/* Recipient Input */}
            <View className="mt-6">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-dark-400 text-sm">Recipient</Text>
                {isStealth && (
                  <View className="bg-brand-600/20 px-2 py-0.5 rounded">
                    <Text className="text-brand-400 text-xs">Stealth Address</Text>
                  </View>
                )}
              </View>
              <View
                className={`bg-dark-900 rounded-xl border p-4 ${
                  addressError ? "border-red-500" : "border-dark-800"
                }`}
              >
                <TextInput
                  className="text-white"
                  placeholder="Wallet address or sip: stealth address"
                  placeholderTextColor="#71717a"
                  value={recipient}
                  onChangeText={handleRecipientChange}
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline
                  numberOfLines={2}
                />
              </View>
              {addressError && (
                <Text className="text-red-400 text-sm mt-2">{addressError}</Text>
              )}

              {/* Quick Actions */}
              <View className="flex-row gap-2 mt-3">
                <TouchableOpacity
                  className="flex-row items-center bg-dark-800 rounded-lg px-3 py-2"
                  onPress={() => router.push("/send/scanner")}
                >
                  <Text className="text-dark-400 mr-1">📷</Text>
                  <Text className="text-dark-400 text-sm">Scan QR</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-row items-center bg-dark-800 rounded-lg px-3 py-2"
                  onPress={() => router.push("/settings/accounts")}
                >
                  <Text className="text-dark-400 mr-1">📋</Text>
                  <Text className="text-dark-400 text-sm">Contacts</Text>
                </TouchableOpacity>
                {/* DEBUG: Test stealth address button */}
                {__DEV__ && (
                  <TouchableOpacity
                    className="flex-row items-center bg-cyan-800 rounded-lg px-3 py-2"
                    onPress={() => {
                      // Valid ed25519 test keys for testing
                      const testStealth =
                        "sip:solana:9qi3ir8FT4pP48b9VAbkqVt5XSc9LoLTXC5X7nfPvNLb:BZFQo2BsXgRca6wcbnQkDB3XLiaFwDpz6uMz4NkCxRVQ"
                      setRecipient(testStealth)
                      handleRecipientChange(testStealth)
                    }}
                  >
                    <Text className="text-cyan-300 mr-1">🧪</Text>
                    <Text className="text-cyan-300 text-sm">Test Stealth</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Privacy Level Display (read-only, configured in Settings) */}
            <TouchableOpacity
              className="mt-6"
              onPress={() => router.push("/(tabs)/settings")}
              activeOpacity={0.7}
            >
              <Text className="text-dark-400 text-sm mb-3">Privacy Level</Text>
              <View
                className={`p-4 rounded-xl border ${
                  defaultPrivacyLevel === "shielded"
                    ? "bg-brand-900/20 border-brand-700"
                    : defaultPrivacyLevel === "compliant"
                    ? "bg-cyan-900/20 border-cyan-700"
                    : "bg-dark-800 border-dark-600"
                }`}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3">
                    <Text className="text-2xl">
                      {getPrivacyLevelInfo(defaultPrivacyLevel).icon}
                    </Text>
                    <View>
                      <Text
                        className={`font-medium ${
                          defaultPrivacyLevel === "transparent"
                            ? "text-white"
                            : defaultPrivacyLevel === "compliant"
                            ? "text-cyan-400"
                            : "text-brand-400"
                        }`}
                      >
                        {getPrivacyLevelInfo(defaultPrivacyLevel).title}
                      </Text>
                      <Text className="text-dark-500 text-xs">
                        {getPrivacyLevelInfo(defaultPrivacyLevel).description}
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Text className="text-dark-500 text-xs">Change</Text>
                    <Text className="text-dark-500">›</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>

            {/* Warning for non-stealth address with private transfer */}
            {recipient &&
              !isStealth &&
              defaultPrivacyLevel !== "transparent" &&
              !addressError && (
                <View className="mt-4 bg-yellow-900/20 border border-yellow-700/50 rounded-xl p-3">
                  <View className="flex-row items-start gap-2">
                    <Text className="text-yellow-500">⚠️</Text>
                    <Text className="text-yellow-400 text-sm flex-1">
                      For full privacy, ask the recipient for their stealth address
                      (sip:...). Regular addresses can still receive private transfers
                      but with reduced privacy.
                    </Text>
                  </View>
                </View>
              )}
          </View>
        </ScrollView>

        {/* Send Button */}
        <View className="px-6 pb-6 pt-2 border-t border-dark-900">
          <Button
            fullWidth
            size="lg"
            onPress={handleReview}
            disabled={!isValid || !providerReady}
            loading={providerInitializing}
          >
            {providerInitializing
              ? "Initializing..."
              : defaultPrivacyLevel !== "transparent"
              ? "Send Privately"
              : "Send"}
          </Button>
        </View>
      </KeyboardAvoidingView>

      {/* Confirmation Modal */}
      <Modal
        visible={showConfirmModal}
        onClose={() => status === "idle" && setShowConfirmModal(false)}
        title="Confirm Transfer"
      >
        <View className="gap-4">
          {/* Amount Summary */}
          <View className="items-center py-4">
            <Text className="text-4xl font-bold text-white">{amount} SOL</Text>
            <Text className="text-dark-400 mt-1">{formatUsdValue(amount, solPrice)}</Text>
          </View>

          {/* Details */}
          <View className="bg-dark-900 rounded-xl p-4 gap-3">
            <View className="flex-row justify-between">
              <Text className="text-dark-500">To</Text>
              <Text className="text-white text-sm" numberOfLines={1}>
                {recipient.length > 20
                  ? `${recipient.slice(0, 12)}...${recipient.slice(-8)}`
                  : recipient}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-dark-500">Privacy</Text>
              <Text
                className={
                  defaultPrivacyLevel === "shielded"
                    ? "text-brand-400"
                    : defaultPrivacyLevel === "compliant"
                    ? "text-cyan-400"
                    : "text-dark-300"
                }
              >
                {getPrivacyLevelInfo(defaultPrivacyLevel).title}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-dark-500">Network Fee</Text>
              <Text className="text-dark-300">~0.00001 SOL</Text>
            </View>
            <View className="flex-row justify-between items-center">
              <Text className="text-dark-500">Provider</Text>
              <View className="flex-row items-center">
                <Text className="text-brand-400 font-medium">
                  {providerInfo?.name || "SIP Native"}
                </Text>
              </View>
            </View>
          </View>

          {/* Status Display */}
          {status !== "idle" && status !== "error" && status !== "confirmed" && (
            <View className="flex-row items-center justify-center gap-2 py-2">
              <ActivityIndicator size="small" color="#8b5cf6" />
              <Text className="text-dark-400">
                {status === "validating" && "Validating..."}
                {status === "preparing" && "Preparing transaction..."}
                {status === "signing" && "Waiting for signature..."}
                {status === "submitting" && "Submitting to network..."}
              </Text>
            </View>
          )}

          {/* Error Display */}
          {txError && (
            <View className="bg-red-900/20 border border-red-700 rounded-xl p-3">
              <Text className="text-red-400 text-sm">{txError}</Text>
            </View>
          )}

          {/* Action Buttons */}
          <View className="flex-row gap-3">
            <Button
              variant="secondary"
              onPress={() => {
                setShowConfirmModal(false)
                reset()
              }}
              disabled={status !== "idle" && status !== "error"}
              style={{ flex: 1 }}
            >
              Cancel
            </Button>
            <Button
              onPress={handleConfirmSend}
              disabled={status !== "idle" && status !== "error"}
              loading={status !== "idle" && status !== "error"}
              style={{ flex: 1 }}
            >
              Confirm
            </Button>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        onClose={handleCloseSuccess}
        title="Transfer Complete"
      >
        <View className="gap-4">
          <View className="items-center py-6">
            <View className="w-20 h-20 bg-green-600/20 rounded-full items-center justify-center mb-4">
              <Text className="text-4xl">✅</Text>
            </View>
            <Text className="text-2xl font-bold text-white">{amount} SOL</Text>
            <Text className="text-green-400 mt-1">Successfully sent!</Text>
          </View>

          {txHash && (
            <TouchableOpacity
              className="bg-dark-900 rounded-xl p-4 active:bg-dark-800"
              onPress={async () => {
                await Clipboard.setStringAsync(txHash)
                addToast({ title: "Copied!", type: "success" })
              }}
            >
              <View className="flex-row justify-between items-center mb-1">
                <Text className="text-dark-500 text-sm">Transaction Hash</Text>
                <Text className="text-dark-500 text-xs">Tap to copy</Text>
              </View>
              <Text className="text-white font-mono text-xs" numberOfLines={2}>
                {txHash}
              </Text>
            </TouchableOpacity>
          )}

          <Button fullWidth onPress={handleCloseSuccess}>
            Done
          </Button>
        </View>
      </Modal>
    </SafeAreaView>
  )
}
