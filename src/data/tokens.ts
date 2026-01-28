/**
 * Token Data
 *
 * Popular Solana tokens for the swap interface.
 * In production, this would be fetched from Jupiter's token list API.
 */

import type { TokenInfo } from "@/types"

// ============================================================================
// POPULAR TOKENS
// ============================================================================

export const TOKENS: Record<string, TokenInfo> = {
  SOL: {
    symbol: "SOL",
    name: "Solana",
    mint: "So11111111111111111111111111111111111111112",
    decimals: 9,
    logoUri: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
    coingeckoId: "solana",
  },
  USDC: {
    symbol: "USDC",
    name: "USD Coin",
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    decimals: 6,
    logoUri: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
    coingeckoId: "usd-coin",
  },
  USDT: {
    symbol: "USDT",
    name: "Tether USD",
    mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    decimals: 6,
    logoUri: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png",
    coingeckoId: "tether",
  },
  BONK: {
    symbol: "BONK",
    name: "Bonk",
    mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    decimals: 5,
    logoUri: "https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I",
    coingeckoId: "bonk",
  },
  JUP: {
    symbol: "JUP",
    name: "Jupiter",
    mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    decimals: 6,
    logoUri: "https://static.jup.ag/jup/icon.png",
    coingeckoId: "jupiter-exchange-solana",
  },
  RAY: {
    symbol: "RAY",
    name: "Raydium",
    mint: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
    decimals: 6,
    logoUri: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png",
    coingeckoId: "raydium",
  },
  PYTH: {
    symbol: "PYTH",
    name: "Pyth Network",
    mint: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3",
    decimals: 6,
    logoUri: "https://pyth.network/token.png",
    coingeckoId: "pyth-network",
  },
  WIF: {
    symbol: "WIF",
    name: "dogwifhat",
    mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
    decimals: 6,
    logoUri: "https://bafkreibk3covs5ltyqxa272uodhculbr6kea6betiez5v7qp7g4owvdwlq.ipfs.nftstorage.link",
    coingeckoId: "dogwifcoin",
  },
  JTO: {
    symbol: "JTO",
    name: "Jito",
    mint: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL",
    decimals: 9,
    logoUri: "https://metadata.jito.network/token/jto/image",
    coingeckoId: "jito-governance-token",
  },
  ORCA: {
    symbol: "ORCA",
    name: "Orca",
    mint: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE",
    decimals: 6,
    logoUri: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE/logo.png",
    coingeckoId: "orca",
  },
}

// ============================================================================
// TOKEN LIST
// ============================================================================

export const TOKEN_LIST: TokenInfo[] = Object.values(TOKENS)

export const POPULAR_TOKENS = ["SOL", "USDC", "USDT", "BONK", "JUP"]

// ============================================================================
// HELPERS
// ============================================================================

export function getToken(symbol: string): TokenInfo | undefined {
  return TOKENS[symbol.toUpperCase()]
}

export function getTokenByMint(mint: string): TokenInfo | undefined {
  return TOKEN_LIST.find((t) => t.mint === mint)
}

export function formatTokenAmount(
  amount: string | number,
  decimals: number,
  displayDecimals: number = 4
): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount
  if (isNaN(num)) return "0"

  // For very small numbers, show more decimals
  if (num > 0 && num < 0.0001) {
    return num.toExponential(2)
  }

  return num.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: displayDecimals,
  })
}

export function parseTokenAmount(
  amount: string,
  tokenDecimals: number
): bigint {
  const [whole, fraction = ""] = amount.split(".")
  const paddedFraction = fraction.padEnd(tokenDecimals, "0").slice(0, tokenDecimals)
  return BigInt(whole + paddedFraction)
}

