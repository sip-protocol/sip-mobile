/**
 * Stealth Address Slide (Slide 3)
 *
 * Demonstrates real stealth address generation.
 * Users can generate new addresses to see real cryptography in action.
 */

import { View, Text, Dimensions } from "react-native"
import {
  GhostIcon,
} from "phosphor-react-native"
import { StealthAddressDisplay } from "@/components/demos"
import { useStealthDemo } from "@/hooks"
import { ICON_COLORS } from "@/constants/icons"

const { width } = Dimensions.get("window")

// ============================================================================
// COMPONENT
// ============================================================================

export function StealthAddressSlide() {
  const { address, isGenerating, generate } = useStealthDemo()

  return (
    <View style={{ width }} className="flex-1 justify-center items-center px-6">
      {/* Icon */}
      <View
        className="w-20 h-20 rounded-2xl items-center justify-center mb-6"
        style={{ backgroundColor: "rgba(249, 115, 22, 0.15)" }}
      >
        <GhostIcon size={40} color={ICON_COLORS.orange} weight="fill" />
      </View>

      {/* Title */}
      <Text className="text-2xl font-bold text-white text-center mb-2">
        Stealth Addresses
      </Text>

      {/* Subtitle */}
      <Text className="text-dark-400 text-center text-base mb-6">
        One key, infinite unlinkable addresses
      </Text>

      {/* Stealth address display with generate button */}
      <View className="w-full">
        <StealthAddressDisplay
          address={address?.formatted ?? null}
          isGenerating={isGenerating}
          onGenerate={generate}
        />
      </View>

      {/* Explanation */}
      <View className="w-full mt-4 bg-dark-900 rounded-xl p-4 border border-dark-800">
        <Text className="text-dark-400 text-sm leading-5">
          Each payment uses a unique one-time address.{" "}
          <Text className="text-brand-400">No one can link your transactions</Text>{" "}
          — even the sender can't tell which addresses are yours.
        </Text>
      </View>

      {/* Simulation note */}
      <View className="flex-row items-center gap-2 mt-4">
        <View className="w-2 h-2 rounded-full bg-success-500" />
        <Text className="text-dark-500 text-xs">
          Real cryptography — keys not saved, just for simulation
        </Text>
      </View>
    </View>
  )
}
