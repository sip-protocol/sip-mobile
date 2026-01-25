# SIP Mobile

> Native privacy wallet for iOS, Android & Solana Mobile (Seeker)

**Live:** Solana dApp Store (App NFT: `2THAY9h4MaxsCtbm2WVj1gn2NMbVN3GUhLQ1EkMvqQby`)

## Overview

SIP Mobile is the native mobile application for SIP Protocol, bringing cryptographic privacy to iOS, Android, and Solana Mobile devices. Built with Expo SDK 52 and React Native for a truly native experience.

## Features

- **Private Payments** — Send and receive shielded payments with stealth addresses
- **Wallet Management** — Secure key storage with Expo SecureStore
- **Private Swaps** — Jupiter DEX integration with privacy toggle
- **Multi-Wallet Support** — Privy (embedded), MWA (Android), Phantom deeplinks (iOS)

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development server
npx expo start

# Run on iOS simulator
npx expo run:ios

# Run on Android emulator
npx expo run:android

# Type check
pnpm typecheck
```

## Project Structure

```
sip-mobile/
├── app/
│   └── (tabs)/           # Tab screens (index, send, receive, swap, settings)
├── src/
│   ├── components/       # UI components (Button, Card, Input, Modal, Toggle)
│   └── stores/           # Zustand stores (wallet, settings, privacy, swap, toast)
├── publishing/           # APK builds, dApp Store config
└── assets/               # Images, icons, fonts
```

## Tech Stack

- **Framework:** Expo SDK 52, React Native
- **Styling:** NativeWind 4.0 (Tailwind for RN)
- **State:** Zustand 5
- **Navigation:** Expo Router
- **Crypto:** @noble/curves, @noble/hashes
- **Storage:** Expo SecureStore

## Build & Publishing

### Local APK Build

```bash
eas build --platform android --profile production --local
```

### Optimizations

- ARM-only build (no x86)
- ProGuard + shrink resources
- Result: 112MB → ~45MB

### Solana dApp Store

Published as App NFT with ~0.025 SOL per release (Arweave + NFT rent + fees).

See [publishing/BUILD-WORKFLOW.md](publishing/BUILD-WORKFLOW.md) for details.

## Wallet Strategy

| Platform | Primary | Fallback |
|----------|---------|----------|
| Android | Mobile Wallet Adapter (MWA) | Privy embedded |
| iOS | Phantom deeplinks | Privy embedded |
| All | Privy embedded wallet | — |

## Related

- [sip-protocol](https://github.com/sip-protocol/sip-protocol) — Core SDK
- [sip-app](https://github.com/sip-protocol/sip-app) — Web application
- [docs-sip](https://github.com/sip-protocol/docs-sip) — Documentation

## License

MIT

---

*Part of the [SIP Protocol](https://github.com/sip-protocol) ecosystem*
