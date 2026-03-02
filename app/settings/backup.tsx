/**
 * Backup Wallet Screen
 *
 * View and backup recovery phrase (requires biometric authentication)
 */

import { View, Text, TouchableOpacity, Alert } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { useState } from "react"
import { Button, LoadingState } from "@/components/ui"
import { useNativeWallet } from "@/hooks"
import { copyToClipboardSecure, clearClipboard } from "@/utils/security"
import {
  ArrowLeftIcon,
  WarningIcon,
  LockKeyIcon,
  CopySimpleIcon,
  CheckIcon,
  DeviceMobileCameraIcon,
} from "phosphor-react-native"
import { ICON_COLORS } from "@/constants/icons"

export default function BackupWalletScreen() {
  const { wallet, exportMnemonic, isLoading } = useNativeWallet()

  const [mnemonic, setMnemonic] = useState<string[] | null>(null)
  const [revealing, setRevealing] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleReveal = async () => {
    setRevealing(true)
    try {
      const phrase = await exportMnemonic()
      if (phrase) {
        setMnemonic(phrase.split(" "))
      } else {
        Alert.alert(
          "No Recovery Phrase",
          "This wallet was imported with a private key and doesn't have a recovery phrase."
        )
      }
    } catch (err) {
      Alert.alert("Authentication Failed", "Please try again.")
    } finally {
      setRevealing(false)
    }
  }

  const handleCopy = async () => {
    if (mnemonic) {
      // Use secure clipboard with 60-second auto-clear
      await copyToClipboardSecure(mnemonic.join(" "))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleHide = async () => {
    // Clear clipboard when hiding mnemonic
    await clearClipboard()
    setMnemonic(null)
  }

  const handleBack = () => {
    router.back()
  }

  if (!wallet) {
    return (
      <SafeAreaView className="flex-1 bg-dark-950 items-center justify-center px-6">
        <Text className="text-dark-400 text-center">
          No wallet found. Please create or import a wallet first.
        </Text>
        <Button className="mt-4" onPress={() => router.push("/wallet-setup")}>
          Set Up Wallet
        </Button>
      </SafeAreaView>
    )
  }

  if (revealing || isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-dark-950 items-center justify-center">
        <LoadingState message="Authenticating..." />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-dark-950">
      {/* Header */}
      <View className="px-6 pt-4">
        <TouchableOpacity onPress={handleBack} className="mb-4 flex-row items-center">
          <ArrowLeftIcon size={20} color={ICON_COLORS.brand} weight="bold" />
          <Text className="text-brand-500 ml-1">Back</Text>
        </TouchableOpacity>

        <Text className="text-2xl font-bold text-white mb-2">
          Recovery Phrase
        </Text>
        <Text className="text-dark-400 leading-5">
          Your recovery phrase is the only way to restore your wallet if you
          lose access.
        </Text>
      </View>

      {/* Content */}
      <View className="flex-1 px-6 mt-6">
        {mnemonic ? (
          <>
            {/* Security Warning */}
            <View className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
              <View className="flex-row items-start">
                <WarningIcon size={20} color={ICON_COLORS.error} weight="fill" />
                <View className="flex-1 ml-2">
                  <Text className="text-red-400 font-medium mb-1">
                    Do not share your recovery phrase
                  </Text>
                  <Text className="text-red-400/80 text-sm leading-5">
                    Anyone with these words can steal your funds. Never enter
                    them on any website or share with anyone.
                  </Text>
                </View>
              </View>
            </View>

            {/* Mnemonic Display */}
            <View className="bg-dark-900 rounded-2xl p-4 border border-dark-800">
              <View className="flex-row flex-wrap">
                {mnemonic.map((word, index) => (
                  <View key={index} className="w-1/3 p-2">
                    <View className="bg-dark-800 rounded-lg px-3 py-2 flex-row items-center">
                      <Text className="text-dark-500 text-sm w-6">
                        {index + 1}.
                      </Text>
                      <Text className="text-white font-mono">{word}</Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* Copy Button */}
              <TouchableOpacity
                onPress={handleCopy}
                className="mt-4 py-3 rounded-xl bg-dark-800 items-center flex-row justify-center"
              >
                {copied ? (
                  <CheckIcon size={18} color={ICON_COLORS.success} weight="bold" />
                ) : (
                  <CopySimpleIcon size={18} color={ICON_COLORS.muted} weight="fill" />
                )}
                <Text className="text-dark-300 ml-2">
                  {copied ? "Copied to clipboard" : "Copy to clipboard"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Hide Button */}
            <TouchableOpacity
              onPress={handleHide}
              className="mt-4 py-3 items-center"
            >
              <Text className="text-dark-400">Hide recovery phrase</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* Hidden State */}
            <View className="bg-dark-900 rounded-2xl p-6 border border-dark-800 items-center">
              <View className="w-20 h-20 rounded-full bg-dark-800 items-center justify-center mb-4">
                <LockKeyIcon size={40} color={ICON_COLORS.brand} weight="fill" />
              </View>
              <Text className="text-white font-medium text-lg mb-2">
                Protected Content
              </Text>
              <Text className="text-dark-400 text-center mb-6">
                Your recovery phrase is hidden for security. Authenticate to
                reveal it.
              </Text>
              <Button onPress={handleReveal}>Reveal Recovery Phrase</Button>
            </View>

            {/* Info */}
            <View className="mt-6 bg-dark-900 rounded-xl p-4 border border-dark-800">
              <Text className="text-white font-medium mb-2">
                Why backup your recovery phrase?
              </Text>
              <Text className="text-dark-400 text-sm leading-5">
                • Restore your wallet on a new device{"\n"}
                • Recover access if your phone is lost{"\n"}
                • Your funds are tied to this phrase{"\n"}
                • SIP Privacy cannot recover it for you
              </Text>
            </View>
          </>
        )}
      </View>

      {/* Screenshot Warning */}
      <View className="px-6 pb-8">
        <View className="bg-dark-900 rounded-xl p-4 border border-dark-800">
          <View className="flex-row items-center justify-center">
            <DeviceMobileCameraIcon size={18} color={ICON_COLORS.inactive} weight="fill" />
            <Text className="text-dark-500 text-sm ml-2">
              Never take a screenshot of your recovery phrase
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  )
}
