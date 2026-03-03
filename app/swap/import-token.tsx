/**
 * Import Custom Token Screen
 *
 * Allows users to import custom SPL tokens by entering the mint address.
 * Fetches token metadata from chain and adds to custom tokens list.
 */

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { ArrowLeftIcon } from "phosphor-react-native"
import { ICON_COLORS } from "@/constants/icons"
import { useState, useCallback } from "react"
import { useSettingsStore } from "@/stores/settings"
import { useCustomTokensStore } from "@/stores/customTokens"
import { toast } from "@/stores/toast"
import { fetchTokenMetadata, isValidSolanaAddress } from "@/lib/tokenMetadata"
import { getTokenByMint } from "@/data/tokens"
import type { TokenInfo } from "@/types"
import type { RpcConfig } from "@/lib/rpc"

// ============================================================================
// COMPONENTS
// ============================================================================

interface TokenPreviewProps {
  token: TokenInfo
  onImport: () => void
  isImporting: boolean
}

function TokenPreview({ token, onImport, isImporting }: TokenPreviewProps) {
  return (
    <View className="bg-dark-900 rounded-xl p-4 border border-dark-800">
      <View className="flex-row items-center mb-4">
        {/* Token Icon */}
        <View className="w-12 h-12 bg-dark-800 rounded-full items-center justify-center mr-3">
          <Text className="text-2xl">🪙</Text>
        </View>

        {/* Token Info */}
        <View className="flex-1">
          <Text className="text-white font-bold text-lg">{token.symbol}</Text>
          <Text className="text-dark-400 text-sm">{token.name}</Text>
        </View>
      </View>

      {/* Token Details */}
      <View className="gap-2 mb-4">
        <View className="flex-row justify-between">
          <Text className="text-dark-500">Decimals</Text>
          <Text className="text-white">{token.decimals}</Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-dark-500">Mint Address</Text>
          <Text className="text-dark-300 text-xs" numberOfLines={1}>
            {token.mint.slice(0, 8)}...{token.mint.slice(-8)}
          </Text>
        </View>
      </View>

      {/* Import Button */}
      <TouchableOpacity
        className={`py-3 rounded-xl items-center ${
          isImporting ? "bg-brand-600/50" : "bg-brand-600"
        }`}
        onPress={onImport}
        disabled={isImporting}
      >
        {isImporting ? (
          <ActivityIndicator color="white" size="small" />
        ) : (
          <Text className="text-white font-semibold">Import Token</Text>
        )}
      </TouchableOpacity>
    </View>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ImportTokenScreen() {
  const { rpcProvider, network, heliusApiKey, quicknodeApiKey, tritonEndpoint } = useSettingsStore()
  const { addToken, hasToken } = useCustomTokensStore()

  const [address, setAddress] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewToken, setPreviewToken] = useState<TokenInfo | null>(null)
  const [isImporting, setIsImporting] = useState(false)

  // Build RPC config
  const rpcConfig: RpcConfig = {
    provider: rpcProvider as "helius" | "quicknode" | "triton" | "publicnode",
    cluster: network as "mainnet-beta" | "devnet" | "testnet",
    apiKey: rpcProvider === "helius" ? heliusApiKey || undefined :
            rpcProvider === "quicknode" ? quicknodeApiKey || undefined : undefined,
    customEndpoint: rpcProvider === "triton" ? tritonEndpoint || undefined : undefined,
  }

  const handleSearch = useCallback(async () => {
    const trimmedAddress = address.trim()

    // Reset state
    setError(null)
    setPreviewToken(null)

    // Validate input
    if (!trimmedAddress) {
      setError("Please enter a token address")
      return
    }

    if (!isValidSolanaAddress(trimmedAddress)) {
      setError("Invalid Solana address format")
      return
    }

    // Check if already in default tokens
    const existingToken = getTokenByMint(trimmedAddress)
    if (existingToken) {
      setError(`${existingToken.symbol} is already in the default token list`)
      return
    }

    // Check if already imported
    if (hasToken(trimmedAddress)) {
      setError("Token already imported")
      return
    }

    Keyboard.dismiss()
    setIsLoading(true)

    try {
      const result = await fetchTokenMetadata(trimmedAddress, rpcConfig)

      if (!result.success || !result.token) {
        setError(result.error || "Failed to fetch token")
        return
      }

      setPreviewToken(result.token)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch token")
    } finally {
      setIsLoading(false)
    }
  }, [address, rpcConfig, hasToken])

  const handleImport = useCallback(async () => {
    if (!previewToken) return

    setIsImporting(true)

    try {
      const success = addToken(previewToken)

      if (success) {
        toast.success("Token Imported", `${previewToken.symbol} added to your token list`)
        router.back()
      } else {
        setError("Failed to import token. You may have reached the maximum limit.")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import token")
    } finally {
      setIsImporting(false)
    }
  }, [previewToken, addToken])

  const handleAddressChange = useCallback((text: string) => {
    setAddress(text)
    setError(null)
    setPreviewToken(null)
  }, [])

  return (
    <SafeAreaView className="flex-1 bg-dark-950">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center px-4 py-3 border-b border-dark-900">
          <TouchableOpacity
            className="p-2 -ml-2"
            onPress={() => router.back()}
          >
            <ArrowLeftIcon size={24} color={ICON_COLORS.white} weight="bold" />
          </TouchableOpacity>
          <Text className="flex-1 text-xl font-bold text-white text-center mr-8">
            Import Token
          </Text>
        </View>

        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16 }}
        >
          {/* Instructions */}
          <View className="mb-6">
            <Text className="text-dark-400 text-sm">
              Enter the token's mint address to import it. The token must exist on{" "}
              {network === "mainnet-beta" ? "Mainnet" : network}.
            </Text>
          </View>

          {/* Address Input */}
          <View className="mb-4">
            <Text className="text-dark-300 text-sm font-medium mb-2">
              Token Mint Address
            </Text>
            <View className="flex-row items-center bg-dark-900 border border-dark-800 rounded-xl px-4">
              <TextInput
                className="flex-1 py-4 text-white text-base"
                placeholder="Enter mint address..."
                placeholderTextColor="#71717a"
                value={address}
                onChangeText={handleAddressChange}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={handleSearch}
              />
              {address.length > 0 && (
                <TouchableOpacity onPress={() => handleAddressChange("")}>
                  <Text className="text-dark-500 text-lg">✕</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Search Button */}
          <TouchableOpacity
            className={`py-4 rounded-xl items-center mb-6 ${
              isLoading || !address.trim()
                ? "bg-dark-800"
                : "bg-brand-600"
            }`}
            onPress={handleSearch}
            disabled={isLoading || !address.trim()}
          >
            {isLoading ? (
              <View className="flex-row items-center">
                <ActivityIndicator color="white" size="small" />
                <Text className="text-white font-semibold ml-2">
                  Fetching token...
                </Text>
              </View>
            ) : (
              <Text
                className={`font-semibold ${
                  !address.trim() ? "text-dark-500" : "text-white"
                }`}
              >
                Search Token
              </Text>
            )}
          </TouchableOpacity>

          {/* Error Message */}
          {error && (
            <View className="mb-6 p-4 bg-red-900/20 border border-red-800 rounded-xl">
              <Text className="text-red-400 text-center">{error}</Text>
            </View>
          )}

          {/* Token Preview */}
          {previewToken && (
            <TokenPreview
              token={previewToken}
              onImport={handleImport}
              isImporting={isImporting}
            />
          )}

          {/* Tips */}
          {!previewToken && !isLoading && (
            <View className="mt-4 p-4 bg-dark-900/50 rounded-xl">
              <Text className="text-dark-400 text-sm font-medium mb-2">
                Tips:
              </Text>
              <Text className="text-dark-500 text-sm">
                • Find the mint address on Solscan or Solana Explorer{"\n"}
                • Make sure you're on the correct network{"\n"}
                • Only SPL tokens are supported
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
