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
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router, useLocalSearchParams } from "expo-router"
import { useState, useEffect, useMemo } from "react"
import { useWalletStore } from "@/stores/wallet"
import { useSwapStore } from "@/stores/swap"
import { useSettingsStore } from "@/stores/settings"
import { useToastStore } from "@/stores/toast"
import { useBiometrics } from "@/hooks/useBiometrics"
import { Button, Modal } from "@/components/ui"
import {
  TOKENS,
  POPULAR_TOKENS,
  getMockBalance,
  formatTokenAmount,
} from "@/data/tokens"
import type { TokenInfo, PrivacyLevel } from "@/types"

// ============================================================================
// TYPES
// ============================================================================

type SwapDirection = "from" | "to"

interface QuoteData {
  outputAmount: string
  minimumReceived: string
  priceImpact: number
  route: string[]
  networkFee: string
  isLoading: boolean
  error: string | null
}

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

// Mock quote calculation (will be replaced by useQuote hook)
function calculateMockQuote(
  fromToken: TokenInfo,
  toToken: TokenInfo,
  amount: string,
  slippage: number
): QuoteData {
  const inputAmount = parseFloat(amount) || 0
  if (inputAmount === 0) {
    return {
      outputAmount: "0",
      minimumReceived: "0",
      priceImpact: 0,
      route: [],
      networkFee: "0.000005",
      isLoading: false,
      error: null,
    }
  }

  // Mock price ratios
  const prices: Record<string, number> = {
    SOL: 185.5,
    USDC: 1.0,
    USDT: 1.0,
    BONK: 0.000025,
    JUP: 0.75,
    RAY: 2.1,
    PYTH: 0.35,
    WIF: 1.85,
    JTO: 2.8,
    ORCA: 3.5,
  }

  const fromPrice = prices[fromToken.symbol] || 1
  const toPrice = prices[toToken.symbol] || 1
  const outputAmount = (inputAmount * fromPrice) / toPrice
  const minimumReceived = outputAmount * (1 - slippage / 100)
  const priceImpact = inputAmount > 100 ? 0.15 : inputAmount > 10 ? 0.05 : 0.01

  return {
    outputAmount: outputAmount.toFixed(toToken.decimals > 6 ? 4 : 2),
    minimumReceived: minimumReceived.toFixed(toToken.decimals > 6 ? 4 : 2),
    priceImpact,
    route:
      fromToken.symbol === "SOL" || toToken.symbol === "SOL"
        ? [fromToken.symbol, toToken.symbol]
        : [fromToken.symbol, "SOL", toToken.symbol],
    networkFee: "0.000005",
    isLoading: false,
    error: null,
  }
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
  quote: QuoteData
  slippage: number
  fromToken: TokenInfo
  toToken: TokenInfo
}

function SwapDetails({ quote, slippage, fromToken, toToken }: SwapDetailsProps) {
  if (!quote.outputAmount || quote.outputAmount === "0") return null

  return (
    <View className="bg-dark-900 rounded-xl border border-dark-800 p-4 mt-4">
      <View className="flex-row justify-between items-center">
        <Text className="text-dark-400 text-sm">Rate</Text>
        <Text className="text-white text-sm">
          1 {fromToken.symbol} ≈{" "}
          {(parseFloat(quote.outputAmount) / parseFloat("1")).toFixed(4)}{" "}
          {toToken.symbol}
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
          {formatTokenAmount(quote.minimumReceived, toToken.decimals)}{" "}
          {toToken.symbol}
        </Text>
      </View>

      <View className="flex-row justify-between items-center mt-2">
        <Text className="text-dark-400 text-sm">Slippage</Text>
        <Text className="text-white text-sm">{slippage}%</Text>
      </View>

      <View className="flex-row justify-between items-center mt-2">
        <Text className="text-dark-400 text-sm">Network Fee</Text>
        <Text className="text-white text-sm">{quote.networkFee} SOL</Text>
      </View>

      {quote.route.length > 0 && (
        <View className="mt-3 pt-3 border-t border-dark-800">
          <Text className="text-dark-400 text-sm mb-2">Route</Text>
          <View className="flex-row items-center flex-wrap">
            {quote.route.map((hop, index) => (
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
  const params = useLocalSearchParams<{
    fromToken?: string
    toToken?: string
  }>()
  const { isConnected } = useWalletStore()
  const { isPreviewMode } = useSwapStore()
  const { slippage: storedSlippage } = useSettingsStore()
  const { addToast } = useToastStore()
  const { authenticateForOperation } = useBiometrics()

  // Token state
  const [fromToken, setFromToken] = useState<TokenInfo>(TOKENS.SOL)
  const [toToken, setToToken] = useState<TokenInfo>(TOKENS.USDC)
  const [fromAmount, setFromAmount] = useState("")

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

  // Settings state
  const [slippage, setSlippage] = useState(storedSlippage || DEFAULT_SLIPPAGE)
  const [privacyLevel, setPrivacyLevel] = useState<PrivacyLevel>("shielded")

  // Modal state
  const [showTokenSelector, setShowTokenSelector] = useState(false)
  const [tokenSelectorDirection, setTokenSelectorDirection] =
    useState<SwapDirection>("from")
  const [showSlippageModal, setShowSlippageModal] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  // Quote state
  const [isQuoteLoading, setIsQuoteLoading] = useState(false)
  const [quote, setQuote] = useState<QuoteData>({
    outputAmount: "0",
    minimumReceived: "0",
    priceImpact: 0,
    route: [],
    networkFee: "0.000005",
    isLoading: false,
    error: null,
  })

  // Get balances
  const fromBalance = getMockBalance(fromToken.symbol)
  const toBalance = getMockBalance(toToken.symbol)

  // Calculate quote when inputs change
  useEffect(() => {
    if (!fromAmount || parseFloat(fromAmount) === 0) {
      setQuote({
        outputAmount: "0",
        minimumReceived: "0",
        priceImpact: 0,
        route: [],
        networkFee: "0.000005",
        isLoading: false,
        error: null,
      })
      return
    }

    setIsQuoteLoading(true)

    // Simulate API delay
    const timer = setTimeout(() => {
      const newQuote = calculateMockQuote(fromToken, toToken, fromAmount, slippage)
      setQuote(newQuote)
      setIsQuoteLoading(false)
    }, 500)

    return () => clearTimeout(timer)
  }, [fromAmount, fromToken, toToken, slippage])

  // Calculate USD values
  const fromUsdValue = useMemo(() => {
    if (!fromAmount || !fromBalance?.usdValue) return 0
    const ratio = parseFloat(fromAmount) / parseFloat(fromBalance.balance)
    return fromBalance.usdValue * ratio
  }, [fromAmount, fromBalance])

  const toUsdValue = useMemo(() => {
    if (!quote.outputAmount || quote.outputAmount === "0") return 0
    if (!toBalance?.usdValue) return 0
    const ratio = parseFloat(quote.outputAmount) / parseFloat(toBalance.balance)
    return toBalance.usdValue * ratio
  }, [quote.outputAmount, toBalance])

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
    setFromAmount(quote.outputAmount !== "0" ? quote.outputAmount : "")
  }

  const handleSwap = async () => {
    if (!isConnected) {
      router.push("/(auth)/login")
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
    setShowConfirmModal(false)
    Keyboard.dismiss()

    addToast({
      type: "info",
      title: isPreviewMode() ? "Preview Mode" : "Swap Submitted",
      message: isPreviewMode()
        ? "Swap simulated successfully"
        : "Your swap is being processed",
    })

    // Reset form
    setFromAmount("")
  }

  const canSwap =
    fromAmount &&
    parseFloat(fromAmount) > 0 &&
    quote.outputAmount !== "0" &&
    !isQuoteLoading

  const insufficientBalance =
    fromBalance && parseFloat(fromAmount) > parseFloat(fromBalance.balance)

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
            <TouchableOpacity
              className="bg-dark-800 p-2 rounded-lg"
              onPress={() => setShowSlippageModal(true)}
            >
              <Text className="text-dark-400">⚙️</Text>
            </TouchableOpacity>
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
              <Text className="text-xl">↕️</Text>
            </TouchableOpacity>
          </View>

          {/* To Token */}
          <View className="-mt-3">
            <TokenInput
              direction="to"
              token={toToken}
              amount={quote.outputAmount}
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
                <Text className="text-2xl mr-3">
                  {privacyLevel === "shielded" ? "🔒" : "🔓"}
                </Text>
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
          <SwapDetails
            quote={quote}
            slippage={slippage}
            fromToken={fromToken}
            toToken={toToken}
          />

          {/* Error Messages */}
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
              <View className="flex-row items-center justify-center">
                <Text className="text-yellow-400 text-sm mr-2">⚠️</Text>
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
            const balance = getMockBalance(symbol)
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
            <Text className="text-yellow-400 text-sm mt-3">
              ⚠️ High slippage may result in unfavorable trades
            </Text>
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
                  {quote.outputAmount} {toToken.symbol}
                </Text>
              </View>
            </View>
          </View>

          <View className="bg-dark-800 rounded-xl p-4 my-4">
            <View className="flex-row justify-between mb-2">
              <Text className="text-dark-400">Rate</Text>
              <Text className="text-white">
                1 {fromToken.symbol} ={" "}
                {(parseFloat(quote.outputAmount) / parseFloat(fromAmount || "1")).toFixed(
                  4
                )}{" "}
                {toToken.symbol}
              </Text>
            </View>
            <View className="flex-row justify-between mb-2">
              <Text className="text-dark-400">Minimum Received</Text>
              <Text className="text-white">
                {quote.minimumReceived} {toToken.symbol}
              </Text>
            </View>
            <View className="flex-row justify-between mb-2">
              <Text className="text-dark-400">Network Fee</Text>
              <Text className="text-white">{quote.networkFee} SOL</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-dark-400">Privacy</Text>
              <Text
                className={
                  privacyLevel === "shielded" ? "text-brand-400" : "text-white"
                }
              >
                {privacyLevel === "shielded" ? "🔒 Shielded" : "🔓 Public"}
              </Text>
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
    </SafeAreaView>
  )
}
