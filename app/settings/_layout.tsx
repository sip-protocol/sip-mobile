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
        <Stack.Screen name="index" />
        <Stack.Screen name="accounts" />
        <Stack.Screen name="backup" />
        <Stack.Screen name="security" />
        <Stack.Screen name="viewing-keys" />
        <Stack.Screen name="compliance" />
        <Stack.Screen name="privacy-score" />
      </Stack>
    </View>
  )
}
