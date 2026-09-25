/**
 * E2E Tests: Settings Flow
 *
 * Tests the Settings hub screen and configuration changes.
 *
 * Aligned with the current app structure (2026-03 navigation restructure):
 * - Settings is a stack route (/settings) reached via the sidebar on Home —
 *   there is no Settings tab.
 * - Network and RPC Provider are inline radio groups on the hub (no modals).
 * - Privacy Provider / Privacy Level / Background Scanning / Clear History
 *   UIs do not exist in the current app — those legacy specs were removed
 *   (rationale in the spec-alignment PR table).
 */

import { device, element, by, expect } from 'detox';
import {
  TIMEOUTS,
  waitForVisible,
  scrollDown,
  setupTestWallet,
  navigateToSettings,
} from './utils';

describe('Settings Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    await setupTestWallet();
  });

  beforeEach(async () => {
    // newInstance relaunch (reloadReactNative hung on the SDK 57 runtime and
    // is unsupported in release builds); persisted state survives the relaunch.
    await device.launchApp({ newInstance: true });
    await navigateToSettings();
  });

  describe('Settings Screen UI', () => {
    it('should display all settings sections', async () => {
      await expect(element(by.text('Settings'))).toBeVisible();
      await expect(element(by.text('Account'))).toBeVisible();
      await expect(element(by.text('Display'))).toBeVisible();
      await expect(element(by.text('Network'))).toBeVisible();
    });

    it('should show wallet address when connected', async () => {
      await expect(element(by.text('Manage Accounts'))).toBeVisible();
    });
  });

  describe('Network Settings', () => {
    it('should show network option', async () => {
      await scrollDown('settings-scroll-view', 250);
      await expect(element(by.text('Network'))).toBeVisible();
      await expect(element(by.text('Mainnet'))).toBeVisible();
      await expect(element(by.text('Devnet'))).toBeVisible();
    });

    it('should change network', async () => {
      await scrollDown('settings-scroll-view', 250);

      // Select Devnet (inline radio group — no modal)
      await element(by.text('Devnet')).tap();
      await waitForVisible(
        by.label('Devnet, Development testing').and(by.traits(['selected']))
      );

      // Restore Mainnet for subsequent tests
      await element(by.text('Mainnet')).tap();
      await waitForVisible(
        by.label('Mainnet, Production network').and(by.traits(['selected']))
      );
    });
  });

  describe('RPC Provider', () => {
    it('should show RPC provider option', async () => {
      await scrollDown('settings-scroll-view', 500);
      await expect(element(by.text('RPC Provider'))).toBeVisible();
      await expect(element(by.text('Helius'))).toBeVisible();
      await expect(element(by.text('PublicNode'))).toBeVisible();
    });

    it('should change RPC provider', async () => {
      await scrollDown('settings-scroll-view', 500);

      // Select PublicNode
      await element(by.text('PublicNode')).tap();
      await waitForVisible(
        by.label('PublicNode, Free public RPC').and(by.traits(['selected']))
      );

      // Restore Helius for subsequent tests
      await element(by.text('Helius')).tap();
      await waitForVisible(
        by.label('Helius, Premium RPC (API key required)').and(by.traits(['selected']))
      );
    });
  });

  describe('About Section', () => {
    it('should show app version', async () => {
      await scrollDown('settings-scroll-view', 700);
      // expoConfig.version (app.config.js) — update alongside version bumps
      await waitForVisible(by.text('Version 0.2.3'), TIMEOUTS.medium);
    });

    it('should show about links', async () => {
      // The legacy about modal is gone — About & Help rows open external links
      await scrollDown('settings-scroll-view', 700);
      await expect(element(by.text('Documentation'))).toBeVisible();
      await expect(element(by.text('Report Issue'))).toBeVisible();
      await expect(element(by.text('Website'))).toBeVisible();
    });
  });

  describe('Viewing Keys', () => {
    it('should navigate to viewing keys screen', async () => {
      await element(by.text('Viewing Keys')).tap();

      // Screen-unique anchor: the Export/Disclosures tab switcher
      // (avoids ambiguity with the hub row during the push animation)
      await waitForVisible(by.text('Export'), TIMEOUTS.medium);
    });
  });

  describe('Security Settings', () => {
    it('should navigate to security screen', async () => {
      await element(by.text('Security')).tap();

      // Screen-unique anchor: the biometrics section header
      await waitForVisible(by.text('Biometric Authentication'), TIMEOUTS.medium);
    });
  });
});
