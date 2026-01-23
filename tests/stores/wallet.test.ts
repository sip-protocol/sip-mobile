/**
 * Wallet Store Tests
 */

import { describe, it, expect, beforeEach } from "vitest"
import { useWalletStore, formatAddress, WALLET_INFO } from "@/stores/wallet"

describe("Wallet Store", () => {
  beforeEach(() => {
    useWalletStore.setState({
      isConnected: false,
      isConnecting: false,
      address: null,
      chain: null,
      walletType: null,
      connectionMethod: null,
      accounts: [],
      activeAccountId: null,
    })
  })

  describe("Connection State", () => {
    it("should default to disconnected", () => {
      const { isConnected, isConnecting, address } = useWalletStore.getState()
      expect(isConnected).toBe(false)
      expect(isConnecting).toBe(false)
      expect(address).toBeNull()
    })

    it("should set connecting state", () => {
      const { setConnecting } = useWalletStore.getState()

      setConnecting(true)
      expect(useWalletStore.getState().isConnecting).toBe(true)

      setConnecting(false)
      expect(useWalletStore.getState().isConnecting).toBe(false)
    })

    it("should connect wallet", () => {
      const { connect } = useWalletStore.getState()

      connect("phantom", "solana", "ABC123DEF456", "deeplink")

      const state = useWalletStore.getState()
      expect(state.isConnected).toBe(true)
      expect(state.isConnecting).toBe(false)
      expect(state.address).toBe("ABC123DEF456")
      expect(state.chain).toBe("solana")
      expect(state.walletType).toBe("phantom")
      expect(state.connectionMethod).toBe("deeplink")
    })

    it("should disconnect wallet", () => {
      const { connect, disconnect } = useWalletStore.getState()

      connect("phantom", "solana", "ABC123DEF456", "deeplink")
      disconnect()

      const state = useWalletStore.getState()
      expect(state.isConnected).toBe(false)
      expect(state.address).toBeNull()
      expect(state.walletType).toBeNull()
    })
  })

  describe("Multi-Account Management", () => {
    it("should create account on first connect", () => {
      const { connect } = useWalletStore.getState()

      connect("phantom", "solana", "ABC123DEF456", "deeplink")

      const { accounts, activeAccountId } = useWalletStore.getState()
      expect(accounts).toHaveLength(1)
      expect(accounts[0].address).toBe("ABC123DEF456")
      expect(accounts[0].isActive).toBe(true)
      expect(activeAccountId).toBe(accounts[0].id)
    })

    it("should reuse existing account on reconnect", () => {
      const { connect } = useWalletStore.getState()

      connect("phantom", "solana", "ABC123DEF456", "deeplink")
      const firstId = useWalletStore.getState().accounts[0].id

      connect("phantom", "solana", "ABC123DEF456", "deeplink")
      const { accounts } = useWalletStore.getState()

      expect(accounts).toHaveLength(1)
      expect(accounts[0].id).toBe(firstId)
    })

    it("should add multiple accounts", () => {
      const { connect, addAccount } = useWalletStore.getState()

      connect("phantom", "solana", "ABC123", "deeplink")
      addAccount({
        address: "DEF456",
        providerType: "phantom",
        chain: "solana",
      })

      const { accounts } = useWalletStore.getState()
      expect(accounts).toHaveLength(2)
    })

    it("should not duplicate accounts", () => {
      const { addAccount } = useWalletStore.getState()

      const first = addAccount({
        address: "ABC123",
        providerType: "phantom",
        chain: "solana",
      })

      const second = addAccount({
        address: "ABC123",
        providerType: "phantom",
        chain: "solana",
      })

      expect(first.id).toBe(second.id)
      expect(useWalletStore.getState().accounts).toHaveLength(1)
    })

    it("should remove account", () => {
      const { addAccount, removeAccount } = useWalletStore.getState()

      const account = addAccount({
        address: "ABC123",
        providerType: "phantom",
        chain: "solana",
      })

      removeAccount(account.id)

      expect(useWalletStore.getState().accounts).toHaveLength(0)
    })

    it("should switch active account when removing current", () => {
      const { connect, addAccount, removeAccount } =
        useWalletStore.getState()

      connect("phantom", "solana", "ABC123", "deeplink")
      addAccount({
        address: "DEF456",
        providerType: "phantom",
        chain: "solana",
      })

      const firstAccount = useWalletStore.getState().accounts[0]
      removeAccount(firstAccount.id)

      const state = useWalletStore.getState()
      expect(state.accounts).toHaveLength(1)
      expect(state.address).toBe("DEF456")
    })

    it("should disconnect when removing last account", () => {
      const { connect, removeAccount } = useWalletStore.getState()

      connect("phantom", "solana", "ABC123", "deeplink")
      const account = useWalletStore.getState().accounts[0]

      removeAccount(account.id)

      const state = useWalletStore.getState()
      expect(state.isConnected).toBe(false)
      expect(state.accounts).toHaveLength(0)
    })

    it("should set active account", () => {
      const { connect, addAccount, setActiveAccount } = useWalletStore.getState()

      connect("phantom", "solana", "ABC123", "deeplink")
      const second = addAccount({
        address: "DEF456",
        providerType: "phantom",
        chain: "solana",
      })

      setActiveAccount(second.id)

      const state = useWalletStore.getState()
      expect(state.activeAccountId).toBe(second.id)
      expect(state.address).toBe("DEF456")
    })

    it("should update account nickname", () => {
      const { addAccount, updateAccountNickname } = useWalletStore.getState()

      const account = addAccount({
        address: "ABC123",
        providerType: "phantom",
        chain: "solana",
      })

      updateAccountNickname(account.id, "My Main Wallet")

      const updated = useWalletStore.getState().accounts[0]
      expect(updated.nickname).toBe("My Main Wallet")
    })

    it("should get account by address", () => {
      const { addAccount, getAccountByAddress } = useWalletStore.getState()

      addAccount({
        address: "ABC123",
        providerType: "phantom",
        chain: "solana",
      })

      const account = getAccountByAddress("ABC123")
      expect(account).toBeDefined()
      expect(account?.address).toBe("ABC123")
    })

    it("should return undefined for unknown address", () => {
      const { getAccountByAddress } = useWalletStore.getState()
      const account = getAccountByAddress("UNKNOWN")
      expect(account).toBeUndefined()
    })

    it("should get active account", () => {
      const { connect, getActiveAccount } = useWalletStore.getState()

      connect("phantom", "solana", "ABC123", "deeplink")

      const active = getActiveAccount()
      expect(active).toBeDefined()
      expect(active?.address).toBe("ABC123")
    })
  })
})

describe("Wallet Utilities", () => {
  describe("formatAddress", () => {
    it("should format long addresses", () => {
      const formatted = formatAddress("ABC123DEF456GHI789JKL012")
      expect(formatted).toBe("ABC123...L012")
    })

    it("should return short addresses as-is", () => {
      expect(formatAddress("ABC123")).toBe("ABC123")
    })

    it("should return empty for null", () => {
      expect(formatAddress(null)).toBe("")
    })
  })

  describe("WALLET_INFO", () => {
    it("should have phantom info", () => {
      expect(WALLET_INFO.phantom).toBeDefined()
      expect(WALLET_INFO.phantom.name).toBe("Phantom")
      expect(WALLET_INFO.phantom.chain).toBe("solana")
    })

    it("should have all wallet types", () => {
      expect(WALLET_INFO.phantom).toBeDefined()
      expect(WALLET_INFO.solflare).toBeDefined()
      expect(WALLET_INFO.backpack).toBeDefined()
      expect(WALLET_INFO.privy).toBeDefined()
      expect(WALLET_INFO.mwa).toBeDefined()
      expect(WALLET_INFO.walletconnect).toBeDefined()
    })
  })
})
