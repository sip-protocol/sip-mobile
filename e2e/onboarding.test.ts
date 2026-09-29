/**
 * E2E Tests: Onboarding Flow
 *
 * Tests the mandatory onboarding carousel and wallet creation/import flows.
 *
 * Aligned with the current app structure:
 * - Fresh installs land on the 5-slide onboarding carousel (Next ×4 → Get Started).
 * - "Welcome screen" = (auth)/wallet-setup, reached after the carousel.
 * - Wallet setup options: "Create New Wallet" (create-button) and
 *   "Import Existing Wallet" (import-button).
 *
 * NOTE: `device.reloadReactNative()` is not used — it hung for 120s+ per test
 * on the SDK 57 runtime (run 35949292281) and is unsupported in release
 * builds. Fresh-launch semantics are expressed with
 * `launchApp({ newInstance: true, delete: true })` instead, which matches
 * what these tests actually verify (first-launch behavior).
 */

import { device, element, by, expect } from 'detox';
import {
  TIMEOUTS,
  TEST_SEED_PHRASE,
  waitForVisible,
  waitForNotExist,
  typeInField,
  tapWithRetry,
  completeOnboardingIfPresent, launchAppNoSync } from './utils';

describe('Onboarding Flow', () => {
  beforeEach(async () => {
    // iOS Keychain survives delete:true app-data wipes — a wallet generated
    // by an earlier test (create-wallet renders its recovery phrase, which
    // materializes the keychain entry) leaks into every later "fresh
    // install": the app boots straight to Home and import-button /
    // welcome-screen never render (iOS run 36596361635: persist, import and
    // reject-invalid all failed on the leaked wallet; same address in two
    // failure screenshots). Wipe it so every test truly starts fresh.
    // Android keystore-backed storage dies with the app — clearKeychain is
    // iOS-only, so the guard keeps Android a no-op.
    if (device.getPlatform() === 'ios') {
      await device.clearKeychain();
    }
  });

  describe('Fresh Install', () => {
    it('should show onboarding carousel on first launch', async () => {
      await launchAppNoSync({ newInstance: true, delete: true });

      // First-run education is the designed entry: the root index route
      // routes fresh installs (no wallet, onboarding not completed) to the
      // 5-slide carousel. The funnel helper walks it via Next/Get Started.
      await waitForVisible(by.text('Next'), TIMEOUTS.long);
    });

    it('should show create and import wallet options', async () => {
      await launchAppNoSync({ newInstance: true, delete: true });
      await completeOnboardingIfPresent();

      // Wallet setup screen shows both options
      await expect(element(by.id('welcome-screen'))).toBeVisible();
      await expect(element(by.id('create-button'))).toBeVisible();
      await expect(element(by.id('import-button'))).toBeVisible();
    });
  });

  describe('Create Wallet', () => {
    it('should create a new wallet successfully', async () => {
      await launchAppNoSync({ newInstance: true, delete: true });
      await completeOnboardingIfPresent();

      // Tap create wallet
      await element(by.id('create-button')).tap();

      // Should show seed phrase. 60s: iOS run 36596361635 timed out at 30s
      // while its DETOX_VISIBILITY captures show the card fully rendered —
      // cold-simulator keygen + Fabric mount outlived the budget.
      await waitForVisible(by.id('seed-phrase-display'), TIMEOUTS.transaction);

      // Continue to the backup verification step
      await element(by.text("I've Written It Down")).tap();
      await waitForVisible(by.text('Verify Your Backup'), TIMEOUTS.medium);

      // KNOWN LIMITATION (documented in the spec-alignment PR): the verify
      // step generates randomized word options from the generated mnemonic,
      // which the test cannot read. Completing verification requires an
      // app-side test hook (e.g. a deterministic debug mnemonic via launch
      // args). The deterministic prefix of the flow is asserted here.
    });

    it('should persist wallet after app restart', async () => {
      // Provision a wallet via the deterministic import flow
      await launchAppNoSync({ newInstance: true, delete: true });
      await completeOnboardingIfPresent();
      await element(by.id('import-button')).tap();
      await waitForVisible(by.id('seed-phrase-input'));
      await typeInField('seed-phrase-input', TEST_SEED_PHRASE);
      await tapWithRetry(element(by.id('import-submit-button')), by.id('wallet-balance'));
      // 60s: cold-boot import on CI emulators has exceeded 30s (runs
      // 36426738681/36436286960); jest testTimeout is 120s. tapWithRetry:
      // the submit tap can be swallowed post-launch (run 36570652998).

      // Relaunch app (no uninstall — persisted state must survive)
      await launchAppNoSync({ newInstance: false });

      // Should go directly to home, not onboarding/wallet setup
      await waitForVisible(by.id('wallet-balance'), TIMEOUTS.medium);
      await expect(element(by.id('welcome-screen'))).not.toBeVisible();
    });
  });

  describe('Import Wallet', () => {
    it('should import wallet from seed phrase', async () => {
      await launchAppNoSync({ newInstance: true, delete: true });
      await completeOnboardingIfPresent();

      // Tap import wallet
      await element(by.id('import-button')).tap();

      // Should show seed phrase input
      await waitForVisible(by.id('seed-phrase-input'));

      // Enter test seed phrase (12 words)
      await typeInField('seed-phrase-input', TEST_SEED_PHRASE);

      await tapWithRetry(element(by.id('import-submit-button')), by.id('wallet-balance'));
      // 60s: cold-boot import on CI emulators has exceeded 30s (runs
      // 36426738681/36436286960); jest testTimeout is 120s. tapWithRetry:
      // the submit tap can be swallowed post-launch (run 36570652998).
    });

    it('should reject invalid seed phrase', async () => {
      await launchAppNoSync({ newInstance: true, delete: true });
      await completeOnboardingIfPresent();

      await element(by.id('import-button')).tap();
      await waitForVisible(by.id('seed-phrase-input'));

      // Enter invalid seed phrase
      await typeInField('seed-phrase-input', 'invalid seed phrase here');

      await element(by.id('import-submit-button')).tap();
      await waitForVisible(by.text('Seed phrase must be 12 or 24 words'), TIMEOUTS.long);
      await waitForNotExist(by.id('wallet-balance'), TIMEOUTS.short);
    });
  });
});
