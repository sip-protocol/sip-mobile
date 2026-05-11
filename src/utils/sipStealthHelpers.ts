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
 * Compile-time exhaustiveness witness for ResolveResult.
 *
 * If a new ResolveResult variant is ever added upstream, this assignment
 * will fail to type-check unless the new variant is also added to the
 * union below — preserving the "every variant must be handled" contract
 * that the previous `_exhaustive: never = result` line provided. We keep
 * this here (instead of inside `classifyResolveResult`) because the
 * function takes `unknown` to avoid casts at call sites, and `unknown`
 * can't be narrowed to `never`.
 */
type _ExhaustiveResolveCheck =
  ResolveResult extends MetaAddress | NotFound | Malformed ? true : never
const _exhaustiveResolveCheck: _ExhaustiveResolveCheck = true
void _exhaustiveResolveCheck

/**
 * Classify a resolve result into a card state.
 *
 * Returns `"has-record"` when the domain already publishes a valid stealth
 * meta-address, `"no-record"` when SNS itself is missing the record or the
 * record bytes don't parse (the user can simply (re)publish to fix that),
 * and throws for any other value.
 *
 * Parameter is widened to `unknown` so callers/tests don't need to cast
 * non-ResolveResult inputs through `as unknown as ResolveResult`. We
 * validate the shape inside via `instanceof` (the wrapper preserves class
 * identity across the boundary), and throw on anything else.
 */
export function classifyResolveResult(
  result: unknown
): "has-record" | "no-record" {
  if (result instanceof MetaAddress) return "has-record"
  if (result instanceof NotFound) return "no-record"
  if (result instanceof Malformed) return "no-record"
  throw new Error(`Unhandled resolve result: ${String(result)}`)
}

// ─── Error classification ──────────────────────────────────────────────────

/**
 * Shape thrown by `useNativeWallet.signTransaction` / `signMessage` when
 * biometric auth is cancelled or fails. NOT an `Error` instance — it's a
 * plain object — so the generic `instanceof Error` branch in
 * `errorMessageFor` would miss it.
 *
 * See: src/hooks/useNativeWallet.ts:439-446 (signing path) and
 *      src/utils/keyStorage.ts:345-355 (auth-cancel re-throw).
 */
interface NativeWalletErrorLike {
  code: string
  message: string
}

function isNativeWalletErrorLike(err: unknown): err is NativeWalletErrorLike {
  return (
    !!err &&
    typeof err === "object" &&
    "code" in err &&
    "message" in err &&
    typeof (err as Record<string, unknown>).code === "string" &&
    typeof (err as Record<string, unknown>).message === "string"
  )
}

/**
 * Map a publish-time error to a user-facing message.
 *
 * `UserRejected` is treated as a soft signal (the user cancelled at the
 * biometric prompt), so it gets a friendly message rather than a scary one.
 * `NetworkError` is retryable. `OnChainError` carries a real on-chain
 * failure with a signature attached (and its message already includes the
 * "On-chain error" prefix — see packages/sns-stealth/src/errors.ts:41 —
 * so we render it as-is to avoid double-prefixing). Everything else
 * falls through to the message string with a generic prefix.
 *
 * Note on `NativeWalletErrorLike`: the native wallet hook throws a plain
 * object (`{code, message}`) on biometric cancel/failure rather than a
 * typed `UserRejected` instance. Without this branch, that path would
 * miss every `instanceof` check above and render
 * "Failed to publish: unknown error" — confusing UX for a user who just
 * tapped Cancel. We map `SIGNING_FAILED` / `AUTH_FAILED` to the same
 * friendly cancellation message and surface other codes verbatim.
 */
export function errorMessageFor(err: unknown): string {
  if (err instanceof UserRejected) {
    return "You cancelled the request"
  }
  if (err instanceof NetworkError) {
    return "Network error — try again"
  }
  if (err instanceof OnChainError) {
    return err.message
  }
  if (err instanceof Error) {
    return `Failed to publish: ${err.message}`
  }
  if (isNativeWalletErrorLike(err)) {
    if (err.code === "SIGNING_FAILED" || err.code === "AUTH_FAILED") {
      return "You cancelled the request"
    }
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
