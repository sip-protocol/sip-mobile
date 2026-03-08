/**
 * Stealth Address Implementation for SIP Mobile
 *
 * Implements DKSAP (Dual-Key Stealth Address Protocol) for ed25519 curves.
 * Compatible with Solana chain using @noble/curves and expo-crypto.
 *
 * Based on @sip-protocol/sdk but adapted for React Native.
 */

import { ed25519 } from "@noble/curves/ed25519"
import { sha256 } from "@noble/hashes/sha256"
import { sha512 } from "@noble/hashes/sha512"
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js"
import { randomBytes } from "@noble/ciphers/utils.js"
import * as Crypto from "expo-crypto"
import bs58 from "bs58"
import { debug } from "@/utils/logger"

// ─── Types ─────────────────────────────────────────────────────────────────

export interface StealthMetaAddress {
  spendingKey: string // hex string with 0x prefix
  viewingKey: string // hex string with 0x prefix
  chain: string
  label?: string
}

export interface StealthAddress {
  address: string // hex string with 0x prefix
  ephemeralPublicKey: string // hex string with 0x prefix
  viewTag: number
}

export interface StealthKeys {
  spendingPrivateKey: string
  spendingPublicKey: string
  viewingPrivateKey: string
  viewingPublicKey: string
}

// ─── Constants ─────────────────────────────────────────────────────────────

// ed25519 curve order (L)
const ED25519_ORDER = BigInt(
  "0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed"
)

// ─── Utilities ─────────────────────────────────────────────────────────────

/**
 * Convert bytes to hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/**
 * Convert hex string to bytes
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex
  const bytes = new Uint8Array(cleanHex.length / 2)
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.slice(i, i + 2), 16)
  }
  return bytes
}

/**
 * Convert bytes to BigInt (little-endian)
 */
function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = 0n
  for (let i = bytes.length - 1; i >= 0; i--) {
    result = (result << 8n) | BigInt(bytes[i])
  }
  return result
}

/**
 * Convert BigInt to bytes (little-endian)
 */
function bigIntToBytes(n: bigint, length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  for (let i = 0; i < length; i++) {
    bytes[i] = Number(n & 0xffn)
    n >>= 8n
  }
  return bytes
}

/**
 * Get ed25519 scalar from private key
 * This follows the ed25519 key derivation specification (RFC 8032)
 * IMPORTANT: ed25519 uses SHA512, not SHA256!
 */
function getEd25519Scalar(privateKey: Uint8Array): bigint {
  // Hash the private key seed with SHA512 (ed25519 spec requirement)
  const h = sha512(privateKey)
  // Take first 32 bytes (SHA512 outputs 64 bytes)
  const scalar = new Uint8Array(h.slice(0, 32))
  // Clamp as per ed25519 spec
  scalar[0] &= 248
  scalar[31] &= 127
  scalar[31] |= 64
  return bytesToBigInt(scalar)
}

/**
 * Generate cryptographically secure random bytes using expo-crypto
 */
async function generateRandomBytes(length: number): Promise<Uint8Array> {
  const randomBytes = await Crypto.getRandomBytesAsync(length)
  return new Uint8Array(randomBytes)
}

// ─── Stealth Meta-Address Generation ───────────────────────────────────────

/**
 * Generate a new ed25519 stealth meta-address keypair
 *
 * @param chain - Target chain (default: "solana")
 * @param label - Optional human-readable label
 * @returns Stealth meta-address and private keys
 */
export async function generateStealthMetaAddress(
  chain: string = "solana",
  label?: string
): Promise<{
  metaAddress: StealthMetaAddress
  spendingPrivateKey: string
  viewingPrivateKey: string
}> {
  // Generate random private keys (32-byte seeds)
  const spendingPrivateKey = await generateRandomBytes(32)
  const viewingPrivateKey = await generateRandomBytes(32)

  // Derive public keys using ed25519
  const spendingKey = ed25519.getPublicKey(spendingPrivateKey)
  const viewingKey = ed25519.getPublicKey(viewingPrivateKey)

  return {
    metaAddress: {
      spendingKey: `0x${bytesToHex(spendingKey)}`,
      viewingKey: `0x${bytesToHex(viewingKey)}`,
      chain,
      label,
    },
    spendingPrivateKey: `0x${bytesToHex(spendingPrivateKey)}`,
    viewingPrivateKey: `0x${bytesToHex(viewingPrivateKey)}`,
  }
}

/**
 * Generate stealth keys in a format compatible with the useStealth hook
 */
export async function generateStealthKeys(): Promise<StealthKeys> {
  const { metaAddress, spendingPrivateKey, viewingPrivateKey } =
    await generateStealthMetaAddress("solana")

  return {
    spendingPrivateKey,
    spendingPublicKey: metaAddress.spendingKey,
    viewingPrivateKey,
    viewingPublicKey: metaAddress.viewingKey,
  }
}

// ─── Stealth Address Generation ────────────────────────────────────────────

/**
 * Generate a one-time stealth address for a recipient
 *
 * Algorithm (DKSAP for ed25519):
 * 1. Generate ephemeral keypair (r, R = r*G)
 * 2. Compute shared secret: S = r * P_spend (ephemeral scalar * spending public)
 * 3. Hash shared secret: h = SHA256(S)
 * 4. Derive stealth public key: P_stealth = P_view + h*G
 */
export async function generateStealthAddress(
  recipientMetaAddress: StealthMetaAddress
): Promise<{
  stealthAddress: StealthAddress
  sharedSecret: string
  ephemeralPrivateKey: string
}> {
  // Generate ephemeral keypair
  const ephemeralPrivateKey = await generateRandomBytes(32)
  const ephemeralPublicKey = ed25519.getPublicKey(ephemeralPrivateKey)

  // Parse recipient's keys (remove 0x prefix)
  const spendingKeyBytes = hexToBytes(recipientMetaAddress.spendingKey)
  const viewingKeyBytes = hexToBytes(recipientMetaAddress.viewingKey)

  // Get ephemeral scalar from private key and reduce mod L
  const rawEphemeralScalar = getEd25519Scalar(ephemeralPrivateKey)
  const ephemeralScalar = rawEphemeralScalar % ED25519_ORDER

  // S = ephemeral_scalar * P_spend
  const spendingPoint = ed25519.ExtendedPoint.fromHex(spendingKeyBytes)
  const sharedSecretPoint = spendingPoint.multiply(ephemeralScalar)

  // Hash the shared secret point
  const sharedSecretHash = sha256(sharedSecretPoint.toRawBytes())

  // Derive stealth public key: P_stealth = P_view + hash(S)*G
  const hashScalar = bytesToBigInt(sharedSecretHash) % ED25519_ORDER

  // Compute hash(S) * G
  const hashTimesG = ed25519.ExtendedPoint.BASE.multiply(hashScalar)

  // Add to viewing key: P_stealth = P_view + hash(S)*G
  const viewingPoint = ed25519.ExtendedPoint.fromHex(viewingKeyBytes)
  const stealthPoint = viewingPoint.add(hashTimesG)
  const stealthAddressBytes = stealthPoint.toRawBytes()

  // Compute view tag (first byte of shared secret hash)
  const viewTag = sharedSecretHash[0]

  return {
    stealthAddress: {
      address: `0x${bytesToHex(stealthAddressBytes)}`,
      ephemeralPublicKey: `0x${bytesToHex(ephemeralPublicKey)}`,
      viewTag,
    },
    sharedSecret: `0x${bytesToHex(sharedSecretHash)}`,
    ephemeralPrivateKey: `0x${bytesToHex(ephemeralPrivateKey)}`,
  }
}

// ─── Stealth Address Checking ──────────────────────────────────────────────

/**
 * Check if a stealth address was intended for this recipient (using view tag)
 */
export function checkStealthAddress(
  stealthAddress: StealthAddress,
  spendingPrivateKey: string,
  viewingPrivateKey: string
): boolean {
  const spendingPrivBytes = hexToBytes(spendingPrivateKey)
  const viewingPrivBytes = hexToBytes(viewingPrivateKey)
  const ephemeralPubBytes = hexToBytes(stealthAddress.ephemeralPublicKey)

  debug("[checkStealth] Ephemeral pubkey bytes:", ephemeralPubBytes.length)
  debug("[checkStealth] Expected viewTag:", stealthAddress.viewTag)

  // Get spending scalar and reduce mod L
  const rawSpendingScalar = getEd25519Scalar(spendingPrivBytes)
  const spendingScalar = rawSpendingScalar % ED25519_ORDER

  // Compute shared secret: S = spending_scalar * R
  const ephemeralPoint = ed25519.ExtendedPoint.fromHex(ephemeralPubBytes)
  const sharedSecretPoint = ephemeralPoint.multiply(spendingScalar)

  // Hash the shared secret
  const sharedSecretHash = sha256(sharedSecretPoint.toRawBytes())

  debug("[checkStealth] Computed viewTag:", sharedSecretHash[0])

  // View tag check
  if (sharedSecretHash[0] !== stealthAddress.viewTag) {
    debug("[checkStealth] View tag MISMATCH!")
    return false
  }

  // Full check
  const rawViewingScalar = getEd25519Scalar(viewingPrivBytes)
  const viewingScalar = rawViewingScalar % ED25519_ORDER

  const hashScalar = bytesToBigInt(sharedSecretHash) % ED25519_ORDER
  const stealthPrivateScalar = (viewingScalar + hashScalar) % ED25519_ORDER

  // Compute expected public key from derived scalar
  const expectedPubKey = ed25519.ExtendedPoint.BASE.multiply(stealthPrivateScalar)
  const expectedPubKeyBytes = expectedPubKey.toRawBytes()

  // Compare with provided stealth address
  const providedAddress = hexToBytes(stealthAddress.address)

  const expected = bytesToHex(expectedPubKeyBytes)
  const provided = bytesToHex(providedAddress)
  debug("[checkStealth] Expected:", expected.slice(0, 16) + "...")
  debug("[checkStealth] Provided:", provided.slice(0, 16) + "...")
  debug("[checkStealth] Match:", expected === provided)

  return expected === provided
}

// ─── Private Key Derivation ────────────────────────────────────────────────

/**
 * Derive the private key for a stealth address
 *
 * The returned private key is a raw scalar in little-endian format.
 */
export function deriveStealthPrivateKey(
  stealthAddress: StealthAddress,
  spendingPrivateKey: string,
  viewingPrivateKey: string
): string {
  const spendingPrivBytes = hexToBytes(spendingPrivateKey)
  const viewingPrivBytes = hexToBytes(viewingPrivateKey)
  const ephemeralPubBytes = hexToBytes(stealthAddress.ephemeralPublicKey)

  // Get spending scalar and reduce mod L
  const rawSpendingScalar = getEd25519Scalar(spendingPrivBytes)
  const spendingScalar = rawSpendingScalar % ED25519_ORDER

  // Compute shared secret: S = spending_scalar * R
  const ephemeralPoint = ed25519.ExtendedPoint.fromHex(ephemeralPubBytes)
  const sharedSecretPoint = ephemeralPoint.multiply(spendingScalar)

  // Hash the shared secret
  const sharedSecretHash = sha256(sharedSecretPoint.toRawBytes())

  // Get viewing scalar and reduce mod L
  const rawViewingScalar = getEd25519Scalar(viewingPrivBytes)
  const viewingScalar = rawViewingScalar % ED25519_ORDER

  // Derive stealth private key: s_stealth = s_view + hash(S) mod L
  const hashScalar = bytesToBigInt(sharedSecretHash) % ED25519_ORDER
  const stealthPrivateScalar = (viewingScalar + hashScalar) % ED25519_ORDER

  // Convert to bytes (little-endian for ed25519)
  const stealthPrivateKey = bigIntToBytes(stealthPrivateScalar, 32)

  return `0x${bytesToHex(stealthPrivateKey)}`
}

// ─── Address Format Utilities ──────────────────────────────────────────────

/**
 * Format a stealth meta-address for display
 * Format: sip:<chain>:<spendingKey>:<viewingKey>
 *
 * For Solana, keys are encoded in base58.
 * For EVM chains, keys use 0x hex prefix.
 */
export function formatStealthMetaAddress(metaAddress: StealthMetaAddress): string {
  const { chain, spendingKey, viewingKey } = metaAddress

  // Use base58 for Solana, hex for EVM
  if (chain === "solana") {
    const spendingBase58 = bs58.encode(hexToBytes(spendingKey))
    const viewingBase58 = bs58.encode(hexToBytes(viewingKey))
    return `sip:${chain}:${spendingBase58}:${viewingBase58}`
  }

  // EVM chains use hex with 0x prefix
  return `sip:${chain}:${spendingKey}:${viewingKey}`
}

/**
 * Parse a stealth meta-address string
 *
 * For Solana, keys are base58 encoded.
 * For EVM chains, keys are hex with 0x prefix.
 */
export function parseStealthMetaAddress(addressStr: string): StealthMetaAddress | null {
  if (!addressStr.startsWith("sip:")) {
    return null
  }

  const parts = addressStr.slice(4).split(":")
  if (parts.length !== 3) {
    return null
  }

  const [chain, spendingKey, viewingKey] = parts

  // Convert base58 to hex for Solana
  if (chain === "solana") {
    try {
      const spendingHex = `0x${bytesToHex(bs58.decode(spendingKey))}`
      const viewingHex = `0x${bytesToHex(bs58.decode(viewingKey))}`
      return {
        chain,
        spendingKey: spendingHex,
        viewingKey: viewingHex,
      }
    } catch {
      return null
    }
  }

  // EVM chains already have hex keys
  return {
    chain,
    spendingKey,
    viewingKey,
  }
}

/**
 * Convert ed25519 public key to Solana address (base58)
 */
export function ed25519PublicKeyToSolanaAddress(publicKey: string): string {
  const bytes = hexToBytes(publicKey)
  return bs58.encode(bytes)
}

/**
 * Convert Solana address (base58) to ed25519 public key hex
 */
export function solanaAddressToEd25519PublicKey(address: string): string {
  const bytes = bs58.decode(address)
  return `0x${bytesToHex(bytes)}`
}

/**
 * Validate a Solana address
 */
export function isValidSolanaAddress(address: string): boolean {
  try {
    const decoded = bs58.decode(address)
    return decoded.length === 32
  } catch {
    return false
  }
}

// ─── Backup Encryption ──────────────────────────────────────────────────────

const BACKUP_SALT = "sip-stealth-backup"

/**
 * Derive a 32-byte encryption key from a seed phrase
 * Uses SHA-256(seed_bytes || salt_bytes)
 */
export function deriveBackupKey(seedPhrase: string): Uint8Array {
  const encoder = new TextEncoder()
  const seedBytes = encoder.encode(seedPhrase)
  const saltBytes = encoder.encode(BACKUP_SALT)
  const combined = new Uint8Array(seedBytes.length + saltBytes.length)
  combined.set(seedBytes)
  combined.set(saltBytes, seedBytes.length)
  return sha256(combined)
}

/**
 * Encrypt stealth keys storage JSON for backup
 *
 * Uses XChaCha20-Poly1305 with a seed-derived key.
 * Returns base64-encoded string (24-byte nonce prepended to ciphertext).
 */
export function encryptStealthBackup(storageJson: string, seedPhrase: string): string {
  const key = deriveBackupKey(seedPhrase)
  const nonce = randomBytes(24)
  const plaintext = new TextEncoder().encode(storageJson)
  const cipher = xchacha20poly1305(key, nonce)
  const ciphertext = cipher.encrypt(plaintext)
  const out = new Uint8Array(nonce.length + ciphertext.length)
  out.set(nonce)
  out.set(ciphertext, nonce.length)
  return Buffer.from(out).toString("base64")
}

/**
 * Decrypt a stealth keys backup
 *
 * Returns the decrypted JSON string, or null if decryption fails
 * (wrong seed, corrupted data, tampered ciphertext).
 */
export function decryptStealthBackup(encoded: string, seedPhrase: string): string | null {
  try {
    const key = deriveBackupKey(seedPhrase)
    const combined = new Uint8Array(Buffer.from(encoded, "base64"))
    if (combined.length < 25) return null
    const nonce = combined.slice(0, 24)
    const ciphertext = combined.slice(24)
    const cipher = xchacha20poly1305(key, nonce)
    const plaintext = cipher.decrypt(ciphertext)
    return new TextDecoder().decode(plaintext)
  } catch {
    return null
  }
}
