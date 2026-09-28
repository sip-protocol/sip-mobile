/**
 * Keychain Security Notice (#138 — adaptive gating)
 *
 * Rendered on wallet surfaces. When stored keys are NOT biometric-protected
 * (STANDARD level — written on devices without an enrollment), it explains
 * the downgrade and offers the path back to full protection:
 * - nothing enrolled → deep-link to the device's security settings
 * - enrollment present (added later) → one-tap `upgradeWalletSecurity`
 * Renders null for biometric-protected wallets and before first load.
 */

import { useCallback, useState } from "react"
import { Linking, Text, TouchableOpacity, View } from "react-native"
import { useFocusEffect } from "expo-router"
import { ShieldWarningIcon } from "phosphor-react-native"
import { ICON_COLORS } from "@/constants/icons"
import { useWalletStore } from "@/stores/wallet"
import { useToastStore } from "@/stores/toast"
import {
  getStoredSecurityLevel,
  resolveKeychainPolicy,
  upgradeWalletSecurity,
  type KeychainSecurityLevel,
} from "@/utils/keyStorage"

export interface KeychainNoticeInput {
  level: KeychainSecurityLevel | null
  deviceEnrolled: boolean
}

export interface KeychainNoticeView {
  /** Notice visible at all (STANDARD level, post-load). */
  visible: boolean
  /** Whether the upgrade CTA (true) or the device-settings CTA (false) shows. */
  canUpgrade: boolean
}

/**
 * Pure display derivation — the component's visible contract:
 * unknown/loading level renders nothing; STANDARD renders with the CTA the
 * device state allows; BIOMETRIC renders nothing.
 */
export function resolveNoticeView(input: KeychainNoticeInput): KeychainNoticeView {
  if (input.level !== "STANDARD") {
    return { visible: false, canUpgrade: false }
  }
  return { visible: true, canUpgrade: input.deviceEnrolled }
}

export function KeychainSecurityNotice() {
  const activeAccountId = useWalletStore((s) => s.activeAccountId)
  const addToast = useToastStore((s) => s.addToast)
  const [level, setLevel] = useState<KeychainSecurityLevel | null>(null)
  const [deviceEnrolled, setDeviceEnrolled] = useState(false)
  const [upgrading, setUpgrading] = useState(false)

  const refresh = useCallback(async () => {
    setLevel(await getStoredSecurityLevel(activeAccountId ?? undefined))
    setDeviceEnrolled((await resolveKeychainPolicy()).isEnrolled)
  }, [activeAccountId])

  // Re-check on every screen focus: the user may enroll in OS settings and
  // come straight back — the notice must flip to the upgrade CTA live.
  useFocusEffect(
    useCallback(() => {
      refresh()
    }, [refresh])
  )

  const handleUpgrade = useCallback(async () => {
    if (!activeAccountId || upgrading) return
    setUpgrading(true)
    try {
      const upgraded = await upgradeWalletSecurity(activeAccountId)
      if (upgraded) {
        addToast({
          type: "success",
          title: "Keys upgraded",
          message: "Stored wallet keys now require biometric unlock",
        })
      } else {
        addToast({
          type: "error",
          title: "Upgrade unavailable",
          message: "Enroll biometrics or a screen lock in device settings first",
        })
      }
    } catch (error) {
      addToast({
        type: "error",
        title: "Upgrade failed",
        message: error instanceof Error ? error.message : "Keychain rejected the upgrade",
      })
    } finally {
      setUpgrading(false)
      await refresh()
    }
  }, [activeAccountId, upgrading, addToast, refresh])

  const view = resolveNoticeView({ level, deviceEnrolled })
  if (!view.visible) return null

  return (
    <View
      testID="keychain-security-notice"
      className="mt-4 bg-amber-950/20 border border-amber-800/40 rounded-xl p-4"
    >
      <View className="flex-row items-start gap-3">
        <View className="mr-3 mt-0.5">
          <ShieldWarningIcon size={24} color={ICON_COLORS.warning} weight="fill" />
        </View>
        <View className="flex-1">
          <Text className="text-amber-400 font-medium">
            Keys not protected by biometrics
          </Text>
          <Text className="text-dark-400 text-sm mt-1">
            {view.canUpgrade
              ? "Your device now has a lock screen enrolled. Require authentication for stored wallet keys."
              : "No lock screen is enrolled on this device, so wallet keys are protected by encryption only. Enroll biometrics or a screen lock in device settings, then return here to upgrade."}
          </Text>
          {view.canUpgrade ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Require biometric unlock for stored keys"
              className="mt-3 bg-brand-600 rounded-xl py-2.5 items-center"
              onPress={handleUpgrade}
              disabled={upgrading}
            >
              <Text className="text-white font-medium">
                {upgrading ? "Upgrading…" : "Require biometric unlock"}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Open device security settings"
              className="mt-3 bg-dark-800 rounded-xl py-2.5 items-center"
              onPress={() => Linking.openSettings()}
            >
              <Text className="text-white font-medium">Open device settings</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  )
}
