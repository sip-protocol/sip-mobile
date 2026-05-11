/**
 * Send Screen
 *
 * Privacy-aware transfer flow using Privacy Provider architecture:
 * - Supports multiple privacy backends (SIP Native, Arcium, Privacy Cash, etc.)
 * - NumpadInput for amount entry (MAX/75%/50%/CLEAR presets)
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
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useState, useCallback, useEffect, useMemo, useRef } from "react"
import { router, useLocalSearchParams } from "expo-router"
import * as Clipboard from "expo-clipboard"
import type { Connection } from "@solana/web3.js"
import { resolve as bonfidaResolve } from "@bonfida/spl-name-service"
import bs58 from "bs58"
import {
  ShieldCheckIcon,
  LockIcon,
  EyeIcon,
  QrCodeIcon,
  AddressBookIcon,
  WarningIcon,
  CheckCircleIcon,
  XCircleIcon,
  SpinnerGapIcon,
  type Icon as PhosphorIcon,
} from "phosphor-react-native"
import { ICON_COLORS } from "@/constants/icons"
import { hapticMedium, hapticSuccess, hapticError, hapticLight } from "@/utils/haptics"
import { logger } from "@/utils/logger"
import { usePrivacyProvider } from "@/hooks/usePrivacyProvider"
import { useWalletStore } from "@/stores/wallet"
import { useSettingsStore } from "@/stores/settings"
import { useContactsStore } from "@/stores/contacts"
import { useToastStore } from "@/stores/toast"
import { useBalance } from "@/hooks/useBalance"
import { NumpadInput } from "@/components"
import { Button, Modal, EmptyState } from "@/components/ui"
import type { PrivacyLevel } from "@/types"
import type { PrivacySendStatus } from "@/privacy-providers"
import { getRpcClient } from "@/lib/rpc"
import { getRpcApiKey } from "@/lib/config"
import {
  resolve as snsResolve,
  MetaAddress,
  NotFound,
  Malformed,
} from "@/lib/sns-stealth-mobile"
import {
  classifyInput,
  isReadyToSend,
  targetUri,
  type RecipientResolution,
} from "@/lib/recipient-resolution"

// SNS resolution debounce delay (ms) — avoids firing on every keystroke
const RESOLVE_DEBOUNCE_MS = 350

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

// Estimated overhead for stealth SOL transfers (tx fee + PDA rent + rent-exempt minimum)
const STEALTH_SOL_OVERHEAD = 0.004

function validateAmount(
  amount: string,
  balance: number,
  isStealth: boolean,
  isSOL: boolean
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

  // For stealth SOL transfers, account for tx fee + PDA rent
  if (isSOL && isStealth && numAmount + STEALTH_SOL_OVERHEAD > balance) {
    const maxSend = Math.max(0, balance - STEALTH_SOL_OVERHEAD)
    return {
      isValid: false,
      error: `Insufficient SOL for fees. Max send: ~${maxSend.toFixed(4)} SOL`,
    }
  }

  // Minimum 0.000001 SOL
  if (numAmount < 0.000001) {
    return { isValid: false, error: "Amount too small (min: 0.000001 SOL)" }
  }

  return { isValid: true }
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
  // Handle params from QR scanner or contacts
  const { scannedAddress, recipient: recipientParam, contactName } = useLocalSearchParams<{
    scannedAddress?: string
    recipient?: string
    contactName?: string
  }>()

  // Privacy Provider (supports Arcium, Privacy Cash, ShadowWire, etc.)
  const {
    send,
    isReady: providerReady,
    isInitializing: providerInitializing,
    error: providerError,
    providerInfo,
  } = usePrivacyProvider()

  const { isConnected } = useWalletStore()
  const {
    defaultPrivacyLevel,
    network,
    rpcProvider,
    heliusApiKey,
    quicknodeApiKey,
    tritonEndpoint,
  } = useSettingsStore()
  const { addToast } = useToastStore()
  const { balance, solPrice, tokenBalances } = useBalance()

  // ── Cluster-aware Connection (Task 16 pattern).
  //
  // Used by the resolution effect below. Same TODO(rpc-singleton) caveat as
  // sip-stealth.tsx: getRpcClient mutates a global singleton. Deferred to
  // a dedicated cleanup pass — out of scope for the recipient resolution
  // feature.
  const connection: Connection = useMemo(() => {
    let apiKey: string | undefined
    let customEndpoint: string | undefined
    switch (rpcProvider) {
      case "helius":
        apiKey = heliusApiKey || getRpcApiKey("helius") || undefined
        break
      case "quicknode":
        apiKey = quicknodeApiKey || undefined
        break
      case "triton":
        customEndpoint = tritonEndpoint || undefined
        break
      case "publicnode":
      default:
        break
    }
    return getRpcClient({
      provider: rpcProvider,
      cluster: network,
      apiKey,
      customEndpoint,
    }).getConnection()
  }, [network, rpcProvider, heliusApiKey, quicknodeApiKey, tritonEndpoint])

  // Token selection state
  const SOL_TOKEN: { symbol: string; name: string; mint: string; decimals: number } = {
    symbol: "SOL",
    name: "Solana",
    mint: "So11111111111111111111111111111111111111112",
    decimals: 9,
  }
  const [selectedToken, setSelectedToken] = useState(SOL_TOKEN)
  const isSOL = selectedToken.mint === SOL_TOKEN.mint

  // Get balance for selected token
  const selectedBalance = isSOL
    ? balance
    : tokenBalances.find((t) => t.mint === selectedToken.mint)?.uiAmount ?? 0

  // Form state
  const [amount, setAmount] = useState("")
  const [recipient, setRecipient] = useState("")
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)

  // Transaction state
  const [status, setStatus] = useState<PrivacySendStatus>("idle")
  const [txHash, setTxHash] = useState<string | null>(null)
  const [txError, setTxError] = useState<string | null>(null)

  // Recipient resolution state machine.
  // Drives all submit-gating + UX feedback below the input. The async ".sol"
  // resolve runs inside the effect below; everything else is classified
  // synchronously from `recipient` via classifyInput().
  const [resolution, setResolution] = useState<RecipientResolution>({
    kind: "empty",
  })

  // Deferred "View public address" preview for the not-found-record warn UX.
  // We do NOT actually submit a transparent send to the .sol's pointer here —
  // that's deferred work, mirroring Phase B's scope decision in sip-app.
  const [publicAddressPreview, setPublicAddressPreview] = useState<
    string | null
  >(null)
  const [publicAddressLoading, setPublicAddressLoading] = useState(false)

  // ── Async resolution coordination refs ────────────────────────────────────
  //
  // We keep these refs INLINE (rather than extracting a RecipientInput
  // component as sip-app's Phase B does) because:
  //   • Phase B's reviewer flagged the unmount race as Critical C1 — we
  //     preserve the same generation counter + unmounted guard regardless
  //     of where the state machine lives.
  //   • sip-mobile's send screen is monolithic by design (one tab, one
  //     flow). Extracting RecipientInput would force a callback API
  //     boundary, complicating RTL-less logic tests without commensurate
  //     code-reuse benefit (no other screen needs a free-form recipient).
  //
  // Generation counter: every input change bumps it; awaited resolves
  // compare against the captured generation and discard if stale.
  const resolveGenRef = useRef(0)
  // Debounce timer ref (350ms — matches sip-app).
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Unmount guard — flipped true in effect cleanup; checked across awaits
  // to prevent setState on an unmounted component when a resolve settles
  // late (Phase B Critical C1 fix).
  const unmountedRef = useRef(false)

  // Reset on success + record payment for contacts
  useEffect(() => {
    if (status === "confirmed" && txHash) {
      setShowConfirmModal(false)
      setShowSuccessModal(true)
      hapticSuccess()

      // Record payment if recipient is a saved contact
      const contact = useContactsStore.getState().getContactByAddress(recipient)
      if (contact) {
        useContactsStore.getState().recordPayment(contact.id)
      }
    }
  }, [status, txHash, recipient])

  const handleNumpadAmountChange = useCallback(
    (value: number) => {
      setAmount(value > 0 ? value.toString() : "")
    },
    []
  )

  // Recipient changes only update state — the resolution effect below
  // classifies + (for .sol) async-resolves it.
  const handleRecipientChange = useCallback((value: string) => {
    setRecipient(value)
  }, [])

  // Handle scanned address from QR scanner
  useEffect(() => {
    if (scannedAddress) {
      setRecipient(scannedAddress)
    }
  }, [scannedAddress])

  // Handle recipient param from contacts
  useEffect(() => {
    if (recipientParam) {
      setRecipient(recipientParam)
    }
  }, [recipientParam])

  // ── Recipient resolution effect ─────────────────────────────────────────────
  //
  // Effect deps are `[recipient, connection]` (NOT setRecipient or its
  // derived state) — the goal is to re-run only when the user's input
  // string changes or the cluster-aware Connection changes (e.g. via
  // settings). The setter functions are stable across renders by React's
  // own contract and don't need to be in the dep list.
  useEffect(() => {
    // Reset the unmount flag on fresh effect runs. Cleanup (below) flips
    // it true, but the next dep-driven run sees a new closure with this
    // re-armed flag, which is the correct lifecycle for the in-flight
    // awaits to detect "we've been replaced or unmounted."
    unmountedRef.current = false

    // Cancel any pending debounce from a previous keystroke.
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }

    const initial = classifyInput(recipient)

    // Non-SNS states resolve synchronously — no debounce needed.
    if (initial.kind !== "sns-resolving") {
      resolveGenRef.current += 1
      setResolution(initial)
      setPublicAddressPreview(null)
      return
    }

    // SNS path: show resolving immediately, debounce the network call.
    setResolution(initial)
    setPublicAddressPreview(null)

    const generation = ++resolveGenRef.current
    const domain = initial.domain

    debounceRef.current = setTimeout(async () => {
      if (unmountedRef.current) return
      if (!connection) return

      try {
        const result = await snsResolve(connection, domain)

        if (unmountedRef.current) return
        if (resolveGenRef.current !== generation) return // stale — discard

        let next: RecipientResolution

        if (result instanceof MetaAddress) {
          // Build sip:solana:<spend>:<view> URI at the resolution boundary.
          // The send() call's contract is the URI string, not MetaAddress.
          const uri = `sip:solana:${bs58.encode(result.spending)}:${bs58.encode(result.viewing)}`
          next = { kind: "sns-resolved", domain, uri }
        } else if (result instanceof NotFound) {
          next =
            result.subject === "domain"
              ? { kind: "sns-not-found-domain", domain }
              : { kind: "sns-not-found-record", domain }
        } else if (result instanceof Malformed) {
          next = { kind: "sns-malformed", domain, reason: result.reason }
        } else {
          // Defensive: unknown variant. Map to malformed with placeholder.
          next = { kind: "sns-malformed", domain, reason: "unknown" }
        }

        setResolution(next)
      } catch (err) {
        if (unmountedRef.current) return
        if (resolveGenRef.current !== generation) return

        logger.error("[Send] SNS resolution error:", err)
        // Network/chain errors: surface as not-found-domain (safe, red error).
        setResolution({ kind: "sns-not-found-domain", domain })
      }
    }, RESOLVE_DEBOUNCE_MS)

    return () => {
      unmountedRef.current = true
      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
    }
  }, [recipient, connection])

  // ── "View public address" handler for the not-found-record warn UX ─────────
  //
  // Surfaces the .sol's SOL pointer (Bonfida resolve) so the user can copy
  // it manually. We do NOT auto-submit a transparent transfer here — that's
  // deferred work, same scope decision as Phase B in sip-app.
  const handleViewPublicAddress = useCallback(async () => {
    if (resolution.kind !== "sns-not-found-record") return
    const domain = resolution.domain
    setPublicAddressLoading(true)
    setPublicAddressPreview(null)
    try {
      const pubkey = await bonfidaResolve(connection, domain)
      setPublicAddressPreview(pubkey.toBase58())
    } catch (err) {
      logger.error("[Send] Bonfida resolve (View public) failed:", err)
      setPublicAddressPreview("error")
    } finally {
      setPublicAddressLoading(false)
    }
  }, [resolution, connection])

  const handleCancelDomain = useCallback(() => {
    setRecipient("")
  }, [])

  const handleReview = useCallback(() => {
    Keyboard.dismiss()

    // Final validation — submit-gate uses the same isReadyToSend predicate
    // that the disabled-state below uses, so this branch is only reached
    // when the state machine says we're ready. Defensive guard remains.
    if (!isReadyToSend(resolution)) {
      addToast({
        type: "error",
        title: "Recipient not ready",
        message:
          resolution.kind === "sns-resolving"
            ? "Still resolving the .sol domain — try again in a moment"
            : "Enter a valid recipient",
      })
      return
    }

    const amtValidation = validateAmount(amount, selectedBalance, !!isStealth, isSOL)
    if (!amtValidation.isValid) {
      addToast({
        type: "error",
        title: "Invalid amount",
        message: amtValidation.error || "Please enter a valid amount",
      })
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

    hapticMedium()
    setShowConfirmModal(true)
  }, [resolution, amount, selectedBalance, providerReady, providerError, addToast])

  const handleConfirmSend = useCallback(async () => {
    logger.debug("[Send] Starting transaction...")
    // Reset state
    setStatus("idle")
    setTxError(null)
    setTxHash(null)

    // Use the resolved sip: URI for sns-resolved kinds so the underlying
    // send() call receives a canonical sip:solana:<spend>:<view> string
    // (it already understands that shape). For sip-uri / solana-address
    // kinds, targetUri() returns the raw input verbatim.
    const sendTarget = targetUri(resolution) ?? recipient

    try {
      // Execute send via Privacy Provider
      const result = await send(
        {
          amount,
          recipient: sendTarget,
          privacyLevel: defaultPrivacyLevel,
          tokenMint: isSOL ? undefined : selectedToken.mint,
        },
        (newStatus) => setStatus(newStatus)
      )

      logger.info("[Send] Result:", result.success ? "success" : "failed", result.error || result.txHash)
      if (result.success && result.txHash) {
        setTxHash(result.txHash)
        setStatus("confirmed")
      } else {
        console.error("[Send] Transaction failed:", result.error)
        setTxError(result.error || "Transaction failed")
        setStatus("error")
        hapticError()
        addToast({
          type: "error",
          title: "Transaction failed",
          message: result.error || "Unknown error",
        })
      }
    } catch (err) {
      // Catch any unhandled exceptions to prevent component crash
      console.error("[Send] Unhandled error:", err)
      const errorMessage = err instanceof Error ? err.message : "Unexpected error occurred"
      setTxError(errorMessage)
      setStatus("error")
      hapticError()
      addToast({
        type: "error",
        title: "Transaction failed",
        message: errorMessage,
      })
    }
  }, [
    send,
    amount,
    recipient,
    resolution,
    defaultPrivacyLevel,
    isSOL,
    selectedToken.mint,
    addToast,
  ])

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

  const getPrivacyLevelInfo = (level: PrivacyLevel): {
    Icon: PhosphorIcon
    iconColor: string
    title: string
    description: string
    textColor: string
  } => {
    switch (level) {
      case "shielded":
        return {
          Icon: ShieldCheckIcon,
          iconColor: ICON_COLORS.brand,
          title: "Private Transfer",
          description: "Amount and recipient hidden on-chain",
          textColor: "text-brand-400",
        }
      case "compliant":
        return {
          Icon: LockIcon,
          iconColor: ICON_COLORS.cyan,
          title: "Compliant Transfer",
          description: "Private with viewing key for auditors",
          textColor: "text-cyan-400",
        }
      case "transparent":
        return {
          Icon: EyeIcon,
          iconColor: ICON_COLORS.muted,
          title: "Public Transfer",
          description: "Fully visible on-chain",
          textColor: "text-white",
        }
    }
  }

  // Stealth iff the resolved recipient is a sip: URI (raw or .sol-derived).
  // `solana-address` kind is explicitly NOT stealth.
  const isStealth =
    resolution.kind === "sip-uri" || resolution.kind === "sns-resolved"

  if (!isConnected) {
    return (
      <SafeAreaView className="flex-1 bg-dark-950">
        <EmptyState
          title="Connect Wallet"
          message="Connect your wallet to send SOL privately"
          iconName="wallet"
          iconColor="brand"
          actionLabel="Set Up Wallet"
          onAction={() => router.push("/(auth)/wallet-setup")}
          className="flex-1"
        />
      </SafeAreaView>
    )
  }

  // Submit gate: ready iff the resolution is in a sendable state. .sol
  // resolutions in flight return false so the CTA stays disabled.
  const isValidRecipient = isReadyToSend(resolution)
  const ctaLabel = providerInitializing
    ? "Initializing..."
    : defaultPrivacyLevel !== "transparent"
    ? "Send Privately"
    : "Send"

  return (
    <SafeAreaView className="flex-1 bg-dark-950">
      {/* Top section: recipient, privacy level, warnings */}
      <ScrollView style={{ flexGrow: 0 }} keyboardShouldPersistTaps="handled">
        <View className="px-6 pt-6 pb-4">
          {/* Header */}
          <Text className="text-3xl font-bold text-white">Send</Text>
          <Text className="text-dark-400 mt-1">
            Send {selectedToken.symbol} privately
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

          {/* Contact Name Banner */}
          {contactName && (
            <View testID="contact-name-banner" className="mt-4 bg-brand-900/20 border border-brand-700/50 rounded-xl p-3">
              <Text className="text-brand-400 font-semibold text-base">
                Sending to {contactName}
              </Text>
            </View>
          )}

          {/* Recipient Input */}
          <View className="mt-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-dark-400 text-sm">Recipient</Text>
              {isStealth && (
                <View testID="stealth-address-badge" className="bg-brand-600/20 px-2 py-0.5 rounded">
                  <Text className="text-brand-400 text-xs">Stealth Address</Text>
                </View>
              )}
            </View>
            <View
              className={`bg-dark-900 rounded-xl border p-4 ${
                resolution.kind === "sns-resolved" || resolution.kind === "sip-uri"
                  ? "border-green-500/60"
                  : resolution.kind === "sns-not-found-domain" ||
                    resolution.kind === "sns-malformed" ||
                    resolution.kind === "invalid"
                  ? "border-red-500"
                  : "border-dark-800"
              }`}
            >
              <TextInput
                testID="recipient-input"
                className="text-white"
                placeholder="alice.sol, sip:solana:…, or a Solana address"
                placeholderTextColor="#71717a"
                value={recipient}
                onChangeText={handleRecipientChange}
                autoCapitalize="none"
                autoCorrect={false}
                multiline
                numberOfLines={2}
              />
            </View>

            {/* Resolution feedback (replaces the old single-line addressError) */}
            {resolution.kind === "sns-resolving" && (
              <View
                testID="recipient-resolving"
                className="flex-row items-center mt-2"
              >
                <SpinnerGapIcon
                  size={14}
                  color={ICON_COLORS.muted}
                  weight="regular"
                />
                <Text className="text-dark-400 text-sm ml-2">
                  Resolving {resolution.domain}…
                </Text>
              </View>
            )}

            {resolution.kind === "sns-resolved" && (
              <View
                testID="recipient-resolved"
                className="flex-row items-center mt-2"
              >
                <CheckCircleIcon
                  size={14}
                  color={ICON_COLORS.success}
                  weight="fill"
                />
                <Text className="text-green-400 text-sm ml-2">
                  {resolution.domain} · private payment available
                </Text>
              </View>
            )}

            {resolution.kind === "sip-uri" && (
              <View
                testID="recipient-sip-uri"
                className="flex-row items-center mt-2"
              >
                <CheckCircleIcon
                  size={14}
                  color={ICON_COLORS.success}
                  weight="fill"
                />
                <Text className="text-green-400 text-sm ml-2">
                  SIP stealth address ready
                </Text>
              </View>
            )}

            {resolution.kind === "sns-not-found-record" && (
              <View
                testID="recipient-not-found-record"
                className="mt-3 bg-yellow-900/20 border border-yellow-700/50 rounded-xl p-3"
              >
                <View className="flex-row items-start gap-2">
                  <WarningIcon
                    size={18}
                    color={ICON_COLORS.warning}
                    weight="fill"
                  />
                  <View className="flex-1">
                    <Text className="text-yellow-300 font-semibold text-sm">
                      Private payment not available
                    </Text>
                    <Text className="text-yellow-400/80 text-xs mt-0.5">
                      {resolution.domain} hasn&apos;t enabled SIP-STEALTH.
                    </Text>
                  </View>
                </View>

                {publicAddressLoading && (
                  <View className="flex-row items-center mt-3">
                    <SpinnerGapIcon
                      size={12}
                      color={ICON_COLORS.muted}
                      weight="regular"
                    />
                    <Text className="text-dark-400 text-xs ml-2">
                      Looking up public address…
                    </Text>
                  </View>
                )}

                {publicAddressPreview &&
                  publicAddressPreview !== "error" && (
                    <View className="mt-3">
                      <Text className="text-dark-400 text-xs">
                        Public address:
                      </Text>
                      <Text className="text-white font-mono text-xs mt-1">
                        {publicAddressPreview}
                      </Text>
                      <Text className="text-dark-500 text-xs mt-2">
                        Public sends via .sol are coming in a follow-up — not
                        yet available.
                      </Text>
                    </View>
                  )}

                {publicAddressPreview === "error" && (
                  <Text className="text-red-400 text-xs mt-3">
                    Could not look up public address for {resolution.domain}.
                  </Text>
                )}

                <View className="flex-row gap-2 mt-3">
                  <TouchableOpacity
                    onPress={handleViewPublicAddress}
                    disabled={publicAddressLoading}
                    className={`rounded-lg px-3 py-2 ${
                      publicAddressLoading
                        ? "bg-yellow-800/30"
                        : "bg-yellow-700/40"
                    }`}
                    accessibilityRole="button"
                    accessibilityLabel="View public address"
                  >
                    <Text className="text-yellow-200 text-xs font-semibold">
                      View public address
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleCancelDomain}
                    className="rounded-lg px-3 py-2 border border-dark-700"
                    accessibilityRole="button"
                    accessibilityLabel="Cancel domain resolution"
                  >
                    <Text className="text-dark-300 text-xs font-semibold">
                      Cancel
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {resolution.kind === "sns-not-found-domain" && (
              <View
                testID="recipient-not-found-domain"
                className="flex-row items-center mt-2"
              >
                <XCircleIcon
                  size={14}
                  color={ICON_COLORS.error}
                  weight="fill"
                />
                <Text className="text-red-400 text-sm ml-2">
                  {resolution.domain} not found
                </Text>
              </View>
            )}

            {resolution.kind === "sns-malformed" && (
              <View
                testID="recipient-malformed"
                className="flex-row items-center mt-2"
              >
                <XCircleIcon
                  size={14}
                  color={ICON_COLORS.error}
                  weight="fill"
                />
                <Text className="text-red-400 text-sm ml-2">
                  {resolution.domain}&apos;s privacy record is invalid (
                  {resolution.reason})
                </Text>
              </View>
            )}

            {resolution.kind === "invalid" && (
              <View
                testID="recipient-invalid"
                className="flex-row items-center mt-2"
              >
                <XCircleIcon
                  size={14}
                  color={ICON_COLORS.error}
                  weight="fill"
                />
                <Text className="text-red-400 text-sm ml-2">
                  Invalid format. Use a .sol domain, sip:solana:&lt;spend&gt;:&lt;view&gt;, or a Solana address
                </Text>
              </View>
            )}

            {/* Quick Actions */}
            <View className="flex-row gap-2 mt-3">
              <TouchableOpacity
                testID="scan-qr-button"
                className="flex-row items-center bg-dark-800 rounded-lg px-3 py-2"
                onPress={() => router.push("/send/scanner")}
                accessibilityRole="button"
                accessibilityLabel="Scan QR code"
                accessibilityHint="Opens the QR scanner to scan a recipient address"
              >
                <QrCodeIcon size={16} color={ICON_COLORS.muted} weight="regular" />
                <Text className="text-dark-400 text-sm ml-1">Scan QR</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-row items-center bg-dark-800 rounded-lg px-3 py-2"
                onPress={() => router.push("/contacts")}
                accessibilityRole="button"
                accessibilityLabel="Choose from contacts"
                accessibilityHint="Opens your contact list to select a recipient"
              >
                <AddressBookIcon size={16} color={ICON_COLORS.muted} weight="regular" />
                <Text className="text-dark-400 text-sm ml-1">Contacts</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Privacy Level Display (read-only, configured in Settings) */}
          <TouchableOpacity
            testID="privacy-toggle"
            className="mt-4"
            onPress={() => {
              hapticLight()
              router.push("/(tabs)/privacy")
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Privacy level: ${getPrivacyLevelInfo(defaultPrivacyLevel).title}`}
            accessibilityHint="Opens settings to change privacy level"
          >
            {(() => {
              const levelInfo = getPrivacyLevelInfo(defaultPrivacyLevel)
              const LevelIcon = levelInfo.Icon
              return (
                <View
                  className={`p-3 rounded-xl border ${
                    defaultPrivacyLevel === "shielded"
                      ? "bg-brand-900/20 border-brand-700"
                      : defaultPrivacyLevel === "compliant"
                      ? "bg-cyan-900/20 border-cyan-700"
                      : "bg-dark-800 border-dark-600"
                  }`}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-3">
                      <LevelIcon size={20} color={levelInfo.iconColor} weight="regular" />
                      <View>
                        <Text className={`text-sm font-medium ${levelInfo.textColor}`}>
                          {levelInfo.title}
                        </Text>
                        <Text className="text-dark-500 text-xs">
                          {levelInfo.description}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-dark-500 text-xs">Change ›</Text>
                  </View>
                </View>
              )
            })()}
          </TouchableOpacity>

          {/* Token Selector */}
          {tokenBalances.length > 0 && (
            <View className="mt-4">
              <Text className="text-dark-400 text-sm mb-2">Token</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2">
                  {/* SOL chip */}
                  <TouchableOpacity
                    className={`px-4 py-2 rounded-xl border ${
                      isSOL
                        ? "bg-brand-600/20 border-brand-600"
                        : "bg-dark-800 border-dark-700"
                    }`}
                    onPress={() => {
                      setSelectedToken(SOL_TOKEN)
                      setAmount("")
                      hapticLight()
                    }}
                  >
                    <Text className={`font-medium ${isSOL ? "text-brand-400" : "text-dark-300"}`}>
                      SOL
                    </Text>
                    <Text className="text-dark-500 text-xs">
                      {balance.toFixed(4)}
                    </Text>
                  </TouchableOpacity>
                  {/* SPL token chips */}
                  {tokenBalances.map((t) => {
                    const isSelected = selectedToken.mint === t.mint
                    return (
                      <TouchableOpacity
                        key={t.mint}
                        className={`px-4 py-2 rounded-xl border ${
                          isSelected
                            ? "bg-brand-600/20 border-brand-600"
                            : "bg-dark-800 border-dark-700"
                        }`}
                        onPress={() => {
                          setSelectedToken({
                            symbol: t.symbol || t.mint.slice(0, 4),
                            name: t.name || "Token",
                            mint: t.mint,
                            decimals: t.decimals,
                          })
                          setAmount("")
                          hapticLight()
                        }}
                      >
                        <Text className={`font-medium ${isSelected ? "text-brand-400" : "text-dark-300"}`}>
                          {t.symbol || t.mint.slice(0, 4)}
                        </Text>
                        <Text className="text-dark-500 text-xs">
                          {t.uiAmount.toFixed(t.decimals > 6 ? 4 : 2)}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Warning for transparent (base58) recipient with private-default */}
          {resolution.kind === "solana-address" &&
            defaultPrivacyLevel !== "transparent" && (
              <View className="mt-3 bg-yellow-900/20 border border-yellow-700/50 rounded-xl p-3">
                <View className="flex-row items-start gap-2">
                  <WarningIcon size={20} color={ICON_COLORS.warning} weight="fill" />
                  <Text className="text-yellow-400 text-sm flex-1">
                    For full privacy, ask the recipient for their stealth address
                    (sip:...) or use their .sol domain. Regular addresses can
                    still receive private transfers but with reduced privacy.
                  </Text>
                </View>
              </View>
            )}
        </View>
      </ScrollView>

      {/* NumpadInput: amount entry + CTA */}
      <NumpadInput
        token={selectedToken}
        balance={selectedBalance}
        onAmountChange={handleNumpadAmountChange}
        ctaLabel={ctaLabel}
        ctaDisabledLabel="Enter Amount"
        onCtaPress={handleReview}
        disabled={!isValidRecipient || !providerReady}
      />

      {/* Confirmation Modal */}
      <Modal
        visible={showConfirmModal}
        onClose={() => status === "idle" && setShowConfirmModal(false)}
        title="Confirm Transfer"
      >
        <View className="gap-4">
          {/* Amount Summary */}
          <View className="items-center py-4">
            <Text className="text-4xl font-bold text-white">{amount} {selectedToken.symbol}</Text>
            {isSOL && (
              <Text className="text-dark-400 mt-1">{formatUsdValue(amount, solPrice)}</Text>
            )}
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
            <View testID="transaction-progress" className="flex-row items-center justify-center gap-2 py-2">
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
              testID="confirm-send-button"
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
          <View testID="transaction-success" className="items-center py-6">
            <View className="w-20 h-20 bg-green-600/20 rounded-full items-center justify-center mb-4">
              <CheckCircleIcon size={48} color={ICON_COLORS.success} weight="fill" />
            </View>
            <Text className="text-2xl font-bold text-white">{amount} {selectedToken.symbol}</Text>
            <Text className="text-green-400 mt-1">Successfully sent!</Text>
          </View>

          {txHash && (
            <TouchableOpacity
              className="bg-dark-900 rounded-xl p-4 active:bg-dark-800"
              onPress={async () => {
                await Clipboard.setStringAsync(txHash)
                addToast({ title: "Copied!", type: "success" })
              }}
              accessibilityRole="button"
              accessibilityLabel="Copy transaction hash"
              accessibilityHint="Copies the transaction hash to clipboard"
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
