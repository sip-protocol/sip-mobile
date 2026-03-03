/**
 * Viewing Keys Slide (Slide 4)
 *
 * Explains viewing keys and selective disclosure for compliance.
 * Uses expandable permission cards to show who sees what.
 */

import { View, Text, Dimensions, ScrollView } from "react-native"
import {
  KeyIcon,
  UserIcon,
  BuildingsIcon,
  EyeIcon,
} from "phosphor-react-native"
import { PermissionCard } from "@/components/demos"
import { ICON_COLORS } from "@/constants/icons"

const { width } = Dimensions.get("window")

// ============================================================================
// COMPONENT
// ============================================================================

export function ViewingKeysSlide() {
  return (
    <View style={{ width }} className="flex-1 justify-center px-6">
      {/* Icon */}
      <View className="items-center mb-6">
        <View
          className="w-20 h-20 rounded-2xl items-center justify-center"
          style={{ backgroundColor: "rgba(16, 185, 129, 0.15)" }}
        >
          <KeyIcon size={40} color={ICON_COLORS.success} weight="fill" />
        </View>
      </View>

      {/* Title */}
      <Text className="text-2xl font-bold text-white text-center mb-2">
        Viewing Keys
      </Text>

      {/* Subtitle */}
      <Text className="text-dark-400 text-center text-base mb-6">
        Privacy with compliance built-in
      </Text>

      {/* Permission cards in scrollable area */}
      <ScrollView
        className="flex-grow-0"
        style={{ maxHeight: 380 }}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <View className="gap-3 pb-2">
          <PermissionCard
            icon={UserIcon}
            title="You"
            accessLabel="Full access"
            level="full"
            iconColor={ICON_COLORS.brand}
            expandedDescription="Complete access to all transaction history, balances, and the ability to send funds. Your master keys control everything."
          />

          <PermissionCard
            icon={BuildingsIcon}
            title="Auditor"
            accessLabel="Read-only"
            level="partial"
            iconColor={ICON_COLORS.warning}
            expandedDescription="Share a read-only viewing key with auditors or regulators. They can verify transactions but cannot move funds."
          />

          <PermissionCard
            icon={EyeIcon}
            title="Public"
            accessLabel="Nothing"
            level="none"
            iconColor={ICON_COLORS.muted}
            expandedDescription="Without a viewing key, the public blockchain shows encrypted data only. Your privacy is protected by default."
          />
        </View>
      </ScrollView>

      {/* Hint */}
      <Text className="text-dark-500 text-sm text-center mt-4">
        Tap each card to learn more
      </Text>
    </View>
  )
}
