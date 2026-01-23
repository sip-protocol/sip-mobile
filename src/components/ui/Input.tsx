import { View, TextInput, Text, type TextInputProps } from "react-native"
import { useState } from "react"

interface InputProps extends TextInputProps {
  label?: string
  error?: string
  hint?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export function Input({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  className,
  ...props
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false)

  return (
    <View className={className}>
      {label && (
        <Text className="text-dark-400 text-sm mb-2">{label}</Text>
      )}

      <View
        className={`
          flex-row items-center
          bg-dark-900 rounded-xl border px-4
          ${isFocused ? "border-brand-500" : "border-dark-800"}
          ${error ? "border-red-500" : ""}
        `}
      >
        {leftIcon && <View className="mr-3">{leftIcon}</View>}

        <TextInput
          className="flex-1 text-white py-4 text-base"
          placeholderTextColor="#71717a"
          onFocus={(e) => {
            setIsFocused(true)
            props.onFocus?.(e)
          }}
          onBlur={(e) => {
            setIsFocused(false)
            props.onBlur?.(e)
          }}
          {...props}
        />

        {rightIcon && <View className="ml-3">{rightIcon}</View>}
      </View>

      {error && (
        <Text className="text-red-500 text-xs mt-1">{error}</Text>
      )}

      {hint && !error && (
        <Text className="text-dark-500 text-xs mt-1">{hint}</Text>
      )}
    </View>
  )
}

/**
 * Specialized input for amounts (numbers)
 */
export function AmountInput({
  label,
  token,
  balance,
  onMaxPress,
  ...props
}: InputProps & {
  token?: string
  balance?: string
  onMaxPress?: () => void
}) {
  return (
    <View>
      {label && (
        <Text className="text-dark-400 text-sm mb-2">{label}</Text>
      )}

      <View className="bg-dark-900 rounded-xl border border-dark-800 p-4">
        <TextInput
          className="text-3xl font-bold text-white"
          placeholder="0.00"
          placeholderTextColor="#71717a"
          keyboardType="numeric"
          {...props}
        />

        <View className="flex-row justify-between items-center mt-2">
          <Text className="text-dark-500">
            {balance ? `Balance: ${balance}` : ""}
          </Text>
          {onMaxPress && (
            <Text
              className="text-brand-400 font-medium"
              onPress={onMaxPress}
            >
              MAX
            </Text>
          )}
        </View>
      </View>
    </View>
  )
}
