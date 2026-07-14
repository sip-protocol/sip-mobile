<!-- Satellite context file — extends the global hub (~/.claude/CLAUDE.md | ~/.pi/agent/AGENTS.md). Host-neutral; project-specific only. Do not duplicate hub standards here. -->

# SIP Mobile

> Daily privacy wallet for Solana — "Privacy in Your Pocket". Native key management, quick payments, on-the-go swaps. Targets: iOS App Store, Google Play, Solana dApp Store (Seeker).

**Ecosystem hub:** See [sip-protocol/sip-protocol/AGENTS.md](https://github.com/sip-protocol/sip-protocol/blob/main/AGENTS.md) for full ecosystem context.

## Product Positioning (Jupiter Model)

- **`@sip-protocol/sdk`** — THE PRIVACY STANDARD
- **sip-mobile** (this repo) — "Privacy in Your Pocket": consumers; quick payments/swaps, native key management, biometric, on-the-go
- **sip-app** — "Privacy Command Center": power users / enterprise; complex visualizations, compliance dashboards

Companion products — same brand, platform-optimized (like jup.ag + Jupiter Mobile), NOT 1:1 clones. Both real products showcasing SDK capabilities.

## Quick Reference

**Stack:** Expo 54, React Native 0.81, NativeWind 4, Zustand 5, Expo Router

```bash
pnpm install
npx expo start            # Dev server (iOS + Android)
pnpm typecheck
eas build --platform android --profile production --local  # Local APK (NEVER use Expo cloud builds)
pnpm test -- --run        # 1,492 tests (65 suites)
```

**Tabs:** Home | Privacy | Swap

## Wallet Architecture

**Philosophy:** SIP Privacy IS the wallet — users manage keys directly, no external wallet required.

| Method | Platform | Priority | Status |
|--------|----------|----------|--------|
| Native Wallet | All | PRIMARY | ✅ Complete |
| Seed Vault | Seeker | PRIMARY | ✅ Complete |
| MWA | Android | Optional | ✅ Available |
| Phantom Deeplinks | iOS | Optional | ✅ Available |
| ~~Privy~~ | ~~All~~ | REMOVED | ❌ (#71) |

### Key Management
- **Primary (Native):** generate new (BIP39 mnemonic) · import seed (12/24 words) · import private key (base58) · SecureStore + Biometrics · Solana derivation `m/44'/501'/0'/0'`
- **Seeker:** direct Seed Vault integration (no Phantom middleman)
- **Optional:** MWA (Android) / Phantom Deeplinks (iOS) external wallet connection

### Security Model
- Key Storage: `expo-secure-store` (Keychain/Keystore)
- Access Control: biometric via `expo-local-authentication`
- Derivation: BIP39 → BIP44 (Solana path)
- Memory: keys cleared after signing
- Backup: mnemonic export (biometric required)

**Key files:** `src/hooks/{useNativeWallet,useSeedVault,useMWA,usePhantomDeeplink}.ts` · `src/utils/keyStorage.ts` · `app/(auth)/{wallet-setup,create-wallet,import-wallet}.tsx` · `app/settings/backup.tsx`

## Privacy Provider Architecture (#73)

"OpenRouter for Privacy" — one app, multiple privacy engines. Users choose their preferred provider.

```
USER INTERFACE (Send / Swap / Settings)
  → usePrivacyProvider hook (wraps active adapter, provides send()/swap())
  → PrivacyProviderAdapter: SIP Native · Privacy Cash · ShadowWire · MagicBlock · Arcium · Inco · C-SPL
  → SIP VALUE-ADD: viewing keys for ALL providers (compliance layer works with any backend)
```

### Provider Status (7)

| Provider | Send | Receive/Claim | Notes |
|----------|------|---------------|-------|
| SIP Native | ✅ Real | ✅ Real | Full stealth + Pedersen + viewing keys |
| Privacy Cash | ✅ Real* | ⚠️ Via SIP | *Falls back to SIP Native. Pool-based mixing (Tornado-style, ZK). SOL/USDC/USDT. No swap. |
| ShadowWire | ✅ Real* | ⚠️ Via SIP | *Fallback. Bulletproofs + internal transfers. 22 tokens. `signMessage` callback. No swap. |
| MagicBlock | ✅ Real* | ⚠️ Via SIP | *Fallback. TEE (Intel TDX) via Ephemeral Rollups. |
| Arcium | ✅ Real* | ⚠️ Via SIP | *Fallback. MPC confidential computing. |
| Inco | ⚠️ Pending | ⚠️ Via SIP | Simulated. FHE/TEE via Inco Lightning. Waiting for program deployment. |
| C-SPL | ⚠️ Pending | ⚠️ Via SIP | Simulated. Token-2022 Confidential Transfers (encrypted amounts). Waiting for ZK ElGamal proofs on Solana. |

**Current reality:** all non-SIP-Native providers fall back to SIP Native for the actual on-chain transfer. Native integration is the multi-phase roadmap (Q1-Q2 2026).

### Privacy Model (what's actually hidden)

| Provider | Amount Hidden | Recipient Hidden | Sender Hidden |
|----------|---------------|------------------|---------------|
| SIP Native | ❌ Visible* | ✅ Stealth address | ❌ Visible |
| Arcium (Full MPC) | ✅ Encrypted | ✅ Stealth | ⚠️ Partial |
| Privacy Cash | ✅ Fixed pools | ✅ Pool mixing | ✅ Pool mixing |
| ShadowWire | ✅ Bulletproofs | ⚠️ Internal only | ⚠️ Internal only |
| C-SPL | ✅ Token-2022 | ❌ Visible | ❌ Visible |

*SIP Native uses Pedersen commitments for balance proofs, but native SOL transfers show balance changes on-chain. For TRUE amount privacy: Arcium Full MPC, Privacy Cash (fixed pools), or C-SPL.

### C-SPL Integration
C-SPL (Token-2022 Confidential Transfers) encrypts token **amounts** but NOT addresses/participants. For full privacy (hidden sender+recipient+amount), `usePrivateDeFi` combines C-SPL (encrypted amounts) + Arcium (MPC swap validation) + SIP Native (stealth addresses). Token-2022 ZK ElGamal proofs currently disabled on Solana — using simulated encryption with documented API mapping.

### Compliance Layer (SIP's differentiator)
When using third-party providers, SIP adds viewing keys on top: transfer completes → compliance record `{txHash, amount, recipient, provider, timestamp}` encrypted with viewing key (XChaCha20-Poly1305) → stored in SecureStore → auditor with viewing key can decrypt. "Privacy institutions can actually use."

**Key files:** `src/privacy-providers/{types,sip-native,privacy-cash,shadowwire,magicblock,arcium,inco,cspl,registry,index}.ts` · `src/hooks/{usePrivacyProvider,useViewingKeys,useCompliance,usePrivateDeFi}.ts` · `src/lib/compliance-records.ts` · `src/stores/settings.ts` · `programs/sip_arcium_transfer/`

### Arcium Deployment (Devnet)
Program `S1P5q5497A6oRCUutUFb12LkNQynTNoEyRyUvotmcX9` · MXE `5qy4Njk4jCJE4QgZ5dsg8uye3vzFypFTV7o7RRSQ8vr4` · Cluster Offset 456 (Arcium devnet v0.6.3) · Authority `S1P6j1yeTm6zkewQVeihrTZvmfoHABRkHDhabWTuWMd`

## Structure

```
app/(tabs)/           # Tab screens (index, privacy, swap)
app/(auth)/           # Auth screens (onboarding, wallet-setup, create/import wallet)
src/components/       # UI components (Button, Card, Input, Modal, Toggle)
src/components/{onboarding,demos}/
src/stores/           # Zustand stores (wallet, settings, privacy, swap, toast)
src/hooks/            # useNativeWallet, usePrivacyProvider, useStealthDemo, ...
src/privacy-providers/# adapters (#73)
src/lib/              # Anchor client, stealth utils
publishing/           # APK builds, dApp Store config
```

## Build & Publishing

**dApp Store Portal:** https://publish.solanamobile.com · **App NFT:** `2THAY9h4MaxsCtbm2WVj1gn2NMbVN3GUhLQ1EkMvqQby` · **Publisher:** `S1PSkwV3YZD6exNiUEdfTJadyUJ1CDDUgwmQaWB5yie` · **Cost/release:** ~0.025 SOL · **Review:** 2-5 business days.

### Versioning (IMPORTANT)
Bump version BEFORE every build — same version = store won't recognize update. `app.config.js`: increment BOTH `version` (versionName) and `android.versionCode`.

### Local Build Prerequisites (macOS)

**⚠️ NEVER use Expo cloud builds** — free tier quota limited. Local only.

| Dependency | Install | Verify |
|-----------|---------|--------|
| JDK 21 | `brew install openjdk@21` + symlink | `java -version` |
| Android Studio | `brew install --cask android-studio` | Open once → Standard setup |
| Android SDK | Via setup wizard | `ls ~/Library/Android/sdk` |
| ANDROID_HOME | Add to `~/.zshrc` | `echo $ANDROID_HOME` |

JDK symlink: `sudo ln -sfn /opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-21.jdk`

`~/.zshrc`: `export ANDROID_HOME=$HOME/Library/Android/sdk` + add emulator/platform-tools/cmdline-tools to PATH.

**Expo 54 SDK:** compileSdk 36, Build-Tools 36.1, NDK 27.1.12297006.

### Debug Workflow

```bash
eas build --platform android --profile production --local
adb pair <IP>:<PORT> <CODE>     # first time only
adb connect <IP>:<PORT>          # daily reconnect
adb install -r build-*.apk
adb shell am start -n com.sipprotocol.mobile/.MainActivity
adb logcat | grep -iE "error|exception|sip"
scrcpy                          # screen mirror / --record
```

## Guidelines

**DO:** test on real devices (especially Seeker for Seed Vault); use NativeWind classes; use SecureStore for ALL key storage; handle offline gracefully; require biometric for sensitive operations.
**DON'T:** block main thread with crypto; ignore keyboard/safe areas; use Expo cloud builds; log/expose private keys; store keys in AsyncStorage (use SecureStore).

**Packages:** `@sip-protocol/sdk` · `@noble/curves` `@noble/hashes` · `expo-secure-store` · `expo-local-authentication` · `@scure/bip39` `@scure/bip32`.

## Test Coverage

Total 1,492 tests (65 suites, 100% pass): E2E Flows 184 · Hooks 282 · Stores 176 · Utils 305 · Components 128 · Anchor/Lib 203. **E2E verified (all 7 privacy providers)** on Seeker with real on-chain transactions; all use SIP Privacy Program `S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at`; all fall back to SIP Native when SDK unavailable in React Native.

## Tech Debt Tracker

Last audit 2026-01-30 | Risk 🟢 LOW | 20 items. HIGH: Seed Vault disabled (`useSeedVault.ts:11,87` RN codegen issue, #70). MEDIUM: C-SPL SimulatedService (`cspl.ts:295`), custom token import (`tokens.tsx:443`). LOW: security timeouts hardcoded, `DEFAULT_SOL_PRICE_USD=185` fallback. **Clean:** no console.log leaks (all use `debug()`), no `as any`/`@ts-ignore`, no mock data in production (gated with `__DEV__`), no disabled tests, no security vulnerabilities.