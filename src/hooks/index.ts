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
