/**
 * Contact Screens Tests
 *
 * Tests business logic for contact list and add contact screens:
 * - Contact sorting (by lastPaymentAt desc, then createdAt desc)
 * - Address validation (Solana base58, stealth meta-address)
 * - Name validation (required, max 50 chars)
 * - Address truncation for display
 */

import { describe, it, expect } from "vitest"
import {
  sortContacts,
  validateContactName,
  validateContactAddress,
  truncateAddress,
} from "@/utils/contacts"
import type { Contact } from "@/types/contacts"

// ============================================================================
// TEST HELPERS
// ============================================================================

function makeContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: `contact_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    name: "Test Contact",
    address: "TestAddr11111111111111111111111111111111111",
    chain: "solana",
    isFavorite: false,
    createdAt: Date.now(),
    lastPaymentAt: null,
    paymentCount: 0,
    ...overrides,
  }
}

// ============================================================================
// SORTING
// ============================================================================

describe("sortContacts", () => {
  it("should return empty array for empty input", () => {
    expect(sortContacts([])).toEqual([])
  })

  it("should return single contact as-is", () => {
    const contact = makeContact({ name: "Alice" })
    const result = sortContacts([contact])
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe("Alice")
  })

  it("should sort by lastPaymentAt descending (most recent first)", () => {
    const old = makeContact({ name: "Old", lastPaymentAt: 1000 })
    const recent = makeContact({ name: "Recent", lastPaymentAt: 5000 })
    const middle = makeContact({ name: "Middle", lastPaymentAt: 3000 })

    const result = sortContacts([old, recent, middle])

    expect(result[0].name).toBe("Recent")
    expect(result[1].name).toBe("Middle")
    expect(result[2].name).toBe("Old")
  })

  it("should put contacts with lastPaymentAt before those without", () => {
    const neverPaid = makeContact({ name: "Never", lastPaymentAt: null, createdAt: 9000 })
    const paid = makeContact({ name: "Paid", lastPaymentAt: 1000, createdAt: 1000 })

    const result = sortContacts([neverPaid, paid])

    expect(result[0].name).toBe("Paid")
    expect(result[1].name).toBe("Never")
  })

  it("should sort by createdAt descending when lastPaymentAt is the same (both null)", () => {
    const older = makeContact({ name: "Older", lastPaymentAt: null, createdAt: 1000 })
    const newer = makeContact({ name: "Newer", lastPaymentAt: null, createdAt: 5000 })

    const result = sortContacts([older, newer])

    expect(result[0].name).toBe("Newer")
    expect(result[1].name).toBe("Older")
  })

  it("should sort by createdAt descending when lastPaymentAt is equal", () => {
    const older = makeContact({ name: "Older", lastPaymentAt: 2000, createdAt: 1000 })
    const newer = makeContact({ name: "Newer", lastPaymentAt: 2000, createdAt: 5000 })

    const result = sortContacts([older, newer])

    expect(result[0].name).toBe("Newer")
    expect(result[1].name).toBe("Older")
  })

  it("should handle mixed paid and unpaid contacts", () => {
    const a = makeContact({ name: "A", lastPaymentAt: 5000, createdAt: 1000 })
    const b = makeContact({ name: "B", lastPaymentAt: null, createdAt: 9000 })
    const c = makeContact({ name: "C", lastPaymentAt: 3000, createdAt: 2000 })
    const d = makeContact({ name: "D", lastPaymentAt: null, createdAt: 500 })

    const result = sortContacts([b, d, a, c])

    expect(result.map((c) => c.name)).toEqual(["A", "C", "B", "D"])
  })

  it("should not mutate the original array", () => {
    const contacts = [
      makeContact({ name: "B", lastPaymentAt: 1000 }),
      makeContact({ name: "A", lastPaymentAt: 5000 }),
    ]
    const original = [...contacts]

    sortContacts(contacts)

    expect(contacts[0].name).toBe(original[0].name)
    expect(contacts[1].name).toBe(original[1].name)
  })
})

// ============================================================================
// NAME VALIDATION
// ============================================================================

describe("validateContactName", () => {
  it("should reject empty string", () => {
    const result = validateContactName("")
    expect(result.isValid).toBe(false)
    expect(result.error).toBeDefined()
  })

  it("should reject whitespace-only string", () => {
    const result = validateContactName("   ")
    expect(result.isValid).toBe(false)
    expect(result.error).toBeDefined()
  })

  it("should accept valid name", () => {
    const result = validateContactName("Alice")
    expect(result.isValid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it("should accept single character name", () => {
    const result = validateContactName("A")
    expect(result.isValid).toBe(true)
  })

  it("should accept name at max length (50 chars)", () => {
    const name = "A".repeat(50)
    const result = validateContactName(name)
    expect(result.isValid).toBe(true)
  })

  it("should reject name exceeding 50 chars", () => {
    const name = "A".repeat(51)
    const result = validateContactName(name)
    expect(result.isValid).toBe(false)
    expect(result.error).toBeDefined()
  })

  it("should accept name with spaces", () => {
    const result = validateContactName("Alice Bob")
    expect(result.isValid).toBe(true)
  })

  it("should accept name with special characters", () => {
    const result = validateContactName("Alice's Wallet")
    expect(result.isValid).toBe(true)
  })

  it("should trim and validate (leading/trailing spaces should be trimmed)", () => {
    const result = validateContactName("  Alice  ")
    expect(result.isValid).toBe(true)
  })
})

// ============================================================================
// ADDRESS VALIDATION
// ============================================================================

describe("validateContactAddress", () => {
  // Valid Solana addresses
  it("should accept valid Solana address (44 chars)", () => {
    const result = validateContactAddress("ALicE111111111111111111111111111111111111111")
    expect(result.isValid).toBe(true)
  })

  it("should accept valid Solana address (32 chars)", () => {
    const result = validateContactAddress("11111111111111111111111111111111")
    expect(result.isValid).toBe(true)
  })

  it("should accept base58 address with mixed case", () => {
    const result = validateContactAddress("FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr")
    expect(result.isValid).toBe(true)
  })

  // Valid stealth meta-addresses
  it("should accept valid stealth meta-address", () => {
    // Use valid base58 chars only (no 0, O, I, l)
    const spendKey = "Abc123456789abcdefghijk123456789abcdefghijk"
    const viewKey = "Def123456789abcdefghijk123456789abcdefghijk"
    const result = validateContactAddress(`sip:solana:${spendKey}:${viewKey}`)
    expect(result.isValid).toBe(true)
  })

  it("should accept sip: prefix for generic stealth address", () => {
    // Both keys 32-44 chars, valid base58
    const spendKey = "SpendKeyABCDEFGH123456789abcdefgh"
    const viewKey = "ViewKeyABCDEFGH1234567899abcdefgh"
    const result = validateContactAddress(`sip:solana:${spendKey}:${viewKey}`)
    expect(result.isValid).toBe(true)
  })

  // Invalid addresses
  it("should reject empty string", () => {
    const result = validateContactAddress("")
    expect(result.isValid).toBe(false)
    expect(result.error).toBeDefined()
  })

  it("should reject whitespace-only string", () => {
    const result = validateContactAddress("   ")
    expect(result.isValid).toBe(false)
    expect(result.error).toBeDefined()
  })

  it("should reject address too short (< 32 chars)", () => {
    const result = validateContactAddress("TooShort123")
    expect(result.isValid).toBe(false)
  })

  it("should reject address too long (> 44 chars)", () => {
    const result = validateContactAddress("A".repeat(45))
    expect(result.isValid).toBe(false)
  })

  it("should reject address with invalid base58 characters (0, O, I, l)", () => {
    // '0' is not in base58
    const result = validateContactAddress("0" + "1".repeat(31))
    expect(result.isValid).toBe(false)
  })

  it("should reject malformed stealth address (missing chain)", () => {
    const result = validateContactAddress("sip:SpendKey123:ViewKey456")
    expect(result.isValid).toBe(false)
  })

  it("should reject sip: address without solana chain", () => {
    const result = validateContactAddress("sip:ethereum:SpendKey123:ViewKey456")
    // For now, only sip:solana: is valid
    expect(result.isValid).toBe(false)
  })
})

// ============================================================================
// ADDRESS TRUNCATION
// ============================================================================

describe("truncateAddress", () => {
  it("should truncate long address with ellipsis", () => {
    const address = "FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr"
    const result = truncateAddress(address)
    expect(result).toContain("...")
    expect(result.length).toBeLessThan(address.length)
  })

  it("should show start and end of address", () => {
    const address = "FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr"
    const result = truncateAddress(address)
    expect(result.startsWith("FGSk")).toBe(true)
    expect(result.endsWith("BWWr")).toBe(true)
  })

  it("should return short address as-is", () => {
    const address = "Short"
    const result = truncateAddress(address, 10)
    expect(result).toBe("Short")
  })

  it("should handle stealth meta-addresses", () => {
    const address = "sip:solana:SpendKey123456789012345:ViewKey123456789012345"
    const result = truncateAddress(address)
    expect(result).toContain("...")
    expect(result.startsWith("sip:")).toBe(true)
  })

  it("should accept custom maxLength parameter", () => {
    const address = "FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr"
    const short = truncateAddress(address, 12)
    const long = truncateAddress(address, 24)
    expect(short.length).toBeLessThanOrEqual(12)
    expect(long.length).toBeLessThanOrEqual(24)
  })

  it("should handle empty string", () => {
    const result = truncateAddress("")
    expect(result).toBe("")
  })
})
