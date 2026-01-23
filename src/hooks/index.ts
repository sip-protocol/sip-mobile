/**
 * Custom hooks for SIP Mobile
 */

// Wallet hooks
export { useMWA } from "./useMWA"
export { usePhantomDeeplink } from "./usePhantomDeeplink"
export { useWallet, getRecommendedProvider, getAvailableProviders } from "./useWallet"

// Privacy hooks
export { useStealth } from "./useStealth"
export type { StealthKeys, StealthAddress, UseStealthReturn } from "./useStealth"
export { useSend } from "./useSend"
export type { SendParams, SendResult, SendStatus, AddressValidation, UseSendReturn } from "./useSend"
export { useScanPayments } from "./useScanPayments"
export type { ScanResult, ScanProgress, ScanOptions, UseScanPaymentsReturn } from "./useScanPayments"
export { useClaim } from "./useClaim"
export type { ClaimResult, ClaimStatus, ClaimProgress, UseClaimReturn } from "./useClaim"
export { useViewingKeys } from "./useViewingKeys"
export type {
  UseViewingKeysReturn,
  ExportOptions,
  DisclosureInput,
  ImportKeyInput,
} from "./useViewingKeys"
export { useBiometrics } from "./useBiometrics"
export type {
  BiometricCapabilities,
  AuthResult,
  UseBiometricsReturn,
} from "./useBiometrics"

// DEX hooks
export { useQuote, useExchangeRate, useInsufficientBalance } from "./useQuote"
export type {
  QuoteParams,
  QuoteFreshness,
  QuoteResult,
} from "./useQuote"
