/**
 * Portfolio Stack Layout
 *
 * Routes:
 * - /portfolio → Privacy-first token portfolio
 */

import { Stack } from "expo-router"

export default function PortfolioLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0a0a0a" },
        animation: "slide_from_right",
      }}
    />
  )
}
