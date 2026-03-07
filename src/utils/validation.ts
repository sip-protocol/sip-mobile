/**
 * Address validation utilities
 *
 * Single source of truth for Solana and SIP address patterns.
 */

export const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
export const STEALTH_ADDRESS_REGEX = /^sip:solana:[1-9A-HJ-NP-Za-km-z]{32,44}:[1-9A-HJ-NP-Za-km-z]{32,44}$/
export const SOLANA_PAY_REGEX = /^solana:([1-9A-HJ-NP-Za-km-z]{32,44})/

export function isValidSolanaAddress(address: string): boolean {
  return SOLANA_ADDRESS_REGEX.test(address)
}

export function isValidStealthAddress(address: string): boolean {
  return STEALTH_ADDRESS_REGEX.test(address)
}
