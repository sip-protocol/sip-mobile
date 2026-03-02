# MONOLITH Hackathon Submission — Design Document

> SIP Mobile as "THE Privacy Wallet for Seeker"
> Hackathon: MONOLITH — 2nd Solana Mobile Hackathon (Feb 2 – Mar 9, 2026)
> Prize Pool: $125K+ ($10K x10 winners, $5K x5 honorable, $10K SKR bonus)

---

## Problem Statement

Every transaction on Seeker is public. Wallet addresses, token balances, transfer amounts — all visible on-chain. Seeker owners need a privacy-first wallet that leverages the device's unique hardware capabilities (Seed Vault) while making private transactions as easy as public ones.

No privacy wallet exists in the Solana dApp Store today. SIP Mobile fills that gap.

## Positioning

**"THE Privacy Wallet for Seeker"** — one toggle to shield sender, amount, and recipient using stealth addresses, Pedersen commitments, and viewing keys for compliance.

**Tagline:** "Every transaction on Seeker is public. SIP fixes that — one toggle."

## Competitive Advantages

| Criteria (25% each) | SIP Mobile Strength |
|---------------------|---------------------|
| **Stickiness & PMF** | Privacy is a daily need — every transaction. Shielded payments create habit loop |
| **User Experience** | Purpose-built native app (not a web port), NativeWind, dark mode on AMOLED |
| **Innovation / X-Factor** | Only privacy wallet on Solana Mobile — no competitor in dApp Store |
| **Presentation & Demo** | Strong narrative: "HTTPS for crypto" — clear pitch, real use case |

---

## Approach: Audit-First Sequential

Audit what we have, fix the foundation, then layer features one at a time. Each phase produces a working, testable build.

```
Phase 1: Audit → Phase 2: Seed Vault → Phase 3: SKR → Phase 4: Social Payments
    → Phase 5: Privacy Portfolio → Phase 6: UX Polish → Phase 7: Submission
```

---

## Phase 1: Audit & Foundation

**Goal:** Fresh build on Seeker, identify all bugs and UX issues.

**Steps:**
1. Local Android build (`npx expo run:android`)
2. Install on Seeker via WiFi ADB
3. Walk through every screen (41 screens, 5 tabs)
4. Document bugs, crashes, UX friction in GitHub issues
5. Fix critical blockers (crashes, broken flows)
6. Establish baseline: "this works on Seeker"

**Exit criteria:** App launches, navigates, and core flows (send/receive/swap) work without crashes.

---

## Phase 2: Seed Vault Integration

**Goal:** Fix #70 — hardware-backed key storage using Seeker's Seed Vault.

**Context:** Seed Vault is Seeker's unique hardware security module. Currently disabled due to React Native codegen issue. This is the single most Seeker-specific feature we can ship.

**Steps:**
1. Diagnose the RN codegen issue blocking Seed Vault
2. Fix or work around the integration
3. Key generation → Seed Vault storage
4. Transaction signing → Seed Vault approval
5. Fallback to SecureStore on non-Seeker devices

**Exit criteria:** Keys stored in Seed Vault, transactions signed via Seed Vault prompt.

---

## Phase 3: SKR Token Integration

**Goal:** Meaningful SKR integration for the $10K bonus track.

**What SKR is:** Native asset of the Solana Mobile ecosystem. Integrating it meaningfully is a separate bonus prize.

**Steps:**
1. Display SKR balance on home screen
2. Send/receive SKR with privacy (stealth addresses)
3. SKR in privacy portfolio with privacy score
4. SKR swap support via Jupiter DEX integration
5. Optional: SKR-specific UI treatment (badge, highlight)

**Exit criteria:** SKR is a first-class citizen — visible, sendable, swappable, privacy-scored.

---

## Phase 4: Private Social Payments

**Goal:** Make private payments feel social, not technical.

**Steps:**
1. Contact list with stealth address resolution
2. "Pay [Name]" flow — select contact, enter amount, one toggle for privacy
3. Payment request generation (shareable link/QR)
4. Transaction history with contact names (not raw addresses)
5. Push notification on received payments (if feasible)

**Exit criteria:** Send private payment to a contact by name, receive notification.

---

## Phase 5: Privacy-First Token Portfolio

**Goal:** Dashboard showing all token balances with per-token privacy scores.

**Steps:**
1. Token list with balances (SOL, USDC, SKR, etc.)
2. Per-token privacy score (how exposed is this holding?)
3. Aggregate privacy score for the wallet
4. "Shield" action per token — one tap to improve privacy
5. Privacy recommendations ("Your USDC is 80% exposed — shield it")

**Exit criteria:** Portfolio view with privacy scores, actionable shield buttons.

---

## Phase 6: UX Polish

**Goal:** Make it feel premium — worthy of a $10K prize.

**Steps:**
1. Smooth transitions and animations (Reanimated)
2. Haptic feedback on key actions
3. Loading states, skeleton screens, error states
4. Dark mode optimization for Seeker's AMOLED
5. Accessibility pass (screen reader, contrast)
6. Performance audit (no jank, fast navigation)

**Exit criteria:** Feels polished and intentional. No rough edges.

---

## Phase 7: Submission Materials

**Goal:** Complete MONOLITH submission package.

**Deliverables:**
1. **Functional Android APK** — built locally with `eas build --local`
2. **GitHub repository** — public or invite `hackathon-Judges` account
3. **Demo video** — walkthrough of all features on Seeker device
4. **Pitch deck** — "THE Privacy Wallet for Seeker" narrative

**Demo video structure:**
- Hook: "Every Seeker transaction is public. Watch."
- Problem: Show public transaction on Solscan
- Solution: Same transaction with SIP — stealth address, hidden amount
- Features: Seed Vault, SKR, Social Payments, Privacy Portfolio
- Close: "Privacy should be the default, not the exception."

**Exit criteria:** All four submission items complete and uploaded.

---

## Technical Constraints

- **Build:** Local only (`npx expo run:android` or `eas build --local`). No EAS cloud builds (free tier quota).
- **Testing:** WiFi ADB debugging with Seeker phone in hand.
- **Stack:** Expo 52, React Native 0.81.5, NativeWind 4.0, Zustand 5.
- **Tests:** Maintain 672+ tests, add tests for new features.
- **Privacy providers:** 7 backends (SIP Native active, others fallback).

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Seed Vault codegen issue unsolvable | Document attempt thoroughly, pivot to SecureStore-only with "Seed Vault ready" messaging |
| SKR token not accessible on devnet | Use wrapped SOL as proxy, add SKR when available |
| Timeline pressure | Each phase is independently valuable — ship what's ready |
| Expo SDK compatibility with Seed Vault | Check Solana Mobile's React Native template for compatible versions |

---

## Success Metrics

- App runs smoothly on Seeker (no crashes, no jank)
- Seed Vault integration working (or documented attempt)
- SKR is a first-class token (bonus track eligible)
- Private payments feel social and effortless
- Demo video tells a compelling story
- Judges say: "This is the privacy wallet I want on my Seeker"

---

*Approved: 2026-03-02*
*Approach: Audit-First Sequential*
*Positioning: THE Privacy Wallet for Seeker*
