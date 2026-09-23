/**
 * SIP Privacy Program IDL Type Definition
 * This provides TypeScript types for the Anchor program
 */

export type SipPrivacy = {
  version: "0.1.0"
  name: "sip_privacy"
  address: "S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at"
  metadata: {
    name: "sip_privacy"
    version: "0.1.0"
    spec: "0.1.0"
  }
  instructions: [
    {
      name: "initialize"
      accounts: [
        { name: "config"; writable: true },
        { name: "authority"; signer: true },
        { name: "feeCollector" },
        { name: "systemProgram" }
      ]
      args: [{ name: "feeBps"; type: "u16" }]
    },
    {
      name: "shieldedTransfer"
      accounts: [
        { name: "config"; writable: true },
        { name: "transferRecord"; writable: true },
        { name: "sender"; writable: true; signer: true },
        { name: "stealthAccount"; writable: true },
        { name: "feeCollector"; writable: true },
        { name: "systemProgram" }
      ]
      args: [
        { name: "amountCommitment"; type: { array: ["u8", 33] } },
        { name: "stealthPubkey"; type: "pubkey" },
        { name: "ephemeralPubkey"; type: { array: ["u8", 33] } },
        { name: "viewingKeyHash"; type: { array: ["u8", 32] } },
        { name: "encryptedAmount"; type: "bytes" },
        { name: "proof"; type: "bytes" },
        { name: "actualAmount"; type: "u64" }
      ]
    },
    {
      name: "claimTransfer"
      accounts: [
        { name: "config" },
        { name: "transferRecord"; writable: true },
        { name: "nullifierRecord"; writable: true },
        { name: "stealthAccount"; signer: true },
        { name: "recipient"; writable: true; signer: true },
        { name: "systemProgram" }
      ]
      args: [
        { name: "nullifier"; type: { array: ["u8", 32] } },
        { name: "proof"; type: "bytes" }
      ]
    }
  ]
  accounts: [
    {
      name: "config"
      type: {
        kind: "struct"
        fields: [
          { name: "authority"; type: "pubkey" },
          { name: "feeCollector"; type: "pubkey" },
          { name: "feeBps"; type: "u16" },
          { name: "paused"; type: "bool" },
          { name: "totalTransfers"; type: "u64" },
          { name: "bump"; type: "u8" }
        ]
      }
    },
    {
      name: "transferRecord"
      type: {
        kind: "struct"
        fields: [
          { name: "sender"; type: "pubkey" },
          { name: "stealthRecipient"; type: "pubkey" },
          { name: "amountCommitment"; type: { array: ["u8", 33] } },
          { name: "ephemeralPubkey"; type: { array: ["u8", 33] } },
          { name: "viewingKeyHash"; type: { array: ["u8", 32] } },
          { name: "encryptedAmount"; type: "bytes" },
          { name: "timestamp"; type: "i64" },
          { name: "claimed"; type: "bool" },
          { name: "tokenMint"; type: { option: "pubkey" } },
          { name: "bump"; type: "u8" }
        ]
      }
    },
    {
      name: "nullifierRecord"
      type: {
        kind: "struct"
        fields: [
          { name: "nullifier"; type: { array: ["u8", 32] } },
          { name: "transferRecord"; type: "pubkey" },
          { name: "claimedAt"; type: "i64" },
          { name: "bump"; type: "u8" }
        ]
      }
    }
  ]
  types: [
    {
      name: "ShieldedTransferArgs"
      type: {
        kind: "struct"
        fields: [
          { name: "amountCommitment"; type: { array: ["u8", 33] } },
          { name: "stealthPubkey"; type: "pubkey" },
          { name: "ephemeralPubkey"; type: { array: ["u8", 33] } },
          { name: "viewingKeyHash"; type: { array: ["u8", 32] } },
          { name: "encryptedAmount"; type: "bytes" },
          { name: "proof"; type: "bytes" },
          { name: "actualAmount"; type: "u64" }
        ]
      }
    }
  ]
  errors: [
    { code: 6000; name: "Paused"; msg: "Program is paused" },
    { code: 6001; name: "InvalidCommitment"; msg: "Invalid commitment format" },
    { code: 6002; name: "InvalidProof"; msg: "Invalid ZK proof" },
    { code: 6003; name: "AlreadyClaimed"; msg: "Transfer already claimed" },
    { code: 6004; name: "NullifierUsed"; msg: "Nullifier already used" },
    { code: 6005; name: "InsufficientFunds"; msg: "Insufficient funds" },
    { code: 6006; name: "Unauthorized"; msg: "Unauthorized" }
  ]
}

// Type assertion to ensure compatibility with Anchor's Idl type
// JSON require (not resolveJsonModule import) so the literal JSON type is not
// widened/checked against SipPrivacy at compile time
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const SipPrivacyIDL: SipPrivacy = require("./sip_privacy.json")
