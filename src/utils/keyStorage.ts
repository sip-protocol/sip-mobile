/**
 * Key Storage Utilities
 *
 * Secure key storage using expo-secure-store with biometric protection.
 * Keys are stored encrypted and require biometric auth for access.
 *
 * @see https://github.com/sip-protocol/sip-mobile/issues/68
 */

import * as SecureStore from "expo-secure-store"
import * as LocalAuthentication from "expo-local-authentication"

// Storage keys
const STORAGE_KEYS = {
  PRIVATE_KEY: "sip_wallet_private_key",
  MNEMONIC: "sip_wallet_mnemonic",
  PUBLIC_KEY: "sip_wallet_public_key",
  WALLET_EXISTS: "sip_wallet_exists",
  WALLET_CREATED_AT: "sip_wallet_created_at",
} as const

// SecureStore options with biometric protection
const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  requireAuthentication: true,
  authenticationPrompt: "Authenticate to access your wallet",
}

// Options without biometric (for non-sensitive data)
const STANDARD_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
}

export interface KeyStorageError {
  code: "AUTH_FAILED" | "NOT_FOUND" | "STORAGE_ERROR" | "BIOMETRIC_UNAVAILABLE"
  message: string
}

/**
 * Check if biometric authentication is available
 */
export async function isBiometricAvailable(): Promise<boolean> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync()
    const isEnrolled = await LocalAuthentication.isEnrolledAsync()
    return hasHardware && isEnrolled
  } catch {
    return false
  }
}

/**
 * Get available authentication types
 */
export async function getAuthTypes(): Promise<LocalAuthentication.AuthenticationType[]> {
  try {
    return await LocalAuthentication.supportedAuthenticationTypesAsync()
  } catch {
    return []
  }
}

/**
 * Authenticate user with biometrics
 */
export async function authenticateUser(
  prompt: string = "Authenticate to continue"
): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: prompt,
      fallbackLabel: "Use passcode",
      disableDeviceFallback: false,
    })
    return result.success
  } catch {
    return false
  }
}

/**
 * Check if wallet exists in storage
 */
export async function hasWallet(): Promise<boolean> {
  try {
    const exists = await SecureStore.getItemAsync(
      STORAGE_KEYS.WALLET_EXISTS,
      STANDARD_OPTIONS
    )
    return exists === "true"
  } catch {
    return false
  }
}

/**
 * Store private key (requires biometric)
 */
export async function storePrivateKey(
  privateKeyBase58: string
): Promise<void> {
  try {
    await SecureStore.setItemAsync(
      STORAGE_KEYS.PRIVATE_KEY,
      privateKeyBase58,
      SECURE_OPTIONS
    )
  } catch (error) {
    throw {
      code: "STORAGE_ERROR",
      message: "Failed to store private key",
    } as KeyStorageError
  }
}

/**
 * Retrieve private key (requires biometric)
 */
export async function getPrivateKey(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(
      STORAGE_KEYS.PRIVATE_KEY,
      SECURE_OPTIONS
    )
  } catch (error) {
    // Check if auth failed vs not found
    const errorMessage = error instanceof Error ? error.message : ""
    if (errorMessage.includes("authentication") || errorMessage.includes("canceled")) {
      throw {
        code: "AUTH_FAILED",
        message: "Biometric authentication failed",
      } as KeyStorageError
    }
    return null
  }
}

/**
 * Store mnemonic phrase (requires biometric)
 */
export async function storeMnemonic(mnemonic: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(
      STORAGE_KEYS.MNEMONIC,
      mnemonic,
      SECURE_OPTIONS
    )
  } catch (error) {
    throw {
      code: "STORAGE_ERROR",
      message: "Failed to store mnemonic",
    } as KeyStorageError
  }
}

/**
 * Retrieve mnemonic phrase (requires biometric)
 */
export async function getMnemonic(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(
      STORAGE_KEYS.MNEMONIC,
      SECURE_OPTIONS
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : ""
    if (errorMessage.includes("authentication") || errorMessage.includes("canceled")) {
      throw {
        code: "AUTH_FAILED",
        message: "Biometric authentication failed",
      } as KeyStorageError
    }
    return null
  }
}

/**
 * Store public key (no biometric required)
 */
export async function storePublicKey(publicKeyBase58: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(
      STORAGE_KEYS.PUBLIC_KEY,
      publicKeyBase58,
      STANDARD_OPTIONS
    )
  } catch (error) {
    throw {
      code: "STORAGE_ERROR",
      message: "Failed to store public key",
    } as KeyStorageError
  }
}

/**
 * Retrieve public key (no biometric required)
 */
export async function getPublicKey(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(
      STORAGE_KEYS.PUBLIC_KEY,
      STANDARD_OPTIONS
    )
  } catch {
    return null
  }
}

/**
 * Mark wallet as created
 */
export async function setWalletExists(exists: boolean): Promise<void> {
  try {
    await SecureStore.setItemAsync(
      STORAGE_KEYS.WALLET_EXISTS,
      exists ? "true" : "false",
      STANDARD_OPTIONS
    )
    if (exists) {
      await SecureStore.setItemAsync(
        STORAGE_KEYS.WALLET_CREATED_AT,
        new Date().toISOString(),
        STANDARD_OPTIONS
      )
    }
  } catch (error) {
    throw {
      code: "STORAGE_ERROR",
      message: "Failed to update wallet status",
    } as KeyStorageError
  }
}

/**
 * Get wallet creation date
 */
export async function getWalletCreatedAt(): Promise<Date | null> {
  try {
    const dateStr = await SecureStore.getItemAsync(
      STORAGE_KEYS.WALLET_CREATED_AT,
      STANDARD_OPTIONS
    )
    return dateStr ? new Date(dateStr) : null
  } catch {
    return null
  }
}

/**
 * Delete all wallet data
 */
export async function deleteWallet(): Promise<void> {
  try {
    // Delete all stored keys
    await Promise.all([
      SecureStore.deleteItemAsync(STORAGE_KEYS.PRIVATE_KEY),
      SecureStore.deleteItemAsync(STORAGE_KEYS.MNEMONIC),
      SecureStore.deleteItemAsync(STORAGE_KEYS.PUBLIC_KEY),
      SecureStore.deleteItemAsync(STORAGE_KEYS.WALLET_EXISTS),
      SecureStore.deleteItemAsync(STORAGE_KEYS.WALLET_CREATED_AT),
    ])
  } catch (error) {
    throw {
      code: "STORAGE_ERROR",
      message: "Failed to delete wallet",
    } as KeyStorageError
  }
}

/**
 * Clear sensitive data from memory
 * Call this after using private keys
 */
export function clearSensitiveData(data: Uint8Array): void {
  // Overwrite with zeros
  data.fill(0)
}

// ---------------------------------------------------------------------------
// Multi-Wallet Support (indexed key storage)
// ---------------------------------------------------------------------------

const walletKey = (id: string, suffix: string) => `sip_${suffix}_${id}`
const REGISTRY_KEY = "sip_wallet_registry"

export interface WalletRegistryEntry {
  id: string
  address: string
  providerType: string
  createdAt: string
  hasMnemonic: boolean
}

/**
 * Get all wallet entries from the registry
 */
export async function getWalletRegistry(): Promise<WalletRegistryEntry[]> {
  try {
    const raw = await SecureStore.getItemAsync(REGISTRY_KEY, STANDARD_OPTIONS)
    if (!raw) return []
    return JSON.parse(raw) as WalletRegistryEntry[]
  } catch {
    return []
  }
}

/**
 * Add a wallet entry to the registry (skips duplicates by id)
 */
export async function addToRegistry(entry: WalletRegistryEntry): Promise<void> {
  const registry = await getWalletRegistry()
  if (registry.some((e) => e.id === entry.id)) return
  registry.push(entry)
  await SecureStore.setItemAsync(REGISTRY_KEY, JSON.stringify(registry), STANDARD_OPTIONS)
}

/**
 * Remove a wallet entry from the registry by id
 */
export async function removeFromRegistry(id: string): Promise<void> {
  const registry = await getWalletRegistry()
  const filtered = registry.filter((e) => e.id !== id)
  await SecureStore.setItemAsync(REGISTRY_KEY, JSON.stringify(filtered), STANDARD_OPTIONS)
}

/**
 * Store keys for a specific wallet account
 */
export async function storeWalletKeys(
  id: string,
  privateKeyBase58: string,
  publicKeyBase58: string,
  mnemonic?: string
): Promise<void> {
  await SecureStore.setItemAsync(walletKey(id, "privkey"), privateKeyBase58, SECURE_OPTIONS)
  await SecureStore.setItemAsync(walletKey(id, "pubkey"), publicKeyBase58, STANDARD_OPTIONS)
  if (mnemonic) {
    await SecureStore.setItemAsync(walletKey(id, "mnemonic"), mnemonic, SECURE_OPTIONS)
  }
}

/**
 * Retrieve private key for a specific account (requires biometric)
 */
export async function getPrivateKeyForAccount(id: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(walletKey(id, "privkey"), SECURE_OPTIONS)
  } catch (error) {
    const msg = error instanceof Error ? error.message : ""
    if (msg.includes("authentication") || msg.includes("canceled")) {
      throw { code: "AUTH_FAILED", message: "Biometric authentication failed" } as KeyStorageError
    }
    return null
  }
}

/**
 * Retrieve mnemonic for a specific account (requires biometric)
 */
export async function getMnemonicForAccount(id: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(walletKey(id, "mnemonic"), SECURE_OPTIONS)
  } catch (error) {
    const msg = error instanceof Error ? error.message : ""
    if (msg.includes("authentication") || msg.includes("canceled")) {
      throw { code: "AUTH_FAILED", message: "Biometric authentication failed" } as KeyStorageError
    }
    return null
  }
}

/**
 * Delete all stored keys for a specific account
 */
export async function deleteWalletKeys(id: string): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(walletKey(id, "privkey")),
    SecureStore.deleteItemAsync(walletKey(id, "pubkey")),
    SecureStore.deleteItemAsync(walletKey(id, "mnemonic")),
  ])
}

/**
 * Migrate legacy single-wallet storage to indexed multi-wallet format
 */
export async function migrateFromLegacy(accountId: string): Promise<WalletRegistryEntry | null> {
  try {
    const exists = await SecureStore.getItemAsync(STORAGE_KEYS.WALLET_EXISTS, STANDARD_OPTIONS)
    if (exists !== "true") return null

    const publicKey = await SecureStore.getItemAsync(STORAGE_KEYS.PUBLIC_KEY, STANDARD_OPTIONS)
    if (!publicKey) return null

    let privateKey: string | null = null
    try {
      privateKey = await SecureStore.getItemAsync(STORAGE_KEYS.PRIVATE_KEY, SECURE_OPTIONS)
    } catch {
      return null
    }
    if (!privateKey) return null

    let mnemonic: string | null = null
    try {
      mnemonic = await SecureStore.getItemAsync(STORAGE_KEYS.MNEMONIC, SECURE_OPTIONS)
    } catch {
      // Mnemonic might not exist
    }

    await storeWalletKeys(accountId, privateKey, publicKey, mnemonic ?? undefined)

    const createdAt = await SecureStore.getItemAsync(STORAGE_KEYS.WALLET_CREATED_AT, STANDARD_OPTIONS)
    const entry: WalletRegistryEntry = {
      id: accountId,
      address: publicKey,
      providerType: "native",
      createdAt: createdAt || new Date().toISOString(),
      hasMnemonic: !!mnemonic,
    }
    await addToRegistry(entry)

    await Promise.all([
      SecureStore.deleteItemAsync(STORAGE_KEYS.PRIVATE_KEY),
      SecureStore.deleteItemAsync(STORAGE_KEYS.MNEMONIC),
      SecureStore.deleteItemAsync(STORAGE_KEYS.PUBLIC_KEY),
      SecureStore.deleteItemAsync(STORAGE_KEYS.WALLET_EXISTS),
      SecureStore.deleteItemAsync(STORAGE_KEYS.WALLET_CREATED_AT),
    ])

    return entry
  } catch {
    return null
  }
}
