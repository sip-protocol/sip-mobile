/**
 * Types and pure helpers for the recipient resolution state machine.
 *
 * Mirrors sip-app's `recipient-resolution.ts` BUT adds a `solana-address`
 * kind so raw Solana addresses are first-class: sip-mobile supports
 * transparent sends (sip-app does not), so the send screen's submit gate
 * must accept a base58 pubkey as a ready-to-send state.
 *
 * Kept React- and async-free so:
 *   1. Tests can import it without pulling in `@bonfida/spl-name-service`
 *      (which crashes the vitest-node environment — Task 16 footnote).
 *   2. The send screen can compose it with its existing useEffect-based
 *      state machine instead of swallowing a second hook.
 */

import {
  SOLANA_ADDRESS_REGEX,
  STEALTH_ADDRESS_REGEX,
} from "@/utils/validation"

// ── Regex constants ───────────────────────────────────────────────────────────

/**
 * Re-export under the same identifier sip-app uses, so future cross-repo
 * refactors can keep using the canonical name. Source of truth lives in
 * `src/utils/validation.ts` — do NOT redefine here.
 */
export const SIP_ADDRESS_REGEX = STEALTH_ADDRESS_REGEX

export { SOLANA_ADDRESS_REGEX }

/**
 * SNS domain: one or more labels (alphanumeric + hyphen) separated by
 * dots, ending in .sol (case-insensitive). Supports sub-subdomains
 * (e.g. `foo.bar.sol`) the same way Bonfida itself does.
 */
export const SNS_DOMAIN_REGEX = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.sol$/i

// ── Resolution state tagged union ─────────────────────────────────────────────

/** The recipient input has been cleared. */
export type REmpty = { kind: "empty" }

/** A valid sip:solana:… URI — ready to send (stealth). */
export type RSipUri = { kind: "sip-uri"; uri: string }

/**
 * A raw base58 Solana address — ready to send (transparent).
 * sip-mobile-specific extension vs sip-app (which is SNS- and sip:-only).
 */
export type RSolanaAddress = { kind: "solana-address"; address: string }

/** A .sol domain is being resolved over the network. */
export type RSnsResolving = { kind: "sns-resolving"; domain: string }

/**
 * SIP-STEALTH record found for the domain — ready to send.
 * `uri` is the constructed sip:solana:… string.
 */
export type RSnsResolved = { kind: "sns-resolved"; domain: string; uri: string }

/**
 * Domain exists but has no SIP-STEALTH record.
 * Show warn-and-downgrade UX (view public address + cancel).
 */
export type RSnsNotFoundRecord = {
  kind: "sns-not-found-record"
  domain: string
}

/** Domain not registered on SNS. Red error. */
export type RSnsNotFoundDomain = {
  kind: "sns-not-found-domain"
  domain: string
}

/** Domain exists but the SIP-STEALTH record is malformed. Red error. */
export type RSnsMalformed = {
  kind: "sns-malformed"
  domain: string
  reason: string
}

/** Input matches neither a sip: URI nor a .sol domain nor a base58 pubkey. */
export type RInvalid = { kind: "invalid"; input: string }

export type RecipientResolution =
  | REmpty
  | RSipUri
  | RSolanaAddress
  | RSnsResolving
  | RSnsResolved
  | RSnsNotFoundRecord
  | RSnsNotFoundDomain
  | RSnsMalformed
  | RInvalid

// ── Pure helpers ──────────────────────────────────────────────────────────────

/**
 * Return true when the resolution represents a ready-to-send state.
 *
 * `solana-address` is intentionally included here (the sip-mobile
 * extension): the existing send flow accepts a base58 recipient and
 * routes it through the transparent path.
 */
export function isReadyToSend(
  r: RecipientResolution
): r is RSipUri | RSolanaAddress | RSnsResolved {
  return (
    r.kind === "sip-uri" ||
    r.kind === "solana-address" ||
    r.kind === "sns-resolved"
  )
}

/**
 * Extract the actual string to hand to the send call.
 *
 * - `sip-uri` and `sns-resolved` → the `sip:solana:<spend>:<view>` URI
 * - `solana-address` → the raw base58 string
 * - everything else → null (not ready to send)
 */
export function targetUri(r: RecipientResolution): string | null {
  if (r.kind === "sip-uri") return r.uri
  if (r.kind === "sns-resolved") return r.uri
  if (r.kind === "solana-address") return r.address
  return null
}

/**
 * Classify a raw input string into the initial resolution state (no I/O).
 *
 * Precedence:
 *   1. sip:solana:… URI  → `sip-uri`
 *   2. *.sol domain      → `sns-resolving` (async path)
 *   3. base58 pubkey     → `solana-address`
 *   4. anything else     → `invalid`
 *
 * Empty / whitespace-only → `empty`.
 */
export function classifyInput(raw: string): RecipientResolution {
  // Strip trailing dot ("alice.sol." → "alice.sol") and surrounding whitespace.
  const trimmed = raw.trim().replace(/\.$/, "")
  if (trimmed === "") return { kind: "empty" }

  if (SIP_ADDRESS_REGEX.test(trimmed)) {
    return { kind: "sip-uri", uri: trimmed }
  }

  // SNS check before Solana base58: a hypothetical lowercase 32-44 char
  // string ending in ".sol" would otherwise match the (loose) base58
  // regex — but the dot itself is NOT in the base58 alphabet, so this
  // ordering is conservative. Kept explicit for the future reader.
  if (SNS_DOMAIN_REGEX.test(trimmed)) {
    return { kind: "sns-resolving", domain: trimmed.toLowerCase() }
  }

  if (SOLANA_ADDRESS_REGEX.test(trimmed)) {
    return { kind: "solana-address", address: trimmed }
  }

  return { kind: "invalid", input: trimmed }
}
