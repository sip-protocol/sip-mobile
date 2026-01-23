import { View, Text, TextInput, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useState } from 'react'

export default function SendScreen() {
  const [amount, setAmount] = useState('')
  const [recipient, setRecipient] = useState('')
  const [isPrivate, setIsPrivate] = useState(true)

  return (
    <SafeAreaView className="flex-1 bg-dark-950">
      <View className="flex-1 px-4 pt-6">
        <Text className="text-3xl font-bold text-white">Send</Text>
        <Text className="text-dark-400 mt-1">
          Send SOL or tokens privately
        </Text>

        {/* Amount Input */}
        <View className="mt-8">
          <Text className="text-dark-400 text-sm mb-2">Amount</Text>
          <View className="bg-dark-900 rounded-xl border border-dark-800 p-4">
            <TextInput
              className="text-3xl font-bold text-white"
              placeholder="0.00"
              placeholderTextColor="#71717a"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
            <Text className="text-dark-500 mt-2">≈ $0.00 USD</Text>
          </View>
        </View>

        {/* Recipient Input */}
        <View className="mt-6">
          <Text className="text-dark-400 text-sm mb-2">Recipient</Text>
          <View className="bg-dark-900 rounded-xl border border-dark-800 p-4">
            <TextInput
              className="text-white"
              placeholder="Wallet address or stealth address"
              placeholderTextColor="#71717a"
              value={recipient}
              onChangeText={setRecipient}
              autoCapitalize="none"
            />
          </View>
        </View>

        {/* Privacy Toggle */}
        <TouchableOpacity
          className={`mt-6 p-4 rounded-xl border ${
            isPrivate
              ? 'bg-brand-900/20 border-brand-700'
              : 'bg-dark-900 border-dark-800'
          }`}
          onPress={() => setIsPrivate(!isPrivate)}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <Text className="text-2xl">{isPrivate ? '🔒' : '🔓'}</Text>
              <View>
                <Text
                  className={`font-medium ${
                    isPrivate ? 'text-brand-400' : 'text-white'
                  }`}
                >
                  {isPrivate ? 'Private Transfer' : 'Public Transfer'}
                </Text>
                <Text className="text-dark-500 text-xs">
                  {isPrivate
                    ? 'Amount and recipient hidden'
                    : 'Visible on-chain'}
                </Text>
              </View>
            </View>
            <View
              className={`w-12 h-7 rounded-full ${
                isPrivate ? 'bg-brand-600' : 'bg-dark-700'
              } justify-center ${isPrivate ? 'items-end' : 'items-start'} px-1`}
            >
              <View className="w-5 h-5 bg-white rounded-full" />
            </View>
          </View>
        </TouchableOpacity>

        {/* Send Button */}
        <TouchableOpacity
          className="mt-auto mb-6 bg-brand-600 rounded-xl p-4 items-center"
          disabled={!amount || !recipient}
        >
          <Text className="text-white font-semibold text-lg">
            {isPrivate ? 'Send Privately' : 'Send'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}
