/**
 * Canonical EIP-5564 Stealth Scheme Tests
 *
 * Proves the vendored ed25519 stealth scheme is canonical EIP-5564 and that the
 * generate / check / derive paths are mutually consistent:
 *
 *   shared secret  S = r * K_view   (sender)  = view_scalar * R   (recipient)
 *   stealth address P = K_spend + H(S) * G
 *   stealth privkey p = spend_scalar + H(S)   (mod L)
 *
 * Detection is VIEW-ONLY: it requires the viewing PRIVATE key and the spending
 * PUBLIC key only — never the spending private key.
 *
 * Cross-path: the on-chain stealth recipient is produced by this module's
 * `generateStealthAddress`. Both scanners now detect through the canonical view-only
 * path — the foreground `useScanPayments` via `checkStealthAddress`, and the background
 * `checkRecordOwnership` (src/services/recordOwnership.ts) via `checkStealthOwnership`,
 * which delegates to the same `checkStealthAddress`. This test verifies the canonical
 * formula P = K_spend + bytesToBigInt(SHA256(S)) * G reproduces the address.
 */

import { describe, it, expect } from "vitest"
import { ed25519 } from "@noble/curves/ed25519"
import { sha256 } from "@noble/hashes/sha256"
import { sha512 } from "@noble/hashes/sha512"
import {
  generateStealthAddress,
  checkStealthAddress,
  checkStealthOwnership,
  deriveStealthPrivateKey,
  bytesToHex,
  hexToBytes,
  type StealthMetaAddress,
} from "@/lib/stealth"

// ed25519 curve order (L)
const ED25519_ORDER = BigInt(
  "0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed"
)

// Big-endian byte→bigint, matching src/lib/stealth.ts bytesToBigInt
function beBytesToBigInt(bytes: Uint8Array): bigint {
  let r = 0n
  for (let i = bytes.length - 1; i >= 0; i--) r = (r << 8n) | BigInt(bytes[i])
  return r
}

// ed25519 scalar from a 32-byte seed (SHA512 + clamp, big-endian), matching
// src/lib/stealth.ts getEd25519Scalar
function ed25519Scalar(seed: Uint8Array): bigint {
  const h = sha512(seed)
  const s = new Uint8Array(h.slice(0, 32))
  s[0] &= 248
  s[31] &= 127
  s[31] |= 64
  return beBytesToBigInt(s) % ED25519_ORDER
}

// Distinct, deterministic recipient seeds (the expo-crypto mock returns a constant
// buffer, so we build keys explicitly to keep spending != viewing).
const SPENDING_SEED = new Uint8Array(32).fill(0x11)
const VIEWING_SEED = new Uint8Array(32).fill(0x22)
const WRONG_VIEWING_SEED = new Uint8Array(32).fill(0x33)

function metaFor(spendingSeed: Uint8Array, viewingSeed: Uint8Array): StealthMetaAddress {
  return {
    chain: "solana",
    spendingKey: `0x${bytesToHex(ed25519.getPublicKey(spendingSeed))}`,
    viewingKey: `0x${bytesToHex(ed25519.getPublicKey(viewingSeed))}`,
  }
}

describe("Canonical EIP-5564 stealth scheme (ed25519)", () => {
  const meta = metaFor(SPENDING_SEED, VIEWING_SEED)
  const spendingPrivateKey = `0x${bytesToHex(SPENDING_SEED)}`
  const viewingPrivateKey = `0x${bytesToHex(VIEWING_SEED)}`

  it("(a) detects via VIEW-ONLY keys: viewing private + spending public", async () => {
    const { stealthAddress } = await generateStealthAddress(meta)

    // View-only: only the viewing private key and the spending public key.
    const detected = checkStealthAddress(
      stealthAddress,
      viewingPrivateKey,
      meta.spendingKey
    )
    expect(detected).toBe(true)
  })

  it("(b) returns false for the wrong viewing key", async () => {
    const { stealthAddress } = await generateStealthAddress(meta)

    const wrongViewingPrivateKey = `0x${bytesToHex(WRONG_VIEWING_SEED)}`
    const detected = checkStealthAddress(
      stealthAddress,
      wrongViewingPrivateKey,
      meta.spendingKey
    )
    expect(detected).toBe(false)
  })

  it("(b2) returns false for the wrong spending public key", async () => {
    const { stealthAddress } = await generateStealthAddress(meta)

    const wrongSpendingPublic = `0x${bytesToHex(ed25519.getPublicKey(new Uint8Array(32).fill(0x44)))}`
    const detected = checkStealthAddress(
      stealthAddress,
      viewingPrivateKey,
      wrongSpendingPublic
    )
    expect(detected).toBe(false)
  })

  it("(c) derives a SPENDABLE private key whose public key equals the stealth address", async () => {
    const { stealthAddress } = await generateStealthAddress(meta)

    // Spending requires BOTH private keys (viewing for the ECDH, spending as the base scalar).
    const derivedPriv = deriveStealthPrivateKey(
      stealthAddress,
      spendingPrivateKey,
      viewingPrivateKey
    )

    // The derived value is a raw scalar (little-endian). Re-derive the public point.
    const scalar = beBytesToBigInt(hexToBytes(derivedPriv)) % ED25519_ORDER
    const derivedPub = ed25519.ExtendedPoint.BASE.multiply(scalar).toRawBytes()

    expect(`0x${bytesToHex(derivedPub)}`).toBe(stealthAddress.address)
  })

  it("(c2) a derived key from the wrong viewing key is NOT spendable", async () => {
    const { stealthAddress } = await generateStealthAddress(meta)

    const wrongViewingPrivateKey = `0x${bytesToHex(WRONG_VIEWING_SEED)}`
    const derivedPriv = deriveStealthPrivateKey(
      stealthAddress,
      spendingPrivateKey,
      wrongViewingPrivateKey
    )
    const scalar = beBytesToBigInt(hexToBytes(derivedPriv)) % ED25519_ORDER
    const derivedPub = ed25519.ExtendedPoint.BASE.multiply(scalar).toRawBytes()

    expect(`0x${bytesToHex(derivedPub)}`).not.toBe(stealthAddress.address)
  })

  it("(d) cross-path: the canonical formula P = K_spend + SHA256(S)*G reproduces the on-chain address", async () => {
    const { stealthAddress } = await generateStealthAddress(meta)

    const ephemeralBytes = hexToBytes(stealthAddress.ephemeralPublicKey)
    const ephemeralPoint = ed25519.ExtendedPoint.fromHex(ephemeralBytes)

    // Recipient-side ECDH on the VIEWING key (the role every scanner uses):
    //   S = view_scalar * R
    const viewScalar = ed25519Scalar(VIEWING_SEED)
    const S = sha256(ephemeralPoint.multiply(viewScalar).toRawBytes())

    // The view tag (first byte of S) gates detection.
    expect(S[0]).toBe(stealthAddress.viewTag)

    // Both scanners recompute P = K_spend + bytesToBigInt(SHA256(S)) * G — the foreground
    // (useScanPayments -> checkStealthAddress) and the background
    // (recordOwnership.checkRecordOwnership -> checkStealthOwnership -> checkStealthAddress).
    // It must equal the on-chain stealth recipient produced by generateStealthAddress.
    const hashScalar = beBytesToBigInt(S) % ED25519_ORDER
    const addr = ed25519.ExtendedPoint.fromHex(hexToBytes(meta.spendingKey))
      .add(ed25519.ExtendedPoint.BASE.multiply(hashScalar))
      .toRawBytes()
    expect(`0x${bytesToHex(addr)}`).toBe(stealthAddress.address)
  })

  it("is consistent across repeated generation (deterministic ephemeral in tests)", async () => {
    const a = await generateStealthAddress(meta)
    const b = await generateStealthAddress(meta)
    // Same (mocked) ephemeral randomness -> same address; both detect view-only.
    expect(checkStealthAddress(a.stealthAddress, viewingPrivateKey, meta.spendingKey)).toBe(true)
    expect(checkStealthAddress(b.stealthAddress, viewingPrivateKey, meta.spendingKey)).toBe(true)
  })
})

describe("checkStealthAddress: optional view tag", () => {
  const meta = metaFor(SPENDING_SEED, VIEWING_SEED)
  const viewingPrivateKey = `0x${bytesToHex(VIEWING_SEED)}`

  it("detects when the view tag is omitted (on-chain records don't store one)", async () => {
    const { stealthAddress } = await generateStealthAddress(meta)
    // Drop the view tag — checkStealthAddress must skip the fast-reject and still match.
    const { viewTag: _omit, ...noTag } = stealthAddress
    expect(checkStealthAddress(noTag, viewingPrivateKey, meta.spendingKey)).toBe(true)
  })

  it("still fast-rejects on a wrong explicit view tag", async () => {
    const { stealthAddress } = await generateStealthAddress(meta)
    const wrongTag = { ...stealthAddress, viewTag: (stealthAddress.viewTag! + 1) & 0xff }
    expect(checkStealthAddress(wrongTag, viewingPrivateKey, meta.spendingKey)).toBe(false)
  })
})

describe("checkStealthOwnership (view-only detection from raw record parts)", () => {
  const meta = metaFor(SPENDING_SEED, VIEWING_SEED)
  const viewingPrivateKey = `0x${bytesToHex(VIEWING_SEED)}`

  it("detects a generateStealthAddress output via viewing private + spending public", async () => {
    const { stealthAddress } = await generateStealthAddress(meta)
    const detected = checkStealthOwnership(
      stealthAddress.address,
      stealthAddress.ephemeralPublicKey,
      viewingPrivateKey,
      meta.spendingKey
    )
    expect(detected).toBe(true)
  })

  it("returns false for the wrong viewing key", async () => {
    const { stealthAddress } = await generateStealthAddress(meta)
    const wrongViewingPrivateKey = `0x${bytesToHex(WRONG_VIEWING_SEED)}`
    expect(
      checkStealthOwnership(
        stealthAddress.address,
        stealthAddress.ephemeralPublicKey,
        wrongViewingPrivateKey,
        meta.spendingKey
      )
    ).toBe(false)
  })

  it("returns false for the wrong spending public key", async () => {
    const { stealthAddress } = await generateStealthAddress(meta)
    const wrongSpendingPublic = `0x${bytesToHex(ed25519.getPublicKey(new Uint8Array(32).fill(0x44)))}`
    expect(
      checkStealthOwnership(
        stealthAddress.address,
        stealthAddress.ephemeralPublicKey,
        viewingPrivateKey,
        wrongSpendingPublic
      )
    ).toBe(false)
  })

  it("agrees with checkStealthAddress on the same payment", async () => {
    const { stealthAddress } = await generateStealthAddress(meta)
    const viaObject = checkStealthAddress(stealthAddress, viewingPrivateKey, meta.spendingKey)
    const viaParts = checkStealthOwnership(
      stealthAddress.address,
      stealthAddress.ephemeralPublicKey,
      viewingPrivateKey,
      meta.spendingKey
    )
    expect(viaParts).toBe(viaObject)
    expect(viaParts).toBe(true)
  })

  it("tolerates 0x-prefixed and bare hex inputs equally", async () => {
    const { stealthAddress } = await generateStealthAddress(meta)
    const bare = (hex: string) => (hex.startsWith("0x") ? hex.slice(2) : hex)
    expect(
      checkStealthOwnership(
        bare(stealthAddress.address),
        bare(stealthAddress.ephemeralPublicKey),
        bare(viewingPrivateKey),
        bare(meta.spendingKey)
      )
    ).toBe(true)
  })
})
