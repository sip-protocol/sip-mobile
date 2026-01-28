/**
 * RPC Client for Solana
 *
 * Supports multiple RPC providers:
 * - Helius (recommended for production)
 * - QuickNode
 * - Generic RPC (devnet, mainnet-beta)
 *
 * Configurable via settings store.
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js"

// ─── Types ─────────────────────────────────────────────────────────────────

export type RpcProvider = "helius" | "quicknode" | "triton" | "publicnode"
export type NetworkCluster = "mainnet-beta" | "devnet" | "testnet"

export interface RpcConfig {
  provider: RpcProvider
  cluster: NetworkCluster
  apiKey?: string
  customEndpoint?: string
}

export interface BalanceResult {
  lamports: number
  sol: number
  error?: string
}

export interface TokenBalance {
  mint: string
  symbol?: string
  name?: string
  amount: string
  decimals: number
  uiAmount: number
}

// ─── Constants ─────────────────────────────────────────────────────────────

// PublicNode endpoints (free, no key required)
const PUBLICNODE_ENDPOINTS: Record<NetworkCluster, string> = {
  "mainnet-beta": "https://solana-rpc.publicnode.com",
  devnet: "https://api.devnet.solana.com", // PublicNode doesn't have devnet, fallback
  testnet: "https://api.testnet.solana.com",
}

const HELIUS_ENDPOINTS: Record<NetworkCluster, string> = {
  "mainnet-beta": "https://mainnet.helius-rpc.com",
  devnet: "https://devnet.helius-rpc.com",
  testnet: "https://api.testnet.solana.com", // Helius doesn't support testnet
}

const QUICKNODE_ENDPOINTS: Record<NetworkCluster, string> = {
  "mainnet-beta": "https://solana-mainnet.quiknode.pro",
  devnet: "https://solana-devnet.quiknode.pro",
  testnet: "https://api.testnet.solana.com", // QuickNode doesn't support testnet
}

// ─── RPC Client Class ──────────────────────────────────────────────────────

export class SolanaRpcClient {
  private connection: Connection
  private config: RpcConfig

  constructor(config: RpcConfig) {
    this.config = config
    this.connection = new Connection(this.getEndpoint(), {
      commitment: "confirmed",
      confirmTransactionInitialTimeout: 60000,
    })
  }

  /**
   * Get the RPC endpoint based on configuration
   */
  private getEndpoint(): string {
    const { provider, cluster, apiKey, customEndpoint } = this.config

    if (customEndpoint) {
      return customEndpoint
    }

    switch (provider) {
      case "helius":
        if (!apiKey) {
          console.warn("Helius requires API key, falling back to PublicNode")
          return PUBLICNODE_ENDPOINTS[cluster]
        }
        return `${HELIUS_ENDPOINTS[cluster]}/?api-key=${apiKey}`

      case "quicknode":
        if (!apiKey) {
          console.warn("QuickNode requires API key, falling back to PublicNode")
          return PUBLICNODE_ENDPOINTS[cluster]
        }
        return `${QUICKNODE_ENDPOINTS[cluster]}/${apiKey}`

      case "triton":
        // Triton uses custom endpoint (user provides full URL)
        if (!customEndpoint) {
          console.warn("Triton requires custom endpoint, falling back to PublicNode")
          return PUBLICNODE_ENDPOINTS[cluster]
        }
        return customEndpoint

      case "publicnode":
      default:
        return PUBLICNODE_ENDPOINTS[cluster]
    }
  }

  /**
   * Get the underlying Connection object
   */
  getConnection(): Connection {
    return this.connection
  }

  /**
   * Get SOL balance for an address
   */
  async getBalance(address: string): Promise<BalanceResult> {
    try {
      const publicKey = new PublicKey(address)
      const lamports = await this.connection.getBalance(publicKey)

      return {
        lamports,
        sol: lamports / LAMPORTS_PER_SOL,
      }
    } catch (err) {
      console.error("Failed to get balance:", err)
      return {
        lamports: 0,
        sol: 0,
        error: err instanceof Error ? err.message : "Failed to get balance",
      }
    }
  }

  /**
   * Get all token balances for an address
   */
  async getTokenBalances(address: string): Promise<TokenBalance[]> {
    try {
      const publicKey = new PublicKey(address)
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        publicKey,
        { programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") }
      )

      return tokenAccounts.value.map((account) => {
        const parsedInfo = account.account.data.parsed.info
        return {
          mint: parsedInfo.mint,
          amount: parsedInfo.tokenAmount.amount,
          decimals: parsedInfo.tokenAmount.decimals,
          uiAmount: parsedInfo.tokenAmount.uiAmount || 0,
        }
      })
    } catch (err) {
      console.error("Failed to get token balances:", err)
      return []
    }
  }

  /**
   * Check if the RPC connection is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      const slot = await this.connection.getSlot()
      return slot > 0
    } catch {
      return false
    }
  }

  /**
   * Get current slot
   */
  async getSlot(): Promise<number> {
    return this.connection.getSlot()
  }

  /**
   * Get recent blockhash
   */
  async getRecentBlockhash(): Promise<string> {
    const { blockhash } = await this.connection.getLatestBlockhash()
    return blockhash
  }
}

// ─── Singleton Instance ────────────────────────────────────────────────────

let rpcClientInstance: SolanaRpcClient | null = null

/**
 * Get or create the RPC client singleton
 */
export function getRpcClient(config?: RpcConfig): SolanaRpcClient {
  if (!rpcClientInstance || config) {
    rpcClientInstance = new SolanaRpcClient(
      config || {
        provider: "publicnode",
        cluster: "devnet",
      }
    )
  }
  return rpcClientInstance
}

/**
 * Reset the RPC client (useful for changing config)
 */
export function resetRpcClient(): void {
  rpcClientInstance = null
}

// ─── Price API ─────────────────────────────────────────────────────────────

const JUPITER_PRICE_API = "https://lite-api.jup.ag/price/v2"
const COINGECKO_PRICE_API = "https://api.coingecko.com/api/v3/simple/price"

export interface PriceData {
  sol: number
  timestamp: number
}

/**
 * Get SOL price in USD from Jupiter
 */
export async function getSolPriceJupiter(): Promise<PriceData | null> {
  try {
    // SOL mint address
    const SOL_MINT = "So11111111111111111111111111111111111111112"
    const response = await fetch(`${JUPITER_PRICE_API}?ids=${SOL_MINT}`)
    if (!response.ok) {
      console.warn(`Jupiter API returned ${response.status}`)
      return null
    }
    const data = await response.json()

    if (data.data?.[SOL_MINT]?.price) {
      return {
        sol: Number(data.data[SOL_MINT].price),
        timestamp: Date.now(),
      }
    }
    return null
  } catch (err) {
    console.error("Failed to get SOL price from Jupiter:", err)
    return null
  }
}

/**
 * Get SOL price in USD from CoinGecko
 */
export async function getSolPriceCoinGecko(): Promise<PriceData | null> {
  try {
    const response = await fetch(`${COINGECKO_PRICE_API}?ids=solana&vs_currencies=usd`)
    const data = await response.json()

    if (data.solana?.usd) {
      return {
        sol: data.solana.usd,
        timestamp: Date.now(),
      }
    }
    return null
  } catch (err) {
    console.error("Failed to get SOL price from CoinGecko:", err)
    return null
  }
}

/**
 * Get SOL price with fallback
 */
export async function getSolPrice(): Promise<number> {
  // Try Jupiter first (usually more up-to-date)
  const jupiterPrice = await getSolPriceJupiter()
  if (jupiterPrice) {
    return jupiterPrice.sol
  }

  // Fallback to CoinGecko
  const coingeckoPrice = await getSolPriceCoinGecko()
  if (coingeckoPrice) {
    return coingeckoPrice.sol
  }

  // Default fallback price
  console.warn("Using fallback SOL price")
  return 185.00
}
