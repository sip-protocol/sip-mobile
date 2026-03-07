/**
 * Privacy Screen
 *
 * Central hub for all privacy features:
 * - Scan for payments
 * - Claim payments
 * - Viewing keys management
 * - Compliance tools
 * - Privacy score
 * - Privacy provider selection
 */

import { View, Text, TouchableOpacity, ScrollView } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { ICONS, ICON_COLORS } from "@/constants/icons"

interface PrivacyFeature {
  icon: React.ReactNode
  label: string
  desc: string
  route: string
}

export default function PrivacyScreen() {
  const features: PrivacyFeature[] = [
    {
      icon: <ICONS.actions.search size={22} color={ICON_COLORS.brand} weight="fill" />,
      label: "Scan for Payments",
      desc: "Check for incoming stealth payments",
      route: "/scan",
    },
    {
      icon: <ICONS.transaction.receive size={22} color={ICON_COLORS.brand} weight="fill" />,
      label: "Claim Payments",
      desc: "Claim your received stealth payments",
      route: "/claim",
    },
    {
      icon: <ICONS.wallet.viewingKeys size={22} color={ICON_COLORS.brand} weight="fill" />,
      label: "Viewing Keys",
      desc: "Manage selective disclosure keys",
      route: "/settings/viewing-keys",
    },
    {
      icon: <ICONS.privacy.shielded size={22} color={ICON_COLORS.brand} weight="fill" />,
      label: "Compliance",
      desc: "Audit trail and compliance tools",
      route: "/compliance",
    },
    {
      icon: <ICONS.privacy.score size={22} color={ICON_COLORS.brand} weight="fill" />,
      label: "Privacy Score",
      desc: "Analyze your wallet privacy",
      route: "/settings/privacy-score",
    },
    {
      icon: <ICONS.privacy.provider size={22} color={ICON_COLORS.brand} weight="fill" />,
      label: "Privacy Provider",
      desc: "Choose your privacy backend",
      route: "/settings",
    },
  ]

  return (
    <SafeAreaView className="flex-1 bg-dark-950">
      <View className="px-6 py-4">
        <Text className="text-2xl font-bold text-white">Privacy</Text>
        <Text className="text-dark-400 mt-1">Manage your privacy features</Text>
      </View>
      <ScrollView className="flex-1 px-6">
        <View className="gap-3">
          {features.map((f) => (
            <TouchableOpacity
              key={f.label}
              className="bg-dark-900 rounded-xl p-4 flex-row items-center"
              onPress={() => router.push(f.route as any)}
              accessibilityRole="button"
              accessibilityLabel={f.label}
              accessibilityHint={f.desc}
            >
              <View className="w-10 h-10 bg-dark-800 rounded-lg items-center justify-center">
                {f.icon}
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-white font-semibold">{f.label}</Text>
                <Text className="text-dark-400 text-sm">{f.desc}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
        <View className="pb-8" />
      </ScrollView>
    </SafeAreaView>
  )
}
