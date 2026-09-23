/**
 * Anchor Client Tests
 *
 * Tests for SipPrivacyClient and claim functions.
 * These are critical for on-chain shielded transfers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { PublicKey, Connection, Transaction } from "@solana/web3.js"

// Mock @coral-xyz/anchor
vi.mock("@coral-xyz/anchor", () => ({
  web3: {
    TransactionInstruction: vi.fn().mockImplementation((params) => ({
      keys: params.keys,
      programId: params.programId,
      data: params.data,
    })),
    SystemProgram: {
      programId: new PublicKey("11111111111111111111111111111111"),
    },
  },
}))

// Mock noble curves
vi.mock("@noble/curves/ed25519", () => ({
  ed25519: {
    getPublicKey: vi.fn().mockReturnValue(new Uint8Array(32).fill(0xab)),
    ExtendedPoint: {
      BASE: {
        multiply: vi.fn().mockReturnValue({
          toRawBytes: () => new Uint8Array(32).fill(0xcd),
        }),
      },
    },
  },
}))

// Mock noble hashes
vi.mock("@noble/hashes/sha256", () => ({
  sha256: vi.fn().mockReturnValue(new Uint8Array(32).fill(0x12)),
}))

vi.mock("@noble/hashes/sha512", () => ({
  sha512: vi.fn().mockReturnValue(new Uint8Array(64).fill(0x34)),
}))

// Mock stealth lib
vi.mock("@/lib/stealth", () => ({
  hexToBytes: vi.fn().mockImplementation((hex: string) => {
    const clean = hex.startsWith("0x") ? hex.slice(2) : hex
    const bytes = new Uint8Array(clean.length / 2)
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
    }
    return bytes
  }),
}))

// Mock anchor crypto functions
vi.mock("@/lib/anchor/crypto", () => ({
  createCommitment: vi.fn().mockResolvedValue({
    commitment: new Uint8Array(33).fill(0x01),
    blindingFactor: new Uint8Array(32).fill(0x02),
  }),
  encryptAmount: vi.fn().mockResolvedValue({
    nonce: new Uint8Array(24).fill(0x03),
    ciphertext: new Uint8Array(16).fill(0x04),
  }),
  computeViewingKeyHash: vi.fn().mockReturnValue(new Uint8Array(32).fill(0x05)),
  deriveSharedSecret: vi.fn().mockReturnValue(new Uint8Array(32).fill(0x06)),
  generateMockProof: vi.fn().mockResolvedValue(new Uint8Array(64).fill(0x07)),
  generateEphemeralKeyPair: vi.fn().mockResolvedValue({
    privateKey: new Uint8Array(32).fill(0x08),
    publicKey: new Uint8Array(33).fill(0x09),
  }),
}))

import {
  SipPrivacyClient,
  getSipPrivacyClient,
  resetSipPrivacyClient,
} from "@/lib/anchor/client"
import { SIP_PRIVACY_PROGRAM_ID, getConfigPda, getTransferRecordPda } from "@/lib/anchor/types"

describe("Anchor Client", () => {
  let mockConnection: Connection
  let client: SipPrivacyClient

  beforeEach(() => {
    // Reset singleton
    resetSipPrivacyClient()

    // Create mock connection
    mockConnection = {
      getAccountInfo: vi.fn(),
      getProgramAccounts: vi.fn(),
      getLatestBlockhash: vi.fn().mockResolvedValue({
        blockhash: "mockBlockhash123",
        lastValidBlockHeight: 12345,
      }),
      getFeeForMessage: vi.fn().mockResolvedValue({ value: 5000 }),
      sendRawTransaction: vi.fn().mockResolvedValue("mockSignature123"),
      confirmTransaction: vi.fn().mockResolvedValue({ value: { err: null } }),
    } as unknown as Connection

    client = new SipPrivacyClient(mockConnection)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe("SipPrivacyClient", () => {
    describe("constructor", () => {
      it("should create client with connection and default program ID", () => {
        const client = new SipPrivacyClient(mockConnection)
        expect(client).toBeInstanceOf(SipPrivacyClient)
      })

      it("should create client with custom program ID", () => {
        const customProgramId = new PublicKey("11111111111111111111111111111111")
        const client = new SipPrivacyClient(mockConnection, customProgramId)
        expect(client).toBeInstanceOf(SipPrivacyClient)
      })
    })

    describe("fetchConfig", () => {
      it("should return null when config account not found", async () => {
        ;(mockConnection.getAccountInfo as ReturnType<typeof vi.fn>).mockResolvedValue(null)

        const config = await client.fetchConfig()
        expect(config).toBeNull()
      })

      it("should parse config account correctly", async () => {
        // Create mock config account data
        // Layout: 8 byte discriminator + 32 byte authority + 2 byte fee_bps + 1 byte paused + 8 byte total_transfers + 1 byte bump
        const mockData = Buffer.alloc(52)
        // Skip discriminator (8 bytes)
        const authorityBytes = new PublicKey("S1P6j1yeTm6zkewQVeihrTZvmfoHABRkHDhabWTuWMd").toBuffer()
        authorityBytes.copy(mockData, 8) // authority at offset 8
        mockData.writeUInt16LE(50, 40) // fee_bps = 50 at offset 40 (8 + 32)
        mockData[42] = 0 // paused = false at offset 42
        mockData.writeBigUInt64LE(10n, 43) // total_transfers = 10 at offset 43
        mockData[51] = 255 // bump at offset 51

        ;(mockConnection.getAccountInfo as ReturnType<typeof vi.fn>).mockResolvedValue({
          data: mockData,
        })

        const config = await client.fetchConfig()
        expect(config).not.toBeNull()
        expect(config?.feeBps).toBe(50)
        expect(config?.paused).toBe(false)
        expect(config?.totalTransfers).toBe(10n)
      })

      it("should handle fetch errors gracefully", async () => {
        ;(mockConnection.getAccountInfo as ReturnType<typeof vi.fn>).mockRejectedValue(
          new Error("Network error")
        )

        const config = await client.fetchConfig()
        expect(config).toBeNull()
      })
    })

    describe("getState", () => {
      it("should return uninitialized state when config is null", async () => {
        ;(mockConnection.getAccountInfo as ReturnType<typeof vi.fn>).mockResolvedValue(null)

        const state = await client.getState()
        expect(state.isInitialized).toBe(false)
        expect(state.totalTransfers).toBe(0n)
        expect(state.feeBps).toBe(0)
        expect(state.authority).toBeNull()
      })

      it("should return initialized state from config", async () => {
        const mockData = Buffer.alloc(52)
        const authorityBytes = new PublicKey("S1P6j1yeTm6zkewQVeihrTZvmfoHABRkHDhabWTuWMd").toBuffer()
        authorityBytes.copy(mockData, 8)
        mockData.writeUInt16LE(100, 40)
        mockData[42] = 0
        mockData.writeBigUInt64LE(25n, 43)
        mockData[51] = 254

        ;(mockConnection.getAccountInfo as ReturnType<typeof vi.fn>).mockResolvedValue({
          data: mockData,
        })

        const state = await client.getState()
        expect(state.isInitialized).toBe(true)
        expect(state.totalTransfers).toBe(25n)
        expect(state.feeBps).toBe(100)
      })
    })

    describe("calculateProtocolFee", () => {
      it("should calculate fee correctly for 50 bps", () => {
        const fee = client.calculateProtocolFee(1.0, 50) // 1 SOL, 50 bps
        expect(fee).toBe(0.005) // 0.5%
      })

      it("should calculate fee correctly for 100 bps", () => {
        const fee = client.calculateProtocolFee(10.0, 100) // 10 SOL, 100 bps
        expect(fee).toBe(0.1) // 1%
      })

      it("should return 0 for 0 bps", () => {
        const fee = client.calculateProtocolFee(100.0, 0)
        expect(fee).toBe(0)
      })

      it("should handle small amounts", () => {
        const fee = client.calculateProtocolFee(0.001, 50)
        expect(fee).toBe(0.000005) // 0.001 * 50 / 10000
      })
    })

    describe("estimateFee", () => {
      it("should return estimated fee from connection", async () => {
        const mockTx = new Transaction()
        mockTx.recentBlockhash = "mockBlockhash"
        mockTx.feePayer = new PublicKey("S1P6j1yeTm6zkewQVeihrTZvmfoHABRkHDhabWTuWMd")

        const fee = await client.estimateFee(mockTx)
        expect(fee).toBe(5000)
      })

      it("should return default fee when estimation fails", async () => {
        ;(mockConnection.getFeeForMessage as ReturnType<typeof vi.fn>).mockResolvedValue({
          value: null,
        })

        const mockTx = new Transaction()
        mockTx.recentBlockhash = "mockBlockhash"
        mockTx.feePayer = new PublicKey("S1P6j1yeTm6zkewQVeihrTZvmfoHABRkHDhabWTuWMd")

        const fee = await client.estimateFee(mockTx)
        expect(fee).toBe(5000) // Default
      })
    })
  })

  describe("getSipPrivacyClient", () => {
    it("should create new client on first call", () => {
      const client1 = getSipPrivacyClient(mockConnection)
      expect(client1).toBeInstanceOf(SipPrivacyClient)
    })

    it("should return same instance on subsequent calls", () => {
      const client1 = getSipPrivacyClient(mockConnection)
      const client2 = getSipPrivacyClient(mockConnection)
      expect(client1).toBe(client2)
    })

    it("should create new instance after reset", () => {
      const client1 = getSipPrivacyClient(mockConnection)
      resetSipPrivacyClient()
      const client2 = getSipPrivacyClient(mockConnection)
      expect(client1).not.toBe(client2)
    })
  })

  describe("resetSipPrivacyClient", () => {
    it("should clear the singleton instance", () => {
      const client1 = getSipPrivacyClient(mockConnection)
      resetSipPrivacyClient()

      // Create new mock connection to verify new instance
      const newConnection = { ...mockConnection } as Connection
      const client2 = getSipPrivacyClient(newConnection)

      expect(client1).not.toBe(client2)
    })
  })
})

describe("PDA Derivation", () => {
  describe("getConfigPda", () => {
    it("should derive config PDA deterministically", () => {
      const [pda1, bump1] = getConfigPda(SIP_PRIVACY_PROGRAM_ID)
      const [pda2, bump2] = getConfigPda(SIP_PRIVACY_PROGRAM_ID)

      expect(pda1.equals(pda2)).toBe(true)
      expect(bump1).toBe(bump2)
    })

    it("should derive different PDAs for different programs", () => {
      const [pda1] = getConfigPda(SIP_PRIVACY_PROGRAM_ID)
      const [pda2] = getConfigPda(new PublicKey("11111111111111111111111111111111"))

      expect(pda1.equals(pda2)).toBe(false)
    })
  })

  describe("getTransferRecordPda", () => {
    it("should derive transfer record PDA from sender and index", () => {
      const sender = new PublicKey("S1P6j1yeTm6zkewQVeihrTZvmfoHABRkHDhabWTuWMd")
      const [pda1] = getTransferRecordPda(sender, 0n, SIP_PRIVACY_PROGRAM_ID)
      const [pda2] = getTransferRecordPda(sender, 0n, SIP_PRIVACY_PROGRAM_ID)

      expect(pda1.equals(pda2)).toBe(true)
    })

    it("should derive different PDAs for different indices", () => {
      const sender = new PublicKey("S1P6j1yeTm6zkewQVeihrTZvmfoHABRkHDhabWTuWMd")
      const [pda1] = getTransferRecordPda(sender, 0n, SIP_PRIVACY_PROGRAM_ID)
      const [pda2] = getTransferRecordPda(sender, 1n, SIP_PRIVACY_PROGRAM_ID)

      expect(pda1.equals(pda2)).toBe(false)
    })

    it("should derive different PDAs for different senders", () => {
      const sender1 = new PublicKey("S1P6j1yeTm6zkewQVeihrTZvmfoHABRkHDhabWTuWMd")
      const sender2 = new PublicKey("S1P9WhBSbAGGatvrVE4TRBZfWpbG96U26zksy2TQj8q")
      const [pda1] = getTransferRecordPda(sender1, 0n, SIP_PRIVACY_PROGRAM_ID)
      const [pda2] = getTransferRecordPda(sender2, 0n, SIP_PRIVACY_PROGRAM_ID)

      expect(pda1.equals(pda2)).toBe(false)
    })
  })
})

describe("Protocol Fee Calculation", () => {
  let client: SipPrivacyClient

  beforeEach(() => {
    const mockConnection = {} as Connection
    client = new SipPrivacyClient(mockConnection)
  })

  it("should calculate 0.5% fee for 50 bps", () => {
    expect(client.calculateProtocolFee(100, 50)).toBe(0.5)
    expect(client.calculateProtocolFee(1, 50)).toBe(0.005)
    expect(client.calculateProtocolFee(0.1, 50)).toBe(0.0005)
  })

  it("should calculate 1% fee for 100 bps", () => {
    expect(client.calculateProtocolFee(100, 100)).toBe(1)
    expect(client.calculateProtocolFee(1, 100)).toBe(0.01)
  })

  it("should calculate 0.1% fee for 10 bps", () => {
    expect(client.calculateProtocolFee(100, 10)).toBe(0.1)
    expect(client.calculateProtocolFee(1, 10)).toBe(0.001)
  })

  it("should handle edge cases", () => {
    expect(client.calculateProtocolFee(0, 50)).toBe(0)
    expect(client.calculateProtocolFee(1000000, 50)).toBe(5000)
  })
})
