/**
 * Contacts Store Tests
 *
 * TDD: Tests written before implementation.
 * Covers all CRUD actions, favorites, payment recording, and edge cases.
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { useContactsStore } from "@/stores/contacts"
import type { Contact } from "@/types/contacts"

describe("Contacts Store", () => {
  const mockInput = {
    name: "Alice",
    address: "ALicE1111111111111111111111111111111111111",
    chain: "solana" as const,
    isFavorite: false,
  }

  const mockInputWithStealth = {
    name: "Bob",
    address: "BoB22222222222222222222222222222222222222222",
    stealthMeta: "sip:solana:0x02abc123:0x03def456",
    chain: "solana" as const,
    isFavorite: true,
  }

  const mockInputEthereum = {
    name: "Charlie",
    address: "0x1234567890abcdef1234567890abcdef12345678",
    chain: "ethereum" as const,
    isFavorite: false,
  }

  beforeEach(() => {
    // Reset store state between tests
    useContactsStore.setState({ contacts: [] })
  })

  // ============================================================================
  // addContact
  // ============================================================================

  describe("addContact", () => {
    it("should add a new contact with generated fields", () => {
      const { addContact } = useContactsStore.getState()

      const contact = addContact(mockInput)

      expect(contact).toBeDefined()
      expect(contact.id).toMatch(/^contact_\d+_[a-z0-9]+$/)
      expect(contact.name).toBe("Alice")
      expect(contact.address).toBe(mockInput.address)
      expect(contact.chain).toBe("solana")
      expect(contact.isFavorite).toBe(false)
      expect(contact.createdAt).toBeTypeOf("number")
      expect(contact.lastPaymentAt).toBeNull()
      expect(contact.paymentCount).toBe(0)
    })

    it("should persist the contact in state", () => {
      const { addContact } = useContactsStore.getState()

      addContact(mockInput)

      const { contacts } = useContactsStore.getState()
      expect(contacts).toHaveLength(1)
      expect(contacts[0].name).toBe("Alice")
    })

    it("should add contact with stealth meta-address", () => {
      const { addContact } = useContactsStore.getState()

      const contact = addContact(mockInputWithStealth)

      expect(contact.stealthMeta).toBe("sip:solana:0x02abc123:0x03def456")
      expect(contact.isFavorite).toBe(true)
    })

    it("should add contact with avatar URI", () => {
      const { addContact } = useContactsStore.getState()

      const contact = addContact({
        ...mockInput,
        avatarUri: "https://example.com/avatar.png",
      })

      expect(contact.avatarUri).toBe("https://example.com/avatar.png")
    })

    it("should add multiple contacts", () => {
      const { addContact } = useContactsStore.getState()

      addContact(mockInput)
      addContact(mockInputWithStealth)
      addContact(mockInputEthereum)

      expect(useContactsStore.getState().contacts).toHaveLength(3)
    })

    it("should generate unique IDs for each contact", () => {
      const { addContact } = useContactsStore.getState()

      const c1 = addContact(mockInput)
      const c2 = addContact(mockInputWithStealth)

      expect(c1.id).not.toBe(c2.id)
    })

    it("should set createdAt to current timestamp", () => {
      const now = 1709337600000
      vi.spyOn(Date, "now").mockReturnValue(now)

      const { addContact } = useContactsStore.getState()
      const contact = addContact(mockInput)

      expect(contact.createdAt).toBe(now)

      vi.restoreAllMocks()
    })
  })

  // ============================================================================
  // removeContact
  // ============================================================================

  describe("removeContact", () => {
    it("should remove a contact by ID", () => {
      const { addContact } = useContactsStore.getState()
      const contact = addContact(mockInput)

      useContactsStore.getState().removeContact(contact.id)

      expect(useContactsStore.getState().contacts).toHaveLength(0)
    })

    it("should only remove the specified contact", () => {
      const { addContact } = useContactsStore.getState()
      const c1 = addContact(mockInput)
      addContact(mockInputWithStealth)

      useContactsStore.getState().removeContact(c1.id)

      const { contacts } = useContactsStore.getState()
      expect(contacts).toHaveLength(1)
      expect(contacts[0].name).toBe("Bob")
    })

    it("should do nothing for non-existent ID", () => {
      const { addContact } = useContactsStore.getState()
      addContact(mockInput)

      useContactsStore.getState().removeContact("contact_nonexistent_abc1234")

      expect(useContactsStore.getState().contacts).toHaveLength(1)
    })
  })

  // ============================================================================
  // updateContact
  // ============================================================================

  describe("updateContact", () => {
    it("should update contact name", () => {
      const { addContact } = useContactsStore.getState()
      const contact = addContact(mockInput)

      useContactsStore.getState().updateContact(contact.id, { name: "Alice Updated" })

      const updated = useContactsStore.getState().contacts[0]
      expect(updated.name).toBe("Alice Updated")
    })

    it("should update contact address", () => {
      const { addContact } = useContactsStore.getState()
      const contact = addContact(mockInput)

      const newAddress = "NewAddr1111111111111111111111111111111111111"
      useContactsStore.getState().updateContact(contact.id, { address: newAddress })

      expect(useContactsStore.getState().contacts[0].address).toBe(newAddress)
    })

    it("should update stealth meta-address", () => {
      const { addContact } = useContactsStore.getState()
      const contact = addContact(mockInput)

      useContactsStore.getState().updateContact(contact.id, {
        stealthMeta: "sip:solana:0x02new:0x03new",
      })

      expect(useContactsStore.getState().contacts[0].stealthMeta).toBe(
        "sip:solana:0x02new:0x03new"
      )
    })

    it("should toggle favorite status", () => {
      const { addContact } = useContactsStore.getState()
      const contact = addContact(mockInput)

      useContactsStore.getState().updateContact(contact.id, { isFavorite: true })

      expect(useContactsStore.getState().contacts[0].isFavorite).toBe(true)
    })

    it("should apply partial updates without affecting other fields", () => {
      const { addContact } = useContactsStore.getState()
      const contact = addContact(mockInput)

      useContactsStore.getState().updateContact(contact.id, { name: "Updated" })

      const updated = useContactsStore.getState().contacts[0]
      expect(updated.name).toBe("Updated")
      expect(updated.address).toBe(mockInput.address)
      expect(updated.chain).toBe("solana")
      expect(updated.isFavorite).toBe(false)
    })

    it("should do nothing for non-existent ID", () => {
      const { addContact } = useContactsStore.getState()
      addContact(mockInput)

      useContactsStore.getState().updateContact("contact_nonexistent_abc1234", {
        name: "Ghost",
      })

      expect(useContactsStore.getState().contacts[0].name).toBe("Alice")
    })

    it("should not update other contacts", () => {
      const { addContact } = useContactsStore.getState()
      const c1 = addContact(mockInput)
      addContact(mockInputWithStealth)

      useContactsStore.getState().updateContact(c1.id, { name: "Alice V2" })

      const contacts = useContactsStore.getState().contacts
      expect(contacts.find((c) => c.id === c1.id)?.name).toBe("Alice V2")
      expect(contacts.find((c) => c.name === "Bob")).toBeDefined()
    })
  })

  // ============================================================================
  // getContactByAddress
  // ============================================================================

  describe("getContactByAddress", () => {
    it("should find contact by address", () => {
      const { addContact } = useContactsStore.getState()
      addContact(mockInput)

      const found = useContactsStore.getState().getContactByAddress(mockInput.address)

      expect(found).toBeDefined()
      expect(found?.name).toBe("Alice")
    })

    it("should return undefined for unknown address", () => {
      const found = useContactsStore.getState().getContactByAddress(
        "Unknown111111111111111111111111111111111111"
      )

      expect(found).toBeUndefined()
    })

    it("should return the correct contact among multiple", () => {
      const { addContact } = useContactsStore.getState()
      addContact(mockInput)
      addContact(mockInputWithStealth)
      addContact(mockInputEthereum)

      const found = useContactsStore.getState().getContactByAddress(
        mockInputWithStealth.address
      )

      expect(found?.name).toBe("Bob")
    })
  })

  // ============================================================================
  // getFavorites
  // ============================================================================

  describe("getFavorites", () => {
    it("should return empty array when no favorites", () => {
      const { addContact } = useContactsStore.getState()
      addContact(mockInput) // not favorite

      const favorites = useContactsStore.getState().getFavorites()

      expect(favorites).toHaveLength(0)
    })

    it("should return only favorited contacts", () => {
      const { addContact } = useContactsStore.getState()
      addContact(mockInput) // isFavorite: false
      addContact(mockInputWithStealth) // isFavorite: true

      const favorites = useContactsStore.getState().getFavorites()

      expect(favorites).toHaveLength(1)
      expect(favorites[0].name).toBe("Bob")
    })

    it("should return multiple favorites", () => {
      const { addContact } = useContactsStore.getState()
      addContact({ ...mockInput, isFavorite: true })
      addContact(mockInputWithStealth) // isFavorite: true
      addContact(mockInputEthereum) // isFavorite: false

      const favorites = useContactsStore.getState().getFavorites()

      expect(favorites).toHaveLength(2)
    })

    it("should reflect updates to favorite status", () => {
      const { addContact } = useContactsStore.getState()
      const contact = addContact(mockInput)

      // Initially not favorite
      expect(useContactsStore.getState().getFavorites()).toHaveLength(0)

      // Toggle to favorite
      useContactsStore.getState().updateContact(contact.id, { isFavorite: true })

      expect(useContactsStore.getState().getFavorites()).toHaveLength(1)
    })
  })

  // ============================================================================
  // recordPayment
  // ============================================================================

  describe("recordPayment", () => {
    it("should increment payment count", () => {
      const { addContact } = useContactsStore.getState()
      const contact = addContact(mockInput)

      useContactsStore.getState().recordPayment(contact.id)

      const updated = useContactsStore.getState().contacts[0]
      expect(updated.paymentCount).toBe(1)
    })

    it("should set lastPaymentAt to current timestamp", () => {
      const now = 1709337600000
      vi.spyOn(Date, "now").mockReturnValue(now)

      const { addContact } = useContactsStore.getState()
      const contact = addContact(mockInput)

      // Restore and set new time for payment
      vi.restoreAllMocks()
      const paymentTime = 1709341200000
      vi.spyOn(Date, "now").mockReturnValue(paymentTime)

      useContactsStore.getState().recordPayment(contact.id)

      const updated = useContactsStore.getState().contacts[0]
      expect(updated.lastPaymentAt).toBe(paymentTime)

      vi.restoreAllMocks()
    })

    it("should increment count on multiple payments", () => {
      const { addContact } = useContactsStore.getState()
      const contact = addContact(mockInput)

      useContactsStore.getState().recordPayment(contact.id)
      useContactsStore.getState().recordPayment(contact.id)
      useContactsStore.getState().recordPayment(contact.id)

      expect(useContactsStore.getState().contacts[0].paymentCount).toBe(3)
    })

    it("should do nothing for non-existent contact ID", () => {
      const { addContact } = useContactsStore.getState()
      addContact(mockInput)

      // Should not throw
      useContactsStore.getState().recordPayment("contact_nonexistent_abc1234")

      expect(useContactsStore.getState().contacts[0].paymentCount).toBe(0)
    })

    it("should only update the specified contact", () => {
      const { addContact } = useContactsStore.getState()
      const c1 = addContact(mockInput)
      addContact(mockInputWithStealth)

      useContactsStore.getState().recordPayment(c1.id)

      const contacts = useContactsStore.getState().contacts
      const alice = contacts.find((c) => c.id === c1.id)
      const bob = contacts.find((c) => c.name === "Bob")
      expect(alice?.paymentCount).toBe(1)
      expect(bob?.paymentCount).toBe(0)
    })
  })

  // ============================================================================
  // Edge cases
  // ============================================================================

  describe("edge cases", () => {
    it("should handle empty store gracefully", () => {
      const state = useContactsStore.getState()

      expect(state.contacts).toHaveLength(0)
      expect(state.getFavorites()).toHaveLength(0)
      expect(state.getContactByAddress("any")).toBeUndefined()
    })

    it("should handle contact with minimal fields", () => {
      const { addContact } = useContactsStore.getState()

      const contact = addContact({
        name: "Minimal",
        address: "Min11111111111111111111111111111111111111111",
        chain: "solana",
        isFavorite: false,
      })

      expect(contact.stealthMeta).toBeUndefined()
      expect(contact.avatarUri).toBeUndefined()
    })

    it("should support NEAR chain contacts", () => {
      const { addContact } = useContactsStore.getState()

      const contact = addContact({
        name: "Near User",
        address: "nearuser.near",
        chain: "near",
        isFavorite: false,
      })

      expect(contact.chain).toBe("near")
    })

    it("should preserve contacts order after operations", () => {
      const { addContact } = useContactsStore.getState()

      const c1 = addContact(mockInput)
      addContact(mockInputWithStealth)
      const c3 = addContact(mockInputEthereum)

      // Update middle contact
      useContactsStore.getState().updateContact(c1.id, { name: "Alice Updated" })
      // Record payment on last
      useContactsStore.getState().recordPayment(c3.id)

      const contacts = useContactsStore.getState().contacts
      expect(contacts).toHaveLength(3)
      expect(contacts[0].name).toBe("Alice Updated")
      expect(contacts[1].name).toBe("Bob")
      expect(contacts[2].name).toBe("Charlie")
    })
  })

  // ============================================================================
  // Persistence configuration
  // ============================================================================

  describe("persistence", () => {
    it("should have the correct storage key", () => {
      // Zustand persist stores the storage name in the persist API
      const persistOptions = (useContactsStore as any).persist
      expect(persistOptions).toBeDefined()
      expect(persistOptions.getOptions().name).toBe("sip-contacts-storage")
    })
  })
})
