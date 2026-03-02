/**
 * Create Wallet Screen
 *
 * Flow:
 * 1. Generate mnemonic
 * 2. Display words with copy option
 * 3. Verify backup (select words)
 * 4. Complete → Navigate to home
 */

import { View, Text, TouchableOpacity, ScrollView, Alert } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { useState, useEffect } from "react"
import { Button, LoadingState } from "@/components/ui"
import { useNativeWallet } from "@/hooks"
import { copyToClipboardSecure } from "@/utils/security"
import {
  ArrowLeftIcon,
  WarningIcon,
  CopySimpleIcon,
  CheckIcon,
  CheckCircleIcon,
} from "phosphor-react-native"
import { ICON_COLORS } from "@/constants/icons"

type Step = "generate" | "display" | "verify" | "complete"

// Indices to verify (random 3 words)
function getVerificationIndices(): number[] {
  const indices: number[] = []
  while (indices.length < 3) {
    const idx = Math.floor(Math.random() * 12)
    if (!indices.includes(idx)) {
      indices.push(idx)
    }
  }
  return indices.sort((a, b) => a - b)
}

export default function CreateWalletScreen() {
  const { createWallet, isLoading } = useNativeWallet()

  const [step, setStep] = useState<Step>("generate")
  const [mnemonic, setMnemonic] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [, setGenerateError] = useState(false)

  // Verification state
  const [verifyIndices, setVerifyIndices] = useState<number[]>([])
  const [selectedWords, setSelectedWords] = useState<string[]>(["", "", ""])
  const [verifyError, setVerifyError] = useState<string | null>(null)

  // Generate wallet on mount
  useEffect(() => {
    const generate = async () => {
      try {
        const result = await createWallet(12)
        const words = result.mnemonic.split(" ")
        setMnemonic(words)
        setVerifyIndices(getVerificationIndices())
        setStep("display")
      } catch (err) {
        setGenerateError(true)
        Alert.alert(
          "Error",
          "Failed to create wallet. Please try again.",
          [{ text: "Go Back", onPress: () => router.back() }]
        )
      }
    }

    generate()
  }, [createWallet])

  const handleCopy = async () => {
    // Use secure clipboard with 60-second auto-clear
    await copyToClipboardSecure(mnemonic.join(" "))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleContinueToVerify = () => {
    setSelectedWords(["", "", ""])
    setVerifyError(null)
    setStep("verify")
  }

  const handleWordSelect = (position: number, word: string) => {
    const newSelected = [...selectedWords]
    newSelected[position] = word
    setSelectedWords(newSelected)
    setVerifyError(null)
  }

  const handleVerify = () => {
    // CheckIcon if all selected words match
    const correct = verifyIndices.every(
      (idx, pos) => selectedWords[pos] === mnemonic[idx]
    )

    if (correct) {
      setStep("complete")
    } else {
      setVerifyError("Incorrect words. Please check your backup and try again.")
    }
  }

  const handleComplete = () => {
    router.replace("/(tabs)")
  }

  const handleBack = () => {
    if (step === "display") {
      // Going back means we need to delete the wallet we just created
      Alert.alert(
        "Discard Wallet?",
        "Going back will discard this wallet. You'll need to create a new one.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => router.back(),
          },
        ]
      )
    } else if (step === "verify") {
      setStep("display")
    } else {
      router.back()
    }
  }

  // Render based on step
  if (isLoading || step === "generate") {
    return (
      <SafeAreaView className="flex-1 bg-dark-950 items-center justify-center">
        <LoadingState message="Creating your wallet..." />
      </SafeAreaView>
    )
  }

  if (step === "display") {
    return (
      <SafeAreaView className="flex-1 bg-dark-950">
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View className="px-6 pt-4">
            <TouchableOpacity onPress={handleBack} className="mb-4">
              <View className="flex-row items-center">
                <ArrowLeftIcon size={20} color={ICON_COLORS.brand} weight="bold" />
                <Text className="text-brand-500 ml-1">Back</Text>
              </View>
            </TouchableOpacity>

            <Text className="text-2xl font-bold text-white mb-2">
              Your Recovery Phrase
            </Text>
            <Text className="text-dark-400 leading-5">
              Write down these {mnemonic.length} words in order. This is the only way
              to recover your wallet.
            </Text>
          </View>

          {/* Security Warning */}
          <View className="mx-6 mt-4 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
            <View className="flex-row items-start">
              <WarningIcon size={20} color={ICON_COLORS.error} weight="fill" />
              <View className="flex-1 ml-2">
                <Text className="text-red-400 font-medium mb-1">
                  Never share your recovery phrase
                </Text>
                <Text className="text-red-400/80 text-sm leading-5">
                  Anyone with these words can steal your funds. Never enter them
                  on any website.
                </Text>
              </View>
            </View>
          </View>

          {/* Mnemonic Grid */}
          <View className="px-6 mt-6">
            <View testID="seed-phrase-display" className="bg-dark-900 rounded-2xl p-4 border border-dark-800">
              <View className="flex-row flex-wrap">
                {mnemonic.map((word, index) => (
                  <View
                    key={index}
                    className="w-1/3 p-2"
                  >
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
          </View>

          {/* Tips */}
          <View className="px-6 mt-6 mb-4">
            <Text className="text-dark-500 text-sm mb-2">Tips:</Text>
            <Text className="text-dark-500 text-sm leading-5">
              • Write on paper, not digitally{"\n"}
              • Store in a safe place{"\n"}
              • Consider multiple backups{"\n"}
              • Never take a screenshot
            </Text>
          </View>
        </ScrollView>

        {/* Continue Button */}
        <View className="px-6 pb-8">
          <Button fullWidth size="lg" onPress={handleContinueToVerify}>
            I've Written It Down
          </Button>
        </View>
      </SafeAreaView>
    )
  }

  if (step === "verify") {
    // Generate word options (correct word + 3 random)
    const getWordOptions = (correctIndex: number): string[] => {
      const correct = mnemonic[correctIndex]
      const others = mnemonic
        .filter((_, i) => i !== correctIndex)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
      return [correct, ...others].sort(() => Math.random() - 0.5)
    }

    return (
      <SafeAreaView className="flex-1 bg-dark-950">
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View className="px-6 pt-4">
            <TouchableOpacity onPress={handleBack} className="mb-4">
              <View className="flex-row items-center">
                <ArrowLeftIcon size={20} color={ICON_COLORS.brand} weight="bold" />
                <Text className="text-brand-500 ml-1">Back</Text>
              </View>
            </TouchableOpacity>

            <Text className="text-2xl font-bold text-white mb-2">
              Verify Your Backup
            </Text>
            <Text className="text-dark-400 leading-5">
              Select the correct words to confirm you've saved your recovery
              phrase.
            </Text>
          </View>

          {/* Verification Questions */}
          <View className="px-6 mt-6">
            {verifyIndices.map((wordIndex, position) => (
              <View key={position} className="mb-6">
                <Text className="text-dark-400 mb-3">
                  Word #{wordIndex + 1}
                </Text>
                <View className="flex-row flex-wrap -m-1">
                  {getWordOptions(wordIndex).map((word) => (
                    <TouchableOpacity
                      key={word}
                      onPress={() => handleWordSelect(position, word)}
                      className={`m-1 px-4 py-3 rounded-xl border ${
                        selectedWords[position] === word
                          ? "bg-brand-600 border-brand-600"
                          : "bg-dark-900 border-dark-800"
                      }`}
                    >
                      <Text
                        className={`font-mono ${
                          selectedWords[position] === word
                            ? "text-white"
                            : "text-dark-300"
                        }`}
                      >
                        {word}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </View>

          {/* Error Message */}
          {verifyError && (
            <View className="mx-6 mt-2 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <Text className="text-red-400 text-center">{verifyError}</Text>
            </View>
          )}
        </ScrollView>

        {/* Verify Button */}
        <View className="px-6 pb-8">
          <Button
            fullWidth
            size="lg"
            onPress={handleVerify}
            disabled={selectedWords.some((w) => !w)}
          >
            Verify Backup
          </Button>
        </View>
      </SafeAreaView>
    )
  }

  // Complete step
  return (
    <SafeAreaView className="flex-1 bg-dark-950 items-center justify-center px-6">
      <View className="items-center w-full">
        {/* Success Icon */}
        <View className="w-24 h-24 rounded-full bg-green-500/20 items-center justify-center mb-6">
          <CheckCircleIcon size={56} color={ICON_COLORS.success} weight="fill" />
        </View>

        <Text className="text-2xl font-bold text-white mb-2 text-center">
          Wallet Created!
        </Text>
        <Text className="text-dark-400 text-center leading-5 mb-8">
          Your wallet is ready. Keep your recovery phrase safe — it's the only
          way to restore your wallet.
        </Text>

        <Button fullWidth size="lg" onPress={handleComplete}>
          Get Started
        </Button>
      </View>
    </SafeAreaView>
  )
}
