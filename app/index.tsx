import { useEffect, useRef, useState } from "react"
import { View } from "react-native"
import { router, usePathname } from "expo-router"
import { useWalletStore } from "@/stores/wallet"
import { useSettingsStore } from "@/stores/settings"

/**
 * Root entry route.
 *
 * "/" previously had no explicit index, so expo-router fell into the
 * (auth) group (alphabetically first) whose first declared screen is
 * wallet-setup — making the first-run carousel unreachable.
 *
 * Priority: wallet beats onboarding flag, so existing users never get
 * bounced into education flows.
 *   - wallet present        → home ((tabs) gate requires only a wallet)
 *   - onboarding completed  → wallet-setup (saw the carousel, no wallet yet)
 *   - fresh install         → onboarding carousel
 *
 * ANDROID GOTCHA (verified on-device 2026-09-29): a route decision issued
 * while the navigator is still settling can be silently swallowed, and
 * expo-router then falls back to the (auth) group's first screen — which
 * resurrects wallet-setup-first on every `pm clear` / Detox delete:true
 * launch. Both a render-time <Redirect> and a one-shot effect replace hit
 * this. So the replace is retried until usePathname leaves "/", bounded at
 * ~5s, after which the route tree is assumed stable.
 */
const MAX_REPLACE_ATTEMPTS = 30
const REPLACE_RETRY_MS = 150

export default function Index() {
  const pathname = usePathname()
  const walletHydrated = useWalletStore((s) => s._hasHydrated)
  const settingsHydrated = useSettingsStore((s) => s._hasHydrated)
  const hasWallet = useWalletStore((s) => s.accounts.length > 0)
  const hasCompletedOnboarding = useSettingsStore(
    (s) => s.hasCompletedOnboarding
  )
  const attempts = useRef(0)

  const hydrated = walletHydrated && settingsHydrated
  const target = !hydrated
    ? null
    : hasWallet
      ? "/(tabs)"
      : hasCompletedOnboarding
        ? "/(auth)/wallet-setup"
        : "/(auth)/onboarding"

  useEffect(() => {
    if (!target) return
    // The replace landed — the router left "/".
    if (pathname !== "/") return
    if (attempts.current >= MAX_REPLACE_ATTEMPTS) return
    attempts.current += 1
    const id = setTimeout(() => router.replace(target), REPLACE_RETRY_MS)
    return () => clearTimeout(id)
  }, [target, pathname])

  // Never stays visible — the replace swaps the route as soon as it lands.
  return <View style={{ flex: 1, backgroundColor: "#000" }} />
}
