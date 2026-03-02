import { Tabs, Redirect } from 'expo-router'
import { View, ActivityIndicator } from 'react-native'
import {
  HouseIcon,
  PaperPlaneTiltIcon,
  DownloadIcon,
  ArrowsLeftRightIcon,
  GearSixIcon,
} from "phosphor-react-native"
import type { IconProps } from 'phosphor-react-native'
import type { ComponentType } from 'react'
import { useWalletStore } from '@/stores/wallet'
import { useSettingsStore } from '@/stores/settings'

type TabIconProps = {
  focused: boolean
  Icon: ComponentType<IconProps>
}

function TabIcon({ focused, Icon }: TabIconProps) {
  return (
    <View className="items-center justify-center">
      <Icon
        size={28}
        weight={focused ? 'fill' : 'regular'}
        color={focused ? '#8b5cf6' : '#71717a'}
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
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0a0a0a',
          borderTopColor: '#27272a',
          borderTopWidth: 1,
          height: 80,
          paddingTop: 10,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} Icon={HouseIcon} />
          ),
        }}
      />
      <Tabs.Screen
        name="send"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} Icon={PaperPlaneTiltIcon} />
          ),
        }}
      />
      <Tabs.Screen
        name="receive"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} Icon={DownloadIcon} />
          ),
        }}
      />
      <Tabs.Screen
        name="swap"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} Icon={ArrowsLeftRightIcon} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} Icon={GearSixIcon} />
          ),
        }}
      />
    </Tabs>
  )
}
