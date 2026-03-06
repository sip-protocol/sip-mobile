import { Tabs, Redirect } from "expo-router"
import { View, ActivityIndicator } from "react-native"
import { HouseIcon, ShieldIcon, ArrowsLeftRightIcon } from "phosphor-react-native"
import type { IconProps } from "phosphor-react-native"
import type { ComponentType } from "react"
import { useWalletStore } from "@/stores/wallet"
import { useSettingsStore } from "@/stores/settings"
import { ICON_COLORS } from "@/constants/icons"

type TabIconProps = {
  focused: boolean
  Icon: ComponentType<IconProps>
}

function TabIcon({ focused, Icon }: TabIconProps) {
  return (
    <View className="items-center justify-center">
      <Icon
        size={24}
        weight={focused ? "fill" : "regular"}
        color={focused ? ICON_COLORS.brand : ICON_COLORS.inactive}
      />
    </View>
  )
}

export default function TabsLayout() {
  const { _hasHydrated: walletHydrated, accounts } = useWalletStore()
  const { _hasHydrated: settingsHydrated, hasCompletedOnboarding } = useSettingsStore()

  // Wait for BOTH stores to hydrate before checking gates
  if (!walletHydrated || !settingsHydrated) {
    return (
      <View className="flex-1 bg-dark-950 items-center justify-center">
        <ActivityIndicator size="large" color="#8b5cf6" />
      </View>
    )
  }

  // Gate 1: Must complete onboarding first
  if (!hasCompletedOnboarding) {
    return <Redirect href="/(auth)/onboarding" />
  }

  // Gate 2: Must have wallet
  if (accounts.length === 0) {
    return <Redirect href="/(auth)/wallet-setup" />
  }

  return (
    <View className="flex-1 bg-dark-950">
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: "#0a0a0a",
            borderTopColor: "#27272a",
            borderTopWidth: 0.5,
            height: 80,
            paddingBottom: 20,
            paddingTop: 8,
          },
          tabBarActiveTintColor: ICON_COLORS.brand,
          tabBarInactiveTintColor: ICON_COLORS.inactive,
          tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ focused }) => (
              <TabIcon focused={focused} Icon={HouseIcon} />
            ),
          }}
        />
        <Tabs.Screen
          name="privacy"
          options={{
            title: "Privacy",
            tabBarIcon: ({ focused }) => (
              <TabIcon focused={focused} Icon={ShieldIcon} />
            ),
          }}
        />
        <Tabs.Screen
          name="swap"
          options={{
            title: "Swap",
            tabBarIcon: ({ focused }) => (
              <TabIcon focused={focused} Icon={ArrowsLeftRightIcon} />
            ),
          }}
        />
      </Tabs>
    </View>
  )
}
