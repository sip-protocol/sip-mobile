import { Tabs } from 'expo-router'
import { View, Text } from 'react-native'

type TabIconProps = {
  focused: boolean
  label: string
  icon: string
}

function TabIcon({ focused, label, icon }: TabIconProps) {
  return (
    <View className="items-center justify-center">
      <Text className={`text-2xl ${focused ? 'opacity-100' : 'opacity-50'}`}>
        {icon}
      </Text>
      <Text
        className={`text-xs mt-1 ${
          focused ? 'text-brand-500 font-medium' : 'text-dark-400'
        }`}
      >
        {label}
      </Text>
    </View>
  )
}

export default function TabsLayout() {
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
            <TabIcon focused={focused} label="Home" icon="🏠" />
          ),
        }}
      />
      <Tabs.Screen
        name="send"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} label="Send" icon="↗️" />
          ),
        }}
      />
      <Tabs.Screen
        name="receive"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} label="Receive" icon="↙️" />
          ),
        }}
      />
      <Tabs.Screen
        name="swap"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} label="Swap" icon="🔄" />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} label="Settings" icon="⚙️" />
          ),
        }}
      />
    </Tabs>
  )
}
