/**
 * NumpadInput Component
 *
 * Shared numpad input for Send and Swap screens.
 * Adapted from Jupiter Mobile's numpad UX pattern.
 *
 * Features:
 * - Large centered amount display
 * - Token symbol + balance pill
 * - 4x4 grid: presets (MAX/75%/50%/CLEAR) + digit pad
 * - Decimal limiting per token.decimals
 * - Haptic feedback on key press
 */

import { View, Text, TouchableOpacity } from "react-native"
import React, { useState, useCallback, useEffect, useRef } from "react"
import { BackspaceIcon } from "phosphor-react-native"
import { useSettingsStore } from "@/stores/settings"
import { hapticLight } from "@/utils/haptics"
import { ICON_COLORS } from "@/constants/icons"
import type { TokenInfo } from "@/types"

// ============================================================================
// TYPES
// ============================================================================

export interface NumpadInputProps {
  token: TokenInfo
  balance: number
  onAmountChange: (amount: number) => void
  ctaLabel: string
  ctaDisabledLabel?: string
  onCtaPress: () => void
  disabled?: boolean
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Truncate a number to a given number of decimal places (floor, no rounding)
 */
export function truncateToDecimals(value: number, decimals: number): number {
  if (decimals <= 0) return Math.floor(value)
  const str = value.toString()
  const dotIndex = str.indexOf(".")
  if (dotIndex === -1) return value
  const truncated = str.slice(0, dotIndex + 1 + decimals)
  return parseFloat(truncated)
}

/**
 * Format a display string from a preset percentage of balance
 */
export function computePreset(balance: number, percentage: number, decimals: number): string {
  const raw = balance * percentage
  const truncated = truncateToDecimals(raw, decimals)
  if (truncated === 0) return "0"
  // Remove trailing zeros after decimal point
  return truncated.toString()
}

/**
 * Validate whether appending a character to the display string is allowed
 */
export function canAppendChar(display: string, char: string, maxDecimals: number): boolean {
  // Max 15 characters to prevent overflow
  if (display.length >= 15) return false

  // Dot: only one allowed, and only if decimals > 0
  if (char === ".") {
    if (maxDecimals <= 0) return false
    if (display.includes(".")) return false
    return true
  }

  // Digit: check decimal limit
  if (display.includes(".")) {
    const decimalPart = display.split(".")[1] || ""
    if (decimalPart.length >= maxDecimals) return false
  }

  return true
}

/**
 * Apply backspace to display string
 */
export function applyBackspace(display: string): string {
  if (display.length <= 1) return "0"
  return display.slice(0, -1)
}

/**
 * Append a character to display string, handling leading zero
 */
export function appendToDisplay(display: string, char: string): string {
  // Starting from "0", replace with digit (not dot)
  if (display === "0" && char !== ".") {
    return char
  }
  return display + char
}

/**
 * Parse display string to number
 */
export function parseDisplay(display: string): number {
  const parsed = parseFloat(display)
  return isNaN(parsed) ? 0 : parsed
}

// ============================================================================
// COMPONENT
// ============================================================================

export function NumpadInput({
  token,
  balance,
  onAmountChange,
  ctaLabel,
  ctaDisabledLabel,
  onCtaPress,
  disabled = false,
}: NumpadInputProps) {
  const [display, setDisplay] = useState("0")
  const hideBalances = useSettingsStore((s) => s.hideBalances)

  // Reset display when token changes
  const prevMintRef = useRef(token.mint)
  useEffect(() => {
    if (prevMintRef.current !== token.mint) {
      setDisplay("0")
      onAmountChange(0)
      prevMintRef.current = token.mint
    }
  }, [token.mint, onAmountChange])

  const amount = parseDisplay(display)
  const isCtaActive = amount > 0 && !disabled

  const updateDisplay = useCallback(
    (newDisplay: string) => {
      setDisplay(newDisplay)
      onAmountChange(parseDisplay(newDisplay))
    },
    [onAmountChange],
  )

  // --- Digit / dot press ---
  const handleKeyPress = useCallback(
    (char: string) => {
      hapticLight()
      if (!canAppendChar(display, char, token.decimals)) return
      updateDisplay(appendToDisplay(display, char))
    },
    [display, token.decimals, updateDisplay],
  )

  // --- Backspace ---
  const handleBackspace = useCallback(() => {
    hapticLight()
    updateDisplay(applyBackspace(display))
  }, [display, updateDisplay])

  // --- Presets ---
  const handlePreset = useCallback(
    (percentage: number) => {
      hapticLight()
      if (percentage === 0) {
        // CLEAR
        updateDisplay("0")
        return
      }
      updateDisplay(computePreset(balance, percentage, token.decimals))
    },
    [balance, token.decimals, updateDisplay],
  )

  // --- CTA ---
  const handleCtaPress = useCallback(() => {
    if (!isCtaActive) return
    hapticLight()
    onCtaPress()
  }, [isCtaActive, onCtaPress])

  // --- Balance display ---
  const balanceText = hideBalances
    ? "******"
    : `${balance} ${token.symbol}`

  return (
    <View className="flex-1">
      {/* Amount display area */}
      <View className="items-center justify-center flex-1">
        {/* Token symbol */}
        <Text className="text-white text-lg font-semibold mb-2">
          {token.symbol}
        </Text>

        {/* Amount */}
        <Text
          className="text-white text-5xl font-bold mb-4"
          numberOfLines={1}
          adjustsFontSizeToFit
          accessibilityLabel={`Amount: ${display} ${token.symbol}`}
        >
          {display}
        </Text>

        {/* Balance pill */}
        <View className="bg-dark-800 px-4 py-1.5 rounded-full">
          <Text className="text-dark-400 text-sm" testID="balance-pill">
            {balanceText}
          </Text>
        </View>
      </View>

      {/* Numpad grid */}
      <View className="pb-4">
        {/* Row 1: MAX 1 2 3 */}
        <View className="flex-row mb-1">
          <TouchableOpacity
            className="flex-1 py-3 items-center justify-center"
            onPress={() => handlePreset(1)}
            testID="preset-max"
            accessibilityLabel="Maximum amount"
            accessibilityRole="button"
          >
            <Text className="text-brand-400 text-base font-semibold">MAX</Text>
          </TouchableOpacity>
          {["1", "2", "3"].map((d) => (
            <TouchableOpacity
              key={d}
              className="flex-1 py-3 items-center justify-center"
              onPress={() => handleKeyPress(d)}
              testID={`key-${d}`}
              accessibilityLabel={d}
              accessibilityRole="button"
            >
              <Text className="text-white text-2xl font-medium">{d}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Row 2: 75% 4 5 6 */}
        <View className="flex-row mb-1">
          <TouchableOpacity
            className="flex-1 py-3 items-center justify-center"
            onPress={() => handlePreset(0.75)}
            testID="preset-75"
            accessibilityLabel="75 percent"
            accessibilityRole="button"
          >
            <Text className="text-brand-400 text-base font-semibold">75%</Text>
          </TouchableOpacity>
          {["4", "5", "6"].map((d) => (
            <TouchableOpacity
              key={d}
              className="flex-1 py-3 items-center justify-center"
              onPress={() => handleKeyPress(d)}
              testID={`key-${d}`}
              accessibilityLabel={d}
              accessibilityRole="button"
            >
              <Text className="text-white text-2xl font-medium">{d}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Row 3: 50% 7 8 9 */}
        <View className="flex-row mb-1">
          <TouchableOpacity
            className="flex-1 py-3 items-center justify-center"
            onPress={() => handlePreset(0.5)}
            testID="preset-50"
            accessibilityLabel="50 percent"
            accessibilityRole="button"
          >
            <Text className="text-brand-400 text-base font-semibold">50%</Text>
          </TouchableOpacity>
          {["7", "8", "9"].map((d) => (
            <TouchableOpacity
              key={d}
              className="flex-1 py-3 items-center justify-center"
              onPress={() => handleKeyPress(d)}
              testID={`key-${d}`}
              accessibilityLabel={d}
              accessibilityRole="button"
            >
              <Text className="text-white text-2xl font-medium">{d}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Row 4: CLEAR . 0 ⌫ */}
        <View className="flex-row mb-1">
          <TouchableOpacity
            className="flex-1 py-3 items-center justify-center"
            onPress={() => handlePreset(0)}
            testID="preset-clear"
            accessibilityLabel="Clear amount"
            accessibilityRole="button"
          >
            <Text className="text-brand-400 text-base font-semibold">CLEAR</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 py-3 items-center justify-center"
            onPress={() => handleKeyPress(".")}
            testID="key-dot"
            accessibilityLabel="Decimal point"
            accessibilityRole="button"
          >
            <Text className="text-white text-2xl font-medium">.</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 py-3 items-center justify-center"
            onPress={() => handleKeyPress("0")}
            testID="key-0"
            accessibilityLabel="0"
            accessibilityRole="button"
          >
            <Text className="text-white text-2xl font-medium">0</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 py-3 items-center justify-center"
            onPress={handleBackspace}
            testID="key-backspace"
            accessibilityLabel="Delete"
            accessibilityRole="button"
          >
            <BackspaceIcon size={24} color={ICON_COLORS.white} weight="regular" />
          </TouchableOpacity>
        </View>

        {/* CTA Button */}
        <TouchableOpacity
          className={`mx-4 mt-2 py-4 rounded-2xl items-center ${
            isCtaActive ? "bg-brand-600" : "bg-dark-800"
          }`}
          onPress={handleCtaPress}
          disabled={!isCtaActive}
          testID="cta-button"
          accessibilityRole="button"
          accessibilityLabel={isCtaActive ? ctaLabel : (ctaDisabledLabel ?? ctaLabel)}
        >
          <Text
            className={`text-lg font-semibold ${
              isCtaActive ? "text-white" : "text-dark-500"
            }`}
          >
            {isCtaActive ? ctaLabel : (ctaDisabledLabel ?? ctaLabel)}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
