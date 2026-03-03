/**
 * Compliance Report Generation Screen
 *
 * Generate and export compliance reports:
 * - Configure date range
 * - Select included data
 * - Export as JSON
 * - View report history
 */

import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { useState, useCallback } from "react"
import { useCompliance } from "@/hooks"
import { useToastStore } from "@/stores/toast"
import type { ReportConfig } from "@/stores"
import {
  ArrowLeftIcon,
  CurrencyDollarIcon,
  KeyIcon,
  ClipboardTextIcon,
} from "phosphor-react-native"
import { ICON_COLORS } from "@/constants/icons"

// ============================================================================
// TYPES
// ============================================================================

type DateRange = ReportConfig["dateRange"]

// ============================================================================
// HELPERS
// ============================================================================

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getDateRangeLabel(range: DateRange): string {
  const labels: Record<DateRange, string> = {
    "7d": "Last 7 Days",
    "30d": "Last 30 Days",
    "90d": "Last 90 Days",
    all: "All Time",
  }
  return labels[range]
}

// ============================================================================
// COMPONENTS
// ============================================================================

interface OptionChipProps {
  label: string
  selected: boolean
  onPress: () => void
}

function OptionChip({ label, selected, onPress }: OptionChipProps) {
  return (
    <TouchableOpacity
      className={`px-4 py-2 rounded-xl mr-2 mb-2 ${
        selected ? "bg-brand-600" : "bg-dark-800"
      }`}
      onPress={onPress}
    >
      <Text className={`font-medium ${selected ? "text-white" : "text-dark-300"}`}>
        {label}
      </Text>
    </TouchableOpacity>
  )
}

interface ToggleOptionProps {
  icon: React.ReactNode
  label: string
  description: string
  enabled: boolean
  onToggle: () => void
}

function ToggleOption({ icon, label, description, enabled, onToggle }: ToggleOptionProps) {
  return (
    <TouchableOpacity
      className="flex-row items-center justify-between py-4 border-b border-dark-800"
      onPress={onToggle}
    >
      <View className="flex-row items-center flex-1">
        <View className="mr-3">{icon}</View>
        <View className="flex-1">
          <Text className="text-white font-medium">{label}</Text>
          <Text className="text-dark-400 text-sm">{description}</Text>
        </View>
      </View>
      <View
        className={`w-12 h-7 rounded-full p-1 ${
          enabled ? "bg-brand-600" : "bg-dark-700"
        }`}
      >
        <View
          className={`w-5 h-5 rounded-full bg-white ${
            enabled ? "ml-auto" : ""
          }`}
        />
      </View>
    </TouchableOpacity>
  )
}

interface ReportHistoryItemProps {
  id: string
  generatedAt: number
  config: ReportConfig
}

function ReportHistoryItem({ generatedAt, config }: ReportHistoryItemProps) {
  const includedData = [
    config.includeTransactions && "Transactions",
    config.includeDisclosures && "Disclosures",
    config.includeAuditTrail && "Audit Trail",
  ].filter(Boolean)

  return (
    <View className="bg-dark-800 rounded-xl p-4 mb-3">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-white font-medium">{getDateRangeLabel(config.dateRange)}</Text>
        <Text className="text-dark-400 text-xs">{formatDate(generatedAt)}</Text>
      </View>
      <Text className="text-dark-400 text-sm">
        Included: {includedData.join(", ") || "None"}
      </Text>
    </View>
  )
}

// ============================================================================
// MAIN SCREEN
// ============================================================================

export default function ReportGenerationScreen() {
  const { generateReport, reportHistory, stats, privacyScore } = useCompliance()
  const { addToast } = useToastStore()

  // Report configuration
  const [dateRange, setDateRange] = useState<DateRange>("30d")
  const [includeTransactions, setIncludeTransactions] = useState(true)
  const [includeDisclosures, setIncludeDisclosures] = useState(true)
  const [includeAuditTrail, setIncludeAuditTrail] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true)

    try {
      const config: ReportConfig = {
        dateRange,
        includeTransactions,
        includeDisclosures,
        includeAuditTrail,
        format: "json",
      }

      const fileUri = await generateReport(config)

      if (fileUri) {
        addToast({
          type: "success",
          title: "Report Generated",
          message: "Your compliance report is ready to share",
        })
      } else {
        addToast({
          type: "error",
          title: "Generation Failed",
          message: "Could not generate compliance report",
        })
      }
    } catch {
      addToast({
        type: "error",
        title: "Generation Failed",
        message: "An error occurred while generating the report",
      })
    } finally {
      setIsGenerating(false)
    }
  }, [
    dateRange,
    includeTransactions,
    includeDisclosures,
    includeAuditTrail,
    generateReport,
    addToast,
  ])

  const canGenerate = includeTransactions || includeDisclosures || includeAuditTrail

  return (
    <SafeAreaView className="flex-1 bg-dark-950">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-dark-800">
        <TouchableOpacity onPress={() => router.back()} className="mr-3 p-2 -ml-2">
          <ArrowLeftIcon size={24} color={ICON_COLORS.white} weight="bold" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold">Generate Report</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-4 pt-4 pb-8">
          {/* Preview Card */}
          <View className="bg-dark-900 rounded-xl p-4 mb-6">
            <Text className="text-dark-400 text-sm mb-3">Report Preview</Text>
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-white">Privacy Score</Text>
              <Text className="text-brand-400 font-bold text-lg">{privacyScore}</Text>
            </View>
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-white">Total Transactions</Text>
              <Text className="text-dark-300">{stats.totalTransactions}</Text>
            </View>
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-white">Shielded Percentage</Text>
              <Text className="text-green-400">
                {stats.totalTransactions > 0
                  ? Math.round((stats.shieldedTransactions / stats.totalTransactions) * 100)
                  : 0}
                %
              </Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-white">Active Disclosures</Text>
              <Text className="text-dark-300">{stats.activeDisclosures}</Text>
            </View>
          </View>

          {/* Date Range */}
          <View className="mb-6">
            <Text className="text-white text-lg font-semibold mb-3">Date Range</Text>
            <View className="flex-row flex-wrap">
              {(["7d", "30d", "90d", "all"] as DateRange[]).map((range) => (
                <OptionChip
                  key={range}
                  label={getDateRangeLabel(range)}
                  selected={dateRange === range}
                  onPress={() => setDateRange(range)}
                />
              ))}
            </View>
          </View>

          {/* Include Data */}
          <View className="mb-6">
            <Text className="text-white text-lg font-semibold mb-1">Include Data</Text>
            <Text className="text-dark-400 text-sm mb-3">
              Select what to include in the report
            </Text>

            <View className="bg-dark-900 rounded-xl px-4">
              <ToggleOption
                icon={<CurrencyDollarIcon size={24} color={ICON_COLORS.muted} weight="fill" />}
                label="Transactions"
                description="Payment and swap history"
                enabled={includeTransactions}
                onToggle={() => setIncludeTransactions(!includeTransactions)}
              />
              <ToggleOption
                icon={<KeyIcon size={24} color={ICON_COLORS.muted} weight="fill" />}
                label="Disclosures"
                description="Viewing key sharing history"
                enabled={includeDisclosures}
                onToggle={() => setIncludeDisclosures(!includeDisclosures)}
              />
              <ToggleOption
                icon={<ClipboardTextIcon size={24} color={ICON_COLORS.muted} weight="fill" />}
                label="Audit Trail"
                description="All compliance events"
                enabled={includeAuditTrail}
                onToggle={() => setIncludeAuditTrail(!includeAuditTrail)}
              />
            </View>
          </View>

          {/* Generate Button */}
          <TouchableOpacity
            className={`py-4 rounded-xl items-center mb-6 ${
              canGenerate && !isGenerating ? "bg-brand-600" : "bg-dark-700"
            }`}
            onPress={handleGenerate}
            disabled={!canGenerate || isGenerating}
          >
            {isGenerating ? (
              <View className="flex-row items-center">
                <ActivityIndicator size="small" color="#ffffff" />
                <Text className="text-white font-semibold ml-2">Generating...</Text>
              </View>
            ) : (
              <Text className="text-white font-semibold">Generate & Export Report</Text>
            )}
          </TouchableOpacity>

          {/* Report History */}
          {reportHistory.length > 0 && (
            <View>
              <Text className="text-white text-lg font-semibold mb-3">
                Recent Reports
              </Text>
              {reportHistory.slice(0, 5).map((report) => (
                <ReportHistoryItem
                  key={report.id}
                  id={report.id}
                  generatedAt={report.generatedAt}
                  config={report.config}
                />
              ))}
            </View>
          )}

          {/* Info Card */}
          <View className="bg-brand-900/20 rounded-xl p-4 mt-4">
            <Text className="text-brand-400 font-semibold mb-2">
              About Compliance Reports
            </Text>
            <Text className="text-dark-300 text-sm">
              Reports are exported as JSON files that can be shared with auditors,
              compliance officers, or regulatory bodies. The report includes your
              privacy score, transaction history, and viewing key disclosure records.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
