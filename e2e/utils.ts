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

import { execSync } from 'node:child_process';

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
  // A swallowed tap (navigator-settle class) strands the walk mid-carousel,
  // so verify the funnel actually completed and re-walk when it didn't
  // (iOS run 36658156334: send's beforeAll died at 'Get Started' 30s —
  // slides never advanced). Bounded to 3 attempts; the final wait re-raises.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await waitFor(element(by.text('Get Started'))).toBeVisible().withTimeout(TIMEOUTS.long);
      break;
    } catch {
      if (attempt === 2) throw new Error('Carousel walk failed: Get Started never appeared after 3 attempts');
      // The original walk may have partially advanced (a swallowed tap) or
      // fully advanced (Next already gone — run 36804179459: re-walk hit
      // 'No elements found' because only Get Started remained). Tap Next
      // while it exists, then let the Get Started wait re-verify.
      for (let i = 0; i < 4; i++) {
        try {
          await element(by.text('Next')).tap();
        } catch {
          break;
        }
        await delay(750);
      }
    }
  }
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

// ============================================================================
// DEVICE PERMISSION TOGGLES + OS DIALOG (host-side)
// ============================================================================

// e2e buildType carries no applicationIdSuffix — same id for every config.
const ANDROID_APP_ID = 'org.sip_protocol.privacy';

/** Run an adb shell command against the detox-selected device. */
function adbShell(cmd: string): string {
  const serial = device.id ? ` -s ${device.id}` : '';
  return execSync(`adb${serial} shell ${cmd}`).toString();
}

/**
 * Grant/revoke an Android runtime permission via adb.
 *
 * Detox's launchApp({ permissions }) only reaches iOS simulators (simctl
 * privacy); on Android every manifest permission is pre-granted at install
 * and the option is silently ignored — so an explicit host-side `pm grant/
 * revoke` is the only lever for denied-state specs. Jest runs on the host,
 * where adb is on PATH; `device.id` is the adb serial on Android
 * (AndroidDriver.getExternalId → adbName) and undefined on iOS.
 * No-op on iOS — launchApp({ permissions }) already covers it there.
 */
export function setAndroidPermission(permission: string, granted: boolean) {
  if (device.getPlatform() !== 'android') return;
  adbShell(`pm ${granted ? 'grant' : 'revoke'} ${ANDROID_APP_ID} ${permission}`);
}

/**
 * Answer the Android OS runtime-permission dialog(s) with "Don't allow".
 *
 * Modern Android shows the grant dialog even when the permission is revoked
 * via adb — `pm revoke` + `appops … deny/ignore` do NOT short-circuit
 * PermissionsAndroid.request (verified on API 34 CI and API 36.1 local, run
 * 36662982640). Worse, the scan flow fires TWO stacked requests (RN +
 * camera lib), so one answer is not enough: loop while the focused window
 * is the permissioncontroller, tapping the deny button each round.
 *
 * The gate is `dumpsys window` mCurrentFocus (uiautomator's dump
 * nondeterministically misses system-dialog windows). The deny button sits
 * at ~(540, 1524) on 1080x2400 Material dialogs — verified identical on CI
 * API 34 (pixel_7) and local API 36.1. Bounded ~10s; a silent no-op when no
 * dialog appears.
 */
export async function denyAndroidPermissionDialog(attempts = 12) {
  if (device.getPlatform() !== 'android') return;
  // Two stacked requests fire (RN + camera lib) with a >1s gap between the
  // dialogs (CI run 36804324830: the helper answered #1, returned during the
  // gap, and #2 popped unattended — the denied state only rendered after the
  // assertion had already thrown). Require 2 consecutive seconds of
  // non-controller focus before declaring victory.
  let clean = 0;
  for (let i = 0; i < attempts; i++) {
    await delay(1000);
    let focus = '';
    try {
      focus = adbShell('dumpsys window 2>/dev/null | grep mCurrentFocus || true');
    } catch {
      continue;
    }
    if (!/permissioncontroller/i.test(focus)) {
      clean += 1;
      if (clean >= 2) return;
      continue;
    }
    clean = 0;
    adbShell('input tap 540 1524');
  }
}
