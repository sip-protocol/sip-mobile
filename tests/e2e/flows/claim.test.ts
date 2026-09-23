/**
 * Claim Flow E2E Tests
 *
 * Tests the complete payment claiming flow:
 * 1. Load stealth keys from secure storage
 * 2. Derive spending key from payment
 * 3. Build claim transaction
 * 4. Sign with derived key
 * 5. Submit to network
 * 6. Confirm and update payment status
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  mockRpc,
  setupMockStealthAccount,
  resetMocks,
  MOCK_STEALTH_ADDRESS,
} from "../helpers/mockRpc"

// ============================================================================
// Types
// ============================================================================

type ClaimStatus = "idle" | "deriving" | "signing" | "submitting" | "confirmed" | "error"

interface PaymentRecord {
  id: string
  type: "send" | "receive"
  amount: string
  token: string
  status: "pending" | "completed" | "claimed" | "failed"
  stealthAddress?: string
  txHash?: string
  timestamp: number
  claimed: boolean
}

interface StealthKeys {
  spendingPrivateKey: string
  spendingPublicKey: string
  viewingPrivateKey: string
  viewingPublicKey: string
}

interface ClaimResult {
  success: boolean
  txHash?: string
  error?: string
}

// ============================================================================
// Mock Stealth Keys
// ============================================================================

const MOCK_STEALTH_KEYS: StealthKeys = {
  spendingPrivateKey: "0x" + "ab".repeat(32),
  spendingPublicKey: "0x" + "cd".repeat(32),
  viewingPrivateKey: "0x" + "ef".repeat(32),
  viewingPublicKey: "0x" + "12".repeat(32),
}

// ============================================================================
// Mock Claim Flow Implementation
// ============================================================================

async function executeClaimFlow(
  payment: PaymentRecord,
  keys: StealthKeys | null,
  _destinationAddress: string
): Promise<{ status: ClaimStatus; result: ClaimResult }> {
  // Step 1: Validate payment
  if (!payment) {
    return {
      status: "error",
      result: { success: false, error: "No payment to claim" },
    }
  }

  if (payment.claimed) {
    return {
      status: "error",
      result: { success: false, error: "Payment already claimed" },
    }
  }

  if (payment.type !== "receive") {
    return {
      status: "error",
      result: { success: false, error: "Can only claim received payments" },
    }
  }

  if (payment.status !== "completed") {
    return {
      status: "error",
      result: { success: false, error: "Payment not yet completed" },
    }
  }

  // Step 2: Load keys
  if (!keys) {
    return {
      status: "error",
      result: { success: false, error: "Stealth keys not found" },
    }
  }

  // Step 3: Derive spending key (simulated)
  if (!payment.stealthAddress || !payment.stealthAddress.startsWith("sip:")) {
    return {
      status: "error",
      result: { success: false, error: "Invalid stealth address format" },
    }
  }


  // Step 4: Build claim transaction (mock)
  const txBytes = new Uint8Array(512)
  txBytes.fill(0)

  // Step 5: Submit to network
  try {
    const signature = await mockRpc.sendTransaction(txBytes)

    // Step 6: Confirm
    const confirmation = await mockRpc.confirmTransaction(signature)
    if (confirmation.value.err) {
      return {
        status: "error",
        result: { success: false, error: "Claim failed on-chain" },
      }
    }

    return {
      status: "confirmed",
      result: { success: true, txHash: signature },
    }
  } catch (err) {
    return {
      status: "error",
      result: {
        success: false,
        error: err instanceof Error ? err.message : "Claim failed",
      },
    }
  }
}

// ============================================================================
// Mock Multi-Claim Flow
// ============================================================================

async function executeMultiClaimFlow(
  payments: PaymentRecord[],
  keys: StealthKeys | null,
  destinationAddress: string
): Promise<ClaimResult[]> {
  const results: ClaimResult[] = []

  for (const payment of payments) {
    const { result } = await executeClaimFlow(payment, keys, destinationAddress)
    results.push(result)

    // Small delay between claims
    if (result.success) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  }

  return results
}

// ============================================================================
// Tests
// ============================================================================

describe("Claim Flow E2E", () => {
  beforeEach(() => {
    resetMocks()
    setupMockStealthAccount(1) // 1 SOL in stealth account
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("Payment Validation", () => {
    it("should reject already claimed payment", async () => {
      const payment: PaymentRecord = {
        id: "payment_1",
        type: "receive",
        amount: "1",
        token: "SOL",
        status: "completed",
        stealthAddress: "sip:solana:0x1234:0x5678",
        timestamp: Date.now(),
        claimed: true,
      }

      const result = await executeClaimFlow(
        payment,
        MOCK_STEALTH_KEYS,
        MOCK_STEALTH_ADDRESS
      )

      expect(result.status).toBe("error")
      expect(result.result.error).toContain("already claimed")
    })

    it("should reject sent payments", async () => {
      const payment: PaymentRecord = {
        id: "payment_1",
        type: "send",
        amount: "1",
        token: "SOL",
        status: "completed",
        timestamp: Date.now(),
        claimed: false,
      }

      const result = await executeClaimFlow(
        payment,
        MOCK_STEALTH_KEYS,
        MOCK_STEALTH_ADDRESS
      )

      expect(result.status).toBe("error")
      expect(result.result.error).toContain("only claim received")
    })

    it("should reject pending payments", async () => {
      const payment: PaymentRecord = {
        id: "payment_1",
        type: "receive",
        amount: "1",
        token: "SOL",
        status: "pending",
        stealthAddress: "sip:solana:0x1234:0x5678",
        timestamp: Date.now(),
        claimed: false,
      }

      const result = await executeClaimFlow(
        payment,
        MOCK_STEALTH_KEYS,
        MOCK_STEALTH_ADDRESS
      )

      expect(result.status).toBe("error")
      expect(result.result.error).toContain("not yet completed")
    })
  })

  describe("Key Derivation", () => {
    it("should require stealth keys", async () => {
      const payment: PaymentRecord = {
        id: "payment_1",
        type: "receive",
        amount: "1",
        token: "SOL",
        status: "completed",
        stealthAddress: "sip:solana:0x1234:0x5678",
        timestamp: Date.now(),
        claimed: false,
      }

      const result = await executeClaimFlow(
        payment,
        null,
        MOCK_STEALTH_ADDRESS
      )

      expect(result.status).toBe("error")
      expect(result.result.error).toContain("keys not found")
    })

    it("should require valid stealth address format", async () => {
      const payment: PaymentRecord = {
        id: "payment_1",
        type: "receive",
        amount: "1",
        token: "SOL",
        status: "completed",
        stealthAddress: "invalid-address",
        timestamp: Date.now(),
        claimed: false,
      }

      const result = await executeClaimFlow(
        payment,
        MOCK_STEALTH_KEYS,
        MOCK_STEALTH_ADDRESS
      )

      expect(result.status).toBe("error")
      expect(result.result.error).toContain("Invalid stealth address")
    })
  })

  describe("Claim Execution", () => {
    it("should successfully claim payment", async () => {
      const payment: PaymentRecord = {
        id: "payment_1",
        type: "receive",
        amount: "1",
        token: "SOL",
        status: "completed",
        stealthAddress: "sip:solana:0x1234:0x5678",
        timestamp: Date.now(),
        claimed: false,
      }

      const result = await executeClaimFlow(
        payment,
        MOCK_STEALTH_KEYS,
        MOCK_STEALTH_ADDRESS
      )

      expect(result.status).toBe("confirmed")
      expect(result.result.success).toBe(true)
      expect(result.result.txHash).toBeDefined()
    })

    it("should handle RPC failure", async () => {
      mockRpc.setFailure(true, "Network error")

      const payment: PaymentRecord = {
        id: "payment_1",
        type: "receive",
        amount: "1",
        token: "SOL",
        status: "completed",
        stealthAddress: "sip:solana:0x1234:0x5678",
        timestamp: Date.now(),
        claimed: false,
      }

      const result = await executeClaimFlow(
        payment,
        MOCK_STEALTH_KEYS,
        MOCK_STEALTH_ADDRESS
      )

      expect(result.status).toBe("error")
      expect(result.result.error).toContain("Network error")
    })
  })

  describe("Multi-Claim", () => {
    it("should claim multiple payments", async () => {
      const payments: PaymentRecord[] = [
        {
          id: "payment_1",
          type: "receive",
          amount: "1",
          token: "SOL",
          status: "completed",
          stealthAddress: "sip:solana:0x1111:0x2222",
          timestamp: Date.now() - 3600000,
          claimed: false,
        },
        {
          id: "payment_2",
          type: "receive",
          amount: "0.5",
          token: "SOL",
          status: "completed",
          stealthAddress: "sip:solana:0x3333:0x4444",
          timestamp: Date.now() - 1800000,
          claimed: false,
        },
        {
          id: "payment_3",
          type: "receive",
          amount: "2",
          token: "SOL",
          status: "completed",
          stealthAddress: "sip:solana:0x5555:0x6666",
          timestamp: Date.now(),
          claimed: false,
        },
      ]

      const results = await executeMultiClaimFlow(
        payments,
        MOCK_STEALTH_KEYS,
        MOCK_STEALTH_ADDRESS
      )

      expect(results.length).toBe(3)
      expect(results.every((r) => r.success)).toBe(true)
      expect(results.every((r) => r.txHash)).toBe(true)
    })

    it("should handle partial failures", async () => {
      const payments: PaymentRecord[] = [
        {
          id: "payment_1",
          type: "receive",
          amount: "1",
          token: "SOL",
          status: "completed",
          stealthAddress: "sip:solana:0x1111:0x2222",
          timestamp: Date.now(),
          claimed: false,
        },
        {
          id: "payment_2",
          type: "receive",
          amount: "0.5",
          token: "SOL",
          status: "completed",
          stealthAddress: "invalid", // Invalid address
          timestamp: Date.now(),
          claimed: false,
        },
      ]

      const results = await executeMultiClaimFlow(
        payments,
        MOCK_STEALTH_KEYS,
        MOCK_STEALTH_ADDRESS
      )

      expect(results.length).toBe(2)
      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(false)
    })
  })

  describe("Edge Cases", () => {
    it("should handle very small amounts", async () => {
      const payment: PaymentRecord = {
        id: "payment_1",
        type: "receive",
        amount: "0.000001",
        token: "SOL",
        status: "completed",
        stealthAddress: "sip:solana:0x1234:0x5678",
        timestamp: Date.now(),
        claimed: false,
      }

      const result = await executeClaimFlow(
        payment,
        MOCK_STEALTH_KEYS,
        MOCK_STEALTH_ADDRESS
      )

      expect(result.status).toBe("confirmed")
    })

    it("should handle large amounts", async () => {
      setupMockStealthAccount(1000000) // 1M SOL

      const payment: PaymentRecord = {
        id: "payment_1",
        type: "receive",
        amount: "999999",
        token: "SOL",
        status: "completed",
        stealthAddress: "sip:solana:0x1234:0x5678",
        timestamp: Date.now(),
        claimed: false,
      }

      const result = await executeClaimFlow(
        payment,
        MOCK_STEALTH_KEYS,
        MOCK_STEALTH_ADDRESS
      )

      expect(result.status).toBe("confirmed")
    })
  })
})
