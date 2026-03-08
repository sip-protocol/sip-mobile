# Wallet-Scoped Stealth Keys + Encrypted Backup

**Date:** 2026-03-08
**Issues:** #80 (P1, architecture), #79 (P2, bug)
**Branch:** `feat/wallet-scoped-stealth-keys`

## Problem

Stealth keys are generated from random bytes and stored in a single shared SecureStore entry (`sip_stealth_keys_v2`). All wallet accounts share the same stealth address — no isolation, no backup/recovery path. Additionally, the "New Address" button on the Receive screen appears unresponsive when unclaimed payments exist (#79).

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Key generation | Random per-wallet (not seed-derived) | Security compartmentalization, forward secrecy |
| Claim key lookup | `walletAddress` field on `PaymentRecord` | Clean mental model, no silent failures, no registry fragility |
| Backup format | File-based encrypted export (`.sip-backup`) | Standard wallet pattern, handles arbitrary archive sizes |
| Backup encryption | SHA-256(seed + salt) → XChaCha20-Poly1305 | `@noble/ciphers` already available |
| Backup prompt | Post-migration banner + permanent Settings entry | Covers urgency + ongoing need |

## Architecture

### 1. Per-Wallet Storage

**Storage key:** `sip_stealth_keys_v3_${walletAddress}`

One SecureStore entry per wallet. Each wallet has independent stealth keys with its own archival history.

- `loadStorage(walletAddress)` / `saveStorage(walletAddress, storage)` — scoped reads/writes
- `useStealth` hook depends on `address` from `useWalletStore()`, reloads on account switch
- `getKeyById(keyId, walletAddress)` — scoped lookup for claims

### 2. PaymentRecord Extension

Add optional `walletAddress?: string` to `PaymentRecord`. Set at scan/record creation time. Existing records without it fall back to active wallet (correct since all wallets previously shared the same keys).

### 3. Migration (v2 → v3)

On first load with new code:

1. Check for `sip_stealth_keys_v2`
2. Copy to `sip_stealth_keys_v3_${activeWalletAddress}`
3. Set `needsStealthBackup: true` in AsyncStorage
4. Delete `sip_stealth_keys_v2`
5. Legacy v1 (`sip_stealth_keys`) still migrates through v2 first, then v2→v3

### 4. Encrypted Backup

**Encryption:**
- Key: `SHA-256(utf8(seedPhrase) || "sip-stealth-backup")`
- Cipher: XChaCha20-Poly1305 (`@noble/ciphers/chacha`)
- Random 24-byte nonce per export, prepended to ciphertext

**Export:** Settings → biometric auth → derive key from seed → encrypt storage → write `.sip-backup` → share via `expo-sharing`

**Import:** Settings → document picker → read file → biometric auth → derive key → decrypt → validate → save to SecureStore → reload hook

### 5. Backup Prompt (Receive Screen)

Post-migration dismissable banner above QR code:
> "Your stealth keys are device-local. Back up now to prevent fund loss."
> [Back Up Now] → Settings backup screen
> [Dismiss] → hides, sets `stealthBackupDismissed: true`

Shows when `needsStealthBackup === true && !stealthBackupDismissed`. Completing backup clears the flag.

### 6. New Address Button UX (#79)

- Check `getUnclaimedPaymentsCount()` on render
- If > 0: button dimmed (`opacity-50`), icon grayed out
- Inline hint below stealth address box: "Claim N pending payment(s) first"
- Toast remains as secondary feedback on tap

## Files Modified

| File | Change |
|------|--------|
| `src/types/index.ts` | Add `walletAddress?` to `PaymentRecord` |
| `src/hooks/useStealth.ts` | Wallet-scoped storage, migration v2→v3, backup flag |
| `src/lib/stealth.ts` | `encryptStealthBackup()`, `decryptStealthBackup()` |
| `app/receive/index.tsx` | Backup banner (#80), disabled button UX (#79) |
| `app/settings/index.tsx` | Add "Backup Stealth Keys" nav row |
| `app/settings/stealth-backup.tsx` | New export/import screen |
| `tests/hooks/useStealth.test.ts` | Per-wallet isolation, migration, backup tests |

## Out of Scope (YAGNI)

- Cloud backup (iCloud/GDrive) — wait for user signal
- On-chain key anchoring — metadata leak, complexity
- Cross-device sync — single-platform for now
- Auto key rotation — manual via "New Address" is sufficient
- QR-based backup — file-based handles it
