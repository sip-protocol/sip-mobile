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
| Onboarding slides (3 screens) | 🔲 | Animations, swipe, skip |
| "Get Started" button | 🔲 | Navigates to wallet-setup |

### 1.2 Wallet Setup
| Feature | Status | Notes |
|---------|--------|-------|
| Create New Wallet | 🔲 | BIP39 mnemonic generation |
| Import Seed Phrase | 🔲 | 12/24 word validation |
| Import Private Key | 🔲 | Base58 validation |
| Biometric setup prompt | 🔲 | Face ID / Fingerprint |

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
| Send button → Send tab | 🔲 | Navigation works |
| Receive button → Receive tab | 🔲 | Navigation works |
| Scan button → Scan screen | 🔲 | Navigation works |
| Keys button → Viewing Keys | 🔲 | Navigation works |

### 2.3 Recent Activity
| Feature | Status | Notes |
|---------|--------|-------|
| Shows recent transactions | 🔲 | Last 5 items |
| Tap transaction → Detail | 🔲 | Navigation works |
| "View All" → History | 🔲 | Navigation works |
| Empty state (no txs) | 🔲 | Proper message |

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
| Numeric keypad input | 🔲 | Works correctly |
| Decimal handling | 🔲 | Max 9 decimals |
| MAX button | 🔲 | Sets max balance |
| USD conversion display | 🔲 | If price available |

### 3.2 Recipient Input
| Feature | Status | Notes |
|---------|--------|-------|
| Paste address | 🔲 | Clipboard works |
| QR scan button | 🔲 | Opens camera |
| Stealth address detection | 🔲 | Shows privacy badge |
| Invalid address error | 🔲 | Validation message |
| Solana address validation | 🔲 | Base58 check |

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
| Address generated on load | 🔲 | Auto-generate |
| QR code displays | 🔲 | Scannable |
| Address text visible | 🔲 | Truncated format |
| Loading state | 🔲 | While generating |

### 4.2 Actions
| Feature | Status | Notes |
|---------|--------|-------|
| Copy button | 🔲 | Copies to clipboard |
| Share button | 🔲 | Opens share sheet |
| New Address button | 🔲 | Shows confirmation |
| Regenerate confirmation | 🔲 | Modal appears |
| Block if unclaimed | 🔲 | Error toast if pending |

### 4.3 Request Amount Tab
| Feature | Status | Notes |
|---------|--------|-------|
| Amount input field | 🔲 | Numeric input |
| QR updates with amount | 🔲 | ?amount=X appended |
| Copy includes amount | 🔲 | Full URI copied |

### 4.4 Scan Link
| Feature | Status | Notes |
|---------|--------|-------|
| "Scan for Payments" button | 🔲 | Navigation to scan |

---

## 5. SCAN SCREEN

### 5.1 Scanning
| Feature | Status | Notes |
|---------|--------|-------|
| Scan button starts scan | 🔲 | Progress indicator |
| Progress percentage | 🔲 | Updates during scan |
| Cancel button | 🔲 | Stops scan |
| Last scan time display | 🔲 | Shows timestamp |

### 5.2 Results
| Feature | Status | Notes |
|---------|--------|-------|
| Found payments list | 🔲 | Shows count, amounts |
| "No new payments" state | 🔲 | Proper message |
| Tap payment → Claim | 🔲 | Navigation works |
| "Claim All" button | 🔲 | Multi-select claim |

### 5.3 Unclaimed Banner
| Feature | Status | Notes |
|---------|--------|-------|
| Shows if unclaimed exist | 🔲 | Even with no new |
| Count accurate | 🔲 | Matches store |
| Tap → Claim screen | 🔲 | Navigation works |

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
| "From" token selector | 🔲 | Opens token list |
| "To" token selector | 🔲 | Opens token list |
| Swap direction button | 🔲 | Flips from/to |
| Token balances shown | 🔲 | Available amounts |

### 7.2 Token Selector Screen
| Feature | Status | Notes |
|---------|--------|-------|
| Search by name | 🔲 | Filters list |
| Search by symbol | 🔲 | Filters list |
| Recent tokens section | 🔲 | Persisted |
| Popular tokens chips | 🔲 | Quick select |
| Token icons load | 🔲 | Or fallback |

### 7.3 Quote Display
| Feature | Status | Notes |
|---------|--------|-------|
| Quote fetches on input | 🔲 | Auto-refresh |
| Rate displayed | 🔲 | X per Y format |
| Price impact shown | 🔲 | Percentage |
| Freshness indicator | 🔲 | Countdown timer |
| Refresh button | 🔲 | Manual refresh |
| Quote error state | 🔲 | User message |

### 7.4 Swap Settings
| Feature | Status | Notes |
|---------|--------|-------|
| Slippage button | 🔲 | Opens modal |
| Preset options (0.5, 1, 3%) | 🔲 | Quick select |
| Custom slippage input | 🔲 | Manual entry |
| Save settings | 🔲 | Persists |

### 7.5 Privacy Toggle
| Feature | Status | Notes |
|---------|--------|-------|
| "Private Swap" toggle | 🔲 | ON/OFF |
| Privacy badge when ON | 🔲 | Visual indicator |

### 7.6 Swap Execution
| Feature | Status | Notes |
|---------|--------|-------|
| Swap button enabled | 🔲 | When valid quote |
| Confirmation modal | 🔲 | Shows details |
| Biometric prompt | 🔲 | Before execute |
| Progress steps | 🔲 | 3-step indicator |
| Success modal | 🔲 | TX shown |
| Error handling | 🔲 | User message |

### 7.7 Swap History
| Feature | Status | Notes |
|---------|--------|-------|
| History button | 🔲 | Opens history |
| Filter by status | 🔲 | All/Pending/Done/Failed |
| Swap detail modal | 🔲 | Full info |
| View on Explorer | 🔲 | Link works |
| Clear history | 🔲 | With confirmation |

---

## 8. SETTINGS TAB

### 8.1 Account Section
| Feature | Status | Notes |
|---------|--------|-------|
| Current wallet shown | 🔲 | Address truncated |
| Accounts button | 🔲 | Opens accounts |
| Backup button | 🔲 | Opens backup |

### 8.2 Accounts Screen
| Feature | Status | Notes |
|---------|--------|-------|
| List all accounts | 🔲 | With addresses |
| Switch account | 🔲 | Tap to switch |
| Add account | 🔲 | Create/Import |
| Delete account | 🔲 | With confirmation |

### 8.3 Backup Screen
| Feature | Status | Notes |
|---------|--------|-------|
| Biometric to reveal | 🔲 | Required |
| Seed phrase shown | 🔲 | 12/24 words |
| Copy phrase | 🔲 | To clipboard |
| Warning message | 🔲 | Security notice |

### 8.4 Viewing Keys
| Feature | Status | Notes |
|---------|--------|-------|
| Export tab | 🔲 | Generate key |
| Expiry selection | 🔲 | 7/30/90 days |
| Copy key | 🔲 | To clipboard |
| Record disclosure | 🔲 | Modal form |
| History tab | 🔲 | All disclosures |
| Revoke disclosure | 🔲 | Changes status |
| Imported tab | 🔲 | External keys |

### 8.5 Security Settings
| Feature | Status | Notes |
|---------|--------|-------|
| Biometric toggle | 🔲 | Enable/disable |
| PIN backup toggle | 🔲 | If bio fails |
| Auto-lock timeout | 🔲 | Selection works |
| Hide balance toggle | 🔲 | Privacy feature |

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
| Helius (default) | ✅ | Free tier embedded |
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
| Privacy score display | 🔲 | Percentage |
| Score breakdown | 🔲 | Category bars |
| Quick stats | 🔲 | Counts shown |
| Quick actions | 🔲 | Navigation links |

### 9.2 Audit Trail
| Feature | Status | Notes |
|---------|--------|-------|
| Event list | 🔲 | Chronological |
| Filter by type | 🔲 | All/Keys/Tx/Reports |
| Event detail modal | 🔲 | Full info |
| Clear trail | 🔲 | With confirmation |

### 9.3 Disclosures
| Feature | Status | Notes |
|---------|--------|-------|
| Active disclosures | 🔲 | List view |
| Expired disclosures | 🔲 | Filter option |
| Revoked disclosures | 🔲 | Filter option |
| Detail view | 🔲 | Full info |
| Revoke action | 🔲 | Status change |

### 9.4 Report Generation
| Feature | Status | Notes |
|---------|--------|-------|
| Date range selection | 🔲 | 7/30/90/All |
| Data toggles | 🔲 | Tx/Disc/Audit |
| Generate button | 🔲 | Creates JSON |
| Export/share | 🔲 | Share sheet |
| Report history | 🔲 | Past reports |

---

## 10. HISTORY

### 10.1 Transaction List
| Feature | Status | Notes |
|---------|--------|-------|
| All transactions shown | 🔲 | Chronological |
| Filter by type | 🔲 | Send/Receive/Swap |
| Filter by status | 🔲 | Pending/Done/Failed |
| Search | 🔲 | By address/amount |
| Pull-to-refresh | 🔲 | Updates list |

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
| Home - no transactions | 🔲 | Helpful message |
| History - no transactions | 🔲 | "No activity yet" |
| Scan - no payments found | 🔲 | "All caught up" |
| Claim - nothing to claim | 🔲 | Redirect or message |
| Swap history - empty | 🔲 | "No swaps yet" |

---

## BUGS FOUND

| # | Screen | Description | Severity | Status |
|---|--------|-------------|----------|--------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

---

## TESTING NOTES

**Device:** Seeker (Solana Mobile)
**ADB Scale Factor:** 3.34× (1200×2670 → 359×800)
**Network:** Devnet
**Build:** v0.1.4

**Session Log:**
- [ ] Session 1: Onboarding & Auth (1.x)
- [ ] Session 2: Home & Send (2.x, 3.x)
- [ ] Session 3: Receive & Scan (4.x, 5.x)
- [ ] Session 4: Claim & Swap (6.x, 7.x)
- [x] Session 5: Settings (8.x) — **2026-01-28** ✅ ALL 13 ITEMS WORKING
- [ ] Session 6: Compliance (9.x)
- [ ] Session 7: History & Edge Cases (10.x, 11.x, 12.x, 13.x)

---

## TODAY'S SESSION (2026-01-28)

**Settings Tab: 100% Complete**

| Category | Items | Status |
|----------|-------|--------|
| WALLET | Accounts, Viewing Keys, Security | ✅ All 3 working |
| PRIVACY | Privacy Level, Privacy Score, Compliance | ✅ All 3 working |
| NETWORK | Network, RPC Provider | ✅ All 2 working |
| DATA & STORAGE | Clear Payment/Swap History | ✅ All 2 working |
| ABOUT | About SIP, Docs, Report Issue | ✅ All 3 working |

**Home Tab Improvements:**
- ✅ Network badge (Devnet/Mainnet/Testnet)
- ✅ Tap-to-copy wallet address

**Send Tab Improvements:**
- ✅ Privacy level now read-only, linked to Settings
- ✅ Single source of truth (Settings controls)

**UX Improvements:**
- ✅ All modals support tap-outside-to-dismiss

---

**Last Updated:** 2026-01-28 15:30
