/**
 * Recipient Resolution — Pure Logic Tests
 *
 * Covers the recipient resolution state machine helpers in
 * `src/lib/recipient-resolution.ts`:
 *   - classifyInput: raw string → initial RecipientResolution
 *   - isReadyToSend: resolution → boolean (with narrowing predicate)
 *   - targetUri: resolution → string | null (send-call target)
 *
 * The module is pure TypeScript with no async / no Bonfida / no React, so
 * tests import it directly without any mocks. Same convention as
 * tests/screens/sipStealth.test.ts.
 */

import { describe, it, expect } from "vitest"
import {
  classifyInput,
  isReadyToSend,
  targetUri,
  SIP_ADDRESS_REGEX,
  SOLANA_ADDRESS_REGEX,
  SNS_DOMAIN_REGEX,
  type RecipientResolution,
} from "@/lib/recipient-resolution"

// ============================================================================
// FIXTURES
// ============================================================================

// Stealth meta-address: sip:solana:<spend(base58)>:<view(base58)>
const SIP_URI =
  "sip:solana:7x3Fh9wkY1qZc8N5pL2dM8N4F1J3v9eQ7P6oH2K9T4Z:2Bp4kL1M9wN3qF6X5oV2cH7K8jR4dT6yP9aS3uG2nE5W"

// Standard 44-char base58 Solana pubkey
const SOLANA_ADDR = "S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at"
// 32-char base58 pubkey (also valid)
const SHORTER_ADDR = "11111111111111111111111111111111"

const ALICE_SOL = "alice.sol"
const SUB_SUB_SOL = "foo.bar.sol"

// ============================================================================
// REGEX SANITY (re-export contract)
// ============================================================================

describe("regex re-exports", () => {
  it("SIP_ADDRESS_REGEX accepts a valid stealth URI", () => {
    expect(SIP_ADDRESS_REGEX.test(SIP_URI)).toBe(true)
  })

  it("SIP_ADDRESS_REGEX rejects a plain base58 pubkey", () => {
    expect(SIP_ADDRESS_REGEX.test(SOLANA_ADDR)).toBe(false)
  })

  it("SOLANA_ADDRESS_REGEX accepts a 44-char base58 pubkey", () => {
    expect(SOLANA_ADDRESS_REGEX.test(SOLANA_ADDR)).toBe(true)
  })

  it("SOLANA_ADDRESS_REGEX accepts a 32-char base58 pubkey", () => {
    expect(SOLANA_ADDRESS_REGEX.test(SHORTER_ADDR)).toBe(true)
  })

  it("SOLANA_ADDRESS_REGEX rejects too-short input", () => {
    expect(SOLANA_ADDRESS_REGEX.test("abc")).toBe(false)
  })

  it("SOLANA_ADDRESS_REGEX rejects too-long input", () => {
    expect(SOLANA_ADDRESS_REGEX.test("a".repeat(50))).toBe(false)
  })

  it("SNS_DOMAIN_REGEX accepts a single-label .sol", () => {
    expect(SNS_DOMAIN_REGEX.test(ALICE_SOL)).toBe(true)
  })

  it("SNS_DOMAIN_REGEX accepts a sub-subdomain", () => {
    expect(SNS_DOMAIN_REGEX.test(SUB_SUB_SOL)).toBe(true)
  })

  it("SNS_DOMAIN_REGEX is case-insensitive", () => {
    expect(SNS_DOMAIN_REGEX.test("Alice.SOL")).toBe(true)
  })

  it("SNS_DOMAIN_REGEX rejects non-.sol TLDs", () => {
    expect(SNS_DOMAIN_REGEX.test("alice.eth")).toBe(false)
    expect(SNS_DOMAIN_REGEX.test("alice")).toBe(false)
  })
})

// ============================================================================
// classifyInput
// ============================================================================

describe("classifyInput", () => {
  describe("empty / whitespace inputs", () => {
    it("classifies empty string as empty", () => {
      expect(classifyInput("")).toEqual({ kind: "empty" })
    })

    it("classifies whitespace-only as empty", () => {
      expect(classifyInput("   ")).toEqual({ kind: "empty" })
    })

    it("classifies tab + newline as empty", () => {
      expect(classifyInput("\t\n")).toEqual({ kind: "empty" })
    })
  })

  describe("sip: URI", () => {
    it("classifies a valid sip:solana URI as sip-uri", () => {
      const r = classifyInput(SIP_URI)
      expect(r.kind).toBe("sip-uri")
      if (r.kind === "sip-uri") {
        expect(r.uri).toBe(SIP_URI)
      }
    })

    it("trims surrounding whitespace in sip-uri", () => {
      const r = classifyInput(`  ${SIP_URI}  `)
      expect(r.kind).toBe("sip-uri")
      if (r.kind === "sip-uri") {
        expect(r.uri).toBe(SIP_URI)
      }
    })

    it("rejects a sip: URI with a non-solana chain (lowercase)", () => {
      const r = classifyInput("sip:ethereum:abc:def")
      expect(r.kind).toBe("invalid")
    })

    it("rejects a malformed sip: URI (missing viewing key)", () => {
      const r = classifyInput("sip:solana:" + SOLANA_ADDR)
      expect(r.kind).toBe("invalid")
    })

    it("rejects a mixed-case sip-uri (sip: prefix is lowercase)", () => {
      // STEALTH_ADDRESS_REGEX requires exact "sip:solana:" prefix.
      const r = classifyInput("SIP:solana:" + SOLANA_ADDR + ":" + SOLANA_ADDR)
      expect(r.kind).toBe("invalid")
    })
  })

  describe(".sol domain", () => {
    it("classifies a bare .sol domain as sns-resolving", () => {
      const r = classifyInput(ALICE_SOL)
      expect(r.kind).toBe("sns-resolving")
      if (r.kind === "sns-resolving") {
        expect(r.domain).toBe(ALICE_SOL)
      }
    })

    it("classifies a sub-subdomain as sns-resolving", () => {
      const r = classifyInput(SUB_SUB_SOL)
      expect(r.kind).toBe("sns-resolving")
      if (r.kind === "sns-resolving") {
        expect(r.domain).toBe(SUB_SUB_SOL)
      }
    })

    it("strips a trailing dot before classification", () => {
      const r = classifyInput("alice.sol.")
      expect(r.kind).toBe("sns-resolving")
      if (r.kind === "sns-resolving") {
        expect(r.domain).toBe(ALICE_SOL)
      }
    })

    it("lowercases uppercase .sol input", () => {
      const r = classifyInput("Alice.SOL")
      expect(r.kind).toBe("sns-resolving")
      if (r.kind === "sns-resolving") {
        expect(r.domain).toBe(ALICE_SOL)
      }
    })

    it("trims surrounding whitespace in domains", () => {
      const r = classifyInput("  alice.sol  ")
      expect(r.kind).toBe("sns-resolving")
      if (r.kind === "sns-resolving") {
        expect(r.domain).toBe(ALICE_SOL)
      }
    })

    it("rejects non-.sol TLD as invalid (not sns-resolving)", () => {
      const r = classifyInput("alice.eth")
      expect(r.kind).toBe("invalid")
    })

    it("rejects a single label without TLD as invalid", () => {
      const r = classifyInput("alice")
      expect(r.kind).toBe("invalid")
    })
  })

  describe("solana base58 address", () => {
    it("classifies a 44-char base58 string as solana-address", () => {
      const r = classifyInput(SOLANA_ADDR)
      expect(r.kind).toBe("solana-address")
      if (r.kind === "solana-address") {
        expect(r.address).toBe(SOLANA_ADDR)
      }
    })

    it("classifies a 32-char base58 string as solana-address", () => {
      const r = classifyInput(SHORTER_ADDR)
      expect(r.kind).toBe("solana-address")
      if (r.kind === "solana-address") {
        expect(r.address).toBe(SHORTER_ADDR)
      }
    })

    it("rejects a base58-ish string that's too short", () => {
      const r = classifyInput("abc123")
      expect(r.kind).toBe("invalid")
    })

    it("rejects a base58-ish string that's too long", () => {
      const r = classifyInput("a".repeat(50))
      expect(r.kind).toBe("invalid")
    })

    it("rejects '0' (forbidden in base58 alphabet)", () => {
      const r = classifyInput("0".repeat(44))
      expect(r.kind).toBe("invalid")
    })

    it("rejects 'O', 'I', 'l' (forbidden in base58 alphabet)", () => {
      const r1 = classifyInput("O".repeat(44))
      const r2 = classifyInput("I".repeat(44))
      const r3 = classifyInput("l".repeat(44))
      expect(r1.kind).toBe("invalid")
      expect(r2.kind).toBe("invalid")
      expect(r3.kind).toBe("invalid")
    })

    it("a sip: prefix on the input does NOT classify as solana-address", () => {
      // Defensive: sip: takes precedence; a malformed sip: URI falls through
      // to invalid (NOT to solana-address) because the leading "sip:" is
      // not in the base58 alphabet.
      const r = classifyInput("sip:" + SOLANA_ADDR)
      expect(r.kind).toBe("invalid")
    })

    it("trims surrounding whitespace in base58 addresses", () => {
      const r = classifyInput(`  ${SOLANA_ADDR}  `)
      expect(r.kind).toBe("solana-address")
      if (r.kind === "solana-address") {
        expect(r.address).toBe(SOLANA_ADDR)
      }
    })
  })

  describe("invalid inputs", () => {
    it("classifies arbitrary garbage as invalid", () => {
      const r = classifyInput("@@@!!!")
      expect(r.kind).toBe("invalid")
      if (r.kind === "invalid") {
        expect(r.input).toBe("@@@!!!")
      }
    })

    it("preserves the trimmed input in the invalid kind", () => {
      const r = classifyInput("  bogus  ")
      expect(r.kind).toBe("invalid")
      if (r.kind === "invalid") {
        expect(r.input).toBe("bogus")
      }
    })
  })

  describe("precedence ordering", () => {
    it("sip: URI takes precedence over base58 (if both could match)", () => {
      // SIP_ADDRESS_REGEX is checked first; the sip: prefix can't also be a
      // valid base58 pubkey, but we lock the precedence contract here.
      const r = classifyInput(SIP_URI)
      expect(r.kind).toBe("sip-uri")
    })

    it(".sol takes precedence over base58", () => {
      // Same: a .sol domain has a dot, which is not in base58 alphabet —
      // but we lock the contract.
      const r = classifyInput(ALICE_SOL)
      expect(r.kind).toBe("sns-resolving")
    })
  })
})

// ============================================================================
// isReadyToSend
// ============================================================================

describe("isReadyToSend", () => {
  it("returns true for sip-uri", () => {
    const r: RecipientResolution = { kind: "sip-uri", uri: SIP_URI }
    expect(isReadyToSend(r)).toBe(true)
  })

  it("returns true for solana-address (sip-mobile extension)", () => {
    const r: RecipientResolution = {
      kind: "solana-address",
      address: SOLANA_ADDR,
    }
    expect(isReadyToSend(r)).toBe(true)
  })

  it("returns true for sns-resolved", () => {
    const r: RecipientResolution = {
      kind: "sns-resolved",
      domain: ALICE_SOL,
      uri: SIP_URI,
    }
    expect(isReadyToSend(r)).toBe(true)
  })

  it("returns false for empty", () => {
    expect(isReadyToSend({ kind: "empty" })).toBe(false)
  })

  it("returns false for sns-resolving (still in flight)", () => {
    expect(
      isReadyToSend({ kind: "sns-resolving", domain: ALICE_SOL })
    ).toBe(false)
  })

  it("returns false for sns-not-found-record", () => {
    expect(
      isReadyToSend({ kind: "sns-not-found-record", domain: ALICE_SOL })
    ).toBe(false)
  })

  it("returns false for sns-not-found-domain", () => {
    expect(
      isReadyToSend({ kind: "sns-not-found-domain", domain: ALICE_SOL })
    ).toBe(false)
  })

  it("returns false for sns-malformed", () => {
    expect(
      isReadyToSend({
        kind: "sns-malformed",
        domain: ALICE_SOL,
        reason: "schema",
      })
    ).toBe(false)
  })

  it("returns false for invalid", () => {
    expect(isReadyToSend({ kind: "invalid", input: "@@@" })).toBe(false)
  })

  it("acts as a type narrowing predicate (compile-time check)", () => {
    const r: RecipientResolution = { kind: "sip-uri", uri: SIP_URI }
    if (isReadyToSend(r)) {
      // After narrowing, TS should know r is RSipUri | RSolanaAddress | RSnsResolved
      // — `targetUri(r)` must return a string (not null).
      const t = targetUri(r)
      expect(typeof t).toBe("string")
    }
  })
})

// ============================================================================
// targetUri
// ============================================================================

describe("targetUri", () => {
  it("returns the URI for sip-uri", () => {
    const r: RecipientResolution = { kind: "sip-uri", uri: SIP_URI }
    expect(targetUri(r)).toBe(SIP_URI)
  })

  it("returns the URI for sns-resolved", () => {
    const r: RecipientResolution = {
      kind: "sns-resolved",
      domain: ALICE_SOL,
      uri: SIP_URI,
    }
    expect(targetUri(r)).toBe(SIP_URI)
  })

  it("returns the raw address for solana-address", () => {
    const r: RecipientResolution = {
      kind: "solana-address",
      address: SOLANA_ADDR,
    }
    expect(targetUri(r)).toBe(SOLANA_ADDR)
  })

  it("returns null for empty", () => {
    expect(targetUri({ kind: "empty" })).toBeNull()
  })

  it("returns null for sns-resolving", () => {
    expect(
      targetUri({ kind: "sns-resolving", domain: ALICE_SOL })
    ).toBeNull()
  })

  it("returns null for sns-not-found-record", () => {
    expect(
      targetUri({ kind: "sns-not-found-record", domain: ALICE_SOL })
    ).toBeNull()
  })

  it("returns null for sns-not-found-domain", () => {
    expect(
      targetUri({ kind: "sns-not-found-domain", domain: ALICE_SOL })
    ).toBeNull()
  })

  it("returns null for sns-malformed", () => {
    expect(
      targetUri({
        kind: "sns-malformed",
        domain: ALICE_SOL,
        reason: "schema",
      })
    ).toBeNull()
  })

  it("returns null for invalid", () => {
    expect(targetUri({ kind: "invalid", input: "@@@" })).toBeNull()
  })
})

// ============================================================================
// Send-screen integration contract (logic-level)
// ============================================================================
//
// These tests don't import the screen file (which would pull in Bonfida via
// the resolution effect and crash vitest-node). They lock the contract
// between resolution kind → derived isStealth + targetUri output, which is
// the state-machine consumer surface in app/send/index.tsx.

describe("Send screen integration — derived isStealth", () => {
  // Same derivation as app/send/index.tsx: stealth iff sip-uri or sns-resolved.
  function deriveIsStealth(r: RecipientResolution): boolean {
    return r.kind === "sip-uri" || r.kind === "sns-resolved"
  }

  it("isStealth = true for sip-uri", () => {
    expect(deriveIsStealth({ kind: "sip-uri", uri: SIP_URI })).toBe(true)
  })

  it("isStealth = true for sns-resolved", () => {
    expect(
      deriveIsStealth({
        kind: "sns-resolved",
        domain: ALICE_SOL,
        uri: SIP_URI,
      })
    ).toBe(true)
  })

  it("isStealth = false for solana-address (transparent send)", () => {
    expect(
      deriveIsStealth({ kind: "solana-address", address: SOLANA_ADDR })
    ).toBe(false)
  })

  it("isStealth = false for all not-ready kinds", () => {
    expect(deriveIsStealth({ kind: "empty" })).toBe(false)
    expect(
      deriveIsStealth({ kind: "sns-resolving", domain: ALICE_SOL })
    ).toBe(false)
    expect(
      deriveIsStealth({ kind: "sns-not-found-record", domain: ALICE_SOL })
    ).toBe(false)
    expect(
      deriveIsStealth({ kind: "sns-not-found-domain", domain: ALICE_SOL })
    ).toBe(false)
    expect(
      deriveIsStealth({
        kind: "sns-malformed",
        domain: ALICE_SOL,
        reason: "schema",
      })
    ).toBe(false)
    expect(deriveIsStealth({ kind: "invalid", input: "x" })).toBe(false)
  })
})

describe("Send screen integration — submit-gate + send-target", () => {
  // Same fallback as handleConfirmSend in the screen: targetUri ?? recipient.
  function deriveSendTarget(
    r: RecipientResolution,
    rawRecipient: string
  ): string {
    return targetUri(r) ?? rawRecipient
  }

  it("uses the resolved sip: URI for sns-resolved (NOT the raw .sol)", () => {
    const target = deriveSendTarget(
      { kind: "sns-resolved", domain: ALICE_SOL, uri: SIP_URI },
      "alice.sol"
    )
    expect(target).toBe(SIP_URI)
    expect(target).not.toBe("alice.sol")
  })

  it("uses the raw URI for sip-uri", () => {
    const target = deriveSendTarget(
      { kind: "sip-uri", uri: SIP_URI },
      SIP_URI
    )
    expect(target).toBe(SIP_URI)
  })

  it("uses the raw base58 for solana-address", () => {
    const target = deriveSendTarget(
      { kind: "solana-address", address: SOLANA_ADDR },
      SOLANA_ADDR
    )
    expect(target).toBe(SOLANA_ADDR)
  })

  it("falls back to the raw recipient when targetUri returns null", () => {
    // This branch is unreachable in practice (submit gate would have blocked
    // the call), but we lock the fallback contract anyway.
    const target = deriveSendTarget({ kind: "empty" }, "")
    expect(target).toBe("")
  })

  it("submit gate (isReadyToSend) and send-target stay consistent", () => {
    // Property: whenever isReadyToSend returns true, targetUri returns
    // non-null. The send screen's submit handler relies on this.
    const ready: RecipientResolution[] = [
      { kind: "sip-uri", uri: SIP_URI },
      { kind: "solana-address", address: SOLANA_ADDR },
      { kind: "sns-resolved", domain: ALICE_SOL, uri: SIP_URI },
    ]
    for (const r of ready) {
      expect(isReadyToSend(r)).toBe(true)
      expect(targetUri(r)).not.toBeNull()
    }
  })
})
