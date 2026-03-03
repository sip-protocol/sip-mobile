/**
 * Contact Utilities
 *
 * Business logic for contact screens: sorting, validation, formatting.
 * Pure functions — no React or store dependencies.
 */

import type { Contact } from "@/types/contacts"

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_NAME_LENGTH = 50
const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const STEALTH_META_REGEX = /^sip:solana:[1-9A-HJ-NP-Za-km-z]{32,44}:[1-9A-HJ-NP-Za-km-z]{32,44}$/
const DEFAULT_TRUNCATE_LENGTH = 16

// ============================================================================
// VALIDATION
// ============================================================================

interface ValidationResult {
  isValid: boolean
  error?: string
}

/**
 * Validate a contact name.
 * - Required (non-empty after trimming)
 * - Max 50 characters
 */
export function validateContactName(name: string): ValidationResult {
  const trimmed = name.trim()

  if (trimmed.length === 0) {
    return { isValid: false, error: "Name is required" }
  }

  if (trimmed.length > MAX_NAME_LENGTH) {
    return { isValid: false, error: `Name must be ${MAX_NAME_LENGTH} characters or less` }
  }

  return { isValid: true }
}

/**
 * Validate a contact address.
 * Accepts:
 * - Solana base58 address (32-44 alphanumeric, base58 charset)
 * - SIP stealth meta-address (sip:solana:<spendKey>:<viewKey>)
 */
export function validateContactAddress(address: string): ValidationResult {
  const trimmed = address.trim()

  if (trimmed.length === 0) {
    return { isValid: false, error: "Address is required" }
  }

  // Check stealth meta-address format
  if (trimmed.startsWith("sip:")) {
    if (STEALTH_META_REGEX.test(trimmed)) {
      return { isValid: true }
    }
    return { isValid: false, error: "Invalid stealth address. Expected format: sip:solana:<spendKey>:<viewKey>" }
  }

  // Check regular Solana address (base58, 32-44 chars)
  if (SOLANA_ADDRESS_REGEX.test(trimmed)) {
    return { isValid: true }
  }

  return { isValid: false, error: "Invalid Solana address (32-44 base58 characters)" }
}

// ============================================================================
// SORTING
// ============================================================================

/**
 * Sort contacts for the contact list display.
 *
 * Priority:
 * 1. Contacts with lastPaymentAt come first (most recent payment at top)
 * 2. Contacts without lastPaymentAt sorted by createdAt descending
 *
 * Does NOT mutate the original array.
 */
export function sortContacts(contacts: Contact[]): Contact[] {
  return [...contacts].sort((a, b) => {
    // Both have payment history — sort by most recent payment
    if (a.lastPaymentAt !== null && b.lastPaymentAt !== null) {
      if (b.lastPaymentAt !== a.lastPaymentAt) {
        return b.lastPaymentAt - a.lastPaymentAt
      }
      // Tie-break by createdAt descending
      return b.createdAt - a.createdAt
    }

    // Only one has payment history — prioritize the one with payments
    if (a.lastPaymentAt !== null && b.lastPaymentAt === null) return -1
    if (a.lastPaymentAt === null && b.lastPaymentAt !== null) return 1

    // Neither has payment history — sort by createdAt descending
    return b.createdAt - a.createdAt
  })
}

// ============================================================================
// FORMATTING
// ============================================================================

/**
 * Truncate an address for display with ellipsis in the middle.
 *
 * @param address - Full address string
 * @param maxLength - Maximum total display length (default 16)
 * @returns Truncated address like "FGSk...BWWr" or the original if short enough
 */
export function truncateAddress(address: string, maxLength = DEFAULT_TRUNCATE_LENGTH): string {
  if (!address) return ""

  if (address.length <= maxLength) return address

  // For stealth addresses, preserve the sip: prefix
  if (address.startsWith("sip:")) {
    const prefixEnd = 4 // "sip:"
    const remaining = maxLength - prefixEnd - 3 // subtract prefix and "..."
    if (remaining < 4) {
      // Not enough room — just truncate normally
      const half = Math.floor((maxLength - 3) / 2)
      return `${address.slice(0, half)}...${address.slice(-half)}`
    }
    const endChars = Math.floor(remaining / 2)
    const startChars = remaining - endChars
    return `sip:${address.slice(prefixEnd, prefixEnd + startChars)}...${address.slice(-endChars)}`
  }

  // Standard truncation: show start...end
  const half = Math.floor((maxLength - 3) / 2)
  return `${address.slice(0, half)}...${address.slice(-half)}`
}
