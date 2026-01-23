# CLAUDE.md - SIP Mobile

> **Ecosystem Hub:** See [sip-protocol/CLAUDE.md](https://github.com/sip-protocol/sip-protocol/blob/main/CLAUDE.md) for full ecosystem context

**Repository:** https://github.com/sip-protocol/sip-mobile
**Purpose:** Native mobile app for SIP Protocol — privacy on iOS, Android & Solana Mobile

---

## PRODUCT PHILOSOPHY (READ THIS FIRST)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MOBILE-FIRST PRIVACY FOR WEB3                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   sip-mobile = THE Privacy Wallet for Mobile Users                          │
│                                                                             │
│   Target Platforms:                                                         │
│   • iOS App Store → iPhone/iPad users                                       │
│   • Google Play Store → Android users                                       │
│   • Solana dApp Store → Seeker (Solana Mobile) users                        │
│                                                                             │
│   Wallet Strategy (Triple Integration):                                     │
│   • Privy → Embedded wallet (Apple/Google SSO, no seed phrase)              │
│   • MWA → Mobile Wallet Adapter (Android native, Solana Mobile)             │
│   • Phantom/Deeplinks → External wallet (iOS users with existing wallets)   │
│                                                                             │
│   Privacy + Mobile = Mass Adoption                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Quality Standards (Non-Negotiable)

| Aspect | Standard | Why |
|--------|----------|-----|
| **Native Feel** | 60 FPS animations, native gestures | Users expect native quality |
| **Startup** | <3 seconds cold start | First impression matters |
| **Privacy** | Biometric auth, secure storage | Protecting user funds |
| **Offline** | Core features work offline | Mobile users have spotty connections |
| **Accessibility** | WCAG AA compliant | Privacy is for everyone |
| **Battery** | Efficient background scanning | Users hate battery drain |

---

## Current Focus

**Status:** Week 1-2 Foundation | Building toward all 3 app stores
**Milestone:** Mobile EPIC (14-week parallel with M17)

### Phase Progress

| Phase | Status | Weeks |
|-------|--------|-------|
| 1: Foundation | 🟡 In Progress | 1-2 |
| 2: Wallet Integration | 🔲 Planned | 3-4 |
| 3: Privacy Features | 🔲 Planned | 5-7 |
| 4: DEX Integration | 🔲 Planned | 8-9 |
| 5: Compliance Dashboard | 🔲 Planned | 10-11 |
| 6: Testing & Polish | 🔲 Planned | 12-13 |
| 7: App Store Publishing | 🔲 Planned | 14 |

---

## Architecture

### Tab Structure (5 tabs)

| Tab | Purpose | Status |
|-----|---------|--------|
| Home | Dashboard, balances, quick actions | Scaffolded |
| Send | Send shielded payments | Scaffolded |
| Receive | Generate stealth addresses, QR | Scaffolded |
| Swap | Jupiter DEX with privacy toggle | Scaffolded |
| Settings | Wallet, privacy, network config | Scaffolded |

### Folder Structure

```
sip-mobile/
├── app/                      # Expo Router pages
│   ├── _layout.tsx           # Root layout
│   └── (tabs)/               # Tab navigation
│       ├── _layout.tsx       # Tab bar config
│       ├── index.tsx         # Home tab
│       ├── send.tsx          # Send tab
│       ├── receive.tsx       # Receive tab
│       ├── swap.tsx          # Swap tab
│       └── settings.tsx      # Settings tab
├── src/
│   ├── components/
│   │   └── ui/               # Base UI components
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       ├── Input.tsx
│   │       ├── Modal.tsx
│   │       └── Toggle.tsx
│   ├── stores/               # Zustand state management
│   │   ├── wallet.ts         # Wallet connection state
│   │   ├── settings.ts       # App settings (persisted)
│   │   ├── privacy.ts        # Privacy state, stealth keys
│   │   ├── swap.ts           # DEX state, history
│   │   └── toast.ts          # Toast notifications
│   ├── hooks/                # Custom hooks (planned)
│   └── types/                # TypeScript types
├── assets/                   # Images, fonts
└── global.css                # Tailwind directives
```

---

## Quick Reference

**Tech Stack:** Expo SDK 52, React Native, NativeWind 4.0, Zustand 5, Expo Router

**Key Commands:**
```bash
pnpm install              # Install dependencies
npx expo start            # Dev server (iOS + Android)
npx expo start --ios      # iOS simulator only
npx expo start --android  # Android emulator only
pnpm typecheck            # Type check
pnpm test -- --run        # Run tests
eas build --platform ios  # Build iOS (EAS)
eas build --platform android  # Build Android (EAS)
```

**Simulators:**
```bash
# iOS (requires Xcode)
open -a Simulator

# Android (requires Android Studio)
emulator -avd Pixel_7_API_34
```

---

## Dependencies

**Core:**
- `expo` ~52.0.0 - React Native framework
- `expo-router` ~4.0.0 - File-based routing
- `nativewind` ^4.0.0 - Tailwind for React Native
- `zustand` ^5.0.0 - State management

**SIP Protocol:**
- `@sip-protocol/sdk` - Core privacy SDK
- `@sip-protocol/types` - TypeScript types

**Crypto:**
- `@noble/curves` - Elliptic curves (secp256k1)
- `@noble/hashes` - Cryptographic hashes

**Wallet:**
- `@privy-io/expo` - Embedded wallet (planned)
- `@solana-mobile/mobile-wallet-adapter-protocol` - MWA (planned)

**Storage:**
- `@react-native-async-storage/async-storage` - Persistent storage
- `expo-secure-store` - Secure key storage (planned)

---

## Wallet Integration Strategy

### Triple Wallet Support

| Wallet Type | Platform | Use Case |
|-------------|----------|----------|
| **Privy** | iOS + Android | New users, SSO login |
| **MWA** | Android | Solana Mobile, power users |
| **Phantom Deeplinks** | iOS | Existing Phantom users |

### Unified Hook

```typescript
// Abstracts all 3 wallet types
const { connect, disconnect, publicKey, signTransaction } = useWallet()

// Works regardless of underlying wallet type
await connect('privy')     // SSO flow
await connect('mwa')       // MWA adapter
await connect('phantom')   // Deeplink flow
```

---

## Key Components

### UI Components (Base)

| Component | Variants | Purpose |
|-----------|----------|---------|
| `Button` | primary, secondary, outline, ghost, danger | Action buttons |
| `Card` | default, elevated, outlined, filled | Content containers |
| `Input` | standard, AmountInput | Text/number entry |
| `Modal` | standard, ConfirmModal | Bottom sheets |
| `Toggle` | standard, PrivacyToggle | Boolean switches |

### Stores (Zustand)

| Store | Persistence | Purpose |
|-------|-------------|---------|
| `wallet` | Memory | Connection state, keys |
| `settings` | AsyncStorage | User preferences |
| `privacy` | AsyncStorage | Privacy level, stealth keys |
| `swap` | AsyncStorage | Swap history |
| `toast` | Memory | Notifications |

---

## Repo-Specific Guidelines

### DO (Mobile Excellence):

- **Test on real devices** — Simulators lie about performance
- **Use NativeWind classes** — Consistent with web styling
- **Persist important state** — Users expect data to survive app close
- **Handle offline gracefully** — Show cached data, queue actions
- **Respect platform conventions** — iOS vs Android UX differences
- **Use Expo SecureStore** — Never store keys in AsyncStorage
- **Optimize for battery** — Batch network requests, minimize background work

### DON'T (Mobile Pitfalls):

- **Block the main thread** — Crypto operations off main thread
- **Ignore keyboard** — Input fields must handle keyboard appearance
- **Forget safe areas** — Notches, home indicators, status bars
- **Skip haptics** — Feedback makes apps feel native
- **Hard-code dimensions** — Use responsive values (%, flex)
- **Ignore gesture conflicts** — Tab bar, swipe navigation

### Quality Checklist (Before Every PR)

- [ ] Works on iOS simulator
- [ ] Works on Android emulator
- [ ] No TypeScript errors (`pnpm typecheck`)
- [ ] Loading states for async operations
- [ ] Error states with helpful messages
- [ ] Keyboard handling (KeyboardAvoidingView)
- [ ] Safe area insets respected
- [ ] No console warnings
- [ ] 60 FPS (no jank during animations)

---

## App Store Requirements

### iOS App Store

- Bundle ID: `com.sipprotocol.mobile`
- Min iOS: 15.1
- Required: Privacy manifest, App Tracking Transparency

### Google Play Store

- Package: `com.sipprotocol.mobile`
- Min Android: SDK 24 (Android 7)
- Required: Data safety form, target API 34+

### Solana dApp Store (Seeker)

- Requires MWA integration
- Must pass Solana Mobile guidelines

---

## Related Repositories

| Repo | Purpose | Relationship |
|------|---------|--------------|
| [sip-protocol](https://github.com/sip-protocol/sip-protocol) | Core SDK | Imports SDK |
| [sip-app](https://github.com/sip-protocol/sip-app) | Web app | Feature parity |
| [docs-sip](https://github.com/sip-protocol/docs-sip) | Documentation | Documents usage |

---

**Last Updated:** 2026-01-23
**Status:** Week 1-2 Foundation | 5 tabs scaffolded | Stores + UI components done
**Target:** iOS + Android + Solana dApp Store by Week 14
