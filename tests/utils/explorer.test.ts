/**
 * Explorer URL Utility Tests
 */

import { describe, it, expect } from "vitest"
import {
  getExplorerTxUrl,
  getExplorerAccountUrl,
  getExplorerName,
} from "@/utils/explorer"

describe("Explorer Utilities", () => {
  const TEST_TX_HASH = "5xyzabc123def456ghi789jkl012mno345pqr678stu901vwx234yz"
  const TEST_ADDRESS = "S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at"

  describe("getExplorerTxUrl", () => {
    describe("Solscan", () => {
      it("should generate mainnet URL without cluster param", () => {
        const url = getExplorerTxUrl(TEST_TX_HASH, "mainnet-beta", "solscan")
        expect(url).toBe(`https://solscan.io/tx/${TEST_TX_HASH}`)
        expect(url).not.toContain("cluster")
      })

      it("should generate devnet URL with cluster param", () => {
        const url = getExplorerTxUrl(TEST_TX_HASH, "devnet", "solscan")
        expect(url).toBe(`https://solscan.io/tx/${TEST_TX_HASH}?cluster=devnet`)
      })

      it("should generate testnet URL with cluster param", () => {
        const url = getExplorerTxUrl(TEST_TX_HASH, "testnet", "solscan")
        expect(url).toBe(`https://solscan.io/tx/${TEST_TX_HASH}?cluster=testnet`)
      })

      it("should default to solscan when no explorer specified", () => {
        const url = getExplorerTxUrl(TEST_TX_HASH, "mainnet-beta")
        expect(url).toContain("solscan.io")
      })
    })

    describe("Solana Explorer", () => {
      it("should generate mainnet URL without cluster param", () => {
        const url = getExplorerTxUrl(TEST_TX_HASH, "mainnet-beta", "solana-explorer")
        expect(url).toBe(`https://explorer.solana.com/tx/${TEST_TX_HASH}`)
        expect(url).not.toContain("cluster")
      })

      it("should generate devnet URL with cluster param", () => {
        const url = getExplorerTxUrl(TEST_TX_HASH, "devnet", "solana-explorer")
        expect(url).toBe(`https://explorer.solana.com/tx/${TEST_TX_HASH}?cluster=devnet`)
      })

      it("should generate testnet URL with cluster param", () => {
        const url = getExplorerTxUrl(TEST_TX_HASH, "testnet", "solana-explorer")
        expect(url).toBe(`https://explorer.solana.com/tx/${TEST_TX_HASH}?cluster=testnet`)
      })
    })
  })

  describe("getExplorerAccountUrl", () => {
    describe("Solscan", () => {
      it("should generate mainnet account URL", () => {
        const url = getExplorerAccountUrl(TEST_ADDRESS, "mainnet-beta", "solscan")
        expect(url).toBe(`https://solscan.io/account/${TEST_ADDRESS}`)
      })

      it("should generate devnet account URL", () => {
        const url = getExplorerAccountUrl(TEST_ADDRESS, "devnet", "solscan")
        expect(url).toBe(`https://solscan.io/account/${TEST_ADDRESS}?cluster=devnet`)
      })
    })

    describe("Solana Explorer", () => {
      it("should generate mainnet address URL", () => {
        const url = getExplorerAccountUrl(TEST_ADDRESS, "mainnet-beta", "solana-explorer")
        expect(url).toBe(`https://explorer.solana.com/address/${TEST_ADDRESS}`)
      })

      it("should generate devnet address URL", () => {
        const url = getExplorerAccountUrl(TEST_ADDRESS, "devnet", "solana-explorer")
        expect(url).toBe(`https://explorer.solana.com/address/${TEST_ADDRESS}?cluster=devnet`)
      })
    })
  })

  describe("getExplorerName", () => {
    it("should return 'Solscan' for solscan", () => {
      expect(getExplorerName("solscan")).toBe("Solscan")
    })

    it("should return 'Solana Explorer' for solana-explorer", () => {
      expect(getExplorerName("solana-explorer")).toBe("Solana Explorer")
    })
  })
})
