/**
 * Toast notification type
 */
export interface Toast {
  id: string
  type: "success" | "error" | "warning" | "info"
  title: string
  message?: string
  duration?: number
}

/**
 * Privacy levels for transactions
 */
export type PrivacyLevel = "transparent" | "shielded" | "compliant"

/**
 * Supported blockchain chains
 */
export type ChainType = "solana" | "ethereum" | "near"

/**
 * Supported wallet types for mobile
 */
export type WalletType =
  | "phantom"
  | "solflare"
  | "backpack"
  | "privy"
  | "mwa" // Mobile Wallet Adapter (Solana Mobile)
  | "walletconnect"

/**
 * Wallet connection method for mobile
 */
export type ConnectionMethod = "deeplink" | "mwa" | "embedded"

/**
 * Swap record for history
 */
export interface SwapRecord {
  id: string
  fromToken: string
  toToken: string
  fromChain: string
  toChain: string
  fromAmount: string
  toAmount: string
  status: "pending" | "completed" | "failed"
  txHash?: string
  explorerUrl?: string
  timestamp: number
  privacyLevel: PrivacyLevel
  depositAddress?: string
}

/**
 * Privacy payment record
 */
export interface PaymentRecord {
  id: string
  type: "send" | "receive"
  amount: string
  token: string
  status: "pending" | "completed" | "failed" | "claimed"
  stealthAddress?: string
  txHash?: string
  timestamp: number
  privacyLevel: PrivacyLevel
  claimed?: boolean
  claimedAt?: number
}
