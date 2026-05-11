/**
 * SIP-STEALTH Publish Screen
 *
 * Lists all .sol domains owned by the connected wallet, shows the SIP-STEALTH
 * state of each, and offers an "Enable" CTA per-domain.
 *
 * The Connection is derived from useSettingsStore so the screen reacts to
 * cluster + RPC provider changes (cluster-aware everything, per Phase B).
 *
 * Pure helpers exported below the component are tested directly in
 * tests/screens/sipStealth.test.ts (the repo's convention is logic-level
 * tests, not RTL).
 */

import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Linking,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { useState, useEffect, useCallback, useMemo } from "react"
import type { Connection } from "@solana/web3.js"
import { getAllDomains, reverseLookup } from "@bonfida/spl-name-service"
import {
  ArrowLeftIcon,
  GlobeIcon,
  CheckCircleIcon,
  WarningIcon,
  ArrowSquareOutIcon,
  ShieldCheckIcon,
} from "phosphor-react-native"
import { ICON_COLORS } from "@/constants/icons"
import { useNativeWallet } from "@/hooks"
import { useSettingsStore } from "@/stores/settings"
import { getRpcClient } from "@/lib/rpc"
import { getRpcApiKey } from "@/lib/config"
import { getExplorerTxUrl, getExplorerName } from "@/utils/explorer"
import { logger } from "@/utils/logger"
import {
  classifyResolveResult,
  errorMessageFor,
  isWalletReady,
  loadErrorMessageFor,
  type CardData,
  type CardState,
} from "@/utils/sipStealthHelpers"
import {
  resolve,
  publish,
  type PublishWallet,
} from "@/lib/sns-stealth-mobile"

// ============================================================================
// COMPONENT
// ============================================================================

interface DomainEntry {
  pubkey: string
  bareName: string
  fullDomain: string
}

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "loaded"; domains: DomainEntry[] }
  | { kind: "error"; message: string }

export default function SipStealthScreen() {
  const native = useNativeWallet()
  const {
    network,
    rpcProvider,
    heliusApiKey,
    quicknodeApiKey,
    tritonEndpoint,
    defaultExplorer,
  } = useSettingsStore()

  // ── Cluster-aware Connection (per the brief: callers provide it; do NOT
  //    instantiate inside the screen with hardcoded RPC env).
  const connection: Connection = useMemo(() => {
    let apiKey: string | undefined
    let customEndpoint: string | undefined
    switch (rpcProvider) {
      case "helius":
        apiKey = heliusApiKey || getRpcApiKey("helius") || undefined
        break
      case "quicknode":
        apiKey = quicknodeApiKey || undefined
        break
      case "triton":
        customEndpoint = tritonEndpoint || undefined
        break
      case "publicnode":
      default:
        break
    }
    return getRpcClient({
      provider: rpcProvider,
      cluster: network,
      apiKey,
      customEndpoint,
    }).getConnection()
  }, [
    network,
    rpcProvider,
    heliusApiKey,
    quicknodeApiKey,
    tritonEndpoint,
  ])

  const [loadState, setLoadState] = useState<LoadState>({ kind: "idle" })
  const [cards, setCards] = useState<Record<string, CardData>>({})

  const walletReady = isWalletReady({
    wallet: native.wallet,
    isInitialized: native.isInitialized,
    isLoading: native.isLoading,
  })

  // ── Load .sol domains owned by the wallet + classify each.
  useEffect(() => {
    let cancelled = false

    if (!walletReady || !native.wallet) {
      setLoadState({ kind: "idle" })
      setCards({})
      return () => {
        cancelled = true
      }
    }

    setLoadState({ kind: "loading" })
    setCards({})

    async function load() {
      if (!native.wallet) return
      try {
        const records = await getAllDomains(connection, native.wallet.publicKey)
        if (cancelled) return

        if (records.length === 0) {
          setLoadState({ kind: "loaded", domains: [] })
          return
        }

        const entries = await Promise.all(
          records.map(async (record) => {
            const bareName = await reverseLookup(connection, record)
            return {
              pubkey: record.toBase58(),
              bareName,
              fullDomain: `${bareName}.sol`,
            }
          })
        )
        if (cancelled) return

        // Seed each card into `loading` before kicking off resolves.
        const initialCards: Record<string, CardData> = {}
        for (const e of entries) {
          initialCards[e.pubkey] = {
            state: "loading",
            domainName: e.fullDomain,
            signature: null,
            errorMessage: null,
          }
        }
        setCards(initialCards)
        setLoadState({ kind: "loaded", domains: entries })

        // Classify each in parallel; commit all results in one final setState
        // after a cancellation check (safer than per-card updates which can
        // race against unmount).
        const results = await Promise.all(
          entries.map(async (e) => {
            try {
              const r = await resolve(connection, e.fullDomain)
              const next: CardState = classifyResolveResult(r)
              return [e.pubkey, {
                state: next,
                domainName: e.fullDomain,
                signature: null,
                errorMessage: null,
              } satisfies CardData] as const
            } catch (err) {
              logger.error("[sip-stealth] resolve failed", err)
              return [e.pubkey, {
                state: "error" as CardState,
                domainName: e.fullDomain,
                signature: null,
                errorMessage: loadErrorMessageFor(err),
              } satisfies CardData] as const
            }
          })
        )
        if (cancelled) return

        const final: Record<string, CardData> = {}
        for (const [pk, data] of results) {
          final[pk] = data
        }
        setCards(final)
      } catch (err) {
        if (cancelled) return
        logger.error("[sip-stealth] getAllDomains failed", err)
        setLoadState({
          kind: "error",
          message: loadErrorMessageFor(err),
        })
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [walletReady, native.wallet, connection])

  const handlePublish = useCallback(
    async (entry: DomainEntry) => {
      if (!native.wallet) return

      setCards((prev) => ({
        ...prev,
        [entry.pubkey]: {
          ...(prev[entry.pubkey] ?? {
            state: "no-record",
            domainName: entry.fullDomain,
            signature: null,
            errorMessage: null,
          }),
          state: "publishing",
          errorMessage: null,
        },
      }))

      try {
        const publishWallet: PublishWallet = {
          publicKey: native.wallet.publicKey,
          signMessage: native.signMessage,
          signTransaction: native.signTransaction as PublishWallet["signTransaction"],
        }
        const { signature } = await publish(
          connection,
          entry.fullDomain,
          publishWallet
        )
        setCards((prev) => ({
          ...prev,
          [entry.pubkey]: {
            state: "published",
            domainName: entry.fullDomain,
            signature,
            errorMessage: null,
          },
        }))
      } catch (err) {
        logger.error("[sip-stealth] publish failed", err)
        setCards((prev) => ({
          ...prev,
          [entry.pubkey]: {
            state: "no-record",
            domainName: entry.fullDomain,
            signature: null,
            errorMessage: errorMessageFor(err),
          },
        }))
      }
    },
    [connection, native.wallet, native.signMessage, native.signTransaction]
  )

  // ────────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-dark-950">
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-dark-900">
        <TouchableOpacity
          className="flex-row items-center"
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeftIcon size={24} color={ICON_COLORS.white} weight="bold" />
          <Text className="text-white ml-4 text-lg">Back</Text>
        </TouchableOpacity>
        <Text className="text-xl font-bold text-white">SIP-STEALTH</Text>
        <View className="w-16" />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-6 pt-6 pb-8">
          {/* Intro */}
          <View className="mb-6">
            <View className="flex-row items-center mb-2">
              <View className="w-10 h-10 rounded-xl bg-brand-900/30 items-center justify-center">
                <ShieldCheckIcon
                  size={20}
                  color={ICON_COLORS.brand}
                  weight="fill"
                />
              </View>
              <Text className="text-white text-xl font-bold ml-3">
                Enable Private Payments
              </Text>
            </View>
            <Text className="text-dark-400 text-sm leading-5">
              Publish a SIP-STEALTH record to your{" "}
              <Text className="text-white font-medium">.sol</Text> domain so
              others can send you private payments without revealing your
              wallet address on-chain.
            </Text>
          </View>

          {/* Wallet not connected */}
          {!walletReady && (
            <View className="bg-dark-900 rounded-xl border border-dark-800 p-6 items-center">
              <View className="w-14 h-14 rounded-full bg-dark-800 items-center justify-center mb-3">
                <ShieldCheckIcon
                  size={24}
                  color={ICON_COLORS.muted}
                  weight="regular"
                />
              </View>
              <Text className="text-white font-medium text-base mb-1">
                Connect wallet first
              </Text>
              <Text className="text-dark-500 text-sm text-center">
                Set up or import a wallet to see your .sol domains and enable
                private payments.
              </Text>
            </View>
          )}

          {/* Loading skeleton */}
          {walletReady && loadState.kind === "loading" && (
            <View>
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  className="bg-dark-900 rounded-xl border border-dark-800 p-4 mb-3"
                  accessibilityLabel="Loading domain"
                >
                  <View className="flex-row items-center">
                    <View className="w-10 h-10 rounded-full bg-dark-800" />
                    <View className="flex-1 ml-3">
                      <View className="h-4 w-28 rounded bg-dark-800 mb-2" />
                      <View className="h-3 w-48 rounded bg-dark-800" />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Load error */}
          {walletReady && loadState.kind === "error" && (
            <View className="bg-dark-900 rounded-xl border border-red-500/30 p-5">
              <View className="flex-row items-center mb-1">
                <WarningIcon
                  size={18}
                  color={ICON_COLORS.error}
                  weight="fill"
                />
                <Text className="text-red-400 font-medium ml-2">
                  Failed to load domains
                </Text>
              </View>
              <Text className="text-dark-400 text-sm">
                {loadState.message}
              </Text>
            </View>
          )}

          {/* Empty: no domains */}
          {walletReady &&
            loadState.kind === "loaded" &&
            loadState.domains.length === 0 && (
              <View className="bg-dark-900 rounded-xl border border-dark-800 p-6 items-center">
                <View className="w-14 h-14 rounded-full bg-dark-800 items-center justify-center mb-3">
                  <GlobeIcon
                    size={24}
                    color={ICON_COLORS.muted}
                    weight="regular"
                  />
                </View>
                <Text className="text-white font-medium text-base mb-1">
                  No .sol domains found
                </Text>
                <Text className="text-dark-500 text-sm text-center mb-4">
                  You don&apos;t own any .sol domains yet. Get one at sns.id
                  to enable private payments.
                </Text>
                <TouchableOpacity
                  onPress={() => Linking.openURL("https://sns.id")}
                  className="flex-row items-center bg-brand-600 rounded-xl px-4 py-2"
                  accessibilityRole="link"
                  accessibilityLabel="Get a .sol domain at sns.id"
                >
                  <Text className="text-white font-semibold text-sm mr-1.5">
                    Get a .sol domain
                  </Text>
                  <ArrowSquareOutIcon
                    size={14}
                    color={ICON_COLORS.white}
                    weight="bold"
                  />
                </TouchableOpacity>
              </View>
            )}

          {/* Domain cards */}
          {walletReady &&
            loadState.kind === "loaded" &&
            loadState.domains.length > 0 && (
              <View>
                {loadState.domains.map((entry) => {
                  const data: CardData =
                    cards[entry.pubkey] ?? {
                      state: "loading",
                      domainName: entry.fullDomain,
                      signature: null,
                      errorMessage: null,
                    }
                  return (
                    <DomainCard
                      key={entry.pubkey}
                      entry={entry}
                      data={data}
                      network={network}
                      explorer={defaultExplorer}
                      onPublish={() => handlePublish(entry)}
                    />
                  )
                })}
              </View>
            )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

// ============================================================================
// CARD
// ============================================================================

interface DomainCardProps {
  entry: DomainEntry
  data: CardData
  network: "mainnet-beta" | "devnet" | "testnet"
  explorer: ReturnType<typeof useSettingsStore.getState>["defaultExplorer"]
  onPublish: () => void
}

function DomainCard({
  entry,
  data,
  network,
  explorer,
  onPublish,
}: DomainCardProps) {
  const { state, domainName, signature, errorMessage } = data
  const displayName = domainName ?? entry.fullDomain

  // Loading skeleton (per-card).
  if (state === "loading") {
    return (
      <View
        className="bg-dark-900 rounded-xl border border-dark-800 p-4 mb-3"
        accessibilityLabel={`Checking ${displayName}`}
      >
        <View className="flex-row items-center">
          <View className="w-10 h-10 rounded-full bg-dark-800 items-center justify-center">
            <GlobeIcon
              size={18}
              color={ICON_COLORS.muted}
              weight="regular"
            />
          </View>
          <View className="flex-1 ml-3">
            <Text className="text-white font-semibold text-sm" numberOfLines={1}>
              {displayName}
            </Text>
            <Text className="text-dark-500 text-xs mt-0.5">
              Checking record…
            </Text>
          </View>
        </View>
      </View>
    )
  }

  if (state === "error") {
    return (
      <View className="bg-dark-900 rounded-xl border border-red-500/20 p-4 mb-3">
        <View className="flex-row items-center">
          <View className="w-10 h-10 rounded-full bg-red-900/30 items-center justify-center">
            <WarningIcon
              size={18}
              color={ICON_COLORS.error}
              weight="fill"
            />
          </View>
          <View className="flex-1 ml-3">
            <Text className="text-white font-semibold text-sm" numberOfLines={1}>
              {displayName}
            </Text>
            <Text className="text-red-400 text-xs mt-0.5">
              {errorMessage ?? "Failed to load"}
            </Text>
          </View>
        </View>
      </View>
    )
  }

  if (state === "has-record") {
    return (
      <View className="bg-dark-900 rounded-xl border border-dark-800 p-4 mb-3">
        <View className="flex-row items-center">
          <View className="w-10 h-10 rounded-full bg-green-900/30 items-center justify-center">
            <CheckCircleIcon
              size={18}
              color={ICON_COLORS.success}
              weight="fill"
            />
          </View>
          <View className="flex-1 ml-3">
            <Text className="text-white font-semibold text-sm" numberOfLines={1}>
              {displayName}
            </Text>
            <Text className="text-green-400 text-xs mt-0.5">
              Private payments enabled
            </Text>
          </View>
        </View>
      </View>
    )
  }

  if (state === "published") {
    const explorerUrl = signature
      ? getExplorerTxUrl(signature, network, explorer)
      : null
    return (
      <View className="bg-dark-900 rounded-xl border border-green-500/30 p-4 mb-3">
        <View className="flex-row items-center">
          <View className="w-10 h-10 rounded-full bg-green-900/30 items-center justify-center">
            <CheckCircleIcon
              size={18}
              color={ICON_COLORS.success}
              weight="fill"
            />
          </View>
          <View className="flex-1 ml-3">
            <Text className="text-white font-semibold text-sm" numberOfLines={1}>
              {displayName}
            </Text>
            <Text className="text-green-400 text-xs mt-0.5">
              Published successfully
            </Text>
          </View>
        </View>
        {explorerUrl && (
          <TouchableOpacity
            className="flex-row items-center mt-3 self-start"
            onPress={() => Linking.openURL(explorerUrl)}
            accessibilityRole="link"
            accessibilityLabel={`View transaction on ${getExplorerName(explorer)}`}
          >
            <Text className="text-brand-400 text-xs font-medium mr-1">
              View on {getExplorerName(explorer)}
            </Text>
            <ArrowSquareOutIcon
              size={12}
              color={ICON_COLORS.brand}
              weight="bold"
            />
          </TouchableOpacity>
        )}
      </View>
    )
  }

  // no-record / publishing
  const isPublishing = state === "publishing"

  return (
    <View className="bg-dark-900 rounded-xl border border-dark-800 p-4 mb-3">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center flex-1 min-w-0">
          <View className="w-10 h-10 rounded-full bg-dark-800 items-center justify-center">
            <GlobeIcon
              size={18}
              color={ICON_COLORS.muted}
              weight="regular"
            />
          </View>
          <View className="flex-1 ml-3 min-w-0">
            <Text
              className="text-white font-semibold text-sm"
              numberOfLines={1}
            >
              {displayName}
            </Text>
            <Text className="text-dark-500 text-xs mt-0.5">
              No SIP stealth record
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={onPublish}
          disabled={isPublishing}
          accessibilityRole="button"
          accessibilityLabel={
            isPublishing
              ? `Publishing private payments for ${displayName}`
              : `Enable private payments for ${displayName}`
          }
          accessibilityState={{ disabled: isPublishing, busy: isPublishing }}
          className={
            isPublishing
              ? "bg-brand-600/50 rounded-xl px-4 py-2 ml-3"
              : "bg-brand-600 rounded-xl px-4 py-2 ml-3"
          }
        >
          <Text className="text-white font-semibold text-sm">
            {isPublishing ? "Publishing…" : "Enable"}
          </Text>
        </TouchableOpacity>
      </View>

      {errorMessage && (
        <View className="flex-row items-center mt-3">
          <WarningIcon
            size={12}
            color={ICON_COLORS.error}
            weight="fill"
          />
          <Text className="text-red-400 text-xs ml-1.5 flex-1">
            {errorMessage}
          </Text>
        </View>
      )}
    </View>
  )
}
