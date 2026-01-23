import { View, Text, TextInput, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useState } from 'react'

export default function SwapScreen() {
  const [fromAmount, setFromAmount] = useState('')
  const [isPrivate, setIsPrivate] = useState(true)

  return (
    <SafeAreaView className="flex-1 bg-dark-950">
      <View className="flex-1 px-4 pt-6">
        <Text className="text-3xl font-bold text-white">Swap</Text>
        <Text className="text-dark-400 mt-1">
          Swap tokens privately with Jupiter
        </Text>

        {/* From Token */}
        <View className="mt-8">
          <Text className="text-dark-400 text-sm mb-2">From</Text>
          <View className="bg-dark-900 rounded-xl border border-dark-800 p-4">
            <View className="flex-row justify-between items-center">
              <TouchableOpacity className="flex-row items-center gap-2 bg-dark-800 rounded-lg px-3 py-2">
                <Text className="text-xl">◎</Text>
                <Text className="text-white font-medium">SOL</Text>
                <Text className="text-dark-400">▼</Text>
              </TouchableOpacity>
              <TextInput
                className="text-2xl font-bold text-white text-right flex-1 ml-4"
                placeholder="0.00"
                placeholderTextColor="#71717a"
                keyboardType="numeric"
                value={fromAmount}
                onChangeText={setFromAmount}
              />
            </View>
            <Text className="text-dark-500 mt-2 text-right">Balance: 0.00</Text>
          </View>
        </View>

        {/* Swap Direction */}
        <View className="items-center my-4">
          <TouchableOpacity className="bg-dark-800 rounded-full p-3 border border-dark-700">
            <Text className="text-xl">↕️</Text>
          </TouchableOpacity>
        </View>

        {/* To Token */}
        <View>
          <Text className="text-dark-400 text-sm mb-2">To</Text>
          <View className="bg-dark-900 rounded-xl border border-dark-800 p-4">
            <View className="flex-row justify-between items-center">
              <TouchableOpacity className="flex-row items-center gap-2 bg-dark-800 rounded-lg px-3 py-2">
                <Text className="text-xl">🪙</Text>
                <Text className="text-white font-medium">USDC</Text>
                <Text className="text-dark-400">▼</Text>
              </TouchableOpacity>
              <Text className="text-2xl font-bold text-dark-500 text-right flex-1 ml-4">
                0.00
              </Text>
            </View>
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
                  {isPrivate ? 'Private Swap' : 'Public Swap'}
                </Text>
                <Text className="text-dark-500 text-xs">
                  {isPrivate ? 'Trade amounts hidden' : 'Visible on-chain'}
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

        {/* Route Info */}
        <View className="mt-4 bg-dark-900 rounded-xl border border-dark-800 p-4">
          <View className="flex-row justify-between">
            <Text className="text-dark-400">Route</Text>
            <Text className="text-white">Jupiter Aggregator</Text>
          </View>
          <View className="flex-row justify-between mt-2">
            <Text className="text-dark-400">Price Impact</Text>
            <Text className="text-brand-400">~0.01%</Text>
          </View>
        </View>

        {/* Swap Button */}
        <TouchableOpacity
          className="mt-auto mb-6 bg-brand-600 rounded-xl p-4 items-center"
          disabled={!fromAmount}
        >
          <Text className="text-white font-semibold text-lg">
            {isPrivate ? 'Swap Privately' : 'Swap'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}
