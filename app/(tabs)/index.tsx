import { View, Text, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-dark-950">
      <ScrollView className="flex-1 px-4">
        <View className="pt-6 pb-4">
          <Text className="text-3xl font-bold text-white">SIP Privacy</Text>
          <Text className="text-dark-400 mt-1">
            Private transactions on Solana
          </Text>
        </View>

        {/* Balance Card */}
        <View className="bg-dark-900 rounded-2xl p-6 mt-4 border border-dark-800">
          <Text className="text-dark-400 text-sm">Total Balance</Text>
          <Text className="text-4xl font-bold text-white mt-2">---.-- SOL</Text>
          <Text className="text-dark-500 mt-1">Connect wallet to view</Text>
        </View>

        {/* Quick Actions */}
        <View className="flex-row mt-6 gap-4">
          <View className="flex-1 bg-brand-900/20 border border-brand-800/30 rounded-xl p-4 items-center">
            <Text className="text-2xl">🔒</Text>
            <Text className="text-brand-400 mt-2 font-medium">Private</Text>
            <Text className="text-dark-500 text-xs mt-1">Shield funds</Text>
          </View>
          <View className="flex-1 bg-dark-900 border border-dark-800 rounded-xl p-4 items-center">
            <Text className="text-2xl">📊</Text>
            <Text className="text-white mt-2 font-medium">History</Text>
            <Text className="text-dark-500 text-xs mt-1">View activity</Text>
          </View>
          <View className="flex-1 bg-dark-900 border border-dark-800 rounded-xl p-4 items-center">
            <Text className="text-2xl">🔑</Text>
            <Text className="text-white mt-2 font-medium">Keys</Text>
            <Text className="text-dark-500 text-xs mt-1">Manage keys</Text>
          </View>
        </View>

        {/* Recent Activity */}
        <View className="mt-8">
          <Text className="text-lg font-semibold text-white mb-4">
            Recent Activity
          </Text>
          <View className="bg-dark-900 rounded-xl border border-dark-800 p-6 items-center">
            <Text className="text-dark-500">No transactions yet</Text>
            <Text className="text-dark-600 text-sm mt-2">
              Connect your wallet to get started
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
