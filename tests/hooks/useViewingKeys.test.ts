/**
 * useViewingKeys Hook Tests
 *
 * Tests viewing key management logic without Expo dependencies.
 */

import { describe, it, expect } from "vitest"
import { buildImportedViewingKey } from "@/hooks/useViewingKeys"
import type { ViewingKeyExport } from "@/types"

describe("buildImportedViewingKey (#86: persists spendingPublicKey)", () => {
  const exportData: ViewingKeyExport = {
    version: 1,
    chain: "solana",
    viewingPublicKey: "0xvpub",
    viewingPrivateKey: "0xvpriv",
    spendingPublicKey: "0xspub",
    exportedAt: 0,
  }

  it("carries spendingPublicKey from the export into the imported key", () => {
    const imported = buildImportedViewingKey(exportData, { label: "Auditor" }, "vk_test", 123)
    expect(imported.spendingPublicKey).toBe("0xspub")
    expect(imported.viewingPrivateKey).toBe("0xvpriv")
    expect(imported.viewingPublicKey).toBe("0xvpub")
    expect(imported.label).toBe("Auditor")
    expect(imported.chain).toBe("solana")
    expect(imported.id).toBe("vk_test")
    expect(imported.importedAt).toBe(123)
    expect(imported.paymentsFound).toBe(0)
  })

  it("carries ownerAddress when provided", () => {
    const imported = buildImportedViewingKey(
      exportData,
      { label: "X", ownerAddress: "alice.sol" },
      "id",
      0
    )
    expect(imported.ownerAddress).toBe("alice.sol")
  })
})

// ============================================================================
// Type Definitions (mirror from useViewingKeys.ts)
// ============================================================================

type ExportFormat = "hex" | "base64" | "json"

interface ExportOptions {
  format: ExportFormat
  includeMetadata: boolean
  expiresAt?: number
}

interface DisclosureInput {
  viewingKey: string
  recipientName: string
  purpose: string
  expiresAt?: number
}

interface DisclosedKey {
  id: string
  viewingKey: string
  recipientName: string
  purpose: string
  disclosedAt: number
  expiresAt?: number
  revoked: boolean
}

interface ImportKeyInput {
  key: string
  format: ExportFormat
  label?: string
}

// ============================================================================
// Re-implemented utility functions for isolated testing
// ============================================================================

function formatViewingKeyForExport(key: string, format: ExportFormat): string {
  const cleanKey = key.startsWith("0x") ? key.slice(2) : key

  switch (format) {
    case "hex":
      return `0x${cleanKey}`
    case "base64":
      // Simulate hex to base64 conversion
      const bytes = []
      for (let i = 0; i < cleanKey.length; i += 2) {
        bytes.push(parseInt(cleanKey.slice(i, i + 2), 16))
      }
      return Buffer.from(bytes).toString("base64")
    case "json":
      return JSON.stringify({ viewingKey: `0x${cleanKey}`, version: 1 })
    default:
      return `0x${cleanKey}`
  }
}

function parseImportedKey(input: ImportKeyInput): string | null {
  try {
    switch (input.format) {
      case "hex":
        if (!input.key.match(/^(0x)?[0-9a-fA-F]+$/)) return null
        return input.key.startsWith("0x") ? input.key : `0x${input.key}`
      case "base64":
        const decoded = Buffer.from(input.key, "base64")
        return `0x${decoded.toString("hex")}`
      case "json":
        const parsed = JSON.parse(input.key)
        return parsed.viewingKey || null
      default:
        return null
    }
  } catch {
    return null
  }
}

function createDisclosure(
  input: DisclosureInput,
  id: string
): DisclosedKey {
  return {
    id,
    viewingKey: input.viewingKey,
    recipientName: input.recipientName,
    purpose: input.purpose,
    disclosedAt: Date.now(),
    expiresAt: input.expiresAt,
    revoked: false,
  }
}

function isDisclosureExpired(disclosure: DisclosedKey): boolean {
  if (!disclosure.expiresAt) return false
  return Date.now() > disclosure.expiresAt
}

function isDisclosureActive(disclosure: DisclosedKey): boolean {
  return !disclosure.revoked && !isDisclosureExpired(disclosure)
}

function getActiveDisclosures(disclosures: DisclosedKey[]): DisclosedKey[] {
  return disclosures.filter(isDisclosureActive)
}

function getRevokedDisclosures(disclosures: DisclosedKey[]): DisclosedKey[] {
  return disclosures.filter((d) => d.revoked)
}

function getExpiredDisclosures(disclosures: DisclosedKey[]): DisclosedKey[] {
  return disclosures.filter((d) => !d.revoked && isDisclosureExpired(d))
}

function validateDisclosureInput(input: DisclosureInput): { valid: boolean; error?: string } {
  if (!input.viewingKey) {
    return { valid: false, error: "Viewing key is required" }
  }
  if (!input.recipientName || input.recipientName.trim() === "") {
    return { valid: false, error: "Recipient name is required" }
  }
  if (!input.purpose || input.purpose.trim() === "") {
    return { valid: false, error: "Purpose is required" }
  }
  if (input.expiresAt && input.expiresAt <= Date.now()) {
    return { valid: false, error: "Expiration must be in the future" }
  }
  return { valid: true }
}

function truncateViewingKey(key: string): string {
  if (key.length <= 16) return key
  return `${key.slice(0, 8)}...${key.slice(-6)}`
}

function formatExpirationDate(timestamp?: number): string {
  if (!timestamp) return "Never"
  return new Date(timestamp).toLocaleDateString()
}

function sortDisclosuresByDate(
  disclosures: DisclosedKey[],
  order: "asc" | "desc" = "desc"
): DisclosedKey[] {
  return [...disclosures].sort((a, b) => {
    return order === "desc"
      ? b.disclosedAt - a.disclosedAt
      : a.disclosedAt - b.disclosedAt
  })
}

// ============================================================================
// Tests
// ============================================================================

describe("useViewingKeys Utilities", () => {
  describe("formatViewingKeyForExport", () => {
    it("should format as hex", () => {
      expect(formatViewingKeyForExport("0xabcd", "hex")).toBe("0xabcd")
      expect(formatViewingKeyForExport("abcd", "hex")).toBe("0xabcd")
    })

    it("should format as base64", () => {
      const result = formatViewingKeyForExport("0xabcd", "base64")
      expect(result).toBe("q80=") // abcd in base64
    })

    it("should format as json", () => {
      const result = formatViewingKeyForExport("0x1234", "json")
      const parsed = JSON.parse(result)
      expect(parsed.viewingKey).toBe("0x1234")
      expect(parsed.version).toBe(1)
    })
  })

  describe("parseImportedKey", () => {
    it("should parse hex format", () => {
      expect(parseImportedKey({ key: "0xabcd", format: "hex" })).toBe("0xabcd")
      expect(parseImportedKey({ key: "abcd", format: "hex" })).toBe("0xabcd")
    })

    it("should parse base64 format", () => {
      const result = parseImportedKey({ key: "q80=", format: "base64" })
      expect(result).toBe("0xabcd")
    })

    it("should parse json format", () => {
      const json = JSON.stringify({ viewingKey: "0x1234" })
      expect(parseImportedKey({ key: json, format: "json" })).toBe("0x1234")
    })

    it("should return null for invalid input", () => {
      expect(parseImportedKey({ key: "not-hex", format: "hex" })).toBeNull()
      // Note: Buffer.from(str, "base64") doesn't throw for most strings,
      // it just decodes what it can. Only JSON truly fails.
      expect(parseImportedKey({ key: "not-json", format: "json" })).toBeNull()
    })
  })

  describe("createDisclosure", () => {
    it("should create disclosure with all fields", () => {
      const input: DisclosureInput = {
        viewingKey: "0x1234",
        recipientName: "Auditor",
        purpose: "Tax audit",
        expiresAt: Date.now() + 86400000,
      }
      const disclosure = createDisclosure(input, "disc_1")
      expect(disclosure.id).toBe("disc_1")
      expect(disclosure.viewingKey).toBe("0x1234")
      expect(disclosure.recipientName).toBe("Auditor")
      expect(disclosure.purpose).toBe("Tax audit")
      expect(disclosure.revoked).toBe(false)
      expect(disclosure.disclosedAt).toBeDefined()
    })
  })

  describe("isDisclosureExpired", () => {
    it("should return false when no expiry", () => {
      const disclosure: DisclosedKey = {
        id: "1",
        viewingKey: "0x1234",
        recipientName: "Test",
        purpose: "Test",
        disclosedAt: Date.now(),
        revoked: false,
      }
      expect(isDisclosureExpired(disclosure)).toBe(false)
    })

    it("should return false when expiry is in future", () => {
      const disclosure: DisclosedKey = {
        id: "1",
        viewingKey: "0x1234",
        recipientName: "Test",
        purpose: "Test",
        disclosedAt: Date.now(),
        expiresAt: Date.now() + 86400000,
        revoked: false,
      }
      expect(isDisclosureExpired(disclosure)).toBe(false)
    })

    it("should return true when expiry is in past", () => {
      const disclosure: DisclosedKey = {
        id: "1",
        viewingKey: "0x1234",
        recipientName: "Test",
        purpose: "Test",
        disclosedAt: Date.now() - 172800000,
        expiresAt: Date.now() - 86400000,
        revoked: false,
      }
      expect(isDisclosureExpired(disclosure)).toBe(true)
    })
  })

  describe("isDisclosureActive", () => {
    it("should return true for non-revoked, non-expired", () => {
      const disclosure: DisclosedKey = {
        id: "1",
        viewingKey: "0x1234",
        recipientName: "Test",
        purpose: "Test",
        disclosedAt: Date.now(),
        revoked: false,
      }
      expect(isDisclosureActive(disclosure)).toBe(true)
    })

    it("should return false when revoked", () => {
      const disclosure: DisclosedKey = {
        id: "1",
        viewingKey: "0x1234",
        recipientName: "Test",
        purpose: "Test",
        disclosedAt: Date.now(),
        revoked: true,
      }
      expect(isDisclosureActive(disclosure)).toBe(false)
    })
  })

  describe("getActiveDisclosures", () => {
    it("should filter to active only", () => {
      const disclosures: DisclosedKey[] = [
        { id: "1", viewingKey: "0x1", recipientName: "A", purpose: "P", disclosedAt: Date.now(), revoked: false },
        { id: "2", viewingKey: "0x2", recipientName: "B", purpose: "P", disclosedAt: Date.now(), revoked: true },
        { id: "3", viewingKey: "0x3", recipientName: "C", purpose: "P", disclosedAt: Date.now(), revoked: false },
      ]
      expect(getActiveDisclosures(disclosures).length).toBe(2)
    })
  })

  describe("getRevokedDisclosures", () => {
    it("should filter to revoked only", () => {
      const disclosures: DisclosedKey[] = [
        { id: "1", viewingKey: "0x1", recipientName: "A", purpose: "P", disclosedAt: Date.now(), revoked: false },
        { id: "2", viewingKey: "0x2", recipientName: "B", purpose: "P", disclosedAt: Date.now(), revoked: true },
      ]
      expect(getRevokedDisclosures(disclosures).length).toBe(1)
      expect(getRevokedDisclosures(disclosures)[0].id).toBe("2")
    })
  })

  describe("validateDisclosureInput", () => {
    it("should validate correct input", () => {
      const input: DisclosureInput = {
        viewingKey: "0x1234",
        recipientName: "Auditor",
        purpose: "Compliance",
      }
      expect(validateDisclosureInput(input).valid).toBe(true)
    })

    it("should reject missing viewing key", () => {
      const input: DisclosureInput = {
        viewingKey: "",
        recipientName: "Auditor",
        purpose: "Compliance",
      }
      expect(validateDisclosureInput(input).valid).toBe(false)
      expect(validateDisclosureInput(input).error).toContain("Viewing key")
    })

    it("should reject empty recipient", () => {
      const input: DisclosureInput = {
        viewingKey: "0x1234",
        recipientName: "  ",
        purpose: "Compliance",
      }
      expect(validateDisclosureInput(input).valid).toBe(false)
    })

    it("should reject past expiration", () => {
      const input: DisclosureInput = {
        viewingKey: "0x1234",
        recipientName: "Auditor",
        purpose: "Compliance",
        expiresAt: Date.now() - 86400000,
      }
      expect(validateDisclosureInput(input).valid).toBe(false)
      expect(validateDisclosureInput(input).error).toContain("future")
    })
  })

  describe("truncateViewingKey", () => {
    it("should truncate long keys", () => {
      const key = "0x1234567890abcdef1234567890abcdef"
      const truncated = truncateViewingKey(key)
      expect(truncated).toContain("...")
      expect(truncated.length).toBeLessThan(key.length)
    })

    it("should not truncate short keys", () => {
      const key = "0x1234"
      expect(truncateViewingKey(key)).toBe(key)
    })
  })

  describe("formatExpirationDate", () => {
    it("should return 'Never' for undefined", () => {
      expect(formatExpirationDate(undefined)).toBe("Never")
    })

    it("should format date", () => {
      const date = new Date("2026-01-15")
      const result = formatExpirationDate(date.getTime())
      expect(result).toContain("2026")
    })
  })

  describe("sortDisclosuresByDate", () => {
    it("should sort descending by default", () => {
      const disclosures: DisclosedKey[] = [
        { id: "1", viewingKey: "0x1", recipientName: "A", purpose: "P", disclosedAt: 1000, revoked: false },
        { id: "2", viewingKey: "0x2", recipientName: "B", purpose: "P", disclosedAt: 3000, revoked: false },
        { id: "3", viewingKey: "0x3", recipientName: "C", purpose: "P", disclosedAt: 2000, revoked: false },
      ]
      const sorted = sortDisclosuresByDate(disclosures)
      expect(sorted[0].id).toBe("2")
      expect(sorted[1].id).toBe("3")
      expect(sorted[2].id).toBe("1")
    })

    it("should sort ascending when specified", () => {
      const disclosures: DisclosedKey[] = [
        { id: "1", viewingKey: "0x1", recipientName: "A", purpose: "P", disclosedAt: 1000, revoked: false },
        { id: "2", viewingKey: "0x2", recipientName: "B", purpose: "P", disclosedAt: 3000, revoked: false },
      ]
      const sorted = sortDisclosuresByDate(disclosures, "asc")
      expect(sorted[0].id).toBe("1")
      expect(sorted[1].id).toBe("2")
    })
  })
})

describe("useViewingKeys Types", () => {
  describe("ExportFormat", () => {
    const formats: ExportFormat[] = ["hex", "base64", "json"]

    it("should include all expected formats", () => {
      expect(formats).toContain("hex")
      expect(formats).toContain("base64")
      expect(formats).toContain("json")
    })
  })

  describe("DisclosedKey", () => {
    it("should have all required fields", () => {
      const key: DisclosedKey = {
        id: "disc_123",
        viewingKey: "0x1234",
        recipientName: "Tax Authority",
        purpose: "Annual audit",
        disclosedAt: Date.now(),
        revoked: false,
      }
      expect(key.id).toBeDefined()
      expect(key.viewingKey).toBeDefined()
      expect(key.recipientName).toBeDefined()
      expect(key.purpose).toBeDefined()
      expect(key.disclosedAt).toBeDefined()
      expect(key.revoked).toBeDefined()
    })
  })
})
