/**
 * Wallet Setup Screen
 *
 * Entry point for native wallet setup:
 * - Create new wallet (generate seed phrase)
 * - Import existing wallet (seed phrase or private key)
 * - Use Seed Vault (hardware-backed on Saga/Seeker) [Android only]
 *
 * SIP Privacy is a standalone wallet (like Phantom, Solflare).
 * No external wallet connection needed.
 */

import { View, Text, TouchableOpacity, Platform, Alert } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router, Href } from "expo-router"
import { useNativeWallet, useSeedVault } from "@/hooks"
import { useEffect, useMemo, useState, useRef } from "react"
import { useSettingsStore } from "@/stores/settings"
import type { Icon as PhosphorIcon } from "phosphor-react-native"
import {
  SparkleIcon,
  DownloadSimpleIcon,
  LockKeyIcon,
  ShieldCheckIcon,
} from "phosphor-react-native"
import { ICON_COLORS } from "@/constants/icons"

interface SetupOption {
  id: string
  icon: PhosphorIcon
  title: string
  description: string
  route: Href
  primary?: boolean
  badge?: string
  badgeColor?: string
  hidden?: boolean
}

const BASE_SETUP_OPTIONS: SetupOption[] = [
  {
    id: "create",
    icon: SparkleIcon,
    title: "Create New Wallet",
    description: "Generate a new wallet with a secure seed phrase",
    route: "/create-wallet",
    primary: true,
  },
  {
    id: "import",
    icon: DownloadSimpleIcon,
    title: "Import Existing Wallet",
    description: "Restore from seed phrase or private key",
    route: "/import-wallet",
  },
]

const SEED_VAULT_OPTION: SetupOption = {
  id: "seed-vault",
  icon: ShieldCheckIcon,
  title: "Use Seed Vault",
  description: "Hardware-backed security via TEE (Saga/Seeker)",
  route: "/seed-vault-setup" as Href,
  badge: "Most Secure",
  badgeColor: "bg-green-600",
}

export default function WalletSetupScreen() {
  const { wallet, isInitialized } = useNativeWallet()
  const { isAvailable: seedVaultAvailable, isInitialized: seedVaultInitialized } = useSeedVault()
  const resetOnboarding = useSettingsStore((s) => s.resetOnboarding)

  // Dev-only: tap title 5 times to reset onboarding
  const [tapCount, setTapCount] = useState(0)
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleTitleTap = () => {
    setTapCount((prev) => prev + 1)

    // Reset tap count after 2 seconds of no taps
    if (tapTimer.current) clearTimeout(tapTimer.current)
    tapTimer.current = setTimeout(() => setTapCount(0), 2000)

    if (tapCount + 1 >= 5) {
      resetOnboarding()
      setTapCount(0)
      Alert.alert(
        "Onboarding Reset",
        "Reload app to see onboarding again",
        [{ text: "OK" }]
      )
    }
  }

  // Build setup options based on device capabilities
  const setupOptions = useMemo(() => {
    const options = [...BASE_SETUP_OPTIONS]

    // Add Seed Vault option on Android when available
    if (Platform.OS === "android" && seedVaultInitialized && seedVaultAvailable) {
      // Insert Seed Vault as first option (most secure)
      options.unshift(SEED_VAULT_OPTION)
      // Remove "primary" from Create New Wallet since Seed Vault is now first
      const createOption = options.find(o => o.id === "create")
      if (createOption) {
        createOption.primary = false
      }
    }

    return options
  }, [seedVaultAvailable, seedVaultInitialized])

  // Redirect to home if wallet already exists
  useEffect(() => {
    if (isInitialized && wallet) {
      router.replace("/(tabs)")
    }
  }, [isInitialized, wallet])

  const handleOptionPress = (option: SetupOption) => {
    router.push(option.route)
  }

  return (
    <SafeAreaView testID="welcome-screen" className="flex-1 bg-dark-950">
      {/* Header - Tap title 5x to reset onboarding (dev feature) */}
      <View className="px-6 pt-8 pb-4">
        <TouchableOpacity onPress={handleTitleTap} activeOpacity={1}>
          <Text className="text-3xl font-bold text-white mb-2">
            Welcome to SIP Privacy
          </Text>
        </TouchableOpacity>
        <View className="flex-row items-center justify-between">
          <Text className="text-lg text-dark-400">
            Set up your privacy wallet to get started
          </Text>
          {/* DEV: Visible reset button - remove in production */}
          {__DEV__ && (
            <TouchableOpacity
              onPress={() => {
                resetOnboarding()
                Alert.alert(
                  "Onboarding Reset",
                  "Reload app to see onboarding again",
                  [{ text: "OK" }]
                )
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              className="bg-warning-600 px-2 py-1 rounded"
            >
              <Text className="text-white text-xs">Reset</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Options */}
      <View className="flex-1 px-6 pt-4">
        {setupOptions.map((option) => {
          // Determine styling based on option type
          const isSeedVault = option.id === "seed-vault"
          const isPrimary = option.primary || isSeedVault

          return (
            <TouchableOpacity
              key={option.id}
              testID={`${option.id}-button`}
              onPress={() => handleOptionPress(option)}
              className={`mb-4 p-5 rounded-2xl border ${
                isSeedVault
                  ? "bg-green-900/10 border-green-600"
                  : isPrimary
                  ? "bg-brand-600/10 border-brand-600"
                  : "bg-dark-900 border-dark-800"
              }`}
              activeOpacity={0.7}
            >
              <View className="flex-row items-center mb-3">
                <View
                  className={`w-12 h-12 rounded-xl items-center justify-center mr-4 ${
                    isSeedVault
                      ? "bg-green-600/20"
                      : isPrimary
                      ? "bg-brand-600/20"
                      : "bg-dark-800"
                  }`}
                >
                  <option.icon
                    size={28}
                    color={
                      isSeedVault
                        ? ICON_COLORS.green
                        : isPrimary
                        ? ICON_COLORS.brand
                        : ICON_COLORS.muted
                    }
                    weight="fill"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-lg font-semibold text-white">
                    {option.title}
                  </Text>
                  {option.badge && (
                    <View className={`${option.badgeColor || "bg-brand-600"} px-2 py-0.5 rounded self-start mt-1`}>
                      <Text className="text-xs text-white font-medium">
                        {option.badge}
                      </Text>
                    </View>
                  )}
                  {option.primary && !option.badge && (
                    <View className="bg-brand-600 px-2 py-0.5 rounded self-start mt-1">
                      <Text className="text-xs text-white font-medium">
                        Recommended
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              <Text className="text-dark-400 leading-5">{option.description}</Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* Security Notice */}
      <View className="px-6 pb-8">
        <View className="bg-dark-900 rounded-xl p-4 border border-dark-800">
          <View className="flex-row items-start">
            <LockKeyIcon size={24} color={ICON_COLORS.brand} weight="fill" />
            <View className="flex-1 ml-3">
              <Text className="text-white font-medium mb-1">
                Your keys, your crypto
              </Text>
              <Text className="text-dark-400 text-sm leading-5">
                SIP Privacy stores your keys locally with biometric protection.
                We never have access to your funds.
              </Text>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  )
}
