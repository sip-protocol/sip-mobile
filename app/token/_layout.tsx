import { Stack } from "expo-router"

export default function TokenLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="[mint]" />
    </Stack>
  )
}
