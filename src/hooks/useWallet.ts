/**
 * Unified Wallet Hook
 *
 * Abstracts all 3 wallet connection methods:
 * - Privy (embedded wallet with SSO)
 * - MWA (Mobile Wallet Adapter for Android)
 * - Phantom Deeplinks (iOS external wallet)
 *
 * Usage:
 *   const { connect, disconnect, account, status } = useWallet()
 *   await connect('privy')  // or 'mwa' or 'phantom'
 */

import { useState, useCallback, useEffect } from "react"
import { Platform } from "react-native"
import {
  usePrivy,
  useEmbeddedSolanaWallet,
  useLoginWithEmail,
  useLoginWithSMS,
  useLoginWithOAuth,
} from "@privy-io/expo"
import { useMWA } from "./useMWA"
import { usePhantomDeeplink } from "./usePhantomDeeplink"
import type {
  WalletAccount,
  WalletConnectionStatus,
  WalletProviderType,
  WalletError,
} from "@/types"

interface UseWalletReturn {
  // State
  account: WalletAccount | null
  status: WalletConnectionStatus
  error: WalletError | null
  providerType: WalletProviderType | null

  // Provider availability
  isPrivyAvailable: boolean
  isMWAAvailable: boolean
  isPhantomAvailable: boolean

  // Actions
  connect: (provider: WalletProviderType) => Promise<WalletAccount | null>
  disconnect: () => Promise<void>
  signMessage: (message: Uint8Array) => Promise<Uint8Array | null>
  signTransaction: (serializedTx: Uint8Array) => Promise<Uint8Array | null>

  // Privy-specific login methods
  sendEmailCode: (email: string) => Promise<void>
  loginWithEmailCode: (code: string) => Promise<void>
  sendSMSCode: (phone: string) => Promise<void>
  loginWithSMSCode: (code: string) => Promise<void>
  loginWithApple: () => Promise<void>
  loginWithGoogle: () => Promise<void>
}

export function useWallet(): UseWalletReturn {
  // Active provider state
  const [activeProvider, setActiveProvider] = useState<WalletProviderType | null>(null)
  const [unifiedAccount, setUnifiedAccount] = useState<WalletAccount | null>(null)
  const [unifiedStatus, setUnifiedStatus] = useState<WalletConnectionStatus>("disconnected")
  const [unifiedError, setUnifiedError] = useState<WalletError | null>(null)

  // Initialize provider hooks
  const privy = usePrivy()
  const embeddedWallet = useEmbeddedSolanaWallet()
  const mwa = useMWA()
  const phantom = usePhantomDeeplink()

  // Privy login hooks
  const emailLogin = useLoginWithEmail()
  const smsLogin = useLoginWithSMS()
  const oauthLogin = useLoginWithOAuth()

  // Provider availability
  const isPrivyAvailable = privy.isReady
  const isMWAAvailable = mwa.isAvailable
  const isPhantomAvailable = phantom.isAvailable

  // Get first embedded wallet address
  const getPrivyWalletAddress = useCallback((): string | null => {
    if (embeddedWallet.status === "connected" && embeddedWallet.wallets.length > 0) {
      return embeddedWallet.wallets[0].address
    }
    return null
  }, [embeddedWallet.status, embeddedWallet.wallets])

  // Get user display name
  const getPrivyUserLabel = useCallback((): string => {
    if (!privy.user) return "Privy Wallet"

    // Check linked accounts for email/phone
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const linkedAccounts = (privy.user as any).linked_accounts || []
    const emailAccount = linkedAccounts.find(
      (a: { type: string }) => a.type === "email"
    )
    const phoneAccount = linkedAccounts.find(
      (a: { type: string }) => a.type === "phone"
    )

    if (emailAccount && "address" in emailAccount) {
      return emailAccount.address as string
    }
    if (phoneAccount && "phoneNumber" in phoneAccount) {
      return phoneAccount.phoneNumber as string
    }

    return "Privy Wallet"
  }, [privy.user])

  // Sync Privy state
  useEffect(() => {
    if (activeProvider === "privy" && privy.isReady) {
      const walletAddress = getPrivyWalletAddress()
      if (privy.user && walletAddress) {
        const account: WalletAccount = {
          address: walletAddress,
          publicKey: new Uint8Array(), // Privy doesn't expose raw public key
          label: getPrivyUserLabel(),
          providerType: "privy",
        }
        setUnifiedAccount(account)
        setUnifiedStatus("connected")
      } else if (!privy.user) {
        setUnifiedAccount(null)
        setUnifiedStatus("disconnected")
      }
    }
  }, [activeProvider, privy.isReady, privy.user, getPrivyWalletAddress, getPrivyUserLabel])

  // Sync MWA state
  useEffect(() => {
    if (activeProvider === "mwa") {
      setUnifiedAccount(mwa.account)
      setUnifiedStatus(mwa.status)
      setUnifiedError(mwa.error)
    }
  }, [activeProvider, mwa.account, mwa.status, mwa.error])

  // Sync Phantom state
  useEffect(() => {
    if (activeProvider === "phantom") {
      setUnifiedAccount(phantom.account)
      setUnifiedStatus(phantom.status)
      setUnifiedError(phantom.error)
    }
  }, [activeProvider, phantom.account, phantom.status, phantom.error])

  /**
   * Connect to a specific wallet provider
   */
  const connect = useCallback(
    async (provider: WalletProviderType): Promise<WalletAccount | null> => {
      setActiveProvider(provider)
      setUnifiedStatus("connecting")
      setUnifiedError(null)

      try {
        switch (provider) {
          case "privy": {
            // Privy login is handled separately via sendEmailCode/loginWithEmailCode etc.
            // This just marks privy as active provider
            const walletAddress = getPrivyWalletAddress()
            if (privy.user && walletAddress) {
              const account: WalletAccount = {
                address: walletAddress,
                publicKey: new Uint8Array(),
                label: getPrivyUserLabel(),
                providerType: "privy",
              }
              setUnifiedAccount(account)
              setUnifiedStatus("connected")
              return account
            }
            // User needs to login first
            setUnifiedStatus("disconnected")
            return null
          }

          case "mwa": {
            if (!isMWAAvailable) {
              throw new Error("MWA not available (Android only)")
            }
            const account = await mwa.connect()
            if (account) {
              setUnifiedAccount(account)
              setUnifiedStatus("connected")
            }
            return account
          }

          case "phantom": {
            if (!isPhantomAvailable) {
              throw new Error("Phantom wallet not installed")
            }
            const account = await phantom.connect()
            if (account) {
              setUnifiedAccount(account)
              setUnifiedStatus("connected")
            }
            return account
          }

          default:
            throw new Error(`Unknown provider: ${provider}`)
        }
      } catch (err) {
        const error: WalletError = {
          type: "connection_failed",
          message: err instanceof Error ? err.message : "Connection failed",
          originalError: err,
        }
        setUnifiedError(error)
        setUnifiedStatus("error")
        return null
      }
    },
    [
      privy.user,
      getPrivyWalletAddress,
      getPrivyUserLabel,
      mwa,
      phantom,
      isMWAAvailable,
      isPhantomAvailable,
    ]
  )

  /**
   * Disconnect from current wallet
   */
  const disconnect = useCallback(async (): Promise<void> => {
    try {
      switch (activeProvider) {
        case "privy":
          await privy.logout()
          break
        case "mwa":
          await mwa.disconnect()
          break
        case "phantom":
          await phantom.disconnect()
          break
      }
    } catch (err) {
      console.warn("Disconnect error:", err)
    } finally {
      setActiveProvider(null)
      setUnifiedAccount(null)
      setUnifiedStatus("disconnected")
      setUnifiedError(null)
    }
  }, [activeProvider, privy, mwa, phantom])

  /**
   * Sign a message with current wallet
   */
  const signMessage = useCallback(
    async (message: Uint8Array): Promise<Uint8Array | null> => {
      if (!activeProvider || !unifiedAccount) {
        setUnifiedError({
          type: "signing_failed",
          message: "No wallet connected",
        })
        return null
      }

      try {
        switch (activeProvider) {
          case "privy": {
            // Privy embedded wallet signing requires getProvider()
            // TODO: Implement proper Privy signing with PrivyEmbeddedSolanaWalletProvider
            if (embeddedWallet.status !== "connected" || embeddedWallet.wallets.length === 0) {
              throw new Error("Embedded wallet not available")
            }
            // For now, throw not implemented
            throw new Error("Privy message signing not yet implemented - use MWA or Phantom")
          }

          case "mwa":
            return await mwa.signMessage(message)

          case "phantom":
            return await phantom.signMessage(message)

          default:
            throw new Error("Unknown provider")
        }
      } catch (err) {
        const error: WalletError = {
          type: "signing_failed",
          message: err instanceof Error ? err.message : "Signing failed",
          originalError: err,
        }
        setUnifiedError(error)
        return null
      }
    },
    [activeProvider, unifiedAccount, embeddedWallet, mwa, phantom]
  )

  /**
   * Sign a transaction with current wallet
   */
  const signTransaction = useCallback(
    async (serializedTx: Uint8Array): Promise<Uint8Array | null> => {
      if (!activeProvider || !unifiedAccount) {
        setUnifiedError({
          type: "signing_failed",
          message: "No wallet connected",
        })
        return null
      }

      try {
        switch (activeProvider) {
          case "privy": {
            // Privy uses different transaction signing API
            if (embeddedWallet.status !== "connected" || embeddedWallet.wallets.length === 0) {
              throw new Error("Embedded wallet not available")
            }
            // Note: Privy transaction signing requires specific format
            // This is a simplified implementation
            throw new Error("Privy transaction signing not yet implemented")
          }

          case "mwa": {
            // MWA expects Transaction object, need to deserialize
            const { Transaction, VersionedTransaction } = await import("@solana/web3.js")
            let tx: InstanceType<typeof Transaction> | InstanceType<typeof VersionedTransaction>
            try {
              tx = VersionedTransaction.deserialize(serializedTx)
            } catch {
              tx = Transaction.from(serializedTx)
            }
            const result = await mwa.signTransaction(tx)
            return result?.signedTransaction || null
          }

          case "phantom":
            return await phantom.signTransaction(serializedTx)

          default:
            throw new Error("Unknown provider")
        }
      } catch (err) {
        const error: WalletError = {
          type: "signing_failed",
          message: err instanceof Error ? err.message : "Signing failed",
          originalError: err,
        }
        setUnifiedError(error)
        return null
      }
    },
    [activeProvider, unifiedAccount, embeddedWallet, mwa, phantom]
  )

  // Privy login methods using dedicated hooks
  const sendEmailCode = useCallback(
    async (email: string): Promise<void> => {
      setActiveProvider("privy")
      setUnifiedStatus("connecting")
      try {
        await emailLogin.sendCode({ email })
      } catch (err) {
        setUnifiedError({
          type: "connection_failed",
          message: err instanceof Error ? err.message : "Failed to send email code",
          originalError: err,
        })
        setUnifiedStatus("error")
      }
    },
    [emailLogin]
  )

  const loginWithEmailCode = useCallback(
    async (code: string): Promise<void> => {
      try {
        await emailLogin.loginWithCode({ code })
        // State will be synced via useEffect when privy.user changes
      } catch (err) {
        setUnifiedError({
          type: "connection_failed",
          message: err instanceof Error ? err.message : "Invalid email code",
          originalError: err,
        })
        setUnifiedStatus("error")
      }
    },
    [emailLogin]
  )

  const sendSMSCode = useCallback(
    async (phone: string): Promise<void> => {
      setActiveProvider("privy")
      setUnifiedStatus("connecting")
      try {
        await smsLogin.sendCode({ phone })
      } catch (err) {
        setUnifiedError({
          type: "connection_failed",
          message: err instanceof Error ? err.message : "Failed to send SMS code",
          originalError: err,
        })
        setUnifiedStatus("error")
      }
    },
    [smsLogin]
  )

  const loginWithSMSCode = useCallback(
    async (code: string): Promise<void> => {
      try {
        await smsLogin.loginWithCode({ code })
        // State will be synced via useEffect when privy.user changes
      } catch (err) {
        setUnifiedError({
          type: "connection_failed",
          message: err instanceof Error ? err.message : "Invalid SMS code",
          originalError: err,
        })
        setUnifiedStatus("error")
      }
    },
    [smsLogin]
  )

  const loginWithApple = useCallback(async (): Promise<void> => {
    setActiveProvider("privy")
    setUnifiedStatus("connecting")
    try {
      await oauthLogin.login({ provider: "apple" })
      // State will be synced via useEffect when privy.user changes
    } catch (err) {
      setUnifiedError({
        type: "connection_failed",
        message: err instanceof Error ? err.message : "Apple login failed",
        originalError: err,
      })
      setUnifiedStatus("error")
    }
  }, [oauthLogin])

  const loginWithGoogle = useCallback(async (): Promise<void> => {
    setActiveProvider("privy")
    setUnifiedStatus("connecting")
    try {
      await oauthLogin.login({ provider: "google" })
      // State will be synced via useEffect when privy.user changes
    } catch (err) {
      setUnifiedError({
        type: "connection_failed",
        message: err instanceof Error ? err.message : "Google login failed",
        originalError: err,
      })
      setUnifiedStatus("error")
    }
  }, [oauthLogin])

  return {
    // State
    account: unifiedAccount,
    status: unifiedStatus,
    error: unifiedError,
    providerType: activeProvider,

    // Availability
    isPrivyAvailable,
    isMWAAvailable,
    isPhantomAvailable,

    // Actions
    connect,
    disconnect,
    signMessage,
    signTransaction,

    // Privy-specific
    sendEmailCode,
    loginWithEmailCode,
    sendSMSCode,
    loginWithSMSCode,
    loginWithApple,
    loginWithGoogle,
  }
}

/**
 * Get recommended wallet provider based on platform
 */
export function getRecommendedProvider(): WalletProviderType {
  if (Platform.OS === "android") {
    return "mwa" // MWA is native on Android
  }
  return "phantom" // Deeplinks for iOS
}

/**
 * Get all available providers for current platform
 */
export function getAvailableProviders(): WalletProviderType[] {
  const providers: WalletProviderType[] = ["privy"] // Always available

  if (Platform.OS === "android") {
    providers.push("mwa")
  }

  // Phantom deeplinks work on both platforms
  providers.push("phantom")

  return providers
}
