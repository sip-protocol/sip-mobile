/**
 * Privacy Score Screen
 *
 * Analyzes wallet privacy exposure:
 * - Address reuse patterns
 * - Transaction linkability
 * - Public vs shielded ratio
 * - Recommendations for improvement
 */

import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { useState, useEffect, useMemo } from "react"
import { useWalletStore, formatAddress } from "@/stores/wallet"
import { usePrivacyStore } from "@/stores/privacy"
import { Button } from "@/components/ui"
import {
  ArrowLeft,
  ChartBar,
  ShieldCheck,
  Link,
  MapPin,
  FileText,
  Lightbulb,
} from "phosphor-react-native"
import type { Icon as PhosphorIcon } from "phosphor-react-native"
import { ICON_COLORS } from "@/constants/icons"

// ============================================================================
// TYPES
// ============================================================================

interface PrivacyMetrics {
  overallScore: number // 0-100
  shieldedRatio: number // % of shielded transactions
  addressReuse: number // count of reused addresses
  averageSetSize: number // anonymity set size
  linkabilityRisk: "low" | "medium" | "high"
  recommendations: string[]
}

// ============================================================================
// HELPERS
// ============================================================================

function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-400"
  if (score >= 60) return "text-yellow-400"
  if (score >= 40) return "text-orange-400"
  return "text-red-400"
}

function getScoreBgColor(score: number): string {
  if (score >= 80) return "bg-green-900/30"
  if (score >= 60) return "bg-yellow-900/30"
  if (score >= 40) return "bg-orange-900/30"
  return "bg-red-900/30"
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "Excellent"
  if (score >= 60) return "Good"
  if (score >= 40) return "Fair"
  return "Needs Improvement"
}

function getRiskColor(risk: "low" | "medium" | "high"): string {
  switch (risk) {
    case "low": return "text-green-400"
    case "medium": return "text-yellow-400"
    case "high": return "text-red-400"
  }
}

// ============================================================================
// COMPONENTS
// ============================================================================

interface MetricCardProps {
  icon: PhosphorIcon
  title: string
  value: string
  subtitle?: string
  valueColor?: string
}

function MetricCard({ icon: IconComponent, title, value, subtitle, valueColor = "text-white" }: MetricCardProps) {
  return (
    <View className="bg-dark-900 rounded-xl border border-dark-800 p-4 flex-1">
      <View className="flex-row items-center gap-2 mb-2">
        <IconComponent size={20} color={ICON_COLORS.muted} weight="fill" />
        <Text className="text-dark-400 text-sm">{title}</Text>
      </View>
      <Text className={`text-2xl font-bold ${valueColor}`}>{value}</Text>
      {subtitle && <Text className="text-dark-500 text-xs mt-1">{subtitle}</Text>}
    </View>
  )
}

interface RecommendationCardProps {
  text: string
  index: number
}

function RecommendationCard({ text, index }: RecommendationCardProps) {
  return (
    <View className="flex-row items-start gap-3 bg-dark-900 rounded-xl border border-dark-800 p-4 mb-2">
      <View className="w-6 h-6 rounded-full bg-brand-600/20 items-center justify-center">
        <Text className="text-brand-400 text-xs font-bold">{index + 1}</Text>
      </View>
      <Text className="text-dark-300 flex-1">{text}</Text>
    </View>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function PrivacyScoreScreen() {
  const { isConnected, address } = useWalletStore()
  const { payments } = usePrivacyStore()
  const [isAnalyzing, setIsAnalyzing] = useState(true)

  // Calculate privacy metrics from payment history
  const metrics: PrivacyMetrics = useMemo(() => {
    if (payments.length === 0) {
      return {
        overallScore: 100,
        shieldedRatio: 100,
        addressReuse: 0,
        averageSetSize: 0,
        linkabilityRisk: "low",
        recommendations: ["Start using SIP for private transactions!"],
      }
    }

    // Calculate shielded ratio
    const shieldedCount = payments.filter(
      (p) => p.privacyLevel === "shielded" || p.privacyLevel === "compliant"
    ).length
    const shieldedRatio = Math.round((shieldedCount / payments.length) * 100)

    // Estimate address reuse (simplified)
    const uniqueAddresses = new Set(payments.map((p) => p.stealthAddress || p.id))
    const addressReuse = payments.length - uniqueAddresses.size

    // Calculate overall score
    let score = 50 // Base score
    score += (shieldedRatio / 100) * 30 // Up to 30 points for shielded ratio
    score -= Math.min(addressReuse * 5, 20) // Lose up to 20 points for reuse
    score = Math.max(0, Math.min(100, Math.round(score)))

    // Determine linkability risk
    let linkabilityRisk: "low" | "medium" | "high" = "low"
    if (shieldedRatio < 50) linkabilityRisk = "high"
    else if (shieldedRatio < 80) linkabilityRisk = "medium"

    // Generate recommendations
    const recommendations: string[] = []
    if (shieldedRatio < 100) {
      recommendations.push("Use shielded transactions for all payments to maximize privacy")
    }
    if (addressReuse > 0) {
      recommendations.push("Avoid reusing addresses - always generate fresh stealth addresses")
    }
    if (payments.filter((p) => p.privacyLevel === "transparent").length > 0) {
      recommendations.push("Switch from transparent to shielded mode in settings")
    }
    if (recommendations.length === 0) {
      recommendations.push("Great job! Keep using shielded transactions")
    }

    return {
      overallScore: score,
      shieldedRatio,
      addressReuse,
      averageSetSize: Math.max(1, shieldedCount),
      linkabilityRisk,
      recommendations,
    }
  }, [payments])

  // Simulate analysis delay
  useEffect(() => {
    const timer = setTimeout(() => setIsAnalyzing(false), 1500)
    return () => clearTimeout(timer)
  }, [])

  if (!isConnected) {
    return (
      <SafeAreaView className="flex-1 bg-dark-950">
        <View className="flex-row items-center px-6 py-4 border-b border-dark-900">
          <TouchableOpacity
            className="flex-row items-center"
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color={ICON_COLORS.white} weight="bold" />
            <Text className="text-white ml-4 text-lg">Back</Text>
          </TouchableOpacity>
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-20 h-20 rounded-full bg-dark-800 items-center justify-center mb-4">
            <ChartBar size={40} color={ICON_COLORS.inactive} weight="fill" />
          </View>
          <Text className="text-white font-semibold text-lg">Connect Wallet</Text>
          <Text className="text-dark-500 text-center mt-2">
            Connect your wallet to analyze privacy score
          </Text>
          <Button
            onPress={() => router.push("/(auth)/wallet-setup")}
            style={{ marginTop: 24 }}
          >
            Connect Wallet
          </Button>
        </View>
      </SafeAreaView>
    )
  }

  if (isAnalyzing) {
    return (
      <SafeAreaView className="flex-1 bg-dark-950">
        <View className="flex-row items-center px-6 py-4 border-b border-dark-900">
          <TouchableOpacity
            className="flex-row items-center"
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color={ICON_COLORS.white} weight="bold" />
            <Text className="text-white ml-4 text-lg">Back</Text>
          </TouchableOpacity>
        </View>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#8b5cf6" />
          <Text className="text-dark-400 mt-4">Analyzing wallet privacy...</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-dark-950">
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-dark-900">
        <TouchableOpacity
          className="flex-row items-center"
          onPress={() => router.back()}
        >
          <Text className="text-2xl text-white">←</Text>
          <Text className="text-white ml-4 text-lg">Back</Text>
        </TouchableOpacity>
        <Text className="text-xl font-bold text-white">Privacy Score</Text>
        <View className="w-16" />
      </View>

      <ScrollView className="flex-1">
        <View className="px-6 pt-6">
          {/* Score Card */}
          <View className={`${getScoreBgColor(metrics.overallScore)} rounded-2xl p-6 items-center`}>
            <Text className="text-dark-400 text-sm mb-2">Overall Privacy Score</Text>
            <Text className={`text-6xl font-bold ${getScoreColor(metrics.overallScore)}`}>
              {metrics.overallScore}
            </Text>
            <Text className={`text-lg font-medium mt-2 ${getScoreColor(metrics.overallScore)}`}>
              {getScoreLabel(metrics.overallScore)}
            </Text>
            <Text className="text-dark-500 text-sm mt-2">
              {formatAddress(address)}
            </Text>
          </View>

          {/* Metrics Grid */}
          <View className="flex-row gap-3 mt-6">
            <MetricCard
              icon={ShieldCheck}
              title="Shielded"
              value={`${metrics.shieldedRatio}%`}
              subtitle="of transactions"
              valueColor={metrics.shieldedRatio >= 80 ? "text-green-400" : "text-yellow-400"}
            />
            <MetricCard
              icon={Link}
              title="Linkability"
              value={metrics.linkabilityRisk.charAt(0).toUpperCase() + metrics.linkabilityRisk.slice(1)}
              subtitle="risk level"
              valueColor={getRiskColor(metrics.linkabilityRisk)}
            />
          </View>

          <View className="flex-row gap-3 mt-3">
            <MetricCard
              icon={MapPin}
              title="Reused"
              value={metrics.addressReuse.toString()}
              subtitle="addresses"
              valueColor={metrics.addressReuse === 0 ? "text-green-400" : "text-orange-400"}
            />
            <MetricCard
              icon={FileText}
              title="Total Txns"
              value={payments.length.toString()}
              subtitle="recorded"
            />
          </View>

          {/* Recommendations */}
          <View className="mt-6">
            <Text className="text-dark-400 text-sm mb-3 uppercase">
              Recommendations
            </Text>
            {metrics.recommendations.map((rec, index) => (
              <RecommendationCard key={index} text={rec} index={index} />
            ))}
          </View>

          {/* Info Card */}
          <View className="mt-6 mb-8 bg-brand-900/10 border border-brand-800/30 rounded-xl p-4">
            <View className="flex-row items-start gap-3">
              <Lightbulb size={24} color={ICON_COLORS.brand} weight="fill" />
              <View className="flex-1">
                <Text className="text-brand-400 font-medium">
                  Why Privacy Matters
                </Text>
                <Text className="text-dark-400 text-sm mt-1">
                  On-chain transactions are public. Without privacy tools, your
                  financial activity can be tracked, analyzed, and linked to your
                  identity. SIP helps you transact privately.
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
