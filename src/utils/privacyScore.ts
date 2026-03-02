/**
 * Privacy Score Calculator
 *
 * Calculates per-token and aggregate wallet privacy scores
 * for the Privacy-First Token Portfolio feature.
 *
 * Scoring weights (per-token):
 * - Transaction privacy (40%): shielded / total transactions
 * - Stealth address setup (30%): has stealth address configured
 * - Balance privacy (30%): balance not publicly linked to identity
 */

/** Input for calculating a single token's privacy score */
export interface TokenPrivacyInput {
  /** Total transactions with this token */
  totalTransactions: number
  /** Transactions made via stealth addresses */
  shieldedTransactions: number
  /** Whether user has stealth address set up */
  hasStealthAddress: boolean
  /** Whether balance is publicly linked to identity */
  balanceExposed: boolean
}

/** Entry for wallet-level aggregate scoring */
export interface TokenScoreEntry {
  /** Token ticker symbol */
  symbol: string
  /** Per-token privacy score (0-100) */
  score: number
  /** USD value of holdings */
  balanceUsd: number
}

const WEIGHT_TX_PRIVACY = 40
const WEIGHT_STEALTH = 30
const WEIGHT_BALANCE = 30

/**
 * Calculate privacy score for a single token holding.
 *
 * @returns Integer 0-100 representing privacy level
 */
export function calculateTokenPrivacyScore(input: TokenPrivacyInput): number {
  const { totalTransactions, shieldedTransactions, hasStealthAddress, balanceExposed } = input

  // Transaction privacy: 0 transactions = no exposure = full score
  const txRatio = totalTransactions === 0
    ? 1
    : shieldedTransactions / totalTransactions
  const txScore = txRatio * WEIGHT_TX_PRIVACY

  // Stealth address: binary — configured or not
  const stealthScore = hasStealthAddress ? WEIGHT_STEALTH : 0

  // Balance privacy: NOT exposed = full points
  const balanceScore = balanceExposed ? 0 : WEIGHT_BALANCE

  return Math.round(txScore + stealthScore + balanceScore)
}

/**
 * Calculate USD-weighted aggregate privacy score across all tokens.
 *
 * Weights each token's score by its proportion of total portfolio USD value.
 * Empty portfolio or zero total USD returns 100 (nothing exposed).
 *
 * @returns Integer 0-100 representing overall wallet privacy
 */
export function calculateWalletPrivacyScore(tokens: TokenScoreEntry[]): number {
  const totalUsd = tokens.reduce((sum, t) => sum + t.balanceUsd, 0)

  // Nothing to expose
  if (totalUsd === 0) return 100

  const weightedSum = tokens.reduce(
    (sum, t) => sum + t.score * t.balanceUsd,
    0,
  )

  return Math.round(weightedSum / totalUsd)
}
