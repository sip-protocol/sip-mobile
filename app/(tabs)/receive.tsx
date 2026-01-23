import { View, Text, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function ReceiveScreen() {
  const stealthAddress = 'sip:solana:02abc...123:03def...456'

  return (
    <SafeAreaView className="flex-1 bg-dark-950">
      <View className="flex-1 px-4 pt-6">
        <Text className="text-3xl font-bold text-white">Receive</Text>
        <Text className="text-dark-400 mt-1">
          Receive SOL or tokens privately
        </Text>

        {/* QR Code Placeholder */}
        <View className="mt-8 items-center">
          <View className="bg-white rounded-2xl p-6 w-64 h-64 items-center justify-center">
            <Text className="text-6xl">📱</Text>
            <Text className="text-dark-900 mt-4 text-center">
              QR Code
            </Text>
            <Text className="text-dark-500 text-sm text-center mt-1">
              Scan to receive privately
            </Text>
          </View>
        </View>

        {/* Stealth Address */}
        <View className="mt-8">
          <Text className="text-dark-400 text-sm mb-2">Stealth Address</Text>
          <View className="bg-dark-900 rounded-xl border border-dark-800 p-4">
            <Text className="text-white font-mono text-sm" numberOfLines={1}>
              {stealthAddress}
            </Text>
          </View>
          <TouchableOpacity className="mt-3 bg-dark-800 rounded-xl p-3 items-center">
            <Text className="text-brand-400 font-medium">Copy Address</Text>
          </TouchableOpacity>
        </View>

        {/* Info Card */}
        <View className="mt-6 bg-brand-900/10 border border-brand-800/30 rounded-xl p-4">
          <View className="flex-row items-start gap-3">
            <Text className="text-xl">🔒</Text>
            <View className="flex-1">
              <Text className="text-brand-400 font-medium">
                One-time stealth address
              </Text>
              <Text className="text-dark-400 text-sm mt-1">
                Each payment uses a unique address, making transactions
                unlinkable and preserving your privacy.
              </Text>
            </View>
          </View>
        </View>

        {/* Scan for Payments Button */}
        <TouchableOpacity className="mt-auto mb-6 bg-dark-800 rounded-xl p-4 items-center border border-dark-700">
          <Text className="text-white font-semibold">Scan for Payments</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}
