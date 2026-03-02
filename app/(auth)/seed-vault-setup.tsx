/**
 * Seed Vault Setup Screen
 *
 * Hardware-backed key custody setup for Solana Mobile devices (Saga, Seeker).
 * Keys never leave the Trusted Execution Environment (TEE).
 *
 * Flow:
 * 1. Check Seed Vault availability
 * 2. Request permission to use Seed Vault
 * 3. Authorize or create a new seed
 * 4. Select account from authorized seeds
 * 5. Connect to wallet store
 * 6. Navigate to home
 *
 * Part of Native Wallet Architecture (#61)
 * Issue: #70, #75
 */

import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { useSeedVault, type SeedVaultSeed } from "@/hooks"
import { useWalletStore } from "@/stores/wallet"
import { useState, useEffect, useCallback } from "react"
import {
  ShieldCheckIcon,
  ArrowLeftIcon,
  PlusIcon,
  DownloadSimpleIcon,
  KeyIcon,
  WarningIcon,
  CheckCircleIcon,
  CaretRightIcon,
  GearIcon,
} from "phosphor-react-native"
import { ICON_COLORS } from "@/constants/icons"

type SetupStep = "permission" | "seeds" | "connecting"

export default function SeedVaultSetupScreen() {
  const {
    isAvailable,
    isLoading,
    isInitialized,
    error,
    requestPermission,
    authorizeNewSeed,
    createNewSeed,
    importExistingSeed,
    getAuthorizedSeeds,
    selectSeed,
    wallet,
    showSeedSettings,
  } = useSeedVault()

  const connect = useWalletStore(state => state.connect)

  const [step, setStep] = useState<SetupStep>("permission")
  const [seeds, setSeeds] = useState<SeedVaultSeed[]>([])
  const [hasPermission, setHasPermission] = useState(false)
  const [permissionChecked, setPermissionChecked] = useState(false)

  // Check permission and load seeds on mount
  useEffect(() => {
    if (!isInitialized) return

    const initialize = async () => {
      // Request permission
      const granted = await requestPermission()
      setHasPermission(granted)
      setPermissionChecked(true)

      if (granted) {
        // Load existing authorized seeds
        const authorizedSeeds = await getAuthorizedSeeds()
        setSeeds(authorizedSeeds)

        if (authorizedSeeds.length > 0) {
          setStep("seeds")
        }
      }
    }

    initialize()
  }, [isInitialized, requestPermission, getAuthorizedSeeds])

  // Navigate to home when wallet is connected
  useEffect(() => {
    if (wallet) {
      // Connect to wallet store
      connect("seed-vault", "solana", wallet.publicKey.toBase58(), "native")

      // Navigate to home after short delay for UX
      setTimeout(() => {
        router.replace("/(tabs)")
      }, 500)
    }
  }, [wallet, connect])

  const handleRequestPermission = useCallback(async () => {
    const granted = await requestPermission()
    setHasPermission(granted)

    if (granted) {
      const authorizedSeeds = await getAuthorizedSeeds()
      setSeeds(authorizedSeeds)
      setStep("seeds")
    }
  }, [requestPermission, getAuthorizedSeeds])

  const handleAuthorizeExisting = useCallback(async () => {
    const result = await authorizeNewSeed()
    if (result) {
      const authorizedSeeds = await getAuthorizedSeeds()
      setSeeds(authorizedSeeds)
    }
  }, [authorizeNewSeed, getAuthorizedSeeds])

  const handleCreateNew = useCallback(async () => {
    const result = await createNewSeed()
    if (result) {
      const authorizedSeeds = await getAuthorizedSeeds()
      setSeeds(authorizedSeeds)
    }
  }, [createNewSeed, getAuthorizedSeeds])

  const handleImportExisting = useCallback(async () => {
    const result = await importExistingSeed()
    if (result) {
      const authorizedSeeds = await getAuthorizedSeeds()
      setSeeds(authorizedSeeds)
    }
  }, [importExistingSeed, getAuthorizedSeeds])

  const handleSelectSeed = useCallback(async (authToken: number) => {
    setStep("connecting")
    try {
      await selectSeed(authToken)
    } catch (err) {
      console.error("[SeedVaultSetup] Failed to select seed:", err)
      setStep("seeds")
    }
  }, [selectSeed])

  const handleShowSettings = useCallback(async (authToken: number) => {
    await showSeedSettings(authToken)
  }, [showSeedSettings])

  // Not available on this device
  if (isInitialized && !isAvailable) {
    return (
      <SafeAreaView className="flex-1 bg-dark-950">
        <View className="flex-row items-center px-4 py-3 border-b border-dark-800">
          <TouchableOpacity
            onPress={() => router.back()}
            className="p-2 -ml-2"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeftIcon size={24} color={ICON_COLORS.white} />
          </TouchableOpacity>
          <Text className="flex-1 text-xl font-semibold text-white ml-2">
            Seed Vault Setup
          </Text>
        </View>

        <View className="flex-1 items-center justify-center px-6">
          <View className="w-20 h-20 rounded-full bg-yellow-600/20 items-center justify-center mb-6">
            <WarningIcon size={40} color={ICON_COLORS.warning} weight="fill" />
          </View>
          <Text className="text-xl font-semibold text-white mb-3 text-center">
            Seed Vault Not Available
          </Text>
          <Text className="text-dark-400 text-center mb-6 leading-6">
            Seed Vault requires a Solana Mobile device (Saga or Seeker) with hardware-backed key storage.
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            className="bg-brand-600 px-8 py-4 rounded-xl"
          >
            <Text className="text-white font-semibold">Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // Loading state
  if (!isInitialized || (isLoading && step !== "connecting")) {
    return (
      <SafeAreaView className="flex-1 bg-dark-950 items-center justify-center">
        <ActivityIndicator size="large" color={ICON_COLORS.brand} />
        <Text className="text-dark-400 mt-4">Checking Seed Vault...</Text>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-dark-950">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-dark-800">
        <TouchableOpacity
          onPress={() => router.back()}
          className="p-2 -ml-2"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeftIcon size={24} color={ICON_COLORS.white} />
        </TouchableOpacity>
        <Text className="flex-1 text-xl font-semibold text-white ml-2">
          Seed Vault Setup
        </Text>
      </View>

      {/* Content */}
      <ScrollView className="flex-1" contentContainerClassName="px-6 py-6">
        {/* Permission Step */}
        {step === "permission" && permissionChecked && !hasPermission && (
          <View>
            <View className="items-center mb-8">
              <View className="w-24 h-24 rounded-full bg-green-600/20 items-center justify-center mb-4">
                <ShieldCheckIcon size={48} color={ICON_COLORS.green} weight="fill" />
              </View>
              <Text className="text-2xl font-bold text-white mb-2 text-center">
                Hardware-Backed Security
              </Text>
              <Text className="text-dark-400 text-center leading-6">
                Seed Vault stores your keys in the device&apos;s Trusted Execution Environment (TEE).
                Your private keys never leave the secure enclave.
              </Text>
            </View>

            <View className="bg-dark-900 rounded-xl p-4 mb-6 border border-dark-800">
              <Text className="text-white font-medium mb-2">Benefits:</Text>
              <View className="flex-row items-center mb-2">
                <CheckCircleIcon size={20} color={ICON_COLORS.green} weight="fill" />
                <Text className="text-dark-300 ml-3">Keys isolated from app layer</Text>
              </View>
              <View className="flex-row items-center mb-2">
                <CheckCircleIcon size={20} color={ICON_COLORS.green} weight="fill" />
                <Text className="text-dark-300 ml-3">Biometric authentication required</Text>
              </View>
              <View className="flex-row items-center">
                <CheckCircleIcon size={20} color={ICON_COLORS.green} weight="fill" />
                <Text className="text-dark-300 ml-3">Same seed across all apps</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleRequestPermission}
              disabled={isLoading}
              className="bg-green-600 py-4 rounded-xl items-center"
            >
              {isLoading ? (
                <ActivityIndicator color={ICON_COLORS.white} />
              ) : (
                <Text className="text-white font-semibold text-lg">
                  Grant Permission
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Seeds Step */}
        {step === "seeds" && (
          <View>
            <Text className="text-white text-lg font-semibold mb-4">
              Select or Add a Seed
            </Text>

            {/* Existing Seeds */}
            {seeds.length > 0 && (
              <View className="mb-6">
                <Text className="text-dark-400 text-sm mb-3">Authorized Seeds</Text>
                {seeds.map((seed) => (
                  <TouchableOpacity
                    key={seed.authToken}
                    onPress={() => handleSelectSeed(seed.authToken)}
                    className="bg-dark-900 rounded-xl p-4 mb-3 border border-dark-800 flex-row items-center"
                  >
                    <View className="w-12 h-12 rounded-xl bg-green-600/20 items-center justify-center mr-4">
                      <KeyIcon size={24} color={ICON_COLORS.green} weight="fill" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-white font-medium">{seed.name}</Text>
                      <Text className="text-dark-400 text-sm">
                        Tap to use this seed
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleShowSettings(seed.authToken)}
                      className="p-2"
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <GearIcon size={20} color={ICON_COLORS.muted} />
                    </TouchableOpacity>
                    <CaretRightIcon size={20} color={ICON_COLORS.muted} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Add Seed Options */}
            <View>
              <Text className="text-dark-400 text-sm mb-3">Add a Seed</Text>

              {/* Authorize Existing */}
              <TouchableOpacity
                onPress={handleAuthorizeExisting}
                disabled={isLoading}
                className="bg-dark-900 rounded-xl p-4 mb-3 border border-dark-800 flex-row items-center"
              >
                <View className="w-12 h-12 rounded-xl bg-brand-600/20 items-center justify-center mr-4">
                  <ShieldCheckIcon size={24} color={ICON_COLORS.brand} weight="fill" />
                </View>
                <View className="flex-1">
                  <Text className="text-white font-medium">Authorize Existing</Text>
                  <Text className="text-dark-400 text-sm">
                    Select a seed already in Seed Vault
                  </Text>
                </View>
                <CaretRightIcon size={20} color={ICON_COLORS.muted} />
              </TouchableOpacity>

              {/* Create New */}
              <TouchableOpacity
                onPress={handleCreateNew}
                disabled={isLoading}
                className="bg-dark-900 rounded-xl p-4 mb-3 border border-dark-800 flex-row items-center"
              >
                <View className="w-12 h-12 rounded-xl bg-cyan-600/20 items-center justify-center mr-4">
                  <PlusIcon size={24} color={ICON_COLORS.cyan} weight="bold" />
                </View>
                <View className="flex-1">
                  <Text className="text-white font-medium">Create New Seed</Text>
                  <Text className="text-dark-400 text-sm">
                    Generate a new seed phrase
                  </Text>
                </View>
                <CaretRightIcon size={20} color={ICON_COLORS.muted} />
              </TouchableOpacity>

              {/* Import Existing */}
              <TouchableOpacity
                onPress={handleImportExisting}
                disabled={isLoading}
                className="bg-dark-900 rounded-xl p-4 border border-dark-800 flex-row items-center"
              >
                <View className="w-12 h-12 rounded-xl bg-purple-600/20 items-center justify-center mr-4">
                  <DownloadSimpleIcon size={24} color={ICON_COLORS.purple} weight="fill" />
                </View>
                <View className="flex-1">
                  <Text className="text-white font-medium">Import Seed Phrase</Text>
                  <Text className="text-dark-400 text-sm">
                    Enter your 12 or 24 word phrase
                  </Text>
                </View>
                <CaretRightIcon size={20} color={ICON_COLORS.muted} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Connecting Step */}
        {step === "connecting" && (
          <View className="items-center justify-center py-12">
            <ActivityIndicator size="large" color={ICON_COLORS.green} />
            <Text className="text-white font-medium mt-4">
              Connecting to Seed Vault...
            </Text>
            <Text className="text-dark-400 text-sm mt-2 text-center">
              Complete biometric authentication on your device
            </Text>
          </View>
        )}

        {/* Error Display */}
        {error && (
          <View className="bg-red-900/20 rounded-xl p-4 mt-4 border border-red-600/50">
            <View className="flex-row items-center">
              <WarningIcon size={20} color={ICON_COLORS.error} weight="fill" />
              <Text className="text-red-400 ml-2 flex-1">{error.message}</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
