# Multi-Wallet Support Design

**Date:** 2026-03-06
**Status:** Approved
**Branch:** feat/jupiter-ux-adaptation (PR #78)

## Summary

Enable unlimited wallet accounts in SIP Privacy. Users can create or import multiple wallets, switch between them from the sidebar, and manage them from the accounts screen. Required for privacy testing (send between wallet 1 and wallet 2).

## Current State

| Layer | Multi-wallet ready? |
|-------|-------------------|
| Zustand store (`wallet.ts`) | Yes — `accounts[]`, `addAccount()`, `setActiveAccount()` |
| Types (`StoredAccount`) | Yes — has `id`, `providerType`, per-account fields |
| Wallet setup UI (`wallet-setup.tsx`) | Yes — accepts `addAccount` query param |
| SecureStore (`keyStorage.ts`) | No — single hardcoded keys |
| Native wallet hook (`useNativeWallet.ts`) | No — throws `WALLET_EXISTS` |
| Accounts UI (`accounts.tsx`) | No — button disabled |

## Design Decisions

- **Unlimited wallets** — no artificial cap
- **Hybrid key storage** — registry in one SecureStore key (JSON), private keys in individual biometric-protected entries
- **Biometric on sign only** — account switching is a UI state change, no biometric needed
- **Reuse wallet-setup flow** — same Create/Import/Seed Vault options for additional wallets
- **Skip backup verification on 2nd+ wallet** — show seed phrase, "I've saved it" button instead of 3-word quiz

## Section 1: Key Storage Layer

Refactor `src/utils/keyStorage.ts` from single-wallet to indexed keys.

### Registry

Key: `sip_wallet_registry` — JSON array, stored with `STANDARD_OPTIONS` (no biometric).

```typescript
interface WalletRegistryEntry {
  id: string           // account ID from Zustand store
  address: string      // public key base58
  providerType: string // "native" | "seed-vault"
  createdAt: string    // ISO date
  hasMnemonic: boolean // true if created/imported via seed
}
```

### Per-Wallet Keys

Biometric-protected:
- `sip_privkey_{id}` — private key base58
- `sip_mnemonic_{id}` — mnemonic (only if seed-based)

Standard (no biometric):
- `sip_pubkey_{id}` — public key base58

### New Functions

- `getWalletRegistry(): Promise<WalletRegistryEntry[]>`
- `addToRegistry(entry: WalletRegistryEntry): Promise<void>`
- `removeFromRegistry(id: string): Promise<void>`
- `storeWalletKeys(id, privateKey, publicKey, mnemonic?): Promise<void>`
- `getPrivateKeyForAccount(id): Promise<string | null>`
- `getMnemonicForAccount(id): Promise<string | null>`
- `deleteWalletKeys(id): Promise<void>`

### Migration

On first load, if old `sip_wallet_private_key` exists but no registry:
1. Generate an ID
2. Create registry entry
3. Copy keys to indexed format
4. Delete old keys

If migration fails, fall back to old keys — don't brick the wallet.

## Section 2: Native Wallet Hook

Refactor `src/hooks/useNativeWallet.ts`:

1. **Remove all `WALLET_EXISTS` guards** — create/import no longer block when a wallet exists
2. **Key operations use active account ID** — reads `activeAccountId` from Zustand, fetches `sip_privkey_{id}`
3. **`createWallet` returns account ID** alongside wallet + mnemonic
4. **`deleteWallet` takes account ID** — deletes only that wallet's keys + registry entry
5. **`init()` on mount** — reads registry, loads active account's public key from persisted `activeAccountId`

Signing flow unchanged — biometric via SecureStore `requireAuthentication`.

## Section 3: Create & Import Flows

**`wallet-setup.tsx`** — No changes. Already handles `addAccount` param.

**`create-wallet.tsx`** — Skip backup verification when `accounts.length > 0`. Show seed phrase with "I've saved my recovery phrase" button instead of 3-word quiz.

**`import-wallet.tsx`** — Remove `WALLET_EXISTS` throw. Hook no longer blocks.

### Navigation Flow

```
Manage Accounts -> "+ Add Another Account"
  -> wallet-setup?addAccount=true (skips redirect)
    -> create-wallet (skips verification if not first wallet)
    -> import-wallet (no WALLET_EXISTS guard)
  -> success -> /(tabs) with new account active
```

## Section 4: Account Switcher UI

**Sidebar** (`Sidebar.tsx`) — "Switch" button opens inline account picker:
- Expands list of all accounts below current account header
- Each row: emoji + nickname + truncated address
- Active account has checkmark
- Tap account -> `setActiveAccount(id)`, collapse picker
- Bottom: "+ Add Wallet" row -> `wallet-setup?addAccount=true`

No new component file — ~30 lines of state + map inside existing Sidebar.

**Manage Accounts** (`accounts.tsx`) — Enable button, remove "coming soon" text.

**Home header** — No changes. Already reactive to `activeAccountId` via Zustand.

## Section 5: Migration & Edge Cases

- **Duplicate address import** — `wallet.connect()` activates existing account
- **Remove last account** — navigates to `wallet-setup` (fresh start)
- **SecureStore limits** — 2048 bytes per key on Android. Private keys ~88 chars, mnemonics ~200 chars. No concern.
- **Zustand persistence** — `accounts[]` and `activeAccountId` persisted to AsyncStorage

## Testing

- Unit tests for registry CRUD and indexed key storage
- Unit tests for migration (old format -> new format)
- Unit tests for `useNativeWallet` without `WALLET_EXISTS` guard
- Manual test on Seeker: create wallet 1, import wallet 2, switch, send between them
