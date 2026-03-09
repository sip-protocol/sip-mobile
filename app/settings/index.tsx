/**
 * Settings Hub Screen
 *
 * Central settings page with:
 * - Network selection (mainnet-beta, devnet, testnet)
 * - RPC provider selection
 * - Explorer preference
 * - About SIP section
 * - Help & support links
 */

import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Linking,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import {
  ArrowLeftIcon,
  GlobeIcon,
  BookOpenIcon,
  BugIcon,
  ShieldCheckIcon,
  QuestionIcon,
  CheckCircleIcon,
  CaretRightIcon,
  LockKeyIcon,
  KeyIcon,
  UserIcon,
  EyeIcon,
  EyeSlashIcon,
  DownloadSimpleIcon,
} from "phosphor-react-native"
import type { Icon as PhosphorIcon } from "phosphor-react-native"
import { ICON_COLORS } from "@/constants/icons"
import Constants from "expo-constants"
import { useSettingsStore } from "@/stores/settings"
import type { ExplorerType } from "@/stores/settings"

// ============================================================================
// TYPES
// ============================================================================

type NetworkOption = "mainnet-beta" | "devnet" | "testnet"
type RpcOption = "helius" | "quicknode" | "triton" | "publicnode"

// ============================================================================
// CONSTANTS
// ============================================================================

const NETWORK_OPTIONS: { value: NetworkOption; label: string; desc: string }[] = [
  { value: "mainnet-beta", label: "Mainnet", desc: "Production network" },
  { value: "devnet", label: "Devnet", desc: "Development testing" },
  { value: "testnet", label: "Testnet", desc: "Validator testing" },
]

const RPC_OPTIONS: { value: RpcOption; label: string; desc: string }[] = [
  { value: "helius", label: "Helius", desc: "Premium RPC (API key required)" },
  { value: "publicnode", label: "PublicNode", desc: "Free public RPC" },
  { value: "quicknode", label: "QuickNode", desc: "Enterprise RPC (API key required)" },
  { value: "triton", label: "Triton", desc: "Solana-native RPC (custom endpoint)" },
]

const EXPLORER_OPTIONS: { value: ExplorerType; label: string }[] = [
  { value: "solscan", label: "Solscan" },
  { value: "solana-explorer", label: "Solana Explorer" },
]

const APP_VERSION = Constants.expoConfig?.version ?? "0.0.0"

// ============================================================================
// COMPONENTS
// ============================================================================

function SectionTitle({ title }: { title: string }) {
  return (
    <Text className="text-zinc-500 text-xs font-medium uppercase tracking-wider mb-2 mt-6">
      {title}
    </Text>
  )
}

function SelectOption({
  label,
  desc,
  isSelected,
  onPress,
}: {
  label: string
  desc?: string
  isSelected: boolean
  onPress: () => void
}) {
  return (
    <TouchableOpacity
      className={`flex-row items-center py-3 px-4 border-b border-dark-800 ${
        isSelected ? "bg-brand-900/20" : ""
      }`}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={`${label}${desc ? `, ${desc}` : ""}`}
    >
      <View className="flex-1">
        <Text className={`font-medium ${isSelected ? "text-brand-400" : "text-white"}`}>
          {label}
        </Text>
        {desc && <Text className="text-dark-500 text-sm">{desc}</Text>}
      </View>
      {isSelected && (
        <CheckCircleIcon size={20} color={ICON_COLORS.brand} weight="fill" />
      )}
    </TouchableOpacity>
  )
}

function NavRow({
  Icon,
  iconColor,
  title,
  subtitle,
  onPress,
}: {
  Icon: PhosphorIcon
  iconColor: string
  title: string
  subtitle?: string
  onPress: () => void
}) {
  return (
    <TouchableOpacity
      className="flex-row items-center py-4 px-4 border-b border-dark-800"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <Icon size={22} color={iconColor} weight="regular" />
      <View className="flex-1 ml-3">
        <Text className="text-white font-medium">{title}</Text>
        {subtitle && <Text className="text-dark-500 text-sm">{subtitle}</Text>}
      </View>
      <CaretRightIcon size={16} color={ICON_COLORS.inactive} weight="bold" />
    </TouchableOpacity>
  )
}

function LinkRow({
  Icon,
  iconColor,
  title,
  url,
}: {
  Icon: PhosphorIcon
  iconColor: string
  title: string
  url: string
}) {
  return (
    <TouchableOpacity
      className="flex-row items-center py-4 px-4 border-b border-dark-800"
      onPress={() => Linking.openURL(url)}
      accessibilityRole="link"
      accessibilityLabel={title}
    >
      <Icon size={22} color={iconColor} weight="regular" />
      <Text className="text-white font-medium ml-3 flex-1">{title}</Text>
      <Text className="text-dark-600 text-sm">↗</Text>
    </TouchableOpacity>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SettingsScreen() {
  const {
    network,
    setNetwork,
    rpcProvider,
    setRpcProvider,
    defaultExplorer,
    setDefaultExplorer,
    hideBalances,
    toggleHideBalances,
  } = useSettingsStore()

  return (
    <SafeAreaView className="flex-1 bg-dark-950">
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-dark-900">
        <TouchableOpacity
          className="flex-row items-center"
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeftIcon size={24} color={ICON_COLORS.white} weight="bold" />
          <Text className="text-white ml-4 text-lg">Back</Text>
        </TouchableOpacity>
        <Text className="text-xl font-bold text-white">Settings</Text>
        <View className="w-16" />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-6 pb-8">
          {/* Quick Links */}
          <SectionTitle title="Account" />
          <View className="bg-dark-900 rounded-xl border border-dark-800 overflow-hidden">
            <NavRow
              Icon={UserIcon}
              iconColor={ICON_COLORS.brand}
              title="Manage Accounts"
              subtitle="View, edit, remove accounts"
              onPress={() => router.push("/settings/accounts")}
            />
            <NavRow
              Icon={LockKeyIcon}
              iconColor={ICON_COLORS.cyan}
              title="Security"
              subtitle="Biometrics, PIN, auto-lock"
              onPress={() => router.push("/settings/security")}
            />
            <NavRow
              Icon={KeyIcon}
              iconColor={ICON_COLORS.warning}
              title="Backup Recovery Phrase"
              subtitle="View and backup your seed phrase"
              onPress={() => router.push("/settings/backup")}
            />
            <NavRow
              Icon={EyeIcon}
              iconColor={ICON_COLORS.info}
              title="Viewing Keys"
              subtitle="Export, import, manage disclosures"
              onPress={() => router.push("/settings/viewing-keys")}
            />
            <NavRow
              Icon={DownloadSimpleIcon}
              iconColor={ICON_COLORS.success}
              title="Backup Stealth Keys"
              subtitle="Export or restore your stealth key archive"
              onPress={() => router.push("/settings/stealth-backup" as any)}
            />
          </View>

          {/* Display */}
          <SectionTitle title="Display" />
          <View className="bg-dark-900 rounded-xl border border-dark-800 overflow-hidden">
            <TouchableOpacity
              className="flex-row items-center py-4 px-4"
              onPress={toggleHideBalances}
              accessibilityRole="switch"
              accessibilityState={{ checked: hideBalances }}
              accessibilityLabel="Hide balances"
            >
              {hideBalances ? (
                <EyeSlashIcon size={22} color={ICON_COLORS.warning} weight="regular" />
              ) : (
                <EyeIcon size={22} color={ICON_COLORS.success} weight="regular" />
              )}
              <View className="flex-1 ml-3">
                <Text className="text-white font-medium">Hide Balances</Text>
                <Text className="text-dark-500 text-sm">
                  {hideBalances ? "Balances are hidden" : "Balances are visible"}
                </Text>
              </View>
              <View className={`w-12 h-7 rounded-full justify-center ${hideBalances ? "bg-brand-600" : "bg-dark-700"}`}>
                <View className={`w-5 h-5 rounded-full bg-white ${hideBalances ? "ml-6" : "ml-1"}`} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Network */}
          <SectionTitle title="Network" />
          <View className="bg-dark-900 rounded-xl border border-dark-800 overflow-hidden">
            {NETWORK_OPTIONS.map((opt) => (
              <SelectOption
                key={opt.value}
                label={opt.label}
                desc={opt.desc}
                isSelected={network === opt.value}
                onPress={() => setNetwork(opt.value)}
              />
            ))}
          </View>

          {/* RPC Provider */}
          <SectionTitle title="RPC Provider" />
          <View className="bg-dark-900 rounded-xl border border-dark-800 overflow-hidden">
            {RPC_OPTIONS.map((opt) => (
              <SelectOption
                key={opt.value}
                label={opt.label}
                desc={opt.desc}
                isSelected={rpcProvider === opt.value}
                onPress={() => setRpcProvider(opt.value)}
              />
            ))}
          </View>

          {/* Explorer */}
          <SectionTitle title="Block Explorer" />
          <View className="bg-dark-900 rounded-xl border border-dark-800 overflow-hidden">
            {EXPLORER_OPTIONS.map((opt) => (
              <SelectOption
                key={opt.value}
                label={opt.label}
                isSelected={defaultExplorer === opt.value}
                onPress={() => setDefaultExplorer(opt.value)}
              />
            ))}
          </View>

          {/* About & Help */}
          <SectionTitle title="About & Help" />
          <View className="bg-dark-900 rounded-xl border border-dark-800 overflow-hidden">
            <LinkRow
              Icon={BookOpenIcon}
              iconColor={ICON_COLORS.info}
              title="Documentation"
              url="https://docs.sip-protocol.org"
            />
            <LinkRow
              Icon={BugIcon}
              iconColor={ICON_COLORS.error}
              title="Report Issue"
              url="https://github.com/sip-protocol/sip-mobile/issues"
            />
            <LinkRow
              Icon={QuestionIcon}
              iconColor={ICON_COLORS.cyan}
              title="Get Help"
              url="https://docs.sip-protocol.org"
            />
            <LinkRow
              Icon={GlobeIcon}
              iconColor={ICON_COLORS.brand}
              title="Website"
              url="https://sip-protocol.org"
            />
          </View>

          {/* App Info */}
          <View className="mt-6 items-center">
            <View className="flex-row items-center mb-2">
              <ShieldCheckIcon size={20} color={ICON_COLORS.brand} weight="fill" />
              <Text className="text-brand-400 font-semibold text-lg ml-2">
                SIP Privacy
              </Text>
            </View>
            <Text className="text-dark-500 text-sm">
              Version {APP_VERSION}
            </Text>
            <Text className="text-dark-600 text-xs mt-1">
              The Privacy Wallet for Solana
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
