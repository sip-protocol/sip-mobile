# SIP Privacy Mobile — Feature Debug Checklist

**Created:** 2026-01-28
**Purpose:** Systematic feature verification before publishing

---

## How to Use

1. Test each feature on Seeker device via ADB
2. Mark status: ✅ Pass | ❌ Fail | ⚠️ Partial | 🔲 Not Tested
3. Note any bugs found with description
4. Update after each debugging session

---

## 1. ONBOARDING & AUTH

### 1.1 First Launch
| Feature | Status | Notes |
|---------|--------|-------|
| Onboarding slides (5 screens) | ✅ | All 5 slides verified: Welcome, Private Payments, Stealth Addresses, Viewing Keys, Your Keys Your Crypto |
| "Get Started" button | ✅ | Navigates to home (wallet already exists) or wallet-setup (fresh install) |

### 1.2 Wallet Setup
| Feature | Status | Notes |
|---------|--------|-------|
| Create New Wallet | ✅ | "Recommended" badge, green border, triggers biometric + "Creating your wallet..." |
| Import Existing Wallet | ✅ | "Restore from seed phrase or private key" option present |
| Security notice | ✅ | "Your keys, your crypto" card at bottom |
| Biometric setup prompt | ✅ | Fingerprint dialog: "Authenticate to access your wallet" |

### 1.3 Create Wallet Flow
| Feature | Status | Notes |
|---------|--------|-------|
| Generate mnemonic | 🔲 | 12 words displayed |
| "I've saved it" checkbox | 🔲 | Required before continue |
| Verification step | 🔲 | Select correct words |
| Wallet creation success | 🔲 | Navigate to home |

### 1.4 Import Wallet Flow
| Feature | Status | Notes |
|---------|--------|-------|
| Seed phrase input (12 words) | 🔲 | Paste or manual entry |
| Seed phrase input (24 words) | 🔲 | Toggle option |
| Invalid phrase error | 🔲 | Proper validation message |
| Private key import | 🔲 | Base58 input |
| Success & navigate home | 🔲 | |

---

## 2. HOME TAB

### 2.1 Balance Display
| Feature | Status | Notes |
|---------|--------|-------|
| SOL balance shows | ✅ | Real-time from RPC |
| USD value (if available) | ✅ | Price conversion |
| Pull-to-refresh | ✅ | Updates balance |
| Balance loading state | ✅ | Shows "..." |
| Network badge | ✅ | Devnet/Mainnet/Testnet |
| Tap-to-copy address | ✅ | Toast confirmation |

### 2.2 Quick Actions
| Feature | Status | Notes |
|---------|--------|-------|
| Private button → Send tab | ✅ | "Shield funds" — navigates correctly |
| History button → History screen | ✅ | "View activity" — full history with filters |
| Keys button → Viewing Keys | ✅ | "Manage keys" — export/history/imported tabs |

### 2.3 Recent Activity
| Feature | Status | Notes |
|---------|--------|-------|
| Shows recent transactions | ✅ | Last 5 items |
| Tap transaction → Detail | 🔲 | No txs to test |
| "View All" → History | 🔲 | No txs to test |
| Empty state (no txs) | ✅ | "No transactions yet — Send or receive to see activity here" |

### 2.4 Unclaimed Banner
| Feature | Status | Notes |
|---------|--------|-------|
| Shows when unclaimed > 0 | 🔲 | Count displayed |
| Tap → Claim screen | 🔲 | Navigation works |
| Hidden when no unclaimed | 🔲 | |

---

## 3. SEND TAB

### 3.1 Amount Input
| Feature | Status | Notes |
|---------|--------|-------|
| Numeric keypad input | ✅ | Amount field present, SOL unit |
| Decimal handling | ✅ | Shows 0.00 format |
| MAX button | ✅ | Present with "Use maximum balance" a11y |
| USD conversion display | ✅ | "$0.00" shown below amount |

### 3.2 Recipient Input
| Feature | Status | Notes |
|---------|--------|-------|
| Paste address | ✅ | "Wallet address or sip: stealth address" placeholder |
| QR scan button | ✅ | "Scan QR" chip present |
| Contacts button | ✅ | New feature — "Contacts" chip |
| Stealth address detection | 🔲 | Need stealth addr to test |
| Invalid address error | 🔲 | Need input to test |
| Solana address validation | 🔲 | Need input to test |

### 3.3 Privacy Level Display (Read-Only)
| Feature | Status | Notes |
|---------|--------|-------|
| Shows current level from Settings | ✅ | Single source of truth |
| Displays icon, title, description | ✅ | Correct formatting |
| "Change ›" link to Settings | ✅ | Navigation works |
| Updates when Settings change | ✅ | Real-time sync |

### 3.4 Send Confirmation
| Feature | Status | Notes |
|---------|--------|-------|
| Review modal shows | 🔲 | Amount, recipient, level |
| Biometric prompt | 🔲 | Required for send |
| Cancel button | 🔲 | Dismisses modal |
| Confirm button | 🔲 | Initiates transaction |

### 3.5 Send Execution
| Feature | Status | Notes |
|---------|--------|-------|
| Loading/progress state | 🔲 | Spinner visible |
| Success modal | 🔲 | TX signature shown |
| View on Explorer | 🔲 | Opens Solana Explorer |
| Error handling | 🔲 | User-friendly message |
| Insufficient balance | 🔲 | Proper error |

---

## 4. RECEIVE TAB

### 4.1 Stealth Address
| Feature | Status | Notes |
|---------|--------|-------|
| Address generated on load | ✅ | sip:solana:HCtSiX2x...dZp5Cm |
| QR code displays | ✅ | Scannable, "Scan to receive privately" |
| Address text visible | ✅ | Truncated sip: format |
| Loading state | 🔲 | Generates fast, hard to catch |

### 4.2 Actions
| Feature | Status | Notes |
|---------|--------|-------|
| Copy button | ✅ | Present with icon |
| Share button | ✅ | Present with icon |
| New Address button | ✅ | "New Address" link present |
| Regenerate confirmation | 🔲 | Need to test tap |
| Block if unclaimed | 🔲 | No unclaimed to test |

### 4.3 Request Amount Tab
| Feature | Status | Notes |
|---------|--------|-------|
| Amount input field | ✅ | "0.00 SOL" with tab active |
| QR updates with amount | 🔲 | Need to enter amount |
| Copy includes amount | 🔲 | Need to enter amount |

### 4.4 Scan Link
| Feature | Status | Notes |
|---------|--------|-------|
| "Scan for Payments" button | ✅ | Navigates to Scan Payments screen correctly |

---

## 5. SCAN SCREEN

### 5.1 Scanning
| Feature | Status | Notes |
|---------|--------|-------|
| Scan button starts scan | ✅ | Green "Scan for Payments" button, completes scan |
| Progress percentage | ✅ | "Scanned 10 announcements" shown |
| Cancel button | 🔲 | Scan completes fast, hard to test cancel |
| Last scan time display | ✅ | "Just now" after scan, "Never" before first scan |

### 5.2 Results
| Feature | Status | Notes |
|---------|--------|-------|
| Found payments list | 🔲 | No payments to find (0 balance) |
| "No new payments" state | ✅ | "No New Payments" with green checkmark |
| Tap payment → Claim | 🔲 | No payments to test |
| "Claim All" button | 🔲 | No payments to test |

### 5.3 Unclaimed Banner
| Feature | Status | Notes |
|---------|--------|-------|
| Shows if unclaimed exist | 🔲 | No unclaimed to test |
| Count accurate | 🔲 | No unclaimed to test |
| Tap → Claim screen | 🔲 | No unclaimed to test |

---

## 6. CLAIM SCREEN

### 6.1 Payment Selection
| Feature | Status | Notes |
|---------|--------|-------|
| List of unclaimed | 🔲 | Shows all pending |
| Checkbox selection | 🔲 | Multi-select works |
| Select All button | 🔲 | Toggles all |
| Total amount display | 🔲 | Sum of selected |

### 6.2 Claim Execution
| Feature | Status | Notes |
|---------|--------|-------|
| Claim button enabled | 🔲 | When 1+ selected |
| Biometric prompt | 🔲 | Before claim |
| Progress indicator | 🔲 | Shows step |
| Success per payment | 🔲 | Checkmarks appear |
| Error handling | 🔲 | Failed claims shown |

### 6.3 Post-Claim
| Feature | Status | Notes |
|---------|--------|-------|
| Balance updated | 🔲 | Reflects claimed |
| Payments marked claimed | 🔲 | Removed from list |
| Success message | 🔲 | Toast or modal |

---

## 7. SWAP TAB

### 7.1 Token Selection
| Feature | Status | Notes |
|---------|--------|-------|
| "From" token selector | ✅ | Opens "Select Output Token" modal |
| "To" token selector | ✅ | Opens token list with popular + all |
| Swap direction button | ✅ | Flips SOL↔USDC correctly |
| Token balances shown | ✅ | "Balance: 0" for each |

### 7.2 Token Selector Screen
| Feature | Status | Notes |
|---------|--------|-------|
| Search by name | ✅ | "Search by name, symbol, or address" |
| Search by symbol | ✅ | Same search field |
| Popular tokens chips | ✅ | SOL, USDC, USDT, BONK, JUP, SKR |
| Token icons load | ✅ | All icons rendered |
| Import custom token | ✅ | "+ Import Custom Token" button |
| All tokens list | ✅ | SOL, USDC, USDT, BONK, JUP, RAY, PYTH, WIF |

### 7.3 Quote Display
| Feature | Status | Notes |
|---------|--------|-------|
| Quote fetches on input | 🔲 | 0 balance, can't test |
| Rate displayed | 🔲 | 0 balance |
| Price impact shown | 🔲 | 0 balance |
| Freshness indicator | 🔲 | 0 balance |
| Refresh button | 🔲 | 0 balance |
| Quote error state | 🔲 | 0 balance |

### 7.4 Swap Settings
| Feature | Status | Notes |
|---------|--------|-------|
| Slippage button | ✅ | Opens "Swap Settings" modal |
| Preset options (0.1, 0.5, 1, 3%) | ✅ | 1% selected by default |
| Custom slippage input | ✅ | "Custom %" field |
| Save settings | ✅ | "Done" button |

### 7.5 Privacy Toggle
| Feature | Status | Notes |
|---------|--------|-------|
| "Private Swap" toggle | ✅ | ON: green border, lock icon, "Amounts hidden via stealth routing" |
| "Public Swap" state | ✅ | OFF: gray, "Visible on-chain" |
| Subtitle updates | ✅ | "privately" removed from header when OFF |

### 7.6 Swap Execution
| Feature | Status | Notes |
|---------|--------|-------|
| Swap button enabled | ✅ | "Enter Amount" disabled when no amount (correct) |
| Confirmation modal | 🔲 | 0 balance, can't test |
| Biometric prompt | 🔲 | 0 balance |
| Progress steps | 🔲 | 0 balance |
| Success modal | 🔲 | 0 balance |
| Error handling | 🔲 | 0 balance |

### 7.7 Swap History
| Feature | Status | Notes |
|---------|--------|-------|
| History button | ✅ | Opens "Swap History" screen |
| Filter by status | ✅ | All (0), Pending (0), Completed (0), Failed |
| Empty state | ✅ | "No Swap History" with "Make a Swap" CTA |
| Swap detail modal | 🔲 | No swaps to test |
| View on Explorer | 🔲 | No swaps to test |
| Clear history | 🔲 | No swaps to test |

---

## 8. SETTINGS TAB

### 8.1 Account Section
| Feature | Status | Notes |
|---------|--------|-------|
| Current wallet shown | ✅ | "92rVZU...BY4a" truncated, "Active" badge |
| Accounts button | ✅ | Opens Manage Accounts screen |
| Backup button | 🔲 | No dedicated backup button in Settings (seed phrase via Accounts) |

### 8.2 Accounts Screen
| Feature | Status | Notes |
|---------|--------|-------|
| List all accounts | ✅ | 1 account with Provider, Chain, Added, Last Used details |
| Switch account | ✅ | Checkmark on active, "Tap to make active" helper |
| Add account | ⚠️ | Button present but errors "Wallet already exists. Delete it first" — no multi-account support |
| Delete account | ✅ | Red "Remove" button with trash icon |
| Rename account | ✅ | "Rename" button with edit icon |

### 8.3 Backup Screen
| Feature | Status | Notes |
|---------|--------|-------|
| Biometric to reveal | 🔲 | No dedicated backup screen — biometric triggers on wallet creation |
| Seed phrase shown | 🔲 | No standalone seed reveal UI found |
| Copy phrase | 🔲 | N/A |
| Warning message | 🔲 | N/A |

### 8.4 Viewing Keys
| Feature | Status | Notes |
|---------|--------|-------|
| Export tab | ✅ | Key icon, "Export Viewing Key" with share/copy buttons |
| Expiry selection | ✅ | "Expires in (days, optional)" with "Never" placeholder |
| Copy key | ✅ | Clipboard icon button |
| Record disclosure | 🔲 | No disclosures to test (0 items) |
| History tab | ✅ | "No Disclosures Yet" empty state, disclosure records explanation |
| Revoke disclosure | 🔲 | No disclosures to test |
| Imported tab | ✅ | "Imported (0)" tab accessible, same empty state |

### 8.5 Security Settings
| Feature | Status | Notes |
|---------|--------|-------|
| Biometric toggle | ✅ | "Enable Fingerprint" toggle (OFF by default) |
| PIN backup toggle | ✅ | "Set PIN" option — "Use PIN as backup when biometrics unavailable" |
| Auto-lock timeout | ✅ | Toggle ON + "Lock after: 5 minutes" configurable |
| Hide balance toggle | ✅ | "Hide balance in background" toggle ON |
| Screenshot protection | ✅ | "Prevent screenshots of sensitive screens" toggle ON |
| Security info card | ✅ | "Your keys are secure" with enclave explanation |

### 8.6 Privacy Settings
| Feature | Status | Notes |
|---------|--------|-------|
| Privacy Level modal | ✅ | Shielded/Compliant/Transparent |
| Tap outside to dismiss | ✅ | All modals support this |
| "Recommended" badge on Shielded | ✅ | Visual indicator |
| Selection persists | ✅ | AsyncStorage |

### 8.7 Privacy Score Screen
| Feature | Status | Notes |
|---------|--------|-------|
| Overall score (0-100) | ✅ | Color-coded display |
| Shielded ratio | ✅ | Percentage |
| Linkability risk | ✅ | Low/Medium/High |
| Address reuse count | ✅ | Detection |
| Recommendations list | ✅ | Actionable tips |

### 8.8 Compliance Dashboard
| Feature | Status | Notes |
|---------|--------|-------|
| Institution-ready branding | ✅ | Hero section |
| Compliant tx stats | ✅ | Count shown |
| Active disclosures | ✅ | Count shown |
| Link to Viewing Keys | ✅ | Navigation works |
| Coming soon features | ✅ | Disabled state |

### 8.9 Network Settings
| Feature | Status | Notes |
|---------|--------|-------|
| Network selector modal | ✅ | Mainnet/Devnet/Testnet |
| Test network warning | ✅ | Yellow banner |
| Selection persists | ✅ | AsyncStorage |
| Tap outside to dismiss | ✅ | UX improvement |

### 8.10 RPC Provider Settings
| Feature | Status | Notes |
|---------|--------|-------|
| Provider selector modal | ✅ | 4 options |
| Helius (default) | ✅ | Requires EXPO_PUBLIC_SIP_MOBILE_HELIUS_API_KEY |
| QuickNode (BYOK) | ✅ | API key input |
| Triton (BYOK) | ✅ | Endpoint input |
| PublicNode (fallback) | ✅ | Free public RPC |
| Tap outside to dismiss | ✅ | UX improvement |

### 8.11 Data & Storage
| Feature | Status | Notes |
|---------|--------|-------|
| Clear Payment History | ✅ | With confirmation |
| Clear Swap History | ✅ | With confirmation |
| Record counts shown | ✅ | Before clearing |

### 8.12 About Section
| Feature | Status | Notes |
|---------|--------|-------|
| About SIP modal | ✅ | App info, version |
| Website link | ✅ | Opens sip-protocol.org |
| Twitter/X link | ✅ | Opens profile |
| GitHub link | ✅ | Opens repo |
| Documentation link | ✅ | Opens docs site |
| Report Issue link | ✅ | Opens GitHub issues |
| Tap outside to dismiss | ✅ | UX improvement |

---

## 9. COMPLIANCE

### 9.1 Dashboard
| Feature | Status | Notes |
|---------|--------|-------|
| Institution Ready hero | ✅ | Wallet address, SIP compliance description |
| Quick stats (4 cards) | ✅ | Compliant: 0 txs, Disclosures: 0 keys, Compliance: 0%, Viewing Keys: 0 |
| Manage Viewing Keys | ✅ | Navigates to Viewing Keys screen correctly |
| Export Audit Report | ✅ | "Soon" badge (coming soon) |
| Disclosure Policies | ✅ | "Soon" badge (coming soon) |
| Auditor Integration | ✅ | "Soon" badge (coming soon) |
| Privacy + Compliance info | ✅ | Educational card at bottom |

### 9.2 Audit Trail
| Feature | Status | Notes |
|---------|--------|-------|
| Event list | 🔲 | Not a separate screen yet (coming soon) |
| Filter by type | 🔲 | Part of Export Audit Report (coming soon) |
| Event detail modal | 🔲 | Coming soon |
| Clear trail | 🔲 | Coming soon |

### 9.3 Disclosures
| Feature | Status | Notes |
|---------|--------|-------|
| Active disclosures | 🔲 | Via Viewing Keys → History tab (0 items) |
| Expired disclosures | 🔲 | No disclosures to test |
| Revoked disclosures | 🔲 | No disclosures to test |
| Detail view | 🔲 | No disclosures to test |
| Revoke action | 🔲 | No disclosures to test |

### 9.4 Report Generation
| Feature | Status | Notes |
|---------|--------|-------|
| Date range selection | 🔲 | "Soon" — not yet implemented |
| Data toggles | 🔲 | "Soon" — not yet implemented |
| Generate button | 🔲 | "Soon" — not yet implemented |
| Export/share | 🔲 | "Soon" — not yet implemented |
| Report history | 🔲 | "Soon" — not yet implemented |

---

## 10. HISTORY

### 10.1 Transaction List
| Feature | Status | Notes |
|---------|--------|-------|
| All transactions shown | ✅ | "0 transactions" with empty state |
| Filter by type | ✅ | All / Sent / Received chips |
| Filter by status | ✅ | All Status / Pending / Completed |
| Filter by privacy | ✅ | All Privacy / Private (🛡) / Compliant (🔒) |
| Search | ✅ | "Search by tx hash or address" |
| Empty state | ✅ | "No Transactions — Your transaction history will appear here" |

### 10.2 Transaction Detail
| Feature | Status | Notes |
|---------|--------|-------|
| Full details shown | 🔲 | All fields |
| View on Explorer | 🔲 | Link works |
| Share transaction | 🔲 | Share sheet |
| Claim button (if pending) | 🔲 | For received |

---

## 11. ERROR STATES

| Scenario | Status | Notes |
|----------|--------|-------|
| No internet connection | 🔲 | Graceful message |
| RPC timeout | 🔲 | Retry option |
| Invalid recipient | 🔲 | Clear error |
| Insufficient balance | 🔲 | Shows needed amount |
| Transaction failed | 🔲 | Reason shown |
| Biometric failed | 🔲 | PIN fallback |
| Quote fetch failed | 🔲 | Retry option |

---

## 12. LOADING STATES

| Screen | Status | Notes |
|--------|--------|-------|
| Home balance loading | 🔲 | Skeleton/spinner |
| Send confirmation | 🔲 | Progress shown |
| Receive QR generating | 🔲 | Loading indicator |
| Scan in progress | 🔲 | Progress bar |
| Claim processing | 🔲 | Step indicator |
| Swap executing | 🔲 | 3-step progress |
| History loading | 🔲 | Skeleton |

---

## 13. EMPTY STATES

| Screen | Status | Notes |
|--------|--------|-------|
| Home - no transactions | ✅ | "No transactions yet — Send or receive to see activity here" |
| History - no transactions | ✅ | "No Transactions — Your transaction history will appear here" |
| Scan - no payments found | ✅ | "No New Payments" with green checkmark, "Scanned 10 announcements" |
| Claim - nothing to claim | 🔲 | No claim screen accessible (no unclaimed payments) |
| Swap history - empty | ✅ | "No Swap History" with "Make a Swap" CTA |

---

## BUGS FOUND

| # | Screen | Description | Severity | Status |
|---|--------|-------------|----------|--------|
| 1 | Accounts | "+ Add Another Account" errors with "Wallet already exists" — no multi-account support | Medium | Open |
| 2 | Settings | No dedicated Backup/Seed Phrase screen to reveal stored mnemonic | Medium | Open |
| 3 | | | | |

---

## TESTING NOTES

**Device:** Seeker (Solana Mobile)
**ADB Scale Factor:** 3.34× (1200×2670 → 359×800)
**Network:** Mainnet (changed from Devnet)
**Build:** v0.1.7

**Session Log:**
- [x] Session 1: Onboarding (1.1) — **2026-03-05** ✅ All 5 slides verified via ADB
- [x] Session 2: Home & Send (2.x, 3.x) — **2026-03-05** ✅ UI verified
- [x] Session 3: Receive (4.x) — **2026-03-05** ✅ Stealth address + QR + tabs
- [x] Session 4: Scan (5.x) — **2026-03-05** ✅ Scan flow, empty state, timestamps verified
- [x] Session 5: Settings (8.x) — **2026-01-28** ✅ ALL 13 ITEMS WORKING
- [x] Session 6: Swap (7.x) — **2026-03-05** ✅ Full swap UI verified
- [x] Session 7: History (10.x, 13.x) — **2026-03-05** ✅ Filters + empty states
- [x] Session 8: Compliance (9.x) — **2026-03-05** ✅ Dashboard, stats, Viewing Keys nav, coming soon features
- [x] Session 9: Wallet/Security/Viewing Keys (1.2, 8.1-8.5) — **2026-03-06** ✅ Accounts, Security, Viewing Keys verified
- [ ] Session 10: Error/Loading States (11.x, 12.x) — requires balance to test

---

## SESSION: 2026-01-28 (Settings)

**Settings Tab: 100% Complete**

| Category | Items | Status |
|----------|-------|--------|
| WALLET | Accounts, Viewing Keys, Security | ✅ All 3 working |
| PRIVACY | Privacy Level, Privacy Score, Compliance | ✅ All 3 working |
| NETWORK | Network, RPC Provider | ✅ All 2 working |
| DATA & STORAGE | Clear Payment/Swap History | ✅ All 2 working |
| ABOUT | About SIP, Docs, Report Issue | ✅ All 3 working |

---

## SESSION: 2026-03-05 (v0.1.7 — Full UI Pass)

**Build:** v0.1.7 (fresh install on Seeker)
**Network:** Mainnet
**Method:** ADB wireless + screencap + uiautomator

**Sections Verified:**

| Section | Status | Notes |
|---------|--------|-------|
| 2. Home Tab | ✅ | Balance, USD, network badge, copy addr, quick actions, empty state |
| 3. Send Tab | ✅ | Amount, MAX, recipient, Scan QR, Contacts, Privacy Level, Provider badge |
| 4. Receive Tab | ✅ | Stealth addr generated, QR, copy, share, new addr, request amount tab |
| 7. Swap Tab | ✅ | Token selectors, direction flip, settings (slippage), privacy toggle, history |
| 8. Settings | ✅ | Full settings visible, v0.1.7 confirmed, Default Explorer: Solscan |
| 10. History | ✅ | Search, type/status/privacy filters, empty state |
| 13. Empty States | ✅ | Home, History, Swap History all show proper messages |

**New Features Since v0.1.4:**
- Privacy Provider selector (SIP Native)
- Contacts button on Send tab
- Default Explorer setting (Solscan)
- Background Scanning toggle
- Reset Onboarding option
- Featured Tokens section (SOL + SKR)
- Privacy filter on History (Private/Compliant)
- Import Custom Token on Swap

**Not Tested (requires balance/interaction):**
- Quote display, swap execution (0 balance)
- Send confirmation/execution (0 balance)
- Scan/Claim screens (no payments)
- Onboarding (requires app reset)
- Error/loading states

**Bugs Found:** None

---

**Last Updated:** 2026-03-06 14:00
