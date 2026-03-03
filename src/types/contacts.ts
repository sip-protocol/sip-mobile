/**
 * Contact Types
 *
 * Types for the contacts system powering Private Social Payments.
 */

import type { ChainType } from "@/types"

/**
 * A saved contact for private payments
 */
export interface Contact {
  /** Unique identifier: contact_<timestamp>_<random> */
  id: string
  /** Display name */
  name: string
  /** Blockchain address (Solana, Ethereum, or NEAR) */
  address: string
  /** SIP stealth meta-address (sip:<chain>:<spendingKey>:<viewingKey>) */
  stealthMeta?: string
  /** Optional avatar image URI */
  avatarUri?: string
  /** Which chain this contact belongs to */
  chain: ChainType
  /** When this contact was created (ms since epoch) */
  createdAt: number
  /** When the last payment was sent to this contact (null if never) */
  lastPaymentAt: number | null
  /** Total number of payments sent to this contact */
  paymentCount: number
  /** Whether this contact is marked as favorite */
  isFavorite: boolean
}

/**
 * Input for creating a new contact (auto-generated fields excluded)
 */
export type CreateContactInput = Omit<Contact, "id" | "createdAt" | "lastPaymentAt" | "paymentCount">
