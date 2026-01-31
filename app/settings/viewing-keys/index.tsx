/**
 * Viewing Keys Management Screen
 *
 * Manage viewing key operations:
 * - Export viewing key for compliance
 * - View disclosure history
 * - Import viewing keys from others
 * - Manage imported keys
 */

import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Share,
  TextInput,
  Alert,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { useState, useCallback } from "react"
import {
  ArrowLeft,
  CheckCircle,
  ClipboardText,
  Export,
  Eye,
  FileText,
  Info,
  Key,
  Lock,
  MagnifyingGlass,
  Plus,
  User,
} from "phosphor-react-native"
import type { Icon as PhosphorIcon } from "phosphor-react-native"
import { ICON_COLORS } from "@/constants/icons"
import { useViewingKeys } from "@/hooks/useViewingKeys"
import { copyToClipboardSecure } from "@/utils/security"
import { useWalletStore } from "@/stores/wallet"
import { useToastStore } from "@/stores/toast"
import { Button, Modal } from "@/components/ui"
import type { ViewingKeyDisclosure, ImportedViewingKey } from "@/types"

// ============================================================================
// TYPES
// ============================================================================

type Tab = "export" | "disclosures" | "imported"
type DisclosurePurpose = "compliance" | "audit" | "personal" | "other"

// ============================================================================
// HELPERS
// ============================================================================

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatTimeAgo(timestamp: number): string {
  const now = Date.now()
  const diffMs = now - timestamp
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDate(timestamp)
}

function getPurposeLabel(purpose: DisclosurePurpose): string {
  const labels: Record<DisclosurePurpose, string> = {
    compliance: "Compliance",
    audit: "Audit",
    personal: "Personal",
    other: "Other",
  }
  return labels[purpose]
}

function getPurposeIcon(purpose: DisclosurePurpose): PhosphorIcon {
  const icons: Record<DisclosurePurpose, PhosphorIcon> = {
    compliance: ClipboardText,
    audit: MagnifyingGlass,
    personal: User,
    other: FileText,
  }
  return icons[purpose]
}

function getPurposeIconColor(purpose: DisclosurePurpose): string {
  const colors: Record<DisclosurePurpose, string> = {
    compliance: ICON_COLORS.cyan,
    audit: ICON_COLORS.blue,
    personal: ICON_COLORS.brand,
    other: ICON_COLORS.muted,
  }
  return colors[purpose]
}

// ============================================================================
// COMPONENTS
// ============================================================================

interface DisclosureRowProps {
  disclosure: ViewingKeyDisclosure
  onRevoke: () => void
  onDelete: () => void
}

function DisclosureRow({ disclosure, onRevoke, onDelete }: DisclosureRowProps) {
  const isExpired = disclosure.expiresAt && disclosure.expiresAt < Date.now()
  const PurposeIcon = getPurposeIcon(disclosure.purpose)
  const purposeColor = getPurposeIconColor(disclosure.purpose)

  return (
    <View className="py-4 border-b border-dark-800">
      <View className="flex-row items-start">
        <View className="w-10 h-10 bg-dark-800 rounded-full items-center justify-center">
          <PurposeIcon size={20} color={purposeColor} weight="regular" />
        </View>
        <View className="flex-1 ml-3">
          <Text className="text-white font-medium">{disclosure.recipientName}</Text>
          <Text className="text-dark-500 text-sm">
            {getPurposeLabel(disclosure.purpose)} • {formatTimeAgo(disclosure.disclosedAt)}
          </Text>
          {disclosure.note && (
            <Text className="text-dark-400 text-sm mt-1">{disclosure.note}</Text>
          )}
        </View>
        <View className="items-end">
          {disclosure.revoked ? (
            <View className="bg-red-900/30 px-2 py-1 rounded">
              <Text className="text-red-400 text-xs">Revoked</Text>
            </View>
          ) : isExpired ? (
            <View className="bg-yellow-900/30 px-2 py-1 rounded">
              <Text className="text-yellow-400 text-xs">Expired</Text>
            </View>
          ) : (
            <View className="bg-green-900/30 px-2 py-1 rounded">
              <Text className="text-green-400 text-xs">Active</Text>
            </View>
          )}
        </View>
      </View>

      {/* Actions */}
      {!disclosure.revoked && !isExpired && (
        <View className="flex-row gap-2 mt-3 ml-13">
          <TouchableOpacity
            className="bg-red-900/20 px-3 py-1.5 rounded-lg"
            onPress={onRevoke}
          >
            <Text className="text-red-400 text-sm">Revoke</Text>
          </TouchableOpacity>
        </View>
      )}

      {(disclosure.revoked || isExpired) && (
        <View className="flex-row gap-2 mt-3 ml-13">
          <TouchableOpacity
            className="bg-dark-800 px-3 py-1.5 rounded-lg"
            onPress={onDelete}
          >
            <Text className="text-dark-400 text-sm">Delete</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

interface ImportedKeyRowProps {
  importedKey: ImportedViewingKey
  onRemove: () => void
  onScan: () => void
}

function ImportedKeyRow({ importedKey, onRemove, onScan }: ImportedKeyRowProps) {
  return (
    <View className="py-4 border-b border-dark-800">
      <View className="flex-row items-start">
        <View className="w-10 h-10 bg-brand-900/30 rounded-full items-center justify-center">
          <Key size={20} color={ICON_COLORS.brand} weight="fill" />
        </View>
        <View className="flex-1 ml-3">
          <Text className="text-white font-medium">{importedKey.label}</Text>
          <Text className="text-dark-500 text-sm">
            Imported {formatTimeAgo(importedKey.importedAt)}
          </Text>
          {importedKey.lastScannedAt && (
            <Text className="text-dark-600 text-xs mt-1">
              Last scan: {formatTimeAgo(importedKey.lastScannedAt)} •{" "}
              {importedKey.paymentsFound} found
            </Text>
          )}
        </View>
        <View className="items-end">
          <Text className="text-brand-400 text-sm font-medium">
            {importedKey.chain.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Actions */}
      <View className="flex-row gap-2 mt-3 ml-13">
        <TouchableOpacity
          className="bg-brand-900/20 px-3 py-1.5 rounded-lg flex-row items-center gap-1"
          onPress={onScan}
        >
          <MagnifyingGlass size={14} color={ICON_COLORS.brand} weight="regular" />
          <Text className="text-brand-400 text-sm">Scan</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="bg-dark-800 px-3 py-1.5 rounded-lg"
          onPress={onRemove}
        >
          <Text className="text-dark-400 text-sm">Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ViewingKeysScreen() {
  const {
    disclosures,
    importedKeys,
    isLoading,
    error,
    getExportString,
    recordDisclosure,
    revokeDisclosure,
    deleteDisclosure,
    importViewingKey,
    removeImportedKey,
    getActiveDisclosures,
  } = useViewingKeys()
  const { isConnected } = useWalletStore()
  const { addToast } = useToastStore()

  const [activeTab, setActiveTab] = useState<Tab>("export")
  const [isExporting, setIsExporting] = useState(false)
  const [showDisclosureModal, setShowDisclosureModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)

  // Disclosure form state
  const [recipientName, setRecipientName] = useState("")
  const [purpose, setPurpose] = useState<DisclosurePurpose>("compliance")
  const [note, setNote] = useState("")
  const [expiresInDays, setExpiresInDays] = useState("")

  // Import form state
  const [importLabel, setImportLabel] = useState("")
  const [importData, setImportData] = useState("")

  const activeDisclosures = getActiveDisclosures()

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const exportString = await getExportString({
        expiresInDays: expiresInDays ? parseInt(expiresInDays) : undefined,
      })

      if (exportString) {
        // Use secure clipboard with 60-second auto-clear
        await copyToClipboardSecure(exportString)
        addToast({
          type: "success",
          title: "Copied!",
          message: "Viewing key copied to clipboard (clears in 60s)",
        })
        setShowDisclosureModal(true)
      }
    } catch {
      addToast({
        type: "error",
        title: "Export failed",
        message: "Could not export viewing key",
      })
    } finally {
      setIsExporting(false)
    }
  }

  const handleShare = async () => {
    setIsExporting(true)
    try {
      const exportString = await getExportString({
        expiresInDays: expiresInDays ? parseInt(expiresInDays) : undefined,
      })

      if (exportString) {
        await Share.share({
          message: exportString,
          title: "SIP Viewing Key",
        })
        setShowDisclosureModal(true)
      }
    } catch {
      addToast({
        type: "error",
        title: "Share failed",
        message: "Could not share viewing key",
      })
    } finally {
      setIsExporting(false)
    }
  }

  const handleRecordDisclosure = async () => {
    if (!recipientName.trim()) {
      addToast({
        type: "error",
        title: "Missing info",
        message: "Please enter a recipient name",
      })
      return
    }

    await recordDisclosure({
      recipientName: recipientName.trim(),
      purpose,
      note: note.trim() || undefined,
      expiresInDays: expiresInDays ? parseInt(expiresInDays) : undefined,
    })

    addToast({
      type: "success",
      title: "Recorded",
      message: "Disclosure has been recorded",
    })

    // Reset form
    setRecipientName("")
    setPurpose("compliance")
    setNote("")
    setExpiresInDays("")
    setShowDisclosureModal(false)
  }

  const handleRevoke = useCallback(
    (id: string, name: string) => {
      Alert.alert(
        "Revoke Disclosure",
        `Are you sure you want to revoke the disclosure to ${name}? They will no longer be able to view your payments.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Revoke",
            style: "destructive",
            onPress: async () => {
              await revokeDisclosure(id)
              addToast({
                type: "success",
                title: "Revoked",
                message: "Disclosure has been revoked",
              })
            },
          },
        ]
      )
    },
    [revokeDisclosure, addToast]
  )

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteDisclosure(id)
      addToast({
        type: "info",
        title: "Deleted",
        message: "Disclosure record removed",
      })
    },
    [deleteDisclosure, addToast]
  )

  const handleImport = async () => {
    if (!importLabel.trim() || !importData.trim()) {
      addToast({
        type: "error",
        title: "Missing info",
        message: "Please enter a label and viewing key data",
      })
      return
    }

    const result = await importViewingKey({
      label: importLabel.trim(),
      viewingKeyData: importData.trim(),
    })

    if (result) {
      addToast({
        type: "success",
        title: "Imported",
        message: `Viewing key "${importLabel}" has been imported`,
      })
      setImportLabel("")
      setImportData("")
      setShowImportModal(false)
    }
  }

  const handleRemoveImported = useCallback(
    (id: string, label: string) => {
      Alert.alert(
        "Remove Key",
        `Are you sure you want to remove "${label}"?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              await removeImportedKey(id)
              addToast({
                type: "info",
                title: "Removed",
                message: "Viewing key has been removed",
              })
            },
          },
        ]
      )
    },
    [removeImportedKey, addToast]
  )

  const handleScanImported = (key: ImportedViewingKey) => {
    addToast({
      type: "info",
      title: "Coming soon",
      message: `Scanning with ${key.label}'s key will be available soon`,
    })
  }

  if (!isConnected) {
    return (
      <SafeAreaView className="flex-1 bg-dark-950">
        <View className="flex-row items-center px-6 py-4 border-b border-dark-900">
          <TouchableOpacity
            className="flex-row items-center"
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color={ICON_COLORS.white} weight="regular" />
            <Text className="text-white ml-4 text-lg">Back</Text>
          </TouchableOpacity>
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-20 h-20 bg-brand-900/30 rounded-full items-center justify-center mb-4">
            <Key size={40} color={ICON_COLORS.brand} weight="fill" />
          </View>
          <Text className="text-white font-semibold text-lg">Connect Wallet</Text>
          <Text className="text-dark-500 text-center mt-2">
            Connect your wallet to manage viewing keys
          </Text>
          <Button
            onPress={() => router.push("/(auth)/wallet-setup")}
            style={{ marginTop: 24 }}
          >
            Connect Wallet
          </Button>
        </View>
      </SafeAreaView>
    )
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-dark-950">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#8b5cf6" />
          <Text className="text-dark-400 mt-4">Loading viewing keys...</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-dark-950">
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-dark-900">
        <TouchableOpacity
          className="flex-row items-center"
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={ICON_COLORS.white} weight="regular" />
          <Text className="text-white ml-4 text-lg">Back</Text>
        </TouchableOpacity>
        <Text className="text-xl font-bold text-white">Viewing Keys</Text>
        <View className="w-16" />
      </View>

      {/* Tab Switcher */}
      <View className="flex-row px-6 pt-4 gap-2">
        <TouchableOpacity
          className={`flex-1 py-2 rounded-lg ${
            activeTab === "export" ? "bg-brand-600" : "bg-dark-800"
          }`}
          onPress={() => setActiveTab("export")}
        >
          <Text
            className={`text-center text-sm font-medium ${
              activeTab === "export" ? "text-white" : "text-dark-400"
            }`}
          >
            Export
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`flex-1 py-2 rounded-lg ${
            activeTab === "disclosures" ? "bg-brand-600" : "bg-dark-800"
          }`}
          onPress={() => setActiveTab("disclosures")}
        >
          <Text
            className={`text-center text-sm font-medium ${
              activeTab === "disclosures" ? "text-white" : "text-dark-400"
            }`}
          >
            History ({disclosures.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`flex-1 py-2 rounded-lg ${
            activeTab === "imported" ? "bg-brand-600" : "bg-dark-800"
          }`}
          onPress={() => setActiveTab("imported")}
        >
          <Text
            className={`text-center text-sm font-medium ${
              activeTab === "imported" ? "text-white" : "text-dark-400"
            }`}
          >
            Imported ({importedKeys.length})
          </Text>
        </TouchableOpacity>
      </View>

      {error && (
        <View className="mx-6 mt-4 bg-red-900/20 border border-red-700 rounded-xl p-3">
          <Text className="text-red-400 text-sm">{error}</Text>
        </View>
      )}

      <ScrollView className="flex-1">
        <View className="px-6 pt-4">
          {/* Export Tab */}
          {activeTab === "export" && (
            <View>
              {/* Export Card */}
              <View className="bg-dark-900 rounded-2xl border border-dark-800 p-6">
                <View className="items-center">
                  <View className="w-16 h-16 bg-brand-900/30 rounded-full items-center justify-center mb-4">
                    <Key size={32} color={ICON_COLORS.brand} weight="fill" />
                  </View>
                  <Text className="text-white font-semibold text-lg">
                    Export Viewing Key
                  </Text>
                  <Text className="text-dark-400 text-sm text-center mt-2">
                    Share your viewing key with auditors or compliance officers
                    to allow them to see your incoming payments.
                  </Text>
                </View>

                {/* Expiry Input */}
                <View className="mt-6">
                  <Text className="text-dark-400 text-sm mb-2">
                    Expires in (days, optional)
                  </Text>
                  <TextInput
                    className="bg-dark-800 border border-dark-700 rounded-xl px-4 py-3 text-white"
                    placeholder="Never (leave empty)"
                    placeholderTextColor="#71717a"
                    keyboardType="number-pad"
                    value={expiresInDays}
                    onChangeText={setExpiresInDays}
                  />
                </View>

                {/* Action Buttons */}
                <View className="flex-row gap-3 mt-6">
                  <TouchableOpacity
                    className="flex-1 bg-dark-800 py-3 rounded-xl items-center flex-row justify-center gap-2"
                    onPress={handleExport}
                    disabled={isExporting}
                  >
                    {isExporting ? (
                      <ActivityIndicator size="small" color="#8b5cf6" />
                    ) : (
                      <>
                        <ClipboardText size={18} color={ICON_COLORS.white} weight="regular" />
                        <Text className="text-white font-medium">Copy</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-1 bg-brand-600 py-3 rounded-xl items-center flex-row justify-center gap-2"
                    onPress={handleShare}
                    disabled={isExporting}
                  >
                    <Export size={18} color={ICON_COLORS.white} weight="regular" />
                    <Text className="text-white font-medium">Share</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Active Disclosures Summary */}
              {activeDisclosures.length > 0 && (
                <View className="mt-6 bg-green-900/10 border border-green-800/30 rounded-xl p-4">
                  <View className="flex-row items-center gap-3">
                    <CheckCircle size={24} color={ICON_COLORS.success} weight="fill" />
                    <View className="flex-1">
                      <Text className="text-green-400 font-medium">
                        {activeDisclosures.length} Active Disclosure
                        {activeDisclosures.length !== 1 ? "s" : ""}
                      </Text>
                      <Text className="text-dark-400 text-sm mt-1">
                        Your viewing key is currently shared with{" "}
                        {activeDisclosures.map((d) => d.recipientName).join(", ")}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Info Card */}
              <View className="mt-6 mb-8 bg-brand-900/10 border border-brand-800/30 rounded-xl p-4">
                <View className="flex-row items-start gap-3">
                  <Info size={24} color={ICON_COLORS.brand} weight="fill" />
                  <View className="flex-1">
                    <Text className="text-brand-400 font-medium">
                      What is a viewing key?
                    </Text>
                    <Text className="text-dark-400 text-sm mt-1">
                      A viewing key allows others to see your incoming stealth
                      payments without being able to spend your funds. This is
                      useful for compliance, auditing, or sharing with trusted
                      parties.
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Disclosures Tab */}
          {activeTab === "disclosures" && (
            <View>
              {disclosures.length > 0 ? (
                <View className="bg-dark-900 rounded-xl border border-dark-800 px-4">
                  {disclosures.map((disclosure) => (
                    <DisclosureRow
                      key={disclosure.id}
                      disclosure={disclosure}
                      onRevoke={() =>
                        handleRevoke(disclosure.id, disclosure.recipientName)
                      }
                      onDelete={() => handleDelete(disclosure.id)}
                    />
                  ))}
                </View>
              ) : (
                <View className="items-center py-12">
                  <View className="w-20 h-20 bg-dark-800 rounded-full items-center justify-center mb-4">
                    <ClipboardText size={40} color={ICON_COLORS.muted} weight="regular" />
                  </View>
                  <Text className="text-white font-semibold text-lg">
                    No Disclosures Yet
                  </Text>
                  <Text className="text-dark-500 text-center mt-2">
                    When you share your viewing key, record it here to track who
                    has access.
                  </Text>
                </View>
              )}

              {/* Info Card */}
              <View className="mt-6 mb-8 bg-brand-900/10 border border-brand-800/30 rounded-xl p-4">
                <View className="flex-row items-start gap-3">
                  <Lock size={24} color={ICON_COLORS.brand} weight="fill" />
                  <View className="flex-1">
                    <Text className="text-brand-400 font-medium">
                      Disclosure Records
                    </Text>
                    <Text className="text-dark-400 text-sm mt-1">
                      Keep track of who you've shared your viewing key with.
                      Revoking a disclosure won't prevent someone from using a
                      key they already have, but it helps you maintain records.
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Imported Tab */}
          {activeTab === "imported" && (
            <View>
              <TouchableOpacity
                className="bg-dark-800 py-3 rounded-xl items-center flex-row justify-center gap-2 mb-4"
                onPress={() => setShowImportModal(true)}
              >
                <Plus size={18} color={ICON_COLORS.white} weight="bold" />
                <Text className="text-white font-medium">Import Viewing Key</Text>
              </TouchableOpacity>

              {importedKeys.length > 0 ? (
                <View className="bg-dark-900 rounded-xl border border-dark-800 px-4">
                  {importedKeys.map((key) => (
                    <ImportedKeyRow
                      key={key.id}
                      importedKey={key}
                      onRemove={() => handleRemoveImported(key.id, key.label)}
                      onScan={() => handleScanImported(key)}
                    />
                  ))}
                </View>
              ) : (
                <View className="items-center py-12">
                  <View className="w-20 h-20 bg-dark-800 rounded-full items-center justify-center mb-4">
                    <MagnifyingGlass size={40} color={ICON_COLORS.muted} weight="regular" />
                  </View>
                  <Text className="text-white font-semibold text-lg">
                    No Imported Keys
                  </Text>
                  <Text className="text-dark-500 text-center mt-2">
                    Import someone's viewing key to monitor their incoming
                    payments (with their permission).
                  </Text>
                </View>
              )}

              {/* Info Card */}
              <View className="mt-6 mb-8 bg-brand-900/10 border border-brand-800/30 rounded-xl p-4">
                <View className="flex-row items-start gap-3">
                  <Eye size={24} color={ICON_COLORS.brand} weight="fill" />
                  <View className="flex-1">
                    <Text className="text-brand-400 font-medium">
                      Imported Keys
                    </Text>
                    <Text className="text-dark-400 text-sm mt-1">
                      When someone shares their viewing key with you, import it
                      here to scan for their payments. This is useful for
                      compliance monitoring or helping others track their funds.
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Record Disclosure Modal */}
      <Modal
        visible={showDisclosureModal}
        onClose={() => setShowDisclosureModal(false)}
        title="Record Disclosure"
      >
        <View className="gap-4">
          <Text className="text-dark-400 text-sm">
            Record who you shared your viewing key with for your records.
          </Text>

          <View>
            <Text className="text-dark-400 text-sm mb-2">Recipient Name *</Text>
            <TextInput
              className="bg-dark-800 border border-dark-700 rounded-xl px-4 py-3 text-white"
              placeholder="e.g., Tax Auditor, Accountant"
              placeholderTextColor="#71717a"
              value={recipientName}
              onChangeText={setRecipientName}
            />
          </View>

          <View>
            <Text className="text-dark-400 text-sm mb-2">Purpose</Text>
            <View className="flex-row flex-wrap gap-2">
              {(["compliance", "audit", "personal", "other"] as const).map((p) => {
                const PurposeIcon = getPurposeIcon(p)
                return (
                  <TouchableOpacity
                    key={p}
                    className={`px-4 py-2 rounded-lg flex-row items-center gap-2 ${
                      purpose === p ? "bg-brand-600" : "bg-dark-800"
                    }`}
                    onPress={() => setPurpose(p)}
                  >
                    <PurposeIcon
                      size={16}
                      color={purpose === p ? ICON_COLORS.white : ICON_COLORS.muted}
                      weight="regular"
                    />
                    <Text
                      className={purpose === p ? "text-white" : "text-dark-400"}
                    >
                      {getPurposeLabel(p)}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>

          <View>
            <Text className="text-dark-400 text-sm mb-2">Note (optional)</Text>
            <TextInput
              className="bg-dark-800 border border-dark-700 rounded-xl px-4 py-3 text-white"
              placeholder="Any additional context"
              placeholderTextColor="#71717a"
              value={note}
              onChangeText={setNote}
              multiline
            />
          </View>

          <View className="flex-row gap-3 mt-2">
            <TouchableOpacity
              className="flex-1 bg-dark-800 py-3 rounded-xl items-center"
              onPress={() => setShowDisclosureModal(false)}
            >
              <Text className="text-white font-medium">Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 bg-brand-600 py-3 rounded-xl items-center"
              onPress={handleRecordDisclosure}
            >
              <Text className="text-white font-medium">Record</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Import Modal */}
      <Modal
        visible={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="Import Viewing Key"
      >
        <View className="gap-4">
          <Text className="text-dark-400 text-sm">
            Paste a viewing key that someone has shared with you.
          </Text>

          <View>
            <Text className="text-dark-400 text-sm mb-2">Label *</Text>
            <TextInput
              className="bg-dark-800 border border-dark-700 rounded-xl px-4 py-3 text-white"
              placeholder="e.g., Alice's Wallet"
              placeholderTextColor="#71717a"
              value={importLabel}
              onChangeText={setImportLabel}
            />
          </View>

          <View>
            <Text className="text-dark-400 text-sm mb-2">Viewing Key Data *</Text>
            <TextInput
              className="bg-dark-800 border border-dark-700 rounded-xl px-4 py-3 text-white h-24"
              placeholder="Paste the viewing key here"
              placeholderTextColor="#71717a"
              value={importData}
              onChangeText={setImportData}
              multiline
              textAlignVertical="top"
            />
          </View>

          <View className="flex-row gap-3 mt-2">
            <TouchableOpacity
              className="flex-1 bg-dark-800 py-3 rounded-xl items-center"
              onPress={() => setShowImportModal(false)}
            >
              <Text className="text-white font-medium">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 bg-brand-600 py-3 rounded-xl items-center"
              onPress={handleImport}
            >
              <Text className="text-white font-medium">Import</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}
