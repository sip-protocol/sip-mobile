/**
 * Sidebar Navigation Component
 *
 * Slide-out sidebar with account info, navigation menu, and settings links.
 * Adapted from Jupiter Mobile sidebar pattern.
 *
 * Shows:
 * - Active account (avatar, nickname, formatted address with copy)
 * - Account section: Manage, History, Viewing Keys, Security & Backup
 * - Network section: Network, RPC Provider (with current values)
 * - About section: About SIP, Documentation, Report Issue
 * - Bottom bar: Get Help, Settings
 */

import React from "react"
import { View, Text, TouchableOpacity, Modal, ScrollView, Linking } from "react-native"
import { router } from "expo-router"
import { useWalletStore, formatAddress } from "@/stores/wallet"
import { useSettingsStore } from "@/stores/settings"
import { AccountAvatar } from "./AccountAvatar"
import { ICONS, ICON_COLORS } from "@/constants/icons"
import { QuestionIcon, GearIcon } from "phosphor-react-native"
import * as Clipboard from "expo-clipboard"
import { hapticLight } from "@/utils/haptics"

// ============================================================================
// TYPES
// ============================================================================

interface SidebarProps {
  visible: boolean
  onClose: () => void
}

interface MenuItem {
  icon: React.ReactNode
  label: string
  detail?: string
  onPress: () => void
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Section titles for the sidebar menu
 */
const SECTION_TITLES = {
  account: "Account",
  network: "Network",
  about: "About",
} as const

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function MenuSection({ title, items }: { title: string; items: MenuItem[] }) {
  return (
    <View className="mb-4">
      <Text className="text-zinc-500 text-xs font-medium uppercase tracking-wider px-4 mb-2">
        {title}
      </Text>
      {items.map((item) => (
        <TouchableOpacity
          key={item.label}
          onPress={item.onPress}
          className="flex-row items-center px-4 py-3"
          accessibilityRole="button"
          accessibilityLabel={item.label}
        >
          {item.icon}
          <Text className="text-zinc-200 text-base ml-3 flex-1">
            {item.label}
          </Text>
          {item.detail && (
            <Text className="text-zinc-500 text-sm">
              {item.detail}
            </Text>
          )}
        </TouchableOpacity>
      ))}
    </View>
  )
}

// ============================================================================
// COMPONENT
// ============================================================================

export function Sidebar({ visible, onClose }: SidebarProps) {
  const { accounts, activeAccountId } = useWalletStore()
  const { network, rpcProvider } = useSettingsStore()
  const activeAccount = accounts.find((a) => a.id === activeAccountId)
  const [showAccountPicker, setShowAccountPicker] = React.useState(false)

  if (!visible || !activeAccount) return null

  const navigate = (path: string) => {
    // Push FIRST, then close. The old order (close, then router.push after
    // a fixed 150ms setTimeout) races the sidebar Modal's native iOS
    // dismissal: pushing while that presentation is still tearing down gets
    // the push silently dropped, the drawer stays open and the destination
    // never renders — iOS run 36647489122: all 10 settings tests failed
    // this way (drawer open in every failure screenshot, hub never
    // rendered). Android's faster dismissal won the race, masking it.
    // Navigating before close needs no timing: the route change unmounts
    // this Modal together with the tabs screen.
    // expo-router's Href union doesn't accept a bare string param.
    router.push(path as unknown as Parameters<typeof router.push>[0])
    onClose()
  }

  const handleCopyAddress = async () => {
    try {
      await Clipboard.setStringAsync(activeAccount.address)
      hapticLight()
    } catch {
      // Clipboard unavailable on some devices
    }
  }

  // --------------------------------------------------------------------------
  // Menu sections
  // --------------------------------------------------------------------------

  const accountSection: MenuItem[] = [
    {
      icon: <ICONS.wallet.accounts size={22} color={ICON_COLORS.inactive} />,
      label: "Manage",
      onPress: () => navigate("/settings/accounts"),
    },
    {
      icon: <ICONS.status.pending size={22} color={ICON_COLORS.inactive} />,
      label: "History",
      onPress: () => navigate("/history"),
    },
    {
      icon: <ICONS.wallet.viewingKeys size={22} color={ICON_COLORS.inactive} />,
      label: "Viewing Keys",
      onPress: () => navigate("/settings/viewing-keys"),
    },
    {
      icon: <ICONS.wallet.security size={22} color={ICON_COLORS.inactive} />,
      label: "Security & Backup",
      onPress: () => navigate("/settings/security"),
    },
  ]

  const networkSection: MenuItem[] = [
    {
      icon: <ICONS.network.network size={22} color={ICON_COLORS.inactive} />,
      label: "Network",
      detail: network,
      onPress: () => navigate("/settings"),
    },
    {
      icon: <ICONS.network.rpc size={22} color={ICON_COLORS.inactive} />,
      label: "RPC Provider",
      detail: rpcProvider,
      onPress: () => navigate("/settings"),
    },
  ]

  const aboutSection: MenuItem[] = [
    {
      icon: <ICONS.about.info size={22} color={ICON_COLORS.inactive} />,
      label: "About SIP",
      onPress: () => Linking.openURL("https://sip-protocol.org"),
    },
    {
      icon: <ICONS.about.docs size={22} color={ICON_COLORS.inactive} />,
      label: "Documentation",
      onPress: () => Linking.openURL("https://docs.sip-protocol.org"),
    },
    {
      icon: <ICONS.about.bug size={22} color={ICON_COLORS.inactive} />,
      label: "Report Issue",
      onPress: () => Linking.openURL("https://github.com/sip-protocol/sip-mobile/issues"),
    },
  ]

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 flex-row">
        {/* Left panel */}
        <View className="w-[280px] bg-dark-900 flex-1">
          {/* Account header */}
          <View className="pt-16 pb-4 px-4 border-b border-zinc-800">
            <View className="flex-row items-center justify-between mb-3">
              <AccountAvatar emoji={activeAccount.emoji || ""} size="lg" />
              <TouchableOpacity
                onPress={() => setShowAccountPicker(!showAccountPicker)}
                className="bg-zinc-800 px-4 py-2 rounded-full"
                accessibilityRole="button"
                accessibilityLabel="Switch account"
              >
                <Text className="text-zinc-300 text-sm font-medium">
                  {showAccountPicker ? "Close" : "Switch"}
                </Text>
              </TouchableOpacity>
            </View>
            <Text className="text-white text-lg font-semibold">
              {activeAccount.nickname}
            </Text>
            <TouchableOpacity
              onPress={handleCopyAddress}
              className="flex-row items-center mt-1"
              accessibilityRole="button"
              accessibilityLabel="Copy address"
            >
              <Text className="text-zinc-400 text-sm mr-2">
                {formatAddress(activeAccount.address)}
              </Text>
              <ICONS.actions.copy size={14} color={ICON_COLORS.inactive} />
            </TouchableOpacity>
          </View>

          {/* Account Picker */}
          {showAccountPicker && (
            <View className="border-b border-zinc-800">
              {accounts.map((account) => (
                <TouchableOpacity
                  key={account.id}
                  onPress={() => {
                    if (account.id !== activeAccountId) {
                      useWalletStore.getState().setActiveAccount(account.id)
                    }
                    setShowAccountPicker(false)
                  }}
                  className="flex-row items-center px-4 py-3"
                  accessibilityRole="button"
                  accessibilityLabel={`Switch to ${account.nickname}`}
                >
                  <AccountAvatar emoji={account.emoji || ""} size="sm" />
                  <View className="flex-1 ml-3">
                    <Text className="text-zinc-200 text-sm">{account.nickname}</Text>
                    <Text className="text-zinc-500 text-xs">{formatAddress(account.address)}</Text>
                  </View>
                  {account.id === activeAccountId && (
                    <ICONS.status.confirmed size={18} color={ICON_COLORS.brand} />
                  )}
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                onPress={() => {
                  // Push before close — same iOS Modal-dismissal race as
                  // navigate() above (a 150ms delayed push gets dropped).
                  router.push("/(auth)/wallet-setup?addAccount=true" as unknown as Parameters<typeof router.push>[0])
                  onClose()
                }}
                className="flex-row items-center px-4 py-3"
                accessibilityRole="button"
                accessibilityLabel="Add another wallet"
              >
                <View className="w-8 h-8 rounded-full bg-zinc-800 items-center justify-center">
                  <Text className="text-zinc-400 text-lg">+</Text>
                </View>
                <Text className="text-zinc-400 text-sm ml-3">Add Wallet</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Scrollable menu */}
          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            <View className="pt-4">
              <MenuSection title={SECTION_TITLES.account} items={accountSection} />
              <MenuSection title={SECTION_TITLES.network} items={networkSection} />
              <MenuSection title={SECTION_TITLES.about} items={aboutSection} />
            </View>
          </ScrollView>

          {/* Bottom bar */}
          <View className="flex-row items-center justify-between px-4 py-4 border-t border-zinc-800">
            <TouchableOpacity
              onPress={() => Linking.openURL("https://docs.sip-protocol.org")}
              className="flex-row items-center"
              accessibilityRole="button"
              accessibilityLabel="Get help"
            >
              <QuestionIcon size={20} color={ICON_COLORS.inactive} />
              <Text className="text-zinc-400 text-sm ml-2">Get help</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigate("/settings")}
              className="flex-row items-center"
              accessibilityRole="button"
              accessibilityLabel="Settings"
            >
              <GearIcon size={20} color={ICON_COLORS.inactive} />
              <Text className="text-zinc-400 text-sm ml-2">Settings</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Backdrop (right side) */}
        <TouchableOpacity
          onPress={onClose}
          className="flex-1 bg-black/60"
          activeOpacity={1}
          accessibilityRole="button"
          accessibilityLabel="Close sidebar"
        />
      </View>
    </Modal>
  )
}
