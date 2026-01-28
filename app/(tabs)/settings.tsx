import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, Alert, Modal, TextInput, Linking, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import Constants from 'expo-constants'
import { useWalletStore, formatAddress } from '@/stores/wallet'
import { useViewingKeys } from '@/hooks/useViewingKeys'
import { usePrivacyStore } from '@/stores/privacy'
import { useSwapStore } from '@/stores/swap'
import { useSettingsStore } from '@/stores/settings'
import { useToastStore } from '@/stores/toast'
import type { PrivacyLevel } from '@/types'

// Privacy Level options
const PRIVACY_LEVELS: { id: PrivacyLevel; name: string; description: string; icon: string }[] = [
  {
    id: 'shielded',
    name: 'Shielded',
    description: 'Full privacy - hidden sender, amount, recipient',
    icon: '🛡️',
  },
  {
    id: 'compliant',
    name: 'Compliant',
    description: 'Privacy with viewing key for auditors',
    icon: '✅',
  },
  {
    id: 'transparent',
    name: 'Transparent',
    description: 'No privacy - public transaction',
    icon: '👁️',
  },
]

// RPC Provider options with metadata
const RPC_PROVIDERS = [
  {
    id: 'helius' as const,
    name: 'Helius',
    description: 'Fast RPC with DAS support',
    icon: '🔥',
    needsKey: false, // Free tier embedded
  },
  {
    id: 'quicknode' as const,
    name: 'QuickNode',
    description: 'Bring your own API key',
    icon: '⚡',
    needsKey: true,
  },
  {
    id: 'triton' as const,
    name: 'Triton',
    description: 'Bring your own endpoint',
    icon: '🔱',
    needsKey: true,
  },
  {
    id: 'publicnode' as const,
    name: 'PublicNode',
    description: 'Free public RPC',
    icon: '🌐',
    needsKey: false,
  },
] as const

type SettingsItemProps = {
  icon: string
  title: string
  subtitle?: string
  onPress?: () => void
}

function SettingsItem({ icon, title, subtitle, onPress }: SettingsItemProps) {
  return (
    <TouchableOpacity
      className="flex-row items-center p-4 bg-dark-900 border-b border-dark-800"
      onPress={onPress}
    >
      <Text className="text-2xl mr-4">{icon}</Text>
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

export default function SettingsScreen() {
  const { isConnected, address } = useWalletStore()
  const { getActiveDisclosures } = useViewingKeys()
  const { payments, clearPayments } = usePrivacyStore()
  const { swaps, clearHistory: clearSwapHistory } = useSwapStore()
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
  } = useSettingsStore()
  const { addToast } = useToastStore()

  const [showRpcModal, setShowRpcModal] = useState(false)
  const [showNetworkModal, setShowNetworkModal] = useState(false)
  const [showPrivacyLevelModal, setShowPrivacyLevelModal] = useState(false)
  const [showAboutModal, setShowAboutModal] = useState(false)
  const [pendingProvider, setPendingProvider] = useState<typeof rpcProvider | null>(null)
  const [apiKeyInput, setApiKeyInput] = useState('')

  // Get current privacy level info
  const currentPrivacyLevel = PRIVACY_LEVELS.find((p) => p.id === defaultPrivacyLevel) || PRIVACY_LEVELS[0]

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
    } catch (error) {
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

  const handleClearPaymentHistory = () => {
    Alert.alert(
      'Clear Payment History',
      `This will remove ${payments.length} payment records from your device. On-chain data is not affected. You can rescan to recover.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            clearPayments()
            addToast({
              type: 'success',
              title: 'History Cleared',
              message: 'Payment history has been cleared. Rescan to recover.',
            })
          },
        },
      ]
    )
  }

  const handleClearSwapHistory = () => {
    Alert.alert(
      'Clear Swap History',
      `This will remove ${swaps.length} swap records from your device.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            clearSwapHistory()
            addToast({
              type: 'success',
              title: 'History Cleared',
              message: 'Swap history has been cleared.',
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
      <ScrollView className="flex-1">
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
              icon="👛"
              title="Accounts"
              subtitle={isConnected ? formatAddress(address) : 'Not connected'}
              onPress={() => router.push('/settings/accounts')}
            />
            <SettingsItem
              icon="🔑"
              title="Viewing Keys"
              subtitle={disclosureSubtitle}
              onPress={() => router.push('/settings/viewing-keys')}
            />
            <SettingsItem
              icon="🔐"
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
              icon={currentPrivacyLevel.icon}
              title="Privacy Level"
              subtitle={`${currentPrivacyLevel.name}${defaultPrivacyLevel === 'shielded' ? ' (recommended)' : ''}`}
              onPress={() => setShowPrivacyLevelModal(true)}
            />
            <SettingsItem
              icon="📊"
              title="Privacy Score"
              subtitle="Check wallet exposure"
              onPress={() => router.push('/settings/privacy-score')}
            />
            <SettingsItem
              icon="🔍"
              title="Compliance Dashboard"
              subtitle="For institutions"
              onPress={() => router.push('/settings/compliance')}
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
              icon="🌐"
              title="Network"
              subtitle={
                network === 'mainnet-beta' ? 'Mainnet' :
                network === 'devnet' ? 'Devnet' : 'Testnet'
              }
              onPress={() => setShowNetworkModal(true)}
            />
            <SettingsItem
              icon={currentProvider.icon}
              title="RPC Provider"
              subtitle={currentProvider.name}
              onPress={() => setShowRpcModal(true)}
            />
          </View>
        </View>

        {/* Data & Storage Section */}
        <View className="mt-6">
          <Text className="text-dark-400 text-sm px-4 mb-2 uppercase">
            Data & Storage
          </Text>
          <View className="rounded-xl overflow-hidden mx-4">
            <SettingsItem
              icon="🗑️"
              title="Clear Payment History"
              subtitle={`${payments.length} records`}
              onPress={handleClearPaymentHistory}
            />
            <SettingsItem
              icon="🔄"
              title="Clear Swap History"
              subtitle={`${swaps.length} records`}
              onPress={handleClearSwapHistory}
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
              icon="ℹ️"
              title="About SIP"
              subtitle={`v${appVersion}`}
              onPress={() => setShowAboutModal(true)}
            />
            <SettingsItem
              icon="📖"
              title="Documentation"
              subtitle="docs.sip-protocol.org"
              onPress={() => openUrl('https://docs.sip-protocol.org')}
            />
            <SettingsItem
              icon="🐛"
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
                    <Text className="text-2xl mr-3">{provider.icon}</Text>
                    <View className="flex-1">
                      <Text className="text-white font-medium">{provider.name}</Text>
                      <Text className="text-dark-400 text-sm">{provider.description}</Text>
                    </View>
                    {rpcProvider === provider.id && (
                      <Text className="text-brand-400 text-lg">✓</Text>
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
                    <Text className="text-brand-400 text-lg">✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Warning for test networks */}
            <View className="mx-4 mb-4 p-3 bg-yellow-900/20 border border-yellow-700/30 rounded-xl">
              <Text className="text-yellow-500 text-sm">
                ⚠️ Tokens on test networks (Devnet/Testnet) have no monetary value. Use Mainnet for real transactions.
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
                  <Text className="text-2xl mr-3">{level.icon}</Text>
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
                    <Text className="text-brand-400 text-lg">✓</Text>
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
              <Text className="text-5xl mb-4">🛡️</Text>
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
    </SafeAreaView>
  )
}
