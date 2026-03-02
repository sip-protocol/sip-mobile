/**
 * Viewing Key Disclosures Screen
 *
 * Track who has your viewing keys:
 * - Active disclosures
 * - Revoked/expired history
 * - Quick revoke action
 */

import { View, Text, TouchableOpacity, FlatList, RefreshControl } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { useState, useMemo, useCallback } from "react"
import { useViewingKeys } from "@/hooks"
import { useToastStore } from "@/stores/toast"
import { Modal } from "@/components/ui"
import type { ViewingKeyDisclosure } from "@/types"
import {
  ArrowLeftIcon,
  ClipboardTextIcon,
  MagnifyingGlassIcon,
  UserIcon,
  FileTextIcon,
  KeyIcon,
  ProhibitIcon,
} from "phosphor-react-native"
import type { Icon as PhosphorIcon } from "phosphor-react-native"
import { ICON_COLORS } from "@/constants/icons"

// ============================================================================
// HELPERS
// ============================================================================

function getPurposeIcon(purpose: ViewingKeyDisclosure["purpose"]): PhosphorIcon {
  const icons: Record<ViewingKeyDisclosure["purpose"], PhosphorIcon> = {
    compliance: ClipboardTextIcon,
    audit: MagnifyingGlassIcon,
    personal: UserIcon,
    other: FileTextIcon,
  }
  return icons[purpose]
}

function getPurposeLabel(purpose: ViewingKeyDisclosure["purpose"]): string {
  const labels: Record<ViewingKeyDisclosure["purpose"], string> = {
    compliance: "Compliance",
    audit: "Audit",
    personal: "Personal",
    other: "Other",
  }
  return labels[purpose]
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diffMs = now - timestamp
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  return formatDate(timestamp)
}

function getExpiryStatus(disclosure: ViewingKeyDisclosure): {
  label: string
  color: string
} {
  if (disclosure.revoked) {
    return { label: "Revoked", color: "text-red-400" }
  }

  if (!disclosure.expiresAt) {
    return { label: "No Expiry", color: "text-yellow-400" }
  }

  const now = Date.now()
  const daysUntilExpiry = Math.ceil((disclosure.expiresAt - now) / (1000 * 60 * 60 * 24))

  if (daysUntilExpiry < 0) {
    return { label: "Expired", color: "text-dark-400" }
  }

  if (daysUntilExpiry <= 7) {
    return { label: `Expires in ${daysUntilExpiry}d`, color: "text-orange-400" }
  }

  return { label: `Expires ${formatDate(disclosure.expiresAt)}`, color: "text-green-400" }
}

// ============================================================================
// COMPONENTS
// ============================================================================

type FilterType = "active" | "expired" | "revoked" | "all"

interface DisclosureItemProps {
  disclosure: ViewingKeyDisclosure
  onPress: () => void
  onRevoke: () => void
}

function DisclosureItem({ disclosure, onPress, onRevoke }: DisclosureItemProps) {
  const expiryStatus = getExpiryStatus(disclosure)
  const isActive =
    !disclosure.revoked &&
    (!disclosure.expiresAt || disclosure.expiresAt > Date.now())
  const IconComponent = getPurposeIcon(disclosure.purpose)

  return (
    <TouchableOpacity
      className={`bg-dark-900 rounded-xl p-4 mb-3 ${!isActive ? "opacity-60" : ""}`}
      onPress={onPress}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-row items-start flex-1">
          <View className="w-10 h-10 rounded-lg bg-dark-800 items-center justify-center mr-3">
            <IconComponent size={20} color={ICON_COLORS.muted} weight="fill" />
          </View>
          <View className="flex-1">
            <Text className="text-white font-semibold" numberOfLines={1}>
              {disclosure.recipientName}
            </Text>
            <Text className="text-dark-400 text-sm">
              {getPurposeLabel(disclosure.purpose)} • {formatRelativeTime(disclosure.disclosedAt)}
            </Text>
            {disclosure.note && (
              <Text className="text-dark-500 text-xs mt-1" numberOfLines={1}>
                {disclosure.note}
              </Text>
            )}
          </View>
        </View>

        <View className="items-end ml-2">
          <Text className={`text-xs ${expiryStatus.color}`}>{expiryStatus.label}</Text>
          {isActive && (
            <TouchableOpacity
              className="mt-2 bg-red-500/20 px-2 py-1 rounded"
              onPress={(e) => {
                e.stopPropagation()
                onRevoke()
              }}
            >
              <Text className="text-red-400 text-xs">Revoke</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  )
}

// ============================================================================
// MAIN SCREEN
// ============================================================================

export default function DisclosuresScreen() {
  const {
    disclosures,
    revokeDisclosure,
    deleteDisclosure,
    getActiveDisclosures,
  } = useViewingKeys()
  const { addToast } = useToastStore()

  const [filter, setFilter] = useState<FilterType>("active")
  const [refreshing, setRefreshing] = useState(false)
  const [selectedDisclosure, setSelectedDisclosure] = useState<ViewingKeyDisclosure | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false)
  const [disclosureToRevoke, setDisclosureToRevoke] = useState<ViewingKeyDisclosure | null>(null)

  const activeDisclosures = useMemo(() => getActiveDisclosures(), [getActiveDisclosures])

  const expiredDisclosures = useMemo(() => {
    const now = Date.now()
    return disclosures.filter(
      (d) => !d.revoked && d.expiresAt && d.expiresAt <= now
    )
  }, [disclosures])

  const revokedDisclosures = useMemo(() => {
    return disclosures.filter((d) => d.revoked)
  }, [disclosures])

  const filteredDisclosures = useMemo(() => {
    switch (filter) {
      case "active":
        return activeDisclosures
      case "expired":
        return expiredDisclosures
      case "revoked":
        return revokedDisclosures
      case "all":
      default:
        return disclosures
    }
  }, [filter, activeDisclosures, expiredDisclosures, revokedDisclosures, disclosures])

  const filterCounts = useMemo(
    () => ({
      active: activeDisclosures.length,
      expired: expiredDisclosures.length,
      revoked: revokedDisclosures.length,
      all: disclosures.length,
    }),
    [activeDisclosures, expiredDisclosures, revokedDisclosures, disclosures]
  )

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await new Promise((resolve) => setTimeout(resolve, 500))
    setRefreshing(false)
  }, [])

  const handleRevoke = useCallback((disclosure: ViewingKeyDisclosure) => {
    setDisclosureToRevoke(disclosure)
    setShowRevokeConfirm(true)
  }, [])

  const confirmRevoke = useCallback(async () => {
    if (!disclosureToRevoke) return

    try {
      await revokeDisclosure(disclosureToRevoke.id)
      setShowRevokeConfirm(false)
      setDisclosureToRevoke(null)
      addToast({
        type: "success",
        title: "Disclosure Revoked",
        message: `Access revoked for ${disclosureToRevoke.recipientName}`,
      })
    } catch {
      addToast({
        type: "error",
        title: "Revocation Failed",
        message: "Could not revoke disclosure",
      })
    }
  }, [disclosureToRevoke, revokeDisclosure, addToast])

  const handleDelete = useCallback(async () => {
    if (!selectedDisclosure) return

    try {
      await deleteDisclosure(selectedDisclosure.id)
      setShowDetailModal(false)
      setSelectedDisclosure(null)
      addToast({
        type: "success",
        title: "Disclosure Deleted",
        message: "Disclosure record has been removed",
      })
    } catch {
      addToast({
        type: "error",
        title: "Delete Failed",
        message: "Could not delete disclosure",
      })
    }
  }, [selectedDisclosure, deleteDisclosure, addToast])

  const renderItem = useCallback(
    ({ item }: { item: ViewingKeyDisclosure }) => (
      <DisclosureItem
        disclosure={item}
        onPress={() => {
          setSelectedDisclosure(item)
          setShowDetailModal(true)
        }}
        onRevoke={() => handleRevoke(item)}
      />
    ),
    [handleRevoke]
  )

  const keyExtractor = useCallback((item: ViewingKeyDisclosure) => item.id, [])

  const ListEmptyComponent = useMemo(
    () => (
      <View className="items-center py-16">
        <View className="w-24 h-24 rounded-full bg-dark-800 items-center justify-center mb-4">
          <KeyIcon size={48} color={ICON_COLORS.inactive} weight="fill" />
        </View>
        <Text className="text-white text-xl font-semibold mb-2">
          No Disclosures
        </Text>
        <Text className="text-dark-400 text-center px-8">
          {filter === "active"
            ? "You haven't shared your viewing key with anyone yet"
            : filter === "expired"
              ? "No expired disclosures"
              : filter === "revoked"
                ? "No revoked disclosures"
                : "No disclosure history"}
        </Text>
        <TouchableOpacity
          className="mt-6 bg-brand-600 px-6 py-3 rounded-xl"
          onPress={() => router.push("/settings/viewing-keys")}
        >
          <Text className="text-white font-medium">Manage Keys</Text>
        </TouchableOpacity>
      </View>
    ),
    [filter]
  )

  return (
    <SafeAreaView className="flex-1 bg-dark-950">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-dark-800">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-3 p-2 -ml-2">
            <ArrowLeftIcon size={24} color={ICON_COLORS.white} weight="bold" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">Disclosures</Text>
        </View>
        <TouchableOpacity
          className="bg-brand-600 px-3 py-1.5 rounded-lg"
          onPress={() => router.push("/settings/viewing-keys")}
        >
          <Text className="text-white text-sm">New</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Chips */}
      <View className="px-4 py-3">
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[
            { key: "active" as FilterType, label: "Active" },
            { key: "expired" as FilterType, label: "Expired" },
            { key: "revoked" as FilterType, label: "Revoked" },
            { key: "all" as FilterType, label: "All" },
          ]}
          renderItem={({ item }) => (
            <TouchableOpacity
              className={`px-4 py-2 rounded-full mr-2 flex-row items-center ${
                filter === item.key ? "bg-brand-600" : "bg-dark-800"
              }`}
              onPress={() => setFilter(item.key)}
            >
              <Text
                className={`font-medium ${
                  filter === item.key ? "text-white" : "text-dark-300"
                }`}
              >
                {item.label}
              </Text>
              <View
                className={`ml-2 px-1.5 py-0.5 rounded-full ${
                  filter === item.key ? "bg-brand-500" : "bg-dark-700"
                }`}
              >
                <Text
                  className={`text-xs font-medium ${
                    filter === item.key ? "text-white" : "text-dark-400"
                  }`}
                >
                  {filterCounts[item.key]}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.key}
        />
      </View>

      {/* Disclosure List */}
      <FlatList
        className="flex-1 px-4"
        data={filteredDisclosures}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={ListEmptyComponent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#8b5cf6"
            colors={["#8b5cf6"]}
          />
        }
      />

      {/* Disclosure Detail Modal */}
      <Modal
        visible={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="Disclosure Details"
      >
        {selectedDisclosure && (
          <View>
            <View className="items-center py-4">
              <View className="w-16 h-16 rounded-xl bg-dark-800 items-center justify-center mb-4">
                {(() => {
                  const IconComp = getPurposeIcon(selectedDisclosure.purpose)
                  return <IconComp size={32} color={ICON_COLORS.brand} weight="fill" />
                })()}
              </View>
              <Text className="text-white text-xl font-semibold">
                {selectedDisclosure.recipientName}
              </Text>
              <Text className={`text-sm mt-1 ${getExpiryStatus(selectedDisclosure).color}`}>
                {getExpiryStatus(selectedDisclosure).label}
              </Text>
            </View>

            <View className="bg-dark-800 rounded-xl p-4 mb-4">
              <View className="flex-row justify-between mb-3">
                <Text className="text-dark-400">Purpose</Text>
                <Text className="text-white">
                  {getPurposeLabel(selectedDisclosure.purpose)}
                </Text>
              </View>

              <View className="flex-row justify-between mb-3">
                <Text className="text-dark-400">Disclosed</Text>
                <Text className="text-white">
                  {formatDate(selectedDisclosure.disclosedAt)}
                </Text>
              </View>

              {selectedDisclosure.expiresAt && (
                <View className="flex-row justify-between mb-3">
                  <Text className="text-dark-400">Expires</Text>
                  <Text className="text-white">
                    {formatDate(selectedDisclosure.expiresAt)}
                  </Text>
                </View>
              )}

              {selectedDisclosure.recipientAddress && (
                <View className="mb-3">
                  <Text className="text-dark-400 mb-1">Recipient Address</Text>
                  <Text className="text-dark-300 text-xs font-mono">
                    {selectedDisclosure.recipientAddress}
                  </Text>
                </View>
              )}

              {selectedDisclosure.note && (
                <View>
                  <Text className="text-dark-400 mb-1">Note</Text>
                  <Text className="text-dark-300 text-sm">
                    {selectedDisclosure.note}
                  </Text>
                </View>
              )}

              {selectedDisclosure.revoked && selectedDisclosure.revokedAt && (
                <View className="mt-3 pt-3 border-t border-dark-700">
                  <Text className="text-red-400 text-sm">
                    Revoked on {formatDate(selectedDisclosure.revokedAt)}
                  </Text>
                </View>
              )}
            </View>

            <View className="gap-3">
              {!selectedDisclosure.revoked && (
                <TouchableOpacity
                  className="bg-red-600 py-3 rounded-xl items-center"
                  onPress={() => {
                    setShowDetailModal(false)
                    handleRevoke(selectedDisclosure)
                  }}
                >
                  <Text className="text-white font-medium">Revoke Access</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                className="bg-dark-800 py-3 rounded-xl items-center"
                onPress={handleDelete}
              >
                <Text className="text-red-400 font-medium">Delete Record</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="bg-brand-600 py-3 rounded-xl items-center"
                onPress={() => setShowDetailModal(false)}
              >
                <Text className="text-white font-medium">Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>

      {/* Revoke Confirmation Modal */}
      <Modal
        visible={showRevokeConfirm}
        onClose={() => setShowRevokeConfirm(false)}
        title="Revoke Access"
      >
        <View className="items-center py-4">
          <View className="w-24 h-24 rounded-full bg-red-900/30 items-center justify-center mb-4">
            <ProhibitIcon size={48} color={ICON_COLORS.error} weight="fill" />
          </View>
          <Text className="text-white text-lg font-semibold text-center mb-2">
            Revoke Viewing Key Access?
          </Text>
          <Text className="text-dark-400 text-center mb-6">
            {disclosureToRevoke?.recipientName} will no longer be able to view
            your transactions using this disclosed key.
          </Text>

          <View className="w-full flex-row gap-3">
            <TouchableOpacity
              className="flex-1 bg-dark-800 py-3 rounded-xl items-center"
              onPress={() => setShowRevokeConfirm(false)}
            >
              <Text className="text-white font-medium">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 bg-red-600 py-3 rounded-xl items-center"
              onPress={confirmRevoke}
            >
              <Text className="text-white font-medium">Revoke</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}
