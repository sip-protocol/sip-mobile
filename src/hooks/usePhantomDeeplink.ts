/**
 * Phantom Deeplink hook for iOS
 *
 * Connects to Phantom wallet on iOS using deeplinks.
 * Also works on Android as a fallback.
 */

import { useState, useCallback, useEffect, useRef } from "react"
import { Linking } from "react-native"
import * as WebBrowser from "expo-web-browser"
import * as Crypto from "expo-crypto"
import { PublicKey } from "@solana/web3.js"
import bs58 from "bs58"
import type {
  WalletAccount,
  WalletConnectionStatus,
  WalletError,
} from "@/types"

// Phantom deeplink URLs
const PHANTOM_CONNECT_URL = "https://phantom.app/ul/v1/connect"
const PHANTOM_DISCONNECT_URL = "https://phantom.app/ul/v1/disconnect"
const PHANTOM_SIGN_MESSAGE_URL = "https://phantom.app/ul/v1/signMessage"
const PHANTOM_SIGN_TX_URL = "https://phantom.app/ul/v1/signTransaction"
const PHANTOM_SIGN_SEND_TX_URL = "https://phantom.app/ul/v1/signAndSendTransaction"

// App redirect URL (must match app.json scheme)
const APP_SCHEME = "sipprotocol"
const REDIRECT_URL = `${APP_SCHEME}://phantom-callback`

interface UsePhantomDeeplinkReturn {
  // State
  account: WalletAccount | null
  status: WalletConnectionStatus
  error: WalletError | null
  isAvailable: boolean

  // Actions
  connect: () => Promise<WalletAccount | null>
  disconnect: () => Promise<void>
  signMessage: (message: Uint8Array) => Promise<Uint8Array | null>
  signTransaction: (serializedTx: Uint8Array) => Promise<Uint8Array | null>
  signAndSendTransaction: (serializedTx: Uint8Array) => Promise<string | null>
}

/**
 * Generate a random nonce for Phantom session
 */
async function generateNonce(): Promise<string> {
  const randomBytes = await Crypto.getRandomBytesAsync(32)
  return bs58.encode(randomBytes)
}

/**
 * Build Phantom deeplink URL
 */
function buildPhantomUrl(
  baseUrl: string,
  params: Record<string, string>
): string {
  const url = new URL(baseUrl)
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value)
  })
  return url.toString()
}

/**
 * Parse Phantom callback URL
 */
function parseCallbackUrl(url: string): Record<string, string> {
  const parsed = new URL(url)
  const params: Record<string, string> = {}
  parsed.searchParams.forEach((value, key) => {
    params[key] = value
  })
  return params
}

export function usePhantomDeeplink(): UsePhantomDeeplinkReturn {
  const [account, setAccount] = useState<WalletAccount | null>(null)
  const [status, setStatus] = useState<WalletConnectionStatus>("disconnected")
  const [error, setError] = useState<WalletError | null>(null)
  const [isAvailable, setIsAvailable] = useState(false)

  // Session state
  const [session, setSession] = useState<string | null>(null)
  // Note: In production, implement proper encryption with nacl.box
  // const [dappKeyPair, setDappKeyPair] = useState<{publicKey: Uint8Array, secretKey: Uint8Array} | null>(null)
  // const [sharedSecret, setSharedSecret] = useState<Uint8Array | null>(null)

  // Pending promise resolver for deeplink callbacks
  const pendingResolve = useRef<((params: Record<string, string>) => void) | null>(null)
  const pendingReject = useRef<((error: Error) => void) | null>(null)

  // Check if Phantom is installed
  useEffect(() => {
    const checkPhantom = async () => {
      try {
        const canOpen = await Linking.canOpenURL("phantom://")
        setIsAvailable(canOpen)
      } catch {
        setIsAvailable(false)
      }
    }
    checkPhantom()
  }, [])

  // Handle deeplink callbacks
  useEffect(() => {
    const handleUrl = ({ url }: { url: string }) => {
      if (!url.startsWith(REDIRECT_URL)) return

      try {
        const params = parseCallbackUrl(url)

        // Check for errors
        if (params.errorCode) {
          const error = new Error(params.errorMessage || "Phantom error")
          pendingReject.current?.(error)
          return
        }

        pendingResolve.current?.(params)
      } catch (err) {
        pendingReject.current?.(err instanceof Error ? err : new Error("Parse error"))
      }
    }

    const subscription = Linking.addEventListener("url", handleUrl)

    // Check for initial URL (app opened via deeplink)
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl({ url })
    })

    return () => subscription.remove()
  }, [])

  /**
   * Wait for Phantom callback via deeplink
   */
  const waitForCallback = (): Promise<Record<string, string>> => {
    return new Promise((resolve, reject) => {
      pendingResolve.current = resolve
      pendingReject.current = reject

      // Timeout after 2 minutes
      setTimeout(() => {
        pendingResolve.current = null
        pendingReject.current = null
        reject(new Error("Phantom connection timeout"))
      }, 120000)
    })
  }

  const connect = useCallback(async (): Promise<WalletAccount | null> => {
    if (!isAvailable) {
      setError({
        type: "not_installed",
        message: "Phantom wallet is not installed",
      })
      return null
    }

    setStatus("connecting")
    setError(null)

    try {
      // Generate dApp keypair for encryption
      // Note: In production, use nacl.box.keyPair() from tweetnacl
      // For now, using a simplified approach
      const nonce = await generateNonce()

      // Build connect URL
      const connectUrl = buildPhantomUrl(PHANTOM_CONNECT_URL, {
        app_url: "https://sip-protocol.org",
        dapp_encryption_public_key: nonce, // Simplified - should be real key
        redirect_link: REDIRECT_URL,
        cluster: "devnet",
      })

      // Open Phantom
      await WebBrowser.openBrowserAsync(connectUrl, {
        dismissButtonStyle: "close",
        readerMode: false,
        enableBarCollapsing: false,
      })

      // Wait for callback
      const params = await waitForCallback()

      if (params.phantom_encryption_public_key && params.data) {
        // In production, decrypt the data using shared secret
        // For now, parse the public key directly
        const publicKeyBase58 = params.public_key || params.data
        const publicKey = new PublicKey(publicKeyBase58)

        const walletAccount: WalletAccount = {
          address: publicKey.toBase58(),
          publicKey: publicKey.toBytes(),
          label: "Phantom",
          providerType: "phantom",
        }

        setAccount(walletAccount)
        setSession(params.session || nonce)
        setStatus("connected")
        return walletAccount
      }

      throw new Error("Invalid response from Phantom")
    } catch (err) {
      const walletError: WalletError = {
        type: "connection_failed",
        message: err instanceof Error ? err.message : "Failed to connect",
        originalError: err,
      }

      if (err instanceof Error) {
        if (err.message.includes("rejected") || err.message.includes("cancelled")) {
          walletError.type = "user_rejected"
          walletError.message = "Connection rejected by user"
        } else if (err.message.includes("timeout")) {
          walletError.type = "timeout"
          walletError.message = "Connection timed out"
        }
      }

      setError(walletError)
      setStatus("error")
      return null
    }
  }, [isAvailable])

  const disconnect = useCallback(async (): Promise<void> => {
    if (!isAvailable || !session) {
      setAccount(null)
      setSession(null)
      setStatus("disconnected")
      return
    }

    try {
      const disconnectUrl = buildPhantomUrl(PHANTOM_DISCONNECT_URL, {
        redirect_link: REDIRECT_URL,
        dapp_encryption_public_key: session,
        session: session,
      })

      await WebBrowser.openBrowserAsync(disconnectUrl)
    } catch (err) {
      console.warn("Phantom disconnect failed:", err)
    } finally {
      setAccount(null)
      setSession(null)
      setStatus("disconnected")
      setError(null)
    }
  }, [isAvailable, session])

  const signMessage = useCallback(
    async (message: Uint8Array): Promise<Uint8Array | null> => {
      if (!isAvailable || !session || !account) {
        setError({
          type: "signing_failed",
          message: "Wallet not connected",
        })
        return null
      }

      try {
        const signUrl = buildPhantomUrl(PHANTOM_SIGN_MESSAGE_URL, {
          redirect_link: REDIRECT_URL,
          dapp_encryption_public_key: session,
          session: session,
          message: bs58.encode(message),
          display: "utf8",
        })

        await WebBrowser.openBrowserAsync(signUrl)

        const params = await waitForCallback()

        if (params.signature) {
          return bs58.decode(params.signature)
        }

        throw new Error("No signature returned")
      } catch (err) {
        const walletError: WalletError = {
          type: "signing_failed",
          message: err instanceof Error ? err.message : "Failed to sign",
          originalError: err,
        }

        if (err instanceof Error && err.message.includes("rejected")) {
          walletError.type = "user_rejected"
        }

        setError(walletError)
        return null
      }
    },
    [isAvailable, session, account]
  )

  const signTransaction = useCallback(
    async (serializedTx: Uint8Array): Promise<Uint8Array | null> => {
      if (!isAvailable || !session || !account) {
        setError({
          type: "signing_failed",
          message: "Wallet not connected",
        })
        return null
      }

      try {
        const signUrl = buildPhantomUrl(PHANTOM_SIGN_TX_URL, {
          redirect_link: REDIRECT_URL,
          dapp_encryption_public_key: session,
          session: session,
          transaction: bs58.encode(serializedTx),
        })

        await WebBrowser.openBrowserAsync(signUrl)

        const params = await waitForCallback()

        if (params.transaction) {
          return bs58.decode(params.transaction)
        }

        throw new Error("No signed transaction returned")
      } catch (err) {
        const walletError: WalletError = {
          type: "signing_failed",
          message: err instanceof Error ? err.message : "Failed to sign",
          originalError: err,
        }

        if (err instanceof Error && err.message.includes("rejected")) {
          walletError.type = "user_rejected"
        }

        setError(walletError)
        return null
      }
    },
    [isAvailable, session, account]
  )

  const signAndSendTransaction = useCallback(
    async (serializedTx: Uint8Array): Promise<string | null> => {
      if (!isAvailable || !session || !account) {
        setError({
          type: "signing_failed",
          message: "Wallet not connected",
        })
        return null
      }

      try {
        const signUrl = buildPhantomUrl(PHANTOM_SIGN_SEND_TX_URL, {
          redirect_link: REDIRECT_URL,
          dapp_encryption_public_key: session,
          session: session,
          transaction: bs58.encode(serializedTx),
        })

        await WebBrowser.openBrowserAsync(signUrl)

        const params = await waitForCallback()

        if (params.signature) {
          return params.signature
        }

        throw new Error("No signature returned")
      } catch (err) {
        const walletError: WalletError = {
          type: "signing_failed",
          message: err instanceof Error ? err.message : "Failed to send",
          originalError: err,
        }

        if (err instanceof Error && err.message.includes("rejected")) {
          walletError.type = "user_rejected"
        }

        setError(walletError)
        return null
      }
    },
    [isAvailable, session, account]
  )

  return {
    account,
    status,
    error,
    isAvailable,
    connect,
    disconnect,
    signMessage,
    signTransaction,
    signAndSendTransaction,
  }
}
