/**
 * Cryptographic Utilities for Shielded Transfers
 *
 * Implements Pedersen commitments, amount encryption, and viewing key hashing
 * for the SIP Privacy program.
 */

import { ed25519 } from "@noble/curves/ed25519"
import { sha256 as nobleSha256 } from "@noble/hashes/sha256"
import { sha512 as nobleSha512 } from "@noble/hashes/sha512"
import nacl from "tweetnacl"
import * as Crypto from "expo-crypto"

// Re-export hash functions to avoid deprecation warnings
const sha256 = (data: Uint8Array): Uint8Array => nobleSha256(data)
const sha512 = (data: Uint8Array): Uint8Array => nobleSha512(data)

// ─── Constants ─────────────────────────────────────────────────────────────

// Pedersen commitment generator point H (derived from SHA256 of "SIP-H-GENERATOR")
const H_GENERATOR_SEED = new Uint8Array([
  0x53, 0x49, 0x50, 0x2d, 0x48, 0x2d, 0x47, 0x45,
  0x4e, 0x45, 0x52, 0x41, 0x54, 0x4f, 0x52, 0x00, // "SIP-H-GENERATOR\0"
])

// ed25519 curve order
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
 * Generate cryptographically secure random bytes
 */
async function randomBytes(length: number): Promise<Uint8Array> {
  const bytes = await Crypto.getRandomBytesAsync(length)
  return new Uint8Array(bytes)
}

// ─── Pedersen Commitments ──────────────────────────────────────────────────

/**
 * Generate the H generator point for Pedersen commitments
 * This is a nothing-up-my-sleeve point derived from a hash
 */
function getHGenerator(): InstanceType<typeof ed25519.ExtendedPoint> {
  // Hash the seed multiple times to get a valid point
  let hash = sha256(H_GENERATOR_SEED)
  for (let i = 0; i < 100; i++) {
    try {
      // Try to create a valid point from the hash
      const point = ed25519.ExtendedPoint.fromHex(hash)
      return point
    } catch {
      // Not a valid point, hash again
      hash = sha256(hash)
    }
  }
  // Fallback: use a scalar multiplication of base point
  const scalar = bytesToBigInt(sha256(H_GENERATOR_SEED)) % ED25519_ORDER
  return ed25519.ExtendedPoint.BASE.multiply(scalar)
}

export interface PedersenCommitment {
  commitment: Uint8Array // 33 bytes (compressed point with prefix)
  blindingFactor: Uint8Array // 32 bytes
}

/**
 * Create a Pedersen commitment: C = value * G + blinding * H
 *
 * @param value - The amount in lamports
 * @returns Commitment and blinding factor
 */
export async function createCommitment(value: bigint): Promise<PedersenCommitment> {
  // Generate random blinding factor
  const blindingBytes = await randomBytes(32)
  const blinding = bytesToBigInt(blindingBytes) % ED25519_ORDER

  // C = value * G + blinding * H
  const G = ed25519.ExtendedPoint.BASE
  const H = getHGenerator()

  const valuePoint = G.multiply(value % ED25519_ORDER)
  const blindingPoint = H.multiply(blinding)
  const commitmentPoint = valuePoint.add(blindingPoint)

  // Serialize as compressed point (33 bytes: 1 byte prefix + 32 bytes)
  const rawBytes = commitmentPoint.toRawBytes()
  const commitment = new Uint8Array(33)
  // Use 0x02 or 0x03 prefix based on y-coordinate parity (simulated for ed25519)
  commitment[0] = 0x02
  commitment.set(rawBytes, 1)

  return {
    commitment,
    blindingFactor: bigIntToBytes(blinding, 32),
  }
}

// ─── Amount Encryption ─────────────────────────────────────────────────────

export interface EncryptedAmount {
  ciphertext: Uint8Array
  nonce: Uint8Array
}

/**
 * Encrypt amount using NaCl secretbox (XSalsa20-Poly1305)
 *
 * @param amount - Amount in lamports
 * @param sharedSecret - 32-byte shared secret (from ECDH)
 * @returns Encrypted amount with nonce
 */
export async function encryptAmount(
  amount: bigint,
  sharedSecret: Uint8Array
): Promise<EncryptedAmount> {
  // Derive encryption key from shared secret (NaCl secretbox uses 32-byte keys)
  const encryptionKey = sha256(sharedSecret)

  // Generate random nonce (24 bytes for XSalsa20)
  const nonce = await randomBytes(nacl.secretbox.nonceLength)

  // Encode amount as 8-byte little-endian
  const amountBytes = bigIntToBytes(amount, 8)

  // Encrypt with NaCl secretbox
  const ciphertext = nacl.secretbox(amountBytes, nonce, encryptionKey)

  return {
    ciphertext: new Uint8Array(ciphertext),
    nonce,
  }
}

/**
 * Decrypt amount using NaCl secretbox (XSalsa20-Poly1305)
 *
 * @param encrypted - Encrypted amount with nonce
 * @param sharedSecret - 32-byte shared secret
 * @returns Decrypted amount in lamports
 */
export function decryptAmount(
  encrypted: EncryptedAmount,
  sharedSecret: Uint8Array
): bigint {
  // Derive encryption key from shared secret
  const encryptionKey = sha256(sharedSecret)

  // Decrypt with NaCl secretbox
  const plaintext = nacl.secretbox.open(
    encrypted.ciphertext,
    encrypted.nonce,
    encryptionKey
  )

  if (!plaintext) {
    throw new Error("Decryption failed - invalid ciphertext or key")
  }

  // Decode amount from 8-byte little-endian
  return bytesToBigInt(plaintext)
}

// ─── Viewing Key Hash ──────────────────────────────────────────────────────

/**
 * Compute viewing key hash for the transfer record
 *
 * @param viewingKey - Public viewing key (32 bytes)
 * @returns 32-byte hash
 */
export function computeViewingKeyHash(viewingKey: Uint8Array): Uint8Array {
  return sha256(viewingKey)
}

// ─── Shared Secret Derivation ──────────────────────────────────────────────

/**
 * Derive shared secret from ephemeral private key and recipient's spending public key
 *
 * @param ephemeralPrivateKey - 32-byte ephemeral private key
 * @param recipientSpendingPubKey - Recipient's spending public key
 * @returns 32-byte shared secret
 */
export function deriveSharedSecret(
  ephemeralPrivateKey: Uint8Array,
  recipientSpendingPubKey: Uint8Array
): Uint8Array {
  // Derive scalar from private key
  // IMPORTANT: ed25519 uses SHA512, not SHA256! (RFC 8032)
  const hash = sha512(ephemeralPrivateKey)
  const scalar = new Uint8Array(32)
  scalar.set(hash.slice(0, 32))
  // Clamp as per ed25519 spec
  scalar[0] &= 248
  scalar[31] &= 127
  scalar[31] |= 64

  const scalarBigInt = bytesToBigInt(scalar) % ED25519_ORDER

  // Compute shared secret point
  const recipientPoint = ed25519.ExtendedPoint.fromHex(recipientSpendingPubKey)
  const sharedPoint = recipientPoint.multiply(scalarBigInt)

  // Hash the shared point to get the shared secret
  return sha256(sharedPoint.toRawBytes())
}

// ─── Mock ZK Proof ─────────────────────────────────────────────────────────

/**
 * Generate a mock ZK proof for the shielded transfer
 *
 * KNOWN LIMITATION: Mock proof — real Noir/Barretenberg proofs planned for M19-M21.
 * The Solana program currently accepts this format for development.
 *
 * @param commitment - The Pedersen commitment
 * @param blindingFactor - The blinding factor
 * @param amount - The actual amount
 * @returns Mock proof bytes
 */
export async function generateMockProof(
  commitment: Uint8Array,
  blindingFactor: Uint8Array,
  amount: bigint
): Promise<Uint8Array> {
  // Mock proof format: hash of (commitment || blinding || amount)
  // Real implementation would use Noir circuits

  const amountBytes = bigIntToBytes(amount, 8)
  const preimage = new Uint8Array(commitment.length + blindingFactor.length + 8)
  preimage.set(commitment, 0)
  preimage.set(blindingFactor, commitment.length)
  preimage.set(amountBytes, commitment.length + blindingFactor.length)

  // Generate a deterministic mock proof
  const proofHash = sha256(preimage)

  // Pad to minimum proof size expected by program
  const mockProof = new Uint8Array(128)
  mockProof.set(proofHash, 0)
  mockProof.set(sha256(proofHash), 32)
  mockProof.set(sha256(sha256(proofHash)), 64)
  mockProof.set(sha256(sha256(sha256(proofHash))), 96)

  return mockProof
}

// ─── Ephemeral Key Generation ──────────────────────────────────────────────

export interface EphemeralKeyPair {
  privateKey: Uint8Array
  publicKey: Uint8Array // 33 bytes (compressed format)
}

/**
 * Generate an ephemeral keypair for the shielded transfer
 *
 * @returns Ephemeral keypair with compressed public key
 */
export async function generateEphemeralKeyPair(): Promise<EphemeralKeyPair> {
  const privateKey = await randomBytes(32)
  const publicKeyRaw = ed25519.getPublicKey(privateKey)

  // Convert to 33-byte compressed format (0x02/0x03 prefix + 32 bytes)
  const publicKey = new Uint8Array(33)
  publicKey[0] = 0x02 // Even y-coordinate prefix (simulated)
  publicKey.set(publicKeyRaw, 1)

  return {
    privateKey,
    publicKey,
  }
}
