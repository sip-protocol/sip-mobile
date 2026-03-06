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
  storeWalletKeys,
  getPrivateKeyForAccount,
  getMnemonicForAccount,
  deleteWalletKeys,
  getWalletRegistry,
  addToRegistry,
  removeFromRegistry,
  migrateFromLegacy,
  authenticateUser,
  isBiometricAvailable,
  clearSensitiveData,
  type KeyStorageError,
  type WalletRegistryEntry,
} from "@/utils/keyStorage"
import { useWalletStore } from "@/stores/wallet"

// Solana derivation path (BIP44)
const SOLANA_DERIVATION_PATH = "m/44'/501'/0'/0'"

/**
 * Connect native wallet to the main wallet store
 */
function connectToWalletStore(publicKeyBase58: string): void {
  useWalletStore.getState().connect(
    "native",
    "solana",
    publicKeyBase58,
    "native"
  )
}

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
  createWallet: (wordCount?: 12 | 24) => Promise<{ wallet: NativeWallet; mnemonic: string; accountId: string }>
  importFromSeed: (mnemonic: string) => Promise<NativeWallet>
  importFromPrivateKey: (privateKey: string) => Promise<NativeWallet>
  exportMnemonic: () => Promise<string | null>
  deleteWallet: (accountId?: string) => Promise<void>

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

  // Initialize - check if wallet exists, migrate legacy if needed
  useEffect(() => {
    async function init() {
      try {
        setIsLoading(true)

        const biometricAvailable = await isBiometricAvailable()
        setHasBiometrics(biometricAvailable)

        const walletStore = useWalletStore.getState()
        const existingAccountId = walletStore.activeAccountId
        const legacyExists = await hasWallet()

        // Migrate legacy keys to indexed format if needed
        if (legacyExists && existingAccountId) {
          const migrated = await migrateFromLegacy(existingAccountId)
          if (migrated) {
            setWallet({ publicKey: new PublicKey(migrated.address) })
            setIsInitialized(true)
            return
          }
        }

        // Load from registry
        const registry = await getWalletRegistry()
        if (registry.length > 0 && existingAccountId) {
          const entry = registry.find((e) => e.id === existingAccountId)
          if (entry) {
            setWallet({ publicKey: new PublicKey(entry.address) })
          } else {
            setWallet({ publicKey: new PublicKey(registry[0].address) })
            connectToWalletStore(registry[0].address)
          }
        } else if (registry.length > 0) {
          const first = registry[0]
          setWallet({ publicKey: new PublicKey(first.address) })
          connectToWalletStore(first.address)
        }

        setIsInitialized(true)
      } catch (err) {
        console.error("Failed to initialize native wallet:", err)
        setError({ code: "STORAGE_ERROR", message: "Failed to initialize wallet" })
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
    async (wordCount: 12 | 24 = 12): Promise<{ wallet: NativeWallet; mnemonic: string; accountId: string }> => {
      try {
        setIsLoading(true)
        setError(null)

        const strength = wordCount === 24 ? 256 : 128
        const mnemonic = generateMnemonic(wordlist, strength)
        const keypair = deriveKeypairFromMnemonic(mnemonic)
        const publicKeyBase58 = keypair.publicKey.toBase58()
        const privateKeyBase58 = bs58.encode(keypair.secretKey)

        // Connect to store first to get the account ID
        connectToWalletStore(publicKeyBase58)
        const accountId = useWalletStore.getState().activeAccountId!

        // Store keys indexed by account ID
        await storeWalletKeys(accountId, privateKeyBase58, publicKeyBase58, mnemonic)

        // Add to registry
        await addToRegistry({
          id: accountId,
          address: publicKeyBase58,
          providerType: "native",
          createdAt: new Date().toISOString(),
          hasMnemonic: true,
        })

        const newWallet: NativeWallet = { publicKey: keypair.publicKey }
        setWallet(newWallet)
        clearSensitiveData(keypair.secretKey)

        return { wallet: newWallet, mnemonic, accountId }
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

        const normalizedMnemonic = mnemonic.trim().toLowerCase()
        if (!validateMnemonic(normalizedMnemonic, wordlist)) {
          throw { code: "INVALID_MNEMONIC", message: "Invalid seed phrase. Please check and try again." } as NativeWalletError
        }

        const keypair = deriveKeypairFromMnemonic(normalizedMnemonic)
        const publicKeyBase58 = keypair.publicKey.toBase58()
        const privateKeyBase58 = bs58.encode(keypair.secretKey)

        connectToWalletStore(publicKeyBase58)
        const accountId = useWalletStore.getState().activeAccountId!

        await storeWalletKeys(accountId, privateKeyBase58, publicKeyBase58, normalizedMnemonic)
        await addToRegistry({
          id: accountId,
          address: publicKeyBase58,
          providerType: "native",
          createdAt: new Date().toISOString(),
          hasMnemonic: true,
        })

        const newWallet: NativeWallet = { publicKey: keypair.publicKey }
        setWallet(newWallet)
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

        let secretKey: Uint8Array
        try {
          secretKey = bs58.decode(privateKey.trim())
        } catch {
          try {
            const parsed = JSON.parse(privateKey)
            if (Array.isArray(parsed)) {
              secretKey = new Uint8Array(parsed)
            } else {
              throw new Error("Invalid format")
            }
          } catch {
            throw { code: "INVALID_PRIVATE_KEY", message: "Invalid private key format. Use base58 or JSON array." } as NativeWalletError
          }
        }

        if (secretKey.length !== 64) {
          throw { code: "INVALID_PRIVATE_KEY", message: "Invalid private key length. Expected 64 bytes." } as NativeWalletError
        }

        const keypair = Keypair.fromSecretKey(secretKey)
        const publicKeyBase58 = keypair.publicKey.toBase58()
        const privateKeyBase58 = bs58.encode(keypair.secretKey)

        connectToWalletStore(publicKeyBase58)
        const accountId = useWalletStore.getState().activeAccountId!

        await storeWalletKeys(accountId, privateKeyBase58, publicKeyBase58)
        await addToRegistry({
          id: accountId,
          address: publicKeyBase58,
          providerType: "native",
          createdAt: new Date().toISOString(),
          hasMnemonic: false,
        })

        const newWallet: NativeWallet = { publicKey: keypair.publicKey }
        setWallet(newWallet)
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
      const accountId = useWalletStore.getState().activeAccountId
      if (!accountId) {
        throw { code: "NO_WALLET", message: "No active account" } as NativeWalletError
      }
      return await getMnemonicForAccount(accountId)
    } catch (err) {
      if ((err as KeyStorageError).code === "AUTH_FAILED") {
        setError({ code: "AUTH_FAILED", message: "Authentication failed" })
      }
      return null
    }
  }, [])

  /**
   * Delete wallet and all stored data
   */
  const deleteWalletFn = useCallback(async (accountId?: string): Promise<void> => {
    try {
      setIsLoading(true)
      setError(null)

      const authenticated = await authenticateUser("Authenticate to delete wallet")
      if (!authenticated) {
        throw { code: "AUTH_FAILED", message: "Authentication required to delete wallet" } as NativeWalletError
      }

      const targetId = accountId || useWalletStore.getState().activeAccountId
      if (!targetId) return

      await deleteWalletKeys(targetId)
      await removeFromRegistry(targetId)
      useWalletStore.getState().removeAccount(targetId)

      const remaining = await getWalletRegistry()
      if (remaining.length === 0) {
        setWallet(null)
      } else {
        const next = remaining[0]
        setWallet({ publicKey: new PublicKey(next.address) })
      }
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

        // Get private key for active account (biometric auth happens here)
        const accountId = useWalletStore.getState().activeAccountId
        if (!accountId) {
          throw { code: "NO_WALLET", message: "No active account" } as NativeWalletError
        }
        const privateKeyBase58 = await getPrivateKeyForAccount(accountId)
        if (!privateKeyBase58) {
          throw { code: "AUTH_FAILED", message: "Failed to access private key" } as NativeWalletError
        }

        const secretKey = bs58.decode(privateKeyBase58)
        const keypair = Keypair.fromSecretKey(secretKey)

        // Sign based on transaction type
        // Use partialSign to PRESERVE existing signatures (e.g., stealth address signatures)
        if (tx instanceof Transaction) {
          tx.partialSign(keypair)
        } else {
          // VersionedTransaction - sign() preserves existing signatures
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

        // Get private key for active account (biometric auth happens here)
        const accountId = useWalletStore.getState().activeAccountId
        if (!accountId) {
          throw { code: "NO_WALLET", message: "No active account" } as NativeWalletError
        }
        const privateKeyBase58 = await getPrivateKeyForAccount(accountId)
        if (!privateKeyBase58) {
          throw { code: "AUTH_FAILED", message: "Failed to access private key" } as NativeWalletError
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

        // Get private key for active account once (biometric auth happens here)
        const accountId = useWalletStore.getState().activeAccountId
        if (!accountId) {
          throw { code: "NO_WALLET", message: "No active account" } as NativeWalletError
        }
        const privateKeyBase58 = await getPrivateKeyForAccount(accountId)
        if (!privateKeyBase58) {
          throw { code: "AUTH_FAILED", message: "Failed to access private key" } as NativeWalletError
        }

        const secretKey = bs58.decode(privateKeyBase58)
        const keypair = Keypair.fromSecretKey(secretKey)

        // Sign all transactions
        // Use partialSign to PRESERVE existing signatures
        const signedTxs = txs.map((tx) => {
          if (tx instanceof Transaction) {
            tx.partialSign(keypair)
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
