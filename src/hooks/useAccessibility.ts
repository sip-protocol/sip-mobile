/**
 * Accessibility Hook
 *
 * Detects and responds to accessibility settings
 */

import { useState, useEffect, useCallback, useMemo } from "react"
import { AccessibilityInfo, useColorScheme } from "react-native"

// ============================================================================
// TYPES
// ============================================================================

export interface AccessibilitySettings {
  /** Screen reader is enabled (VoiceOver/TalkBack) */
  screenReaderEnabled: boolean
  /** Reduce motion is enabled */
  reduceMotionEnabled: boolean
  /** Bold text is enabled */
  boldTextEnabled: boolean
  /** Grayscale mode is enabled */
  grayscaleEnabled: boolean
  /** Invert colors is enabled */
  invertColorsEnabled: boolean
  /** Reduce transparency is enabled */
  reduceTransparencyEnabled: boolean
  /** Device color scheme */
  colorScheme: "light" | "dark"
}

export interface UseAccessibilityReturn extends AccessibilitySettings {
  /** Whether any accessibility feature is active */
  hasAccessibilityFeatures: boolean
  /** Check if screen reader is active */
  isScreenReaderActive: () => Promise<boolean>
  /** Announce message to screen readers */
  announce: (message: string) => void
  /** Whether to use simplified animations */
  shouldReduceMotion: boolean
  /** Whether to use high contrast */
  shouldUseHighContrast: boolean
}

// ============================================================================
// HOOK
// ============================================================================

export function useAccessibility(): UseAccessibilityReturn {
  // RN 0.86 ColorSchemeName includes "unspecified" and null; the app's
  // default theme is dark, so both resolve to "dark" (previous fallback).
  const colorScheme: "light" | "dark" = useColorScheme() === "light" ? "light" : "dark"

  const [screenReaderEnabled, setScreenReaderEnabled] = useState(false)
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false)
  const [boldTextEnabled, setBoldTextEnabled] = useState(false)
  const [grayscaleEnabled, setGrayscaleEnabled] = useState(false)
  const [invertColorsEnabled, setInvertColorsEnabled] = useState(false)
  const [reduceTransparencyEnabled, setReduceTransparencyEnabled] = useState(false)

  // ============================================================================
  // INITIALIZATION & LISTENERS
  // ============================================================================

  useEffect(() => {
    // Check initial values
    const checkInitialValues = async () => {
      const [screenReader, reduceMotion, boldText, grayscale, invertColors, reduceTransparency] =
        await Promise.all([
          AccessibilityInfo.isScreenReaderEnabled(),
          AccessibilityInfo.isReduceMotionEnabled(),
          AccessibilityInfo.isBoldTextEnabled(),
          AccessibilityInfo.isGrayscaleEnabled(),
          AccessibilityInfo.isInvertColorsEnabled(),
          AccessibilityInfo.isReduceTransparencyEnabled(),
        ])

      setScreenReaderEnabled(screenReader)
      setReduceMotionEnabled(reduceMotion)
      setBoldTextEnabled(boldText)
      setGrayscaleEnabled(grayscale)
      setInvertColorsEnabled(invertColors)
      setReduceTransparencyEnabled(reduceTransparency)
    }

    checkInitialValues()

    // Set up listeners
    const screenReaderListener = AccessibilityInfo.addEventListener(
      "screenReaderChanged",
      setScreenReaderEnabled
    )

    const reduceMotionListener = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotionEnabled
    )

    const boldTextListener = AccessibilityInfo.addEventListener(
      "boldTextChanged",
      setBoldTextEnabled
    )

    const grayscaleListener = AccessibilityInfo.addEventListener(
      "grayscaleChanged",
      setGrayscaleEnabled
    )

    const invertColorsListener = AccessibilityInfo.addEventListener(
      "invertColorsChanged",
      setInvertColorsEnabled
    )

    const reduceTransparencyListener = AccessibilityInfo.addEventListener(
      "reduceTransparencyChanged",
      setReduceTransparencyEnabled
    )

    return () => {
      screenReaderListener.remove()
      reduceMotionListener.remove()
      boldTextListener.remove()
      grayscaleListener.remove()
      invertColorsListener.remove()
      reduceTransparencyListener.remove()
    }
  }, [])

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const hasAccessibilityFeatures = useMemo(() => {
    return (
      screenReaderEnabled ||
      reduceMotionEnabled ||
      boldTextEnabled ||
      grayscaleEnabled ||
      invertColorsEnabled ||
      reduceTransparencyEnabled
    )
  }, [
    screenReaderEnabled,
    reduceMotionEnabled,
    boldTextEnabled,
    grayscaleEnabled,
    invertColorsEnabled,
    reduceTransparencyEnabled,
  ])

  const shouldReduceMotion = reduceMotionEnabled
  const shouldUseHighContrast = invertColorsEnabled || grayscaleEnabled

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const isScreenReaderActive = useCallback(async (): Promise<boolean> => {
    return AccessibilityInfo.isScreenReaderEnabled()
  }, [])

  const announce = useCallback((message: string): void => {
    AccessibilityInfo.announceForAccessibility(message)
  }, [])

  // ============================================================================
  // RETURN
  // ============================================================================

  return useMemo(
    () => ({
      screenReaderEnabled,
      reduceMotionEnabled,
      boldTextEnabled,
      grayscaleEnabled,
      invertColorsEnabled,
      reduceTransparencyEnabled,
      colorScheme,
      hasAccessibilityFeatures,
      isScreenReaderActive,
      announce,
      shouldReduceMotion,
      shouldUseHighContrast,
    }),
    [
      screenReaderEnabled,
      reduceMotionEnabled,
      boldTextEnabled,
      grayscaleEnabled,
      invertColorsEnabled,
      reduceTransparencyEnabled,
      colorScheme,
      hasAccessibilityFeatures,
      isScreenReaderActive,
      announce,
      shouldReduceMotion,
      shouldUseHighContrast,
    ]
  )
}

// ============================================================================
// PREFERS REDUCED MOTION HOOK (simpler version)
// ============================================================================

/**
 * Simple hook to check if reduced motion is preferred
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setPrefersReducedMotion)

    const listener = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setPrefersReducedMotion
    )

    return () => listener.remove()
  }, [])

  return prefersReducedMotion
}

// ============================================================================
// SCREEN READER ACTIVE HOOK (simpler version)
// ============================================================================

/**
 * Simple hook to check if screen reader is active
 */
export function useScreenReader(): boolean {
  const [isActive, setIsActive] = useState(false)

  useEffect(() => {
    AccessibilityInfo.isScreenReaderEnabled().then(setIsActive)

    const listener = AccessibilityInfo.addEventListener(
      "screenReaderChanged",
      setIsActive
    )

    return () => listener.remove()
  }, [])

  return isActive
}
