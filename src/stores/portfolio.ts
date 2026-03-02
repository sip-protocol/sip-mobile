import { create } from "zustand"
import { calculateWalletPrivacyScore } from "@/utils/privacyScore"
import type { TokenScoreEntry } from "@/utils/privacyScore"

/** A token holding with its privacy score and USD value */
export interface PortfolioToken {
  /** Token ticker symbol */
  symbol: string
  /** Raw token balance as string (avoids floating-point drift) */
  balance: string
  /** USD value of the holding */
  balanceUsd: number
  /** Per-token privacy score (0-100) */
  privacyScore: number
  /** Token mint address */
  mint: string
}

interface PortfolioState {
  tokens: PortfolioToken[]
  lastUpdated: number | null
  isLoading: boolean

  /** Replace all tokens and stamp lastUpdated */
  updateTokens: (tokens: PortfolioToken[]) => void
  /** USD-weighted aggregate privacy score (delegates to calculateWalletPrivacyScore) */
  getAggregateScore: () => number
  /** Returns a sorted copy — highest USD value first */
  getTokensSortedByValue: () => PortfolioToken[]
  setLoading: (loading: boolean) => void
  /** Reset portfolio data (tokens + lastUpdated), keeps isLoading */
  clear: () => void
}

export const usePortfolioStore = create<PortfolioState>((set, get) => ({
  tokens: [],
  lastUpdated: null,
  isLoading: false,

  updateTokens: (tokens) =>
    set({ tokens, lastUpdated: Date.now() }),

  getAggregateScore: () => {
    const entries: TokenScoreEntry[] = get().tokens.map((t) => ({
      symbol: t.symbol,
      score: t.privacyScore,
      balanceUsd: t.balanceUsd,
    }))
    return calculateWalletPrivacyScore(entries)
  },

  getTokensSortedByValue: () =>
    [...get().tokens].sort((a, b) => b.balanceUsd - a.balanceUsd),

  setLoading: (loading) => set({ isLoading: loading }),

  clear: () => set({ tokens: [], lastUpdated: null }),
}))
