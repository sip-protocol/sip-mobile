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
  await input.clearText();
  await input.typeText(text);
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

/**
 * Walk through the mandatory 5-slide onboarding carousel if it is showing.
 * Fresh installs land here; completing it routes to (auth)/wallet-setup.
 */
export async function completeOnboardingIfPresent() {
  try {
    await waitFor(element(by.text('Next'))).toBeVisible().withTimeout(TIMEOUTS.short);
  } catch {
    return; // Onboarding already completed — app landed elsewhere
  }
  for (let i = 0; i < 4; i++) {
    await element(by.text('Next')).tap();
  }
  await element(by.text('Get Started')).tap();
  await waitForVisible(by.id('welcome-screen'));
}

/**
 * Check if wallet is connected (looks for balance display)
 */
export async function isWalletConnected(): Promise<boolean> {
  try {
    await expect(element(by.id('wallet-balance'))).toBeVisible();
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
  await element(by.id('seed-phrase-input')).typeText(TEST_SEED_PHRASE);
  await element(by.id('import-submit-button')).tap();

  await waitForVisible(by.id('wallet-balance'), TIMEOUTS.long);
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
  await element(by.text('Send')).tap();
  await waitForVisible(by.id('recipient-input'));
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
