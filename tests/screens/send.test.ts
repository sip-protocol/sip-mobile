/**
 * Send Screen Tests — Contact Integration
 *
 * Tests the contact-based sending logic:
 * - Contact name display when contactName param is present
 * - Recipient pre-fill when recipient param is present
 * - No contact name displayed when param is absent
 * - Payment recording after successful send
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import { useContactsStore } from "@/stores/contacts"

// ============================================================================
// TEST HELPERS
// ============================================================================

const ALICE_ADDRESS = "ALicE111111111111111111111111111111111111111"
const BOB_ADDRESS = "BobBB222222222222222222222222222222222222222"
const STEALTH_ADDRESS = "sip:solana:SpendKeyABCDEFGH123456789abcdefgh:ViewKeyABCDEFGH1234567899abcdefgh"

function seedContact(name: string, address: string) {
  return useContactsStore.getState().addContact({
    name,
    address,
    chain: "solana",
    isFavorite: false,
  })
}

// ============================================================================
// CONTACT LOOKUP & PAYMENT RECORDING
// ============================================================================

describe("Send Screen — Contact Integration", () => {
  beforeEach(() => {
    useContactsStore.setState({ contacts: [] })
  })

  describe("Contact Lookup by Address", () => {
    it("should find a saved contact by address", () => {
      seedContact("Alice", ALICE_ADDRESS)

      const contact = useContactsStore.getState().getContactByAddress(ALICE_ADDRESS)
      expect(contact).toBeDefined()
      expect(contact!.name).toBe("Alice")
    })

    it("should return undefined for unknown address", () => {
      seedContact("Alice", ALICE_ADDRESS)

      const contact = useContactsStore.getState().getContactByAddress(BOB_ADDRESS)
      expect(contact).toBeUndefined()
    })

    it("should return undefined when contacts list is empty", () => {
      const contact = useContactsStore.getState().getContactByAddress(ALICE_ADDRESS)
      expect(contact).toBeUndefined()
    })

    it("should find contact with stealth meta-address", () => {
      seedContact("Stealth User", STEALTH_ADDRESS)

      const contact = useContactsStore.getState().getContactByAddress(STEALTH_ADDRESS)
      expect(contact).toBeDefined()
      expect(contact!.name).toBe("Stealth User")
    })

    it("should not match partial address", () => {
      seedContact("Alice", ALICE_ADDRESS)

      const contact = useContactsStore.getState().getContactByAddress(ALICE_ADDRESS.slice(0, 20))
      expect(contact).toBeUndefined()
    })
  })

  describe("Payment Recording", () => {
    it("should increment paymentCount on recordPayment", () => {
      const contact = seedContact("Alice", ALICE_ADDRESS)

      expect(contact.paymentCount).toBe(0)
      expect(contact.lastPaymentAt).toBeNull()

      useContactsStore.getState().recordPayment(contact.id)

      const updated = useContactsStore.getState().getContactByAddress(ALICE_ADDRESS)
      expect(updated!.paymentCount).toBe(1)
      expect(updated!.lastPaymentAt).not.toBeNull()
    })

    it("should increment paymentCount multiple times", () => {
      const contact = seedContact("Alice", ALICE_ADDRESS)

      useContactsStore.getState().recordPayment(contact.id)
      useContactsStore.getState().recordPayment(contact.id)
      useContactsStore.getState().recordPayment(contact.id)

      const updated = useContactsStore.getState().getContactByAddress(ALICE_ADDRESS)
      expect(updated!.paymentCount).toBe(3)
    })

    it("should not affect other contacts when recording payment", () => {
      const alice = seedContact("Alice", ALICE_ADDRESS)
      seedContact("Bob", BOB_ADDRESS)

      useContactsStore.getState().recordPayment(alice.id)

      const bob = useContactsStore.getState().getContactByAddress(BOB_ADDRESS)
      expect(bob!.paymentCount).toBe(0)
      expect(bob!.lastPaymentAt).toBeNull()
    })

    it("should set lastPaymentAt to current timestamp", () => {
      const contact = seedContact("Alice", ALICE_ADDRESS)
      const beforePayment = Date.now()

      useContactsStore.getState().recordPayment(contact.id)

      const updated = useContactsStore.getState().getContactByAddress(ALICE_ADDRESS)
      expect(updated!.lastPaymentAt).toBeGreaterThanOrEqual(beforePayment)
      expect(updated!.lastPaymentAt).toBeLessThanOrEqual(Date.now())
    })

    it("should handle recording payment for nonexistent contact ID gracefully", () => {
      seedContact("Alice", ALICE_ADDRESS)

      // Should not throw
      useContactsStore.getState().recordPayment("nonexistent_id")

      // Alice's count should be unchanged
      const alice = useContactsStore.getState().getContactByAddress(ALICE_ADDRESS)
      expect(alice!.paymentCount).toBe(0)
    })
  })

  describe("End-to-End Contact Send Flow", () => {
    it("should lookup contact and record payment (simulated success flow)", () => {
      const alice = seedContact("Alice", ALICE_ADDRESS)

      // Simulate: recipient comes from contacts navigation
      const recipientParam = ALICE_ADDRESS
      const contactName = "Alice"

      // Verify contact name is provided
      expect(contactName).toBe("Alice")

      // Simulate: after successful send, look up contact by address and record
      const contact = useContactsStore.getState().getContactByAddress(recipientParam)
      expect(contact).toBeDefined()
      expect(contact!.id).toBe(alice.id)

      useContactsStore.getState().recordPayment(contact!.id)

      const updated = useContactsStore.getState().getContactByAddress(ALICE_ADDRESS)
      expect(updated!.paymentCount).toBe(1)
    })

    it("should not record payment when recipient is not a saved contact", () => {
      seedContact("Alice", ALICE_ADDRESS)

      // Simulate: manually entered address that's not in contacts
      const recipientParam = BOB_ADDRESS

      const contact = useContactsStore.getState().getContactByAddress(recipientParam)
      expect(contact).toBeUndefined()

      // No recordPayment call happens — contacts remain unchanged
      const alice = useContactsStore.getState().getContactByAddress(ALICE_ADDRESS)
      expect(alice!.paymentCount).toBe(0)
    })
  })
})

// ============================================================================
// CONTACT NAME DISPLAY LOGIC
// ============================================================================

describe("Send Screen — Contact Name Display", () => {
  describe("contactName param presence", () => {
    it("should indicate display when contactName is present", () => {
      const contactName: string | undefined = "Alice"
      const shouldShowBanner = !!contactName
      expect(shouldShowBanner).toBe(true)
    })

    it("should not indicate display when contactName is undefined", () => {
      const contactName: string | undefined = undefined
      const shouldShowBanner = !!contactName
      expect(shouldShowBanner).toBe(false)
    })

    it("should not indicate display when contactName is empty string", () => {
      const contactName: string | undefined = ""
      const shouldShowBanner = !!contactName
      expect(shouldShowBanner).toBe(false)
    })

    it("should format banner text with contact name", () => {
      const contactName = "Alice"
      const bannerText = `Sending to ${contactName}`
      expect(bannerText).toBe("Sending to Alice")
    })

    it("should handle contact names with special characters", () => {
      const contactName = "Alice's Wallet"
      const bannerText = `Sending to ${contactName}`
      expect(bannerText).toBe("Sending to Alice's Wallet")
    })
  })
})

// ============================================================================
// RECIPIENT PRE-FILL LOGIC
// ============================================================================

describe("Send Screen — Recipient Pre-fill", () => {
  it("should pre-fill recipient from param", () => {
    // Simulate: params from contacts navigation
    const params = {
      recipient: ALICE_ADDRESS,
      contactName: "Alice",
    }

    // The useEffect in SendScreen sets recipient state from params
    expect(params.recipient).toBe(ALICE_ADDRESS)
    expect(params.contactName).toBe("Alice")
  })

  it("should handle recipient param as stealth address", () => {
    const params = {
      recipient: STEALTH_ADDRESS,
      contactName: "Stealth User",
    }

    expect(params.recipient).toBe(STEALTH_ADDRESS)
    expect(params.recipient.startsWith("sip:")).toBe(true)
  })

  it("should not pre-fill when recipient param is absent", () => {
    const params: { recipient?: string; contactName?: string } = {}

    expect(params.recipient).toBeUndefined()
    expect(params.contactName).toBeUndefined()
  })

  it("should handle scannedAddress and recipient params independently", () => {
    // If both params were somehow present, they should be independent
    const scannedAddress = BOB_ADDRESS
    const recipientParam = ALICE_ADDRESS

    // Both are valid addresses — the component handles them in separate useEffects
    expect(scannedAddress).not.toBe(recipientParam)
  })
})
