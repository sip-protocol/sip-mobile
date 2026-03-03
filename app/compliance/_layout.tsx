import { Stack } from "expo-router"

export default function ComplianceLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0a0a0a" },
      }}
    />
  )
}
