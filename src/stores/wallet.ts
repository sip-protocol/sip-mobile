import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import AsyncStorage from "@react-native-async-storage/async-storage"
import type { ChainType, WalletType, ConnectionMethod, WalletProviderType, StoredAccount, CreateAccountInput } from "@/types"

// ============================================================================
// TYPES
// ============================================================================

export interface WalletState {
  // Connection state
  isConnected: boolean
  isConnecting: boolean
  address: string | null
  chain: ChainType | null
  walletType: WalletType | null
  connectionMethod: ConnectionMethod | null

  // Multi-account state
  accounts: StoredAccount[]
  activeAccountId: string | null

  // Actions
  setConnecting: (connecting: boolean) => void
  connect: (
    walletType: WalletType,
    chain: ChainType,
    address: string,
    method: ConnectionMethod
  ) => void
  disconnect: () => void

  // Multi-account actions
  addAccount: (input: CreateAccountInput) => StoredAccount
  removeAccount: (accountId: string) => void
  setActiveAccount: (accountId: string) => void
  updateAccountNickname: (accountId: string, nickname: string) => void
  getAccountByAddress: (address: string) => StoredAccount | undefined
  getActiveAccount: () => StoredAccount | undefined
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Generate unique account ID
 */
function generateAccountId(): string {
  return `acc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Generate default nickname from address
 */
function generateNickname(address: string, index: number): string {
  const shortAddr = `${address.slice(0, 4)}...${address.slice(-4)}`
  return index === 0 ? `Main (${shortAddr})` : `Account ${index + 1} (${shortAddr})`
}

// ============================================================================
// STORE
// ============================================================================

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      // Initial state
      isConnected: false,
      isConnecting: false,
      address: null,
      chain: null,
      walletType: null,
      connectionMethod: null,

      // Multi-account state
      accounts: [],
      activeAccountId: null,

      // Actions
      setConnecting: (connecting) => set({ isConnecting: connecting }),

      connect: (walletType, chain, address, method) => {
        const state = get()

        // Check if account already exists
        let account = state.accounts.find((a) => a.address === address)

        if (!account) {
          // Create new account
          account = {
            id: generateAccountId(),
            address,
            nickname: generateNickname(address, state.accounts.length),
            providerType: walletTypeToProvider(walletType),
            chain,
            createdAt: Date.now(),
            lastUsedAt: Date.now(),
            isActive: true,
          }

          set((s) => ({
            accounts: [...s.accounts.map((a) => ({ ...a, isActive: false })), account!],
            activeAccountId: account!.id,
          }))
        } else {
          // Update existing account
          set((s) => ({
            accounts: s.accounts.map((a) =>
              a.id === account!.id
                ? { ...a, lastUsedAt: Date.now(), isActive: true }
                : { ...a, isActive: false }
            ),
            activeAccountId: account!.id,
          }))
        }

        set({
          isConnected: true,
          isConnecting: false,
          walletType,
          chain,
          address,
          connectionMethod: method,
        })
      },

      disconnect: () =>
        set({
          isConnected: false,
          isConnecting: false,
          address: null,
          chain: null,
          walletType: null,
          connectionMethod: null,
        }),

      // Multi-account actions
      addAccount: (input) => {
        const state = get()
        const existingAccount = state.accounts.find((a) => a.address === input.address)

        if (existingAccount) {
          return existingAccount
        }

        const newAccount: StoredAccount = {
          id: generateAccountId(),
          address: input.address,
          nickname: input.nickname || generateNickname(input.address, state.accounts.length),
          providerType: input.providerType,
          chain: input.chain,
          createdAt: Date.now(),
          lastUsedAt: Date.now(),
          isActive: false,
        }

        set((s) => ({
          accounts: [...s.accounts, newAccount],
        }))

        return newAccount
      },

      removeAccount: (accountId) => {
        const state = get()
        const accountToRemove = state.accounts.find((a) => a.id === accountId)

        if (!accountToRemove) return

        const newAccounts = state.accounts.filter((a) => a.id !== accountId)

        // If removing active account, switch to another or disconnect
        if (state.activeAccountId === accountId) {
          if (newAccounts.length > 0) {
            const nextAccount = newAccounts[0]
            set({
              accounts: newAccounts.map((a, i) =>
                i === 0 ? { ...a, isActive: true } : { ...a, isActive: false }
              ),
              activeAccountId: nextAccount.id,
              address: nextAccount.address,
              chain: nextAccount.chain,
            })
          } else {
            // No accounts left, disconnect
            set({
              accounts: [],
              activeAccountId: null,
              isConnected: false,
              address: null,
              chain: null,
              walletType: null,
              connectionMethod: null,
            })
          }
        } else {
          set({ accounts: newAccounts })
        }
      },

      setActiveAccount: (accountId) => {
        const state = get()
        const account = state.accounts.find((a) => a.id === accountId)

        if (!account) return

        set((s) => ({
          accounts: s.accounts.map((a) =>
            a.id === accountId
              ? { ...a, isActive: true, lastUsedAt: Date.now() }
              : { ...a, isActive: false }
          ),
          activeAccountId: accountId,
          address: account.address,
          chain: account.chain,
          isConnected: true,
        }))
      },

      updateAccountNickname: (accountId, nickname) => {
        set((s) => ({
          accounts: s.accounts.map((a) =>
            a.id === accountId ? { ...a, nickname } : a
          ),
        }))
      },

      getAccountByAddress: (address) => {
        return get().accounts.find((a) => a.address === address)
      },

      getActiveAccount: () => {
        const state = get()
        return state.accounts.find((a) => a.id === state.activeAccountId)
      },
    }),
    {
      name: "sip-wallet-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        accounts: state.accounts,
        activeAccountId: state.activeAccountId,
      }),
    }
  )
)

// ============================================================================
// UTILS
// ============================================================================

/**
 * Convert WalletType to WalletProviderType
 */
function walletTypeToProvider(walletType: WalletType): WalletProviderType {
  switch (walletType) {
    case "privy":
      return "privy"
    case "mwa":
      return "mwa"
    case "phantom":
    case "solflare":
    case "backpack":
      return "phantom" // All deeplink wallets use phantom-style connection
    default:
      return "phantom"
  }
}

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
