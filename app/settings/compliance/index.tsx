/**
 * Compliance Dashboard Screen
 *
 * For institutional users to:
 * - View audit-ready transaction reports
 * - Manage viewing key disclosures
 * - Export compliance reports
 * - Configure disclosure policies
 */

import { View, Text, TouchableOpacity, ScrollView } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { useWalletStore, formatAddress } from "@/stores/wallet"
import { usePrivacyStore } from "@/stores/privacy"
import { useViewingKeys } from "@/hooks/useViewingKeys"
import { Button } from "@/components/ui"

// ============================================================================
// COMPONENTS
// ============================================================================

interface StatCardProps {
  icon: string
  title: string
  value: string | number
  subtitle?: string
}

function StatCard({ icon, title, value, subtitle }: StatCardProps) {
  return (
    <View className="bg-dark-900 rounded-xl border border-dark-800 p-4 flex-1">
      <View className="flex-row items-center gap-2 mb-2">
        <Text className="text-xl">{icon}</Text>
        <Text className="text-dark-400 text-sm">{title}</Text>
      </View>
      <Text className="text-2xl font-bold text-white">{value}</Text>
      {subtitle && <Text className="text-dark-500 text-xs mt-1">{subtitle}</Text>}
    </View>
  )
}

interface FeatureCardProps {
  icon: string
  title: string
  description: string
  onPress?: () => void
  disabled?: boolean
}

function FeatureCard({ icon, title, description, onPress, disabled }: FeatureCardProps) {
  return (
    <TouchableOpacity
      className={`bg-dark-900 rounded-xl border border-dark-800 p-4 mb-3 ${disabled ? "opacity-50" : ""}`}
      onPress={onPress}
      disabled={disabled}
    >
      <View className="flex-row items-start gap-3">
        <Text className="text-2xl">{icon}</Text>
        <View className="flex-1">
          <Text className="text-white font-medium">{title}</Text>
          <Text className="text-dark-500 text-sm mt-1">{description}</Text>
        </View>
        {!disabled && <Text className="text-dark-500">›</Text>}
        {disabled && (
          <View className="bg-dark-800 px-2 py-1 rounded">
            <Text className="text-dark-500 text-xs">Soon</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ComplianceScreen() {
  const { isConnected, address } = useWalletStore()
  const { payments } = usePrivacyStore()
  const { disclosures, getActiveDisclosures } = useViewingKeys()

  const activeDisclosures = getActiveDisclosures()

  // Calculate compliance stats
  const compliantTxns = payments.filter((p) => p.privacyLevel === "compliant").length
  const totalTxns = payments.length
  const complianceRate = totalTxns > 0 ? Math.round((compliantTxns / totalTxns) * 100) : 0

  if (!isConnected) {
    return (
      <SafeAreaView className="flex-1 bg-dark-950">
        <View className="flex-row items-center px-6 py-4 border-b border-dark-900">
          <TouchableOpacity
            className="flex-row items-center"
            onPress={() => router.back()}
          >
            <Text className="text-2xl text-white">←</Text>
            <Text className="text-white ml-4 text-lg">Back</Text>
          </TouchableOpacity>
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-5xl mb-4">🔍</Text>
          <Text className="text-white font-semibold text-lg">Connect Wallet</Text>
          <Text className="text-dark-500 text-center mt-2">
            Connect your wallet to access compliance features
          </Text>
          <Button
            onPress={() => router.push("/(auth)/login")}
            style={{ marginTop: 24 }}
          >
            Connect Wallet
          </Button>
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
        <Text className="text-xl font-bold text-white">Compliance</Text>
        <View className="w-16" />
      </View>

      <ScrollView className="flex-1">
        <View className="px-6 pt-6">
          {/* Hero Section */}
          <View className="bg-brand-900/20 border border-brand-800/30 rounded-2xl p-6 mb-6">
            <View className="flex-row items-center gap-3 mb-3">
              <Text className="text-3xl">🏛️</Text>
              <View>
                <Text className="text-white text-lg font-bold">Institution Ready</Text>
                <Text className="text-dark-400 text-sm">{formatAddress(address)}</Text>
              </View>
            </View>
            <Text className="text-dark-400 text-sm">
              SIP provides privacy with compliance. Share viewing keys with auditors
              while keeping transaction details private from the public.
            </Text>
          </View>

          {/* Stats Row */}
          <View className="flex-row gap-3 mb-6">
            <StatCard
              icon="✅"
              title="Compliant"
              value={compliantTxns}
              subtitle="transactions"
            />
            <StatCard
              icon="🔑"
              title="Disclosures"
              value={activeDisclosures.length}
              subtitle="active keys"
            />
          </View>

          <View className="flex-row gap-3 mb-6">
            <StatCard
              icon="📊"
              title="Compliance"
              value={`${complianceRate}%`}
              subtitle="rate"
            />
            <StatCard
              icon="👁️"
              title="Viewing Keys"
              value={disclosures.length}
              subtitle="generated"
            />
          </View>

          {/* Features */}
          <Text className="text-dark-400 text-sm mb-3 uppercase">
            Compliance Tools
          </Text>

          <FeatureCard
            icon="🔑"
            title="Manage Viewing Keys"
            description="Create and share viewing keys with auditors"
            onPress={() => router.push("/settings/viewing-keys")}
          />

          <FeatureCard
            icon="📋"
            title="Export Audit Report"
            description="Generate PDF report of compliant transactions"
            disabled
          />

          <FeatureCard
            icon="⚙️"
            title="Disclosure Policies"
            description="Configure automatic disclosure rules"
            disabled
          />

          <FeatureCard
            icon="🔗"
            title="Auditor Integration"
            description="Connect with verified audit providers"
            disabled
          />

          {/* Info Card */}
          <View className="mt-6 mb-8 bg-green-900/10 border border-green-800/30 rounded-xl p-4">
            <View className="flex-row items-start gap-3">
              <Text className="text-xl">💼</Text>
              <View className="flex-1">
                <Text className="text-green-400 font-medium">
                  Privacy + Compliance
                </Text>
                <Text className="text-dark-400 text-sm mt-1">
                  SIP's viewing key system enables privacy-preserving compliance.
                  Share selective access with regulators while keeping your
                  transactions private from the public blockchain.
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
