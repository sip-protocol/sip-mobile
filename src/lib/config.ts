/**
 * App Configuration
 *
 * Reads configuration from Expo constants (set at build time).
 * For EAS builds, set via: eas secret:create --name HELIUS_API_KEY --value xxx
 */

import Constants from "expo-constants"

export interface RpcKeys {
  helius: string | null
  quicknode: string | null
  triton: string | null
}

interface AppConfig {
  rpcKeys: RpcKeys
}

/**
 * Get app configuration from Expo extra
 */
export function getAppConfig(): AppConfig {
  const extra = Constants.expoConfig?.extra

  return {
    rpcKeys: {
      helius: extra?.rpcKeys?.helius || null,
      quicknode: extra?.rpcKeys?.quicknode || null,
      triton: extra?.rpcKeys?.triton || null,
    },
  }
}

/**
 * Get RPC API key for a specific provider
 */
export function getRpcApiKey(
  provider: "helius" | "quicknode" | "triton" | "publicnode"
): string | null {
  if (provider === "publicnode") return null

  const config = getAppConfig()
  return config.rpcKeys[provider] || null
}

/**
 * Get Helius API key (convenience function)
 */
export function getHeliusApiKey(): string | null {
  return getRpcApiKey("helius")
}
