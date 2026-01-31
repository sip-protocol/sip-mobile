/**
 * Swap Screen
 *
 * Private token swaps via Jupiter DEX:
 * - Token selection with balances
 * - Real-time quote display
 * - Privacy toggle (shielded/public)
 * - Slippage settings
 * - Route visualization
 */

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Keyboard,
  Linking,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router, useLocalSearchParams } from "expo-router"
import { useState, useEffect, useMemo, useCallback } from "react"
import {
  ArrowsClockwise,
  ArrowsDownUp,
  ChartBar,
  GearSix,
  LockSimple,
  LockSimpleOpen,
  Check,
  X,
  Warning,
} from "phosphor-react-native"
import { ICON_COLORS } from "@/constants/icons"
import { useWalletStore } from "@/stores/wallet"
import { useSwapStore } from "@/stores/swap"
import { useSettingsStore } from "@/stores/settings"
import { useToastStore } from "@/stores/toast"
import { getProviderInfo } from "@/privacy-providers"
import {
  useBiometrics,
  useQuote,
  useInsufficientBalance,
  useSwap,
  useBalance,
  useTokenPrices,
  getSwapStatusMessage,
  isSwapInProgress,
  isSwapComplete,
} from "@/hooks"
import { Button, Modal } from "@/components/ui"
import {
  TOKENS,
  POPULAR_TOKENS,
  formatTokenAmount,
} from "@/data/tokens"
import type { TokenInfo, PrivacyLevel, SwapQuote } from "@/types"

// ============================================================================
// TYPES
// ============================================================================

type SwapDirection = "from" | "to"

// ============================================================================
// CONSTANTS
// ============================================================================

const SLIPPAGE_OPTIONS = [0.1, 0.5, 1.0, 3.0]
const DEFAULT_SLIPPAGE = 0.5

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

function getNetworkDisplayName(network: "mainnet-beta" | "devnet" | "testnet"): string {
  switch (network) {
    case "mainnet-beta":
      return "Mainnet"
    case "devnet":
      return "Devnet"
    case "testnet":
      return "Testnet"
  }
}

// ============================================================================
// MAINNET ONLY OVERLAY
// ============================================================================

interface MainnetOnlyOverlayProps {
  network: "mainnet-beta" | "devnet" | "testnet"
  onSwitchNetwork: () => void
  onGoBack: () => void
}

function MainnetOnlyOverlay({ network, onSwitchNetwork, onGoBack }: MainnetOnlyOverlayProps) {
  return (
    <SafeAreaView className="flex-1 bg-dark-950">
      <View className="flex-1 items-center justify-center px-6">
        {/* Icon */}
        <View className="w-24 h-24 rounded-full bg-yellow-500/20 items-center justify-center mb-6">
          <ArrowsClockwise size={48} color={ICON_COLORS.warning} weight="regular" />
        </View>

        {/* Title */}
        <Text className="text-2xl font-bold text-white text-center mb-2">
          Swap Requires Mainnet
        </Text>

        {/* Current Network Badge */}
        <View className="bg-yellow-900/30 px-3 py-1 rounded-full mb-4">
          <Text className="text-yellow-400 text-sm">
            Currently on {getNetworkDisplayName(network)}
          </Text>
        </View>

        {/* Explanation */}
        <Text className="text-dark-400 text-center leading-6 mb-8">
          Jupiter DEX only has liquidity pools on Solana Mainnet.{"\n\n"}
          Token swaps cannot be executed on {getNetworkDisplayName(network)}.
        </Text>

        {/* Actions */}
        <View className="w-full gap-3">
          <Button fullWidth size="lg" onPress={onSwitchNetwork}>
            Switch to Mainnet
          </Button>
          <TouchableOpacity
            className="py-3 items-center"
            onPress={onGoBack}
          >
            <Text className="text-dark-400">Go Back</Text>
          </TouchableOpacity>
        </View>

        {/* Info */}
        <View className="mt-8 bg-dark-900 rounded-xl p-4 border border-dark-800 flex-row items-center justify-center gap-2">
          <Warning size={16} color={ICON_COLORS.warning} weight="fill" />
          <Text className="text-dark-500 text-sm text-center">
            You can still test Send, Receive, and Claim on {getNetworkDisplayName(network)}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  )
}

// ============================================================================
// COMPONENTS
// ============================================================================

interface TokenInputProps {
  direction: SwapDirection
  token: TokenInfo
  amount: string
  onAmountChange?: (amount: string) => void
  onTokenPress: () => void
  balance?: string
  usdValue?: number
  isOutput?: boolean
  isLoading?: boolean
}

function TokenInput({
  direction,
  token,
  amount,
  onAmountChange,
  onTokenPress,
  balance,
  usdValue,
  isOutput,
  isLoading,
}: TokenInputProps) {
  const handleMaxPress = () => {
    if (balance && onAmountChange) {
      onAmountChange(balance)
    }
  }

  return (
    <View className="bg-dark-900 rounded-2xl border border-dark-800 p-4">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-dark-500 text-sm">
          {direction === "from" ? "You pay" : "You receive"}
        </Text>
        {balance && (
          <View className="flex-row items-center">
            <Text className="text-dark-500 text-sm">
              Balance: {formatTokenAmount(balance, token.decimals)}
            </Text>
            {direction === "from" && onAmountChange && (
              <TouchableOpacity
                className="ml-2 bg-brand-900/30 px-2 py-0.5 rounded"
                onPress={handleMaxPress}
              >
                <Text className="text-brand-400 text-xs font-medium">MAX</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      <View className="flex-row items-center">
        <TouchableOpacity
          className="flex-row items-center bg-dark-800 rounded-xl px-3 py-2.5 mr-3"
          onPress={onTokenPress}
        >
          <Text className="text-2xl mr-2">{getTokenIcon(token.symbol)}</Text>
          <Text className="text-white font-semibold text-lg">{token.symbol}</Text>
          <Text className="text-dark-400 ml-2">▼</Text>
        </TouchableOpacity>

        <View className="flex-1">
          {isOutput ? (
            <View className="flex-row items-center justify-end">
              {isLoading ? (
                <ActivityIndicator size="small" color="#8b5cf6" />
              ) : (
                <Text
                  className={`text-2xl font-bold text-right ${
                    parseFloat(amount) > 0 ? "text-white" : "text-dark-500"
                  }`}
                >
                  {amount || "0.00"}
                </Text>
              )}
            </View>
          ) : (
            <TextInput
              className="text-2xl font-bold text-white text-right"
              placeholder="0.00"
              placeholderTextColor="#71717a"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={onAmountChange}
            />
          )}
        </View>
      </View>

      {usdValue !== undefined && usdValue > 0 && (
        <Text className="text-dark-500 text-sm text-right mt-2">
          ≈ ${usdValue.toLocaleString("en-US", { maximumFractionDigits: 2 })}
        </Text>
      )}
    </View>
  )
}

interface SwapDetailsProps {
  quote: SwapQuote | null
  slippage: number
}

function SwapDetails({ quote, slippage }: SwapDetailsProps) {
  if (!quote || !quote.outputAmount || quote.outputAmount === "0") return null

  const { inputToken, outputToken } = quote

  return (
    <View className="bg-dark-900 rounded-xl border border-dark-800 p-4 mt-4">
      <View className="flex-row justify-between items-center">
        <Text className="text-dark-400 text-sm">Rate</Text>
        <Text className="text-white text-sm">
          1 {inputToken.symbol} ≈{" "}
          {(parseFloat(quote.outputAmount) / parseFloat(quote.inputAmount || "1")).toFixed(4)}{" "}
          {outputToken.symbol}
        </Text>
      </View>

      <View className="flex-row justify-between items-center mt-2">
        <Text className="text-dark-400 text-sm">Price Impact</Text>
        <Text
          className={`text-sm ${
            quote.priceImpact > 1
              ? "text-red-400"
              : quote.priceImpact > 0.5
                ? "text-yellow-400"
                : "text-green-400"
          }`}
        >
          {quote.priceImpact.toFixed(2)}%
        </Text>
      </View>

      <View className="flex-row justify-between items-center mt-2">
        <Text className="text-dark-400 text-sm">Minimum Received</Text>
        <Text className="text-white text-sm">
          {formatTokenAmount(quote.minimumReceived, outputToken.decimals)}{" "}
          {outputToken.symbol}
        </Text>
      </View>

      <View className="flex-row justify-between items-center mt-2">
        <Text className="text-dark-400 text-sm">Slippage</Text>
        <Text className="text-white text-sm">{slippage}%</Text>
      </View>

      <View className="flex-row justify-between items-center mt-2">
        <Text className="text-dark-400 text-sm">Network Fee</Text>
        <Text className="text-white text-sm">{quote.fees.networkFee} SOL</Text>
      </View>

      {quote.route.length > 0 && (
        <View className="mt-3 pt-3 border-t border-dark-800">
          <Text className="text-dark-400 text-sm mb-2">Route</Text>
          <View className="flex-row items-center flex-wrap">
            {quote.route.map((hop: string, index: number) => (
              <View key={index} className="flex-row items-center">
                <View className="bg-dark-800 px-2 py-1 rounded">
                  <Text className="text-white text-sm">{hop}</Text>
                </View>
                {index < quote.route.length - 1 && (
                  <Text className="text-dark-600 mx-1">→</Text>
                )}
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SwapScreen() {
  // ============================================================================
  // ALL HOOKS MUST BE CALLED UNCONDITIONALLY (Rules of Hooks)
  // ============================================================================
  const params = useLocalSearchParams<{
    fromToken?: string
    toToken?: string
  }>()
  const { isConnected } = useWalletStore()
  const { isPreviewMode } = useSwapStore()
  const { slippage: storedSlippage, network, setNetwork, privacyProvider } = useSettingsStore()
  const providerInfo = getProviderInfo(privacyProvider)
  const { addToast } = useToastStore()
  const { authenticateForOperation } = useBiometrics()

  // Real balance from RPC (must be called unconditionally)
  const { balance: solBalance, tokenBalances, solPrice } = useBalance()

  // Token prices from Jupiter API (must be called unconditionally)
  const { getUsdValue } = useTokenPrices()

  // Token state
  const [fromToken, setFromToken] = useState<TokenInfo>(TOKENS.SOL)
  const [toToken, setToToken] = useState<TokenInfo>(TOKENS.USDC)
  const [fromAmount, setFromAmount] = useState("")

  // Settings state
  const [slippage, setSlippage] = useState(storedSlippage || DEFAULT_SLIPPAGE)
  const [privacyLevel, setPrivacyLevel] = useState<PrivacyLevel>("shielded")

  // Modal state
  const [showTokenSelector, setShowTokenSelector] = useState(false)
  const [tokenSelectorDirection, setTokenSelectorDirection] =
    useState<SwapDirection>("from")
  const [showSlippageModal, setShowSlippageModal] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showExecutingModal, setShowExecutingModal] = useState(false)
  const [showResultModal, setShowResultModal] = useState(false)

  // Swap execution hook
  const {
    status: swapStatus,
    txSignature,
    explorerUrl,
    error: swapError,
    execute: executeSwap,
    reset: resetSwap,
  } = useSwap()

  // Helper to get balance for a token symbol
  const getTokenBalance = useCallback(
    (symbol: string): { balance: string; usdValue: number } | undefined => {
      if (!isConnected) return undefined

      if (symbol === "SOL") {
        return {
          balance: solBalance.toFixed(4),
          usdValue: solBalance * solPrice,
        }
      }

      // Find SPL token by mint
      const tokenInfo = TOKENS[symbol]
      if (!tokenInfo) return undefined

      const tokenBalance = tokenBalances.find((t) => t.mint === tokenInfo.mint)
      if (!tokenBalance) return { balance: "0", usdValue: 0 }

      // Calculate USD value using Jupiter prices
      const usdValue = getUsdValue(symbol, tokenBalance.uiAmount)

      return {
        balance: tokenBalance.uiAmount.toString(),
        usdValue,
      }
    },
    [isConnected, solBalance, solPrice, tokenBalances, getUsdValue]
  )

  // Handle token selection from params (full-screen selector)
  useEffect(() => {
    if (params.fromToken && TOKENS[params.fromToken]) {
      const newToken = TOKENS[params.fromToken]
      if (newToken.symbol === toToken.symbol) {
        setToToken(fromToken) // Swap if same
      }
      setFromToken(newToken)
    }
  }, [params.fromToken])

  useEffect(() => {
    if (params.toToken && TOKENS[params.toToken]) {
      const newToken = TOKENS[params.toToken]
      if (newToken.symbol === fromToken.symbol) {
        setFromToken(toToken) // Swap if same
      }
      setToToken(newToken)
    }
  }, [params.toToken])

  // Quote hook - handles fetching, auto-refresh, and freshness tracking
  const quoteParams = useMemo(
    () =>
      fromAmount && parseFloat(fromAmount) > 0
        ? {
            fromToken,
            toToken,
            amount: fromAmount,
            slippage,
            privacyLevel,
          }
        : null,
    [fromToken, toToken, fromAmount, slippage, privacyLevel]
  )
  const {
    quote,
    isLoading: isQuoteLoading,
    error: quoteError,
    freshness,
    expiresIn,
    jupiterQuote,
    refresh: refreshQuote,
  } = useQuote(quoteParams)

  // Insufficient balance check
  const insufficientBalance = useInsufficientBalance(fromToken.symbol, fromAmount)

  // Get balances
  const fromBalance = getTokenBalance(fromToken.symbol)
  const toBalance = getTokenBalance(toToken.symbol)

  // Calculate USD values
  const fromUsdValue = useMemo(() => {
    if (!fromAmount || !fromBalance?.usdValue) return 0
    const ratio = parseFloat(fromAmount) / parseFloat(fromBalance.balance)
    return fromBalance.usdValue * ratio
  }, [fromAmount, fromBalance])

  const toUsdValue = useMemo(() => {
    if (!quote?.outputAmount || quote.outputAmount === "0") return 0
    if (!toBalance?.usdValue) return 0
    const ratio = parseFloat(quote.outputAmount) / parseFloat(toBalance.balance)
    return toBalance.usdValue * ratio
  }, [quote?.outputAmount, toBalance])

  // ============================================================================
  // EARLY RETURNS (after all hooks)
  // ============================================================================

  // Check if on mainnet - swap only works on mainnet
  const isMainnet = network === "mainnet-beta"

  // Show mainnet-only overlay if not on mainnet
  if (!isMainnet) {
    return (
      <MainnetOnlyOverlay
        network={network}
        onSwitchNetwork={() => setNetwork("mainnet-beta")}
        onGoBack={() => router.back()}
      />
    )
  }

  const handleTokenPress = (direction: SwapDirection) => {
    setTokenSelectorDirection(direction)
    setShowTokenSelector(true)
  }

  const handleTokenSelect = (token: TokenInfo) => {
    if (tokenSelectorDirection === "from") {
      if (token.symbol === toToken.symbol) {
        // Swap tokens
        setToToken(fromToken)
      }
      setFromToken(token)
    } else {
      if (token.symbol === fromToken.symbol) {
        // Swap tokens
        setFromToken(toToken)
      }
      setToToken(token)
    }
    setShowTokenSelector(false)
  }

  const handleSwapDirection = () => {
    const tempToken = fromToken
    setFromToken(toToken)
    setToToken(tempToken)
    const outputAmount = quote?.outputAmount
    setFromAmount(outputAmount && outputAmount !== "0" ? outputAmount : "")
  }

  const handleSwap = async () => {
    if (!isConnected) {
      router.push("/(auth)/wallet-setup")
      return
    }

    // Authenticate if needed
    const authResult = await authenticateForOperation("send")
    if (!authResult.success) {
      if (!authResult.cancelled) {
        addToast({
          type: "error",
          title: "Authentication required",
          message: authResult.error,
        })
      }
      return
    }

    setShowConfirmModal(true)
  }

  const confirmSwap = async () => {
    if (!quote || !jupiterQuote) return

    setShowConfirmModal(false)
    setShowExecutingModal(true)
    Keyboard.dismiss()

    // Execute the swap
    const success = await executeSwap({
      quote,
      jupiterQuote,
      privacyLevel,
    })

    // Show result modal
    setShowExecutingModal(false)
    setShowResultModal(true)

    // Reset form on success
    if (success) {
      setFromAmount("")
    }
  }

  const handleResultClose = () => {
    setShowResultModal(false)
    resetSwap()
  }

  const handleViewExplorer = async () => {
    if (explorerUrl) {
      try {
        await Linking.openURL(explorerUrl)
      } catch {
        addToast({
          type: "error",
          title: "Cannot Open Explorer",
          message: "Unable to open the transaction link",
        })
      }
    }
  }

  const canSwap =
    fromAmount &&
    parseFloat(fromAmount) > 0 &&
    quote?.outputAmount &&
    quote.outputAmount !== "0" &&
    !isQuoteLoading

  return (
    <SafeAreaView className="flex-1 bg-dark-950">
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="px-4 pt-6 pb-8">
          {/* Header */}
          <View className="flex-row items-center justify-between mb-6">
            <View>
              <Text className="text-3xl font-bold text-white">Swap</Text>
              <Text className="text-dark-400 mt-1">
                Swap tokens {privacyLevel === "shielded" ? "privately" : ""} via
                Jupiter
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <TouchableOpacity
                className="bg-dark-800 p-2 rounded-lg"
                onPress={() => router.push("/swap/history")}
              >
                <ChartBar size={20} color={ICON_COLORS.muted} weight="regular" />
              </TouchableOpacity>
              <TouchableOpacity
                className="bg-dark-800 p-2 rounded-lg"
                onPress={() => setShowSlippageModal(true)}
              >
                <GearSix size={20} color={ICON_COLORS.muted} weight="regular" />
              </TouchableOpacity>
            </View>
          </View>

          {/* From Token */}
          <TokenInput
            direction="from"
            token={fromToken}
            amount={fromAmount}
            onAmountChange={setFromAmount}
            onTokenPress={() => handleTokenPress("from")}
            balance={fromBalance?.balance}
            usdValue={fromUsdValue}
          />

          {/* Swap Direction Button */}
          <View className="items-center my-3 z-10">
            <TouchableOpacity
              className="bg-dark-800 border-4 border-dark-950 rounded-xl p-2"
              onPress={handleSwapDirection}
            >
              <ArrowsDownUp size={24} color={ICON_COLORS.white} weight="bold" />
            </TouchableOpacity>
          </View>

          {/* To Token */}
          <View className="-mt-3">
            <TokenInput
              direction="to"
              token={toToken}
              amount={quote?.outputAmount ?? "0"}
              onTokenPress={() => handleTokenPress("to")}
              balance={toBalance?.balance}
              usdValue={toUsdValue}
              isOutput
              isLoading={isQuoteLoading}
            />
          </View>

          {/* Privacy Toggle */}
          <TouchableOpacity
            className={`mt-4 p-4 rounded-xl border ${
              privacyLevel === "shielded"
                ? "bg-brand-900/20 border-brand-700"
                : "bg-dark-900 border-dark-800"
            }`}
            onPress={() =>
              setPrivacyLevel(
                privacyLevel === "shielded" ? "transparent" : "shielded"
              )
            }
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <View className="mr-3">
                  {privacyLevel === "shielded" ? (
                    <LockSimple size={28} color={ICON_COLORS.brand} weight="fill" />
                  ) : (
                    <LockSimpleOpen size={28} color={ICON_COLORS.muted} weight="regular" />
                  )}
                </View>
                <View>
                  <Text
                    className={`font-medium ${
                      privacyLevel === "shielded" ? "text-brand-400" : "text-white"
                    }`}
                  >
                    {privacyLevel === "shielded" ? "Private Swap" : "Public Swap"}
                  </Text>
                  <Text className="text-dark-500 text-xs">
                    {privacyLevel === "shielded"
                      ? "Amounts hidden via stealth routing"
                      : "Visible on-chain"}
                  </Text>
                </View>
              </View>
              <View
                className={`w-12 h-7 rounded-full justify-center px-1 ${
                  privacyLevel === "shielded" ? "bg-brand-600" : "bg-dark-700"
                }`}
              >
                <View
                  className={`w-5 h-5 bg-white rounded-full ${
                    privacyLevel === "shielded" ? "self-end" : "self-start"
                  }`}
                />
              </View>
            </View>
          </TouchableOpacity>

          {/* Swap Details */}
          <SwapDetails quote={quote} slippage={slippage} />

          {/* Quote Freshness Indicator */}
          {quote && (
            <View className="flex-row items-center justify-between mt-3">
              <View className="flex-row items-center">
                <View
                  className={`w-2 h-2 rounded-full mr-2 ${
                    freshness === "fresh"
                      ? "bg-green-500"
                      : freshness === "stale"
                        ? "bg-yellow-500"
                        : "bg-red-500"
                  }`}
                />
                <Text className="text-dark-500 text-xs">
                  {freshness === "fresh"
                    ? "Quote fresh"
                    : freshness === "stale"
                      ? "Quote stale"
                      : "Quote expired"}
                  {expiresIn !== null && expiresIn > 0 && ` (${expiresIn}s)`}
                </Text>
              </View>
              <TouchableOpacity
                onPress={refreshQuote}
                disabled={isQuoteLoading}
                className="px-3 py-1 bg-dark-800 rounded-lg"
              >
                <Text className="text-dark-400 text-xs">
                  {isQuoteLoading ? "Loading..." : "Refresh"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Quote Error */}
          {quoteError && (
            <View className="mt-4 bg-red-900/20 border border-red-700 rounded-xl p-3">
              <Text className="text-red-400 text-sm text-center">{quoteError}</Text>
            </View>
          )}

          {/* Insufficient Balance Error */}
          {insufficientBalance && (
            <View className="mt-4 bg-red-900/20 border border-red-700 rounded-xl p-3">
              <Text className="text-red-400 text-sm text-center">
                Insufficient {fromToken.symbol} balance
              </Text>
            </View>
          )}

          {/* Preview Mode Banner */}
          {isPreviewMode() && (
            <View className="mt-4 bg-yellow-900/20 border border-yellow-700 rounded-xl p-3">
              <View className="flex-row items-center justify-center gap-2">
                <Warning size={18} color={ICON_COLORS.warning} weight="fill" />
                <Text className="text-yellow-400 text-sm">
                  Preview Mode — No real transactions
                </Text>
              </View>
            </View>
          )}

          {/* Swap Button */}
          <View className="mt-6">
            <Button
              fullWidth
              size="lg"
              onPress={handleSwap}
              disabled={!canSwap || insufficientBalance}
            >
              {!isConnected
                ? "Connect Wallet"
                : insufficientBalance
                  ? `Insufficient ${fromToken.symbol}`
                  : !fromAmount
                    ? "Enter Amount"
                    : isQuoteLoading
                      ? "Getting Quote..."
                      : privacyLevel === "shielded"
                        ? "Swap Privately"
                        : "Swap"}
            </Button>
          </View>

          {/* Powered By */}
          <Text className="text-dark-600 text-xs text-center mt-4">
            Powered by Jupiter Aggregator
          </Text>
        </View>
      </ScrollView>

      {/* Token Selector Modal */}
      <Modal
        visible={showTokenSelector}
        onClose={() => setShowTokenSelector(false)}
        title={`Select ${tokenSelectorDirection === "from" ? "Input" : "Output"} Token`}
      >
        <View className="gap-2">
          <Text className="text-dark-400 text-sm mb-2">Popular tokens</Text>
          {POPULAR_TOKENS.map((symbol) => {
            const token = TOKENS[symbol]
            const balance = getTokenBalance(symbol)
            const isSelected =
              tokenSelectorDirection === "from"
                ? fromToken.symbol === symbol
                : toToken.symbol === symbol

            return (
              <TouchableOpacity
                key={symbol}
                className={`flex-row items-center p-3 rounded-xl ${
                  isSelected ? "bg-brand-900/30 border border-brand-700" : "bg-dark-800"
                }`}
                onPress={() => handleTokenSelect(token)}
              >
                <Text className="text-2xl mr-3">{getTokenIcon(symbol)}</Text>
                <View className="flex-1">
                  <Text className="text-white font-medium">{token.symbol}</Text>
                  <Text className="text-dark-500 text-sm">{token.name}</Text>
                </View>
                {balance && (
                  <Text className="text-dark-400">
                    {formatTokenAmount(balance.balance, token.decimals)}
                  </Text>
                )}
              </TouchableOpacity>
            )
          })}
          <TouchableOpacity
            className="mt-2 py-3 items-center"
            onPress={() => {
              setShowTokenSelector(false)
              const selected = tokenSelectorDirection === "from" ? fromToken.symbol : toToken.symbol
              router.push({
                pathname: "/swap/tokens",
                params: { direction: tokenSelectorDirection, selected },
              })
            }}
          >
            <Text className="text-brand-400">View all tokens →</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Slippage Modal */}
      <Modal
        visible={showSlippageModal}
        onClose={() => setShowSlippageModal(false)}
        title="Swap Settings"
      >
        <View>
          <Text className="text-dark-400 text-sm mb-3">Slippage Tolerance</Text>
          <View className="flex-row gap-2 mb-4">
            {SLIPPAGE_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option}
                className={`flex-1 py-2 rounded-lg ${
                  slippage === option ? "bg-brand-600" : "bg-dark-800"
                }`}
                onPress={() => setSlippage(option)}
              >
                <Text
                  className={`text-center font-medium ${
                    slippage === option ? "text-white" : "text-dark-400"
                  }`}
                >
                  {option}%
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View className="bg-dark-800 rounded-xl p-4">
            <View className="flex-row items-center">
              <TextInput
                className="flex-1 text-white text-lg"
                placeholder="Custom"
                placeholderTextColor="#71717a"
                keyboardType="decimal-pad"
                value={
                  SLIPPAGE_OPTIONS.includes(slippage) ? "" : slippage.toString()
                }
                onChangeText={(text) => {
                  const val = parseFloat(text)
                  if (!isNaN(val) && val >= 0 && val <= 50) {
                    setSlippage(val)
                  }
                }}
              />
              <Text className="text-dark-400">%</Text>
            </View>
          </View>

          {slippage > 5 && (
            <View className="flex-row items-center gap-2 mt-3">
              <Warning size={16} color={ICON_COLORS.warning} weight="fill" />
              <Text className="text-yellow-400 text-sm">
                High slippage may result in unfavorable trades
              </Text>
            </View>
          )}

          <Button
            fullWidth
            style={{ marginTop: 16 }}
            onPress={() => setShowSlippageModal(false)}
          >
            Done
          </Button>
        </View>
      </Modal>

      {/* Confirm Swap Modal */}
      <Modal
        visible={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Confirm Swap"
      >
        <View>
          <View className="items-center py-4">
            <View className="flex-row items-center">
              <View className="items-center">
                <Text className="text-3xl">{getTokenIcon(fromToken.symbol)}</Text>
                <Text className="text-white font-bold text-lg mt-2">
                  {fromAmount} {fromToken.symbol}
                </Text>
              </View>
              <Text className="text-dark-500 text-2xl mx-6">→</Text>
              <View className="items-center">
                <Text className="text-3xl">{getTokenIcon(toToken.symbol)}</Text>
                <Text className="text-green-400 font-bold text-lg mt-2">
                  {quote?.outputAmount ?? "0"} {toToken.symbol}
                </Text>
              </View>
            </View>
          </View>

          <View className="bg-dark-800 rounded-xl p-4 my-4">
            <View className="flex-row justify-between mb-2">
              <Text className="text-dark-400">Rate</Text>
              <Text className="text-white">
                1 {fromToken.symbol} ={" "}
                {(parseFloat(quote?.outputAmount ?? "1") / parseFloat(fromAmount || "1")).toFixed(
                  4
                )}{" "}
                {toToken.symbol}
              </Text>
            </View>
            <View className="flex-row justify-between mb-2">
              <Text className="text-dark-400">Minimum Received</Text>
              <Text className="text-white">
                {quote?.minimumReceived ?? "0"} {toToken.symbol}
              </Text>
            </View>
            <View className="flex-row justify-between mb-2">
              <Text className="text-dark-400">Network Fee</Text>
              <Text className="text-white">{quote?.fees.networkFee ?? "0.000005"} SOL</Text>
            </View>
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-dark-400">Privacy</Text>
              <View className="flex-row items-center gap-1">
                {privacyLevel === "shielded" ? (
                  <LockSimple size={16} color={ICON_COLORS.brand} weight="fill" />
                ) : (
                  <LockSimpleOpen size={16} color={ICON_COLORS.white} weight="regular" />
                )}
                <Text
                  className={
                    privacyLevel === "shielded" ? "text-brand-400" : "text-white"
                  }
                >
                  {privacyLevel === "shielded" ? "Shielded" : "Public"}
                </Text>
              </View>
            </View>
            <View className="flex-row justify-between items-center">
              <Text className="text-dark-400">Provider</Text>
              <View className="flex-row items-center">
                <Text className="text-white">{providerInfo?.name || 'SIP Native'}</Text>
                {providerInfo?.status === 'coming-soon' && (
                  <View className="ml-2 px-1.5 py-0.5 bg-yellow-900/30 rounded">
                    <Text className="text-yellow-400 text-xs">Soon</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          <View className="flex-row gap-3">
            <TouchableOpacity
              className="flex-1 bg-dark-800 py-3 rounded-xl items-center"
              onPress={() => setShowConfirmModal(false)}
            >
              <Text className="text-white font-medium">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 bg-brand-600 py-3 rounded-xl items-center"
              onPress={confirmSwap}
            >
              <Text className="text-white font-medium">Confirm Swap</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Executing Modal */}
      <Modal
        visible={showExecutingModal}
        onClose={() => {}}
        title=""
      >
        <View className="items-center py-8">
          <ActivityIndicator size="large" color="#8b5cf6" />
          <Text className="text-white text-xl font-semibold mt-6">
            {getSwapStatusMessage(swapStatus, privacyLevel === "shielded")}
          </Text>
          <Text className="text-dark-400 text-center mt-2 px-4">
            {swapStatus === "signing"
              ? "Please approve the transaction in your wallet"
              : swapStatus === "submitting"
                ? privacyLevel === "shielded"
                  ? "Generating privacy proofs and submitting..."
                  : "Submitting transaction to the network..."
                : "Preparing your swap..."}
          </Text>

          {/* Progress indicator */}
          <View className="flex-row items-center mt-8 gap-2">
            <View
              className={`h-2 w-8 rounded-full ${
                isSwapInProgress(swapStatus) || isSwapComplete(swapStatus)
                  ? "bg-brand-500"
                  : "bg-dark-700"
              }`}
            />
            <View
              className={`h-2 w-8 rounded-full ${
                swapStatus === "signing" ||
                swapStatus === "submitting" ||
                isSwapComplete(swapStatus)
                  ? "bg-brand-500"
                  : "bg-dark-700"
              }`}
            />
            <View
              className={`h-2 w-8 rounded-full ${
                swapStatus === "submitting" || isSwapComplete(swapStatus)
                  ? "bg-brand-500"
                  : "bg-dark-700"
              }`}
            />
          </View>
        </View>
      </Modal>

      {/* Result Modal */}
      <Modal
        visible={showResultModal}
        onClose={handleResultClose}
        title={swapStatus === "success" ? "Swap Complete" : "Swap Failed"}
      >
        <View className="items-center py-4">
          {swapStatus === "success" ? (
            <>
              <View className="w-20 h-20 rounded-full bg-green-500/20 items-center justify-center mb-4">
                <Check size={48} color={ICON_COLORS.success} weight="bold" />
              </View>
              <Text className="text-white text-xl font-semibold text-center">
                Successfully swapped!
              </Text>
              <View className="flex-row items-center mt-2">
                <Text className="text-dark-400">
                  {fromAmount} {fromToken.symbol}
                </Text>
                <Text className="text-dark-500 mx-2">→</Text>
                <Text className="text-green-400">
                  {quote?.outputAmount ?? "0"} {toToken.symbol}
                </Text>
              </View>

              {privacyLevel === "shielded" && (
                <View className="bg-brand-900/30 px-3 py-1.5 rounded-full mt-3 flex-row items-center gap-1">
                  <LockSimple size={14} color={ICON_COLORS.brand} weight="fill" />
                  <Text className="text-brand-400 text-sm">Private Swap</Text>
                </View>
              )}

              {txSignature && (
                <View className="w-full mt-6 px-4">
                  <Text className="text-dark-500 text-sm mb-1">Transaction</Text>
                  <Text className="text-dark-400 text-xs font-mono">
                    {txSignature.slice(0, 20)}...{txSignature.slice(-20)}
                  </Text>
                </View>
              )}
            </>
          ) : (
            <>
              <View className="w-20 h-20 rounded-full bg-red-500/20 items-center justify-center mb-4">
                <X size={48} color={ICON_COLORS.error} weight="bold" />
              </View>
              <Text className="text-white text-xl font-semibold text-center">
                Swap Failed
              </Text>
              <Text className="text-red-400 text-center mt-2 px-4">
                {swapError || "An unexpected error occurred"}
              </Text>
            </>
          )}

          <View className="w-full mt-6 gap-3">
            {swapStatus === "success" && txSignature && (
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
              className={`py-3 rounded-xl items-center ${
                swapStatus === "success" ? "bg-brand-600" : "bg-dark-800"
              }`}
              onPress={handleResultClose}
            >
              <Text className="text-white font-medium">
                {swapStatus === "success" ? "Done" : "Close"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}
