/**
 * Compliance Dashboard Screen
 *
 * Central hub for compliance and privacy management:
 * - Privacy score overview with breakdown
 * - Viewing key status
 * - Active disclosures summary
 * - Quick actions for reports and key management
 */

import { View, Text, TouchableOpacity, ScrollView, RefreshControl } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { useState, useCallback } from "react"
import { useCompliance, useViewingKeys } from "@/hooks"
import { useToastStore } from "@/stores/toast"
import {
  ArrowLeftIcon,
  LockIcon,
  KeyIcon,
  ClipboardTextIcon,
  MagnifyingGlassIcon,
  ChartBarIcon,
  FileTextIcon,
  ArrowRightIcon,
} from "phosphor-react-native"
import { ICON_COLORS } from "@/constants/icons"

// ============================================================================
// COMPONENTS
// ============================================================================

interface ScoreCardProps {
  score: number
  label: string
  colorClass: string
  breakdown: {
    transactionPrivacy: number
    keyManagement: number
    disclosureControl: number
    scanningFrequency: number
  }
}

function ScoreCard({ score, label, colorClass, breakdown }: ScoreCardProps) {
  return (
    <View className="bg-dark-900 rounded-2xl p-6 mb-4">
      <View className="items-center mb-6">
        {/* Circular Score Display */}
        <View className="w-32 h-32 rounded-full border-8 border-dark-700 items-center justify-center relative">
          <View
            className="absolute inset-0 rounded-full"
            style={{
              borderWidth: 8,
              borderColor:
                score >= 80
                  ? "#22c55e"
                  : score >= 60
                    ? "#3b82f6"
                    : score >= 40
                      ? "#eab308"
                      : "#ef4444",
              borderTopColor: "transparent",
              borderRightColor: "transparent",
              transform: [{ rotate: `${(score / 100) * 360}deg` }],
            }}
          />
          <Text className={`text-4xl font-bold ${colorClass}`}>{score}</Text>
        </View>
        <Text className={`text-lg font-semibold mt-2 ${colorClass}`}>{label}</Text>
        <Text className="text-dark-400 text-sm">Privacy Score</Text>
      </View>

      {/* Breakdown */}
      <View className="space-y-3">
        <BreakdownItem
          label="Transaction Privacy"
          value={breakdown.transactionPrivacy}
          icon={<LockIcon size={20} color={ICON_COLORS.muted} weight="fill" />}
        />
        <BreakdownItem
          label="Key Management"
          value={breakdown.keyManagement}
          icon={<KeyIcon size={20} color={ICON_COLORS.muted} weight="fill" />}
        />
        <BreakdownItem
          label="Disclosure Control"
          value={breakdown.disclosureControl}
          icon={<ClipboardTextIcon size={20} color={ICON_COLORS.muted} weight="fill" />}
        />
        <BreakdownItem
          label="Scanning Frequency"
          value={breakdown.scanningFrequency}
          icon={<MagnifyingGlassIcon size={20} color={ICON_COLORS.muted} weight="bold" />}
        />
      </View>
    </View>
  )
}

function BreakdownItem({
  label,
  value,
  icon,
}: {
  label: string
  value: number
  icon: React.ReactNode
}) {
  const getBarColor = (v: number) => {
    if (v >= 80) return "bg-green-500"
    if (v >= 60) return "bg-blue-500"
    if (v >= 40) return "bg-yellow-500"
    return "bg-red-500"
  }

  return (
    <View className="mb-3">
      <View className="flex-row justify-between items-center mb-1">
        <View className="flex-row items-center">
          <View className="mr-2">{icon}</View>
          <Text className="text-dark-300 text-sm">{label}</Text>
        </View>
        <Text className="text-white font-medium">{value}%</Text>
      </View>
      <View className="h-2 bg-dark-700 rounded-full overflow-hidden">
        <View
          className={`h-full ${getBarColor(value)} rounded-full`}
          style={{ width: `${value}%` }}
        />
      </View>
    </View>
  )
}

interface QuickStatProps {
  icon: React.ReactNode
  label: string
  value: string | number
  subtext?: string
  onPress?: () => void
}

function QuickStat({ icon, label, value, subtext, onPress }: QuickStatProps) {
  const content = (
    <View className="bg-dark-800 rounded-xl p-4 flex-1">
      <View className="mb-2">{icon}</View>
      <Text className="text-2xl font-bold text-white">{value}</Text>
      <Text className="text-dark-400 text-sm">{label}</Text>
      {subtext && <Text className="text-dark-500 text-xs mt-1">{subtext}</Text>}
    </View>
  )

  if (onPress) {
    return (
      <TouchableOpacity className="flex-1" onPress={onPress}>
        {content}
      </TouchableOpacity>
    )
  }

  return content
}

interface ActionCardProps {
  icon: React.ReactNode
  title: string
  description: string
  onPress: () => void
}

function ActionCard({ icon, title, description, onPress }: ActionCardProps) {
  return (
    <TouchableOpacity
      className="bg-dark-900 rounded-xl p-4 flex-row items-center mb-3"
      onPress={onPress}
    >
      <View className="w-12 h-12 rounded-xl bg-dark-800 items-center justify-center mr-4">
        {icon}
      </View>
      <View className="flex-1">
        <Text className="text-white font-semibold">{title}</Text>
        <Text className="text-dark-400 text-sm">{description}</Text>
      </View>
      <ArrowRightIcon size={20} color={ICON_COLORS.inactive} weight="bold" />
    </TouchableOpacity>
  )
}

// ============================================================================
// MAIN SCREEN
// ============================================================================

export default function ComplianceDashboard() {
  const {
    privacyScore,
    scoreBreakdown,
    scoreLabel,
    scoreColor,
    refreshScore,
    stats,
  } = useCompliance()
  const { disclosures, getActiveDisclosures } = useViewingKeys()
  const { addToast } = useToastStore()

  const [refreshing, setRefreshing] = useState(false)

  const activeDisclosures = getActiveDisclosures()

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    refreshScore()
    await new Promise((resolve) => setTimeout(resolve, 500))
    setRefreshing(false)
    addToast({
      type: "success",
      title: "Score Updated",
      message: "Privacy score has been recalculated",
    })
  }, [refreshScore, addToast])

  const formatLastScan = (hours: number | null): string => {
    if (hours === null) return "Never"
    if (hours === 0) return "Just now"
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  return (
    <SafeAreaView className="flex-1 bg-dark-950">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-dark-800">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-3 p-2 -ml-2">
            <ArrowLeftIcon size={24} color={ICON_COLORS.white} weight="bold" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">Compliance</Text>
        </View>
        <TouchableOpacity
          className="bg-dark-800 px-3 py-1.5 rounded-lg"
          onPress={onRefresh}
        >
          <Text className="text-brand-400 text-sm">Refresh</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#8b5cf6"
            colors={["#8b5cf6"]}
          />
        }
      >
        <View className="pt-4 pb-8">
          {/* Privacy Score Card */}
          <ScoreCard
            score={privacyScore}
            label={scoreLabel}
            colorClass={scoreColor}
            breakdown={scoreBreakdown}
          />

          {/* Quick Stats */}
          <View className="flex-row gap-3 mb-6">
            <QuickStat
              icon={<LockIcon size={24} color={ICON_COLORS.brand} weight="fill" />}
              label="Shielded"
              value={stats.shieldedTransactions}
              subtext={`of ${stats.totalTransactions} total`}
            />
            <QuickStat
              icon={<ClipboardTextIcon size={24} color={ICON_COLORS.brand} weight="fill" />}
              label="Active Disclosures"
              value={activeDisclosures.length}
              subtext={`${disclosures.length} total`}
              onPress={() => router.push("/compliance/disclosures")}
            />
            <QuickStat
              icon={<MagnifyingGlassIcon size={24} color={ICON_COLORS.brand} weight="bold" />}
              label="Last Scan"
              value={formatLastScan(stats.lastScanAge)}
              onPress={() => router.push("/scan")}
            />
          </View>

          {/* Quick Actions */}
          <Text className="text-white text-lg font-semibold mb-3">Quick Actions</Text>

          <ActionCard
            icon={<ChartBarIcon size={24} color={ICON_COLORS.brand} weight="fill" />}
            title="Audit Trail"
            description="View all compliance events"
            onPress={() => router.push("/compliance/audit-trail")}
          />

          <ActionCard
            icon={<KeyIcon size={24} color={ICON_COLORS.brand} weight="fill" />}
            title="Viewing Keys"
            description="Export or manage your viewing keys"
            onPress={() => router.push("/settings/viewing-keys")}
          />

          <ActionCard
            icon={<FileTextIcon size={24} color={ICON_COLORS.brand} weight="fill" />}
            title="Generate Report"
            description="Create compliance report for auditors"
            onPress={() => router.push("/compliance/report")}
          />

          <ActionCard
            icon={<ClipboardTextIcon size={24} color={ICON_COLORS.brand} weight="fill" />}
            title="Disclosure History"
            description="Track who has your viewing keys"
            onPress={() => router.push("/compliance/disclosures")}
          />

          {/* Tips Section */}
          <View className="bg-brand-900/20 rounded-xl p-4 mt-4">
            <Text className="text-brand-400 font-semibold mb-2">
              Improve Your Score
            </Text>
            <View className="space-y-2">
              {scoreBreakdown.transactionPrivacy < 80 && (
                <Text className="text-dark-300 text-sm">
                  • Use shielded transactions for better privacy
                </Text>
              )}
              {scoreBreakdown.scanningFrequency < 60 && (
                <Text className="text-dark-300 text-sm">
                  • Scan for payments more frequently
                </Text>
              )}
              {scoreBreakdown.disclosureControl < 80 && (
                <Text className="text-dark-300 text-sm">
                  • Review and revoke old disclosures
                </Text>
              )}
              {privacyScore >= 80 && (
                <Text className="text-dark-300 text-sm">
                  Great job! Your privacy practices are excellent.
                </Text>
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
