/**
 * Transfer-record ownership detection (canonical EIP-5564, VIEW-ONLY)
 *
 * Pure helper shared by the foreground and background scanners: given an on-chain
 * transfer record, decide whether it was sent to this recipient using only the viewing
 * PRIVATE key and the spending PUBLIC key — never the spending private key (which is
 * required to spend a payment, not to detect it).
 *
 * Kept dependency-light (only `@/lib/stealth` + a type-only import) and separate from
 * `backgroundScan.ts`, which loads expo-task-manager / -background-fetch / -notifications
 * at import time, so detection stays unit-testable without native mocks.
 */

import { checkStealthOwnership, bytesToHex } from "@/lib/stealth"
import type { TransferRecordData } from "@/lib/anchor/client"

/**
 * Check whether a transfer record belongs to the user.
 *
 * The ephemeral public key is stored on-chain as 33 bytes (a 1-byte `0x02` prefix +
 * the 32-byte ed25519 point R); the prefix is stripped before the ECDH. Detection
 * delegates to the canonical `checkStealthOwnership` (the single source of the
 * P = K_spend + H(S)*G recomputation).
 *
 * @param record - parsed on-chain transfer record
 * @param viewingPrivateKey - recipient viewing private key (raw 32-byte scalar seed)
 * @param spendingPublicKey - recipient spending public key (raw 32-byte ed25519 point)
 * @returns true if the payment was intended for this recipient
 */
export function checkRecordOwnership(
  record: TransferRecordData,
  viewingPrivateKey: Uint8Array,
  spendingPublicKey: Uint8Array
): boolean {
  try {
    // Strip the 1-byte prefix from the 33-byte stored ephemeral key to recover R (32 bytes).
    const ephemeralHex = `0x${bytesToHex(record.ephemeralPubkey.slice(1))}`
    const stealthHex = `0x${bytesToHex(record.stealthRecipient.toBytes())}`

    return checkStealthOwnership(
      stealthHex,
      ephemeralHex,
      `0x${bytesToHex(viewingPrivateKey)}`,
      `0x${bytesToHex(spendingPublicKey)}`
    )
  } catch {
    return false
  }
}
