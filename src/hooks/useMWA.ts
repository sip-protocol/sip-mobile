/**
 * Mobile Wallet Adapter (MWA) Hook — OPTIONAL INTEGRATION
 *
 * Provides optional connection to external Solana wallets (Phantom, Solflare,
 * Backpack) on Android using the Mobile Wallet Adapter protocol.
 *
 * ⚠️ This is now an OPTIONAL integration.
 * Primary wallet strategy is native key management.
 *
 * @see useNativeWallet — Primary wallet hook (TODO: #67)
 * @see https://github.com/sip-protocol/sip-mobile/issues/61 — Architecture pivot
 */

import { useState, useCallback, useEffect } from "react"
import { Platform } from "react-native"
import {
  transact,
  Web3MobileWallet,
} from "@solana-mobile/mobile-wallet-adapter-protocol-web3js"
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js"
import bs58 from "bs58"
import type {
  WalletAccount,
  WalletConnectionStatus,
  WalletError,
  SignedResult,
} from "@/types"
import { useSettingsStore } from "@/stores/settings"

const APP_IDENTITY = {
  name: "SIP Protocol",
  uri: "https://sip-protocol.org",
  icon: "favicon.ico",
}

interface UseMWAReturn {
  // State
  account: WalletAccount | null
  status: WalletConnectionStatus
  error: WalletError | null
  isAvailable: boolean

  // Actions
  connect: () => Promise<WalletAccount | null>
  disconnect: () => Promise<void>
  signTransaction: (
    transaction: Transaction | VersionedTransaction
  ) => Promise<SignedResult | null>
  signMessage: (message: Uint8Array) => Promise<Uint8Array | null>
  signAndSendTransaction: (
    transaction: Transaction | VersionedTransaction
  ) => Promise<string | null>
}

export function useMWA(): UseMWAReturn {
  const [account, setAccount] = useState<WalletAccount | null>(null)
  const [status, setStatus] = useState<WalletConnectionStatus>("disconnected")
  const [error, setError] = useState<WalletError | null>(null)

  // Get network from settings
  const network = useSettingsStore((state) => state.network)

  // MWA only available on Android
  const isAvailable = Platform.OS === "android"

  // Store auth token for session
  const [authToken, setAuthToken] = useState<string | null>(null)

  const connect = useCallback(async (): Promise<WalletAccount | null> => {
    if (!isAvailable) {
      setError({
        type: "not_installed",
        message: "Mobile Wallet Adapter is only available on Android",
      })
      return null
    }

    setStatus("connecting")
    setError(null)

    try {
      const result = await transact(async (wallet: Web3MobileWallet) => {
        // Authorize with wallet
        const authResult = await wallet.authorize({
          cluster: network,
          identity: APP_IDENTITY,
        })

        return {
          accounts: authResult.accounts,
          authToken: authResult.auth_token,
        }
      })

      if (result.accounts.length > 0) {
        const firstAccount = result.accounts[0]
        const publicKey = new PublicKey(firstAccount.address)

        const walletAccount: WalletAccount = {
          address: publicKey.toBase58(),
          publicKey: publicKey.toBytes(),
          label: firstAccount.label || "MWA Wallet",
          providerType: "mwa",
        }

        setAccount(walletAccount)
        setAuthToken(result.authToken)
        setStatus("connected")
        return walletAccount
      }

      throw new Error("No accounts returned from wallet")
    } catch (err) {
      const walletError: WalletError = {
        type: "connection_failed",
        message: err instanceof Error ? err.message : "Failed to connect",
        originalError: err,
      }

      // Check for user rejection
      if (err instanceof Error && err.message.includes("User rejected")) {
        walletError.type = "user_rejected"
        walletError.message = "Connection rejected by user"
      }

      setError(walletError)
      setStatus("error")
      return null
    }
  }, [isAvailable, network])

  const disconnect = useCallback(async (): Promise<void> => {
    if (!isAvailable || !authToken) {
      setAccount(null)
      setStatus("disconnected")
      return
    }

    try {
      await transact(async (wallet: Web3MobileWallet) => {
        await wallet.deauthorize({ auth_token: authToken })
      })
    } catch (err) {
      console.warn("MWA deauthorize failed:", err)
    } finally {
      setAccount(null)
      setAuthToken(null)
      setStatus("disconnected")
      setError(null)
    }
  }, [isAvailable, authToken])

  const signTransaction = useCallback(
    async (
      transaction: Transaction | VersionedTransaction
    ): Promise<SignedResult | null> => {
      if (!isAvailable || !authToken || !account) {
        setError({
          type: "signing_failed",
          message: "Wallet not connected",
        })
        return null
      }

      try {
        const result = await transact(async (wallet: Web3MobileWallet) => {
          // Reauthorize to ensure session is valid
          await wallet.reauthorize({
            auth_token: authToken,
            identity: APP_IDENTITY,
          })

          const signedTransactions = await wallet.signTransactions({
            transactions: [transaction],
          })

          return signedTransactions[0]
        })

        // Get first signature from the transaction
        const sig = result.signatures.find((s) => s !== null)
        const signature = sig
          ? typeof sig === "object" && "signature" in sig
            ? (sig.signature as Uint8Array)
            : (sig as Uint8Array)
          : new Uint8Array()

        return {
          signature,
          signedTransaction: result.serialize(),
        }
      } catch (err) {
        const walletError: WalletError = {
          type: "signing_failed",
          message: err instanceof Error ? err.message : "Failed to sign",
          originalError: err,
        }

        if (err instanceof Error && err.message.includes("rejected")) {
          walletError.type = "user_rejected"
          walletError.message = "Transaction rejected by user"
        }

        setError(walletError)
        return null
      }
    },
    [isAvailable, authToken, account]
  )

  const signMessage = useCallback(
    async (message: Uint8Array): Promise<Uint8Array | null> => {
      if (!isAvailable || !authToken || !account) {
        setError({
          type: "signing_failed",
          message: "Wallet not connected",
        })
        return null
      }

      try {
        const result = await transact(async (wallet: Web3MobileWallet) => {
          await wallet.reauthorize({
            auth_token: authToken,
            identity: APP_IDENTITY,
          })

          const signedMessages = await wallet.signMessages({
            addresses: [account.address],
            payloads: [message],
          })

          return signedMessages[0]
        })

        return result
      } catch (err) {
        const walletError: WalletError = {
          type: "signing_failed",
          message: err instanceof Error ? err.message : "Failed to sign message",
          originalError: err,
        }

        if (err instanceof Error && err.message.includes("rejected")) {
          walletError.type = "user_rejected"
          walletError.message = "Message signing rejected by user"
        }

        setError(walletError)
        return null
      }
    },
    [isAvailable, authToken, account]
  )

  const signAndSendTransaction = useCallback(
    async (
      transaction: Transaction | VersionedTransaction
    ): Promise<string | null> => {
      if (!isAvailable || !authToken || !account) {
        setError({
          type: "signing_failed",
          message: "Wallet not connected",
        })
        return null
      }

      try {
        const result = await transact(async (wallet: Web3MobileWallet) => {
          await wallet.reauthorize({
            auth_token: authToken,
            identity: APP_IDENTITY,
          })

          const signatures = await wallet.signAndSendTransactions({
            transactions: [transaction],
          })

          return signatures[0]
        })

        // The result is already a Uint8Array signature, encode to base58
        if (typeof result === "string") {
          return result
        }
        return bs58.encode(result)
      } catch (err) {
        const walletError: WalletError = {
          type: "signing_failed",
          message: err instanceof Error ? err.message : "Failed to send",
          originalError: err,
        }

        if (err instanceof Error && err.message.includes("rejected")) {
          walletError.type = "user_rejected"
          walletError.message = "Transaction rejected by user"
        }

        setError(walletError)
        return null
      }
    },
    [isAvailable, authToken, account]
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Don't auto-disconnect, let user control this
    }
  }, [])

  return {
    account,
    status,
    error,
    isAvailable,
    connect,
    disconnect,
    signTransaction,
    signMessage,
    signAndSendTransaction,
  }
}
