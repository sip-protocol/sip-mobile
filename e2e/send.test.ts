/**
 * E2E Tests: Send Flow
 *
 * Tests the send screen: recipient resolution, numpad amount entry,
 * balance gating, and the QR scanner.
 *
 * Aligned with the current app structure:
 * - Amount entry is a custom NumpadInput (preset-max / key-* testIDs);
 *   there is no amount text input, max-button, or send-button.
 * - The confirmation step is the "Confirm Transfer" modal (confirm-send-button).
 * - The test wallet has zero balance, so on-chain submission cannot be
 *   exercised in CI — the flow is asserted up to the balance gate
 *   (documented in the spec-alignment PR table).
 */

import { device, element, by, expect } from 'detox';
import {
  TIMEOUTS,
  waitForVisible,
  waitForNotExist,
  typeInField,
  setupTestWallet,
  navigateToSend, launchAppNoSync } from './utils';

// Solana system program — a guaranteed-valid on-curve pubkey
const VALID_ADDRESS = '11111111111111111111111111111111';
const STEALTH_ADDRESS =
  'sip:solana:S1P6j1yeTm6zkewQVeihrTZvmfoHABRkHDhabWTuWMd:S1P9WhBSbAGGatvrVE4TRBZfWpbG96U26zksy2TQj8q';

describe('Send Flow', () => {
  beforeAll(async () => {
    // Pre-grant camera permission so the scanner screen renders its camera view
    await launchAppNoSync({ newInstance: true, permissions: { camera: 'YES' } });
    await setupTestWallet();
  });

  beforeEach(async () => {
    // newInstance relaunch (reloadReactNative hung on the SDK 57 runtime and
    // is unsupported in release builds); persisted state survives the relaunch.
    await launchAppNoSync({ newInstance: true });
    await navigateToSend();
  });

  describe('Send Screen UI', () => {
    it('should display send screen elements', async () => {
      await expect(element(by.text('Send'))).toBeVisible();
      await expect(element(by.id('recipient-input'))).toBeVisible();
      await expect(element(by.id('privacy-toggle'))).toBeVisible();
      await expect(element(by.id('cta-button'))).toBeVisible();
    });

    it('should show privacy level options', async () => {
      // Privacy display is read-only; default level is shielded ("Private Transfer")
      await expect(element(by.id('privacy-toggle'))).toBeVisible();
      await expect(element(by.id('privacy-toggle'))).toHaveLabel(
        'Privacy level: Private Transfer'
      );
    });

    it('should have QR scanner button', async () => {
      await expect(element(by.id('scan-qr-button'))).toBeVisible();
    });
  });

  describe('Address Validation', () => {
    it('should validate Solana address format', async () => {
      // Enter invalid address
      await typeInField('recipient-input', 'invalid-address');

      // Should show the inline invalid-resolution marker
      await waitForVisible(by.id('recipient-invalid'));
    });

    it('should accept valid Solana address', async () => {
      await typeInField('recipient-input', VALID_ADDRESS);

      // Should not show the invalid-resolution marker
      await waitForNotExist(by.id('recipient-invalid'), TIMEOUTS.short);
    });

    it('should accept SIP stealth address', async () => {
      await typeInField('recipient-input', STEALTH_ADDRESS);

      // Should parse the sip: URI and show the stealth badge
      await waitForVisible(by.id('stealth-address-badge'));
      await waitForVisible(by.id('recipient-sip-uri'));
    });
  });

  describe('Amount Input', () => {
    it('should gate the CTA on a positive amount', async () => {
      // Numpad has no negative/zero entry: CTA stays in its disabled label
      // until a non-zero amount is entered
      await expect(element(by.id('cta-button'))).toHaveLabel('Enter Amount');

      await element(by.id('key-1')).tap();
      await expect(element(by.id('cta-button'))).toHaveLabel('Send Privately');
    });

    it('should show MAX button', async () => {
      await expect(element(by.id('preset-max'))).toBeVisible();
    });

    it('should fill max balance when MAX tapped', async () => {
      // Test wallet balance is 0 SOL on mainnet
      await element(by.id('preset-max')).tap();
      await expect(element(by.id('balance-pill'))).toHaveText('0 SOL');
    });

    it('should show insufficient balance error', async () => {
      await typeInField('recipient-input', VALID_ADDRESS);

      // Enter an amount above balance via the numpad
      await element(by.id('key-9')).multiTap(7);

      // Review triggers balance validation and surfaces a toast
      await element(by.id('cta-button')).tap();
      await waitForVisible(by.text('Insufficient balance'));
    });
  });

  describe('Send Transaction', () => {
    it('should gate confirmation behind balance validation', async () => {
      await typeInField('recipient-input', VALID_ADDRESS);
      await element(by.id('key-1')).tap();

      await element(by.id('cta-button')).tap();

      // Insufficient balance blocks the review flow with a toast
      await waitForVisible(by.text('Insufficient balance'));
    });

    it('should not open confirmation modal without balance', async () => {
      await typeInField('recipient-input', VALID_ADDRESS);
      await element(by.id('key-1')).tap();

      await element(by.id('cta-button')).tap();
      await waitForVisible(by.text('Insufficient balance'));

      // The "Confirm Transfer" modal (confirm-send-button) must not open
      await expect(element(by.id('confirm-send-button'))).not.toBeVisible();
    });

    // KNOWN LIMITATION (documented in the spec-alignment PR): asserting
    // transaction progress / success requires a funded test wallet — the CI
    // wallet imports a deterministic zero-balance mnemonic and there is no
    // in-app faucet. Re-introduce these once a funded E2E keypair exists:
    //   - tap cta-button → "Confirm Transfer" modal → confirm-send-button
    //   - transaction-progress testID during submission
    //   - transaction-success testID + "Transfer Complete" modal on success
  });

  describe('QR Scanner', () => {
    it('should open QR scanner screen', async () => {
      await element(by.id('scan-qr-button')).tap();

      // Camera permission pre-granted in beforeAll — camera view renders
      await waitForVisible(by.id('qr-scanner-screen'));
    });

    it('should request camera permission', async () => {
      // Relaunch with camera denied — scanner must show its denied state
      await launchAppNoSync({
        newInstance: true,
        permissions: { camera: 'NO' },
      });
      await navigateToSend();
      await element(by.id('scan-qr-button')).tap();

      await waitForVisible(by.text('Camera Permission Required'));
    });
  });
});
