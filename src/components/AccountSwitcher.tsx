/**
 * Account Switcher Component
 *
 * Quick dropdown for switching between connected accounts.
 * Shows active account with option to switch or add new.
 */

import { View, Text, TouchableOpacity, ScrollView } from "react-native"
import { useState } from "react"
import {
  ShieldCheckIcon,
  DeviceMobileIcon,
  GhostIcon,
  WalletIcon,
  CheckIcon,
  PlusIcon,
  GearSixIcon,
  CaretDownIcon,
} from "phosphor-react-native"
import type { Icon as PhosphorIcon } from "phosphor-react-native"
import { useWalletStore, formatAddress } from "@/stores/wallet"
import { Modal } from "@/components/ui"
import { ICON_COLORS } from "@/constants/icons"
import type { StoredAccount } from "@/types"

interface AccountSwitcherProps {
  onAddAccount?: () => void
  onManageAccounts?: () => void
}

export function AccountSwitcher({ onAddAccount, onManageAccounts }: AccountSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { accounts, activeAccountId, setActiveAccount } = useWalletStore()

  const activeAccount = accounts.find((a) => a.id === activeAccountId)

  const handleSelectAccount = (account: StoredAccount) => {
    setActiveAccount(account.id)
    setIsOpen(false)
  }

  const getProviderIcon = (providerType: string): PhosphorIcon => {
    switch (providerType) {
      case "privy":
        return ShieldCheckIcon
      case "mwa":
        return DeviceMobileIcon
      case "phantom":
        return GhostIcon
      default:
        return WalletIcon
    }
  }

  const getProviderLabel = (providerType: string): string => {
    switch (providerType) {
      case "privy":
        return "Embedded"
      case "mwa":
        return "MWA"
      case "phantom":
        return "Phantom"
      default:
        return "Wallet"
    }
  }

  if (!activeAccount) {
    return null
  }

  const ActiveIcon = getProviderIcon(activeAccount.providerType)

  return (
    <>
      {/* Trigger Button */}
      <TouchableOpacity
        className="flex-row items-center bg-dark-900 rounded-xl px-3 py-2"
        onPress={() => setIsOpen(true)}
      >
        <ActiveIcon size={20} color={ICON_COLORS.brand} weight="regular" />
        <View className="flex-1 ml-2">
          <Text className="text-white font-medium text-sm" numberOfLines={1}>
            {activeAccount.nickname}
          </Text>
          <Text className="text-dark-500 text-xs">
            {formatAddress(activeAccount.address)}
          </Text>
        </View>
        {accounts.length > 1 && (
          <View className="bg-brand-600 rounded-full w-5 h-5 items-center justify-center ml-2">
            <Text className="text-white text-xs font-bold">{accounts.length}</Text>
          </View>
        )}
        <View className="ml-2">
          <CaretDownIcon size={16} color={ICON_COLORS.dark} weight="bold" />
        </View>
      </TouchableOpacity>

      {/* Account Selector Modal */}
      <Modal visible={isOpen} onClose={() => setIsOpen(false)} title="Switch Account">
        <ScrollView className="max-h-80">
          {accounts.map((account) => {
            const ProviderIcon = getProviderIcon(account.providerType)
            return (
              <TouchableOpacity
                key={account.id}
                className={`flex-row items-center p-4 rounded-xl mb-2 ${
                  account.id === activeAccountId
                    ? "bg-brand-900/30 border border-brand-700"
                    : "bg-dark-900 border border-dark-800"
                }`}
                onPress={() => handleSelectAccount(account)}
              >
                <View className="w-10 h-10 bg-dark-800 rounded-xl items-center justify-center">
                  <ProviderIcon size={24} color={ICON_COLORS.brand} weight="regular" />
                </View>
                <View className="flex-1 ml-3">
                  <View className="flex-row items-center">
                    <Text className="text-white font-semibold">{account.nickname}</Text>
                    {account.id === activeAccountId && (
                      <View className="ml-2 px-2 py-0.5 bg-brand-600 rounded">
                        <Text className="text-xs text-white">Active</Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-dark-500 text-sm">
                    {formatAddress(account.address)}
                  </Text>
                  <Text className="text-dark-600 text-xs mt-0.5">
                    {getProviderLabel(account.providerType)} • {account.chain}
                  </Text>
                </View>
                {account.id === activeAccountId && (
                  <CheckIcon size={24} color={ICON_COLORS.brand} weight="bold" />
                )}
              </TouchableOpacity>
            )
          })}
        </ScrollView>

        {/* Actions */}
        <View className="mt-4 pt-4 border-t border-dark-800">
          {onAddAccount && (
            <TouchableOpacity
              className="flex-row items-center p-3 rounded-xl bg-dark-900 mb-2"
              onPress={() => {
                setIsOpen(false)
                onAddAccount()
              }}
            >
              <View className="w-8 h-8 bg-brand-600/20 rounded-lg items-center justify-center">
                <PlusIcon size={20} color={ICON_COLORS.brand} weight="bold" />
              </View>
              <Text className="text-brand-400 font-medium ml-3">Add Another Account</Text>
            </TouchableOpacity>
          )}

          {onManageAccounts && (
            <TouchableOpacity
              className="flex-row items-center p-3 rounded-xl bg-dark-900"
              onPress={() => {
                setIsOpen(false)
                onManageAccounts()
              }}
            >
              <View className="w-8 h-8 bg-dark-800 rounded-lg items-center justify-center">
                <GearSixIcon size={20} color={ICON_COLORS.muted} weight="regular" />
              </View>
              <Text className="text-dark-400 font-medium ml-3">Manage Accounts</Text>
            </TouchableOpacity>
          )}
        </View>
      </Modal>
    </>
  )
}

/**
 * Compact account indicator for headers
 */
export function AccountIndicator({ onPress }: { onPress?: () => void }) {
  const { accounts, activeAccountId } = useWalletStore()
  const activeAccount = accounts.find((a) => a.id === activeAccountId)

  if (!activeAccount) {
    return null
  }

  return (
    <TouchableOpacity
      className="flex-row items-center bg-dark-900/50 rounded-full px-3 py-1.5"
      onPress={onPress}
    >
      <View className="w-6 h-6 bg-brand-600 rounded-full items-center justify-center">
        <Text className="text-white text-xs font-bold">
          {activeAccount.nickname.charAt(0).toUpperCase()}
        </Text>
      </View>
      <Text className="text-white text-sm ml-2">{formatAddress(activeAccount.address)}</Text>
      {accounts.length > 1 && (
        <Text className="text-dark-500 text-xs ml-1">+{accounts.length - 1}</Text>
      )}
    </TouchableOpacity>
  )
}
