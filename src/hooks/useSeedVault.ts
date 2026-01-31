/**
 * useSeedVault Hook
 *
 * Direct Seed Vault integration for Solana Mobile devices (Saga, Seeker).
 * Provides hardware-backed key custody through the device's Trusted Execution Environment (TEE).
 *
 * Keys never leave the secure enclave — signing happens inside the TEE.
 *
 * Features:
 * - Hardware-backed key storage (Trusted Execution Environment)
 * - Biometric authentication (fingerprint, double-tap)
 * - BIP-0039 seed phrase support
 * - Transaction signing via secure element
 *
 * Requirements:
 * - Android only (Seed Vault not available on iOS)
 * - Device must have Seed Vault implementation (Saga, Seeker, or emulator with simulator)
 *
 * @see https://github.com/solana-mobile/seed-vault-sdk
 *
 * Part of Native Wallet Architecture (#61)
 * Issue: #70, #75
 */

import { useState, useCallback, useEffect, useRef } from "react"
import { Platform, PermissionsAndroid } from "react-native"
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js"
// Conditionally import native module - may not be available on all builds
let SeedVault: import("@solana-mobile/seed-vault-lib").SeedVaultAPI | undefined
let SeedVaultPermissionAndroid: import("react-native").Permission | undefined
let useSeedVaultNative: ((
  handleEvent: (event: import("@solana-mobile/seed-vault-lib").SeedVaultEvent) => void,
  handleChange: (event: import("@solana-mobile/seed-vault-lib").SeedVaultContentChange) => void
) => void) | undefined

try {
  const seedVaultLib = require("@solana-mobile/seed-vault-lib")
  SeedVault = seedVaultLib.SeedVault
  SeedVaultPermissionAndroid = seedVaultLib.SeedVaultPermissionAndroid
  useSeedVaultNative = seedVaultLib.useSeedVault
} catch (e) {
  console.warn("[SeedVault] Native module not available:", e)
}

import type {
  Seed,
  Account,
  SeedVaultEvent,
  SeedVaultContentChange,
} from "@solana-mobile/seed-vault-lib"

// ============================================================================
// TYPES
// ============================================================================

export interface SeedVaultWallet {
  publicKey: PublicKey
  authToken: number
  derivationPath: string
  seedName: string
  accountId: number
}

export interface UseSeedVaultReturn {
  // State
  wallet: SeedVaultWallet | null
  isAvailable: boolean
  isLoading: boolean
  isInitialized: boolean
  error: Error | null

  // Seed Management
  checkAvailability: () => Promise<boolean>
  requestPermission: () => Promise<boolean>
  authorizeNewSeed: () => Promise<{ authToken: number } | null>
  createNewSeed: () => Promise<{ authToken: number } | null>
  importExistingSeed: () => Promise<{ authToken: number } | null>
  getAuthorizedSeeds: () => Promise<Seed[]>
  deauthorizeSeed: (authToken: number) => void

  // Account Selection
  selectSeed: (authToken: number, accountIndex?: number) => Promise<void>
  getAccounts: (authToken: number) => Promise<Account[]>

  // Signing
  signTransaction: <T extends Transaction | VersionedTransaction>(tx: T) => Promise<T>
  signMessage: (message: Uint8Array) => Promise<Uint8Array>
  signAllTransactions: <T extends Transaction | VersionedTransaction>(txs: T[]) => Promise<T[]>

  // Utility
  disconnect: () => void
  showSeedSettings: (authToken: number) => Promise<void>
}

// Default Solana derivation path (BIP44)
const DEFAULT_DERIVATION_PATH = "m/44'/501'/0'/0'"

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Encode bytes to base64 for Seed Vault API
 */
function toBase64(bytes: Uint8Array): string {
  // React Native compatible base64 encoding
  let binary = ""
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Decode base64 to bytes
 */
function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook for Seed Vault integration on Solana Mobile devices
 *
 * @param allowSimulated - Allow simulated Seed Vault in development (default: true in __DEV__)
 */
export function useSeedVault(
  allowSimulated: boolean = __DEV__
): UseSeedVaultReturn {
  const [wallet, setWallet] = useState<SeedVaultWallet | null>(null)
  const [isAvailable, setIsAvailable] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isInitialized, setIsInitialized] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Track current derivation path for signing
  const currentDerivationPathRef = useRef<string>(DEFAULT_DERIVATION_PATH)

  // Handle Seed Vault events
  const handleSeedVaultEvent = useCallback((event: SeedVaultEvent) => {
    if ("__type" in event) {
      console.log("[SeedVault] Event received:", event.__type)
    } else if ("message" in event) {
      console.log("[SeedVault] Event error:", event.message)
    }
  }, [])

  // Handle content changes (seed added/removed)
  const handleContentChange = useCallback((event: SeedVaultContentChange) => {
    console.log("[SeedVault] Content changed:", event.uris)
  }, [])

  // Register event listeners (only on Android when native module is available)
  useEffect(() => {
    if (Platform.OS === "android" && useSeedVaultNative) {
      try {
        useSeedVaultNative(handleSeedVaultEvent, handleContentChange)
      } catch (e) {
        console.warn("[SeedVault] Failed to register event listeners:", e)
      }
    }
  }, [handleSeedVaultEvent, handleContentChange])

  // Check availability on mount
  useEffect(() => {
    checkAvailability().finally(() => {
      setIsInitialized(true)
      setIsLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * Check if Seed Vault is available on this device
   */
  const checkAvailability = useCallback(async (): Promise<boolean> => {
    // Seed Vault is Android-only and requires native module
    if (Platform.OS !== "android" || !SeedVault) {
      setIsAvailable(false)
      return false
    }

    try {
      const available = await SeedVault.isSeedVaultAvailable(allowSimulated)
      setIsAvailable(available)
      return available
    } catch (err) {
      console.warn("[SeedVault] Error checking availability:", err)
      setIsAvailable(false)
      return false
    }
  }, [allowSimulated])

  /**
   * Request permission to use Seed Vault
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== "android" || !SeedVaultPermissionAndroid) {
      return false
    }

    try {
      const result = await PermissionsAndroid.request(
        SeedVaultPermissionAndroid,
        {
          title: "Seed Vault Permission",
          message: "SIP Privacy needs access to Seed Vault for secure key storage",
          buttonNeutral: "Ask Me Later",
          buttonNegative: "Cancel",
          buttonPositive: "OK",
        }
      )

      return result === PermissionsAndroid.RESULTS.GRANTED
    } catch (err) {
      console.error("[SeedVault] Permission request failed:", err)
      setError(err instanceof Error ? err : new Error("Permission request failed"))
      return false
    }
  }, [])

  /**
   * Authorize access to an existing seed in the vault
   * Opens system UI for user to select and authorize a seed
   */
  const authorizeNewSeed = useCallback(async (): Promise<{ authToken: number } | null> => {
    if (!isAvailable || !SeedVault) {
      setError(new Error("Seed Vault not available"))
      return null
    }

    try {
      setIsLoading(true)
      setError(null)

      const result = await SeedVault.authorizeNewSeed()
      console.log("[SeedVault] Seed authorized, authToken:", result.authToken)

      return result
    } catch (err) {
      console.error("[SeedVault] Authorization failed:", err)
      setError(err instanceof Error ? err : new Error("Authorization failed"))
      return null
    } finally {
      setIsLoading(false)
    }
  }, [isAvailable])

  /**
   * Create a new seed in the vault
   * Opens system UI for user to create and back up a new seed
   */
  const createNewSeed = useCallback(async (): Promise<{ authToken: number } | null> => {
    if (!isAvailable || !SeedVault) {
      setError(new Error("Seed Vault not available"))
      return null
    }

    try {
      setIsLoading(true)
      setError(null)

      const result = await SeedVault.createNewSeed()
      console.log("[SeedVault] New seed created, authToken:", result.authToken)

      return result
    } catch (err) {
      console.error("[SeedVault] Seed creation failed:", err)
      setError(err instanceof Error ? err : new Error("Seed creation failed"))
      return null
    } finally {
      setIsLoading(false)
    }
  }, [isAvailable])

  /**
   * Import an existing seed phrase into the vault
   * Opens system UI for user to enter their seed phrase
   */
  const importExistingSeed = useCallback(async (): Promise<{ authToken: number } | null> => {
    if (!isAvailable || !SeedVault) {
      setError(new Error("Seed Vault not available"))
      return null
    }

    try {
      setIsLoading(true)
      setError(null)

      const result = await SeedVault.importExistingSeed()
      console.log("[SeedVault] Seed imported, authToken:", result.authToken)

      return result
    } catch (err) {
      console.error("[SeedVault] Seed import failed:", err)
      setError(err instanceof Error ? err : new Error("Seed import failed"))
      return null
    } finally {
      setIsLoading(false)
    }
  }, [isAvailable])

  /**
   * Get list of seeds this app is authorized to use
   */
  const getAuthorizedSeeds = useCallback(async (): Promise<Seed[]> => {
    if (!isAvailable || !SeedVault) {
      return []
    }

    try {
      const seeds = await SeedVault.getAuthorizedSeeds()
      return seeds
    } catch (err) {
      console.error("[SeedVault] Failed to get authorized seeds:", err)
      return []
    }
  }, [isAvailable])

  /**
   * Deauthorize a seed (revoke app access)
   */
  const deauthorizeSeed = useCallback((authToken: number): void => {
    if (!isAvailable || !SeedVault) return

    try {
      SeedVault.deauthorizeSeed(authToken)
      console.log("[SeedVault] Seed deauthorized:", authToken)

      // If this was the active wallet, disconnect
      if (wallet?.authToken === authToken) {
        setWallet(null)
      }
    } catch (err) {
      console.error("[SeedVault] Failed to deauthorize seed:", err)
    }
  }, [isAvailable, wallet])

  /**
   * Get accounts (derived addresses) for a seed
   */
  const getAccounts = useCallback(async (authToken: number): Promise<Account[]> => {
    if (!isAvailable || !SeedVault) {
      return []
    }

    try {
      const accounts = await SeedVault.getUserWallets(authToken)
      return accounts
    } catch (err) {
      console.error("[SeedVault] Failed to get accounts:", err)
      return []
    }
  }, [isAvailable])

  /**
   * Select a seed and account to use as the active wallet
   */
  const selectSeed = useCallback(async (authToken: number, accountIndex: number = 0): Promise<void> => {
    if (!isAvailable || !SeedVault) {
      throw new Error("Seed Vault not available")
    }

    try {
      setIsLoading(true)
      setError(null)

      // Get seed info
      const seeds = await SeedVault.getAuthorizedSeeds()
      const seed = seeds.find((s: Seed) => s.authToken === authToken)

      if (!seed) {
        throw new Error("Seed not found or not authorized")
      }

      // Get accounts for this seed
      const accounts = await SeedVault.getUserWallets(authToken)

      if (accounts.length === 0) {
        // No accounts yet, get public key for default derivation path
        const derivationPath = DEFAULT_DERIVATION_PATH
        const publicKeyResult = await SeedVault.getPublicKey(authToken, derivationPath)

        const publicKey = new PublicKey(publicKeyResult.publicKey)

        setWallet({
          publicKey,
          authToken,
          derivationPath: publicKeyResult.resolvedDerivationPath,
          seedName: seed.name,
          accountId: 0,
        })
        currentDerivationPathRef.current = publicKeyResult.resolvedDerivationPath
      } else {
        // Use selected account
        const account = accounts[accountIndex] ?? accounts[0]
        const publicKeyResult = await SeedVault.getPublicKey(authToken, account.derivationPath)

        const publicKey = new PublicKey(publicKeyResult.publicKey)

        setWallet({
          publicKey,
          authToken,
          derivationPath: publicKeyResult.resolvedDerivationPath,
          seedName: seed.name,
          accountId: account.id,
        })
        currentDerivationPathRef.current = publicKeyResult.resolvedDerivationPath
      }

      console.log("[SeedVault] Wallet selected:", wallet?.publicKey.toBase58())
    } catch (err) {
      console.error("[SeedVault] Failed to select seed:", err)
      setError(err instanceof Error ? err : new Error("Failed to select seed"))
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [isAvailable, wallet])

  /**
   * Sign a transaction using Seed Vault
   */
  const signTransaction = useCallback(
    async <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => {
      if (!wallet || !SeedVault) {
        throw new Error("No wallet connected")
      }

      try {
        setIsLoading(true)

        // Serialize transaction
        const serialized = tx.serialize({ requireAllSignatures: false })
        const base64Tx = toBase64(serialized)

        // Sign via Seed Vault (will prompt biometric)
        const result = await SeedVault.signTransaction(
          wallet.authToken,
          currentDerivationPathRef.current,
          base64Tx
        )

        if (!result.signatures || result.signatures.length === 0) {
          throw new Error("No signature returned")
        }

        // Apply signature to transaction
        const signature = fromBase64(result.signatures[0])

        if (tx instanceof Transaction) {
          tx.addSignature(wallet.publicKey, Buffer.from(signature))
        } else {
          // VersionedTransaction
          tx.addSignature(wallet.publicKey, signature)
        }

        return tx
      } catch (err) {
        console.error("[SeedVault] Transaction signing failed:", err)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [wallet]
  )

  /**
   * Sign a message using Seed Vault
   */
  const signMessage = useCallback(
    async (message: Uint8Array): Promise<Uint8Array> => {
      if (!wallet || !SeedVault) {
        throw new Error("No wallet connected")
      }

      try {
        setIsLoading(true)

        const base64Message = toBase64(message)

        // Sign via Seed Vault (will prompt biometric)
        const result = await SeedVault.signMessage(
          wallet.authToken,
          currentDerivationPathRef.current,
          base64Message
        )

        if (!result.signatures || result.signatures.length === 0) {
          throw new Error("No signature returned")
        }

        return fromBase64(result.signatures[0])
      } catch (err) {
        console.error("[SeedVault] Message signing failed:", err)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [wallet]
  )

  /**
   * Sign multiple transactions
   */
  const signAllTransactions = useCallback(
    async <T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> => {
      if (!wallet || !SeedVault) {
        throw new Error("No wallet connected")
      }

      try {
        setIsLoading(true)

        // Build signing requests
        const signingRequests = txs.map(tx => ({
          payload: toBase64(tx.serialize({ requireAllSignatures: false })),
          requestedSignatures: [currentDerivationPathRef.current],
        }))

        // Sign all via Seed Vault (single biometric prompt)
        const results = await SeedVault.signTransactions(wallet.authToken, signingRequests)

        // Apply signatures to transactions
        for (let i = 0; i < txs.length; i++) {
          const tx = txs[i]
          const result = results[i]

          if (!result?.signatures || result.signatures.length === 0) {
            throw new Error(`No signature returned for transaction ${i}`)
          }

          const signature = fromBase64(result.signatures[0])

          if (tx instanceof Transaction) {
            tx.addSignature(wallet.publicKey, Buffer.from(signature))
          } else {
            tx.addSignature(wallet.publicKey, signature)
          }
        }

        return txs
      } catch (err) {
        console.error("[SeedVault] Batch signing failed:", err)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [wallet]
  )

  /**
   * Disconnect wallet
   */
  const disconnect = useCallback(() => {
    setWallet(null)
    setError(null)
  }, [])

  /**
   * Show seed settings in system UI
   */
  const showSeedSettings = useCallback(async (authToken: number): Promise<void> => {
    if (!isAvailable || !SeedVault) return

    try {
      await SeedVault.showSeedSettings(authToken)
    } catch (err) {
      console.error("[SeedVault] Failed to show seed settings:", err)
    }
  }, [isAvailable])

  return {
    wallet,
    isAvailable,
    isLoading,
    isInitialized,
    error,
    checkAvailability,
    requestPermission,
    authorizeNewSeed,
    createNewSeed,
    importExistingSeed,
    getAuthorizedSeeds,
    deauthorizeSeed,
    selectSeed,
    getAccounts,
    signTransaction,
    signMessage,
    signAllTransactions,
    disconnect,
    showSeedSettings,
  }
}
