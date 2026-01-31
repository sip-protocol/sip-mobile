/**
 * Security Settings Screen
 *
 * Manage app security:
 * - Biometric authentication
 * - PIN lock
 * - Auto-lock settings
 * - Privacy protection
 */

import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Switch,
  TextInput,
  Alert,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { useState } from "react"
import {
  ArrowLeft,
  Camera,
  Clock,
  Eye,
  EyeSlash,
  FaceMask,
  Fingerprint,
  Key,
  Lock,
  Numpad,
  PaperPlaneTilt,
  Shield,
  Timer,
  Trash,
  Coins,
} from "phosphor-react-native"
import type { Icon as PhosphorIcon } from "phosphor-react-native"
import { ICON_COLORS } from "@/constants/icons"
import { useBiometrics } from "@/hooks/useBiometrics"
import {
  useSecurityStore,
  formatAutoLockTimeout,
  type AutoLockTimeout,
} from "@/stores/security"
import { useWalletStore } from "@/stores/wallet"
import { useToastStore } from "@/stores/toast"
import { Button, Modal } from "@/components/ui"

// ============================================================================
// TYPES
// ============================================================================

type BiometricIconType = "facial" | "fingerprint" | "iris" | "none"

// ============================================================================
// HELPERS
// ============================================================================

function getBiometricIcon(type: BiometricIconType): PhosphorIcon {
  switch (type) {
    case "facial":
      return FaceMask
    case "fingerprint":
      return Fingerprint
    case "iris":
      return Eye
    default:
      return Lock
  }
}

function getBiometricName(type: BiometricIconType): string {
  switch (type) {
    case "facial":
      return "Face ID"
    case "fingerprint":
      return "Fingerprint"
    case "iris":
      return "Iris"
    default:
      return "Biometrics"
  }
}

// ============================================================================
// COMPONENTS
// ============================================================================

interface SettingRowProps {
  Icon: PhosphorIcon
  iconColor?: string
  title: string
  subtitle?: string
  value?: boolean
  onValueChange?: (value: boolean) => void
  onPress?: () => void
  disabled?: boolean
}

function SettingRow({
  Icon,
  iconColor = ICON_COLORS.muted,
  title,
  subtitle,
  value,
  onValueChange,
  onPress,
  disabled,
}: SettingRowProps) {
  const content = (
    <View
      className={`flex-row items-center py-4 border-b border-dark-800 ${
        disabled ? "opacity-50" : ""
      }`}
    >
      <View className="mr-4">
        <Icon size={24} color={iconColor} weight="regular" />
      </View>
      <View className="flex-1">
        <Text className="text-white font-medium">{title}</Text>
        {subtitle && <Text className="text-dark-500 text-sm">{subtitle}</Text>}
      </View>
      {value !== undefined && onValueChange && (
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: "#3f3f46", true: "#7c3aed" }}
          thumbColor={value ? "#ffffff" : "#a1a1aa"}
          disabled={disabled}
        />
      )}
      {onPress && !onValueChange && (
        <Text className="text-dark-500">›</Text>
      )}
    </View>
  )

  if (onPress && !onValueChange) {
    return (
      <TouchableOpacity onPress={onPress} disabled={disabled}>
        {content}
      </TouchableOpacity>
    )
  }

  return content
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SecurityScreen() {
  const {
    capabilities,
    isLoading: biometricsLoading,
    error: biometricsError,
    isEnabled: biometricsEnabled,
    enable: enableBiometrics,
    disable: disableBiometrics,
    setPin,
    clearPin,
  } = useBiometrics()

  const {
    requireBiometricsForSend,
    requireBiometricsForClaim,
    requireBiometricsForExport,
    pinEnabled,
    autoLockEnabled,
    autoLockTimeout,
    hideBalanceOnBackground,
    screenshotProtection,
    setRequireBiometrics,
    setAutoLockEnabled,
    setAutoLockTimeout,
    setHideBalanceOnBackground,
    setScreenshotProtection,
  } = useSecurityStore()

  const { isConnected } = useWalletStore()
  const { addToast } = useToastStore()

  const [showPinModal, setShowPinModal] = useState(false)
  const [showTimeoutModal, setShowTimeoutModal] = useState(false)
  const [pinInput, setPinInput] = useState("")
  const [pinConfirm, setPinConfirm] = useState("")
  const [pinStep, setPinStep] = useState<"enter" | "confirm">("enter")

  const biometricType = capabilities?.primaryType || "none"

  const handleToggleBiometrics = async (enabled: boolean) => {
    if (enabled) {
      const success = await enableBiometrics()
      if (success) {
        addToast({
          type: "success",
          title: "Biometrics enabled",
          message: `${getBiometricName(biometricType)} is now active`,
        })
      } else if (biometricsError) {
        addToast({
          type: "error",
          title: "Failed to enable",
          message: biometricsError,
        })
      }
    } else {
      disableBiometrics()
      addToast({
        type: "info",
        title: "Biometrics disabled",
        message: "Authentication is no longer required",
      })
    }
  }

  const handleSetPin = async () => {
    if (pinStep === "enter") {
      if (pinInput.length < 4) {
        addToast({
          type: "error",
          title: "PIN too short",
          message: "PIN must be at least 4 digits",
        })
        return
      }
      setPinStep("confirm")
      return
    }

    if (pinInput !== pinConfirm) {
      addToast({
        type: "error",
        title: "PINs don't match",
        message: "Please try again",
      })
      setPinInput("")
      setPinConfirm("")
      setPinStep("enter")
      return
    }

    try {
      await setPin(pinInput)
      addToast({
        type: "success",
        title: "PIN set",
        message: "Your PIN has been configured",
      })
      setShowPinModal(false)
      setPinInput("")
      setPinConfirm("")
      setPinStep("enter")
    } catch (err) {
      addToast({
        type: "error",
        title: "Failed to set PIN",
        message: err instanceof Error ? err.message : "Unknown error",
      })
    }
  }

  const handleClearPin = () => {
    Alert.alert(
      "Remove PIN",
      "Are you sure you want to remove your PIN? This will disable PIN authentication.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            clearPin()
            addToast({
              type: "info",
              title: "PIN removed",
              message: "PIN authentication is disabled",
            })
          },
        },
      ]
    )
  }

  const timeoutOptions: AutoLockTimeout[] = [
    "immediate",
    "1min",
    "5min",
    "15min",
    "30min",
    "never",
  ]

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
            <Lock size={40} color={ICON_COLORS.brand} weight="fill" />
          </View>
          <Text className="text-white font-semibold text-lg">Connect Wallet</Text>
          <Text className="text-dark-500 text-center mt-2">
            Connect your wallet to configure security settings
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

  if (biometricsLoading) {
    return (
      <SafeAreaView className="flex-1 bg-dark-950">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#8b5cf6" />
          <Text className="text-dark-400 mt-4">Checking device capabilities...</Text>
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
        <Text className="text-xl font-bold text-white">Security</Text>
        <View className="w-16" />
      </View>

      <ScrollView className="flex-1">
        <View className="px-6 pt-6">
          {/* Biometrics Section */}
          <View>
            <Text className="text-dark-400 text-sm mb-2 uppercase">
              Biometric Authentication
            </Text>
            <View className="bg-dark-900 rounded-xl border border-dark-800 px-4">
              <SettingRow
                Icon={getBiometricIcon(biometricType)}
                iconColor={ICON_COLORS.brand}
                title={`Enable ${getBiometricName(biometricType)}`}
                subtitle={
                  capabilities?.isAvailable
                    ? capabilities.isEnrolled
                      ? "Use biometrics to authenticate"
                      : "Not enrolled in device settings"
                    : "Not available on this device"
                }
                value={biometricsEnabled}
                onValueChange={handleToggleBiometrics}
                disabled={!capabilities?.isAvailable || !capabilities?.isEnrolled}
              />

              {biometricsEnabled && (
                <>
                  <SettingRow
                    Icon={PaperPlaneTilt}
                    iconColor={ICON_COLORS.cyan}
                    title="Require for sending"
                    subtitle="Authenticate before sending payments"
                    value={requireBiometricsForSend}
                    onValueChange={(v) => setRequireBiometrics("send", v)}
                  />
                  <SettingRow
                    Icon={Coins}
                    iconColor={ICON_COLORS.warning}
                    title="Require for claiming"
                    subtitle="Authenticate before claiming payments"
                    value={requireBiometricsForClaim}
                    onValueChange={(v) => setRequireBiometrics("claim", v)}
                  />
                  <SettingRow
                    Icon={Key}
                    iconColor={ICON_COLORS.orange}
                    title="Require for key export"
                    subtitle="Authenticate before exporting viewing keys"
                    value={requireBiometricsForExport}
                    onValueChange={(v) => setRequireBiometrics("export", v)}
                  />
                </>
              )}
            </View>
          </View>

          {/* PIN Section */}
          <View className="mt-6">
            <Text className="text-dark-400 text-sm mb-2 uppercase">
              PIN Lock
            </Text>
            <View className="bg-dark-900 rounded-xl border border-dark-800 px-4">
              <SettingRow
                Icon={Numpad}
                iconColor={ICON_COLORS.info}
                title={pinEnabled ? "Change PIN" : "Set PIN"}
                subtitle={
                  pinEnabled
                    ? "PIN is enabled as backup authentication"
                    : "Use PIN as backup when biometrics unavailable"
                }
                onPress={() => setShowPinModal(true)}
              />
              {pinEnabled && (
                <SettingRow
                  Icon={Trash}
                  iconColor={ICON_COLORS.error}
                  title="Remove PIN"
                  subtitle="Disable PIN authentication"
                  onPress={handleClearPin}
                />
              )}
            </View>
          </View>

          {/* Auto-Lock Section */}
          <View className="mt-6">
            <Text className="text-dark-400 text-sm mb-2 uppercase">
              Auto-Lock
            </Text>
            <View className="bg-dark-900 rounded-xl border border-dark-800 px-4">
              <SettingRow
                Icon={Timer}
                iconColor={ICON_COLORS.cyan}
                title="Auto-lock"
                subtitle="Lock app after inactivity"
                value={autoLockEnabled}
                onValueChange={setAutoLockEnabled}
              />
              {autoLockEnabled && (
                <SettingRow
                  Icon={Clock}
                  iconColor={ICON_COLORS.muted}
                  title="Lock after"
                  subtitle={formatAutoLockTimeout(autoLockTimeout)}
                  onPress={() => setShowTimeoutModal(true)}
                />
              )}
            </View>
          </View>

          {/* Privacy Section */}
          <View className="mt-6">
            <Text className="text-dark-400 text-sm mb-2 uppercase">
              Privacy Protection
            </Text>
            <View className="bg-dark-900 rounded-xl border border-dark-800 px-4">
              <SettingRow
                Icon={EyeSlash}
                iconColor={ICON_COLORS.warning}
                title="Hide balance in background"
                subtitle="Blur balance when app is in background"
                value={hideBalanceOnBackground}
                onValueChange={setHideBalanceOnBackground}
              />
              <SettingRow
                Icon={Camera}
                iconColor={ICON_COLORS.error}
                title="Screenshot protection"
                subtitle="Prevent screenshots of sensitive screens"
                value={screenshotProtection}
                onValueChange={setScreenshotProtection}
              />
            </View>
          </View>

          {/* Info Card */}
          <View className="mt-6 mb-8 bg-brand-900/10 border border-brand-800/30 rounded-xl p-4">
            <View className="flex-row items-start gap-3">
              <Shield size={24} color={ICON_COLORS.brand} weight="fill" />
              <View className="flex-1">
                <Text className="text-brand-400 font-medium">
                  Your keys are secure
                </Text>
                <Text className="text-dark-400 text-sm mt-1">
                  All private keys are stored in your device's secure enclave
                  and never leave your device. Biometric authentication adds an
                  extra layer of protection.
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* PIN Modal */}
      <Modal
        visible={showPinModal}
        onClose={() => {
          setShowPinModal(false)
          setPinInput("")
          setPinConfirm("")
          setPinStep("enter")
        }}
        title={pinStep === "enter" ? "Set PIN" : "Confirm PIN"}
      >
        <View className="gap-4">
          <Text className="text-dark-400 text-sm">
            {pinStep === "enter"
              ? "Enter a 4-6 digit PIN to use as backup authentication."
              : "Re-enter your PIN to confirm."}
          </Text>

          <View>
            <TextInput
              className="bg-dark-800 border border-dark-700 rounded-xl px-4 py-4 text-white text-center text-2xl tracking-widest"
              placeholder="••••"
              placeholderTextColor="#71717a"
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry
              value={pinStep === "enter" ? pinInput : pinConfirm}
              onChangeText={pinStep === "enter" ? setPinInput : setPinConfirm}
              autoFocus
            />
          </View>

          <View className="flex-row gap-3">
            <TouchableOpacity
              className="flex-1 bg-dark-800 py-3 rounded-xl items-center"
              onPress={() => {
                if (pinStep === "confirm") {
                  setPinStep("enter")
                  setPinConfirm("")
                } else {
                  setShowPinModal(false)
                  setPinInput("")
                }
              }}
            >
              <Text className="text-white font-medium">
                {pinStep === "confirm" ? "Back" : "Cancel"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 bg-brand-600 py-3 rounded-xl items-center"
              onPress={handleSetPin}
            >
              <Text className="text-white font-medium">
                {pinStep === "enter" ? "Next" : "Set PIN"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Auto-Lock Timeout Modal */}
      <Modal
        visible={showTimeoutModal}
        onClose={() => setShowTimeoutModal(false)}
        title="Auto-Lock Timeout"
      >
        <View className="gap-2">
          {timeoutOptions.map((option) => (
            <TouchableOpacity
              key={option}
              className={`py-3 px-4 rounded-xl ${
                autoLockTimeout === option ? "bg-brand-600" : "bg-dark-800"
              }`}
              onPress={() => {
                setAutoLockTimeout(option)
                setShowTimeoutModal(false)
              }}
            >
              <Text
                className={`text-center font-medium ${
                  autoLockTimeout === option ? "text-white" : "text-dark-300"
                }`}
              >
                {formatAutoLockTimeout(option)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Modal>
    </SafeAreaView>
  )
}
