/**
 * Detox E2E Test Utilities
 *
 * Helper functions for common test operations.
 *
 * Aligned with the Expo Router app structure (3 tabs: Home / Privacy / Swap):
 * - Fresh installs land on the (auth)/onboarding carousel, then (auth)/wallet-setup.
 * - Send is a quick action on the Home screen; Settings lives behind the sidebar.
 * - A deterministic test wallet is provisioned via the import flow.
 */

import { device, element, by, waitFor, expect } from 'detox';

// ============================================================================
// TIMEOUTS & FIXTURES
// ============================================================================

export const TIMEOUTS = {
  short: 5000,
  medium: 10000,
  long: 30000,
  transaction: 60000,
};

/**
 * Deterministic BIP39 test mnemonic (all-zero entropy vector).
 * Imports a wallet with no funds — send flows assert the insufficient-balance
 * gating rather than on-chain submission.
 */
export const TEST_SEED_PHRASE =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

// ============================================================================
// WAIT HELPERS
// ============================================================================

/**
 * Wait for an element to be visible
 */
export async function waitForVisible(matcher: Detox.NativeMatcher, timeout = TIMEOUTS.medium) {
  await waitFor(element(matcher)).toBeVisible().withTimeout(timeout);
}

/**
 * Wait for an element to not exist
 */
export async function waitForNotExist(matcher: Detox.NativeMatcher, timeout = TIMEOUTS.medium) {
  await waitFor(element(matcher)).not.toExist().withTimeout(timeout);
}

// ============================================================================
// INPUT HELPERS
// ============================================================================

/**
 * Type text into an input field
 */
export async function typeInField(testID: string, text: string) {
  const input = element(by.id(testID));
  await input.tap();
  // replaceText commits the string directly (UiObject.setText) — GBoard's
  // IME composition mangles typeText keystrokes on long base58/URI strings
  // (drops prefixes, appends suggestion chars) and corrupts even unfocused
  // programmatic setText while composing.
  await input.replaceText(text);
  if (device.getPlatform() === 'android') {
    // Let the IME finish animating in — an immediate pressBack can fire
    // before the keyboard is up and pop the screen instead (run 36426738681).
    await delay(750);
    // Dismiss the keyboard: GBoard's overlay window swallows Detox taps
    // aimed at elements beneath it (submit buttons, numpad keys, CTA).
    await device.pressBack();
  }
}

/**
 * Tap a button and verify its post-condition, re-tapping once on timeout.
 *
 * A tap fired while the expo-router navigator settles — the #156
 * root-index route runs on every launch — is silently swallowed, and so is
 * a tap right after an IME dismiss: the button never receives it and the
 * screen freezes in place (CI run 36570652998: Send navigation and the
 * import submit were both dropped mid-suite). Verify-then-retry makes the
 * interaction self-healing; the re-tap is a harmless no-op if the first
 * one was merely slow and navigation already happened.
 */
export async function tapWithRetry(
  source: Detox.IndexableNativeElement,
  outcome: Detox.NativeMatcher,
  firstTimeout = 4000,
) {
  await source.tap();
  try {
    await waitFor(element(outcome)).toBeVisible().withTimeout(firstTimeout);
  } catch {
    try {
      await source.tap();
    } catch {
      // Source no longer mounted — the first tap was slow, not swallowed.
    }
    await waitFor(element(outcome)).toBeVisible().withTimeout(TIMEOUTS.transaction);
  }
}

// ============================================================================
// SCROLL HELPERS
// ============================================================================

/**
 * Scroll down in a scrollable view
 */
export async function scrollDown(testID: string, pixels = 300) {
  await element(by.id(testID)).scroll(pixels, 'down');
}

// ============================================================================
// ONBOARDING & WALLET SETUP
// ============================================================================

export function delay(ms: number): Promise<void> {
  // Promise.withResolvers needs Node 22+; CI runs Node 20 (e2e.yml node-version).
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

// Walk through the mandatory 5-slide onboarding carousel if it is showing.
// Fresh installs land here; completing it routes to (auth)/wallet-setup.
export async function completeOnboardingIfPresent() {
  try {
    // Cold-start evidence (run 36426738681): on fresh CI emulators/simulators
    // even the first carousel render can outlive SHORT — give the funnel
    // entrance MEDIUM. Warm starts exit the wait immediately, so the extra
    // budget costs nothing on the hot path.
    await waitFor(element(by.text('Next'))).toBeVisible().withTimeout(TIMEOUTS.medium);
  } catch {
    return; // Onboarding already completed — app landed elsewhere
  }
  // 5 slides; the CTA reads "Next" on slides 0-3 and "Get Started" on the last.
  // With Detox sync OFF nothing paces these taps, and the animated
  // scrollToIndex needs ~700ms to settle — unpaced taps land on the same slide.
  for (let i = 0; i < 4; i++) {
    await element(by.text('Next')).tap();
    await delay(750);
  }
  // Cold simulators render the last slide's CTA late too — iOS run
  // 36596361635: settings' funnel timed out here at MEDIUM.
  await waitFor(element(by.text('Get Started'))).toBeVisible().withTimeout(TIMEOUTS.long);
  await element(by.text('Get Started')).tap();
  // Wallet-setup render on a cold iOS simulator exceeded MEDIUM (iOS run
  // 36426738681: every completeOnboardingIfPresent caller timed out here).
  await waitForVisible(by.id('welcome-screen'), TIMEOUTS.long);
}

/**
 * Check if wallet is connected (looks for balance display)
 */
export async function isWalletConnected(): Promise<boolean> {
  try {
    // Bounded wait, not a bare expect: right after a relaunch the home
    // render trails the launch by seconds, and a false negative here sends
    // callers into a pointless re-import of an already-persisted wallet.
    await waitFor(element(by.id('wallet-balance'))).toBeVisible().withTimeout(5000);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a test wallet by importing the deterministic TEST_SEED_PHRASE.
 *
 * Flow (aligned with the current app):
 *   onboarding carousel (fresh installs) → wallet-setup welcome screen →
 *   Import Existing Wallet → seed phrase input → Import Wallet → Home.
 *
 * No-ops when the app already shows a connected wallet.
 */
export async function setupTestWallet() {
  if (await isWalletConnected()) {
    return;
  }

  await completeOnboardingIfPresent();

  await element(by.id('import-button')).tap();
  await waitForVisible(by.id('seed-phrase-input'));
  await typeInField('seed-phrase-input', TEST_SEED_PHRASE);
  // 60s: cold-boot import on CI emulators has exceeded 30s (runs
  // 36426738681/36436286960); beforeAll runs under the 120s jest timeout.
  // tapWithRetry: the submit tap right after the IME dismiss can be
  // swallowed (run 36570652998 settings beforeAll + onboarding import).
  await tapWithRetry(element(by.id('import-submit-button')), by.id('wallet-balance'));
}

// ============================================================================
// NAVIGATION HELPERS
// ============================================================================

/**
 * Open the sidebar from the Home screen avatar button.
 */
export async function openSidebar() {
  await element(by.label('Account avatar')).tap();
  await waitForVisible(by.text('Settings'));
}

/**
 * Navigate to the Settings hub (sidebar → Settings).
 */
export async function navigateToSettings() {
  await openSidebar();
  await element(by.text('Settings')).tap();
  // Above-the-fold hub marker (Account section top row)
  await waitForVisible(by.text('Manage Accounts'));
}

/**
 * Navigate to the Send screen (Home quick action).
 */
export async function navigateToSend() {
  // Small viewports (the CI API 34 emulator renders ~320x640): the keychain
  // security notice + balance card push the quick-action circles below the
  // fold, and Detox rejects a tap on the clipped 'Send' label (75%
  // visibility rule). Scroll it into view first — a scroll is a harmless
  // no-op on viewports where the content already fits.
  await scrollDown('home-scroll-view', 300);
  await tapWithRetry(element(by.text('Send')), by.id('recipient-input'));
}

/**
 * Launch the app, then disable Detox synchronization.
 *
 * RN 0.86 new-arch keeps the main queue permanently non-idle, so Detox
 * 20.51's synchronizer times out every interaction ("app is busy") even
 * when the UI renders fine. With sync off, the specs' explicit
 * waitFor(...).toBeVisible() calls (timeout-bounded) are the readiness
 * mechanism. Must be called AFTER launch — setSyncSettings needs the
 * in-app detox agent, so a running app instance is required.
 */
export async function launchAppNoSync(args: Parameters<typeof device.launchApp>[0]) {
  await device.launchApp(args);
  await device.disableSynchronization();
}
