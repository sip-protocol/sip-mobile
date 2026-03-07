# Private Swap (Option B) Implementation Plan — COMPLETED

> **Status:** ✅ Shipped Mar 7, 2026. Program upgraded on devnet + mainnet.

**Goal:** Route Jupiter swap output to a stealth ATA when privacy toggle is ON, with on-chain TransferRecord announcement for scan+claim.

**Architecture:** When `privacyLevel === "shielded"`, generate a self-stealth address, derive the stealth ATA for the output token, pass `destinationTokenAccount` to Jupiter's swap API, then create a TransferRecord via the SIP Privacy program so the existing scan flow can discover and claim the tokens.

**Tech Stack:** Jupiter Swap API, SIP stealth lib (DKSAP/ed25519), SIP Privacy Anchor program, React Native/Expo

---

## Context for Implementer

**Working directory:** `/Users/rector/local-dev/sip-mobile`

**Key files you'll touch:**
- `src/hooks/useSwap.ts` — swap execution hook (main changes)
- `src/lib/anchor/client.ts` — SIP Privacy program client (new method)
- `src/stores/swap.ts` — swap history store (add fields)
- `src/types/index.ts` — SwapRecord type (add fields)
- `app/(tabs)/swap.tsx` — swap UI (success state changes)

**Key files for reference (read but don't modify):**
- `src/lib/stealth.ts` — stealth address generation (`generateStealthAddress`, `hexToBytes`, `ed25519PublicKeyToSolanaAddress`)
- `src/hooks/useStealth.ts` — stealth key management (`getKeys()`)
- `src/lib/anchor/client.ts:299-418` — `buildShieldedTokenTransfer()` pattern to follow
- `src/lib/spl.ts` — `getAssociatedTokenAddress`, `createAssociatedTokenAccountInstruction`
- `src/hooks/useNativeWallet.ts:401-449` — native wallet signing (already works)

**Test commands:**
```bash
cd /Users/rector/local-dev/sip-mobile
pnpm test -- --run                    # All tests (1,205 tests)
pnpm test -- src/hooks/useSwap --run  # Swap hook tests only
pnpm typecheck                        # Type check
```

**How stealth keys work in this codebase:**
- `useStealth().getKeys()` returns `{ spendingPrivateKey, spendingPublicKey, viewingPrivateKey, viewingPublicKey }` (hex with 0x prefix)
- `generateStealthAddress(metaAddress)` generates a one-time stealth address + ephemeral key
- `ed25519PublicKeyToSolanaAddress(hexPubkey)` converts hex ed25519 to base58 Solana address
- `hexToBytes(hexString)` strips 0x prefix and converts to Uint8Array
- `getAssociatedTokenAddress(owner: PublicKey, mint: PublicKey)` derives ATA deterministically

**Jupiter swap API:** `POST https://lite-api.jup.ag/swap/v1/swap` accepts `destinationTokenAccount` (base58 string) in the request body. When set, swap output goes to that account instead of the user's default ATA.

---

### Task 1: Add `isPrivate` and `stealthAddress` to SwapRecord type

**Files:**
- Modify: `src/types/index.ts` (SwapRecord interface, around line 47-63)

**Step 1: Read the current SwapRecord type**

Read `src/types/index.ts` and find the `SwapRecord` interface.

**Step 2: Add new fields**

Add these optional fields to SwapRecord:

```typescript
export interface SwapRecord {
  id: string
  fromToken: string
  toToken: string
  fromChain?: string
  toChain?: string
  fromAmount: string
  toAmount: string
  status: "pending" | "completed" | "failed"
  txHash?: string
  txSignature?: string
  explorerUrl?: string
  timestamp: number
  privacyLevel: PrivacyLevel
  depositAddress?: string
  error?: string
  // Private swap fields
  isPrivate?: boolean
  stealthAddress?: string
  claimStatus?: "unclaimed" | "claimed"
}
```

**Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS (new optional fields don't break existing code)

**Step 4: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add private swap fields to SwapRecord type"
```

---

### Task 2: Add `buildSwapAnnouncement` method to SIP Privacy client

This method creates a TransferRecord on-chain for a swap output so the scan flow can discover it.

**Files:**
- Modify: `src/lib/anchor/client.ts` (add method after `buildShieldedTokenTransfer`, around line 418)

**Step 1: Read `buildShieldedTokenTransfer` for reference**

Read `src/lib/anchor/client.ts:299-418`. This is the pattern we follow — same instruction layout, same PDA derivation.

**Step 2: Add `buildSwapAnnouncement` method**

Add this method to the `SipPrivacyClient` class, after `buildShieldedTokenTransfer`:

```typescript
  /**
   * Build a TransferRecord announcement for a private swap.
   *
   * This creates the on-chain announcement so the recipient (self) can
   * scan and claim the swap output from the stealth ATA.
   * Unlike buildShieldedTokenTransfer, this does NOT transfer tokens —
   * Jupiter handles the actual swap. We only create the TransferRecord.
   */
  async buildSwapAnnouncement(
    sender: PublicKey,
    params: {
      /** Output token amount (human-readable, e.g., 34.23) */
      amount: number
      /** Output token decimals */
      decimals: number
      /** Output token mint */
      tokenMint: PublicKey
      /** Stealth recipient pubkey (ed25519, as PublicKey) */
      stealthPubkey: PublicKey
      /** Recipient's spending public key (raw bytes) */
      recipientSpendingKey: Uint8Array
      /** Recipient's viewing public key (raw bytes) */
      recipientViewingKey: Uint8Array
      /** Ephemeral private key from generateStealthAddress */
      ephemeralPrivateKey: Uint8Array
    }
  ): Promise<{
    transaction: Transaction
    transferRecord: PublicKey
    ephemeralPubkey: Uint8Array
  }> {
    const config = await this.fetchConfig()
    if (!config) {
      throw new Error("Program not initialized")
    }

    // Convert to raw amount
    const rawAmount = BigInt(Math.floor(params.amount * Math.pow(10, params.decimals)))

    // Build ephemeral pubkey (33-byte compressed: 0x02 prefix + 32 bytes)
    const { ed25519 } = await import("@noble/curves/ed25519")
    const publicKeyRaw = ed25519.getPublicKey(params.ephemeralPrivateKey)
    const ephemeralPubkey = new Uint8Array(33)
    ephemeralPubkey[0] = 0x02
    ephemeralPubkey.set(publicKeyRaw, 1)

    // Derive shared secret for amount encryption
    const sharedSecret = deriveSharedSecret(
      params.ephemeralPrivateKey,
      params.recipientSpendingKey
    )

    // Pedersen commitment
    const { commitment, blindingFactor } = await createCommitment(rawAmount)

    // Encrypt amount
    const encryptedAmount = await encryptAmount(rawAmount, sharedSecret)

    // Viewing key hash
    const viewingKeyHash = computeViewingKeyHash(params.recipientViewingKey)

    // Mock proof
    const proof = await generateMockProof(commitment, blindingFactor, rawAmount)

    // PDAs
    const [configPda] = getConfigPda(this.programId)
    const [transferRecordPda] = getTransferRecordPda(
      sender,
      config.totalTransfers,
      this.programId
    )

    // Encode instruction data (shielded_token_transfer discriminator)
    const instructionData = this.encodeShieldedTransferData({
      amountCommitment: Array.from(commitment),
      stealthPubkey: params.stealthPubkey,
      ephemeralPubkey: Array.from(ephemeralPubkey),
      viewingKeyHash: Array.from(viewingKeyHash),
      encryptedAmount: Buffer.concat([
        encryptedAmount.nonce,
        encryptedAmount.ciphertext,
      ]),
      proof: Buffer.from(proof),
      actualAmount: rawAmount,
    })

    // Use shielded_token_transfer discriminator
    Buffer.from([0x6e, 0x31, 0xe7, 0xe8, 0x5d, 0x8d, 0x58, 0xab])
      .copy(instructionData, 0)

    // Derive ATAs — sender's ATA is the source, stealth ATA is destination
    const senderAta = getAssociatedTokenAddress(sender, params.tokenMint)
    const stealthAta = getAssociatedTokenAddress(params.stealthPubkey, params.tokenMint)
    const feeCollectorAta = getAssociatedTokenAddress(config.authority, params.tokenMint)

    const transaction = new Transaction()

    // Create stealth ATA if needed (Jupiter's destinationTokenAccount requires it to exist)
    if (!(await tokenAccountExists(this.connection, stealthAta))) {
      transaction.add(
        createAssociatedTokenAccountInstruction(sender, stealthAta, params.stealthPubkey, params.tokenMint)
      )
    }

    // Create fee collector ATA if needed
    if (!(await tokenAccountExists(this.connection, feeCollectorAta))) {
      transaction.add(
        createAssociatedTokenAccountInstruction(sender, feeCollectorAta, config.authority, params.tokenMint)
      )
    }

    // Add the shielded_token_transfer instruction
    const instruction = new web3.TransactionInstruction({
      keys: [
        { pubkey: configPda, isSigner: false, isWritable: true },
        { pubkey: transferRecordPda, isSigner: false, isWritable: true },
        { pubkey: sender, isSigner: true, isWritable: true },
        { pubkey: params.tokenMint, isSigner: false, isWritable: false },
        { pubkey: senderAta, isSigner: false, isWritable: true },
        { pubkey: stealthAta, isSigner: false, isWritable: true },
        { pubkey: feeCollectorAta, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: web3.SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: instructionData,
    })

    transaction.add(instruction)

    const { blockhash } = await this.connection.getLatestBlockhash()
    transaction.recentBlockhash = blockhash
    transaction.feePayer = sender

    return {
      transaction,
      transferRecord: transferRecordPda,
      ephemeralPubkey,
    }
  }
```

**Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add src/lib/anchor/client.ts
git commit -m "feat: add buildSwapAnnouncement for private swap TransferRecord"
```

---

### Task 3: Add `destinationTokenAccount` support to `executeJupiterSwap`

**Files:**
- Modify: `src/hooks/useSwap.ts` (lines 165-229)

**Step 1: Read `executeJupiterSwap`**

Read `src/hooks/useSwap.ts:165-229`.

**Step 2: Add optional `destinationTokenAccount` parameter**

Update `executeJupiterSwap` to accept and pass `destinationTokenAccount`:

```typescript
async function executeJupiterSwap(
  jupiterQuote: JupiterQuoteResponse,
  userPublicKey: string,
  signTransaction: (tx: Uint8Array) => Promise<Uint8Array>,
  network: string,
  destinationTokenAccount?: string
): Promise<string> {
  // 1. Get swap transaction from Jupiter
  const swapBody: Record<string, unknown> = {
    quoteResponse: jupiterQuote,
    userPublicKey,
    wrapAndUnwrapSol: true,
    dynamicComputeUnitLimit: true,
    prioritizationFeeLamports: "auto",
  }

  // Route output to stealth ATA for private swaps
  if (destinationTokenAccount) {
    swapBody.destinationTokenAccount = destinationTokenAccount
  }

  const swapResponse = await fetch(JUPITER_SWAP_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(swapBody),
  })

  // ... rest of function unchanged ...
```

**Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS (new param is optional, existing callers unaffected)

**Step 4: Commit**

```bash
git add src/hooks/useSwap.ts
git commit -m "feat: add destinationTokenAccount support to Jupiter swap"
```

---

### Task 4: Implement private swap flow in `useSwap` hook

This is the core task. When `privacyLevel === "shielded"`, the execute function:
1. Gets stealth keys via `useStealth().getKeys()`
2. Generates a self-stealth address
3. Derives the stealth ATA for the output token
4. Sends TX1: create stealth ATA + TransferRecord announcement
5. Sends TX2: Jupiter swap with `destinationTokenAccount = stealthATA`

**Files:**
- Modify: `src/hooks/useSwap.ts` (the `useSwap` hook and its execute callback)

**Step 1: Add imports**

At the top of `src/hooks/useSwap.ts`, add:

```typescript
import { generateStealthAddress, hexToBytes, ed25519PublicKeyToSolanaAddress } from "@/lib/stealth"
import { useStealth } from "./useStealth"
import { getAssociatedTokenAddress } from "@/lib/spl"
import { SipPrivacyClient } from "@/lib/anchor/client"
import { Connection, PublicKey } from "@solana/web3.js"
```

**Step 2: Add `useStealth` to the hook**

Inside `useSwap()`, add after the existing hook calls:

```typescript
const { getKeys } = useStealth()
```

Add `getKeys` to the `execute` useCallback dependency array.

**Step 3: Add private swap branch in `execute`**

Inside the `execute` callback, after the quote expiry check and before the try block's existing swap logic, add a branch for private swaps. Replace the entire try block content with:

```typescript
      try {
        setError(null)
        setTxSignature(null)

        const newSwapId = generateSwapId()
        currentSwapId.current = newSwapId
        setSwapId(newSwapId)

        setStatus("confirming")

        let signature: string
        let stealthAddr: string | undefined

        if (privacyLevel === "shielded") {
          // ── Private Swap Flow ──────────────────────────────
          // 1. Get stealth keys for self-stealth generation
          const keys = await getKeys()
          if (!keys) {
            throw new Error("Stealth keys not available. Please set up privacy keys first.")
          }

          // 2. Generate one-time stealth address (sending to self)
          const selfMetaAddress = {
            spendingKey: keys.spendingPublicKey,
            viewingKey: keys.viewingPublicKey,
            chain: "solana" as const,
          }
          const { stealthAddress: stealthResult, ephemeralPrivateKey } =
            await generateStealthAddress(selfMetaAddress)

          // 3. Convert stealth address to Solana pubkey
          const stealthSolanaAddress = ed25519PublicKeyToSolanaAddress(stealthResult.address)
          const stealthPubkey = new PublicKey(stealthSolanaAddress)
          stealthAddr = stealthSolanaAddress

          // 4. Derive stealth ATA for the output token
          const outputMint = new PublicKey(jupiterQuote.outputMint)
          const stealthAta = getAssociatedTokenAddress(stealthPubkey, outputMint)

          // 5. TX1: Create stealth ATA + TransferRecord announcement
          const rpcEndpoint = getRpcEndpoint(network)
          const connection = new Connection(rpcEndpoint)
          const client = new SipPrivacyClient(connection)
          const senderPubkey = new PublicKey(address)

          const { transaction: announceTx } = await client.buildSwapAnnouncement(
            senderPubkey,
            {
              amount: parseFloat(quote.outputAmount),
              decimals: parseInt(jupiterQuote.outputMint === "So11111111111111111111111111111111111111112" ? "9" : "6"),
              tokenMint: outputMint,
              stealthPubkey,
              recipientSpendingKey: hexToBytes(keys.spendingPublicKey),
              recipientViewingKey: hexToBytes(keys.viewingPublicKey),
              ephemeralPrivateKey: hexToBytes(ephemeralPrivateKey),
            }
          )

          setStatus("signing")

          // Sign and send TX1 (announcement + ATA creation)
          if (walletType === "native") {
            const signedAnnounceTx = await nativeSignTransaction(announceTx)
            const announceBase64 = Buffer.from(signedAnnounceTx.serialize()).toString("base64")
            const announceResult = await fetch(rpcEndpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "sendTransaction",
                params: [announceBase64, { encoding: "base64", skipPreflight: false }],
              }),
            })
            const announceRes = await announceResult.json()
            if (announceRes.error) {
              throw new Error(announceRes.error.message || "Announcement transaction failed")
            }
            // Wait for TX1 confirmation before proceeding
            await waitForConfirmation(rpcEndpoint, announceRes.result)
          } else {
            // External wallet — serialize, sign, send
            const announceTxBytes = announceTx.serialize({ requireAllSignatures: false })
            const signedBytes = await externalSignTransaction(new Uint8Array(announceTxBytes))
            if (!signedBytes) throw new Error("Transaction signing rejected")
            const announceBase64 = Buffer.from(signedBytes).toString("base64")
            const announceResult = await fetch(rpcEndpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "sendTransaction",
                params: [announceBase64, { encoding: "base64", skipPreflight: false }],
              }),
            })
            const announceRes = await announceResult.json()
            if (announceRes.error) {
              throw new Error(announceRes.error.message || "Announcement transaction failed")
            }
            await waitForConfirmation(rpcEndpoint, announceRes.result)
          }

          // 6. TX2: Jupiter swap with output to stealth ATA
          setStatus("submitting")
          signature = await executeJupiterSwap(
            jupiterQuote,
            address,
            async (tx: Uint8Array) => {
              let signed: Uint8Array | null = null
              if (walletType === "native") {
                const { Transaction, VersionedTransaction } = await import("@solana/web3.js")
                let txObj: InstanceType<typeof Transaction> | InstanceType<typeof VersionedTransaction>
                try {
                  txObj = VersionedTransaction.deserialize(tx)
                } catch {
                  txObj = Transaction.from(tx)
                }
                const signedTx = await nativeSignTransaction(txObj)
                signed = signedTx.serialize()
              } else {
                signed = await externalSignTransaction(tx)
              }
              if (!signed) throw new Error("Transaction signing rejected")
              return signed
            },
            network,
            stealthAta.toBase58()
          )
        } else {
          // ── Public Swap Flow (unchanged) ───────────────────
          setStatus("signing")
          signature = await executeJupiterSwap(
            jupiterQuote,
            address,
            async (tx: Uint8Array) => {
              let signed: Uint8Array | null = null
              if (walletType === "native") {
                const { Transaction, VersionedTransaction } = await import("@solana/web3.js")
                let txObj: InstanceType<typeof Transaction> | InstanceType<typeof VersionedTransaction>
                try {
                  txObj = VersionedTransaction.deserialize(tx)
                } catch {
                  txObj = Transaction.from(tx)
                }
                const signedTx = await nativeSignTransaction(txObj)
                signed = signedTx.serialize()
              } else {
                signed = await externalSignTransaction(tx)
              }
              if (!signed) throw new Error("Transaction signing rejected")
              setStatus("submitting")
              return signed
            },
            network
          )
        }

        // Success (both paths)
        setTxSignature(signature)
        setStatus("success")

        addSwap({
          id: newSwapId,
          fromToken: quote.inputToken.symbol,
          toToken: quote.outputToken.symbol,
          fromAmount: quote.inputAmount,
          toAmount: quote.outputAmount,
          privacyLevel,
          status: "completed",
          timestamp: Date.now(),
          txSignature: signature,
          explorerUrl: getExplorerTxUrl(signature, network, defaultExplorer),
          isPrivate: privacyLevel === "shielded",
          stealthAddress: stealthAddr,
          claimStatus: privacyLevel === "shielded" ? "unclaimed" : undefined,
        })

        addToast({
          type: "success",
          title: privacyLevel === "shielded" ? "Private Swap Complete" : "Swap Complete",
          message: privacyLevel === "shielded"
            ? `Swapped ${quote.inputAmount} ${quote.inputToken.symbol} to private balance. Claim from Receive tab.`
            : `Swapped ${quote.inputAmount} ${quote.inputToken.symbol} → ${quote.outputAmount} ${quote.outputToken.symbol}`,
        })

        return true
      } catch (err) {
        // ... existing error handling unchanged ...
```

**Step 4: Update useCallback deps**

Add `getKeys` to the dependency array of the execute useCallback:

```typescript
    [isConnected, address, network, defaultExplorer, walletType, nativeSignTransaction, externalSignTransaction, addSwap, addToast, getKeys]
```

**Step 5: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 6: Run tests**

Run: `pnpm test -- --run`
Expected: All existing tests pass

**Step 7: Commit**

```bash
git add src/hooks/useSwap.ts
git commit -m "feat: implement private swap flow with stealth output"
```

---

### Task 5: Update swap UI success state for private swaps

**Files:**
- Modify: `app/(tabs)/swap.tsx` (success bottom sheet section)

**Step 1: Read the swap success UI**

Read `app/(tabs)/swap.tsx` and find the success bottom sheet / success state rendering. Look for where `status === "success"` is handled and the "Successfully swapped!" text.

**Step 2: Update success message for private swaps**

In the success state, differentiate between public and private swaps:

```tsx
{/* Success state — differentiate private vs public */}
{privacyLevel === "shielded" ? (
  <>
    <Text className="text-lg font-bold text-white text-center">
      Private Swap Complete
    </Text>
    <Text className="text-sm text-dark-300 text-center mt-2">
      {quote?.inputAmount} {quote?.inputToken.symbol} swapped to private balance
    </Text>
    <Text className="text-xs text-dark-400 text-center mt-1">
      Claim your {quote?.outputToken.symbol} from the Receive tab when ready
    </Text>
  </>
) : (
  <>
    {/* Existing public swap success UI */}
  </>
)}
```

**Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add app/(tabs)/swap.tsx
git commit -m "feat: differentiate private swap success UI"
```

---

### Task 6: Add SOL budget validation for private swaps

Private swaps need extra SOL for stealth ATA rent (~0.00204 SOL) + extra TX fee.

**Files:**
- Modify: `app/(tabs)/swap.tsx` (validation before swap execution)

**Step 1: Find the swap execution trigger**

Read `app/(tabs)/swap.tsx` and find where the swap is confirmed/executed. Look for the function that calls `execute()`.

**Step 2: Add SOL budget check before private swap**

Before calling `execute()`, add validation:

```typescript
// Extra SOL needed for private swap: ATA rent + extra TX fee
const PRIVATE_SWAP_OVERHEAD = 0.003 // ~0.00204 ATA rent + ~0.001 TX fees

if (privacyLevel === "shielded") {
  const solBalance = /* get SOL balance from store/hook */
  const swapInputSOL = inputToken.symbol === "SOL" ? parseFloat(amount) : 0
  const requiredSOL = swapInputSOL + PRIVATE_SWAP_OVERHEAD

  if (solBalance < requiredSOL) {
    addToast({
      type: "error",
      title: "Insufficient SOL",
      message: `Private swap needs ~${PRIVATE_SWAP_OVERHEAD} SOL extra for stealth account rent. You have ${solBalance.toFixed(4)} SOL.`,
    })
    return
  }
}
```

**Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add app/(tabs)/swap.tsx
git commit -m "feat: validate SOL budget for private swaps"
```

---

### Task 7: Write tests for private swap flow

**Files:**
- Modify or create: `src/hooks/__tests__/useSwap.test.ts`

**Step 1: Check existing swap tests**

Run: `find src -name "*swap*test*" -o -name "*swap*.test.*"` to find existing test files.

**Step 2: Add private swap tests**

Add tests for:

```typescript
describe("private swap flow", () => {
  it("should pass destinationTokenAccount to Jupiter when shielded", () => {
    // Mock Jupiter API, verify request body includes destinationTokenAccount
  })

  it("should generate stealth address for self when shielded", () => {
    // Mock useStealth().getKeys(), verify generateStealthAddress called with self meta-address
  })

  it("should add isPrivate and stealthAddress to swap history", () => {
    // Execute private swap, verify addSwap called with isPrivate: true, stealthAddress set
  })

  it("should show friendly error when stealth keys unavailable", () => {
    // Mock getKeys() returning null, verify error message
  })

  it("should not use destinationTokenAccount when transparent", () => {
    // Execute public swap, verify Jupiter request does NOT include destinationTokenAccount
  })
})
```

**Step 3: Run tests**

Run: `pnpm test -- src/hooks/__tests__/useSwap --run`
Expected: All new tests PASS

**Step 4: Commit**

```bash
git add src/hooks/__tests__/useSwap.test.ts
git commit -m "test: add private swap flow tests"
```

---

### Task 8: Final integration test and cleanup

**Step 1: Run full test suite**

Run: `pnpm test -- --run`
Expected: All 1,205+ tests pass

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Manual test checklist**

On Seeker device (after building APK):
- [ ] Public swap (privacy OFF): SOL -> SKR works, tokens go to public ATA
- [ ] Private swap (privacy ON): SOL -> SKR works, tokens go to stealth ATA
- [ ] Receive tab: scan finds the private swap TransferRecord
- [ ] Claim: tokens move from stealth ATA to public wallet
- [ ] Success UI shows correct message for private vs public
- [ ] SOL budget validation works when balance is low

**Step 4: Commit final changes**

```bash
git add -A
git commit -m "feat: private swap with stealth output (Option B)

Route Jupiter swap output to one-time stealth ATA when privacy toggle is ON.
Creates TransferRecord announcement for scan+claim flow.

- destinationTokenAccount passed to Jupiter swap API
- Stealth ATA created before swap execution
- TransferRecord created via SIP Privacy program
- Differentiated success UI for private vs public swaps
- SOL budget validation for ATA rent overhead"
```

---

## Task Summary

| Task | Description | Files | Est. |
|------|-------------|-------|------|
| 1 | Add `isPrivate`/`stealthAddress` to SwapRecord | `src/types/index.ts` | 5 min |
| 2 | Add `buildSwapAnnouncement` to SIP client | `src/lib/anchor/client.ts` | 15 min |
| 3 | Add `destinationTokenAccount` to Jupiter call | `src/hooks/useSwap.ts` | 5 min |
| 4 | Implement private swap flow in useSwap | `src/hooks/useSwap.ts` | 30 min |
| 5 | Update swap success UI | `app/(tabs)/swap.tsx` | 10 min |
| 6 | Add SOL budget validation | `app/(tabs)/swap.tsx` | 10 min |
| 7 | Write tests | `src/hooks/__tests__/useSwap.test.ts` | 20 min |
| 8 | Integration test + cleanup | All files | 15 min |
