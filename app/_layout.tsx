import "../global.css"
import { useEffect, useState, useCallback } from "react"
import { Stack } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import * as SplashScreen from "expo-splash-screen"
import { WalletProvider } from "@/providers"
import {
  markPerformance,
  logPerformanceSummary,
} from "@/utils/performance"

// Keep splash screen visible while we initialize
SplashScreen.preventAutoHideAsync()
markPerformance("splash_prevented")

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    async function prepare() {
      markPerformance("prepare_start")
      try {
        // Minimal delay - let stores hydrate async
        await new Promise((resolve) => setTimeout(resolve, 50))
        markPerformance("prepare_done")
      } finally {
        setIsReady(true)
        markPerformance("is_ready")
      }
    }
    prepare()
  }, [])

  // Hide splash screen when ready
  useEffect(() => {
    if (isReady) {
      markPerformance("hiding_splash")
      SplashScreen.hideAsync()
        .then(() => markPerformance("splash_hidden"))
        .catch(() => {})
    }
  }, [isReady])

  const onLayoutRootView = useCallback(async () => {
    if (isReady) {
      markPerformance("layout_ready")
      try {
        await SplashScreen.hideAsync()
        markPerformance("app_ready")
        // Log performance summary in dev mode
        logPerformanceSummary()
      } catch {
        // Ignore - splash may already be hidden
      }
    }
  }, [isReady])

  if (!isReady) {
    return null
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <WalletProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "#0a0a0a" },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </WalletProvider>
    </GestureHandlerRootView>
  )
}
