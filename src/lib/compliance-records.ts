/**
 * Compliance Records for Third-Party Privacy Providers
 *
 * When using external privacy providers (ShadowWire, Privacy Cash),
 * we add SIP's viewing key layer on top for compliance.
 *
 * This enables:
 * - Auditors to verify transactions without full access
 * - Institutions to use privacy while maintaining compliance
 * - Selective disclosure of transaction history
 *
 * Records are encrypted with the user's viewing key and stored locally.
 * Only someone with the viewing key can decrypt them.
 *
 * @see https://github.com/sip-protocol/sip-mobile/issues/73
 */

import * as SecureStore from "expo-secure-store"
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js"
import { randomBytes } from "@noble/ciphers/utils.js"
import { sha256 } from "@noble/hashes/sha256"
import { bytesToHex, hexToBytes } from "./stealth"

// ============================================================================
// TYPES
// ============================================================================

export type PrivacyProvider = "sip-native" | "shadowwire" | "privacy-cash" | "magicblock" | "arcium" | "inco" | "cspl"

export interface ComplianceRecord {
  id: string
  provider: PrivacyProvider
  txHash: string
  amount: string
  token: string
  recipient: string
  timestamp: number
  /** Provider-specific metadata */
  metadata?: {
    transferType?: "internal" | "external"
    fee?: string
    poolAddress?: string
    /** MagicBlock TEE validator address */
    teeValidator?: string
    /** MagicBlock auth token expiration */
    authTokenExpires?: number
    /** Arcium computation type */
    computationType?: string
    /** Whether computation was encrypted */
    encrypted?: boolean
    /** Output token for swaps */
    outputToken?: string
    /** Slippage in basis points */
    slippageBps?: number
    /** Program ID used for computation */
    programId?: string
    /** C-SPL encrypted amount flag */
    encryptedAmount?: boolean
    /** C-SPL confidential mint address */
    csplMint?: string
    /** Arcium computation offset (unique ID) */
    computationOffset?: string
    /** Whether Arcium MPC validation was used */
    arciumValidation?: boolean
    /** Jupiter swap transaction signature */
    jupiterSwap?: string
    /** Minimum output amount for swaps */
    minOutput?: string
  }
}

export interface EncryptedComplianceRecord {
  id: string
  /** Encrypted payload (base64) */
  ciphertext: string
  /** Nonce used for encryption (hex) */
  nonce: string
  /** Timestamp for sorting/filtering */
  timestamp: number
  /** Provider (not encrypted, for filtering) */
  provider: PrivacyProvider
}

// ============================================================================
// CONSTANTS
// ============================================================================

const COMPLIANCE_RECORDS_KEY = "sip_compliance_records"
const STEALTH_KEYS_KEY = "sip_stealth_keys"

// ============================================================================
// ENCRYPTION
// ============================================================================

/**
 * Derive encryption key from viewing private key
 * Uses SHA256 to get a 32-byte key suitable for XChaCha20-Poly1305
 */
function deriveEncryptionKey(viewingPrivateKey: string): Uint8Array {
  const keyBytes = hexToBytes(viewingPrivateKey)
  return sha256(keyBytes)
}

/**
 * Encrypt a compliance record with the viewing key
 */
export function encryptRecord(
  record: ComplianceRecord,
  viewingPrivateKey: string
): EncryptedComplianceRecord {
  const key = deriveEncryptionKey(viewingPrivateKey)
  const nonce = randomBytes(24) // XChaCha20 uses 24-byte nonce

  const plaintext = new TextEncoder().encode(JSON.stringify(record))
  const cipher = xchacha20poly1305(key, nonce)
  const ciphertext = cipher.encrypt(plaintext)

  return {
    id: record.id,
    ciphertext: Buffer.from(ciphertext).toString("base64"),
    nonce: bytesToHex(nonce),
    timestamp: record.timestamp,
    provider: record.provider,
  }
}

/**
 * Decrypt a compliance record with the viewing key
 */
export function decryptRecord(
  encrypted: EncryptedComplianceRecord,
  viewingPrivateKey: string
): ComplianceRecord | null {
  try {
    const key = deriveEncryptionKey(viewingPrivateKey)
    const nonce = hexToBytes(encrypted.nonce)
    const ciphertext = Buffer.from(encrypted.ciphertext, "base64")

    const cipher = xchacha20poly1305(key, nonce)
    const plaintext = cipher.decrypt(new Uint8Array(ciphertext))

    return JSON.parse(new TextDecoder().decode(plaintext))
  } catch (err) {
    console.error("Failed to decrypt compliance record:", err)
    return null
  }
}

// ============================================================================
// STORAGE
// ============================================================================

/**
 * Get viewing private key from SecureStore
 */
async function getViewingPrivateKey(): Promise<string | null> {
  try {
    const keysJson = await SecureStore.getItemAsync(STEALTH_KEYS_KEY, {
      requireAuthentication: true,
      authenticationPrompt: "Authenticate to access compliance records",
    })
    if (!keysJson) return null

    const keys = JSON.parse(keysJson)
    return keys.viewingPrivateKey || null
  } catch {
    return null
  }
}

/**
 * Load all encrypted records from storage
 */
async function loadEncryptedRecords(): Promise<EncryptedComplianceRecord[]> {
  try {
    const data = await SecureStore.getItemAsync(COMPLIANCE_RECORDS_KEY)
    if (!data) return []
    return JSON.parse(data)
  } catch {
    return []
  }
}

/**
 * Save encrypted records to storage
 */
async function saveEncryptedRecords(
  records: EncryptedComplianceRecord[]
): Promise<void> {
  await SecureStore.setItemAsync(COMPLIANCE_RECORDS_KEY, JSON.stringify(records))
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Store a compliance record for a third-party provider transfer
 *
 * The record is encrypted with the user's viewing key before storage.
 * Only someone with the viewing key can decrypt and read the details.
 *
 * @param record - The transaction record to store
 * @returns The record ID if successful, null if failed
 */
export async function storeComplianceRecord(
  record: Omit<ComplianceRecord, "id" | "timestamp">
): Promise<string | null> {
  const viewingPrivateKey = await getViewingPrivateKey()
  if (!viewingPrivateKey) {
    console.error("No viewing key available for compliance records")
    return null
  }

  const fullRecord: ComplianceRecord = {
    ...record,
    id: `cr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    timestamp: Date.now(),
  }

  const encrypted = encryptRecord(fullRecord, viewingPrivateKey)

  const existing = await loadEncryptedRecords()
  const updated = [encrypted, ...existing]
  await saveEncryptedRecords(updated)

  return fullRecord.id
}

/**
 * Get all compliance records (decrypted)
 *
 * Requires biometric authentication to access the viewing key.
 *
 * @param provider - Optional filter by provider
 * @returns Decrypted compliance records
 */
export async function getComplianceRecords(
  provider?: PrivacyProvider
): Promise<ComplianceRecord[]> {
  const viewingPrivateKey = await getViewingPrivateKey()
  if (!viewingPrivateKey) {
    return []
  }

  let encrypted = await loadEncryptedRecords()

  // Filter by provider if specified
  if (provider) {
    encrypted = encrypted.filter((r) => r.provider === provider)
  }

  // Decrypt all records
  const decrypted: ComplianceRecord[] = []
  for (const record of encrypted) {
    const plain = decryptRecord(record, viewingPrivateKey)
    if (plain) {
      decrypted.push(plain)
    }
  }

  return decrypted
}

/**
 * Get compliance record by ID
 */
export async function getComplianceRecordById(
  id: string
): Promise<ComplianceRecord | null> {
  const viewingPrivateKey = await getViewingPrivateKey()
  if (!viewingPrivateKey) {
    return null
  }

  const encrypted = await loadEncryptedRecords()
  const record = encrypted.find((r) => r.id === id)
  if (!record) return null

  return decryptRecord(record, viewingPrivateKey)
}

/**
 * Export compliance records for an auditor
 *
 * Returns encrypted records that can be decrypted with the viewing key.
 * The auditor needs the viewing key (shared separately) to read them.
 *
 * @param provider - Optional filter by provider
 * @param startTime - Optional start timestamp filter
 * @param endTime - Optional end timestamp filter
 */
export async function exportComplianceRecords(options?: {
  provider?: PrivacyProvider
  startTime?: number
  endTime?: number
}): Promise<{
  records: EncryptedComplianceRecord[]
  exportedAt: number
  count: number
}> {
  let records = await loadEncryptedRecords()

  // Apply filters
  if (options?.provider) {
    records = records.filter((r) => r.provider === options.provider)
  }
  if (options?.startTime) {
    records = records.filter((r) => r.timestamp >= options.startTime!)
  }
  if (options?.endTime) {
    records = records.filter((r) => r.timestamp <= options.endTime!)
  }

  return {
    records,
    exportedAt: Date.now(),
    count: records.length,
  }
}

/**
 * Clear all compliance records
 * WARNING: This permanently deletes all records
 */
export async function clearComplianceRecords(): Promise<void> {
  await SecureStore.deleteItemAsync(COMPLIANCE_RECORDS_KEY)
}

/**
 * Get compliance record count by provider
 */
export async function getComplianceRecordStats(): Promise<{
  total: number
  byProvider: Record<PrivacyProvider, number>
}> {
  const encrypted = await loadEncryptedRecords()

  const byProvider: Record<PrivacyProvider, number> = {
    "sip-native": 0,
    shadowwire: 0,
    "privacy-cash": 0,
    magicblock: 0,
    arcium: 0,
    inco: 0,
    cspl: 0,
  }

  for (const record of encrypted) {
    byProvider[record.provider]++
  }

  return {
    total: encrypted.length,
    byProvider,
  }
}
