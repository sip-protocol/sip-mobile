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

// ============================================================================
// WALLET TYPES
// ============================================================================

/**
 * Wallet connection status
 */
export type WalletConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error"

/**
 * Wallet provider type for unified hook
 */
export type WalletProviderType = "privy" | "mwa" | "phantom"

/**
 * Connected wallet account info
 */
export interface WalletAccount {
  address: string
  publicKey: Uint8Array
  label?: string
  providerType: WalletProviderType
}

/**
 * Transaction to sign
 */
export interface TransactionToSign {
  serializedTransaction: Uint8Array
  signatures?: Uint8Array[]
}

/**
 * Message to sign
 */
export interface MessageToSign {
  message: Uint8Array
  display?: "utf8" | "hex"
}

/**
 * Signed result
 */
export interface SignedResult {
  signature: Uint8Array
  signedTransaction?: Uint8Array
}

/**
 * Wallet error types
 */
export type WalletErrorType =
  | "connection_failed"
  | "user_rejected"
  | "timeout"
  | "not_installed"
  | "signing_failed"
  | "unknown"

/**
 * Wallet error
 */
export interface WalletError {
  type: WalletErrorType
  message: string
  originalError?: unknown
}

// ============================================================================
// MULTI-ACCOUNT TYPES
// ============================================================================

/**
 * Stored account for multi-account support
 */
export interface StoredAccount {
  id: string
  address: string
  nickname: string
  providerType: WalletProviderType
  chain: ChainType
  createdAt: number
  lastUsedAt: number
  isActive: boolean
}

/**
 * Account creation input
 */
export interface CreateAccountInput {
  address: string
  providerType: WalletProviderType
  chain: ChainType
  nickname?: string
}
