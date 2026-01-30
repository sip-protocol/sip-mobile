/**
 * Security Configuration Constants
 *
 * Centralized security-related constants to avoid duplication
 * and enable future environment variable support.
 *
 * @module constants/security
 */

// ============================================================================
// AUTHENTICATION
// ============================================================================

/** Session timeout in milliseconds (5 minutes) */
export const SESSION_TIMEOUT_MS = 5 * 60 * 1000

/** Max PIN attempts before lockout */
export const MAX_PIN_ATTEMPTS = 5

/** PIN lockout duration in milliseconds (5 minutes) */
export const PIN_LOCKOUT_MS = 5 * 60 * 1000

/** Default auth expiry in milliseconds (5 minutes) */
export const DEFAULT_AUTH_EXPIRY_MS = 5 * 60 * 1000

/** Clipboard auto-clear timeout in milliseconds (60 seconds) */
export const CLIPBOARD_CLEAR_TIMEOUT_MS = 60 * 1000

// ============================================================================
// REFRESH INTERVALS
// ============================================================================

/** Balance refresh interval in milliseconds (30 seconds) */
export const BALANCE_REFRESH_INTERVAL_MS = 30_000

/** Price refresh interval in milliseconds (60 seconds) */
export const PRICE_REFRESH_INTERVAL_MS = 60_000

/** Token price refresh interval in milliseconds (30 seconds) */
export const TOKEN_PRICE_REFRESH_MS = 30_000

/** Price staleness threshold in milliseconds (2 minutes) */
export const PRICE_STALE_THRESHOLD_MS = 2 * 60 * 1000

/** Minimum interval between background scans in seconds (15 minutes) */
export const MIN_BACKGROUND_SCAN_INTERVAL_SEC = 15 * 60

// ============================================================================
// STORAGE LIMITS
// ============================================================================

/** Maximum audit events to store */
export const MAX_AUDIT_EVENTS = 100

/** Maximum compliance reports to store */
export const MAX_COMPLIANCE_REPORTS = 10

/** Maximum swap history entries */
export const MAX_SWAP_HISTORY = 20

/** Maximum cached payments */
export const MAX_CACHED_PAYMENTS = 50

/** Maximum payment hashes to track (for duplicate detection) */
export const MAX_HASH_HISTORY = 1000

// ============================================================================
// VALIDATION
// ============================================================================

/** Maximum SOL amount (prevents overflow) */
export const MAX_SOL_AMOUNT = 1_000_000_000

/** Minimum SOL amount for transactions (1 lamport) */
export const MIN_SOL_AMOUNT = 0.000001

// ============================================================================
// AUTO-LOCK PRESETS
// ============================================================================

/** Auto-lock timeout presets in milliseconds */
export const AUTOLOCK_PRESETS = {
  immediate: 0,
  '1min': 60 * 1000,
  '5min': 5 * 60 * 1000,
  '15min': 15 * 60 * 1000,
  '30min': 30 * 60 * 1000,
  never: Infinity,
} as const

export type AutoLockPreset = keyof typeof AUTOLOCK_PRESETS
