/**
 * Pure helpers for the SIP-STEALTH Publish Screen.
 *
 * Lives in `src/utils` (instead of inline in the screen file) so the tests
 * can import them WITHOUT pulling in `@bonfida/spl-name-service`,
 * `phosphor-react-native`, or any React/RN module transitively. The screen
 * re-exports these from `app/settings/sip-stealth.tsx`.
 *
 * The same shape exists in sip-app's PublishCard — discriminated union for
 * the card state, error class discrimination via `instanceof`, and an
 * exhaustiveness guard on the resolve result.
 */

import type { PublicKey } from "@solana/web3.js"
import {
  MetaAddress,
  NotFound,
  Malformed,
  NetworkError,
  OnChainError,
  UserRejected,
  type ResolveResult,
} from "@sip-protocol/sns-stealth"

// ─── Card state machine ────────────────────────────────────────────────────

/**
 * Per-card state machine.
 *
 * `loading` is the initial state (resolving the existing record).
 * `has-record` and `no-record` are terminal until the user acts.
 * `publishing` is the in-flight state for the user's enable action.
 * `published` is the post-success state with a tx signature available.
 * `error` covers card-load failures (network, parsing). Publish failures
 * roll back to `no-record` with `errorMessage` set so the user can retry.
 */
export type CardState =
  | "loading"
  | "has-record"
  | "no-record"
  | "publishing"
  | "published"
  | "error"

export interface CardData {
  state: CardState
  domainName: string | null
  signature: string | null
  errorMessage: string | null
}

/**
 * Classify a resolve result into a card state. Exhaustive on the union.
 *
 * Returns `"has-record"` when the domain already publishes a valid stealth
 * meta-address, `"no-record"` when SNS itself is missing the record or the
 * record bytes don't parse (the user can simply (re)publish to fix that),
 * and the explicit `_exhaustive` branch lets the compiler enforce that any
 * new ResolveResult variant gets a deliberate decision here.
 */
export function classifyResolveResult(
  result: ResolveResult
): "has-record" | "no-record" {
  if (result instanceof MetaAddress) return "has-record"
  if (result instanceof NotFound) return "no-record"
  if (result instanceof Malformed) return "no-record"
  const _exhaustive: never = result
  throw new Error(`Unhandled resolve result: ${String(_exhaustive)}`)
}

// ─── Error classification ──────────────────────────────────────────────────

/**
 * Map a publish-time error to a user-facing message.
 *
 * `UserRejected` is treated as a soft signal (the user cancelled at the
 * biometric prompt), so it gets a friendly message rather than a scary one.
 * `NetworkError` is retryable. `OnChainError` carries a real on-chain
 * failure with a signature attached (worth showing). Everything else
 * falls through to the message string with a generic prefix.
 */
export function errorMessageFor(err: unknown): string {
  if (err instanceof UserRejected) {
    return "You cancelled the request"
  }
  if (err instanceof NetworkError) {
    return "Network error — try again"
  }
  if (err instanceof OnChainError) {
    return `On-chain error: ${err.message}`
  }
  if (err instanceof Error) {
    return `Failed to publish: ${err.message}`
  }
  return "Failed to publish: unknown error"
}

/**
 * Map a load-time error (resolve / getAllDomains) to a user-facing message.
 *
 * Same instanceof discrimination as `errorMessageFor`, but the strings are
 * load-time appropriate (no "Failed to publish" prefix).
 */
export function loadErrorMessageFor(err: unknown): string {
  if (err instanceof NetworkError) {
    return "Network error — try again"
  }
  if (err instanceof Error) {
    return err.message
  }
  return "Failed to load record"
}

// ─── Wallet readiness ──────────────────────────────────────────────────────

/**
 * Wallet readiness gate. Returns true only when the native wallet is
 * fully initialized AND a wallet is loaded AND we're not mid-loading.
 *
 * This is the boolean the screen uses to decide between the
 * "connect a wallet" empty state and the actual domain list.
 */
export function isWalletReady(opts: {
  wallet: { publicKey: PublicKey } | null
  isInitialized: boolean
  isLoading: boolean
}): boolean {
  return !!opts.wallet && opts.isInitialized && !opts.isLoading
}
