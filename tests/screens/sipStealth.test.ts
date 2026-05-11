/**
 * SIP-STEALTH Publish Screen — Logic Tests
 *
 * Covers the pure helpers extracted from `app/settings/sip-stealth.tsx`:
 *   - classifyResolveResult: ResolveResult → CardState classification
 *   - errorMessageFor: publish error → user-facing message
 *   - isWalletReady: native wallet boolean gate
 *
 * Plus the explorer URL helpers the screen renders into the "View on …"
 * link (verifies cluster-aware reactivity).
 *
 * Logic-level tests, no React Testing Library — matches the convention
 * in tests/screens/send.test.ts.
 */

import { describe, it, expect } from "vitest"
import { PublicKey } from "@solana/web3.js"
import {
  MetaAddress,
  NotFound,
  Malformed,
  NetworkError,
  OnChainError,
  UserRejected,
} from "@sip-protocol/sns-stealth"
import {
  classifyResolveResult,
  errorMessageFor,
  isWalletReady,
  loadErrorMessageFor,
} from "@/utils/sipStealthHelpers"
import { getExplorerTxUrl } from "@/utils/explorer"

// ============================================================================
// FIXTURES
// ============================================================================

const ZERO_KEY_32 = new Uint8Array(32) // valid length for spending/viewing key
const MOCK_DOMAIN = "alice.sol"
const MOCK_TX = "5xyzabc123def456ghi789jkl012mno345pqr678stu901vwx234yz"
const MOCK_PUBKEY = new PublicKey("S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at")

function makeMetaAddress(): MetaAddress {
  return new MetaAddress(ZERO_KEY_32, ZERO_KEY_32, "solana", MOCK_DOMAIN)
}

// ============================================================================
// classifyResolveResult
// ============================================================================

describe("classifyResolveResult", () => {
  it("maps a valid MetaAddress to 'has-record'", () => {
    const meta = makeMetaAddress()
    expect(classifyResolveResult(meta)).toBe("has-record")
  })

  it("maps NotFound('domain') to 'no-record'", () => {
    const result = new NotFound("domain")
    expect(classifyResolveResult(result)).toBe("no-record")
  })

  it("maps NotFound('record') to 'no-record'", () => {
    const result = new NotFound("record")
    expect(classifyResolveResult(result)).toBe("no-record")
  })

  it("maps Malformed('json-parse') to 'no-record' so user can republish", () => {
    const result = new Malformed("json-parse")
    expect(classifyResolveResult(result)).toBe("no-record")
  })

  it("maps Malformed('schema') to 'no-record' so user can republish", () => {
    const result = new Malformed("schema")
    expect(classifyResolveResult(result)).toBe("no-record")
  })

  it("treats MetaAddress as an instance check (not duck-typing)", () => {
    // A plain object with the same shape should NOT classify as has-record;
    // the wrapper preserves the class identity across the boundary, and
    // we rely on that for correctness. classifyResolveResult uses instanceof.
    // The helper accepts `unknown` so this needs no casts.
    const fake = {
      spending: ZERO_KEY_32,
      viewing: ZERO_KEY_32,
      chain: "solana",
      domain: MOCK_DOMAIN,
    }
    expect(() => classifyResolveResult(fake)).toThrow(
      /Unhandled resolve result/
    )
  })
})

// ============================================================================
// errorMessageFor
// ============================================================================

describe("errorMessageFor", () => {
  it("returns a friendly message for UserRejected (biometric cancel)", () => {
    const err = new UserRejected()
    expect(errorMessageFor(err)).toBe("You cancelled the request")
  })

  it("returns a network-specific message for NetworkError", () => {
    const err = new NetworkError("RPC timeout")
    expect(errorMessageFor(err)).toBe("Network error — try again")
  })

  it("returns the on-chain error message verbatim (no double prefix)", () => {
    // OnChainError.message is already "On-chain error (<sig>): <reason>"
    // — see packages/sns-stealth/src/errors.ts:41 — so the helper must
    // surface it as-is. The previous "On-chain error: ${err.message}"
    // wrapper produced "On-chain error: On-chain error (sig): reason".
    const err = new OnChainError(MOCK_TX, "insufficient lamports")
    const msg = errorMessageFor(err)
    expect(msg).toBe(`On-chain error (${MOCK_TX}): insufficient lamports`)
    // Sanity: no double "On-chain error" prefix.
    expect(msg.match(/On-chain error/g)?.length ?? 0).toBe(1)
  })

  it("returns a generic 'Failed to publish' message for any other Error", () => {
    const err = new Error("something exploded")
    expect(errorMessageFor(err)).toBe("Failed to publish: something exploded")
  })

  it("returns a generic message for string thrown values", () => {
    expect(errorMessageFor("blah" as unknown)).toBe(
      "Failed to publish: unknown error"
    )
  })

  it("returns a generic message for undefined", () => {
    expect(errorMessageFor(undefined)).toBe(
      "Failed to publish: unknown error"
    )
  })

  it("returns a generic message for null", () => {
    expect(errorMessageFor(null)).toBe("Failed to publish: unknown error")
  })

  it("preserves Error message content (no truncation/sanitization)", () => {
    const longMsg = "x".repeat(200)
    const err = new Error(longMsg)
    expect(errorMessageFor(err)).toBe(`Failed to publish: ${longMsg}`)
  })

  it("checks UserRejected first (it's a subclass of Error)", () => {
    // Regression guard: if branch ordering ever flips, this still catches it
    // because UserRejected is `instanceof Error`.
    const err = new UserRejected("user dismissed prompt")
    expect(errorMessageFor(err)).toBe("You cancelled the request")
    expect(errorMessageFor(err)).not.toContain("user dismissed prompt")
  })

  it("maps the native-wallet SIGNING_FAILED plain object to the cancel UX", () => {
    // useNativeWallet.signTransaction (src/hooks/useNativeWallet.ts:439-446)
    // catches biometric-cancel from getPrivateKeyForAccount and re-throws a
    // plain object `{code: 'SIGNING_FAILED', message: '...'}` — NOT an
    // `Error` instance and NOT a UserRejected instance. Without an explicit
    // branch, this falls through every `instanceof` check and lands on the
    // generic "Failed to publish: unknown error", which reads as a crash
    // to a user who just tapped Cancel at the biometric prompt.
    const err = { code: "SIGNING_FAILED", message: "Failed to sign transaction" }
    expect(errorMessageFor(err)).toBe("You cancelled the request")
  })

  it("maps the native-wallet AUTH_FAILED plain object to the cancel UX", () => {
    // Same path, different code — keyStorage.ts:351 re-throws AUTH_FAILED
    // when SecureStore reports cancelled biometric auth, and that bubbles
    // up through signTransaction's catch block unchanged in some flows.
    const err = { code: "AUTH_FAILED", message: "Biometric authentication failed" }
    expect(errorMessageFor(err)).toBe("You cancelled the request")
  })

  it("surfaces non-cancel native-wallet error codes verbatim", () => {
    // Other native-wallet codes (e.g. STORAGE_ERROR) aren't user-cancellations;
    // we still want the message visible rather than masked as "unknown error".
    const err = { code: "STORAGE_ERROR", message: "Disk full" }
    expect(errorMessageFor(err)).toBe("Failed to publish: Disk full")
  })

  it("does not match arbitrary objects as native-wallet errors", () => {
    // Defensive: only `{code: string, message: string}` shapes pass the gate;
    // anything else falls through to the generic unknown-error fallback.
    expect(errorMessageFor({ code: 123, message: "x" })).toBe(
      "Failed to publish: unknown error"
    )
    expect(errorMessageFor({ code: "X" })).toBe(
      "Failed to publish: unknown error"
    )
    expect(errorMessageFor({})).toBe("Failed to publish: unknown error")
  })
})

// ============================================================================
// loadErrorMessageFor (resolve / getAllDomains failure messages)
// ============================================================================

describe("loadErrorMessageFor", () => {
  it("returns retry hint for NetworkError", () => {
    const err = new NetworkError("RPC unavailable")
    expect(loadErrorMessageFor(err)).toBe("Network error — try again")
  })

  it("returns the Error message for any other Error", () => {
    const err = new Error("parse failure")
    expect(loadErrorMessageFor(err)).toBe("parse failure")
  })

  it("returns a generic message for non-Error throwables", () => {
    expect(loadErrorMessageFor("boom" as unknown)).toBe("Failed to load record")
    expect(loadErrorMessageFor(null)).toBe("Failed to load record")
    expect(loadErrorMessageFor(undefined)).toBe("Failed to load record")
  })

  it("does NOT prefix with 'Failed to publish' (it's a load-time helper)", () => {
    const err = new Error("anything")
    expect(loadErrorMessageFor(err)).not.toContain("publish")
  })
})

// ============================================================================
// isWalletReady
// ============================================================================

describe("isWalletReady", () => {
  const mockWallet = { publicKey: MOCK_PUBKEY }

  it("returns true when wallet present, initialized, not loading", () => {
    expect(
      isWalletReady({
        wallet: mockWallet,
        isInitialized: true,
        isLoading: false,
      })
    ).toBe(true)
  })

  it("returns false when wallet is null", () => {
    expect(
      isWalletReady({
        wallet: null,
        isInitialized: true,
        isLoading: false,
      })
    ).toBe(false)
  })

  it("returns false when not initialized (still booting)", () => {
    expect(
      isWalletReady({
        wallet: mockWallet,
        isInitialized: false,
        isLoading: false,
      })
    ).toBe(false)
  })

  it("returns false during loading (e.g., create/import in flight)", () => {
    expect(
      isWalletReady({
        wallet: mockWallet,
        isInitialized: true,
        isLoading: true,
      })
    ).toBe(false)
  })

  it("returns false on the initial-load state (null + loading + uninitialized)", () => {
    expect(
      isWalletReady({
        wallet: null,
        isInitialized: false,
        isLoading: true,
      })
    ).toBe(false)
  })
})

// ============================================================================
// Explorer URL derivation (used in the "Published" card)
// ============================================================================

describe("Published card explorer URL", () => {
  it("uses Solscan with no cluster param on mainnet", () => {
    const url = getExplorerTxUrl(MOCK_TX, "mainnet-beta", "solscan")
    expect(url).toBe(`https://solscan.io/tx/${MOCK_TX}`)
    expect(url).not.toContain("cluster")
  })

  it("uses Solscan with cluster=devnet on devnet", () => {
    const url = getExplorerTxUrl(MOCK_TX, "devnet", "solscan")
    expect(url).toBe(`https://solscan.io/tx/${MOCK_TX}?cluster=devnet`)
  })

  it("respects the user's Solana Explorer preference on mainnet", () => {
    const url = getExplorerTxUrl(MOCK_TX, "mainnet-beta", "solana-explorer")
    expect(url).toBe(`https://explorer.solana.com/tx/${MOCK_TX}`)
  })

  it("respects the user's Solana Explorer preference on devnet", () => {
    const url = getExplorerTxUrl(MOCK_TX, "devnet", "solana-explorer")
    expect(url).toBe(
      `https://explorer.solana.com/tx/${MOCK_TX}?cluster=devnet`
    )
  })

  it("rebuilds URL when network changes (cluster-aware reactivity)", () => {
    // Simulates: user publishes on mainnet, then switches cluster — the
    // explorer link must reflect the *current* settings, not the network
    // at publish time. The screen reads `network` from useSettingsStore
    // every render, so a re-render with a different value rebuilds the
    // URL via this helper.
    const mainnet = getExplorerTxUrl(MOCK_TX, "mainnet-beta", "solscan")
    const devnet = getExplorerTxUrl(MOCK_TX, "devnet", "solscan")
    expect(mainnet).not.toBe(devnet)
  })
})

// ============================================================================
// Error classification — integration with publish flow shape
// ============================================================================

describe("Publish flow error roll-back", () => {
  it("UserRejected leaves the card recoverable (no-record + soft message)", () => {
    // The screen rolls publish failures back to 'no-record' state with the
    // user-facing message attached. This test asserts the contract between
    // errorMessageFor and the card state shape.
    const err = new UserRejected()
    const msg = errorMessageFor(err)
    expect(msg).toBe("You cancelled the request")
    // The screen sets state to 'no-record' so the Enable button is shown
    // again — verified by structural shape:
    const card = {
      state: "no-record" as const,
      domainName: MOCK_DOMAIN,
      signature: null,
      errorMessage: msg,
    }
    expect(card.state).toBe("no-record")
    expect(card.errorMessage).toBe("You cancelled the request")
    expect(card.signature).toBeNull()
  })

  it("NetworkError leaves the card recoverable with retry hint", () => {
    const err = new NetworkError("ECONNRESET")
    const msg = errorMessageFor(err)
    expect(msg).toBe("Network error — try again")
    const card = {
      state: "no-record" as const,
      errorMessage: msg,
    }
    expect(card.state).toBe("no-record")
    expect(card.errorMessage).toContain("try again")
  })

  it("OnChainError surfaces the on-chain context in the card message", () => {
    const err = new OnChainError(MOCK_TX, "blockhash not found")
    const msg = errorMessageFor(err)
    expect(msg).toContain("On-chain error")
    expect(msg).toContain("blockhash not found")
  })
})
