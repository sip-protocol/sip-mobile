/**
 * Anchor Crypto Tests
 *
 * Tests for cryptographic utilities used in shielded transfers:
 * - Pedersen commitments
 * - Amount encryption/decryption
 * - Viewing key hashing
 * - Shared secret derivation
 * - Ephemeral key generation
 */

import { describe, it, expect, vi } from "vitest"

// Mock expo-crypto
vi.mock("expo-crypto", () => ({
  getRandomBytesAsync: vi.fn().mockImplementation((length: number) => {
    // Return predictable "random" bytes for testing
    const bytes = new Uint8Array(length)
    for (let i = 0; i < length; i++) {
      bytes[i] = (i * 7 + 13) % 256
    }
    return Promise.resolve(bytes)
  }),
}))

import {
  bytesToHex,
  hexToBytes,
  createCommitment,
  encryptAmount,
  decryptAmount,
  computeViewingKeyHash,
  deriveSharedSecret,
  generateMockProof,
  generateEphemeralKeyPair,
} from "@/lib/anchor/crypto"

describe("Anchor Crypto Utilities", () => {
  describe("bytesToHex", () => {
    it("should convert empty array to empty string", () => {
      expect(bytesToHex(new Uint8Array([]))).toBe("")
    })

    it("should convert single byte correctly", () => {
      expect(bytesToHex(new Uint8Array([0]))).toBe("00")
      expect(bytesToHex(new Uint8Array([255]))).toBe("ff")
      expect(bytesToHex(new Uint8Array([15]))).toBe("0f")
      expect(bytesToHex(new Uint8Array([16]))).toBe("10")
    })

    it("should convert multiple bytes correctly", () => {
      expect(bytesToHex(new Uint8Array([1, 2, 3]))).toBe("010203")
      expect(bytesToHex(new Uint8Array([255, 0, 128]))).toBe("ff0080")
      expect(bytesToHex(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))).toBe("deadbeef")
    })

    it("should handle 32-byte keys", () => {
      const key = new Uint8Array(32).fill(0xab)
      const hex = bytesToHex(key)
      expect(hex.length).toBe(64)
      expect(hex).toBe("ab".repeat(32))
    })
  })

  describe("hexToBytes", () => {
    it("should convert empty string to empty array", () => {
      expect(hexToBytes("")).toEqual(new Uint8Array([]))
    })

    it("should handle 0x prefix", () => {
      expect(hexToBytes("0x0102")).toEqual(new Uint8Array([1, 2]))
      expect(hexToBytes("0xdeadbeef")).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))
    })

    it("should handle hex without prefix", () => {
      expect(hexToBytes("010203")).toEqual(new Uint8Array([1, 2, 3]))
      expect(hexToBytes("ff00")).toEqual(new Uint8Array([255, 0]))
    })

    it("should be inverse of bytesToHex", () => {
      const original = new Uint8Array([1, 2, 3, 255, 0, 128])
      const hex = bytesToHex(original)
      const roundTrip = hexToBytes(hex)
      expect(roundTrip).toEqual(original)
    })

    it("should handle 32-byte keys", () => {
      const hex = "ab".repeat(32)
      const bytes = hexToBytes(hex)
      expect(bytes.length).toBe(32)
      expect(bytes.every((b) => b === 0xab)).toBe(true)
    })
  })

  describe("createCommitment", () => {
    it("should create commitment with correct structure", async () => {
      const result = await createCommitment(1000000n) // 0.001 SOL

      expect(result.commitment).toBeInstanceOf(Uint8Array)
      expect(result.commitment.length).toBe(33) // Compressed point
      expect(result.blindingFactor).toBeInstanceOf(Uint8Array)
      expect(result.blindingFactor.length).toBe(32)
    })

    it("should create commitment starting with 0x02 prefix", async () => {
      const result = await createCommitment(5000000n)
      expect(result.commitment[0]).toBe(0x02)
    })

    it("should create different commitments for same value", async () => {
      // Reset mock to use different random bytes
      const expoCrypto = await import("expo-crypto")
      let callCount = 0
      vi.mocked(expoCrypto.getRandomBytesAsync).mockImplementation((length: number) => {
        callCount++
        const bytes = new Uint8Array(length)
        for (let i = 0; i < length; i++) {
          bytes[i] = (i * 7 + 13 + callCount * 31) % 256
        }
        return Promise.resolve(bytes)
      })

      const result1 = await createCommitment(1000n)
      const result2 = await createCommitment(1000n)

      // Blinding factors should be different
      expect(bytesToHex(result1.blindingFactor)).not.toBe(bytesToHex(result2.blindingFactor))
    })

    it("should handle minimum value (1 lamport)", async () => {
      // Note: ed25519 scalar multiply doesn't accept 0
      const result = await createCommitment(1n)
      expect(result.commitment.length).toBe(33)
      expect(result.blindingFactor.length).toBe(32)
    })

    it("should handle large values", async () => {
      const largeValue = BigInt("18446744073709551615") // max u64
      const result = await createCommitment(largeValue)
      expect(result.commitment.length).toBe(33)
    })
  })

  describe("encryptAmount / decryptAmount", () => {
    const sharedSecret = new Uint8Array(32).fill(0x42)

    it("should encrypt and decrypt correctly", async () => {
      const amount = 1000000000n // 1 SOL in lamports

      const encrypted = await encryptAmount(amount, sharedSecret)
      const decrypted = decryptAmount(encrypted, sharedSecret)

      expect(decrypted).toBe(amount)
    })

    it("should produce ciphertext with nonce", async () => {
      const encrypted = await encryptAmount(5000000n, sharedSecret)

      expect(encrypted.ciphertext).toBeInstanceOf(Uint8Array)
      expect(encrypted.nonce).toBeInstanceOf(Uint8Array)
      expect(encrypted.nonce.length).toBe(24) // XSalsa20 nonce
    })

    it("should encrypt zero amount", async () => {
      const encrypted = await encryptAmount(0n, sharedSecret)
      const decrypted = decryptAmount(encrypted, sharedSecret)
      expect(decrypted).toBe(0n)
    })

    it("should encrypt max u64 amount", async () => {
      const maxAmount = BigInt("18446744073709551615")
      const encrypted = await encryptAmount(maxAmount, sharedSecret)
      const decrypted = decryptAmount(encrypted, sharedSecret)
      expect(decrypted).toBe(maxAmount)
    })

    it("should fail decryption with wrong key", async () => {
      const wrongSecret = new Uint8Array(32).fill(0x99)
      const encrypted = await encryptAmount(1000n, sharedSecret)

      expect(() => decryptAmount(encrypted, wrongSecret)).toThrow(
        "Decryption failed"
      )
    })

    it("should fail decryption with corrupted ciphertext", async () => {
      const encrypted = await encryptAmount(1000n, sharedSecret)

      // Corrupt the ciphertext
      encrypted.ciphertext[0] ^= 0xff

      expect(() => decryptAmount(encrypted, sharedSecret)).toThrow(
        "Decryption failed"
      )
    })

    it("should fail decryption with corrupted nonce", async () => {
      const encrypted = await encryptAmount(1000n, sharedSecret)

      // Corrupt the nonce
      encrypted.nonce[0] ^= 0xff

      expect(() => decryptAmount(encrypted, sharedSecret)).toThrow(
        "Decryption failed"
      )
    })
  })

  describe("computeViewingKeyHash", () => {
    it("should return 32-byte hash", () => {
      const viewingKey = new Uint8Array(32).fill(0xaa)
      const hash = computeViewingKeyHash(viewingKey)

      expect(hash).toBeInstanceOf(Uint8Array)
      expect(hash.length).toBe(32)
    })

    it("should be deterministic", () => {
      const viewingKey = new Uint8Array(32).fill(0xbb)
      const hash1 = computeViewingKeyHash(viewingKey)
      const hash2 = computeViewingKeyHash(viewingKey)

      expect(bytesToHex(hash1)).toBe(bytesToHex(hash2))
    })

    it("should produce different hashes for different keys", () => {
      const key1 = new Uint8Array(32).fill(0x01)
      const key2 = new Uint8Array(32).fill(0x02)

      const hash1 = computeViewingKeyHash(key1)
      const hash2 = computeViewingKeyHash(key2)

      expect(bytesToHex(hash1)).not.toBe(bytesToHex(hash2))
    })

    it("should hash empty viewing key", () => {
      const emptyKey = new Uint8Array(32).fill(0)
      const hash = computeViewingKeyHash(emptyKey)

      expect(hash.length).toBe(32)
    })
  })

  describe("deriveSharedSecret", () => {
    it("should derive 32-byte shared secret", () => {
      // Use actual ed25519 keys for this test
      const { ed25519 } = require("@noble/curves/ed25519.js")
      const privateKey = new Uint8Array(32).fill(0x42)
      const publicKeyRaw = ed25519.getPublicKey(privateKey)

      const sharedSecret = deriveSharedSecret(privateKey, publicKeyRaw)

      expect(sharedSecret).toBeInstanceOf(Uint8Array)
      expect(sharedSecret.length).toBe(32)
    })

    it("should be deterministic for same inputs", () => {
      const { ed25519 } = require("@noble/curves/ed25519.js")
      const privateKey = new Uint8Array(32).fill(0x55)
      const publicKeyRaw = ed25519.getPublicKey(new Uint8Array(32).fill(0x66))

      const secret1 = deriveSharedSecret(privateKey, publicKeyRaw)
      const secret2 = deriveSharedSecret(privateKey, publicKeyRaw)

      expect(bytesToHex(secret1)).toBe(bytesToHex(secret2))
    })

    it("should produce different secrets for different keys", () => {
      const { ed25519 } = require("@noble/curves/ed25519.js")
      const privateKey1 = new Uint8Array(32).fill(0x11)
      const privateKey2 = new Uint8Array(32).fill(0x22)
      const publicKeyRaw = ed25519.getPublicKey(new Uint8Array(32).fill(0x33))

      const secret1 = deriveSharedSecret(privateKey1, publicKeyRaw)
      const secret2 = deriveSharedSecret(privateKey2, publicKeyRaw)

      expect(bytesToHex(secret1)).not.toBe(bytesToHex(secret2))
    })
  })

  describe("generateMockProof", () => {
    it("should generate 128-byte proof", async () => {
      const commitment = new Uint8Array(33).fill(0x11)
      const blindingFactor = new Uint8Array(32).fill(0x22)
      const amount = 1000000n

      const proof = await generateMockProof(commitment, blindingFactor, amount)

      expect(proof).toBeInstanceOf(Uint8Array)
      expect(proof.length).toBe(128)
    })

    it("should be deterministic for same inputs", async () => {
      const commitment = new Uint8Array(33).fill(0xaa)
      const blindingFactor = new Uint8Array(32).fill(0xbb)
      const amount = 5000000n

      const proof1 = await generateMockProof(commitment, blindingFactor, amount)
      const proof2 = await generateMockProof(commitment, blindingFactor, amount)

      expect(bytesToHex(proof1)).toBe(bytesToHex(proof2))
    })

    it("should produce different proofs for different amounts", async () => {
      const commitment = new Uint8Array(33).fill(0xcc)
      const blindingFactor = new Uint8Array(32).fill(0xdd)

      const proof1 = await generateMockProof(commitment, blindingFactor, 1000n)
      const proof2 = await generateMockProof(commitment, blindingFactor, 2000n)

      expect(bytesToHex(proof1)).not.toBe(bytesToHex(proof2))
    })

    it("should handle zero amount", async () => {
      const commitment = new Uint8Array(33).fill(0x01)
      const blindingFactor = new Uint8Array(32).fill(0x02)

      const proof = await generateMockProof(commitment, blindingFactor, 0n)
      expect(proof.length).toBe(128)
    })
  })

  describe("generateEphemeralKeyPair", () => {
    it("should generate keypair with correct sizes", async () => {
      const keyPair = await generateEphemeralKeyPair()

      expect(keyPair.privateKey).toBeInstanceOf(Uint8Array)
      expect(keyPair.privateKey.length).toBe(32)
      expect(keyPair.publicKey).toBeInstanceOf(Uint8Array)
      expect(keyPair.publicKey.length).toBe(33) // Compressed format
    })

    it("should generate public key with 0x02 prefix", async () => {
      const keyPair = await generateEphemeralKeyPair()
      expect(keyPair.publicKey[0]).toBe(0x02)
    })

    it("should generate valid ed25519 keypair", async () => {
      const { ed25519 } = require("@noble/curves/ed25519.js")
      const keyPair = await generateEphemeralKeyPair()

      // Verify the public key can be derived from the private key
      const derivedPublicKey = ed25519.getPublicKey(keyPair.privateKey)

      // Compare the 32-byte raw public key (skip prefix byte)
      expect(bytesToHex(keyPair.publicKey.slice(1))).toBe(bytesToHex(derivedPublicKey))
    })
  })
})

describe("Crypto Integration", () => {
  it("should perform full encrypt/decrypt cycle with derived shared secret", async () => {
    const { ed25519 } = require("@noble/curves/ed25519.js")

    // Generate ephemeral keypair
    const ephemeralKeyPair = await generateEphemeralKeyPair()

    // Generate recipient keypair
    const recipientPrivateKey = new Uint8Array(32).fill(0x77)
    const recipientPublicKey = ed25519.getPublicKey(recipientPrivateKey)

    // Sender derives shared secret
    const senderSharedSecret = deriveSharedSecret(
      ephemeralKeyPair.privateKey,
      recipientPublicKey
    )

    // Encrypt amount
    const amount = 1234567890n
    const encrypted = await encryptAmount(amount, senderSharedSecret)

    // Recipient derives same shared secret
    const recipientSharedSecret = deriveSharedSecret(
      recipientPrivateKey,
      ephemeralKeyPair.publicKey.slice(1) // Remove prefix
    )

    // Decrypt amount
    const decrypted = decryptAmount(encrypted, recipientSharedSecret)

    expect(decrypted).toBe(amount)
  })

  it("should create valid commitment for any positive amount", async () => {
    // Note: ed25519 scalar multiply requires value >= 1
    const testAmounts = [1n, 1000n, 1000000000n, BigInt("18446744073709551615")]

    for (const amount of testAmounts) {
      const result = await createCommitment(amount)
      expect(result.commitment.length).toBe(33)
      expect(result.blindingFactor.length).toBe(32)
    }
  })
})
