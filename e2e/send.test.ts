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
  navigateToSend, launchAppNoSync, setAndroidPermission, denyAndroidPermissionDialog, tapWithRetry, delay } from './utils';

const CAMERA_PERMISSION = 'android.permission.CAMERA';

// Solana system program — a guaranteed-valid on-curve pubkey
const VALID_ADDRESS = '11111111111111111111111111111111';
const STEALTH_ADDRESS =
  'sip:solana:S1P6j1yeTm6zkewQVeihrTZvmfoHABRkHDhabWTuWMd:S1P9WhBSbAGGatvrVE4TRBZfWpbG96U26zksy2TQj8q';

describe('Send Flow', () => {
  // 300s hook budget: on a cold iOS simulator the funnel walk + wallet
  // import alone can exhaust the 120s default — its waits sum to ~134s
  // worst-case even on the success path (iOS run 36596361635: beforeAll
  // timed out mid-import with the app parked on wallet-setup).
  beforeAll(async () => {
    // Pre-grant camera permission so the scanner screen renders its camera view
    await launchAppNoSync({ newInstance: true, permissions: { camera: 'YES' } });
    await setupTestWallet();
  }, 300_000);

  beforeEach(async () => {
    // newInstance relaunch (reloadReactNative hung on the SDK 57 runtime and
    // is unsupported in release builds); persisted state survives the relaunch.
    await launchAppNoSync({ newInstance: true });
    await navigateToSend();
  });

  describe('Send Screen UI', () => {
    it('should display send screen elements', async () => {
      // The CTA's 'Send' label sits below the fold on ~320x640 viewports —
      // assert the stable testIDs (cta-button covers the label's intent).
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
      // CTA gate = valid recipient AND positive amount. Enter the recipient
      // first so the amount gate is isolated; Numpad has no negative/zero
      // entry: CTA stays in its disabled label until a non-zero amount is
      // entered.
      await typeInField('recipient-input', VALID_ADDRESS);
      await expect(element(by.id('cta-button'))).toHaveLabel('Enter Amount');

      await element(by.id('key-1')).tap();
      await expect(element(by.id('cta-button'))).toHaveLabel('Send Privately');
    });

    it('should show MAX button', async () => {
      await expect(element(by.id('preset-max'))).toBeVisible();
    });

    it('should fill max balance when MAX tapped', async () => {
      // Test wallet balance is 0 SOL on mainnet; balance-pill is masked by
      // default (hideBalances: true renders "******") — assert the amount
      // label instead of the pill text.
      await element(by.id('preset-max')).tap();
      await waitForVisible(by.label('Amount: 0 SOL'), TIMEOUTS.short);
    });

    it('should show insufficient balance error', async () => {
      await typeInField('recipient-input', VALID_ADDRESS);

      // Enter an amount above balance via the numpad
      await element(by.id('key-9')).multiTap(7);

      // Review triggers balance validation and surfaces a toast
      await tapWithRetry(element(by.id('cta-button')), by.text('Insufficient balance'));
    });
  });

  describe('Send Transaction', () => {
    it('should gate confirmation behind balance validation', async () => {
      await typeInField('recipient-input', VALID_ADDRESS);
      await element(by.id('key-1')).tap();

      // tapWithRetry verifies the toast itself — a separate waitForVisible
      // races the ~3s toast auto-dismissal (CI run 37091240762: the gate
      // test lost its 10s window to a momentary app stall).
      await tapWithRetry(element(by.id('cta-button')), by.text('Insufficient balance'));
    });

    it('should not open confirmation modal without balance', async () => {
      await typeInField('recipient-input', VALID_ADDRESS);
      await element(by.id('key-1')).tap();

      await tapWithRetry(element(by.id('cta-button')), by.text('Insufficient balance'));

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
    afterAll(() => {
      // Restore the install-time granted state for any later suites sharing
      // this device (Detox pre-grants all manifest permissions on Android).
      setAndroidPermission(CAMERA_PERMISSION, true);
    });

    it('should open QR scanner screen', async () => {
      await element(by.id('scan-qr-button')).tap();

      // Camera permission pre-granted in beforeAll — camera view renders
      await waitForVisible(by.id('qr-scanner-screen'));
    });

    it('should request camera permission', async () => {
      // Detox's permissions option only reaches iOS simulators — on Android
      // it is silently ignored (all manifest permissions are pre-granted at
      // install), so the scanner would render its camera view instead of the
      // denied state. Revoke explicitly on the host before relaunching.
      setAndroidPermission(CAMERA_PERMISSION, false);
      // Relaunch with camera denied — scanner must show its denied state
      await launchAppNoSync({
        newInstance: true,
        permissions: { camera: 'NO' },
      });
      await navigateToSend();
      await element(by.id('scan-qr-button')).tap();

      // Modern Android shows the grant dialog despite the revoke — answer it
      // (see denyAndroidPermissionDialog). Detox throws an expectation
      // immediately (no polling) while a dialog still owns window focus —
      // the denied state can render after the first attempt dies (CI runs
      // 36809927854/37091240762: failure screenshots show the denied state
      // at capture) — so retry the assertion, re-answering any re-popped
      // dialog, before giving up.
      await denyAndroidPermissionDialog();
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await waitForVisible(by.text('Camera Permission Required'), TIMEOUTS.medium);
          return;
        } catch {
          await delay(2000);
          await denyAndroidPermissionDialog();
        }
      }
      await waitForVisible(by.text('Camera Permission Required'), TIMEOUTS.long);
      // 240s: the retry ladder (3 × (10s wait + 2s + dialog answering) +
      // relaunch + nav + final LONG wait) legitimately exceeds jest's 120s
      // default on a slow simulator (CI run 37095212623: died at the cap
      // at 129s with every retry working as designed).
    }, 240_000);
  });
});
