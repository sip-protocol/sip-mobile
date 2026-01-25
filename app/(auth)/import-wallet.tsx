/**
 * Import Wallet Screen
 *
 * Import existing wallet from:
 * - Seed phrase (12/24 words)
 * - Private key (base58)
 */

import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { useState } from "react"
import { Button, LoadingState } from "@/components/ui"
import { useNativeWallet } from "@/hooks"

type ImportMethod = "seed" | "privateKey"

export default function ImportWalletScreen() {
  const { importFromSeed, importFromPrivateKey, isLoading } =
    useNativeWallet()

  const [method, setMethod] = useState<ImportMethod>("seed")
  const [seedPhrase, setSeedPhrase] = useState("")
  const [privateKey, setPrivateKey] = useState("")
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  const handleImport = async () => {
    setImportError(null)
    setImporting(true)

    try {
      if (method === "seed") {
        // Validate seed phrase format
        const words = seedPhrase.trim().toLowerCase().split(/\s+/)
        if (words.length !== 12 && words.length !== 24) {
          throw new Error("Seed phrase must be 12 or 24 words")
        }
        await importFromSeed(seedPhrase)
      } else {
        // Validate private key format
        if (!privateKey.trim()) {
          throw new Error("Please enter a private key")
        }
        await importFromPrivateKey(privateKey)
      }

      // Success - navigate to home
      router.replace("/(tabs)")
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to import wallet"
      setImportError(message)
    } finally {
      setImporting(false)
    }
  }

  const handleBack = () => {
    router.back()
  }

  if (importing || isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-dark-950 items-center justify-center">
        <LoadingState message="Importing wallet..." />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-dark-950">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View className="px-6 pt-4">
            <TouchableOpacity onPress={handleBack} className="mb-4">
              <Text className="text-brand-500">← Back</Text>
            </TouchableOpacity>

            <Text className="text-2xl font-bold text-white mb-2">
              Import Wallet
            </Text>
            <Text className="text-dark-400 leading-5">
              Restore your wallet using your recovery phrase or private key.
            </Text>
          </View>

          {/* Method Selection */}
          <View className="px-6 mt-6">
            <View className="flex-row bg-dark-900 rounded-xl p-1">
              <TouchableOpacity
                onPress={() => setMethod("seed")}
                className={`flex-1 py-3 rounded-lg items-center ${
                  method === "seed" ? "bg-brand-600" : ""
                }`}
              >
                <Text
                  className={
                    method === "seed" ? "text-white font-medium" : "text-dark-400"
                  }
                >
                  Seed Phrase
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setMethod("privateKey")}
                className={`flex-1 py-3 rounded-lg items-center ${
                  method === "privateKey" ? "bg-brand-600" : ""
                }`}
              >
                <Text
                  className={
                    method === "privateKey"
                      ? "text-white font-medium"
                      : "text-dark-400"
                  }
                >
                  Private Key
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Input Area */}
          <View className="px-6 mt-6">
            {method === "seed" ? (
              <>
                <Text className="text-dark-400 mb-2">
                  Enter your 12 or 24 word recovery phrase
                </Text>
                <View className="bg-dark-900 rounded-xl border border-dark-800 p-4">
                  <TextInput
                    value={seedPhrase}
                    onChangeText={(text) => {
                      setSeedPhrase(text)
                      setImportError(null)
                    }}
                    placeholder="Enter your seed phrase..."
                    placeholderTextColor="#525252"
                    multiline
                    numberOfLines={4}
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="text-white font-mono text-base min-h-[100px]"
                    textAlignVertical="top"
                  />
                </View>
                <Text className="text-dark-600 text-sm mt-2">
                  Separate words with spaces
                </Text>
              </>
            ) : (
              <>
                <Text className="text-dark-400 mb-2">
                  Enter your private key (base58 or JSON array)
                </Text>
                <View className="bg-dark-900 rounded-xl border border-dark-800 p-4">
                  <TextInput
                    value={privateKey}
                    onChangeText={(text) => {
                      setPrivateKey(text)
                      setImportError(null)
                    }}
                    placeholder="Enter your private key..."
                    placeholderTextColor="#525252"
                    multiline
                    numberOfLines={3}
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="text-white font-mono text-base min-h-[80px]"
                    textAlignVertical="top"
                  />
                </View>
                <Text className="text-dark-600 text-sm mt-2">
                  Base58 encoded or JSON array format
                </Text>
              </>
            )}
          </View>

          {/* Error Message */}
          {importError && (
            <View className="mx-6 mt-4 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <Text className="text-red-400 text-center">{importError}</Text>
            </View>
          )}

          {/* Security Warning */}
          <View className="mx-6 mt-6 bg-dark-900 rounded-xl p-4 border border-dark-800">
            <View className="flex-row items-start">
              <Text className="text-lg mr-3">🔒</Text>
              <View className="flex-1">
                <Text className="text-white font-medium mb-1">
                  Secure Import
                </Text>
                <Text className="text-dark-400 text-sm leading-5">
                  Your recovery phrase is encrypted and stored locally. It never
                  leaves your device.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Import Button */}
        <View className="px-6 pb-8">
          <Button
            fullWidth
            size="lg"
            onPress={handleImport}
            disabled={
              (method === "seed" && !seedPhrase.trim()) ||
              (method === "privateKey" && !privateKey.trim())
            }
          >
            Import Wallet
          </Button>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
