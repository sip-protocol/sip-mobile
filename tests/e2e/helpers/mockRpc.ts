/**
 * Mock RPC Helper for E2E Tests
 *
 * Simulates Solana devnet responses for testing.
 * Can be switched to real devnet when the Anchor program is deployed.
 */

import { vi } from "vitest"

// ============================================================================
// Types
// ============================================================================

export interface MockAccount {
  pubkey: string
  lamports: number
  owner: string
  data: string
}

export interface MockTransaction {
  signature: string
  slot: number
  blockTime: number
  confirmationStatus: "processed" | "confirmed" | "finalized"
}

export interface MockRpcConfig {
  network: "devnet" | "mainnet"
  delay: number
  shouldFail: boolean
  failureMessage?: string
}

// ============================================================================
// Constants
// ============================================================================

export const MOCK_WALLET = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
export const MOCK_STEALTH_ADDRESS = "3Jv9fzVuYxE3FzLhD8WtMnNYcLYQdCQn9GhT5RrAnS1Y"
export const MOCK_TOKEN_MINT = "So11111111111111111111111111111111111111112"

export const LAMPORTS_PER_SOL = 1_000_000_000

// ============================================================================
// Mock RPC Responses
// ============================================================================

export function createMockBalance(sol: number): { value: number } {
  return { value: sol * LAMPORTS_PER_SOL }
}

export function createMockTokenBalance(
  amount: number,
  decimals: number = 9
): {
  value: {
    amount: string
    decimals: number
    uiAmount: number
    uiAmountString: string
  }
} {
  return {
    value: {
      amount: (amount * Math.pow(10, decimals)).toString(),
      decimals,
      uiAmount: amount,
      uiAmountString: amount.toString(),
    },
  }
}

export function createMockSignature(): string {
  const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
  let signature = ""
  for (let i = 0; i < 88; i++) {
    signature += chars[Math.floor(Math.random() * chars.length)]
  }
  return signature
}

export function createMockTransaction(
  status: "processed" | "confirmed" | "finalized" = "finalized"
): MockTransaction {
  return {
    signature: createMockSignature(),
    slot: Math.floor(Math.random() * 1000000) + 200000000,
    blockTime: Math.floor(Date.now() / 1000),
    confirmationStatus: status,
  }
}

export function createMockBlockhash(): { blockhash: string; lastValidBlockHeight: number } {
  const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
  let blockhash = ""
  for (let i = 0; i < 44; i++) {
    blockhash += chars[Math.floor(Math.random() * chars.length)]
  }
  return {
    blockhash,
    lastValidBlockHeight: Math.floor(Math.random() * 1000) + 200000000,
  }
}

// ============================================================================
// Mock RPC Client
// ============================================================================

export class MockRpcClient {
  private config: MockRpcConfig
  private accounts: Map<string, MockAccount> = new Map()
  private transactions: Map<string, MockTransaction> = new Map()

  constructor(config: Partial<MockRpcConfig> = {}) {
    this.config = {
      network: config.network || "devnet",
      delay: config.delay || 100,
      shouldFail: config.shouldFail || false,
      failureMessage: config.failureMessage,
    }
  }

  private async delay(): Promise<void> {
    if (this.config.delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.config.delay))
    }
  }

  private checkFailure(): void {
    if (this.config.shouldFail) {
      throw new Error(this.config.failureMessage || "RPC request failed")
    }
  }

  // Set up mock account
  setAccount(pubkey: string, lamports: number, owner: string = "11111111111111111111111111111111"): void {
    this.accounts.set(pubkey, {
      pubkey,
      lamports,
      owner,
      data: "",
    })
  }

  // RPC Methods
  async getBalance(pubkey: string): Promise<{ value: number }> {
    await this.delay()
    this.checkFailure()

    const account = this.accounts.get(pubkey)
    return { value: account?.lamports || 0 }
  }

  async getLatestBlockhash(): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
    await this.delay()
    this.checkFailure()
    return createMockBlockhash()
  }

  async sendTransaction(_serializedTx: Uint8Array): Promise<string> {
    await this.delay()
    this.checkFailure()

    const tx = createMockTransaction("processed")
    this.transactions.set(tx.signature, tx)
    return tx.signature
  }

  async confirmTransaction(
    signature: string,
    _commitment: string = "confirmed"
  ): Promise<{ value: { err: null | object } }> {
    await this.delay()
    this.checkFailure()

    const tx = this.transactions.get(signature)
    if (tx) {
      tx.confirmationStatus = "confirmed"
    }
    return { value: { err: null } }
  }

  async getSignatureStatus(signature: string): Promise<{
    value: { confirmationStatus: string; err: null | object } | null
  }> {
    await this.delay()
    this.checkFailure()

    const tx = this.transactions.get(signature)
    if (!tx) {
      return { value: null }
    }
    return {
      value: {
        confirmationStatus: tx.confirmationStatus,
        err: null,
      },
    }
  }

  async getTokenAccountsByOwner(
    _owner: string,
    _filter: { mint?: string }
  ): Promise<{ value: Array<{ pubkey: string; account: { lamports: number } }> }> {
    await this.delay()
    this.checkFailure()
    return { value: [] }
  }

  // Configure failure mode
  setFailure(shouldFail: boolean, message?: string): void {
    this.config.shouldFail = shouldFail
    this.config.failureMessage = message
  }

  // Reset state
  reset(): void {
    this.accounts.clear()
    this.transactions.clear()
    this.config.shouldFail = false
  }
}

// ============================================================================
// Global Mock Instance
// ============================================================================

export const mockRpc = new MockRpcClient()

// ============================================================================
// Mock Setup Helpers
// ============================================================================

export function setupMockWallet(balance: number = 10): void {
  mockRpc.setAccount(MOCK_WALLET, balance * LAMPORTS_PER_SOL)
}

export function setupMockStealthAccount(balance: number = 1): void {
  mockRpc.setAccount(MOCK_STEALTH_ADDRESS, balance * LAMPORTS_PER_SOL)
}

export function resetMocks(): void {
  mockRpc.reset()
}

// ============================================================================
// Vitest Mock Helpers
// ============================================================================

export function mockFetch(): void {
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async (_url: string, options?: RequestInit) => {
    const body = options?.body ? JSON.parse(options.body as string) : null
    const method = body?.method

    let result: unknown

    switch (method) {
      case "getBalance":
        result = createMockBalance(10)
        break
      case "getLatestBlockhash":
        result = createMockBlockhash()
        break
      case "sendTransaction":
        result = createMockSignature()
        break
      case "getSignatureStatuses":
        result = {
          value: [{ confirmationStatus: "finalized", err: null }],
        }
        break
      default:
        result = null
    }

    return {
      ok: true,
      json: async () => ({ jsonrpc: "2.0", result, id: body?.id || 1 }),
    }
  }))
}

export function restoreFetch(): void {
  vi.unstubAllGlobals()
}
