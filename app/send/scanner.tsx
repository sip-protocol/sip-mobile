/**
 * QR Scanner Screen
 *
 * Scans QR codes for Solana addresses and SIP stealth addresses.
 * Returns the scanned address to the Send screen.
 *
 * Supported formats:
 * - Regular Solana address: Base58 (32-44 chars)
 * - SIP Stealth address: sip:solana:<spending>:<viewing>
 * - Solana Pay URL: solana:<address>
 */

import { useState, useEffect, useCallback } from "react"
import { View, Text, StyleSheet, TouchableOpacity, Vibration, Platform } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router, useLocalSearchParams } from "expo-router"
import { CameraView, useCameraPermissions, BarcodeScanningResult } from "expo-camera"
import { useToastStore } from "@/stores/toast"

// ============================================================================
// ADDRESS VALIDATION
// ============================================================================

const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const STEALTH_ADDRESS_REGEX = /^sip:solana:[1-9A-HJ-NP-Za-km-z]{32,44}:[1-9A-HJ-NP-Za-km-z]{32,44}$/
const SOLANA_PAY_REGEX = /^solana:([1-9A-HJ-NP-Za-km-z]{32,44})/

/**
 * Parse and validate scanned QR data
 */
function parseQRData(data: string): { address: string; type: "stealth" | "regular" | "invalid" } {
  if (!data) {
    return { address: "", type: "invalid" }
  }

  const trimmed = data.trim()

  // Check for SIP stealth address
  if (STEALTH_ADDRESS_REGEX.test(trimmed)) {
    return { address: trimmed, type: "stealth" }
  }

  // Check for Solana Pay URL (extract address)
  const payMatch = trimmed.match(SOLANA_PAY_REGEX)
  if (payMatch && payMatch[1]) {
    return { address: payMatch[1], type: "regular" }
  }

  // Check for regular Solana address
  if (SOLANA_ADDRESS_REGEX.test(trimmed)) {
    return { address: trimmed, type: "regular" }
  }

  return { address: trimmed, type: "invalid" }
}

// ============================================================================
// SCANNER SCREEN
// ============================================================================

export default function ScannerScreen() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>()
  const [permission, requestPermission] = useCameraPermissions()
  const [scanned, setScanned] = useState(false)
  const [flashOn, setFlashOn] = useState(false)
  const { addToast } = useToastStore()

  // Request permission on mount
  useEffect(() => {
    if (!permission?.granted) {
      requestPermission()
    }
  }, [permission, requestPermission])

  // Handle barcode scan
  const handleBarCodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (scanned) return // Prevent multiple scans

      const { data } = result
      const parsed = parseQRData(data)

      // Haptic feedback
      if (Platform.OS !== "web") {
        Vibration.vibrate(100)
      }

      if (parsed.type === "invalid") {
        addToast({
          type: "error",
          title: "Invalid QR Code",
          message: "This QR code doesn't contain a valid Solana address",
        })
        // Allow rescan after invalid
        setTimeout(() => setScanned(false), 2000)
        return
      }

      setScanned(true)

      // Show success toast
      addToast({
        type: "success",
        title: parsed.type === "stealth" ? "Stealth Address Scanned" : "Address Scanned",
        message: `${parsed.address.slice(0, 8)}...${parsed.address.slice(-8)}`,
      })

      // Navigate back with the address
      // Use replace to avoid scanner staying in history
      router.replace({
        pathname: returnTo === "receive" ? "/(tabs)/receive" : "/(tabs)/send",
        params: { scannedAddress: parsed.address },
      })
    },
    [scanned, addToast, returnTo]
  )

  // Permission not yet determined
  if (!permission) {
    return (
      <SafeAreaView className="flex-1 bg-dark-950 justify-center items-center">
        <Text className="text-white text-lg">Requesting camera permission...</Text>
      </SafeAreaView>
    )
  }

  // Permission denied
  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 bg-dark-950 justify-center items-center px-6">
        <Text className="text-6xl mb-6">📷</Text>
        <Text className="text-white text-xl font-semibold text-center mb-4">
          Camera Permission Required
        </Text>
        <Text className="text-dark-400 text-center mb-8">
          We need camera access to scan QR codes containing wallet addresses.
        </Text>
        <TouchableOpacity
          className="bg-brand-600 px-6 py-3 rounded-xl"
          onPress={requestPermission}
        >
          <Text className="text-white font-semibold">Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity className="mt-4 py-2" onPress={() => router.back()}>
          <Text className="text-dark-400">Cancel</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  return (
    <View className="flex-1 bg-black">
      {/* Camera View */}
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        enableTorch={flashOn}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      {/* Overlay */}
      <SafeAreaView className="flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-2">
          <TouchableOpacity
            className="bg-black/50 rounded-full p-3"
            onPress={() => router.back()}
          >
            <Text className="text-white text-lg">✕</Text>
          </TouchableOpacity>

          <Text className="text-white font-semibold text-lg">Scan QR Code</Text>

          <TouchableOpacity
            className="bg-black/50 rounded-full p-3"
            onPress={() => setFlashOn(!flashOn)}
          >
            <Text className="text-2xl">{flashOn ? "🔦" : "💡"}</Text>
          </TouchableOpacity>
        </View>

        {/* Scanning Frame */}
        <View className="flex-1 justify-center items-center">
          <View className="relative">
            {/* Corner Markers */}
            <View style={styles.frame}>
              {/* Top Left */}
              <View style={[styles.corner, styles.topLeft]} />
              {/* Top Right */}
              <View style={[styles.corner, styles.topRight]} />
              {/* Bottom Left */}
              <View style={[styles.corner, styles.bottomLeft]} />
              {/* Bottom Right */}
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
          </View>

          {/* Instructions */}
          <View className="mt-8 bg-black/60 px-4 py-2 rounded-full">
            <Text className="text-white text-center">
              {scanned ? "Processing..." : "Align QR code within frame"}
            </Text>
          </View>
        </View>

        {/* Bottom Info */}
        <View className="px-6 pb-4">
          <View className="bg-black/60 rounded-xl p-4">
            <Text className="text-white font-medium mb-2">Supported formats:</Text>
            <Text className="text-dark-400 text-sm">• Solana wallet address</Text>
            <Text className="text-dark-400 text-sm">• SIP stealth address</Text>
            <Text className="text-dark-400 text-sm">• Solana Pay URL</Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  )
}

// ============================================================================
// STYLES
// ============================================================================

const FRAME_SIZE = 280
const CORNER_SIZE = 40
const CORNER_WIDTH = 4

const styles = StyleSheet.create({
  frame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: "#10B981", // brand-500
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderTopLeftRadius: 12,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderTopRightRadius: 12,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderBottomLeftRadius: 12,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderBottomRightRadius: 12,
  },
})
