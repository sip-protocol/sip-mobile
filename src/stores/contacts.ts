/**
 * Contacts Store
 *
 * Manages saved contacts for Private Social Payments.
 * Persists across sessions using AsyncStorage.
 */

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import AsyncStorage from "@react-native-async-storage/async-storage"
import type { Contact, CreateContactInput } from "@/types/contacts"

// ============================================================================
// TYPES
// ============================================================================

interface ContactsState {
  /** All saved contacts */
  contacts: Contact[]

  /** Add a new contact with auto-generated ID and timestamps */
  addContact: (input: CreateContactInput) => Contact

  /** Remove a contact by ID */
  removeContact: (id: string) => void

  /** Partially update a contact by ID */
  updateContact: (id: string, updates: Partial<Omit<Contact, "id" | "createdAt">>) => void

  /** Find a contact by blockchain address */
  getContactByAddress: (address: string) => Contact | undefined

  /** Return all favorited contacts */
  getFavorites: () => Contact[]

  /** Increment payment count and set lastPaymentAt for a contact */
  recordPayment: (contactId: string) => void
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Generate unique contact ID
 */
function generateContactId(): string {
  return `contact_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

// ============================================================================
// STORE
// ============================================================================

export const useContactsStore = create<ContactsState>()(
  persist(
    (set, get) => ({
      contacts: [],

      addContact: (input) => {
        const newContact: Contact = {
          id: generateContactId(),
          name: input.name,
          address: input.address,
          stealthMeta: input.stealthMeta,
          avatarUri: input.avatarUri,
          chain: input.chain,
          isFavorite: input.isFavorite,
          createdAt: Date.now(),
          lastPaymentAt: null,
          paymentCount: 0,
        }

        set((state) => ({
          contacts: [...state.contacts, newContact],
        }))

        return newContact
      },

      removeContact: (id) => {
        set((state) => ({
          contacts: state.contacts.filter((c) => c.id !== id),
        }))
      },

      updateContact: (id, updates) => {
        set((state) => ({
          contacts: state.contacts.map((c) =>
            c.id === id ? { ...c, ...updates } : c
          ),
        }))
      },

      getContactByAddress: (address) => {
        return get().contacts.find((c) => c.address === address)
      },

      getFavorites: () => {
        return get().contacts.filter((c) => c.isFavorite)
      },

      recordPayment: (contactId) => {
        set((state) => ({
          contacts: state.contacts.map((c) =>
            c.id === contactId
              ? { ...c, paymentCount: c.paymentCount + 1, lastPaymentAt: Date.now() }
              : c
          ),
        }))
      },
    }),
    {
      name: "sip-contacts-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)
