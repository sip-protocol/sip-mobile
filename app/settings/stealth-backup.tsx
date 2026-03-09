/**
 * Stealth Keys Backup Screen
 *
 * Export encrypted stealth keys as .sip-backup file.
 * Import from previously exported backup.
 */

import { View, Text, TouchableOpacity, Alert } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { useState } from "react"
import { File as ExpoFile, Paths } from "expo-file-system"
import * as Sharing from "expo-sharing"
import * as DocumentPicker from "expo-document-picker"
import { useNativeWallet } from "@/hooks"
import { useWalletStore } from "@/stores/wallet"
import { useToastStore } from "@/stores/toast"
import {
  encryptStealthBackup,
  decryptStealthBackup,
} from "@/lib/stealth"
import {
  exportStealthStorage,
  importStealthStorage,
  clearStealthBackupFlag,
} from "@/hooks/useStealth"
import {
  ArrowLeftIcon,
  DownloadSimpleIcon,
  UploadSimpleIcon,
  ShieldCheckIcon,
  WarningIcon,
} from "phosphor-react-native"
import { ICON_COLORS } from "@/constants/icons"

export default function StealthBackupScreen() {
  const { exportMnemonic } = useNativeWallet()
  const { address } = useWalletStore()
  const { addToast } = useToastStore()

  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  const handleExport = async () => {
    if (!address) {
      addToast({ type: "error", title: "No wallet", message: "Connect a wallet first" })
      return
    }

    setIsExporting(true)
    try {
      // Get seed phrase (requires biometric auth)
      const mnemonic = await exportMnemonic()
      if (!mnemonic) {
        addToast({ type: "error", title: "Authentication failed", message: "Biometric auth required" })
        return
      }

      // Get stealth storage
      const storageJson = await exportStealthStorage(address)
      if (!storageJson) {
        addToast({ type: "error", title: "No stealth keys", message: "No stealth keys found for this wallet" })
        return
      }

      // Encrypt
      const encrypted = encryptStealthBackup(storageJson, mnemonic)

      // Write to temp file
      const timestamp = new Date().toISOString().slice(0, 10)
      const fileName = `sip-stealth-backup-${timestamp}.sip-backup`
      const backupFile = new ExpoFile(Paths.cache, fileName)
      backupFile.write(encrypted)

      // Share
      const canShare = await Sharing.isAvailableAsync()
      if (canShare) {
        await Sharing.shareAsync(backupFile.uri, {
          mimeType: "application/octet-stream",
          dialogTitle: "Save Stealth Keys Backup",
        })
      } else {
        addToast({ type: "error", title: "Sharing unavailable", message: "File sharing not available on this device" })
        return
      }

      // Clean up temp file (defense-in-depth for key material)
      try { backupFile.delete() } catch {}

      // Clear backup flag
      // Note: shareAsync resolves whether user saved or cancelled — expo-sharing
      // provides no way to distinguish. We accept this and clear the flag
      // optimistically since the user saw the share dialog.
      await clearStealthBackupFlag(address ?? undefined)

      addToast({
        type: "success",
        title: "Backup exported",
        message: "Stealth keys backed up securely",
      })
    } catch (err) {
      console.error("Backup export failed:", err)
      addToast({ type: "error", title: "Export failed", message: "Failed to export backup" })
    } finally {
      setIsExporting(false)
    }
  }

  const handleImport = async () => {
    if (!address) {
      addToast({ type: "error", title: "No wallet", message: "Connect a wallet first" })
      return
    }

    setIsImporting(true)
    try {
      // Pick file
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      })

      if (result.canceled || !result.assets?.[0]) {
        return
      }

      const asset = result.assets[0]

      // Reject files over 1MB (stealth backups are typically <10KB)
      if (asset.size && asset.size > 1_000_000) {
        addToast({ type: "error", title: "File too large", message: "Backup files should be under 1MB" })
        return
      }

      // Read file
      const pickedFile = new ExpoFile(asset.uri)
      const encrypted = await pickedFile.text()

      // Get seed phrase for decryption
      const mnemonic = await exportMnemonic()
      if (!mnemonic) {
        addToast({ type: "error", title: "Authentication failed", message: "Biometric auth required" })
        return
      }

      // Decrypt
      const decrypted = decryptStealthBackup(encrypted, mnemonic)
      if (!decrypted) {
        addToast({
          type: "error",
          title: "Decryption failed",
          message: "Wrong seed phrase or corrupted backup file",
          duration: 5000,
        })
        return
      }

      // Confirm overwrite — keep isImporting true until user decides
      Alert.alert(
        "Restore Stealth Keys?",
        "This will merge imported keys with your current stealth keys for this wallet.",
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => setIsImporting(false),
          },
          {
            text: "Restore",
            style: "destructive",
            onPress: async () => {
              try {
                const success = await importStealthStorage(address!, decrypted)
                if (success) {
                  await clearStealthBackupFlag(address ?? undefined)
                  addToast({
                    type: "success",
                    title: "Keys restored",
                    message: "Stealth keys imported successfully.",
                    duration: 5000,
                  })
                } else {
                  addToast({ type: "error", title: "Import failed", message: "Invalid backup file format" })
                }
              } finally {
                setIsImporting(false)
              }
            },
          },
        ]
      )
    } catch (err) {
      console.error("Backup import failed:", err)
      addToast({ type: "error", title: "Import failed", message: "Failed to import backup" })
      setIsImporting(false)
    }
  }

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
        <Text className="text-xl font-bold text-white">Stealth Backup</Text>
        <View className="w-16" />
      </View>

      <View className="flex-1 px-6 pt-6">
        {/* Info Card */}
        <View className="bg-brand-900/10 border border-brand-800/30 rounded-xl p-4 mb-6">
          <View className="flex-row items-start gap-3">
            <ShieldCheckIcon size={24} color={ICON_COLORS.brand} weight="fill" />
            <View className="flex-1">
              <Text className="text-brand-400 font-medium">Encrypted Backup</Text>
              <Text className="text-dark-400 text-sm mt-1">
                Your stealth keys are encrypted with your seed phrase. Only someone
                with your recovery phrase can decrypt the backup.
              </Text>
            </View>
          </View>
        </View>

        {/* Export */}
        <TouchableOpacity
          className="bg-dark-900 border border-dark-800 rounded-xl p-4 flex-row items-center mb-4"
          onPress={handleExport}
          disabled={isExporting || !address}
          accessibilityRole="button"
          accessibilityLabel="Export stealth keys backup"
        >
          <View className="w-12 h-12 bg-green-900/30 rounded-full items-center justify-center">
            <DownloadSimpleIcon size={24} color={ICON_COLORS.success} weight="regular" />
          </View>
          <View className="flex-1 ml-4">
            <Text className="text-white font-medium text-lg">Export Backup</Text>
            <Text className="text-dark-400 text-sm mt-1">
              Save encrypted stealth keys as a file
            </Text>
          </View>
        </TouchableOpacity>

        {/* Import */}
        <TouchableOpacity
          className="bg-dark-900 border border-dark-800 rounded-xl p-4 flex-row items-center mb-6"
          onPress={handleImport}
          disabled={isImporting || !address}
          accessibilityRole="button"
          accessibilityLabel="Import stealth keys from backup"
        >
          <View className="w-12 h-12 bg-blue-900/30 rounded-full items-center justify-center">
            <UploadSimpleIcon size={24} color={ICON_COLORS.info} weight="regular" />
          </View>
          <View className="flex-1 ml-4">
            <Text className="text-white font-medium text-lg">Restore from Backup</Text>
            <Text className="text-dark-400 text-sm mt-1">
              Import stealth keys from a .sip-backup file
            </Text>
          </View>
        </TouchableOpacity>

        {/* Warning */}
        <View className="bg-amber-900/10 border border-amber-800/30 rounded-xl p-4">
          <View className="flex-row items-start gap-3">
            <WarningIcon size={20} color="#f59e0b" weight="fill" />
            <View className="flex-1">
              <Text className="text-amber-400 font-medium text-sm">Important</Text>
              <Text className="text-dark-400 text-sm mt-1">
                Stealth keys are independent from your wallet seed. Without a backup,
                reinstalling the app will make existing stealth payments unclaimable.
              </Text>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  )
}
