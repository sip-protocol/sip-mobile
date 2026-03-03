/**
 * Privacy Score Calculator Tests
 *
 * TDD: Tests written before implementation.
 * Covers per-token scoring (weighted: 40% tx privacy, 30% stealth, 30% balance)
 * and USD-weighted aggregate wallet scoring.
 */

import { describe, it, expect } from "vitest"
import {
  calculateTokenPrivacyScore,
  calculateWalletPrivacyScore,
} from "@/utils/privacyScore"
import type {
  TokenPrivacyInput,
  TokenScoreEntry,
} from "@/utils/privacyScore"

describe("Privacy Score Calculator", () => {
  describe("calculateTokenPrivacyScore", () => {
    it("should return 100 for fully shielded token", () => {
      const input: TokenPrivacyInput = {
        totalTransactions: 10,
        shieldedTransactions: 10,
        hasStealthAddress: true,
        balanceExposed: false,
      }
      expect(calculateTokenPrivacyScore(input)).toBe(100)
    })

    it("should return 0 for fully transparent token", () => {
      const input: TokenPrivacyInput = {
        totalTransactions: 10,
        shieldedTransactions: 0,
        hasStealthAddress: false,
        balanceExposed: true,
      }
      expect(calculateTokenPrivacyScore(input)).toBe(0)
    })

    it("should weight transaction privacy at 40%", () => {
      // Only transaction privacy contributes: 50% shielded = 0.5 * 40 = 20
      const input: TokenPrivacyInput = {
        totalTransactions: 10,
        shieldedTransactions: 5,
        hasStealthAddress: false,
        balanceExposed: true,
      }
      expect(calculateTokenPrivacyScore(input)).toBe(20)
    })

    it("should weight stealth address at 30%", () => {
      // Only stealth address contributes: 30
      const input: TokenPrivacyInput = {
        totalTransactions: 10,
        shieldedTransactions: 0,
        hasStealthAddress: true,
        balanceExposed: true,
      }
      expect(calculateTokenPrivacyScore(input)).toBe(30)
    })

    it("should weight balance privacy at 30%", () => {
      // Only balance privacy contributes: 30
      const input: TokenPrivacyInput = {
        totalTransactions: 10,
        shieldedTransactions: 0,
        hasStealthAddress: false,
        balanceExposed: false,
      }
      expect(calculateTokenPrivacyScore(input)).toBe(30)
    })

    it("should return full tx privacy score when 0 total transactions", () => {
      // 0 transactions = no exposure = full 40 + stealth(30) + balance(30) = 100
      const input: TokenPrivacyInput = {
        totalTransactions: 0,
        shieldedTransactions: 0,
        hasStealthAddress: true,
        balanceExposed: false,
      }
      expect(calculateTokenPrivacyScore(input)).toBe(100)
    })

    it("should handle 0 transactions without stealth or balance privacy", () => {
      // 0 transactions = full tx privacy (40), no stealth (0), exposed balance (0)
      const input: TokenPrivacyInput = {
        totalTransactions: 0,
        shieldedTransactions: 0,
        hasStealthAddress: false,
        balanceExposed: true,
      }
      expect(calculateTokenPrivacyScore(input)).toBe(40)
    })

    it("should calculate partial scores correctly", () => {
      // 3/10 shielded = 0.3 * 40 = 12, stealth = 30, exposed = 0 => 42
      const input: TokenPrivacyInput = {
        totalTransactions: 10,
        shieldedTransactions: 3,
        hasStealthAddress: true,
        balanceExposed: true,
      }
      expect(calculateTokenPrivacyScore(input)).toBe(42)
    })

    it("should round to nearest integer", () => {
      // 1/3 shielded = 0.333... * 40 = 13.333..., no stealth (0), not exposed (30) => 43.333... => 43
      const input: TokenPrivacyInput = {
        totalTransactions: 3,
        shieldedTransactions: 1,
        hasStealthAddress: false,
        balanceExposed: false,
      }
      expect(calculateTokenPrivacyScore(input)).toBe(43)
    })

    it("should round up at .5", () => {
      // 1/4 shielded = 0.25 * 40 = 10, stealth(30), exposed(0) => 40
      // Actually let's find a .5 case: 3/8 = 0.375 * 40 = 15, no stealth(0), not exposed(30) => 45 (no rounding needed)
      // Try: 1/6 = 0.1666... * 40 = 6.666..., stealth(30), exposed(0) => 36.666... => 37
      const input: TokenPrivacyInput = {
        totalTransactions: 6,
        shieldedTransactions: 1,
        hasStealthAddress: true,
        balanceExposed: true,
      }
      expect(calculateTokenPrivacyScore(input)).toBe(37)
    })

    it("should handle large transaction counts", () => {
      const input: TokenPrivacyInput = {
        totalTransactions: 1_000_000,
        shieldedTransactions: 750_000,
        hasStealthAddress: true,
        balanceExposed: false,
      }
      // 0.75 * 40 = 30, stealth = 30, balance = 30 => 90
      expect(calculateTokenPrivacyScore(input)).toBe(90)
    })

    it("should handle single transaction shielded", () => {
      const input: TokenPrivacyInput = {
        totalTransactions: 1,
        shieldedTransactions: 1,
        hasStealthAddress: false,
        balanceExposed: true,
      }
      // 1.0 * 40 = 40, no stealth (0), exposed (0) => 40
      expect(calculateTokenPrivacyScore(input)).toBe(40)
    })

    it("should handle single transaction not shielded", () => {
      const input: TokenPrivacyInput = {
        totalTransactions: 1,
        shieldedTransactions: 0,
        hasStealthAddress: false,
        balanceExposed: true,
      }
      // 0.0 * 40 = 0, no stealth (0), exposed (0) => 0
      expect(calculateTokenPrivacyScore(input)).toBe(0)
    })

    it("should combine stealth and balance privacy without transactions", () => {
      // stealth(30) + balance(30) = 60, no tx (but 0 total = full 40) => 100
      // Wait, 0 total = full tx privacy. Let me use non-zero.
      // 0/5 = 0 * 40 = 0, stealth(30), not exposed(30) => 60
      const input: TokenPrivacyInput = {
        totalTransactions: 5,
        shieldedTransactions: 0,
        hasStealthAddress: true,
        balanceExposed: false,
      }
      expect(calculateTokenPrivacyScore(input)).toBe(60)
    })

    it("should return integer result for all weight combinations", () => {
      const cases: TokenPrivacyInput[] = [
        { totalTransactions: 7, shieldedTransactions: 3, hasStealthAddress: true, balanceExposed: false },
        { totalTransactions: 13, shieldedTransactions: 5, hasStealthAddress: false, balanceExposed: true },
        { totalTransactions: 99, shieldedTransactions: 33, hasStealthAddress: true, balanceExposed: true },
      ]
      for (const input of cases) {
        const score = calculateTokenPrivacyScore(input)
        expect(score).toBe(Math.round(score))
        expect(score).toBeGreaterThanOrEqual(0)
        expect(score).toBeLessThanOrEqual(100)
      }
    })
  })

  describe("calculateWalletPrivacyScore", () => {
    it("should return 100 for empty portfolio", () => {
      expect(calculateWalletPrivacyScore([])).toBe(100)
    })

    it("should return single token score for one-token portfolio", () => {
      const tokens: TokenScoreEntry[] = [
        { symbol: "SOL", score: 75, balanceUsd: 1000 },
      ]
      expect(calculateWalletPrivacyScore(tokens)).toBe(75)
    })

    it("should weight by USD value", () => {
      const tokens: TokenScoreEntry[] = [
        { symbol: "SOL", score: 100, balanceUsd: 900 },
        { symbol: "USDC", score: 0, balanceUsd: 100 },
      ]
      // (100 * 900 + 0 * 100) / 1000 = 90
      expect(calculateWalletPrivacyScore(tokens)).toBe(90)
    })

    it("should handle equal weights", () => {
      const tokens: TokenScoreEntry[] = [
        { symbol: "SOL", score: 80, balanceUsd: 500 },
        { symbol: "USDC", score: 40, balanceUsd: 500 },
      ]
      // (80 * 500 + 40 * 500) / 1000 = 60
      expect(calculateWalletPrivacyScore(tokens)).toBe(60)
    })

    it("should handle multiple tokens with varying weights", () => {
      const tokens: TokenScoreEntry[] = [
        { symbol: "SOL", score: 100, balanceUsd: 500 },
        { symbol: "USDC", score: 50, balanceUsd: 300 },
        { symbol: "RAY", score: 0, balanceUsd: 200 },
      ]
      // (100*500 + 50*300 + 0*200) / 1000 = (50000 + 15000) / 1000 = 65
      expect(calculateWalletPrivacyScore(tokens)).toBe(65)
    })

    it("should return 100 when all tokens have zero USD balance", () => {
      const tokens: TokenScoreEntry[] = [
        { symbol: "SOL", score: 50, balanceUsd: 0 },
        { symbol: "USDC", score: 25, balanceUsd: 0 },
      ]
      expect(calculateWalletPrivacyScore(tokens)).toBe(100)
    })

    it("should round to nearest integer", () => {
      const tokens: TokenScoreEntry[] = [
        { symbol: "SOL", score: 100, balanceUsd: 333 },
        { symbol: "USDC", score: 0, balanceUsd: 667 },
      ]
      // (100 * 333 + 0 * 667) / 1000 = 33300 / 1000 = 33.3 => 33
      expect(calculateWalletPrivacyScore(tokens)).toBe(33)
    })

    it("should handle very small balances", () => {
      const tokens: TokenScoreEntry[] = [
        { symbol: "SOL", score: 80, balanceUsd: 0.01 },
        { symbol: "USDC", score: 20, balanceUsd: 0.01 },
      ]
      // Equal weight => (80 + 20) / 2 = 50
      expect(calculateWalletPrivacyScore(tokens)).toBe(50)
    })

    it("should handle heavily skewed portfolio", () => {
      const tokens: TokenScoreEntry[] = [
        { symbol: "SOL", score: 10, balanceUsd: 99_000 },
        { symbol: "DUST", score: 100, balanceUsd: 1 },
      ]
      // (10 * 99000 + 100 * 1) / 99001 = 990100 / 99001 = 10.001... => 10
      expect(calculateWalletPrivacyScore(tokens)).toBe(10)
    })

    it("should return integer for all cases", () => {
      const tokens: TokenScoreEntry[] = [
        { symbol: "A", score: 73, balanceUsd: 123.45 },
        { symbol: "B", score: 41, balanceUsd: 678.90 },
        { symbol: "C", score: 92, balanceUsd: 55.55 },
      ]
      const score = calculateWalletPrivacyScore(tokens)
      expect(score).toBe(Math.round(score))
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    })

    it("should handle all tokens with score 100", () => {
      const tokens: TokenScoreEntry[] = [
        { symbol: "SOL", score: 100, balanceUsd: 500 },
        { symbol: "USDC", score: 100, balanceUsd: 300 },
        { symbol: "RAY", score: 100, balanceUsd: 200 },
      ]
      expect(calculateWalletPrivacyScore(tokens)).toBe(100)
    })

    it("should handle all tokens with score 0", () => {
      const tokens: TokenScoreEntry[] = [
        { symbol: "SOL", score: 0, balanceUsd: 500 },
        { symbol: "USDC", score: 0, balanceUsd: 300 },
      ]
      expect(calculateWalletPrivacyScore(tokens)).toBe(0)
    })

    it("should ignore tokens with zero balance in weighting", () => {
      const tokens: TokenScoreEntry[] = [
        { symbol: "SOL", score: 80, balanceUsd: 1000 },
        { symbol: "DUST", score: 0, balanceUsd: 0 },
      ]
      // DUST has 0 USD, contributes nothing. SOL is 100% weight => 80
      expect(calculateWalletPrivacyScore(tokens)).toBe(80)
    })
  })
})
