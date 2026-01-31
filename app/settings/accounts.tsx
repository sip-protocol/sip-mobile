/**
 * Accounts Management Screen
 *
 * Full account management:
 * - View all connected accounts
 * - Edit account nicknames
 * - Remove accounts
 * - Navigate to add new account
 */

import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { useState } from "react"
import { useWalletStore, formatAddress } from "@/stores/wallet"
import { useNativeWallet } from "@/hooks"
import { Button, Modal } from "@/components/ui"
import type { StoredAccount } from "@/types"
import {
  ArrowLeft,
  LockKey,
  DeviceMobile,
  Ghost,
  CreditCard,
  Check,
  PencilSimple,
  Trash,
} from "phosphor-react-native"
import type { Icon as PhosphorIcon } from "phosphor-react-native"
import { ICON_COLORS } from "@/constants/icons"

export default function AccountsScreen() {
  const {
    accounts,
    activeAccountId,
    setActiveAccount,
    removeAccount,
    updateAccountNickname,
  } = useWalletStore()
  const { deleteWallet } = useNativeWallet()

  const [editingAccount, setEditingAccount] = useState<StoredAccount | null>(null)
  const [editNickname, setEditNickname] = useState("")

  const handleStartEdit = (account: StoredAccount) => {
    setEditingAccount(account)
    setEditNickname(account.nickname)
  }

  const handleSaveNickname = () => {
    if (editingAccount && editNickname.trim()) {
      updateAccountNickname(editingAccount.id, editNickname.trim())
      setEditingAccount(null)
      setEditNickname("")
    }
  }

  const handleRemoveAccount = (account: StoredAccount) => {
    const isActive = account.id === activeAccountId
    const isLastAccount = accounts.length <= 1
    const message = isActive
      ? isLastAccount
        ? "This is your only account. Removing it will log you out."
        : "This is your active account. Removing it will switch to another account."
      : "Are you sure you want to remove this account?"

    Alert.alert(
      "Remove Account",
      message,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            // For native wallets, also delete from SecureStore
            if (account.providerType === "native" || account.providerType === "seed-vault") {
              try {
                await deleteWallet()
              } catch {
                // deleteWallet handles its own errors, just proceed
              }
            }

            removeAccount(account.id)

            if (isLastAccount) {
              // Navigate to wallet setup so user can create new wallet
              router.replace("/(auth)/wallet-setup")
            }
          },
        },
      ]
    )
  }

  const handleSetActive = (account: StoredAccount) => {
    if (account.id !== activeAccountId) {
      setActiveAccount(account.id)
    }
  }

  const getProviderIcon = (providerType: string): PhosphorIcon => {
    switch (providerType) {
      case "privy":
        return LockKey
      case "mwa":
        return DeviceMobile
      case "phantom":
        return Ghost
      default:
        return CreditCard
    }
  }

  const getProviderLabel = (providerType: string): string => {
    switch (providerType) {
      case "privy":
        return "Embedded Wallet"
      case "mwa":
        return "Mobile Wallet Adapter"
      case "phantom":
        return "Phantom Deeplink"
      default:
        return "External Wallet"
    }
  }

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  return (
    <SafeAreaView className="flex-1 bg-dark-950">
      {/* Header */}
      <View className="flex-row items-center px-6 py-4 border-b border-dark-900">
        <TouchableOpacity
          className="flex-row items-center"
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={ICON_COLORS.white} weight="bold" />
          <Text className="text-white ml-4 text-lg">Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-6">
        {/* Title */}
        <View className="py-6">
          <Text className="text-2xl font-bold text-white mb-2">
            Manage Accounts
          </Text>
          <Text className="text-dark-400">
            {accounts.length} {accounts.length === 1 ? "account" : "accounts"} connected
          </Text>
        </View>

        {/* Accounts List */}
        <View className="gap-3">
          {accounts.map((account) => (
            <View
              key={account.id}
              className={`p-4 rounded-xl border ${
                account.id === activeAccountId
                  ? "bg-brand-900/20 border-brand-700"
                  : "bg-dark-900 border-dark-800"
              }`}
            >
              {/* Account Header */}
              <TouchableOpacity
                className="flex-row items-start"
                onPress={() => handleSetActive(account)}
              >
                <View className="w-12 h-12 bg-dark-800 rounded-xl items-center justify-center">
                  {(() => {
                    const IconComp = getProviderIcon(account.providerType)
                    return <IconComp size={24} color={ICON_COLORS.brand} weight="fill" />
                  })()}
                </View>
                <View className="flex-1 ml-3">
                  <View className="flex-row items-center">
                    <Text className="text-white font-semibold text-lg">
                      {account.nickname}
                    </Text>
                    {account.id === activeAccountId && (
                      <View className="ml-2 px-2 py-0.5 bg-brand-600 rounded">
                        <Text className="text-xs text-white font-medium">Active</Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-dark-400 text-sm mt-0.5">
                    {formatAddress(account.address)}
                  </Text>
                </View>
                {account.id === activeAccountId && (
                  <Check size={24} color={ICON_COLORS.brand} weight="bold" />
                )}
              </TouchableOpacity>

              {/* Account Details */}
              <View className="mt-4 pt-4 border-t border-dark-800">
                <View className="flex-row justify-between mb-2">
                  <Text className="text-dark-500 text-sm">Provider</Text>
                  <Text className="text-dark-300 text-sm">
                    {getProviderLabel(account.providerType)}
                  </Text>
                </View>
                <View className="flex-row justify-between mb-2">
                  <Text className="text-dark-500 text-sm">Chain</Text>
                  <Text className="text-dark-300 text-sm capitalize">
                    {account.chain}
                  </Text>
                </View>
                <View className="flex-row justify-between mb-2">
                  <Text className="text-dark-500 text-sm">Added</Text>
                  <Text className="text-dark-300 text-sm">
                    {formatDate(account.createdAt)}
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-dark-500 text-sm">Last Used</Text>
                  <Text className="text-dark-300 text-sm">
                    {formatDate(account.lastUsedAt)}
                  </Text>
                </View>
              </View>

              {/* Account Actions */}
              <View className="flex-row gap-2 mt-4 pt-4 border-t border-dark-800">
                <TouchableOpacity
                  className="flex-1 flex-row items-center justify-center py-2 bg-dark-800 rounded-lg"
                  onPress={() => handleStartEdit(account)}
                >
                  <PencilSimple size={16} color={ICON_COLORS.inactive} weight="fill" />
                  <Text className="text-dark-400 font-medium ml-2">Rename</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 flex-row items-center justify-center py-2 bg-red-900/20 rounded-lg"
                  onPress={() => handleRemoveAccount(account)}
                >
                  <Trash size={16} color={ICON_COLORS.error} weight="fill" />
                  <Text className="text-red-400 font-medium ml-2">Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* Add Account Button */}
        <View className="py-6">
          <Button
            fullWidth
            variant="secondary"
            onPress={() => router.push("/(auth)/wallet-setup")}
          >
            + Add Another Account
          </Button>
        </View>

        {/* Info Text */}
        <View className="pb-8">
          <Text className="text-dark-600 text-center text-sm">
            Tap an account to make it active. Your active account is used for all transactions.
          </Text>
        </View>
      </ScrollView>

      {/* Edit Nickname Modal */}
      <Modal
        visible={!!editingAccount}
        onClose={() => {
          setEditingAccount(null)
          setEditNickname("")
        }}
        title="Rename Account"
      >
        <View className="gap-4">
          <View>
            <Text className="text-dark-400 text-sm mb-2">Nickname</Text>
            <TextInput
              className="bg-dark-900 border border-dark-800 rounded-xl px-4 py-3 text-white text-lg"
              value={editNickname}
              onChangeText={setEditNickname}
              placeholder="Enter nickname"
              placeholderTextColor="#71717a"
              autoFocus
              maxLength={30}
            />
            <Text className="text-dark-600 text-xs mt-2">
              {editNickname.length}/30 characters
            </Text>
          </View>

          {editingAccount && (
            <View className="bg-dark-900 rounded-xl p-3">
              <Text className="text-dark-500 text-xs">Address</Text>
              <Text className="text-dark-300 text-sm font-mono mt-1">
                {editingAccount.address}
              </Text>
            </View>
          )}

          <View className="flex-row gap-3 mt-2">
            <Button
              variant="secondary"
              onPress={() => {
                setEditingAccount(null)
                setEditNickname("")
              }}
              style={{ flex: 1 }}
            >
              Cancel
            </Button>
            <Button
              onPress={handleSaveNickname}
              disabled={!editNickname.trim()}
              style={{ flex: 1 }}
            >
              Save
            </Button>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}
