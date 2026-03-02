/**
 * Payment Request URL Utilities
 *
 * Create and parse sipprotocol:// deep link URLs for sharing
 * payment requests between SIP wallets. The receive screen
 * generates these URLs; the send screen consumes them.
 *
 * NOTE: Uses manual URL construction — React Native does not
 * have the URL class available by default.
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const SCHEME = "sipprotocol"
const HOST = "pay"
const URL_PREFIX = `${SCHEME}://${HOST}`

// ============================================================================
// TYPES
// ============================================================================

export interface PaymentRequestParams {
  stealthAddress: string
  amount?: string
  token?: string
  memo?: string
}

// ============================================================================
// CREATE
// ============================================================================

/**
 * Build a sipprotocol://pay?address=...&amount=...&token=...&memo=... URL.
 *
 * Only includes optional params when they have a value.
 * All param values are URL-encoded for safe transport.
 */
export function createPaymentRequest(params: PaymentRequestParams): string {
  const pairs: string[] = [
    `address=${encodeURIComponent(params.stealthAddress)}`,
  ]

  if (params.amount !== undefined) {
    pairs.push(`amount=${encodeURIComponent(params.amount)}`)
  }

  if (params.token !== undefined) {
    pairs.push(`token=${encodeURIComponent(params.token)}`)
  }

  if (params.memo !== undefined) {
    pairs.push(`memo=${encodeURIComponent(params.memo)}`)
  }

  return `${URL_PREFIX}?${pairs.join("&")}`
}

// ============================================================================
// PARSE
// ============================================================================

/**
 * Parse a sipprotocol://pay?... URL back into PaymentRequestParams.
 *
 * @throws {Error} If the URL scheme/path is invalid or address is missing.
 */
export function parsePaymentRequest(url: string): PaymentRequestParams {
  // Split scheme from the rest: "sipprotocol://pay?..."
  const schemeEnd = url.indexOf("://")
  if (schemeEnd === -1) {
    throw new Error("Invalid payment request URL: missing scheme")
  }

  const scheme = url.slice(0, schemeEnd)
  if (scheme !== SCHEME) {
    throw new Error(`Invalid payment request URL: expected scheme "${SCHEME}", got "${scheme}"`)
  }

  const afterScheme = url.slice(schemeEnd + 3) // skip "://"

  // Split host/path from query string
  const queryStart = afterScheme.indexOf("?")
  const host = queryStart === -1 ? afterScheme : afterScheme.slice(0, queryStart)

  if (host !== HOST) {
    throw new Error(`Invalid payment request URL: expected path "${HOST}", got "${host}"`)
  }

  if (queryStart === -1) {
    throw new Error("Invalid payment request URL: missing query parameters")
  }

  const queryString = afterScheme.slice(queryStart + 1)

  // Parse query params manually (no URL class in RN)
  const paramMap = new Map<string, string>()
  const segments = queryString.split("&")
  for (const segment of segments) {
    const eqIndex = segment.indexOf("=")
    if (eqIndex === -1) continue

    const key = segment.slice(0, eqIndex)
    const value = decodeURIComponent(segment.slice(eqIndex + 1))
    paramMap.set(key, value)
  }

  const address = paramMap.get("address")
  if (!address) {
    throw new Error("Invalid payment request URL: missing required 'address' parameter")
  }

  return {
    stealthAddress: address,
    amount: paramMap.get("amount") || undefined,
    token: paramMap.get("token") || undefined,
    memo: paramMap.get("memo") || undefined,
  }
}
