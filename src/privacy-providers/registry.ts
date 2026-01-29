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
import { createPrivacyCashAdapter } from "./privacy-cash"
import { createShadowWireAdapter } from "./shadowwire"
import { createMagicBlockAdapter } from "./magicblock"
import { createArciumAdapter } from "./arcium"
import { createIncoAdapter } from "./inco"
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
      return createPrivacyCashAdapter(options)
    case "shadowwire":
      return createShadowWireAdapter(options)
    case "magicblock":
      return createMagicBlockAdapter(options)
    case "arcium":
      return createArciumAdapter(options)
    case "inco":
      return createIncoAdapter(options)
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
