/**
 * Wallet Provider
 *
 * Wraps the app with Privy authentication provider.
 * Note: MWA and Phantom don't require providers - they use hooks directly.
 */

import { PrivyProvider } from "@privy-io/expo"

// Privy app credentials
// TODO: Move to environment variables
const PRIVY_APP_ID = process.env.EXPO_PUBLIC_PRIVY_APP_ID || "your-privy-app-id"
const PRIVY_CLIENT_ID =
  process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID || "your-privy-client-id"

interface WalletProviderProps {
  children: React.ReactNode
}

export function WalletProvider({ children }: WalletProviderProps) {
  return (
    <PrivyProvider appId={PRIVY_APP_ID} clientId={PRIVY_CLIENT_ID}>
      {children}
    </PrivyProvider>
  )
}
