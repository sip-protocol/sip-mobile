import { create } from "zustand"
import type { ChainType, WalletType, ConnectionMethod } from "@/types"

export interface WalletState {
  // Connection state
  isConnected: boolean
  isConnecting: boolean
  address: string | null
  chain: ChainType | null
  walletType: WalletType | null
  connectionMethod: ConnectionMethod | null

  // Actions
  setConnecting: (connecting: boolean) => void
  connect: (
    walletType: WalletType,
    chain: ChainType,
    address: string,
    method: ConnectionMethod
  ) => void
  disconnect: () => void
}

export const useWalletStore = create<WalletState>((set) => ({
  // Initial state
  isConnected: false,
  isConnecting: false,
  address: null,
  chain: null,
  walletType: null,
  connectionMethod: null,

  // Actions
  setConnecting: (connecting) => set({ isConnecting: connecting }),

  connect: (walletType, chain, address, method) =>
    set({
      isConnected: true,
      isConnecting: false,
      walletType,
      chain,
      address,
      connectionMethod: method,
    }),

  disconnect: () =>
    set({
      isConnected: false,
      isConnecting: false,
      address: null,
      chain: null,
      walletType: null,
      connectionMethod: null,
    }),
}))

/**
 * Format address for display (truncated)
 */
export function formatAddress(address: string | null): string {
  if (!address) return ""
  if (address.length <= 10) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

/**
 * Wallet metadata for mobile
 */
export const WALLET_INFO: Record<
  WalletType,
  {
    name: string
    icon: string
    chain: ChainType
    connectionMethod: ConnectionMethod
    deepLinkScheme?: string
  }
> = {
  phantom: {
    name: "Phantom",
    icon: "phantom",
    chain: "solana",
    connectionMethod: "deeplink",
    deepLinkScheme: "phantom://",
  },
  solflare: {
    name: "Solflare",
    icon: "solflare",
    chain: "solana",
    connectionMethod: "deeplink",
    deepLinkScheme: "solflare://",
  },
  backpack: {
    name: "Backpack",
    icon: "backpack",
    chain: "solana",
    connectionMethod: "deeplink",
    deepLinkScheme: "backpack://",
  },
  privy: {
    name: "Email/Social",
    icon: "privy",
    chain: "solana",
    connectionMethod: "embedded",
  },
  mwa: {
    name: "Mobile Wallet",
    icon: "solana",
    chain: "solana",
    connectionMethod: "mwa",
  },
  walletconnect: {
    name: "WalletConnect",
    icon: "walletconnect",
    chain: "ethereum",
    connectionMethod: "deeplink",
  },
}
