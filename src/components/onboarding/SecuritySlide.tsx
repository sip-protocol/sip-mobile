/**
 * Security Slide (Slide 5)
 *
 * Explains local key storage and security.
 * Detects device biometric capabilities for personalized messaging.
 */

import { View, Text, Dimensions } from "react-native"
import { useEffect } from "react"
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from "react-native-reanimated"
import type { SharedValue } from "react-native-reanimated"
import {
  ShieldIcon,
  CheckCircleIcon,
  FingerprintIcon,
  FaceMaskIcon,
  LockIcon,
} from "phosphor-react-native"
import { useBiometrics, usePrefersReducedMotion } from "@/hooks"
import { ICON_COLORS } from "@/constants/icons"

const { width } = Dimensions.get("window")

// ============================================================================
// TYPES
// ============================================================================

interface SecurityFeature {
  label: string
  available: boolean
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SecuritySlide() {
  const { capabilities, isLoading } = useBiometrics()
  const shouldReduceMotion = usePrefersReducedMotion()

  // Staggered check animation
  const check1 = useSharedValue(0)
  const check2 = useSharedValue(0)
  const check3 = useSharedValue(0)

  useEffect(() => {
    if (!isLoading && !shouldReduceMotion) {
      check1.value = withDelay(200, withTiming(1, { duration: 300 }))
      check2.value = withDelay(400, withTiming(1, { duration: 300 }))
      check3.value = withDelay(600, withTiming(1, { duration: 300 }))
    } else if (!isLoading) {
      check1.value = 1
      check2.value = 1
      check3.value = 1
    }
  }, [isLoading, shouldReduceMotion, check1, check2, check3])

  // Determine biometric type display
  const biometricType = capabilities?.primaryType ?? "none"
  const biometricLabel =
    biometricType === "facial"
      ? "Face ID available"
      : biometricType === "fingerprint"
        ? "Touch ID available"
        : biometricType === "iris"
          ? "Iris scanner available"
          : "Device passcode"

  const BiometricIcon =
    biometricType === "facial"
      ? FaceMaskIcon
      : biometricType === "fingerprint"
        ? FingerprintIcon
        : LockIcon

  const features: SecurityFeature[] = [
    { label: "Device encryption", available: true },
    { label: biometricLabel, available: capabilities?.isEnrolled ?? true },
    { label: "No cloud backup", available: true },
  ]

  const checkValues = [check1, check2, check3]

  return (
    <View style={{ width }} className="flex-1 justify-center items-center px-6">
      {/* Secure enclave visualization */}
      <View className="mb-6">
        <View
          className="w-24 h-24 rounded-2xl items-center justify-center bg-dark-900 border-2 border-brand-600"
          accessibilityLabel="Secure enclave"
        >
          <ShieldIcon size={44} color={ICON_COLORS.brand} weight="fill" />
          <View className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-dark-950 border-2 border-brand-600 items-center justify-center">
            <BiometricIcon size={14} color={ICON_COLORS.brand} weight="fill" />
          </View>
        </View>
      </View>

      {/* Title */}
      <Text className="text-2xl font-bold text-white text-center mb-2">
        Your Keys, Your Crypto
      </Text>

      {/* Subtitle */}
      <Text className="text-dark-400 text-center text-base mb-6">
        Keys stored locally with biometric protection
      </Text>

      {/* Security features list */}
      <View className="w-full bg-dark-900 rounded-xl p-4 gap-4 border border-dark-800">
        {features.map((feature, index) => (
          <SecurityFeatureRow
            key={feature.label}
            feature={feature}
            animValue={checkValues[index]}
            shouldReduceMotion={shouldReduceMotion}
          />
        ))}
      </View>

      {/* Trust message */}
      <View className="w-full mt-4 bg-brand-900/20 border border-brand-800/50 rounded-xl p-4">
        <Text className="text-brand-400 text-sm text-center leading-5">
          We never have access to your funds.{"\n"}
          Self-custody means you're always in control.
        </Text>
      </View>
    </View>
  )
}

// ============================================================================
// HELPER COMPONENT
// ============================================================================

function SecurityFeatureRow({
  feature,
  animValue,
  shouldReduceMotion,
}: {
  feature: SecurityFeature
  animValue: SharedValue<number>
  shouldReduceMotion: boolean
}) {
  const checkStyle = useAnimatedStyle(() => {
    if (shouldReduceMotion) {
      return { opacity: 1, transform: [{ scale: 1 }] }
    }
    return {
      opacity: animValue.value,
      transform: [
        {
          scale: animValue.value,
        },
      ],
    }
  })

  return (
    <View className="flex-row items-center gap-3">
      <Animated.View
        style={checkStyle}
        className="w-6 h-6 items-center justify-center"
      >
        <CheckCircleIcon
          size={20}
          color={feature.available ? ICON_COLORS.success : ICON_COLORS.muted}
          weight="fill"
        />
      </Animated.View>
      <Text
        className={`text-base ${feature.available ? "text-white" : "text-dark-500"}`}
      >
        {feature.label}
      </Text>
    </View>
  )
}
