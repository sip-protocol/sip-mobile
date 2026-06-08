/**
 * Background-scan amount resolution — view-only RPC balance fallback
 *
 * Regression test for sip-protocol/sip-mobile#87: the background scanner previously decrypted
 * the amount with the VIEWING key (the amount is spending-keyed) and could never succeed in
 * view-only mode, so every notification reported 0 SOL. A view-only auditor can DETECT a
 * payment but not DECRYPT its amount, so the correct source is the on-chain balance of the
 * stealth recipient — mirroring the foreground `useScanPayments` RPC fallback.
 * `resolveRecordAmountSol` fetches that balance and converts lamports → SOL.
 *
 * Decoupled from src/services/backgroundScan.ts (which loads expo-task-manager / -background-
 * fetch / -notifications at import) so it stays unit-testable without native mocks.
 */

import { describe, it, expect, vi } from "vitest"
import { PublicKey } from "@solana/web3.js"
import { resolveRecordAmountSol } from "@/services/recordAmount"

const RECIPIENT = new PublicKey("So11111111111111111111111111111111111111112")

describe("resolveRecordAmountSol", () => {
  it("converts the stealth recipient's on-chain lamport balance to SOL", async () => {
    const getBalance = vi.fn().mockResolvedValue(2_500_000_000) // 2.5 SOL in lamports
    const amount = await resolveRecordAmountSol(RECIPIENT, getBalance)
    expect(amount).toBe(2.5)
  })

  it("queries the balance of the stealth recipient (view-only, no decryption)", async () => {
    const getBalance = vi.fn().mockResolvedValue(1_000_000_000)
    await resolveRecordAmountSol(RECIPIENT, getBalance)
    expect(getBalance).toHaveBeenCalledTimes(1)
    expect(getBalance).toHaveBeenCalledWith(RECIPIENT)
  })

  it("returns 0 when the recipient has no balance", async () => {
    const getBalance = vi.fn().mockResolvedValue(0)
    expect(await resolveRecordAmountSol(RECIPIENT, getBalance)).toBe(0)
  })

  it("returns 0 (does not throw) when the balance fetch fails", async () => {
    const getBalance = vi.fn().mockRejectedValue(new Error("RPC unavailable"))
    await expect(resolveRecordAmountSol(RECIPIENT, getBalance)).resolves.toBe(0)
  })
})
