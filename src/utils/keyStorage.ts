/**
 * Key Storage Utilities
 *
 * Secure key storage using expo-secure-store. On enroll-capable devices keys
 * are biometric-gated; on devices without an enrollment (#138) they are
 * written without an auth requirement and the downgrade is RECORDED in a
 * security-level flag so reads stay symmetric and an explicit upgrade path
 * exists (upgradeWalletSecurity). Every auth-gated operation is wrapped in a
 * hard timeout so an unanswered biometric prompt can never wedge a flow.
 *
 * @see https://github.com/sip-protocol/sip-mobile/issues/68
 * @see https://github.com/sip-protocol/sip-mobile/issues/138
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
  // #138: records which options the (legacy single-wallet) keys were written under
  KEY_SECURITY_LEVEL: "sip_key_security_level",
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

// ---------------------------------------------------------------------------
// Keychain security policy (#138 — adaptive gating)
// ---------------------------------------------------------------------------
// On Android, `requireAuthentication: true` maps to Keystore
// setUserAuthenticationRequired(true): auth is demanded for EVERY operation,
// and on a device with no biometrics/passcode enrolled the WRITE itself
// rejects ("No biometrics are currently enrolled") — which used to dead-end
// wallet creation behind an unrecoverable Alert. Policy: enroll-capable
// devices keep biometric-gated keys; everything else is written WITHOUT an
// auth requirement and the downgrade is RECORDED in a security-level flag
// (written BEFORE any key material) so reads stay symmetric and the UI can
// offer an explicit upgrade path. Never a silent downgrade: the flag is the
// source of truth for what protection the material actually has.
// ---------------------------------------------------------------------------

export type KeychainSecurityLevel = "BIOMETRIC" | "STANDARD"

export interface KeychainPolicy {
  level: KeychainSecurityLevel
  requireBiometrics: boolean
  hasHardware: boolean
  isEnrolled: boolean
}

/**
 * Hard ceiling for SecureStore operations. A shown-but-unanswered auth prompt
 * must never wedge a flow indefinitely. (iOS blocks the JS thread while its
 * prompt is up, so the timer can only fire once the prompt resolves — the
 * bound is exact on Android, best-effort on iOS.)
 */
const SECURE_STORE_TIMEOUT_MS = 8_000

function levelKey(id?: string): string {
  return id ? `sip_seclevel_${id}` : STORAGE_KEYS.KEY_SECURITY_LEVEL
}

function optionsForLevel(level: KeychainSecurityLevel): SecureStore.SecureStoreOptions {
  return level === "BIOMETRIC" ? SECURE_OPTIONS : STANDARD_OPTIONS
}

/** Timeout code reflects what can actually hang: only auth-gated ops can
 *  block on a biometric prompt; plain ops get STORAGE_ERROR. */
function codeForLevel(level: KeychainSecurityLevel): KeyStorageError["code"] {
  return level === "BIOMETRIC" ? "BIOMETRIC_UNAVAILABLE" : "STORAGE_ERROR"
}

function withTimeout<T>(op: () => Promise<T>, code: KeyStorageError["code"]): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject({
        code,
        message: `SecureStore operation timed out after ${SECURE_STORE_TIMEOUT_MS}ms (unacknowledged auth prompt?)`,
      } as KeyStorageError)
    }, SECURE_STORE_TIMEOUT_MS)
    op().then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}

function isKeyStorageError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as KeyStorageError).code === "string"
  )
}

/**
 * Resolve the keychain policy for THIS device. BIOMETRIC only when the device
 * has biometric hardware AND an enrollment; anything else downgrades to
 * STANDARD (adaptive gating, issue #138).
 */
export async function resolveKeychainPolicy(): Promise<KeychainPolicy> {
  let hasHardware = false
  let isEnrolled = false
  try {
    hasHardware = await LocalAuthentication.hasHardwareAsync()
    isEnrolled = await LocalAuthentication.isEnrolledAsync()
  } catch {
    // Native module unavailable → treat as unenrolled (STANDARD, never hangs)
  }
  const requireBiometrics = hasHardware && isEnrolled
  return {
    level: requireBiometrics ? "BIOMETRIC" : "STANDARD",
    requireBiometrics,
    hasHardware,
    isEnrolled,
  }
}

/**
 * Read the security level a wallet's keys were written under. Defaults to
 * BIOMETRIC when no flag exists: every pre-#138 write used biometric-gated
 * options, and stored keys must never be silently treated as less (or more)
 * protected than they are.
 */
export async function getStoredSecurityLevel(id?: string): Promise<KeychainSecurityLevel> {
  try {
    const raw = await withTimeout(
      () => SecureStore.getItemAsync(levelKey(id), STANDARD_OPTIONS),
      "STORAGE_ERROR"
    )
    return raw === "STANDARD" ? "STANDARD" : "BIOMETRIC"
  } catch {
    return "BIOMETRIC"
  }
}

/** Persist the level flag — callers MUST invoke this BEFORE writing key
 *  material under the same scope, so the flag never describes material that
 *  was written with different options. */
async function writeSecurityLevel(level: KeychainSecurityLevel, id?: string): Promise<void> {
  await withTimeout(
    () => SecureStore.setItemAsync(levelKey(id), level, STANDARD_OPTIONS),
    "STORAGE_ERROR"
  )
}

/**
 * Map a failed secure READ to a typed error. Auth canceled by the user →
 * AUTH_FAILED; auth demanded but impossible (enrollment removed after the
 * keys were written) → BIOMETRIC_UNAVAILABLE; anything else → treat as
 * key-not-present (caller receives null).
 */
function mapSecureReadError(error: unknown): KeyStorageError | null {
  const raw = error instanceof Error ? error.message : error ? String(error) : ""
  const message = raw.toLowerCase()
  if (!message) return null
  if (message.includes("cancel")) {
    return { code: "AUTH_FAILED", message: "Biometric authentication canceled" }
  }
  if (
    message.includes("authenticat") ||
    message.includes("biometric") ||
    message.includes("enrolled")
  ) {
    return {
      code: "BIOMETRIC_UNAVAILABLE",
      message:
        "Keychain requires authentication but the device cannot authenticate (was enrollment removed?)",
    }
  }
  return null
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
 * Store private key (requires biometric on enroll-capable devices; STANDARD
 * with recorded level otherwise — #138 adaptive gating)
 */
export async function storePrivateKey(
  privateKeyBase58: string
): Promise<void> {
  const { level } = await resolveKeychainPolicy()
  try {
    // Level flag BEFORE key material: a crash between the two writes leaves a
    // stale/absent flag (→ conservative BIOMETRIC read default), never keys
    // misdescribed as protected when they are not.
    await writeSecurityLevel(level)
    await withTimeout(
      () =>
        SecureStore.setItemAsync(
          STORAGE_KEYS.PRIVATE_KEY,
          privateKeyBase58,
          optionsForLevel(level)
        ),
      codeForLevel(level)
    )
  } catch (error) {
    if (isKeyStorageError(error)) throw error
    throw {
      code: "STORAGE_ERROR",
      message: "Failed to store private key",
    } as KeyStorageError
  }
}

/**
 * Retrieve private key (biometric on enroll-capable devices; level recorded
 * at write time decides — #138)
 */
export async function getPrivateKey(): Promise<string | null> {
  const level = await getStoredSecurityLevel()
  try {
    return await withTimeout(
      () =>
        SecureStore.getItemAsync(
          STORAGE_KEYS.PRIVATE_KEY,
          optionsForLevel(level)
        ),
      codeForLevel(level)
    )
  } catch (error) {
    const mapped = mapSecureReadError(error)
    if (mapped) throw mapped
    return null
  }
}

/**
 * Store mnemonic phrase (requires biometric on enroll-capable devices;
 * STANDARD with recorded level otherwise — #138)
 */
export async function storeMnemonic(mnemonic: string): Promise<void> {
  const { level } = await resolveKeychainPolicy()
  try {
    await writeSecurityLevel(level)
    await withTimeout(
      () =>
        SecureStore.setItemAsync(
          STORAGE_KEYS.MNEMONIC,
          mnemonic,
          optionsForLevel(level)
        ),
      codeForLevel(level)
    )
  } catch (error) {
    if (isKeyStorageError(error)) throw error
    throw {
      code: "STORAGE_ERROR",
      message: "Failed to store mnemonic",
    } as KeyStorageError
  }
}

/**
 * Retrieve mnemonic phrase (level recorded at write time decides — #138)
 */
export async function getMnemonic(): Promise<string | null> {
  const level = await getStoredSecurityLevel()
  try {
    return await withTimeout(
      () =>
        SecureStore.getItemAsync(
          STORAGE_KEYS.MNEMONIC,
          optionsForLevel(level)
        ),
      codeForLevel(level)
    )
  } catch (error) {
    const mapped = mapSecureReadError(error)
    if (mapped) throw mapped
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
  } catch (_error) {
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
  } catch (_error) {
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
    // Delete all stored keys (incl. the security-level flag, so a future
    // wallet on this device starts with a freshly-resolved policy)
    await Promise.all([
      SecureStore.deleteItemAsync(STORAGE_KEYS.PRIVATE_KEY),
      SecureStore.deleteItemAsync(STORAGE_KEYS.MNEMONIC),
      SecureStore.deleteItemAsync(STORAGE_KEYS.PUBLIC_KEY),
      SecureStore.deleteItemAsync(STORAGE_KEYS.WALLET_EXISTS),
      SecureStore.deleteItemAsync(STORAGE_KEYS.WALLET_CREATED_AT),
      SecureStore.deleteItemAsync(levelKey()),
    ])
  } catch (_error) {
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
 * Store keys for a specific wallet account (adaptive gating, #138: the
 * security level is resolved once and its flag is written BEFORE any key
 * material, so reads always know how the material is protected)
 */
export async function storeWalletKeys(
  id: string,
  privateKeyBase58: string,
  publicKeyBase58: string,
  mnemonic?: string
): Promise<void> {
  const { level } = await resolveKeychainPolicy()
  await writeSecurityLevel(level, id)
  await withTimeout(
    () =>
      SecureStore.setItemAsync(
        walletKey(id, "privkey"),
        privateKeyBase58,
        optionsForLevel(level)
      ),
    codeForLevel(level)
  )
  await withTimeout(
    () =>
      SecureStore.setItemAsync(
        walletKey(id, "pubkey"),
        publicKeyBase58,
        STANDARD_OPTIONS
      ),
    "STORAGE_ERROR"
  )
  if (mnemonic) {
    await withTimeout(
      () =>
        SecureStore.setItemAsync(
          walletKey(id, "mnemonic"),
          mnemonic,
          optionsForLevel(level)
        ),
      codeForLevel(level)
    )
  }
}

/**
 * Retrieve private key for a specific account (protection decided by the
 * level recorded at write time — #138)
 */
export async function getPrivateKeyForAccount(id: string): Promise<string | null> {
  const level = await getStoredSecurityLevel(id)
  try {
    return await withTimeout(
      () =>
        SecureStore.getItemAsync(
          walletKey(id, "privkey"),
          optionsForLevel(level)
        ),
      codeForLevel(level)
    )
  } catch (error) {
    const mapped = mapSecureReadError(error)
    if (mapped) throw mapped
    return null
  }
}

/**
 * Retrieve mnemonic for a specific account (protection decided by the
 * level recorded at write time — #138)
 */
export async function getMnemonicForAccount(id: string): Promise<string | null> {
  const level = await getStoredSecurityLevel(id)
  try {
    return await withTimeout(
      () =>
        SecureStore.getItemAsync(
          walletKey(id, "mnemonic"),
          optionsForLevel(level)
        ),
      codeForLevel(level)
    )
  } catch (error) {
    const mapped = mapSecureReadError(error)
    if (mapped) throw mapped
    return null
  }
}

/**
 * Delete all stored keys for a specific account (incl. its level flag, so a
 * future wallet with the same id starts with a clean policy)
 */
export async function deleteWalletKeys(id: string): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(walletKey(id, "privkey")),
    SecureStore.deleteItemAsync(walletKey(id, "pubkey")),
    SecureStore.deleteItemAsync(walletKey(id, "mnemonic")),
    SecureStore.deleteItemAsync(levelKey(id)),
  ])
}

/**
 * Explicit upgrade path (#138): re-protect STANDARD keys under biometric
 * auth once the device has an enrollment. Material is rewritten gated first,
 * the level flag flips last. Returns false when the device still cannot
 * authenticate, the wallet doesn't exist, or there is nothing to upgrade;
 * true when already BIOMETRIC or the upgrade succeeded.
 */
export async function upgradeWalletSecurity(id?: string): Promise<boolean> {
  const policy = await resolveKeychainPolicy()
  if (!policy.requireBiometrics) return false

  // Existence check via non-gated metadata only: reading gated material to
  // probe existence would fire a biometric prompt for a possible no-op.
  if (id) {
    const registry = await getWalletRegistry()
    if (!registry.some((e) => e.id === id)) return false
  } else {
    const exists = await SecureStore.getItemAsync(
      STORAGE_KEYS.WALLET_EXISTS,
      STANDARD_OPTIONS
    )
    if (exists !== "true") return false
  }

  const current = await getStoredSecurityLevel(id)
  if (current === "BIOMETRIC") return true

  const privKey = id ? walletKey(id, "privkey") : STORAGE_KEYS.PRIVATE_KEY
  const mnemonicKey = id ? walletKey(id, "mnemonic") : STORAGE_KEYS.MNEMONIC

  const privateKey = await withTimeout(
    () => SecureStore.getItemAsync(privKey, STANDARD_OPTIONS),
    "STORAGE_ERROR"
  )
  if (!privateKey) return false
  const mnemonic = await SecureStore.getItemAsync(mnemonicKey, STANDARD_OPTIONS).catch(
    () => null
  )

  await withTimeout(
    () => SecureStore.setItemAsync(privKey, privateKey, SECURE_OPTIONS),
    "BIOMETRIC_UNAVAILABLE"
  )
  if (mnemonic) {
    await withTimeout(
      () => SecureStore.setItemAsync(mnemonicKey, mnemonic, SECURE_OPTIONS),
      "BIOMETRIC_UNAVAILABLE"
    )
  }
  await writeSecurityLevel("BIOMETRIC", id)
  return true
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
    const legacyLevel = await getStoredSecurityLevel()
    try {
      privateKey = await withTimeout(
        () =>
          SecureStore.getItemAsync(
            STORAGE_KEYS.PRIVATE_KEY,
            optionsForLevel(legacyLevel)
          ),
        codeForLevel(legacyLevel)
      )
    } catch {
      return null
    }
    if (!privateKey) return null

    let mnemonic: string | null = null
    try {
      mnemonic = await withTimeout(
        () =>
          SecureStore.getItemAsync(
            STORAGE_KEYS.MNEMONIC,
            optionsForLevel(legacyLevel)
          ),
        codeForLevel(legacyLevel)
      )
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
