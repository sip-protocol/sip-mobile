/**
 * Explorer URL Utilities
 *
 * Centralized explorer URL generation for consistent linking across the app.
 * Supports Solscan and Solana Explorer with proper network handling.
 */

import type { ExplorerType } from "@/stores/settings"

export type Network = "mainnet-beta" | "devnet" | "testnet"

/**
 * Get transaction URL for the specified explorer and network.
 *
 * @param txHash - Transaction signature/hash
 * @param network - Solana network (mainnet-beta, devnet, testnet)
 * @param explorer - Explorer preference (solscan, solana-explorer)
 * @returns Full explorer URL for the transaction
 *
 * @example
 * getExplorerTxUrl("5xyzabc...", "mainnet-beta", "solscan")
 * // => "https://solscan.io/tx/5xyzabc..."
 *
 * getExplorerTxUrl("5xyzabc...", "devnet", "solscan")
 * // => "https://solscan.io/tx/5xyzabc...?cluster=devnet"
 */
export function getExplorerTxUrl(
  txHash: string,
  network: Network,
  explorer: ExplorerType = "solscan"
): string {
  const cluster = network === "mainnet-beta" ? "" : `?cluster=${network}`

  if (explorer === "solscan") {
    return `https://solscan.io/tx/${txHash}${cluster}`
  } else {
    return `https://explorer.solana.com/tx/${txHash}${cluster}`
  }
}

/**
 * Get account/address URL for the specified explorer and network.
 *
 * @param address - Solana account address
 * @param network - Solana network (mainnet-beta, devnet, testnet)
 * @param explorer - Explorer preference (solscan, solana-explorer)
 * @returns Full explorer URL for the account
 *
 * @example
 * getExplorerAccountUrl("S1P...", "mainnet-beta", "solscan")
 * // => "https://solscan.io/account/S1P..."
 */
export function getExplorerAccountUrl(
  address: string,
  network: Network,
  explorer: ExplorerType = "solscan"
): string {
  const cluster = network === "mainnet-beta" ? "" : `?cluster=${network}`

  if (explorer === "solscan") {
    return `https://solscan.io/account/${address}${cluster}`
  } else {
    return `https://explorer.solana.com/address/${address}${cluster}`
  }
}

/**
 * Get human-readable explorer name for display.
 */
export function getExplorerName(explorer: ExplorerType): string {
  return explorer === "solscan" ? "Solscan" : "Solana Explorer"
}
