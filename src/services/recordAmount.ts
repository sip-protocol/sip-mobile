/**
 * Background-scan amount resolution — view-only RPC balance fallback (#87)
 *
 * A view-only auditor can DETECT a stealth payment (canonical EIP-5564) but cannot DECRYPT
 * its amount: amount encryption is keyed to the SPENDING key, and the background scanner only
 * holds the spending PUBLIC key. So — mirroring the foreground `useScanPayments` fallback —
 * the amount is read from the on-chain SOL balance of the one-time stealth recipient address.
 *
 * Kept separate from src/services/backgroundScan.ts (which loads expo-task-manager /
 * -background-fetch / -notifications at import) so it stays unit-testable without native mocks.
 */

import { LAMPORTS_PER_SOL, type PublicKey } from "@solana/web3.js"

/**
 * Resolve a stealth payment's SOL amount from the recipient's on-chain balance.
 *
 * @param stealthRecipient - the one-time stealth address that received the payment
 * @param getBalance - lamport-balance fetcher (e.g. `connection.getBalance`)
 * @returns the balance in SOL, or 0 if empty or the fetch fails (never throws)
 */
export async function resolveRecordAmountSol(
  stealthRecipient: PublicKey,
  getBalance: (recipient: PublicKey) => Promise<number>
): Promise<number> {
  try {
    const lamports = await getBalance(stealthRecipient)
    return lamports > 0 ? lamports / LAMPORTS_PER_SOL : 0
  } catch {
    return 0
  }
}
