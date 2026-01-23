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

// ============================================================================
// VIEWING KEY TYPES
// ============================================================================

/**
 * Viewing key disclosure record
 * Tracks who you've shared your viewing key with
 */
export interface ViewingKeyDisclosure {
  id: string
  recipientName: string
  recipientAddress?: string
  purpose: "compliance" | "audit" | "personal" | "other"
  note?: string
  disclosedAt: number
  expiresAt?: number
  revoked: boolean
  revokedAt?: number
}

/**
 * Imported viewing key from another user
 * Allows you to monitor their payments (with their permission)
 */
export interface ImportedViewingKey {
  id: string
  label: string
  viewingPublicKey: string
  viewingPrivateKey: string
  ownerAddress?: string
  chain: ChainType
  importedAt: number
  lastScannedAt?: number
  paymentsFound: number
}

/**
 * Viewing key export format
 * For sharing with auditors/compliance
 */
export interface ViewingKeyExport {
  version: number
  chain: ChainType
  viewingPublicKey: string
  viewingPrivateKey: string
  spendingPublicKey: string
  exportedAt: number
  expiresAt?: number
}

// ============================================================================
// TOKEN TYPES
// ============================================================================

/**
 * Token information for display
 */
export interface TokenInfo {
  symbol: string
  name: string
  mint: string
  decimals: number
  logoUri?: string
  coingeckoId?: string
}

/**
 * Token with balance
 */
export interface TokenBalance {
  token: TokenInfo
  balance: string
  usdValue?: number
}

/**
 * Quote information from DEX
 */
export interface SwapQuote {
  inputToken: TokenInfo
  outputToken: TokenInfo
  inputAmount: string
  outputAmount: string
  minimumReceived: string
  priceImpact: number
  route: string[]
  fees: {
    networkFee: string
    platformFee: string
  }
  estimatedTime: number // seconds until confirmation
  expiresAt: number
}

/**
 * Swap settings
 */
export interface SwapSettings {
  slippageBps: number // basis points (100 = 1%)
  priorityFee: "low" | "medium" | "high" | "custom"
  customPriorityFee?: number // in lamports
}
