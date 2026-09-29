import { Redirect } from "expo-router"
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
 * Renders null until both persisted stores hydrate — otherwise a fresh
 * mount reads default state and mis-routes returning users.
 */
export default function Index() {
  const walletHydrated = useWalletStore((s) => s._hasHydrated)
  const settingsHydrated = useSettingsStore((s) => s._hasHydrated)
  const hasWallet = useWalletStore((s) => s.accounts.length > 0)
  const hasCompletedOnboarding = useSettingsStore(
    (s) => s.hasCompletedOnboarding
  )

  if (!walletHydrated || !settingsHydrated) {
    return null
  }

  if (hasWallet) {
    return <Redirect href="/(tabs)" />
  }

  if (hasCompletedOnboarding) {
    return <Redirect href="/(auth)/wallet-setup" />
  }

  return <Redirect href="/(auth)/onboarding" />
}
