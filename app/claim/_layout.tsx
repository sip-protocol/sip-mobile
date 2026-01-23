/**
 * Claim Screen Layout
 */

import { Stack } from "expo-router"

export default function ClaimLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    />
  )
}
