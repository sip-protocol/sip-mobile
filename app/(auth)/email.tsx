/**
 * Email Login Screen — DEPRECATED
 *
 * Email/SMS login was provided by Privy, which has been removed.
 * This screen now redirects users to the wallet setup flow.
 *
 * The native wallet (useNativeWallet) is now the primary authentication method.
 */

import { View, Text, TouchableOpacity } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { Button } from "@/components/ui"

export default function EmailLoginScreen() {
  return (
    <SafeAreaView className="flex-1 bg-dark-950">
      <View className="flex-1 px-6 pt-6">
        {/* Header */}
        <TouchableOpacity
          className="flex-row items-center mb-8"
          onPress={() => router.back()}
        >
          <Text className="text-2xl text-white">←</Text>
          <Text className="text-white ml-4 text-lg">Back</Text>
        </TouchableOpacity>

        <View className="flex-1 items-center justify-center">
          <View className="w-20 h-20 bg-dark-800 rounded-2xl items-center justify-center mb-6">
            <Text className="text-4xl">✉️</Text>
          </View>

          <Text className="text-2xl font-bold text-white mb-4 text-center">
            Email Login Unavailable
          </Text>

          <Text className="text-dark-400 text-center mb-8 px-6">
            Email login has been replaced with native wallet management for
            enhanced security and privacy.
          </Text>

          <Button
            onPress={() => router.replace("/wallet-setup")}
            size="lg"
          >
            Set Up Native Wallet
          </Button>
        </View>
      </View>
    </SafeAreaView>
  )
}
