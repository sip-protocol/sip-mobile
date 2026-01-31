/**
 * Settings Screen
 *
 * Main settings hub with Phosphor icons for consistency.
 */

import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, Alert, Modal, TextInput, Linking, Pressable, Switch } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import Constants from 'expo-constants'
import {
  Wallet,
  Key,
  LockKey,
  Shield,
  ShieldCheck,
  Eye,
  Lock,
  ChartBar,
  MagnifyingGlass,
  Bell,
  Globe,
  GlobeHemisphereWest,
  Fire,
  Lightning,
  ArrowsClockwise,
  Info,
  BookOpen,
  Plugs,
  Bug,
  Check,
  Warning,
  Sparkle,
  Binoculars,
} from 'phosphor-react-native'
import type { Icon as PhosphorIcon } from 'phosphor-react-native'
import { ICON_COLORS } from '@/constants/icons'
import { useWalletStore, formatAddress } from '@/stores/wallet'
import { useViewingKeys } from '@/hooks/useViewingKeys'
import { useBackgroundScan } from '@/hooks/useBackgroundScan'
import { useSettingsStore } from '@/stores/settings'
import { useToastStore } from '@/stores/toast'
import { PRIVACY_PROVIDERS } from '@/privacy-providers'
import type { PrivacyLevel } from '@/types'

// ============================================================================
// PRIVACY LEVELS
// ============================================================================

interface PrivacyLevelOption {
  id: PrivacyLevel
  name: string
  description: string
  Icon: PhosphorIcon
  color: string
}

const PRIVACY_LEVELS: PrivacyLevelOption[] = [
  {
    id: 'shielded',
    name: 'Shielded',
    description: 'Full privacy - hidden sender, amount, recipient',
    Icon: ShieldCheck,
    color: ICON_COLORS.brand,
  },
  {
    id: 'compliant',
    name: 'Compliant',
    description: 'Privacy with viewing key for auditors',
    Icon: Lock,
    color: ICON_COLORS.cyan,
  },
  {
    id: 'transparent',
    name: 'Transparent',
    description: 'No privacy - public transaction',
    Icon: Eye,
    color: ICON_COLORS.muted,
  },
]

// ============================================================================
// PROVIDER ICONS
// ============================================================================

const PROVIDER_ICONS: Record<string, { Icon: PhosphorIcon; color: string }> = {
  'sip-native': { Icon: Plugs, color: ICON_COLORS.brand },
  'privacy-cash': { Icon: Shield, color: ICON_COLORS.success },
  'shadowwire': { Icon: Lightning, color: ICON_COLORS.yellow },
}

// ============================================================================
// RPC PROVIDERS
// ============================================================================

interface RpcProviderOption {
  id: 'helius' | 'quicknode' | 'triton' | 'publicnode'
  name: string
  description: string
  Icon: PhosphorIcon
  color: string
  needsKey: boolean
}

const RPC_PROVIDERS: RpcProviderOption[] = [
  {
    id: 'helius',
    name: 'Helius',
    description: 'Fast RPC with DAS support',
    Icon: Fire,
    color: ICON_COLORS.orange,
    needsKey: false,
  },
  {
    id: 'quicknode',
    name: 'QuickNode',
    description: 'Bring your own API key',
    Icon: Lightning,
    color: ICON_COLORS.yellow,
    needsKey: true,
  },
  {
    id: 'triton',
    name: 'Triton',
    description: 'Bring your own endpoint',
    Icon: GlobeHemisphereWest,
    color: ICON_COLORS.blue,
    needsKey: true,
  },
  {
    id: 'publicnode',
    name: 'PublicNode',
    description: 'Free public RPC',
    Icon: Globe,
    color: ICON_COLORS.muted,
    needsKey: false,
  },
]

// ============================================================================
// SETTINGS ITEM COMPONENT
// ============================================================================

type SettingsItemProps = {
  Icon: PhosphorIcon
  iconColor?: string
  title: string
  subtitle?: string
  onPress?: () => void
}

function SettingsItem({ Icon, iconColor = ICON_COLORS.muted, title, subtitle, onPress }: SettingsItemProps) {
  return (
    <TouchableOpacity
      className="flex-row items-center p-4 bg-dark-900 border-b border-dark-800"
      onPress={onPress}
    >
      <View className="w-8 items-center mr-3">
        <Icon size={24} color={iconColor} weight="regular" />
      </View>
      <View className="flex-1">
        <Text className="text-white font-medium">{title}</Text>
        {subtitle && (
          <Text className="text-dark-500 text-sm">{subtitle}</Text>
        )}
      </View>
      <Text className="text-dark-500">›</Text>
    </TouchableOpacity>
  )
}

// ============================================================================
// SETTINGS TOGGLE COMPONENT
// ============================================================================

type SettingsToggleProps = {
  Icon: PhosphorIcon
  iconColor?: string
  title: string
  subtitle?: string
  value: boolean
  onValueChange: (value: boolean) => void
  disabled?: boolean
  testID?: string
}

function SettingsToggle({ Icon, iconColor = ICON_COLORS.muted, title, subtitle, value, onValueChange, disabled, testID }: SettingsToggleProps) {
  return (
    <View testID={testID} className="flex-row items-center p-4 bg-dark-900 border-b border-dark-800">
      <View className="w-8 items-center mr-3">
        <Icon size={24} color={iconColor} weight="regular" />
      </View>
      <View className="flex-1">
        <Text className="text-white font-medium">{title}</Text>
        {subtitle && (
          <Text className="text-dark-500 text-sm">{subtitle}</Text>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: '#3f3f46', true: '#8b5cf6' }}
        thumbColor={value ? '#fff' : '#71717a'}
      />
    </View>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SettingsScreen() {
  const { isConnected, address } = useWalletStore()
  const { getActiveDisclosures } = useViewingKeys()
  const {
    rpcProvider,
    setRpcProvider,
    network,
    setNetwork,
    quicknodeApiKey,
    setQuicknodeApiKey,
    tritonEndpoint,
    setTritonEndpoint,
    defaultPrivacyLevel,
    setDefaultPrivacyLevel,
    privacyProvider,
    setPrivacyProvider,
    defaultExplorer,
    setDefaultExplorer,
    resetOnboarding,
  } = useSettingsStore()
  const { addToast } = useToastStore()

  const [showRpcModal, setShowRpcModal] = useState(false)
  const [showNetworkModal, setShowNetworkModal] = useState(false)
  const [showExplorerModal, setShowExplorerModal] = useState(false)
  const [showPrivacyLevelModal, setShowPrivacyLevelModal] = useState(false)
  const [showPrivacyProviderModal, setShowPrivacyProviderModal] = useState(false)
  const [showAboutModal, setShowAboutModal] = useState(false)
  const [pendingProvider, setPendingProvider] = useState<typeof rpcProvider | null>(null)
  const [apiKeyInput, setApiKeyInput] = useState('')

  // Get current privacy level info
  const currentPrivacyLevel = PRIVACY_LEVELS.find((p) => p.id === defaultPrivacyLevel) || PRIVACY_LEVELS[0]

  // Get current privacy provider info (#73)
  const currentPrivacyProvider = PRIVACY_PROVIDERS.find((p) => p.id === privacyProvider) || PRIVACY_PROVIDERS[0]
  const providerIconInfo = PROVIDER_ICONS[currentPrivacyProvider.id] || { Icon: Shield, color: ICON_COLORS.muted }

  // Get app version
  const appVersion = Constants.expoConfig?.version || '0.1.0'

  // Open external URLs
  const openUrl = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url)
      if (supported) {
        await Linking.openURL(url)
      } else {
        addToast({
          type: 'error',
          title: 'Cannot Open URL',
          message: `Unable to open ${url}`,
        })
      }
    } catch {
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to open link',
      })
    }
  }

  const currentProvider = RPC_PROVIDERS.find((p) => p.id === rpcProvider) || RPC_PROVIDERS[0]

  // Handle provider selection
  const handleSelectProvider = (providerId: typeof rpcProvider) => {
    const provider = RPC_PROVIDERS.find((p) => p.id === providerId)

    if (provider?.needsKey) {
      // Show input for API key
      setPendingProvider(providerId)
      // Pre-fill with existing key if any
      if (providerId === 'quicknode') {
        setApiKeyInput(quicknodeApiKey || '')
      } else if (providerId === 'triton') {
        setApiKeyInput(tritonEndpoint || '')
      }
    } else {
      // No key needed, switch directly
      setRpcProvider(providerId)
      setShowRpcModal(false)
      addToast({
        type: 'success',
        title: 'Provider Changed',
        message: `Now using ${provider?.name}`,
      })
    }
  }

  // Save API key and switch provider
  const handleSaveApiKey = () => {
    if (!pendingProvider || !apiKeyInput.trim()) {
      addToast({
        type: 'error',
        title: 'API Key Required',
        message: 'Please enter a valid API key or endpoint',
      })
      return
    }

    if (pendingProvider === 'quicknode') {
      setQuicknodeApiKey(apiKeyInput.trim())
    } else if (pendingProvider === 'triton') {
      setTritonEndpoint(apiKeyInput.trim())
    }

    setRpcProvider(pendingProvider)
    setShowRpcModal(false)
    setPendingProvider(null)
    setApiKeyInput('')

    const provider = RPC_PROVIDERS.find((p) => p.id === pendingProvider)
    addToast({
      type: 'success',
      title: 'Provider Changed',
      message: `Now using ${provider?.name}`,
    })
  }

  const activeDisclosures = getActiveDisclosures()

  // Background scanning
  const {
    isEnabled: backgroundScanEnabled,
    isLoading: backgroundScanLoading,
    statusText: backgroundScanStatus,
    setEnabled: setBackgroundScanEnabled,
    error: backgroundScanError,
  } = useBackgroundScan()

  const handleBackgroundScanToggle = async (value: boolean) => {
    await setBackgroundScanEnabled(value)
    if (backgroundScanError) {
      addToast({
        type: 'error',
        title: 'Error',
        message: backgroundScanError,
      })
    } else {
      addToast({
        type: 'success',
        title: value ? 'Background Scanning Enabled' : 'Background Scanning Disabled',
        message: value ? 'You will be notified of new payments' : 'Notifications disabled',
      })
    }
  }

  const handleResetOnboarding = () => {
    Alert.alert(
      'Reset Onboarding',
      'This will show the onboarding screens again on next app launch.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          onPress: () => {
            resetOnboarding()
            addToast({
              type: 'success',
              title: 'Onboarding Reset',
              message: 'Restart app to see onboarding.',
            })
          },
        },
      ]
    )
  }

  const disclosureSubtitle = activeDisclosures.length > 0
    ? `${activeDisclosures.length} active disclosure${activeDisclosures.length !== 1 ? 's' : ''}`
    : 'Manage disclosure keys'

  return (
    <SafeAreaView className="flex-1 bg-dark-950">
      <ScrollView testID="settings-scroll-view" className="flex-1">
        <View className="px-4 pt-6 pb-4">
          <Text className="text-3xl font-bold text-white">Settings</Text>
        </View>

        {/* Wallet Section */}
        <View className="mt-4">
          <Text className="text-dark-400 text-sm px-4 mb-2 uppercase">
            Wallet
          </Text>
          <View className="rounded-xl overflow-hidden mx-4">
            <SettingsItem
              Icon={Wallet}
              iconColor={ICON_COLORS.brand}
              title="Accounts"
              subtitle={isConnected ? formatAddress(address) : 'Not connected'}
              onPress={() => router.push('/settings/accounts')}
            />
            <SettingsItem
              Icon={Key}
              iconColor={ICON_COLORS.warning}
              title="Viewing Keys"
              subtitle={disclosureSubtitle}
              onPress={() => router.push('/settings/viewing-keys')}
            />
            <SettingsItem
              Icon={LockKey}
              iconColor={ICON_COLORS.cyan}
              title="Security"
              subtitle="Biometrics & PIN"
              onPress={() => router.push('/settings/security')}
            />
          </View>
        </View>

        {/* Privacy Section */}
        <View className="mt-6">
          <Text className="text-dark-400 text-sm px-4 mb-2 uppercase">
            Privacy
          </Text>
          <View className="rounded-xl overflow-hidden mx-4">
            <SettingsItem
              Icon={providerIconInfo.Icon}
              iconColor={providerIconInfo.color}
              title="Privacy Provider"
              subtitle={`${currentPrivacyProvider.name}${currentPrivacyProvider.recommended ? ' (recommended)' : ''}`}
              onPress={() => setShowPrivacyProviderModal(true)}
            />
            <SettingsItem
              Icon={currentPrivacyLevel.Icon}
              iconColor={currentPrivacyLevel.color}
              title="Privacy Level"
              subtitle={`${currentPrivacyLevel.name}${defaultPrivacyLevel === 'shielded' ? ' (recommended)' : ''}`}
              onPress={() => setShowPrivacyLevelModal(true)}
            />
            <SettingsItem
              Icon={ChartBar}
              iconColor={ICON_COLORS.purple}
              title="Privacy Score"
              subtitle="Check wallet exposure"
              onPress={() => router.push('/settings/privacy-score')}
            />
            <SettingsItem
              Icon={MagnifyingGlass}
              iconColor={ICON_COLORS.blue}
              title="Compliance Dashboard"
              subtitle="For institutions"
              onPress={() => router.push('/settings/compliance')}
            />
            <SettingsToggle
              testID="background-scan-toggle"
              Icon={Bell}
              iconColor={backgroundScanEnabled ? ICON_COLORS.brand : ICON_COLORS.muted}
              title="Background Scanning"
              subtitle={backgroundScanEnabled ? `Active (${backgroundScanStatus})` : 'Notify when payments arrive'}
              value={backgroundScanEnabled}
              onValueChange={handleBackgroundScanToggle}
              disabled={backgroundScanLoading}
            />
          </View>
        </View>

        {/* Network Section */}
        <View className="mt-6">
          <Text className="text-dark-400 text-sm px-4 mb-2 uppercase">
            Network
          </Text>
          <View className="rounded-xl overflow-hidden mx-4">
            <SettingsItem
              Icon={Globe}
              iconColor={ICON_COLORS.success}
              title="Network"
              subtitle={
                network === 'mainnet-beta' ? 'Mainnet' :
                network === 'devnet' ? 'Devnet' : 'Testnet'
              }
              onPress={() => setShowNetworkModal(true)}
            />
            <SettingsItem
              Icon={currentProvider.Icon}
              iconColor={currentProvider.color}
              title="RPC Provider"
              subtitle={currentProvider.name}
              onPress={() => setShowRpcModal(true)}
            />
            <SettingsItem
              Icon={Binoculars}
              iconColor={ICON_COLORS.info}
              title="Default Explorer"
              subtitle={defaultExplorer === 'solscan' ? 'Solscan' : 'Solana Explorer'}
              onPress={() => setShowExplorerModal(true)}
            />
          </View>
        </View>

        {/* App Section */}
        <View className="mt-6">
          <Text className="text-dark-400 text-sm px-4 mb-2 uppercase">
            App
          </Text>
          <View className="rounded-xl overflow-hidden mx-4">
            <SettingsItem
              Icon={ArrowsClockwise}
              iconColor={ICON_COLORS.warning}
              title="Reset Onboarding"
              subtitle="Show education screens again"
              onPress={handleResetOnboarding}
            />
          </View>
        </View>

        {/* About Section */}
        <View className="mt-6 mb-8">
          <Text className="text-dark-400 text-sm px-4 mb-2 uppercase">
            About
          </Text>
          <View className="rounded-xl overflow-hidden mx-4">
            <SettingsItem
              Icon={Info}
              iconColor={ICON_COLORS.info}
              title="About SIP"
              subtitle={`v${appVersion}`}
              onPress={() => setShowAboutModal(true)}
            />
            <SettingsItem
              Icon={BookOpen}
              iconColor={ICON_COLORS.brand}
              title="Documentation"
              subtitle="docs.sip-protocol.org"
              onPress={() => openUrl('https://docs.sip-protocol.org')}
            />
            <SettingsItem
              Icon={Bug}
              iconColor={ICON_COLORS.warning}
              title="Report Issue"
              subtitle="GitHub"
              onPress={() => openUrl('https://github.com/sip-protocol/sip-mobile/issues')}
            />
          </View>
        </View>
      </ScrollView>

      {/* RPC Provider Modal */}
      <Modal
        visible={showRpcModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowRpcModal(false)
          setPendingProvider(null)
          setApiKeyInput('')
        }}
      >
        <Pressable
          className="flex-1 justify-end bg-black/50"
          onPress={() => {
            setShowRpcModal(false)
            setPendingProvider(null)
            setApiKeyInput('')
          }}
        >
          <Pressable className="bg-dark-900 rounded-t-3xl" onPress={(e) => e.stopPropagation()}>
            <View className="p-4 border-b border-dark-800">
              <Text className="text-xl font-bold text-white text-center">
                {pendingProvider ? 'Enter API Key' : 'RPC Provider'}
              </Text>
              <Text className="text-dark-400 text-center text-sm mt-1">
                {pendingProvider
                  ? `Configure ${RPC_PROVIDERS.find((p) => p.id === pendingProvider)?.name}`
                  : 'Select your preferred RPC provider'}
              </Text>
            </View>

            {/* Provider List */}
            {!pendingProvider && (
              <View className="p-4">
                {RPC_PROVIDERS.map((provider) => (
                  <TouchableOpacity
                    key={provider.id}
                    className={`flex-row items-center p-4 rounded-xl mb-2 ${
                      rpcProvider === provider.id
                        ? 'bg-brand-600/20 border border-brand-500'
                        : 'bg-dark-800'
                    }`}
                    onPress={() => handleSelectProvider(provider.id)}
                  >
                    <View className="w-8 items-center mr-3">
                      <provider.Icon size={24} color={provider.color} weight="regular" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-white font-medium">{provider.name}</Text>
                      <Text className="text-dark-400 text-sm">{provider.description}</Text>
                    </View>
                    {rpcProvider === provider.id && (
                      <Check size={20} color={ICON_COLORS.brand} weight="bold" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* API Key Input */}
            {pendingProvider && (
              <View className="p-4">
                <Text className="text-dark-400 text-sm mb-2">
                  {pendingProvider === 'quicknode' ? 'QuickNode API Key' : 'Triton Endpoint URL'}
                </Text>
                <TextInput
                  className="bg-dark-800 border border-dark-700 rounded-xl px-4 py-3 text-white"
                  placeholder={
                    pendingProvider === 'quicknode'
                      ? 'Enter your QuickNode API key...'
                      : 'https://your-triton-endpoint.com'
                  }
                  placeholderTextColor="#71717a"
                  value={apiKeyInput}
                  onChangeText={setApiKeyInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Text className="text-dark-500 text-xs mt-2">
                  {pendingProvider === 'quicknode'
                    ? 'Get your API key from dashboard.quicknode.com'
                    : 'Enter your full Triton gRPC endpoint URL'}
                </Text>

                <View className="flex-row gap-3 mt-4">
                  <TouchableOpacity
                    className="flex-1 bg-dark-800 py-3 rounded-xl"
                    onPress={() => {
                      setPendingProvider(null)
                      setApiKeyInput('')
                    }}
                  >
                    <Text className="text-dark-400 text-center font-medium">Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-1 bg-brand-600 py-3 rounded-xl"
                    onPress={handleSaveApiKey}
                  >
                    <Text className="text-white text-center font-medium">Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {!pendingProvider && (
              <TouchableOpacity
                className="p-4 border-t border-dark-800"
                onPress={() => setShowRpcModal(false)}
              >
                <Text className="text-dark-400 text-center font-medium">Cancel</Text>
              </TouchableOpacity>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Network Modal */}
      <Modal
        visible={showNetworkModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowNetworkModal(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/50"
          onPress={() => setShowNetworkModal(false)}
        >
          <Pressable className="bg-dark-900 rounded-t-3xl" onPress={(e) => e.stopPropagation()}>
            <View className="p-4 border-b border-dark-800">
              <Text className="text-xl font-bold text-white text-center">
                Select Network
              </Text>
            </View>

            <View className="p-4">
              {[
                { id: 'mainnet-beta' as const, name: 'Solana Mainnet', desc: 'Production network', isTest: false },
                { id: 'devnet' as const, name: 'Solana Devnet', desc: 'Development testing', isTest: true },
                { id: 'testnet' as const, name: 'Solana Testnet', desc: 'Validator testing', isTest: true },
              ].map((net) => (
                <TouchableOpacity
                  key={net.id}
                  className={`flex-row items-center p-4 rounded-xl mb-2 ${
                    network === net.id
                      ? 'bg-brand-600/20 border border-brand-500'
                      : 'bg-dark-800'
                  }`}
                  onPress={() => {
                    setNetwork(net.id)
                    setShowNetworkModal(false)
                    addToast({
                      type: 'success',
                      title: 'Network Changed',
                      message: `Switched to ${net.name}`,
                    })
                  }}
                >
                  <View className="flex-1">
                    <Text className="text-white font-medium">{net.name}</Text>
                    <Text className="text-dark-400 text-sm">{net.desc}</Text>
                  </View>
                  {network === net.id && (
                    <Check size={20} color={ICON_COLORS.brand} weight="bold" />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Warning for test networks */}
            <View className="mx-4 mb-4 p-3 bg-yellow-900/20 border border-yellow-700/30 rounded-xl flex-row items-start gap-2">
              <Warning size={20} color={ICON_COLORS.warning} weight="fill" />
              <Text className="text-yellow-500 text-sm flex-1">
                Tokens on test networks (Devnet/Testnet) have no monetary value. Use Mainnet for real transactions.
              </Text>
            </View>

            <TouchableOpacity
              className="p-4 border-t border-dark-800"
              onPress={() => setShowNetworkModal(false)}
            >
              <Text className="text-dark-400 text-center font-medium">Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Privacy Level Modal */}
      <Modal
        visible={showPrivacyLevelModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPrivacyLevelModal(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/50"
          onPress={() => setShowPrivacyLevelModal(false)}
        >
          <Pressable className="bg-dark-900 rounded-t-3xl" onPress={(e) => e.stopPropagation()}>
            <View className="p-4 border-b border-dark-800">
              <Text className="text-xl font-bold text-white text-center">
                Default Privacy Level
              </Text>
              <Text className="text-dark-400 text-center text-sm mt-1">
                Applied to new transactions
              </Text>
            </View>

            <View className="p-4">
              {PRIVACY_LEVELS.map((level) => (
                <TouchableOpacity
                  key={level.id}
                  className={`flex-row items-center p-4 rounded-xl mb-2 ${
                    defaultPrivacyLevel === level.id
                      ? 'bg-brand-600/20 border border-brand-500'
                      : 'bg-dark-800'
                  }`}
                  onPress={() => {
                    setDefaultPrivacyLevel(level.id)
                    setShowPrivacyLevelModal(false)
                    addToast({
                      type: 'success',
                      title: 'Privacy Level Changed',
                      message: `Default set to ${level.name}`,
                    })
                  }}
                >
                  <View className="w-8 items-center mr-3">
                    <level.Icon size={24} color={level.color} weight="regular" />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center">
                      <Text className="text-white font-medium">{level.name}</Text>
                      {level.id === 'shielded' && (
                        <View className="ml-2 px-2 py-0.5 bg-green-900/30 rounded">
                          <Text className="text-green-400 text-xs">Recommended</Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-dark-400 text-sm">{level.description}</Text>
                  </View>
                  {defaultPrivacyLevel === level.id && (
                    <Check size={20} color={ICON_COLORS.brand} weight="bold" />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              className="p-4 border-t border-dark-800"
              onPress={() => setShowPrivacyLevelModal(false)}
            >
              <Text className="text-dark-400 text-center font-medium">Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* About Modal */}
      <Modal
        visible={showAboutModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAboutModal(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/50"
          onPress={() => setShowAboutModal(false)}
        >
          <Pressable className="bg-dark-900 rounded-t-3xl" onPress={(e) => e.stopPropagation()}>
            <View className="p-6 items-center">
              <View className="w-20 h-20 bg-brand-900/30 rounded-full items-center justify-center mb-4">
                <ShieldCheck size={48} color={ICON_COLORS.brand} weight="fill" />
              </View>
              <Text className="text-2xl font-bold text-white">SIP Privacy</Text>
              <Text className="text-dark-400 mt-1">Version {appVersion}</Text>
              <Text className="text-dark-500 text-center mt-4 px-4">
                The privacy standard for Web3. Private transactions on Solana using stealth addresses and Pedersen commitments.
              </Text>
            </View>

            <View className="px-4 pb-4">
              <TouchableOpacity
                className="bg-dark-800 p-4 rounded-xl mb-2"
                onPress={() => {
                  setShowAboutModal(false)
                  openUrl('https://sip-protocol.org')
                }}
              >
                <Text className="text-white text-center font-medium">Visit Website</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="bg-dark-800 p-4 rounded-xl mb-2"
                onPress={() => {
                  setShowAboutModal(false)
                  openUrl('https://twitter.com/saborimeter')
                }}
              >
                <Text className="text-white text-center font-medium">Follow on X</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="bg-dark-800 p-4 rounded-xl"
                onPress={() => {
                  setShowAboutModal(false)
                  openUrl('https://github.com/sip-protocol')
                }}
              >
                <Text className="text-white text-center font-medium">GitHub</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              className="p-4 border-t border-dark-800"
              onPress={() => setShowAboutModal(false)}
            >
              <Text className="text-dark-400 text-center font-medium">Close</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Privacy Provider Modal (#73) */}
      <Modal
        visible={showPrivacyProviderModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPrivacyProviderModal(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/50"
          onPress={() => setShowPrivacyProviderModal(false)}
        >
          <Pressable className="bg-dark-900 rounded-t-3xl" onPress={(e) => e.stopPropagation()}>
            <View className="p-4 border-b border-dark-800">
              <Text className="text-xl font-bold text-white text-center">
                Privacy Provider
              </Text>
              <Text className="text-dark-400 text-center text-sm mt-1">
                Choose your privacy engine
              </Text>
            </View>

            <View className="p-4">
              {PRIVACY_PROVIDERS.map((provider) => {
                const iconInfo = PROVIDER_ICONS[provider.id] || { Icon: Shield, color: ICON_COLORS.muted }
                return (
                  <TouchableOpacity
                    key={provider.id}
                    className={`flex-row items-center p-4 rounded-xl mb-2 ${
                      privacyProvider === provider.id
                        ? 'bg-brand-600/20 border border-brand-500'
                        : 'bg-dark-800'
                    }`}
                    onPress={() => {
                      setPrivacyProvider(provider.id)
                      setShowPrivacyProviderModal(false)
                      addToast({
                        type: 'success',
                        title: 'Provider Changed',
                        message: `Now using ${provider.name}`,
                      })
                    }}
                  >
                    <View className="w-8 items-center mr-3">
                      <iconInfo.Icon size={24} color={iconInfo.color} weight="regular" />
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center">
                        <Text className="text-white font-medium">{provider.name}</Text>
                        {provider.recommended && (
                          <View className="ml-2 px-2 py-0.5 bg-green-900/30 rounded">
                            <Text className="text-green-400 text-xs">Recommended</Text>
                          </View>
                        )}
                        {provider.status === 'coming-soon' && (
                          <View className="ml-2 px-2 py-0.5 bg-yellow-900/30 rounded">
                            <Text className="text-yellow-400 text-xs">Coming Soon</Text>
                          </View>
                        )}
                      </View>
                      <Text className="text-dark-400 text-sm">{provider.description}</Text>
                    </View>
                    {privacyProvider === provider.id && (
                      <Check size={20} color={ICON_COLORS.brand} weight="bold" />
                    )}
                  </TouchableOpacity>
                )
              })}
            </View>

            {/* Info about viewing keys */}
            <View className="mx-4 mb-4 p-3 bg-brand-900/20 border border-brand-700/30 rounded-xl flex-row items-start gap-2">
              <Sparkle size={20} color={ICON_COLORS.brand} weight="fill" />
              <Text className="text-brand-400 text-sm flex-1">
                SIP adds viewing keys to ALL providers for compliance-ready privacy.
              </Text>
            </View>

            <TouchableOpacity
              className="p-4 border-t border-dark-800"
              onPress={() => setShowPrivacyProviderModal(false)}
            >
              <Text className="text-dark-400 text-center font-medium">Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Explorer Modal */}
      <Modal
        visible={showExplorerModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowExplorerModal(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/50"
          onPress={() => setShowExplorerModal(false)}
        >
          <Pressable className="bg-dark-900 rounded-t-3xl" onPress={(e) => e.stopPropagation()}>
            <View className="p-4 border-b border-dark-800">
              <Text className="text-xl font-bold text-white text-center">
                Default Explorer
              </Text>
              <Text className="text-dark-400 text-center text-sm mt-1">
                Choose your preferred block explorer
              </Text>
            </View>

            <View className="p-4">
              {[
                { id: 'solscan' as const, name: 'Solscan', desc: 'Popular Solana explorer' },
                { id: 'solana-explorer' as const, name: 'Solana Explorer', desc: 'Official Solana explorer' },
              ].map((explorer) => (
                <TouchableOpacity
                  key={explorer.id}
                  className={`flex-row items-center p-4 rounded-xl mb-2 ${
                    defaultExplorer === explorer.id
                      ? 'bg-brand-600/20 border border-brand-500'
                      : 'bg-dark-800'
                  }`}
                  onPress={() => {
                    setDefaultExplorer(explorer.id)
                    setShowExplorerModal(false)
                    addToast({
                      type: 'success',
                      title: 'Explorer Changed',
                      message: `Now using ${explorer.name}`,
                    })
                  }}
                >
                  <View className="w-8 items-center mr-3">
                    <Binoculars size={24} color={ICON_COLORS.info} weight="regular" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-white font-medium">{explorer.name}</Text>
                    <Text className="text-dark-400 text-sm">{explorer.desc}</Text>
                  </View>
                  {defaultExplorer === explorer.id && (
                    <Check size={20} color={ICON_COLORS.brand} weight="bold" />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              className="p-4 border-t border-dark-800"
              onPress={() => setShowExplorerModal(false)}
            >
              <Text className="text-dark-400 text-center font-medium">Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}
