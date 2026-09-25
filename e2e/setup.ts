/**
 * Global Detox test-environment setup.
 *
 * Disables Detox's synchronization subsystem for this suite.
 *
 * Why: on the RN 0.86 new-architecture runtime, the app's main queue never
 * reaches an idle state that Detox 20.51 recognizes — every action/wait
 * logs "The app is busy with the following tasks" (1-2 pending Main Queue
 * work items, Main Run Loop awake) and times out even when the UI is
 * actually rendered and responsive. See #124 and the spec-alignment PR for
 * the full evidence trail (246 "app busy" hits in the first aligned run).
 *
 * With synchronization off, the specs' explicit waitFor(...).toBeVisible()
 * calls (utils.ts) are the sole readiness mechanism — they are
 * timeout-bounded and independent of the main-queue idleness heuristic.
 */
import { device } from 'detox';

beforeAll(async () => {
  await device.disableSynchronization();
});
