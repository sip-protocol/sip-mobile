# Private Swap Design (Option B: Stealth Output)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Route Jupiter swap output to a stealth address when privacy toggle is ON, so tokens don't appear in the user's public wallet.

**Architecture:** When "Private Swap" is enabled, generate a one-time stealth address, derive the stealth ATA for the output token, and pass it as `destinationTokenAccount` to Jupiter's swap API. Create an on-chain TransferRecord announcement so the user can scan and claim via the existing Receive flow.

**Tech Stack:** Jupiter Swap API (lite-api.jup.ag), SIP stealth addresses (DKSAP/ed25519), SIP Privacy Anchor program (TransferRecord), Expo/React Native

---

## Privacy Model

**What this achieves:**

| Property | Status |
|----------|--------|
| Balance hiding | Yes -- tokens not in public wallet |
| Recipient unlinkability | Yes -- stealth address is one-time |
| Timing decorrelation | Yes -- claim happens separately |
| Sender privacy | No -- user signs swap TX (see Future: Option C) |

**What an observer sees:**
- Swap TX: "User X swapped 0.01 SOL for SKR, output went to address Y"
- They cannot determine who controls Y without the viewing key
- When user later claims from Y, no on-chain link back to the swap

## Data Flow

```
1. User taps "Swap" with privacy toggle ON
2. generateStealthAddress(selfMetaAddress) -> stealthAddress, ephemeralPrivateKey
3. Derive stealth ATA for output token mint (getAssociatedTokenAddress)
4. Call Jupiter /swap with:
   - quoteResponse: existing quote
   - userPublicKey: user's wallet
   - destinationTokenAccount: stealth ATA address (base58)
5. Jupiter returns swap TX (does NOT include ATA creation)
6. Prepend ATA creation instruction for stealth ATA (user pays rent ~0.002 SOL)
7. Append TransferRecord creation instruction (announcement for scanning)
   - stealthRecipient: stealth public key
   - ephemeralPubkey: from step 2
   - viewingKeyHash: SHA256(user's viewing public key)
   - encryptedAmount: XChaCha20-Poly1305(output amount, shared secret)
   - tokenMint: output token mint
8. User signs composite TX
9. Submit to network, wait for confirmation
10. Show success: "Swap complete -- tokens in private balance"
11. User claims via Receive > Scan when ready
```

## Key Implementation Details

### Jupiter `destinationTokenAccount`

Jupiter's `/swap` endpoint accepts `destinationTokenAccount` (base58 string). When provided, swap output goes to this account instead of the user's default ATA. The account must exist and be an ATA for the correct mint.

### Transaction Composition

The final TX contains 3 groups of instructions:

1. **ATA Creation** -- CreateAssociatedTokenAccount for stealth address + output mint
2. **Jupiter Swap** -- Deserialized from Jupiter's response (VersionedTransaction instructions)
3. **TransferRecord** -- SIP Privacy program `create_transfer_record` instruction

Challenge: Jupiter returns a VersionedTransaction (V0). We need to either:
- (a) Deserialize, extract instructions, rebuild with our additional instructions -- complex
- (b) Send two TXs: first create ATA + TransferRecord, second the Jupiter swap -- simpler but two TXs
- (c) Use Jupiter's `setupInstructions` + `swapInstructions` mode if available

Recommended: Approach (b) for v1 -- two sequential TXs. Atomic failure is acceptable because if TX1 succeeds but TX2 fails, the ATA exists but is empty (no fund loss). User retries the swap.

### TransferRecord Fields

```typescript
{
  sender: userPublicKey,           // who initiated (visible)
  stealthRecipient: stealthPubkey, // one-time stealth address
  amountCommitment: pedersen(outputAmount, blindingFactor),
  ephemeralPubkey: ephemeralPub,   // for recipient to derive shared secret
  viewingKeyHash: sha256(viewingPublicKey),
  encryptedAmount: encrypt(outputAmount, sharedSecret),
  tokenMint: outputTokenMint,      // SKR, USDC, etc.
}
```

### Stealth Key Management

- Stealth keypair is ephemeral -- generated per swap, not persisted
- User can always re-derive the stealth private key from their spending + viewing keys + the ephemeralPubkey stored in TransferRecord
- No new key storage needed

### SOL Budget

User needs enough SOL for:
- Swap input amount (e.g., 0.01 SOL)
- ATA rent for stealth address (~0.00204 SOL)
- TX fees (~0.000015 SOL for 2 TXs)
- Total overhead: ~0.0021 SOL

Pre-validate before starting the swap flow.

## UX Changes

### Swap Screen (`app/(tabs)/swap.tsx`)

- **Privacy ON**: After successful swap, bottom sheet shows:
  - "Tokens sent to private balance"
  - "Claim anytime from Receive tab"
  - Button: "Claim Now" (navigates to receive/scan) or "Done"
- **Privacy OFF**: Same as current (direct to public ATA)

### Swap History (`src/stores/swap.ts`)

Add fields to swap record:
- `isPrivate: boolean`
- `claimStatus: 'unclaimed' | 'claimed'`
- `stealthAddress: string` (for reference)

### Receive/Scan Screen

No changes needed -- existing scan flow already finds TransferRecords and supports SPL token claims.

## Edge Cases

| Case | Handling |
|------|----------|
| Insufficient SOL for rent + swap | Pre-validate, show "Need ~0.002 SOL extra for private swap" |
| ATA creation TX succeeds, swap TX fails | ATA exists but empty, user retries swap with same stealth ATA |
| TransferRecord creation fails | Tokens in stealth ATA but not scannable -- fallback: store stealth info locally |
| Quote expires during setup | Abort before signing, re-fetch quote |
| User has no viewing key | Should not happen -- viewing key is generated with wallet |

## Files Modified

| File | Changes |
|------|---------|
| `src/hooks/useSwap.ts` | Stealth generation, `destinationTokenAccount`, two-TX flow |
| `src/lib/anchor/client.ts` | Export `buildCreateTransferRecord()` for swap context |
| `app/(tabs)/swap.tsx` | Success UI for private swap, SOL budget validation |
| `src/stores/swap.ts` | Add `isPrivate`, `claimStatus`, `stealthAddress` fields |

## Testing

- Unit test: stealth ATA derivation for arbitrary token mints
- Unit test: TransferRecord instruction building with swap context
- Integration test: full private swap flow (mock Jupiter + mock program)
- E2E: execute private swap on devnet, verify TransferRecord, claim tokens

---

## Future: Option C (Full Sender Privacy)

> Documented here as the planned upgrade path after Option B ships.

**Concept:** Use the stealth address as the Jupiter swap signer, eliminating the user's wallet from the swap TX entirely.

**Flow:**
1. TX1: User deposits SOL to stealth address A (existing stealth transfer)
2. Wait (timing decorrelation)
3. TX2: Stealth A calls Jupiter with `userPublicKey = stealthA`, output to stealth B
   - Sign TX with `signWithScalar()` using stealth A's derived private key
   - User's wallet never appears in TX2
4. TX3: User claims output from stealth B

**Privacy gain:** TX2 has zero connection to the user's wallet. Full sender privacy.

**Prerequisites:**
- Verify `signWithScalar()` works with VersionedTransaction (V0)
- Gas management: stealth A needs SOL for swap + gas + ATA rent
- Stealth ATA creation: who creates stealth B's ATA? (stealth A can pay)

**Effort:** ~4-5 days after Option B ships (B's infrastructure is a subset of C).
