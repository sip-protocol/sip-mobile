/**
 * Privacy Provider Registry
 *
 * Factory and registry for managing privacy provider adapters.
 * Singleton pattern - one adapter instance per provider type.
 */

import type {
  PrivacyProviderAdapter,
  PrivacyProviderType,
  AdapterOptions,
} from "./types"
import { createSipNativeAdapter } from "./sip-native"
// Blocked: Privacy Cash SDK uses import.meta (unsupported by Hermes/React Native)
// import { createPrivacyCashAdapter } from "./privacy-cash"
import { createShadowWireAdapter } from "./shadowwire"
import { createMagicBlockAdapter } from "./magicblock"
// Arcium disabled - @arcium-hq/client imports Node.js 'fs' (incompatible with RN)
// import { createArciumAdapter } from "./arcium"
// Inco disabled - @inco/solana-sdk uses ecies-geth which imports Node.js 'crypto'
// import { createIncoAdapter } from "./inco"
import { createCSPLAdapter } from "./cspl"
import { debug } from "@/utils/logger"

// ============================================================================
// REGISTRY STATE
// ============================================================================

/** Cached adapter instances */
const adapterCache = new Map<PrivacyProviderType, PrivacyProviderAdapter>()

/** Current adapter options (used for cache invalidation) */
let currentOptions: AdapterOptions | null = null

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create a new adapter instance
 */
export function createAdapter(
  type: PrivacyProviderType,
  options: AdapterOptions
): PrivacyProviderAdapter {
  debug(`Creating ${type} adapter`)

  switch (type) {
    case "sip-native":
      return createSipNativeAdapter(options)
    case "privacy-cash":
      // Blocked: Privacy Cash SDK uses import.meta (unsupported by Hermes/React Native)
      throw new Error("Privacy Cash is not available on mobile. Please use SIP Native or another provider.")
    case "shadowwire":
      return createShadowWireAdapter(options)
    case "magicblock":
      return createMagicBlockAdapter(options)
    case "arcium":
      // Arcium disabled - @arcium-hq/client imports Node.js 'fs' (incompatible with RN)
      throw new Error("Arcium is not available on mobile. Please use SIP Native or another provider.")
    case "inco":
      // Inco disabled - @inco/solana-sdk uses ecies-geth which imports Node.js 'crypto'
      throw new Error("Inco is not available on mobile. Please use SIP Native or another provider.")
    case "cspl":
      return createCSPLAdapter(options)
    default:
      throw new Error(`Unknown privacy provider: ${type}`)
  }
}

/**
 * Get or create a cached adapter instance
 *
 * Re-creates adapter if options have changed (e.g., network switch)
 */
export function getAdapter(
  type: PrivacyProviderType,
  options: AdapterOptions
): PrivacyProviderAdapter {
  // Check if options changed (invalidate cache)
  const optionsChanged =
    currentOptions === null ||
    currentOptions.network !== options.network ||
    currentOptions.walletAddress !== options.walletAddress

  if (optionsChanged) {
    debug("Options changed, clearing adapter cache")
    adapterCache.clear()
    currentOptions = options
  }

  // Return cached adapter or create new one
  const cached = adapterCache.get(type)
  if (cached) {
    return cached
  }

  const adapter = createAdapter(type, options)
  adapterCache.set(type, adapter)
  return adapter
}

/**
 * Initialize an adapter (call once on app startup or provider switch)
 */
export async function initializeAdapter(
  type: PrivacyProviderType,
  options: AdapterOptions
): Promise<PrivacyProviderAdapter> {
  const adapter = getAdapter(type, options)

  if (!adapter.isReady()) {
    await adapter.initialize()
    debug(`${type} adapter initialized and ready`)
  }

  return adapter
}

/**
 * Clear the adapter cache
 * Call when user logs out or switches accounts
 */
export function clearAdapterCache(): void {
  adapterCache.clear()
  currentOptions = null
  debug("Adapter cache cleared")
}
