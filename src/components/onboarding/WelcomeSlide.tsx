/**
 * Welcome Slide (Slide 1)
 *
 * Hero section introducing SIP Privacy with logo and comparison card.
 * Users can swipe/tap to see the difference between public and private views.
 */

import { View, Text, Dimensions, Image } from "react-native"
import { ComparisonCard } from "@/components/demos"

const { width } = Dimensions.get("window")

// ============================================================================
// COMPONENT
// ============================================================================

export function WelcomeSlide() {
  return (
    <View style={{ width }} className="flex-1 justify-center items-center px-6">
      {/* Logo */}
      <View className="mb-6">
        <Image
          // Metro asset load — static import would need a png module declaration
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          source={require("../../../assets/logo-mark.png")}
          className="w-24 h-24"
          resizeMode="contain"
          accessibilityLabel="SIP Privacy logo"
        />
      </View>

      {/* Title */}
      <Text className="text-3xl font-bold text-white text-center mb-2">
        Welcome to SIP Privacy
      </Text>

      {/* Subtitle */}
      <Text className="text-dark-400 text-center text-base mb-8">
        Your transactions, your business
      </Text>

      {/* Interactive comparison card */}
      <View className="w-full">
        <ComparisonCard
          publicData={{
            from: "7xKp3...9mR2",
            to: "9mRv2...4kTp",
            amount: "150 SOL",
          }}
          privateData={{
            from: "????????",
            to: "????????",
            amount: "????????",
          }}
          initiallyPrivate={false}
        />
      </View>

      {/* Hint */}
      <Text className="text-dark-500 text-sm text-center mt-4">
        Tap the card to compare public vs private
      </Text>
    </View>
  )
}
