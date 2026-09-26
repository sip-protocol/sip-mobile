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
  completeOnboardingIfPresent, launchAppNoSync } from './utils';

describe('Onboarding Flow', () => {
  describe('Fresh Install', () => {
    it('should show welcome screen on first launch', async () => {
      await launchAppNoSync({ newInstance: true, delete: true });

      // Fresh installs land on the onboarding carousel
      await waitForVisible(by.text('Welcome to SIP Privacy'));
      await waitForVisible(by.text('Next'));
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

      // Should show seed phrase
      await waitForVisible(by.id('seed-phrase-display'), TIMEOUTS.long);

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
      await element(by.id('seed-phrase-input')).typeText(TEST_SEED_PHRASE);
      await element(by.id('import-submit-button')).tap();
      await waitForVisible(by.id('wallet-balance'), TIMEOUTS.long);

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
      await element(by.id('seed-phrase-input')).typeText(TEST_SEED_PHRASE);

      // Tap import — should show loading then home with balance
      await element(by.id('import-submit-button')).tap();
      await waitForVisible(by.id('wallet-balance'), TIMEOUTS.long);
    });

    it('should reject invalid seed phrase', async () => {
      await launchAppNoSync({ newInstance: true, delete: true });
      await completeOnboardingIfPresent();

      await element(by.id('import-button')).tap();
      await waitForVisible(by.id('seed-phrase-input'));

      // Enter invalid seed phrase
      await element(by.id('seed-phrase-input')).typeText('invalid seed phrase here');

      // Tap import — should show inline validation error
      await element(by.id('import-submit-button')).tap();
      await waitForVisible(by.text('Seed phrase must be 12 or 24 words'));
      await waitForNotExist(by.id('wallet-balance'), TIMEOUTS.short);
    });
  });
});
