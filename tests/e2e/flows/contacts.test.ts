/**
 * Contact & Social Payment Flow E2E Tests
 *
 * Tests the complete contact management and pay-by-contact flow:
 * 1. Add contacts with validation
 * 2. Look up contacts by address
 * 3. Sort and filter contacts
 * 4. Record payments and track history
 * 5. Full flow: Add -> Look up -> Pay -> Verify
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { useContactsStore } from "@/stores/contacts"
import {
  validateContactName,
  validateContactAddress,
  sortContacts,
  truncateAddress,
} from "@/utils/contacts"
import type { Contact, CreateContactInput } from "@/types/contacts"

// ============================================================================
// Helpers
// ============================================================================

function createContactInput(overrides: Partial<CreateContactInput> = {}): CreateContactInput {
  return {
    name: "Alice",
    address: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    chain: "solana",
    isFavorite: false,
    ...overrides,
  }
}

const VALID_SOLANA_ADDRESS = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
const VALID_STEALTH_META = "sip:solana:7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU:3Jv9fzVuYxE3FzLhD8WtMnNYcLYQdCQn9GhT5RrAnS1Y"

// ============================================================================
// Tests
// ============================================================================

describe("Contact & Social Payment Flow E2E", () => {
  beforeEach(() => {
    // Reset the contacts store to empty state
    useContactsStore.setState({ contacts: [] })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("Contact Name Validation", () => {
    it("should reject empty name", () => {
      const result = validateContactName("")
      expect(result.isValid).toBe(false)
      expect(result.error).toContain("required")
    })

    it("should reject whitespace-only name", () => {
      const result = validateContactName("   ")
      expect(result.isValid).toBe(false)
      expect(result.error).toContain("required")
    })

    it("should reject name exceeding 50 characters", () => {
      const longName = "A".repeat(51)
      const result = validateContactName(longName)
      expect(result.isValid).toBe(false)
      expect(result.error).toContain("50")
    })

    it("should accept valid name at max length", () => {
      const maxName = "A".repeat(50)
      const result = validateContactName(maxName)
      expect(result.isValid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it("should accept normal name", () => {
      const result = validateContactName("Alice")
      expect(result.isValid).toBe(true)
    })
  })

  describe("Contact Address Validation", () => {
    it("should reject empty address", () => {
      const result = validateContactAddress("")
      expect(result.isValid).toBe(false)
      expect(result.error).toContain("required")
    })

    it("should reject invalid non-base58 address", () => {
      const result = validateContactAddress("0xinvalid-eth-address")
      expect(result.isValid).toBe(false)
      expect(result.error).toContain("Invalid")
    })

    it("should reject too-short address", () => {
      const result = validateContactAddress("abc")
      expect(result.isValid).toBe(false)
    })

    it("should accept valid base58 Solana address", () => {
      const result = validateContactAddress(VALID_SOLANA_ADDRESS)
      expect(result.isValid).toBe(true)
    })

    it("should accept valid stealth meta-address", () => {
      const result = validateContactAddress(VALID_STEALTH_META)
      expect(result.isValid).toBe(true)
    })

    it("should reject malformed stealth address", () => {
      const result = validateContactAddress("sip:solana:invalid")
      expect(result.isValid).toBe(false)
      expect(result.error).toContain("stealth")
    })
  })

  describe("Add Contact", () => {
    it("should add a new contact with auto-generated fields", () => {
      const store = useContactsStore.getState()
      const input = createContactInput()

      const contact = store.addContact(input)

      expect(contact.id).toMatch(/^contact_/)
      expect(contact.name).toBe("Alice")
      expect(contact.address).toBe(VALID_SOLANA_ADDRESS)
      expect(contact.chain).toBe("solana")
      expect(contact.isFavorite).toBe(false)
      expect(contact.paymentCount).toBe(0)
      expect(contact.lastPaymentAt).toBeNull()
      expect(contact.createdAt).toBeGreaterThan(0)
    })

    it("should add contact with stealth meta", () => {
      const store = useContactsStore.getState()
      const input = createContactInput({
        stealthMeta: VALID_STEALTH_META,
      })

      const contact = store.addContact(input)
      expect(contact.stealthMeta).toBe(VALID_STEALTH_META)
    })

    it("should add favorite contact", () => {
      const store = useContactsStore.getState()
      const input = createContactInput({ isFavorite: true })

      const contact = store.addContact(input)
      expect(contact.isFavorite).toBe(true)
    })

    it("should persist contact in store state", () => {
      const store = useContactsStore.getState()
      store.addContact(createContactInput())

      const contacts = useContactsStore.getState().contacts
      expect(contacts).toHaveLength(1)
      expect(contacts[0].name).toBe("Alice")
    })
  })

  describe("Look Up Contact", () => {
    it("should find contact by address", () => {
      const store = useContactsStore.getState()
      store.addContact(createContactInput())

      const found = useContactsStore.getState().getContactByAddress(VALID_SOLANA_ADDRESS)
      expect(found).toBeDefined()
      expect(found!.name).toBe("Alice")
    })

    it("should return undefined for unknown address", () => {
      const store = useContactsStore.getState()
      store.addContact(createContactInput())

      const found = useContactsStore.getState().getContactByAddress("UnknownAddress1111111111111111111")
      expect(found).toBeUndefined()
    })
  })

  describe("Favorites", () => {
    it("should filter favorites only", () => {
      const store = useContactsStore.getState()
      store.addContact(createContactInput({ name: "Alice", isFavorite: true }))
      store.addContact(createContactInput({
        name: "Bob",
        address: "3Jv9fzVuYxE3FzLhD8WtMnNYcLYQdCQn9GhT5RrAnS1Y",
        isFavorite: false,
      }))

      const favorites = useContactsStore.getState().getFavorites()
      expect(favorites).toHaveLength(1)
      expect(favorites[0].name).toBe("Alice")
    })

    it("should toggle favorite via updateContact", () => {
      const store = useContactsStore.getState()
      const contact = store.addContact(createContactInput({ isFavorite: false }))

      useContactsStore.getState().updateContact(contact.id, { isFavorite: true })

      const updated = useContactsStore.getState().contacts.find((c) => c.id === contact.id)
      expect(updated!.isFavorite).toBe(true)
    })
  })

  describe("Record Payment", () => {
    it("should increment paymentCount", () => {
      const store = useContactsStore.getState()
      const contact = store.addContact(createContactInput())

      useContactsStore.getState().recordPayment(contact.id)

      const updated = useContactsStore.getState().contacts.find((c) => c.id === contact.id)
      expect(updated!.paymentCount).toBe(1)
    })

    it("should set lastPaymentAt timestamp", () => {
      const store = useContactsStore.getState()
      const contact = store.addContact(createContactInput())

      useContactsStore.getState().recordPayment(contact.id)

      const updated = useContactsStore.getState().contacts.find((c) => c.id === contact.id)
      expect(updated!.lastPaymentAt).not.toBeNull()
      expect(updated!.lastPaymentAt!).toBeGreaterThan(0)
    })

    it("should increment paymentCount on successive payments", () => {
      const store = useContactsStore.getState()
      const contact = store.addContact(createContactInput())

      useContactsStore.getState().recordPayment(contact.id)
      useContactsStore.getState().recordPayment(contact.id)
      useContactsStore.getState().recordPayment(contact.id)

      const updated = useContactsStore.getState().contacts.find((c) => c.id === contact.id)
      expect(updated!.paymentCount).toBe(3)
    })
  })

  describe("Delete Contact", () => {
    it("should remove contact from store", () => {
      const store = useContactsStore.getState()
      const contact = store.addContact(createContactInput())

      useContactsStore.getState().removeContact(contact.id)

      const contacts = useContactsStore.getState().contacts
      expect(contacts).toHaveLength(0)
    })

    it("should not affect other contacts when deleting", () => {
      const store = useContactsStore.getState()
      const alice = store.addContact(createContactInput({ name: "Alice" }))
      store.addContact(createContactInput({
        name: "Bob",
        address: "3Jv9fzVuYxE3FzLhD8WtMnNYcLYQdCQn9GhT5RrAnS1Y",
      }))

      useContactsStore.getState().removeContact(alice.id)

      const contacts = useContactsStore.getState().contacts
      expect(contacts).toHaveLength(1)
      expect(contacts[0].name).toBe("Bob")
    })
  })

  describe("Contact Sorting", () => {
    it("should sort contacts with recent payments first", () => {
      const now = Date.now()
      const contacts: Contact[] = [
        { id: "1", name: "No Pay", address: "a", chain: "solana", createdAt: now - 1000, lastPaymentAt: null, paymentCount: 0, isFavorite: false },
        { id: "2", name: "Old Pay", address: "b", chain: "solana", createdAt: now - 2000, lastPaymentAt: now - 5000, paymentCount: 1, isFavorite: false },
        { id: "3", name: "Recent Pay", address: "c", chain: "solana", createdAt: now - 3000, lastPaymentAt: now - 100, paymentCount: 3, isFavorite: false },
      ]

      const sorted = sortContacts(contacts)
      expect(sorted[0].name).toBe("Recent Pay")
      expect(sorted[1].name).toBe("Old Pay")
      expect(sorted[2].name).toBe("No Pay")
    })

    it("should sort no-payment contacts by creation date descending", () => {
      const now = Date.now()
      const contacts: Contact[] = [
        { id: "1", name: "Oldest", address: "a", chain: "solana", createdAt: now - 3000, lastPaymentAt: null, paymentCount: 0, isFavorite: false },
        { id: "2", name: "Newest", address: "b", chain: "solana", createdAt: now, lastPaymentAt: null, paymentCount: 0, isFavorite: false },
        { id: "3", name: "Middle", address: "c", chain: "solana", createdAt: now - 1000, lastPaymentAt: null, paymentCount: 0, isFavorite: false },
      ]

      const sorted = sortContacts(contacts)
      expect(sorted[0].name).toBe("Newest")
      expect(sorted[1].name).toBe("Middle")
      expect(sorted[2].name).toBe("Oldest")
    })

    it("should not mutate the original array", () => {
      const contacts: Contact[] = [
        { id: "1", name: "A", address: "a", chain: "solana", createdAt: 100, lastPaymentAt: null, paymentCount: 0, isFavorite: false },
        { id: "2", name: "B", address: "b", chain: "solana", createdAt: 200, lastPaymentAt: null, paymentCount: 0, isFavorite: false },
      ]

      const sorted = sortContacts(contacts)
      expect(sorted).not.toBe(contacts)
      expect(contacts[0].name).toBe("A")
    })
  })

  describe("Address Truncation", () => {
    it("should truncate long Solana address", () => {
      const truncated = truncateAddress(VALID_SOLANA_ADDRESS)
      expect(truncated.length).toBeLessThanOrEqual(16)
      expect(truncated).toContain("...")
    })

    it("should preserve short addresses", () => {
      const short = "abc123"
      const truncated = truncateAddress(short)
      expect(truncated).toBe(short)
    })

    it("should handle empty address", () => {
      expect(truncateAddress("")).toBe("")
    })
  })

  describe("Full Flow: Add -> Look Up -> Pay -> Verify", () => {
    it("should complete the full contact payment flow", () => {
      const store = useContactsStore.getState()

      // Step 1: Validate and add contact
      const nameValid = validateContactName("Alice")
      const addrValid = validateContactAddress(VALID_SOLANA_ADDRESS)
      expect(nameValid.isValid).toBe(true)
      expect(addrValid.isValid).toBe(true)

      const contact = store.addContact(createContactInput())

      // Step 2: Look up contact by address
      const found = useContactsStore.getState().getContactByAddress(VALID_SOLANA_ADDRESS)
      expect(found).toBeDefined()
      expect(found!.id).toBe(contact.id)

      // Step 3: Record a payment
      useContactsStore.getState().recordPayment(contact.id)

      // Step 4: Verify payment was tracked
      const updated = useContactsStore.getState().contacts.find((c) => c.id === contact.id)
      expect(updated!.paymentCount).toBe(1)
      expect(updated!.lastPaymentAt).not.toBeNull()
    })

    it("should prepare send params from contact lookup", () => {
      const store = useContactsStore.getState()

      // Add contact with stealth meta
      store.addContact(createContactInput({
        name: "Bob",
        address: VALID_SOLANA_ADDRESS,
        stealthMeta: VALID_STEALTH_META,
      }))

      // Look up by name (simulated as address lookup)
      const contact = useContactsStore.getState().getContactByAddress(VALID_SOLANA_ADDRESS)
      expect(contact).toBeDefined()

      // Prepare send params from contact
      const sendParams = {
        recipient: contact!.stealthMeta || contact!.address,
        amount: "1.5",
        privacyLevel: contact!.stealthMeta ? "shielded" as const : "transparent" as const,
      }

      expect(sendParams.recipient).toBe(VALID_STEALTH_META)
      expect(sendParams.privacyLevel).toBe("shielded")
    })
  })
})
