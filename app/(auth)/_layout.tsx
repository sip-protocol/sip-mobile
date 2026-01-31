import { Stack } from "expo-router"
import { View } from "react-native"

export default function AuthLayout() {
  return (
    <View className="flex-1 bg-dark-950">
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#0a0a0a" },
          animation: "slide_from_right",
        }}
      >
        {/* Native Wallet Screens */}
        <Stack.Screen name="wallet-setup" />
        <Stack.Screen name="create-wallet" />
        <Stack.Screen name="import-wallet" />
        <Stack.Screen name="seed-vault-setup" />
        <Stack.Screen name="onboarding" />
      </Stack>
    </View>
  )
}
