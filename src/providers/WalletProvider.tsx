/**
 * Wallet Provider
 *
 * Initializes the native wallet on app start.
 * The app uses native wallet management (useNativeWallet) as the primary method.
 *
 * Note: Privy was removed in #71.
 * External wallets (MWA, Phantom) use hooks directly without a provider wrapper.
 *
 * Performance: Wallet initialization is deferred using InteractionManager
 * to ensure smooth UI startup. Critical path: ~50ms init delay.
 */

import { ReactNode, useEffect, useState } from "react"
import { useNativeWallet } from "@/hooks"
import { markPerformance, deferToNextFrame } from "@/utils/performance"

interface WalletProviderProps {
  children: ReactNode
}

/**
 * WalletProvider
 *
 * Initializes the native wallet by calling useNativeWallet() on mount.
 * This triggers the hook's initialization logic which:
 * 1. Checks if a wallet exists in SecureStore
 * 2. Loads the public key
 * 3. Connects to the main wallet store
 *
 * Initialization is deferred until after first render to optimize startup.
 */
export function WalletProvider({ children }: WalletProviderProps) {
  const [shouldInit, setShouldInit] = useState(false)

  // Defer wallet initialization until after UI is interactive
  useEffect(() => {
    markPerformance("wallet_provider_mount")

    // Defer initialization to next frame for smooth UI startup
    deferToNextFrame(() => {
      markPerformance("wallet_init_start")
      setShouldInit(true)
    })
  }, [])

  // Only initialize wallet after UI is interactive
  // This prevents blocking the main thread during startup
  if (shouldInit) {
    return <WalletInitializer>{children}</WalletInitializer>
  }

  return <>{children}</>
}

/**
 * Inner component that initializes the wallet
 */
function WalletInitializer({ children }: { children: ReactNode }) {
  const { isInitialized } = useNativeWallet()

  useEffect(() => {
    if (isInitialized) {
      markPerformance("wallet_initialized")
    }
  }, [isInitialized])

  return <>{children}</>
}
