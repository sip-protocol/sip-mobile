# MONOLITH Submission — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform SIP Mobile into "THE Privacy Wallet for Seeker" — audit, fix Seed Vault, add SKR token, build social payments, add privacy portfolio, polish UX, and prepare submission materials for the MONOLITH hackathon.

**Architecture:** Expo 52 / React Native 0.81.5 / NativeWind 4.0 mobile app with Zustand state management, 7 privacy provider backends (SIP Native primary), SecureStore key management, and Seed Vault hardware signing. File-based routing via Expo Router with 5 tabs (Home, Send, Receive, Swap, Settings).

**Tech Stack:** TypeScript, Expo SDK 54, React Native, NativeWind (Tailwind CSS), Zustand 5, @sip-protocol/sdk, @solana/web3.js, @solana-mobile/seed-vault-lib, Vitest, Detox

**Build:** Local only — `npx expo run:android` or `eas build --local`. Never `eas build` without `--local`.

**Device:** Seeker phone via WiFi ADB (`adb connect <IP>:5555`)

---

## Phase 1: Audit & Foundation

### Task 1: Fresh Local Build on Seeker

**Files:**
- Read: `package.json`, `app.config.js`, `eas.json`

**Step 1: Install dependencies**

Run: `cd ~/local-dev/sip-mobile && pnpm install`
Expected: Clean install, no errors

**Step 2: Run existing tests to establish baseline**

Run: `pnpm test -- --run`
Expected: 34 suites, 672 tests passing

**Step 3: Type check**

Run: `pnpm typecheck`
Expected: No type errors

**Step 4: Build local Android APK**

Run: `npx expo run:android`
Expected: APK builds successfully

**Step 5: Install on Seeker via WiFi ADB**

```bash
adb tcpip 5555
adb connect <SEEKER_IP>:5555
adb install <path-to-apk>
```
Expected: App installs and launches on Seeker

**Step 6: Document audit findings**

Walk through all 41 screens on Seeker. Create GitHub issues for:
- Crashes
- Broken flows (send, receive, swap)
- UI glitches on AMOLED
- Navigation issues
- Missing error states

Commit: `chore: document audit findings from Seeker device testing`

---

### Task 2: Fix Critical Audit Blockers

**Files:**
- Modify: Files identified in audit (Task 1)
- Test: Existing test suites

**Step 1: Triage audit issues**

Categorize issues by severity:
- P0: Crashes, broken core flows → fix immediately
- P1: UX friction, visual bugs → fix in Phase 6
- P2: Nice-to-have → backlog

**Step 2: Fix each P0 issue (one commit per fix)**

For each P0 bug:
1. Write failing test reproducing the bug
2. Run test to verify it fails
3. Fix the bug
4. Run test to verify it passes
5. Run full test suite: `pnpm test -- --run`
6. Commit: `fix: <description of fix>`

**Step 3: Verify on Seeker**

Rebuild and install: `npx expo run:android`
Walk through previously-broken flows.

Expected: All core flows (launch, navigate, send, receive, swap) work without crashes.

---

## Phase 2: Seed Vault Integration

### Task 3: Diagnose Seed Vault Codegen Issue (#70)

**Files:**
- Read: `src/hooks/useSeedVault.ts` (18KB)
- Read: `src/types/seed-vault-lib.d.ts` (7.6KB)
- Read: `metro.config.js` (55 lines)
- Read: `babel.config.js` (25 lines)
- Read: `app.config.js` (126 lines)

**Step 1: Check if @solana-mobile/seed-vault-lib resolves**

Run:
```bash
cd ~/local-dev/sip-mobile
node -e "try { require.resolve('@solana-mobile/seed-vault-lib'); console.log('FOUND') } catch(e) { console.log('NOT FOUND:', e.message) }"
```

**Step 2: Check for RN codegen issues in Metro build**

Run: `npx expo run:android 2>&1 | grep -i "seed\|codegen\|error"`

Document the exact error message.

**Step 3: Check Solana Mobile SDK compatibility**

Review `node_modules/@solana-mobile/seed-vault-lib/` for:
- Native module registration (`.java`/`.kt` files)
- React Native codegen spec files
- Version compatibility with Expo 54 / RN 0.81.5

**Step 4: Document findings**

Write diagnosis to GitHub issue #70 comment.

---

### Task 4: Fix or Work Around Seed Vault Integration

**Files:**
- Modify: `src/hooks/useSeedVault.ts`
- Modify: `metro.config.js` (if needed)
- Modify: `app.config.js` (if needed)
- Test: `tests/hooks/useSeedVault.test.ts`

**Step 1: Write test for Seed Vault availability check**

```typescript
// tests/hooks/useSeedVault.test.ts
describe('useSeedVault', () => {
  it('should detect Seed Vault availability on Seeker', async () => {
    const { result } = renderHook(() => useSeedVault())
    const available = await result.current.checkAvailability()
    expect(typeof available).toBe('boolean')
  })

  it('should gracefully handle missing Seed Vault module', () => {
    // Mock require to throw
    jest.mock('@solana-mobile/seed-vault-lib', () => {
      throw new Error('Module not found')
    })
    const { result } = renderHook(() => useSeedVault())
    expect(result.current.isAvailable).toBe(false)
    expect(result.current.error).toBeNull() // Graceful, not error
  })
})
```

**Step 2: Run test to verify it fails (or passes with existing code)**

Run: `pnpm test -- --run tests/hooks/useSeedVault.test.ts`

**Step 3: Apply fix based on diagnosis (Task 3)**

Common fixes:
- **Codegen mismatch:** Add to `app.config.js` plugins or metro.config.js resolver
- **Native module not linked:** Add `expo-build-properties` config for Android
- **Version mismatch:** Update `@solana-mobile/seed-vault-lib` version
- **Fallback needed:** Ensure conditional import in `useSeedVault.ts` handles all error cases

**Step 4: Run tests**

Run: `pnpm test -- --run tests/hooks/useSeedVault.test.ts`
Expected: PASS

**Step 5: Test on Seeker device**

```bash
npx expo run:android
# Install on Seeker, navigate to Settings → Wallet → connect via Seed Vault
```

Expected: Seed Vault option visible, tap initiates TEE prompt.

**Step 6: Commit**

```bash
git add src/hooks/useSeedVault.ts tests/hooks/useSeedVault.test.ts
# Plus any config files modified
git commit -m "fix: resolve Seed Vault codegen issue (#70)"
```

---

### Task 5: Seed Vault Wallet Flow Integration

**Files:**
- Modify: `app/(tabs)/settings.tsx` (or wallet setup screen)
- Modify: `src/stores/wallet.ts`
- Test: `tests/hooks/useSeedVault.test.ts`
- Test: `tests/stores/wallet.test.ts`

**Step 1: Write test for Seed Vault account creation**

```typescript
// tests/stores/wallet.test.ts (add to existing)
describe('Seed Vault account', () => {
  it('should add seed-vault account type', () => {
    const store = useWalletStore.getState()
    const account = store.addAccount({
      address: 'SeedVault11111111111111111111111111',
      nickname: 'Seeker Vault',
      providerType: 'seed-vault',
      chain: 'solana',
    })
    expect(account.providerType).toBe('seed-vault')
  })
})
```

**Step 2: Run test**

Run: `pnpm test -- --run tests/stores/wallet.test.ts`

**Step 3: Verify Seed Vault signing works in send/swap flows**

The `useSend` and `useSwap` hooks accept a `signTransaction` callback. Verify that `useSeedVault().signTransaction` is compatible.

**Step 4: Run full test suite**

Run: `pnpm test -- --run`
Expected: All 672+ tests pass

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: integrate Seed Vault into wallet setup and signing flows"
```

---

## Phase 3: SKR Token Integration

### Task 6: Add SKR to Token Registry

**Files:**
- Modify: `src/data/tokens.ts`
- Test: `tests/data/tokens.test.ts` (create if needed)

**Step 1: Research SKR token mint address**

Look up SKR token on Solana:
- Check Solscan / Solana FM for SKR mint address
- Verify decimals, logo URI, coingecko ID

**Step 2: Write test for SKR token in registry**

```typescript
// tests/data/tokens.test.ts
import { TOKENS } from '@/data/tokens'

describe('Token Registry', () => {
  it('should include SKR token', () => {
    expect(TOKENS.SKR).toBeDefined()
    expect(TOKENS.SKR.symbol).toBe('SKR')
    expect(TOKENS.SKR.decimals).toBeGreaterThan(0)
    expect(TOKENS.SKR.mint).toBeTruthy()
  })

  it('should have valid mint addresses for all tokens', () => {
    for (const [symbol, token] of Object.entries(TOKENS)) {
      expect(token.mint).toBeTruthy()
      expect(token.decimals).toBeGreaterThanOrEqual(0)
    }
  })
})
```

**Step 3: Run test to verify it fails**

Run: `pnpm test -- --run tests/data/tokens.test.ts`
Expected: FAIL — SKR not in TOKENS

**Step 4: Add SKR to token registry**

```typescript
// src/data/tokens.ts — add to TOKENS record
SKR: {
  symbol: 'SKR',
  name: 'Seeker',
  mint: '<SKR_MINT_ADDRESS>',  // From research
  decimals: 9,                  // From research
  logoUri: 'https://...',       // From research
  coingeckoId: 'seeker',        // From research
},
```

**Step 5: Run test to verify it passes**

Run: `pnpm test -- --run tests/data/tokens.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/data/tokens.ts tests/data/tokens.test.ts
git commit -m "feat: add SKR (Seeker) token to registry"
```

---

### Task 7: SKR Balance Display on Home Screen

**Files:**
- Modify: `app/(tabs)/index.tsx` (Home dashboard)
- Test: `tests/screens/home.test.ts` (create if needed)

**Step 1: Write test for SKR balance display**

```typescript
describe('Home Screen', () => {
  it('should display SKR balance when user holds SKR', () => {
    // Mock useBalance to return SKR balance
    // Render Home screen
    // Assert SKR appears in token list
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --run tests/screens/home.test.ts`

**Step 3: Add SKR to home screen token list**

Modify `app/(tabs)/index.tsx` to include SKR in the displayed token balances. SKR should appear alongside SOL and USDC as a featured token.

**Step 4: Run test to verify it passes**

Run: `pnpm test -- --run tests/screens/home.test.ts`

**Step 5: Run full test suite**

Run: `pnpm test -- --run`

**Step 6: Commit**

```bash
git add app/(tabs)/index.tsx tests/screens/home.test.ts
git commit -m "feat: display SKR balance on home screen"
```

---

### Task 8: SKR in Send/Receive/Swap Flows

**Files:**
- Modify: `app/(tabs)/send.tsx` — ensure SKR selectable as send token
- Modify: `app/(tabs)/receive.tsx` — ensure SKR in receive token options
- Modify: `app/(tabs)/swap.tsx` — ensure SKR appears in swap token picker
- Test: relevant test files

**Step 1: Write tests for SKR in each flow**

```typescript
describe('Send Screen', () => {
  it('should allow selecting SKR as send token', () => { /* ... */ })
})

describe('Swap Screen', () => {
  it('should show SKR in token picker', () => { /* ... */ })
  it('should allow swapping SOL → SKR with privacy', () => { /* ... */ })
})
```

**Step 2: Run tests — verify failures**

**Step 3: Implement SKR support in each flow**

Since the token picker likely reads from `TOKENS`, adding SKR to the registry (Task 6) may already make it available. Verify and fix any filtering that excludes it.

**Step 4: Run tests — verify passes**

**Step 5: Test on Seeker**

Rebuild, install, verify SKR appears in send/receive/swap token pickers.

**Step 6: Commit**

```bash
git add app/(tabs)/send.tsx app/(tabs)/receive.tsx app/(tabs)/swap.tsx
git commit -m "feat: SKR token support in send, receive, and swap flows"
```

---

## Phase 4: Private Social Payments

### Task 9: Contact Store

**Files:**
- Create: `src/stores/contacts.ts`
- Create: `src/types/contacts.ts`
- Create: `tests/stores/contacts.test.ts`

**Step 1: Define contact types**

```typescript
// src/types/contacts.ts
export interface Contact {
  id: string                    // contact_<timestamp>_<random>
  name: string                  // Display name
  address: string               // Solana address or stealth address
  stealthMeta?: string          // SIP stealth meta-address (sip:solana:...)
  avatarUri?: string            // Optional avatar
  chain: ChainType
  createdAt: number
  lastPaymentAt: number | null
  paymentCount: number
  isFavorite: boolean
}

export interface ContactsState {
  contacts: Contact[]
  addContact(input: Omit<Contact, 'id' | 'createdAt' | 'lastPaymentAt' | 'paymentCount'>): Contact
  removeContact(id: string): void
  updateContact(id: string, updates: Partial<Contact>): void
  getContactByAddress(address: string): Contact | undefined
  getFavorites(): Contact[]
  recordPayment(contactId: string): void
}
```

**Step 2: Write failing tests**

```typescript
// tests/stores/contacts.test.ts
import { useContactsStore } from '@/stores/contacts'

describe('ContactsStore', () => {
  beforeEach(() => useContactsStore.getState().contacts = [])

  it('should add a contact', () => {
    const store = useContactsStore.getState()
    const contact = store.addContact({
      name: 'Alice',
      address: 'Alice11111111111111111111111111111',
      chain: 'solana',
      isFavorite: false,
    })
    expect(contact.id).toMatch(/^contact_/)
    expect(contact.name).toBe('Alice')
    expect(store.contacts).toHaveLength(1)
  })

  it('should find contact by address', () => {
    const store = useContactsStore.getState()
    store.addContact({
      name: 'Bob',
      address: 'Bob11111111111111111111111111111111',
      chain: 'solana',
      isFavorite: false,
    })
    const found = store.getContactByAddress('Bob11111111111111111111111111111111')
    expect(found?.name).toBe('Bob')
  })

  it('should record payment and update lastPaymentAt', () => {
    const store = useContactsStore.getState()
    const contact = store.addContact({
      name: 'Charlie',
      address: 'Charlie1111111111111111111111111111',
      chain: 'solana',
      isFavorite: false,
    })
    store.recordPayment(contact.id)
    const updated = store.contacts.find(c => c.id === contact.id)
    expect(updated?.paymentCount).toBe(1)
    expect(updated?.lastPaymentAt).toBeGreaterThan(0)
  })

  it('should remove a contact', () => {
    const store = useContactsStore.getState()
    const contact = store.addContact({
      name: 'Dave',
      address: 'Dave111111111111111111111111111111',
      chain: 'solana',
      isFavorite: false,
    })
    store.removeContact(contact.id)
    expect(store.contacts).toHaveLength(0)
  })

  it('should persist contacts to AsyncStorage', () => {
    // Verify zustand persist middleware
  })
})
```

**Step 3: Run tests — verify failures**

Run: `pnpm test -- --run tests/stores/contacts.test.ts`
Expected: FAIL — module not found

**Step 4: Implement contacts store**

```typescript
// src/stores/contacts.ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Contact, ContactsState } from '@/types/contacts'

export const useContactsStore = create<ContactsState>()(
  persist(
    (set, get) => ({
      contacts: [],

      addContact(input) {
        const contact: Contact = {
          ...input,
          id: `contact_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          createdAt: Date.now(),
          lastPaymentAt: null,
          paymentCount: 0,
        }
        set(state => ({ contacts: [...state.contacts, contact] }))
        return contact
      },

      removeContact(id) {
        set(state => ({
          contacts: state.contacts.filter(c => c.id !== id),
        }))
      },

      updateContact(id, updates) {
        set(state => ({
          contacts: state.contacts.map(c =>
            c.id === id ? { ...c, ...updates } : c
          ),
        }))
      },

      getContactByAddress(address) {
        return get().contacts.find(c => c.address === address)
      },

      getFavorites() {
        return get().contacts.filter(c => c.isFavorite)
      },

      recordPayment(contactId) {
        set(state => ({
          contacts: state.contacts.map(c =>
            c.id === contactId
              ? { ...c, paymentCount: c.paymentCount + 1, lastPaymentAt: Date.now() }
              : c
          ),
        }))
      },
    }),
    {
      name: 'sip-contacts-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)
```

**Step 5: Run tests — verify passes**

Run: `pnpm test -- --run tests/stores/contacts.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/stores/contacts.ts src/types/contacts.ts tests/stores/contacts.test.ts
git commit -m "feat: add contacts store with persistence"
```

---

### Task 10: Contact List Screen

**Files:**
- Create: `app/contacts/index.tsx`
- Create: `app/contacts/_layout.tsx`
- Create: `app/contacts/add.tsx`
- Create: `tests/screens/contacts.test.ts`

**Step 1: Write test for contact list rendering**

```typescript
// tests/screens/contacts.test.ts
describe('Contacts Screen', () => {
  it('should render contact list', () => { /* ... */ })
  it('should show empty state when no contacts', () => { /* ... */ })
  it('should navigate to add contact', () => { /* ... */ })
  it('should show contact name and address', () => { /* ... */ })
})
```

**Step 2: Run test — verify failure**

**Step 3: Implement contact list screen**

- List all contacts sorted by `lastPaymentAt` (recent first)
- Show name, truncated address, payment count
- "Add Contact" button at top
- Tap contact → navigate to send screen with pre-filled recipient
- Swipe to delete

**Step 4: Implement add contact screen**

- Name input (required)
- Address input (required, validate Solana address or stealth meta-address)
- Chain selector (default: solana)
- Favorite toggle
- Save button

**Step 5: Run tests — verify passes**

Run: `pnpm test -- --run tests/screens/contacts.test.ts`

**Step 6: Commit**

```bash
git add app/contacts/ tests/screens/contacts.test.ts
git commit -m "feat: add contact list and add contact screens"
```

---

### Task 11: "Pay Contact" Flow

**Files:**
- Modify: `app/(tabs)/send.tsx`
- Modify: `app/contacts/index.tsx`
- Test: `tests/screens/send.test.ts`

**Step 1: Write test for contact-based sending**

```typescript
describe('Send to Contact', () => {
  it('should pre-fill recipient from contact', () => { /* ... */ })
  it('should show contact name instead of raw address', () => { /* ... */ })
  it('should record payment to contact after success', () => { /* ... */ })
})
```

**Step 2: Run test — verify failure**

**Step 3: Implement contact-based send**

- Add "Pay" button on contact list items
- Navigate to send screen with `?recipient=<address>&name=<name>` params
- Send screen reads params and pre-fills recipient
- Display contact name above address field
- On successful send, call `contactsStore.recordPayment(contactId)`

**Step 4: Run tests — verify passes**

**Step 5: Commit**

```bash
git add app/(tabs)/send.tsx app/contacts/index.tsx tests/screens/send.test.ts
git commit -m "feat: pay contact flow with name display and payment tracking"
```

---

### Task 12: Payment Request Generation

**Files:**
- Create: `src/utils/paymentRequest.ts`
- Create: `tests/utils/paymentRequest.test.ts`
- Modify: `app/(tabs)/receive.tsx`

**Step 1: Write test for payment request URL generation**

```typescript
// tests/utils/paymentRequest.test.ts
import { createPaymentRequest, parsePaymentRequest } from '@/utils/paymentRequest'

describe('Payment Request', () => {
  it('should create a shareable payment request URL', () => {
    const url = createPaymentRequest({
      stealthAddress: 'sip:solana:0x02abc...123:0x03def...456',
      amount: '1.5',
      token: 'SOL',
      memo: 'Coffee',
    })
    expect(url).toContain('sipprotocol://')
    expect(url).toContain('amount=1.5')
  })

  it('should parse a payment request URL', () => {
    const url = 'sipprotocol://pay?address=sip:solana:...&amount=1.5&token=SOL&memo=Coffee'
    const request = parsePaymentRequest(url)
    expect(request.amount).toBe('1.5')
    expect(request.token).toBe('SOL')
    expect(request.memo).toBe('Coffee')
  })

  it('should handle request without amount (open request)', () => {
    const url = createPaymentRequest({
      stealthAddress: 'sip:solana:0x02abc...123:0x03def...456',
    })
    const parsed = parsePaymentRequest(url)
    expect(parsed.amount).toBeUndefined()
  })
})
```

**Step 2: Run test — verify failure**

**Step 3: Implement payment request utility**

```typescript
// src/utils/paymentRequest.ts
export interface PaymentRequestParams {
  stealthAddress: string
  amount?: string
  token?: string
  memo?: string
}

export function createPaymentRequest(params: PaymentRequestParams): string {
  const url = new URL('sipprotocol://pay')
  url.searchParams.set('address', params.stealthAddress)
  if (params.amount) url.searchParams.set('amount', params.amount)
  if (params.token) url.searchParams.set('token', params.token)
  if (params.memo) url.searchParams.set('memo', params.memo)
  return url.toString()
}

export function parsePaymentRequest(url: string): PaymentRequestParams {
  const parsed = new URL(url)
  return {
    stealthAddress: parsed.searchParams.get('address') || '',
    amount: parsed.searchParams.get('amount') || undefined,
    token: parsed.searchParams.get('token') || undefined,
    memo: parsed.searchParams.get('memo') || undefined,
  }
}
```

**Step 4: Run test — verify passes**

**Step 5: Add "Request Payment" UI to receive screen**

Modify `app/(tabs)/receive.tsx`:
- Add amount input field (optional)
- Add token selector (default: SOL)
- Add memo field (optional)
- Generate QR code from payment request URL
- Share button (expo-sharing)

**Step 6: Run full tests**

Run: `pnpm test -- --run`

**Step 7: Commit**

```bash
git add src/utils/paymentRequest.ts tests/utils/paymentRequest.test.ts app/(tabs)/receive.tsx
git commit -m "feat: payment request generation with QR code and sharing"
```

---

## Phase 5: Privacy-First Token Portfolio

### Task 13: Privacy Score Calculator

**Files:**
- Create: `src/utils/privacyScore.ts`
- Create: `tests/utils/privacyScore.test.ts`

**Step 1: Write tests for privacy score calculation**

```typescript
// tests/utils/privacyScore.test.ts
import { calculateTokenPrivacyScore, calculateWalletPrivacyScore } from '@/utils/privacyScore'

describe('Privacy Score', () => {
  it('should return 100 for fully shielded token', () => {
    const score = calculateTokenPrivacyScore({
      totalTransactions: 10,
      shieldedTransactions: 10,
      hasStealthAddress: true,
      balanceExposed: false,
    })
    expect(score).toBe(100)
  })

  it('should return 0 for fully transparent token', () => {
    const score = calculateTokenPrivacyScore({
      totalTransactions: 10,
      shieldedTransactions: 0,
      hasStealthAddress: false,
      balanceExposed: true,
    })
    expect(score).toBe(0)
  })

  it('should calculate partial privacy score', () => {
    const score = calculateTokenPrivacyScore({
      totalTransactions: 10,
      shieldedTransactions: 5,
      hasStealthAddress: true,
      balanceExposed: true,
    })
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(100)
  })

  it('should calculate aggregate wallet privacy score', () => {
    const score = calculateWalletPrivacyScore([
      { symbol: 'SOL', score: 80, balanceUsd: 100 },
      { symbol: 'USDC', score: 20, balanceUsd: 100 },
    ])
    expect(score).toBe(50) // Weighted average by USD value
  })
})
```

**Step 2: Run test — verify failure**

Run: `pnpm test -- --run tests/utils/privacyScore.test.ts`

**Step 3: Implement privacy score calculator**

```typescript
// src/utils/privacyScore.ts
export interface TokenPrivacyInput {
  totalTransactions: number
  shieldedTransactions: number
  hasStealthAddress: boolean
  balanceExposed: boolean
}

export function calculateTokenPrivacyScore(input: TokenPrivacyInput): number {
  let score = 0
  const weights = {
    transactionPrivacy: 40,   // % of transactions shielded
    stealthAddress: 30,       // Has stealth address set up
    balancePrivacy: 30,       // Balance not publicly linked
  }

  // Transaction privacy (40%)
  if (input.totalTransactions > 0) {
    score += (input.shieldedTransactions / input.totalTransactions) * weights.transactionPrivacy
  } else {
    score += weights.transactionPrivacy // No transactions = no exposure
  }

  // Stealth address (30%)
  if (input.hasStealthAddress) score += weights.stealthAddress

  // Balance privacy (30%)
  if (!input.balanceExposed) score += weights.balancePrivacy

  return Math.round(score)
}

export interface TokenScoreEntry {
  symbol: string
  score: number
  balanceUsd: number
}

export function calculateWalletPrivacyScore(tokens: TokenScoreEntry[]): number {
  const totalUsd = tokens.reduce((sum, t) => sum + t.balanceUsd, 0)
  if (totalUsd === 0) return 100 // Empty wallet = nothing exposed

  const weightedScore = tokens.reduce(
    (sum, t) => sum + (t.score * t.balanceUsd) / totalUsd,
    0
  )
  return Math.round(weightedScore)
}
```

**Step 4: Run test — verify passes**

Run: `pnpm test -- --run tests/utils/privacyScore.test.ts`

**Step 5: Commit**

```bash
git add src/utils/privacyScore.ts tests/utils/privacyScore.test.ts
git commit -m "feat: privacy score calculator with per-token and aggregate scoring"
```

---

### Task 14: Portfolio Store

**Files:**
- Create: `src/stores/portfolio.ts`
- Create: `tests/stores/portfolio.test.ts`

**Step 1: Write failing tests for portfolio store**

```typescript
// tests/stores/portfolio.test.ts
import { usePortfolioStore } from '@/stores/portfolio'

describe('Portfolio Store', () => {
  beforeEach(() => {
    usePortfolioStore.setState({ tokens: [], lastUpdated: null })
  })

  it('should store token balances with privacy scores', () => {
    const store = usePortfolioStore.getState()
    store.updateTokens([
      { symbol: 'SOL', balance: '10.5', balanceUsd: 1050, privacyScore: 45, mint: 'So11...' },
      { symbol: 'SKR', balance: '1000', balanceUsd: 500, privacyScore: 80, mint: 'SKR...' },
    ])
    expect(store.tokens).toHaveLength(2)
    expect(store.tokens[0].privacyScore).toBe(45)
  })

  it('should calculate aggregate wallet privacy score', () => {
    const store = usePortfolioStore.getState()
    store.updateTokens([
      { symbol: 'SOL', balance: '10', balanceUsd: 1000, privacyScore: 60, mint: 'So11...' },
      { symbol: 'USDC', balance: '500', balanceUsd: 500, privacyScore: 30, mint: 'EPj...' },
    ])
    const aggregate = store.getAggregateScore()
    // Weighted: (60*1000 + 30*500) / 1500 = 50
    expect(aggregate).toBe(50)
  })

  it('should sort tokens by USD value (highest first)', () => {
    const store = usePortfolioStore.getState()
    store.updateTokens([
      { symbol: 'USDC', balance: '100', balanceUsd: 100, privacyScore: 20, mint: 'EPj...' },
      { symbol: 'SOL', balance: '10', balanceUsd: 1000, privacyScore: 60, mint: 'So11...' },
    ])
    const sorted = store.getTokensSortedByValue()
    expect(sorted[0].symbol).toBe('SOL')
  })
})
```

**Step 2: Run test — verify failure**

**Step 3: Implement portfolio store**

**Step 4: Run test — verify passes**

**Step 5: Commit**

```bash
git add src/stores/portfolio.ts tests/stores/portfolio.test.ts
git commit -m "feat: portfolio store with privacy scores and sorting"
```

---

### Task 15: Portfolio Screen

**Files:**
- Create: `app/portfolio/index.tsx`
- Create: `app/portfolio/_layout.tsx`
- Create: `src/components/PrivacyScoreBadge.tsx`
- Create: `tests/components/PrivacyScoreBadge.test.ts`

**Step 1: Write test for PrivacyScoreBadge component**

```typescript
describe('PrivacyScoreBadge', () => {
  it('should render score with color coding', () => {
    // 0-33: red, 34-66: yellow, 67-100: green
  })
  it('should show "Shield" action button when score < 67', () => { /* ... */ })
})
```

**Step 2: Run test — verify failure**

**Step 3: Implement PrivacyScoreBadge**

Small component showing a circular progress indicator with the privacy score number inside, color-coded:
- 0-33: Red (exposed)
- 34-66: Yellow (partial)
- 67-100: Green (shielded)

**Step 4: Implement Portfolio screen**

- Header: Aggregate wallet privacy score (large circular badge)
- Subheader: "Your wallet is X% private"
- Token list: Each row shows token icon, name, balance, USD value, privacy score badge
- "Shield" button on tokens with score < 67
- SKR token featured/highlighted (if balance > 0)

**Step 5: Run tests**

Run: `pnpm test -- --run`

**Step 6: Add portfolio access from Home tab**

Add a "Privacy Portfolio" card/button on `app/(tabs)/index.tsx` that navigates to `/portfolio`.

**Step 7: Commit**

```bash
git add app/portfolio/ src/components/PrivacyScoreBadge.tsx tests/
git commit -m "feat: privacy portfolio screen with per-token scores and shield actions"
```

---

## Phase 6: UX Polish

### Task 16: Animation & Transitions

**Files:**
- Modify: `app/(tabs)/_layout.tsx` — tab transition animations
- Modify: Various screen files — add enter/exit animations
- Read: Existing Reanimated usage patterns

**Step 1: Add tab switch animations**

Use `react-native-reanimated` for smooth tab transitions (fade or slide).

**Step 2: Add screen enter animations**

Key screens that benefit from animation:
- Home: Fade-in balance cards
- Send: Slide-up recipient input
- Portfolio: Staggered token list entry
- Contact list: Staggered entry

**Step 3: Add haptic feedback**

```typescript
import * as Haptics from 'expo-haptics'

// On send success
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

// On button press
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

// On error
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
```

**Step 4: Test on Seeker**

Rebuild and verify animations feel smooth on Seeker's AMOLED.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add animations, transitions, and haptic feedback"
```

---

### Task 17: Loading States & Error Handling

**Files:**
- Modify: `app/(tabs)/index.tsx` — skeleton loading for balances
- Modify: `app/(tabs)/send.tsx` — error states for failed sends
- Modify: `app/(tabs)/swap.tsx` — loading state for quote fetch
- Read: `src/components/ui/LoadingState.tsx`, `src/components/ui/ErrorState.tsx`

**Step 1: Audit existing loading/error states**

Check each tab screen for:
- Loading states (skeleton or spinner)
- Error states (actionable error messages)
- Empty states (no data message)
- Edge cases (offline, RPC failure)

**Step 2: Add missing loading states**

Use existing `LoadingState.tsx` and `ErrorState.tsx` components.

**Step 3: Add missing error states**

Every async operation should have:
- Loading indicator while pending
- Error message with retry button on failure
- Success feedback (toast or animation)

**Step 4: Run tests**

Run: `pnpm test -- --run`

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: comprehensive loading states and error handling across all screens"
```

---

### Task 18: Dark Mode & AMOLED Optimization

**Files:**
- Read: `tailwind.config.js`
- Read: `global.css`
- Modify: Various screen files as needed

**Step 1: Audit color usage on Seeker AMOLED**

- True black backgrounds (#000000) save battery on AMOLED
- Verify contrast ratios meet WCAG AA
- Check purple accent visibility on dark backgrounds

**Step 2: Optimize for AMOLED**

- Background: `#000000` (true black) instead of dark gray
- Cards: `#111111` for subtle contrast
- Text: `#FFFFFF` primary, `#A1A1AA` secondary
- Accent: `#8B5CF6` (purple) — verified visible on dark

**Step 3: Test on Seeker**

Take screenshots comparing before/after. Verify readability and aesthetics.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: AMOLED-optimized dark theme for Seeker display"
```

---

### Task 19: Accessibility Pass

**Files:**
- Modify: Various screen and component files
- Read: `src/hooks/useAccessibility.ts`

**Step 1: Add accessibility labels**

Every interactive element needs:
- `accessibilityLabel` — what it is
- `accessibilityHint` — what happens when activated
- `accessibilityRole` — button, link, header, etc.

**Step 2: Check contrast ratios**

All text must meet WCAG AA contrast ratio (4.5:1 for normal text, 3:1 for large).

**Step 3: Test with TalkBack on Seeker**

Enable TalkBack (Android screen reader) and navigate through the app.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: accessibility improvements (labels, hints, contrast)"
```

---

## Phase 7: Submission Materials

### Task 20: Production APK Build

**Files:**
- Read: `eas.json`
- Modify: `app.config.js` (bump version if needed)

**Step 1: Update version**

```javascript
// app.config.js
version: "0.2.0"  // Bump for MONOLITH submission
android: { versionCode: 8 }
```

**Step 2: Run final test suite**

Run: `pnpm test -- --run`
Expected: All tests pass

**Step 3: Build production APK locally**

```bash
eas build --platform android --profile production --local
```

**Step 4: Install and test on Seeker**

```bash
adb install <path-to-production-apk>
```

Walk through every feature: Seed Vault, SKR, contacts, portfolio, send, receive, swap.

**Step 5: Commit version bump**

```bash
git add app.config.js
git commit -m "chore: bump version to 0.2.0 for MONOLITH submission"
```

---

### Task 21: GitHub Repository Preparation

**Files:**
- Modify: `README.md` — update for hackathon context

**Step 1: Ensure repo is public or invite hackathon-Judges**

```bash
# Check visibility
gh repo view sip-protocol/sip-mobile --json visibility

# If private, invite judges
gh api repos/sip-protocol/sip-mobile/collaborators/hackathon-Judges -f permission=read
```

**Step 2: Update README with features and screenshots**

Add:
- Feature highlights (privacy, Seed Vault, SKR, social payments, portfolio)
- Architecture overview
- Build instructions (local)
- Screenshots from Seeker

**Step 3: Commit**

```bash
git add README.md
git commit -m "docs: update README for MONOLITH hackathon submission"
```

---

### Task 22: Demo Video

**Not code — production task for RECTOR.**

**Suggested structure (2-3 minutes):**

1. **Hook (10s):** "Every transaction on Seeker is public. Watch." — show Solscan transaction
2. **Problem (20s):** "Your wallet balance, your contacts, your spending habits — all on-chain."
3. **Solution (30s):** "SIP Privacy — one toggle." — show privacy toggle, stealth address generation
4. **Seed Vault (20s):** "Hardware security meets privacy." — show Seed Vault prompt
5. **SKR (15s):** "Native SKR support." — show SKR in portfolio
6. **Social Payments (20s):** "Pay friends by name, not address." — show contact → send flow
7. **Privacy Portfolio (15s):** "Know your exposure." — show privacy scores
8. **Close (10s):** "Privacy should be the default, not the exception."

**Tools:** Screen record from Seeker via `scrcpy`, edit in DaVinci Resolve or similar.

---

### Task 23: Pitch Deck

**Not code — production task for RECTOR.**

**Suggested slides (8-10):**

1. Title: SIP Privacy — THE Privacy Wallet for Seeker
2. Problem: Public transactions expose everything
3. Solution: One-toggle privacy with stealth addresses
4. How it works: Stealth addresses + Pedersen commitments (simple diagram)
5. Seeker-native: Seed Vault hardware security
6. SKR integration: First-class Seeker ecosystem token
7. Social payments: Pay contacts by name
8. Privacy portfolio: Know your exposure, take action
9. Traction: 672 tests, 41 screens, 7 privacy backends, dApp Store ready
10. Team & vision: THE privacy standard for Web3

---

## Task Dependencies

```
Task 1 (Audit) → Task 2 (Fix Blockers)
Task 2 → Task 3 (Diagnose Seed Vault) → Task 4 (Fix Seed Vault) → Task 5 (Seed Vault Flow)
Task 2 → Task 6 (SKR Registry) → Task 7 (SKR Home) → Task 8 (SKR Flows)
Task 2 → Task 9 (Contact Store) → Task 10 (Contact Screen) → Task 11 (Pay Contact) → Task 12 (Payment Request)
Task 2 → Task 13 (Privacy Score) → Task 14 (Portfolio Store) → Task 15 (Portfolio Screen)
Tasks 5,8,12,15 → Task 16 (Animations) → Task 17 (Loading States) → Task 18 (AMOLED) → Task 19 (Accessibility)
Task 19 → Task 20 (Production APK) → Task 21 (GitHub) → Task 22 (Demo Video) → Task 23 (Pitch Deck)
```

**Parallel tracks after Task 2:**
- Track A: Seed Vault (Tasks 3-5)
- Track B: SKR (Tasks 6-8)
- Track C: Social Payments (Tasks 9-12)
- Track D: Privacy Portfolio (Tasks 13-15)

Tracks A-D can be worked in parallel or sequentially.

---

*Created: 2026-03-02*
*Design doc: `docs/plans/2026-03-02-monolith-submission-design.md`*
*Hackathon reference: `~/.claude/sip-protocol/hackathons/monolith-2026/MONOLITH.md`*
