/**
 * Utility exports
 */

// Security utilities
export {
  SESSION_TIMEOUT_MS,
  MAX_PIN_ATTEMPTS,
  PIN_LOCKOUT_MS,
  SecureStorage,
  hashString,
  hashPin,
  generateRandomHex,
  generateSessionToken,
  isValidPin,
  isValidSolanaAddress,
  sanitizeInput,
  maskSensitiveData,
  isRateLimited,
  resetRateLimit,
  getRateLimitRemaining,
  updateActivity,
  isSessionExpired,
  getSessionRemaining,
  onAppStateChange,
  isAppInBackground,
  getSecurityRecommendations,
  hasSecureHardware,
  clearSensitiveMemory,
  secureLogout,
} from "./security"

// Accessibility utilities
export {
  MIN_TOUCH_TARGET,
  MIN_CONTRAST_RATIO,
  MIN_CONTRAST_RATIO_LARGE,
  buttonA11y,
  linkA11y,
  headerA11y,
  imageA11y,
  announce,
  announcePolite,
  announceAssertive,
  loadingA11yMessage,
  errorA11yMessage,
  successA11yMessage,
  formatAmountForA11y,
  formatAddressForA11y,
  focusContainerProps,
  modalFocusProps,
  liveRegionProps,
  groupProps,
  listItemProps,
} from "./accessibility"
export type { A11yLabelProps, LiveRegionType } from "./accessibility"

// Logger utilities
export { logger, log, info, warn, error, debug } from "./logger"

// Explorer utilities
export {
  getExplorerTxUrl,
  getExplorerAccountUrl,
  getExplorerName,
} from "./explorer"
export type { Network } from "./explorer"
