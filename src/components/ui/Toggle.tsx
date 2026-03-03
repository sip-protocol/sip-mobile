import { View, Text, TouchableOpacity, Animated } from "react-native"
import { useRef, useEffect } from "react"
import { LockSimpleIcon, LockSimpleOpenIcon } from "phosphor-react-native"
import { ICON_COLORS } from "@/constants/icons"

interface ToggleProps {
  value: boolean
  onValueChange: (value: boolean) => void
  label?: string
  description?: string
  disabled?: boolean
}

export function Toggle({
  value,
  onValueChange,
  label,
  description,
  disabled = false,
}: ToggleProps) {
  const translateX = useRef(new Animated.Value(value ? 20 : 0)).current

  useEffect(() => {
    Animated.spring(translateX, {
      toValue: value ? 20 : 0,
      useNativeDriver: true,
      friction: 8,
    }).start()
  }, [value, translateX])

  return (
    <TouchableOpacity
      className={`flex-row items-center justify-between py-3 ${
        disabled ? "opacity-50" : ""
      }`}
      onPress={() => !disabled && onValueChange(!value)}
      activeOpacity={0.7}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={label || "Toggle"}
      accessibilityState={{ checked: value, disabled }}
    >
      {(label || description) && (
        <View className="flex-1 mr-4">
          {label && (
            <Text className="text-white font-medium">{label}</Text>
          )}
          {description && (
            <Text className="text-dark-500 text-sm mt-0.5">
              {description}
            </Text>
          )}
        </View>
      )}

      <View
        className={`w-12 h-7 rounded-full justify-center px-1 ${
          value ? "bg-brand-600" : "bg-dark-700"
        }`}
      >
        <Animated.View
          style={{ transform: [{ translateX }] }}
          className="w-5 h-5 bg-white rounded-full shadow"
        />
      </View>
    </TouchableOpacity>
  )
}

/**
 * Privacy toggle with icon and special styling
 */
export function PrivacyToggle({
  value,
  onValueChange,
  disabled = false,
}: {
  value: boolean
  onValueChange: (value: boolean) => void
  disabled?: boolean
}) {
  return (
    <TouchableOpacity
      className={`p-4 rounded-xl border ${
        value
          ? "bg-brand-900/20 border-brand-700"
          : "bg-dark-900 border-dark-800"
      } ${disabled ? "opacity-50" : ""}`}
      onPress={() => !disabled && onValueChange(!value)}
      activeOpacity={0.7}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={value ? "Private mode enabled" : "Private mode disabled"}
      accessibilityHint="Toggles privacy for this transaction"
      accessibilityState={{ checked: value, disabled }}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          {value ? (
            <LockSimpleIcon size={28} color={ICON_COLORS.brand} weight="fill" />
          ) : (
            <LockSimpleOpenIcon size={28} color={ICON_COLORS.muted} weight="regular" />
          )}
          <View>
            <Text
              className={`font-medium ${
                value ? "text-brand-400" : "text-white"
              }`}
            >
              {value ? "Private" : "Public"}
            </Text>
            <Text className="text-dark-500 text-xs">
              {value ? "Amount and recipient hidden" : "Visible on-chain"}
            </Text>
          </View>
        </View>

        <View
          className={`w-12 h-7 rounded-full justify-center ${
            value ? "bg-brand-600 items-end" : "bg-dark-700 items-start"
          } px-1`}
        >
          <View className="w-5 h-5 bg-white rounded-full" />
        </View>
      </View>
    </TouchableOpacity>
  )
}
