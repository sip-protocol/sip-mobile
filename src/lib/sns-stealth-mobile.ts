/**
 * SNS-STEALTH wrapper for sip-mobile.
 *
 * Mirrors the sip-app wrapper at src/lib/sns-stealth-client.ts: callers pass a
 * Connection (so cluster selection is respected) and a minimal wallet shape
 * compatible with useNativeWallet's signMessage/signTransaction primitives.
 *
 * Error classes are re-exported here so consumers have one integration point
 * and `instanceof` discrimination keeps working across the wrapper boundary.
 */

import type { Connection, PublicKey, Transaction } from "@solana/web3.js"
import {
  resolveSIPStealth,
  buildPublishTx,
  deriveStealthKeys,
  invalidateCache,
  MetaAddress,
  Malformed,
  NetworkError,
  NotFound,
  OnChainError,
  UserRejected,
  type ResolveResult,
} from "@sip-protocol/sns-stealth"

/**
 * Minimal wallet shape required to publish a SIP-STEALTH record.
 *
 * - `signMessage` derives the deterministic stealth keys (DKSAP via HKDF).
 * - `signTransaction` signs the on-chain publish tx in-place and returns it.
 *
 * Compatible with useNativeWallet (PRIMARY) and any external adapter that
 * exposes the same two callbacks.
 */
export interface PublishWallet {
  publicKey: PublicKey
  signMessage: (message: Uint8Array) => Promise<Uint8Array>
  signTransaction: (tx: Transaction) => Promise<Transaction>
}

/**
 * Resolve a `.sol` domain to a SIP stealth MetaAddress (or typed not-found / malformed).
 *
 * @param connection - Solana RPC connection (caller-provided so cluster is respected)
 * @param domain - Full `.sol` domain (e.g., "alice.sol")
 */
export async function resolve(
  connection: Connection,
  domain: string
): Promise<ResolveResult> {
  return resolveSIPStealth(connection, domain)
}

/**
 * Publish a SIP-STEALTH record on the caller's `.sol` domain.
 *
 * Deterministically derives per-domain stealth keys from the wallet's signed
 * message, builds the SNS record-write transaction, has the wallet sign it,
 * and submits via the same connection.
 *
 * Throws `UserRejected` if the wallet declines signing; other typed errors
 * (NetworkError, OnChainError, Malformed) bubble up from the SDK.
 */
export async function publish(
  connection: Connection,
  domain: string,
  wallet: PublishWallet
): Promise<{ signature: string }> {
  const keys = await deriveStealthKeys(
    { signMessage: wallet.signMessage },
    domain
  )

  const tx = await buildPublishTx(
    connection,
    domain,
    { spending: keys.spending, viewing: keys.viewing },
    wallet.publicKey
  )

  const signed = await wallet.signTransaction(tx)
  const signature = await connection.sendRawTransaction(signed.serialize())

  invalidateCache(domain)
  return { signature }
}

export {
  invalidateCache,
  MetaAddress,
  Malformed,
  NetworkError,
  NotFound,
  OnChainError,
  UserRejected,
}
export type { ResolveResult }
