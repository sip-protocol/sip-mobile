# CLAUDE.md - SIP Mobile

> **Ecosystem:** [sip-protocol/CLAUDE.md](https://github.com/sip-protocol/sip-protocol/blob/main/CLAUDE.md)

**Tagline:** "Privacy in Your Pocket"
**Purpose:** Daily privacy wallet for Solana — native key management, quick payments, on-the-go swaps
**Target:** iOS App Store, Google Play, Solana dApp Store (Seeker)

---

## 🎯 PRODUCT POSITIONING

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SIP PRODUCT FAMILY (Jupiter Model)                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  @sip-protocol/sdk — THE PRIVACY STANDARD                                   │
│  "Any app can add privacy with one line of code"                           │
│                                                                             │
│  ┌─────────────────────────────┐   ┌─────────────────────────────┐         │
│  │  app.sip-protocol.org      │   │  SIP Privacy (Mobile)       │         │
│  │  ───────────────────────   │   │  ────────────────────────   │         │
│  │  "Privacy Command Center"  │   │  "Privacy in Your Pocket"   │         │
│  │                            │   │                             │         │
│  │  • Power users/Enterprise  │   │  • Consumers                │         │
│  │  • Complex visualizations  │   │  • Quick payments/swaps     │         │
│  │  • Compliance dashboards   │   │  • Native key management    │         │
│  │  • Audit trails/Reports    │   │  • Biometric security       │         │
│  │  • SDK showcase            │   │  • On-the-go privacy        │         │
│  │                            │   │                             │         │
│  │  → sip-app repo            │   │  ← YOU ARE HERE             │         │
│  └─────────────────────────────┘   └─────────────────────────────┘         │
│                                                                             │
│  COMPANION PRODUCTS — Same brand, platform-optimized experiences            │
│  Like jup.ag (web) + Jupiter Mobile (app) — NOT 1:1 clones                 │
│                                                                             │
│  BOTH are real products with real users — NOT demos                        │
│  BOTH showcase SDK capabilities → drive developer adoption                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

### sip-mobile Differentiators (Mobile Strengths)

| Capability | Why Mobile Excels |
|------------|-------------------|
| **Native Key Management** | SecureStore + Biometrics — keys never leave device |
| **Quick Payments** | Scan QR, send in seconds, biometric confirm |
| **On-the-go Swaps** | Jupiter DEX with privacy toggle — trade anywhere |
| **Camera Integration** | Native QR scanning for stealth addresses |
| **Push Notifications** | Payment received alerts (planned) |
| **Consumer UX** | Simple privacy toggle, no jargon |

### Shared with sip-app (Must Be Identical)

- Core privacy primitives (stealth addresses, commitments, viewing keys)
- Privacy levels (transparent / shielded / compliant)
- Payment protocol (send / receive / scan / claim / disclose)
- Viewing key disclosure for compliance

### Feature Parity Matrix

| Feature | sip-mobile | sip-app (Web) | Notes |
|---------|------------|---------------|-------|
| Send Payments | ✅ Full | ✅ Full | Same core |
| Receive (Stealth) | ✅ Full | ✅ Full | Same core |
| Scan Payments | ✅ Full | ✅ Full | Mobile has native camera |
| Claim Payments | ✅ Full | ✅ Full | Same core |
| View History | ✅ Full | ✅ Full | Different viz |
| Viewing Key Disclosure | ✅ Full | ✅ Full | Compliance-critical |
| Jupiter DEX | ✅ Full | 🔲 Scaffolded | Mobile-first for swaps |
| Privacy Score | ✅ Basic | ✅ Full (D3) | Web excels at viz |
| Compliance Dashboard | ✅ Basic | 🔲 Scaffolded | Web for enterprise |
| Native Key Mgmt | ✅ Full | ❌ N/A | Mobile-only |
| Biometric Auth | ✅ Full | ❌ N/A | Mobile-only |
| Multi-Account | ✅ Full | 🔲 Planned | Mobile-first |
| Privacy Providers | 🔲 In Progress | 🔲 Planned | Multi-backend support (#73) |

---

## Quick Reference

**Stack:** Expo 52, React Native, NativeWind 4, Zustand 5, Expo Router

```bash
pnpm install              # Install
npx expo start            # Dev server
pnpm typecheck            # Type check
eas build --platform android --profile production --local  # Local APK
```

**Tabs:** Home | Send | Receive | Swap | Settings

---

## Wallet Architecture

**Philosophy:** SIP Privacy IS the wallet — users manage keys directly, no external wallet required.

### Wallet Strategy

| Method | Platform | Priority | Status |
|--------|----------|----------|--------|
| **Native Wallet** | All | PRIMARY | ✅ Complete |
| **Seed Vault** | Seeker | PRIMARY | ✅ Complete |
| MWA | Android | Optional | ✅ Available |
| Phantom Deeplinks | iOS | Optional | ✅ Available |
| ~~Privy~~ | ~~All~~ | REMOVED | ❌ Removed (#71) |

### Key Management

```
┌─────────────────────────────────────────────────────────────┐
│  PRIMARY: Native Wallet (useNativeWallet)                   │
│  ├── Generate new wallet (BIP39 mnemonic)                   │
│  ├── Import seed phrase (12/24 words)                       │
│  ├── Import private key (base58)                            │
│  ├── SecureStore + Biometrics for security                  │
│  └── Solana derivation: m/44'/501'/0'/0'                    │
├─────────────────────────────────────────────────────────────┤
│  SEEKER: Direct Seed Vault Integration                      │
│  └── No Phantom middleman — direct Seed Vault API           │
├─────────────────────────────────────────────────────────────┤
│  OPTIONAL: External Wallet Connection                       │
│  ├── MWA (Android) — connect to Phantom/Solflare            │
│  └── Phantom Deeplinks (iOS) — connect to Phantom           │
└─────────────────────────────────────────────────────────────┘
```

### Security Model

| Layer | Implementation |
|-------|----------------|
| Key Storage | `expo-secure-store` (Keychain/Keystore) |
| Access Control | Biometric auth via `expo-local-authentication` |
| Derivation | BIP39 → BIP44 (Solana path) |
| Memory | Keys cleared after signing operations |
| Backup | Mnemonic export (biometric required) |

### Key Files

```
src/hooks/useNativeWallet.ts   # Primary wallet hook
src/hooks/useSeedVault.ts      # Seeker Seed Vault integration
src/hooks/useMWA.ts            # Optional: Android external wallet
src/hooks/usePhantomDeeplink.ts # Optional: iOS external wallet
src/utils/keyStorage.ts        # SecureStore utilities
app/(auth)/wallet-setup.tsx    # Wallet setup entry point
app/(auth)/create-wallet.tsx   # Create new wallet flow
app/(auth)/import-wallet.tsx   # Import existing wallet flow
app/settings/backup.tsx        # View/backup recovery phrase
```

---

## Privacy Provider Architecture (#73)

**Philosophy:** "OpenRouter for Privacy" — one app, multiple privacy engines. Users choose their preferred provider.

```
┌─────────────────────────────────────────────────────────────┐
│  USER INTERFACE (Send / Swap / Settings)                    │
├─────────────────────────────────────────────────────────────┤
│  usePrivacyProvider Hook                                    │
│  └── Wraps active adapter, provides send() / swap()         │
├─────────────────────────────────────────────────────────────┤
│  Privacy Provider Adapters (PrivacyProviderAdapter)         │
│  ├── SIP Native     — Stealth + Pedersen + viewing keys     │
│  ├── Privacy Cash   — Pool-based mixing + ZK proofs         │
│  ├── ShadowWire     — Bulletproofs + internal transfers     │
│  ├── MagicBlock     — TEE (Intel TDX) via Ephemeral Rollups │
│  ├── Arcium         — MPC confidential computing            │
│  ├── Inco           — FHE/TEE via Inco Lightning            │
│  └── C-SPL          — Token-2022 encrypted amounts          │
├─────────────────────────────────────────────────────────────┤
│  SIP VALUE-ADD: Viewing Keys for ALL providers              │
│  └── Compliance layer works with any backend                │
└─────────────────────────────────────────────────────────────┘
```

### Provider Status (7 Providers)

| Provider | Send | Receive/Claim | Implementation | Notes |
|----------|------|---------------|----------------|-------|
| **SIP Native** | ✅ Real | ✅ Real | Production | Full stealth + Pedersen + viewing keys |
| **Privacy Cash** | ✅ Real* | ⚠️ Via SIP | Fallback | *Falls back to SIP Native. Native pool flow planned. |
| **ShadowWire** | ✅ Real* | ⚠️ Via SIP | Fallback | *Falls back to SIP Native. Native balance flow planned. |
| **MagicBlock** | ✅ Real* | ⚠️ Via SIP | Fallback | *Falls back to SIP Native. TEE delegation planned. |
| **Arcium** | ✅ Real* | ⚠️ Via SIP | Fallback | *Falls back to SIP Native. MPC queue/claim planned. |
| **Inco** | ⚠️ Pending | ⚠️ Via SIP | Simulated | Waiting for Solana program deployment (Q1 2026) |
| **C-SPL** | ⚠️ Pending | ⚠️ Via SIP | Simulated | Waiting for ZK ElGamal proofs on Solana (Q1 2026) |

**Current Reality:** All non-SIP-Native providers fall back to SIP Native for the actual on-chain transfer. Native integration roadmap above.

### C-SPL Integration Notes

**C-SPL (Confidential SPL)** uses Token-2022 Confidential Transfers to encrypt token amounts.

| What C-SPL Hides | What C-SPL Doesn't Hide |
|------------------|-------------------------|
| Token balances | Wallet addresses |
| Transfer amounts | Transaction participants |

**For full privacy** (hidden sender + recipient + amount), use `usePrivateDeFi` hook which combines:
1. **C-SPL** — Encrypted amounts (Token-2022)
2. **Arcium** — MPC swap validation
3. **SIP Native** — Stealth addresses (hidden recipient)

**Current Status:** Token-2022 ZK ElGamal proofs disabled on Solana. Using simulated encryption with documented API mapping. Production upgrade when proofs enabled.

### Arcium Deployment (Devnet)

```
Program ID:      S1P5q5497A6oRCUutUFb12LkNQynTNoEyRyUvotmcX9  (S1P vanity)
MXE Account:     5qy4Njk4jCJE4QgZ5dsg8uye3vzFypFTV7o7RRSQ8vr4
Cluster Offset:  456 (Arcium devnet v0.6.3)
Authority:       S1P6j1yeTm6zkewQVeihrTZvmfoHABRkHDhabWTuWMd
Balance:         3.77 SOL (reclaimable)
```

### Integration Notes

**ShadowWire:**
- Uses `signMessage` callback — wallet adapter compatible
- 22 supported tokens (SOL, USDC, BONK, ORE, RADR, JIM, etc.)
- Transfer types: `internal` (amount hidden via ZK) / `external` (sender anonymous)
- NO swap support — focuses on private transfers

**Privacy Cash:**
- SDK signs internally using `Keypair`
- Keypair accessed via biometric auth from SecureStore
- Secret key cleared from memory after each operation
- Pool-based mixing model (Tornado-style, ZK proofs)
- Supports SOL, USDC, USDT
- NO swap support — only deposit/withdraw

### Multi-Provider Native Integration Roadmap (Post-Launch)

**Current State:** All providers use unified Send/Receive/Scan UI with SIP Native fallback.

**Target State:** Adaptive UI that changes based on selected provider's native architecture.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ADAPTIVE UI ARCHITECTURE (Planned Q1-Q2 2026)                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Provider Selected → UI Adapts to Provider's Flow                       │
│                                                                         │
│  SIP Native    → [Send] [Receive] [Scan] [Claim]    (Stealth addresses) │
│  Privacy Cash  → [Deposit] [Notes] [Withdraw]       (Pool mixing)       │
│  ShadowWire    → [Deposit] [Transfer] [Withdraw]    (Internal balance)  │
│  MagicBlock    → [Delegate] [Private Tx] [Undelegate] (TEE custody)     │
│  Arcium        → [Queue] [Status] [Claim Result]    (MPC computation)   │
│                                                                         │
│  Each provider has fundamentally different architecture:                │
│  • No universal "scan" — Privacy Cash uses notes, not scanning          │
│  • Different balance models — internal ledger vs on-chain               │
│  • Different claim mechanisms — withdrawal vs claim vs undelegate       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

| Phase | Provider | Scope | Est. Duration |
|-------|----------|-------|---------------|
| 0 | SIP Native | ✅ Complete | Done |
| 1 | Architecture Refactor | Provider-specific routes, adaptive home | 1 week |
| 2 | Privacy Cash | Deposit/Notes/Withdraw flow | 2 weeks |
| 3 | ShadowWire | Internal balance + transfers | 2 weeks |
| 4 | MagicBlock | TEE delegation model | 2 weeks |
| 5 | Arcium | MPC computation queue/claim | 1 week |
| 6 | Integration | Testing, unified settings | 1 week |

**Detailed Strategy:** See `~/.claude/sip-protocol/MULTI-PROVIDER-STRATEGY.md`

**Why This Matters:**
- Current implementation works but is misleading (all fall back to SIP Native)
- Real money requires real provider integration, not simulated flows
- Each provider's SDK has different capabilities and UX requirements

### Key Files

```
src/privacy-providers/
├── types.ts          # PrivacyProviderAdapter interface
├── sip-native.ts     # SIP Native adapter (default)
├── privacy-cash.ts   # Privacy Cash adapter (biometric + keypair)
├── shadowwire.ts     # ShadowWire adapter (signMessage)
├── magicblock.ts     # MagicBlock adapter (TEE)
├── arcium.ts         # Arcium adapter (MPC)
├── inco.ts           # Inco adapter (FHE/TEE)
├── cspl.ts           # C-SPL adapter (Token-2022 Confidential Transfers)
├── registry.ts       # Factory & caching
└── index.ts          # Module exports

src/hooks/usePrivateDeFi.ts  # Orchestrates full-privacy DeFi (C-SPL + Arcium + SIP Native)

programs/sip_arcium_transfer/    # Arcium MPC program
├── encrypted-ixs/src/lib.rs     # Arcis circuits (MPC logic)
├── programs/.../src/lib.rs      # Anchor program
└── scripts/init-comp-defs.ts    # Initialization script

src/lib/compliance-records.ts    # Viewing key compliance layer
src/hooks/usePrivacyProvider.ts  # Hook for components
src/hooks/useViewingKeys.ts      # Viewing key management
src/hooks/useCompliance.ts       # Privacy score + audit trail
src/stores/settings.ts           # privacyProvider state
src/utils/keyStorage.ts          # SecureStore + biometric auth
```

### Privacy Model (What's Actually Hidden)

| Provider | Amount Hidden | Recipient Hidden | Sender Hidden |
|----------|---------------|------------------|---------------|
| **SIP Native** | ❌ Visible* | ✅ Stealth address | ❌ Visible |
| **Arcium (Full MPC)** | ✅ Encrypted | ✅ Stealth address | ⚠️ Partial |
| **Privacy Cash** | ✅ Fixed pools | ✅ Pool mixing | ✅ Pool mixing |
| **ShadowWire** | ✅ Bulletproofs | ⚠️ Internal only | ⚠️ Internal only |
| **C-SPL** | ✅ Token-2022 | ❌ Visible | ❌ Visible |

*SIP Native uses Pedersen commitments for balance proofs, but native SOL transfers show balance changes on-chain. Amount is hidden in instruction data but visible in account balance deltas.

**For TRUE amount privacy:** Use Arcium Full MPC, Privacy Cash (fixed pools), or C-SPL (Token-2022 Confidential Transfers).

### Compliance Layer (SIP's Differentiator)

When using third-party providers (ShadowWire, Privacy Cash), SIP adds viewing keys on top:

```
User sends via ShadowWire/PrivacyCash
    ↓
Transfer completes → txHash returned
    ↓
Compliance record created:
  { txHash, amount, recipient, provider, timestamp }
    ↓
Encrypted with viewing key (XChaCha20-Poly1305)
    ↓
Stored in SecureStore
    ↓
Auditor with viewing key can decrypt
```

This is the unique value-add: **"Privacy institutions can actually use"**

---

## Structure

```
app/(tabs)/           # Tab screens (index, send, receive, swap, settings)
app/(auth)/           # Auth screens (onboarding, wallet-setup, create/import wallet)
src/components/       # UI components (Button, Card, Input, Modal, Toggle)
src/components/onboarding/  # Onboarding slides (Welcome, Privacy, Stealth, ViewingKeys, Security)
src/components/demos/       # Demo components (ComparisonCard, BlockchainVisualizer, PermissionCard)
src/stores/           # Zustand stores (wallet, settings, privacy, swap, toast)
src/hooks/            # Custom hooks (useNativeWallet, usePrivacyProvider, useStealthDemo, etc.)
src/privacy-providers/# Privacy Provider adapters (#73)
src/lib/              # Anchor client, stealth utils
publishing/           # APK builds, dApp Store config
```

---

## Build & Publishing

> **Details:** [publishing/BUILD-WORKFLOW.md](publishing/BUILD-WORKFLOW.md)

**dApp Store Portal:** https://publish.solanamobile.com (web UI for releases)

**App NFT:** `2THAY9h4MaxsCtbm2WVj1gn2NMbVN3GUhLQ1EkMvqQby`

**Publisher:** `S1PSkwV3YZD6exNiUEdfTJadyUJ1CDDUgwmQaWB5yie`

**Cost/release:** ~0.025 SOL (Arweave ~0.02 + NFT rent ~0.002 + fees)

**Submission:**
- Review time: 2-5 business days (new apps & updates)
- Status: Email notifications for approval/rejection
- Support: [Discord #dapp-store](https://discord.gg/solanamobile)
- Docs: [Submit New App](https://docs.solanamobile.com/dapp-publishing/submit-new-app) | [Publishing Overview](https://docs.solanamobile.com/dapp-publishing/overview)

---

## Versioning (IMPORTANT)

> **Bump version BEFORE every build** — Same version = store won't recognize update.

```bash
# app.json — increment BOTH before building:
"version": "0.1.1"              # versionName (human-readable)
"android": { "versionCode": 2 } # MUST increment for store updates
```

---

## Debug Workflow

> **⚠️ NEVER use Expo cloud builds** — Free tier quota limited. Local only.

```bash
# Build (ALWAYS --local)
eas build --platform android --profile production --local

# ADB WiFi: Device → Developer Options → Wireless debugging → Pair
adb pair <IP>:<PORT> <CODE>    # First time only
adb connect <IP>:<PORT>        # Daily reconnect

# Install & run
adb install -r build-*.apk
adb shell am start -n com.sipprotocol.mobile/.MainActivity

# Debug
adb logcat | grep -iE "error|exception|sip"   # Logs
scrcpy                                         # Screen mirror
scrcpy --record session.mp4                    # Record
```

---

## Guidelines

**DO:**
- Test on real devices (especially Seeker for Seed Vault)
- Use NativeWind classes for styling
- Use SecureStore for ALL key storage
- Handle offline gracefully
- Require biometric for sensitive operations

**DON'T:**
- Block main thread with crypto operations
- Ignore keyboard/safe areas
- Use Expo cloud builds (local only)
- Log or expose private keys
- Store keys in AsyncStorage (use SecureStore)

**Packages:**
- `@sip-protocol/sdk` — Privacy primitives
- `@noble/curves`, `@noble/hashes` — Cryptography
- `expo-secure-store` — Key storage
- `expo-local-authentication` — Biometrics
- `@scure/bip39`, `@scure/bip32` — Key derivation

---

## Related Issues

- [#73](https://github.com/sip-protocol/sip-mobile/issues/73) — EPIC: Privacy Provider Architecture (OpenRouter for Privacy)
- [#61](https://github.com/sip-protocol/sip-mobile/issues/61) — EPIC: Native Wallet Architecture
- [#67](https://github.com/sip-protocol/sip-mobile/issues/67) — useNativeWallet hook
- [#68](https://github.com/sip-protocol/sip-mobile/issues/68) — keyStorage utilities
- [#70](https://github.com/sip-protocol/sip-mobile/issues/70) — Seed Vault integration

---

## Related Repositories

| Repo | Purpose | Relationship |
|------|---------|--------------|
| [sip-protocol](https://github.com/sip-protocol/sip-protocol) | Core SDK | Imports SDK |
| [sip-app](https://github.com/sip-protocol/sip-app) | **Companion web app** | Same product family |
| [docs-sip](https://github.com/sip-protocol/docs-sip) | Documentation | Documents usage |

---

## Tech Debt Tracker

**Last Audit:** 2026-01-30 | **Risk:** 🟢 LOW | **Total Items:** 20

### HIGH Priority

| Issue | File | Notes | Blocking |
|-------|------|-------|----------|
| Seed Vault disabled | `useSeedVault.ts:11,87` | RN codegen issue | #70, hardware wallet |
| ~~QR Scanner~~ | ~~`send.tsx:407`~~ | ✅ DONE (`53ff5f4`) | — |
| ~~Token prices~~ | ~~`swap.tsx:386`~~ | ✅ DONE (`af7374b`) | — |

### MEDIUM Priority

| Issue | File | Notes |
|-------|------|-------|
| C-SPL SimulatedService | `cspl.ts:295` | Pending SDK export |
| Custom token import | `tokens.tsx:443` | Shows "Coming soon" |
| ~~JSON.parse validation~~ | — | ✅ DONE (`d84572c`) |

### LOW Priority

| Issue | Notes |
|-------|-------|
| Security timeouts hardcoded | Could be env vars (5 min timeout, 5 attempts) |
| DEFAULT_SOL_PRICE_USD = 185 | Fallback only |
| ~~Promise.allSettled~~ | ✅ DONE (`d84572c`) |

### What's Clean

- ✅ No console.log leaks (all use `debug()`)
- ✅ No type safety issues (no `as any`, `@ts-ignore`)
- ✅ No mock data in production (gated with `__DEV__`)
- ✅ No disabled tests
- ✅ No security vulnerabilities

### Test Coverage

| Category | Tests | Status |
|----------|-------|--------|
| Total | 647 | 100% pass |
| E2E Flows | 49 | ✅ Good |
| Hooks | 190 | ✅ Good |
| Stores | 80 | ✅ Good |
| Utils | 138 | ✅ Good |
| Anchor/Lib | 90 | ✅ Good |

### E2E Verified (All 7 Privacy Providers)

All providers tested on Seeker with real on-chain transactions:
- SIP Native, Arcium, Privacy Cash, ShadowWire, MagicBlock, Inco Lightning, C-SPL
- All use SIP Privacy Program `S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at`
- All fall back to SIP Native when SDK unavailable in React Native

---

**Last Updated:** 2026-01-31
**Status:** v0.1.5 | dApp Store submitted | All 7 Privacy Providers E2E Verified | Interactive Onboarding
**Positioning:** Privacy in Your Pocket — consumers, daily use, native security
**Companion:** sip-app ("Privacy Command Center" — enterprise, compliance, power users)
