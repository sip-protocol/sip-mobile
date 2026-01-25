/**
 * useSeedVault Hook
 *
 * Direct Seed Vault integration for Solana Mobile devices (Saga, Seeker).
 * Provides hardware-backed key custody through the device's secure element.
 *
 * NOTE: Seed Vault native module temporarily disabled due to React Native
 * codegen compatibility issues. Will be re-enabled once native build
 * configuration is properly set up.
 *
 * TODO: Re-add @solana-mobile/seed-vault-lib with proper native module setup
 * See: https://github.com/solana-mobile/seed-vault-sdk
 *
 * Features (when enabled):
 * - Hardware-backed key storage (Trusted Execution Environment)
 * - Biometric authentication (fingerprint, double-tap)
 * - BIP-0039 seed phrase support
 * - Transaction signing via secure element
 *
 * Requirements:
 * - Android only (Seed Vault not available on iOS)
 * - Device must have Seed Vault implementation (Saga, Seeker, or emulator with simulator)
 *
 * Part of Native Wallet Architecture (#61)
 * Issue: #70
 */

import { useState, useCallback } from "react"
import { Platform } from "react-native"
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js"

export interface SeedVaultWallet {
  publicKey: PublicKey
  authToken: number
  derivationPath: string
  seedName: string
}

export interface UseSeedVaultReturn {
  // State
  wallet: SeedVaultWallet | null
  isAvailable: boolean
  isLoading: boolean
  isInitialized: boolean
  error: Error | null

  // Methods
  checkAvailability: () => Promise<boolean>
  requestPermission: () => Promise<boolean>
  authorizeNewSeed: () => Promise<{ authToken: number } | null>
  getAuthorizedSeeds: () => Promise<{ authToken: number; name: string; purpose: number }[]>
  selectSeed: (authToken: number) => Promise<void>
  signTransaction: <T extends Transaction | VersionedTransaction>(
    tx: T
  ) => Promise<T>
  signMessage: (message: Uint8Array) => Promise<Uint8Array>
  signAllTransactions: <T extends Transaction | VersionedTransaction>(
    txs: T[]
  ) => Promise<T[]>
  disconnect: () => void
}

/**
 * Hook for Seed Vault integration on Solana Mobile devices
 *
 * NOTE: Currently returns isAvailable: false due to native module issues.
 * The hook structure is preserved for future integration.
 *
 * @param _allowSimulated - Allow simulated Seed Vault (unused until native module is fixed)
 */
export function useSeedVault(
  _allowSimulated: boolean = __DEV__
): UseSeedVaultReturn {
  const [wallet] = useState<SeedVaultWallet | null>(null)
  const [isLoading] = useState(false)
  const [error] = useState<Error | null>(null)

  // Always unavailable until native module is properly set up
  const isAvailable = false
  const isInitialized = true

  const checkAvailability = useCallback(async (): Promise<boolean> => {
    // Seed Vault is Android-only and native module is not yet configured
    if (Platform.OS !== "android") {
      return false
    }
    // TODO: Re-enable when @solana-mobile/seed-vault-lib is properly configured
    console.warn("[SeedVault] Native module not yet configured. Use useNativeWallet instead.")
    return false
  }, [])

  const requestPermission = useCallback(async (): Promise<boolean> => {
    console.warn("[SeedVault] Native module not yet configured")
    return false
  }, [])

  const authorizeNewSeed = useCallback(async (): Promise<{ authToken: number } | null> => {
    console.warn("[SeedVault] Native module not yet configured")
    return null
  }, [])

  const getAuthorizedSeeds = useCallback(async (): Promise<{ authToken: number; name: string; purpose: number }[]> => {
    return []
  }, [])

  const selectSeed = useCallback(async (_authToken: number): Promise<void> => {
    throw new Error("Seed Vault not available - use useNativeWallet instead")
  }, [])

  const signTransaction = useCallback(
    async <T extends Transaction | VersionedTransaction>(_tx: T): Promise<T> => {
      throw new Error("Seed Vault not available - use useNativeWallet instead")
    },
    []
  )

  const signMessage = useCallback(
    async (_message: Uint8Array): Promise<Uint8Array> => {
      throw new Error("Seed Vault not available - use useNativeWallet instead")
    },
    []
  )

  const signAllTransactions = useCallback(
    async <T extends Transaction | VersionedTransaction>(
      _txs: T[]
    ): Promise<T[]> => {
      throw new Error("Seed Vault not available - use useNativeWallet instead")
    },
    []
  )

  const disconnect = useCallback(() => {
    // No-op
  }, [])

  return {
    wallet,
    isAvailable,
    isLoading,
    isInitialized,
    error,
    checkAvailability,
    requestPermission,
    authorizeNewSeed,
    getAuthorizedSeeds,
    selectSeed,
    signTransaction,
    signMessage,
    signAllTransactions,
    disconnect,
  }
}
