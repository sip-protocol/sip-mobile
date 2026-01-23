import { Stack } from "expo-router"
import { View } from "react-native"

export default function SettingsLayout() {
  return (
    <View className="flex-1 bg-dark-950">
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#0a0a0a" },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="accounts" />
      </Stack>
    </View>
  )
}
