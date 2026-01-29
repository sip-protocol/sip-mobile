/**
 * Privacy Provider Adapter Types
 *
 * Defines the interface for pluggable privacy engines.
 * Implements "OpenRouter for Privacy" - one API, multiple backends.
 *
 * Supported Providers:
 * - sip-native: Stealth addresses + Pedersen commitments + viewing keys (default)
 * - privacy-cash: Pool-based mixing with ZK proofs
 * - shadowwire: Bulletproofs + internal transfers
 *
 * @see https://github.com/sip-protocol/sip-mobile/issues/73
 */

import type { PrivacyLevel, SwapQuote } from "@/types"
import type { JupiterQuoteResponse } from "@/hooks/useQuote"

// ============================================================================
// PROVIDER IDENTIFICATION
// ============================================================================

/**
 * Supported privacy provider types
 */
export type PrivacyProviderType = "sip-native" | "privacy-cash" | "shadowwire" | "magicblock" | "arcium" | "inco" | "cspl"

/**
 * Provider metadata for UI display
 */
export interface PrivacyProviderInfo {
  id: PrivacyProviderType
  name: string
  description: string
  icon: string
  recommended: boolean
  /** Features supported by this provider */
  features: {
    send: boolean
    swap: boolean
    viewingKeys: boolean
    compliance: boolean
  }
  /** SDK status */
  status: "available" | "coming-soon" | "maintenance"
}

// ============================================================================
// SEND OPERATION TYPES
// ============================================================================

/**
 * Parameters for sending a private payment
 */
export interface PrivacySendParams {
  /** Amount to send (in token units, e.g., "1.5" for 1.5 SOL) */
  amount: string
  /** Recipient address (stealth or regular, provider-specific format) */
  recipient: string
  /** Privacy level to apply */
  privacyLevel: PrivacyLevel
  /** Optional memo/note */
  memo?: string
  /** Token mint address (null for native SOL) */
  tokenMint?: string
}

/**
 * Result of a send operation
 */
export interface PrivacySendResult {
  success: boolean
  /** Transaction hash/signature */
  txHash?: string
  /** Error message if failed */
  error?: string
  /** Provider-specific data (e.g., deposit address for pool-based systems) */
  providerData?: Record<string, unknown>
}

/**
 * Send operation status
 */
export type PrivacySendStatus =
  | "idle"
  | "validating"
  | "preparing"
  | "signing"
  | "submitting"
  | "confirmed"
  | "error"

// ============================================================================
// SWAP OPERATION TYPES
// ============================================================================

/**
 * Parameters for executing a private swap
 */
export interface PrivacySwapParams {
  /** Quote from the DEX */
  quote: SwapQuote
  /** Raw Jupiter quote response (for Jupiter-based swaps) */
  jupiterQuote?: JupiterQuoteResponse
  /** Privacy level to apply */
  privacyLevel: PrivacyLevel
}

/**
 * Result of a swap operation
 */
export interface PrivacySwapResult {
  success: boolean
  /** Transaction hash/signature */
  txHash?: string
  /** Explorer URL */
  explorerUrl?: string
  /** Error message if failed */
  error?: string
  /** Provider-specific data */
  providerData?: Record<string, unknown>
}

/**
 * Swap operation status
 */
export type PrivacySwapStatus =
  | "idle"
  | "confirming"
  | "signing"
  | "submitting"
  | "success"
  | "error"

// ============================================================================
// ADAPTER INTERFACE
// ============================================================================

/**
 * Privacy Provider Adapter Interface
 *
 * All privacy providers must implement this interface.
 * This enables the "OpenRouter for Privacy" pattern - users can switch
 * between providers without changing their workflow.
 *
 * SIP adds viewing keys (compliance layer) on top of ANY provider.
 */
export interface PrivacyProviderAdapter {
  /** Provider identification */
  readonly id: PrivacyProviderType
  readonly name: string

  /**
   * Initialize the adapter
   * Called once when the provider is selected
   */
  initialize(): Promise<void>

  /**
   * Check if the provider is ready to use
   */
  isReady(): boolean

  /**
   * Check if the provider supports a specific feature
   */
  supportsFeature(feature: "send" | "swap" | "viewingKeys" | "compliance"): boolean

  // ─────────────────────────────────────────────────────────────────────────
  // SEND OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Validate a recipient address
   * Each provider has its own address format
   */
  validateRecipient(address: string): Promise<{
    isValid: boolean
    type: "stealth" | "pool" | "regular" | "invalid"
    error?: string
  }>

  /**
   * Send a private payment
   *
   * @param params - Send parameters
   * @param signTransaction - Callback to sign transactions
   * @param onStatusChange - Callback for status updates
   */
  send(
    params: PrivacySendParams,
    signTransaction: (tx: Uint8Array) => Promise<Uint8Array | null>,
    onStatusChange?: (status: PrivacySendStatus) => void
  ): Promise<PrivacySendResult>

  // ─────────────────────────────────────────────────────────────────────────
  // SWAP OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Execute a private swap
   *
   * @param params - Swap parameters
   * @param signTransaction - Callback to sign transactions
   * @param onStatusChange - Callback for status updates
   */
  swap(
    params: PrivacySwapParams,
    signTransaction: (tx: Uint8Array) => Promise<Uint8Array | null>,
    onStatusChange?: (status: PrivacySwapStatus) => void
  ): Promise<PrivacySwapResult>

  // ─────────────────────────────────────────────────────────────────────────
  // VIEWING KEY INTEGRATION (SIP's unique value-add)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Generate viewing key proof for a transaction
   * This allows auditors to verify transactions without full access
   *
   * Only SIP Native supports this natively.
   * For other providers, SIP wraps the transaction with viewing key metadata.
   */
  generateViewingKeyProof?(
    txHash: string,
    viewingPrivateKey: string
  ): Promise<{
    proof: string
    metadata: Record<string, unknown>
  }>
}

// ============================================================================
// ADAPTER FACTORY
// ============================================================================

/**
 * Adapter creation options
 */
export interface AdapterOptions {
  /** Solana network */
  network: "mainnet-beta" | "devnet" | "testnet"
  /** User's wallet address */
  walletAddress: string
  /** RPC endpoint (optional, provider may use its own) */
  rpcEndpoint?: string
}

/**
 * Factory function type for creating adapters
 */
export type CreateAdapterFn = (options: AdapterOptions) => PrivacyProviderAdapter

// ============================================================================
// PROVIDER REGISTRY
// ============================================================================

/**
 * Registry of available privacy providers
 */
export const PRIVACY_PROVIDERS: PrivacyProviderInfo[] = [
  {
    id: "sip-native",
    name: "SIP Native",
    description: "Stealth addresses + Pedersen commitments + viewing keys",
    icon: "shield",
    recommended: true,
    features: {
      send: true,
      swap: true,
      viewingKeys: true,
      compliance: true,
    },
    status: "available",
  },
  {
    id: "privacy-cash",
    name: "Privacy Cash",
    description: "Pool-based mixing with ZK proofs (SOL/USDC/USDT)",
    icon: "cash",
    recommended: false,
    features: {
      send: true,
      swap: false, // Privacy Cash focuses on transfers, not DEX
      viewingKeys: false, // SIP adds this on top
      compliance: false,
    },
    status: "available", // Keypair integration done - biometric auth required
  },
  {
    id: "shadowwire",
    name: "ShadowWire",
    description: "Bulletproofs + internal transfers (22 tokens)",
    icon: "bolt",
    recommended: false,
    features: {
      send: true,
      swap: false, // ShadowWire focuses on transfers, not DEX
      viewingKeys: false, // SIP adds this on top
      compliance: false,
    },
    status: "available", // SDK integrated, signMessage compatible
  },
  {
    id: "magicblock",
    name: "MagicBlock",
    description: "TEE-based privacy via Private Ephemeral Rollups",
    icon: "cube",
    recommended: false,
    features: {
      send: true,
      swap: false, // MagicBlock focuses on private transfers
      viewingKeys: true, // SIP adds this on top
      compliance: true, // Permission-based access control
    },
    status: "available", // SDK integrated, TEE verification
  },
  {
    id: "arcium",
    name: "Arcium",
    description: "MPC-based confidential computing network",
    icon: "lock-closed",
    recommended: false,
    features: {
      send: true,
      swap: true, // Confidential swap validation
      viewingKeys: true, // SIP adds this on top
      compliance: true, // Encrypted computation audit trail
    },
    status: "available", // SDK integrated, program built
  },
  {
    id: "inco",
    name: "Inco Lightning",
    description: "FHE/TEE-based confidential computing",
    icon: "cloud",
    recommended: false,
    features: {
      send: true,
      swap: true, // Encrypted swap amounts
      viewingKeys: true, // SIP adds this on top
      compliance: true, // Attested decryption audit trail
    },
    status: "available", // SDK integrated
  },
  {
    id: "cspl",
    name: "C-SPL Confidential Tokens",
    description: "Token-2022 encrypted balances (hides amounts, not addresses)",
    icon: "eye-off",
    recommended: false,
    features: {
      send: true, // Confidential transfers
      swap: false, // Use Arcium for swaps
      viewingKeys: false, // SIP Native adds this
      compliance: true, // Auditor keys
    },
    status: "available", // SDK integrated
  },
]

/**
 * Get provider info by ID
 */
export function getProviderInfo(id: PrivacyProviderType): PrivacyProviderInfo | undefined {
  return PRIVACY_PROVIDERS.find((p) => p.id === id)
}
