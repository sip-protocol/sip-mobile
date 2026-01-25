/**
 * Native Wallet Hook — PRIMARY
 *
 * Manages local wallet keys using SecureStore with biometric protection.
 * This is the primary wallet solution for SIP Privacy.
 *
 * Features:
 * - Generate new wallet (BIP39 mnemonic)
 * - Import from seed phrase (12/24 words)
 * - Import from private key
 * - Sign transactions locally
 * - Biometric protection for sensitive operations
 *
 * @see https://github.com/sip-protocol/sip-mobile/issues/67
 * @see https://github.com/sip-protocol/sip-mobile/issues/61 — Architecture pivot
 */

import { useState, useCallback, useEffect } from "react"
import { PublicKey, Transaction, VersionedTransaction, Keypair } from "@solana/web3.js"
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from "@scure/bip39"
import { HDKey } from "@scure/bip32"
import { wordlist } from "@scure/bip39/wordlists/english.js"
import bs58 from "bs58"
import nacl from "tweetnacl"
import {
  hasWallet,
  storePrivateKey,
  getPrivateKey,
  storeMnemonic,
  getMnemonic,
  storePublicKey,
  getPublicKey,
  setWalletExists,
  deleteWallet as deleteWalletStorage,
  authenticateUser,
  isBiometricAvailable,
  clearSensitiveData,
  type KeyStorageError,
} from "@/utils/keyStorage"

// Solana derivation path (BIP44)
const SOLANA_DERIVATION_PATH = "m/44'/501'/0'/0'"

export interface NativeWallet {
  publicKey: PublicKey
  // Private key is NEVER exposed - only stored in SecureStore
}

export interface NativeWalletError {
  code:
    | "INVALID_MNEMONIC"
    | "INVALID_PRIVATE_KEY"
    | "WALLET_EXISTS"
    | "NO_WALLET"
    | "AUTH_FAILED"
    | "STORAGE_ERROR"
    | "SIGNING_FAILED"
  message: string
}

export interface UseNativeWalletReturn {
  // State
  wallet: NativeWallet | null
  isLoading: boolean
  isInitialized: boolean
  error: NativeWalletError | null
  hasBiometrics: boolean

  // Wallet Management
  createWallet: (wordCount?: 12 | 24) => Promise<{ wallet: NativeWallet; mnemonic: string }>
  importFromSeed: (mnemonic: string) => Promise<NativeWallet>
  importFromPrivateKey: (privateKey: string) => Promise<NativeWallet>
  exportMnemonic: () => Promise<string | null>
  deleteWallet: () => Promise<void>

  // Signing (requires biometric)
  signTransaction: (tx: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>
  signMessage: (message: Uint8Array) => Promise<Uint8Array>
  signAllTransactions: <T extends Transaction | VersionedTransaction>(txs: T[]) => Promise<T[]>

  // Utils
  clearError: () => void
}

/**
 * Derive Solana keypair from mnemonic using BIP44 path
 */
function deriveKeypairFromMnemonic(mnemonic: string): Keypair {
  const seed = mnemonicToSeedSync(mnemonic)
  const hdKey = HDKey.fromMasterSeed(seed)
  const derived = hdKey.derive(SOLANA_DERIVATION_PATH)

  if (!derived.privateKey) {
    throw new Error("Failed to derive private key")
  }

  // Solana uses ed25519, need to convert
  // HDKey gives us 32 bytes, but Solana Keypair needs 64 (secret key format)
  const keypair = Keypair.fromSeed(derived.privateKey)

  // Clear sensitive data
  clearSensitiveData(seed)
  if (derived.privateKey) {
    clearSensitiveData(derived.privateKey)
  }

  return keypair
}

/**
 * Native Wallet Hook
 */
export function useNativeWallet(): UseNativeWalletReturn {
  const [wallet, setWallet] = useState<NativeWallet | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isInitialized, setIsInitialized] = useState(false)
  const [error, setError] = useState<NativeWalletError | null>(null)
  const [hasBiometrics, setHasBiometrics] = useState(false)

  // Initialize - check if wallet exists
  useEffect(() => {
    async function init() {
      try {
        setIsLoading(true)

        // Check biometric availability
        const biometricAvailable = await isBiometricAvailable()
        setHasBiometrics(biometricAvailable)

        // Check if wallet exists
        const walletExists = await hasWallet()

        if (walletExists) {
          // Load public key (doesn't require biometric)
          const publicKeyBase58 = await getPublicKey()
          if (publicKeyBase58) {
            setWallet({
              publicKey: new PublicKey(publicKeyBase58),
            })
          }
        }

        setIsInitialized(true)
      } catch (err) {
        console.error("Failed to initialize native wallet:", err)
        setError({
          code: "STORAGE_ERROR",
          message: "Failed to initialize wallet",
        })
      } finally {
        setIsLoading(false)
      }
    }

    init()
  }, [])

  /**
   * Create new wallet with mnemonic
   */
  const createWallet = useCallback(
    async (wordCount: 12 | 24 = 12): Promise<{ wallet: NativeWallet; mnemonic: string }> => {
      try {
        setIsLoading(true)
        setError(null)

        // Check if wallet already exists
        const exists = await hasWallet()
        if (exists) {
          throw {
            code: "WALLET_EXISTS",
            message: "Wallet already exists. Delete it first to create a new one.",
          } as NativeWalletError
        }

        // Generate mnemonic
        const strength = wordCount === 24 ? 256 : 128
        const mnemonic = generateMnemonic(wordlist, strength)

        // Derive keypair
        const keypair = deriveKeypairFromMnemonic(mnemonic)
        const publicKeyBase58 = keypair.publicKey.toBase58()
        const privateKeyBase58 = bs58.encode(keypair.secretKey)

        // Store securely
        await storePrivateKey(privateKeyBase58)
        await storeMnemonic(mnemonic)
        await storePublicKey(publicKeyBase58)
        await setWalletExists(true)

        const newWallet: NativeWallet = {
          publicKey: keypair.publicKey,
        }

        setWallet(newWallet)

        // Clear keypair from memory
        clearSensitiveData(keypair.secretKey)

        return { wallet: newWallet, mnemonic }
      } catch (err) {
        const walletError = err as NativeWalletError
        setError(walletError)
        throw walletError
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  /**
   * Import wallet from seed phrase
   */
  const importFromSeed = useCallback(
    async (mnemonic: string): Promise<NativeWallet> => {
      try {
        setIsLoading(true)
        setError(null)

        // Normalize and validate mnemonic
        const normalizedMnemonic = mnemonic.trim().toLowerCase()

        if (!validateMnemonic(normalizedMnemonic, wordlist)) {
          throw {
            code: "INVALID_MNEMONIC",
            message: "Invalid seed phrase. Please check and try again.",
          } as NativeWalletError
        }

        // Check if wallet already exists
        const exists = await hasWallet()
        if (exists) {
          throw {
            code: "WALLET_EXISTS",
            message: "Wallet already exists. Delete it first to import.",
          } as NativeWalletError
        }

        // Derive keypair
        const keypair = deriveKeypairFromMnemonic(normalizedMnemonic)
        const publicKeyBase58 = keypair.publicKey.toBase58()
        const privateKeyBase58 = bs58.encode(keypair.secretKey)

        // Store securely
        await storePrivateKey(privateKeyBase58)
        await storeMnemonic(normalizedMnemonic)
        await storePublicKey(publicKeyBase58)
        await setWalletExists(true)

        const newWallet: NativeWallet = {
          publicKey: keypair.publicKey,
        }

        setWallet(newWallet)

        // Clear keypair from memory
        clearSensitiveData(keypair.secretKey)

        return newWallet
      } catch (err) {
        const walletError = err as NativeWalletError
        setError(walletError)
        throw walletError
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  /**
   * Import wallet from private key
   */
  const importFromPrivateKey = useCallback(
    async (privateKey: string): Promise<NativeWallet> => {
      try {
        setIsLoading(true)
        setError(null)

        // Check if wallet already exists
        const exists = await hasWallet()
        if (exists) {
          throw {
            code: "WALLET_EXISTS",
            message: "Wallet already exists. Delete it first to import.",
          } as NativeWalletError
        }

        // Parse private key (supports both base58 and array format)
        let secretKey: Uint8Array
        try {
          // Try base58 first
          secretKey = bs58.decode(privateKey.trim())
        } catch {
          // Try JSON array format
          try {
            const parsed = JSON.parse(privateKey)
            if (Array.isArray(parsed)) {
              secretKey = new Uint8Array(parsed)
            } else {
              throw new Error("Invalid format")
            }
          } catch {
            throw {
              code: "INVALID_PRIVATE_KEY",
              message: "Invalid private key format. Use base58 or JSON array.",
            } as NativeWalletError
          }
        }

        // Validate key length (should be 64 bytes for Solana)
        if (secretKey.length !== 64) {
          throw {
            code: "INVALID_PRIVATE_KEY",
            message: "Invalid private key length. Expected 64 bytes.",
          } as NativeWalletError
        }

        // Create keypair
        const keypair = Keypair.fromSecretKey(secretKey)
        const publicKeyBase58 = keypair.publicKey.toBase58()
        const privateKeyBase58 = bs58.encode(keypair.secretKey)

        // Store securely (no mnemonic for direct key import)
        await storePrivateKey(privateKeyBase58)
        await storePublicKey(publicKeyBase58)
        await setWalletExists(true)

        const newWallet: NativeWallet = {
          publicKey: keypair.publicKey,
        }

        setWallet(newWallet)

        // Clear sensitive data
        clearSensitiveData(secretKey)
        clearSensitiveData(keypair.secretKey)

        return newWallet
      } catch (err) {
        const walletError = err as NativeWalletError
        setError(walletError)
        throw walletError
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  /**
   * Export mnemonic (requires biometric)
   */
  const exportMnemonic = useCallback(async (): Promise<string | null> => {
    try {
      setError(null)

      if (!wallet) {
        throw {
          code: "NO_WALLET",
          message: "No wallet found",
        } as NativeWalletError
      }

      // Biometric auth happens in getMnemonic via SecureStore
      const mnemonic = await getMnemonic()
      return mnemonic
    } catch (err) {
      if ((err as KeyStorageError).code === "AUTH_FAILED") {
        setError({
          code: "AUTH_FAILED",
          message: "Authentication failed",
        })
      }
      return null
    }
  }, [wallet])

  /**
   * Delete wallet and all stored data
   */
  const deleteWalletFn = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true)
      setError(null)

      // Require biometric to delete
      const authenticated = await authenticateUser("Authenticate to delete wallet")
      if (!authenticated) {
        throw {
          code: "AUTH_FAILED",
          message: "Authentication required to delete wallet",
        } as NativeWalletError
      }

      await deleteWalletStorage()
      setWallet(null)
    } catch (err) {
      const walletError = err as NativeWalletError
      setError(walletError)
      throw walletError
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Sign a transaction (requires biometric)
   */
  const signTransaction = useCallback(
    async <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => {
      try {
        setError(null)

        if (!wallet) {
          throw {
            code: "NO_WALLET",
            message: "No wallet found",
          } as NativeWalletError
        }

        // Get private key (biometric auth happens here)
        const privateKeyBase58 = await getPrivateKey()
        if (!privateKeyBase58) {
          throw {
            code: "AUTH_FAILED",
            message: "Failed to access private key",
          } as NativeWalletError
        }

        const secretKey = bs58.decode(privateKeyBase58)
        const keypair = Keypair.fromSecretKey(secretKey)

        // Sign based on transaction type
        if (tx instanceof Transaction) {
          tx.sign(keypair)
        } else {
          // VersionedTransaction
          tx.sign([keypair])
        }

        // Clear sensitive data
        clearSensitiveData(secretKey)

        return tx
      } catch (err) {
        const walletError: NativeWalletError = {
          code: "SIGNING_FAILED",
          message: err instanceof Error ? err.message : "Failed to sign transaction",
        }
        setError(walletError)
        throw walletError
      }
    },
    [wallet]
  )

  /**
   * Sign a message (requires biometric)
   */
  const signMessage = useCallback(
    async (message: Uint8Array): Promise<Uint8Array> => {
      try {
        setError(null)

        if (!wallet) {
          throw {
            code: "NO_WALLET",
            message: "No wallet found",
          } as NativeWalletError
        }

        // Get private key (biometric auth happens here)
        const privateKeyBase58 = await getPrivateKey()
        if (!privateKeyBase58) {
          throw {
            code: "AUTH_FAILED",
            message: "Failed to access private key",
          } as NativeWalletError
        }

        const secretKey = bs58.decode(privateKeyBase58)

        // Sign message using nacl
        const signature = nacl.sign.detached(message, secretKey)

        // Clear sensitive data
        clearSensitiveData(secretKey)

        return signature
      } catch (err) {
        const walletError: NativeWalletError = {
          code: "SIGNING_FAILED",
          message: err instanceof Error ? err.message : "Failed to sign message",
        }
        setError(walletError)
        throw walletError
      }
    },
    [wallet]
  )

  /**
   * Sign multiple transactions (requires biometric once)
   */
  const signAllTransactions = useCallback(
    async <T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> => {
      try {
        setError(null)

        if (!wallet) {
          throw {
            code: "NO_WALLET",
            message: "No wallet found",
          } as NativeWalletError
        }

        // Get private key once (biometric auth happens here)
        const privateKeyBase58 = await getPrivateKey()
        if (!privateKeyBase58) {
          throw {
            code: "AUTH_FAILED",
            message: "Failed to access private key",
          } as NativeWalletError
        }

        const secretKey = bs58.decode(privateKeyBase58)
        const keypair = Keypair.fromSecretKey(secretKey)

        // Sign all transactions
        const signedTxs = txs.map((tx) => {
          if (tx instanceof Transaction) {
            tx.sign(keypair)
          } else {
            tx.sign([keypair])
          }
          return tx
        })

        // Clear sensitive data
        clearSensitiveData(secretKey)

        return signedTxs
      } catch (err) {
        const walletError: NativeWalletError = {
          code: "SIGNING_FAILED",
          message: err instanceof Error ? err.message : "Failed to sign transactions",
        }
        setError(walletError)
        throw walletError
      }
    },
    [wallet]
  )

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    // State
    wallet,
    isLoading,
    isInitialized,
    error,
    hasBiometrics,

    // Wallet Management
    createWallet,
    importFromSeed,
    importFromPrivateKey,
    exportMnemonic,
    deleteWallet: deleteWalletFn,

    // Signing
    signTransaction,
    signMessage,
    signAllTransactions,

    // Utils
    clearError,
  }
}
