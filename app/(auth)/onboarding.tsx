/**
 * Onboarding Screen (Mandatory)
 *
 * Interactive education-first onboarding for new users. Cannot be skipped.
 * 5 slides covering SIP Privacy features with hands-on demos:
 * 1. Welcome - Public vs Private comparison
 * 2. Private Payments - Toggle with blockchain visualizer
 * 3. Stealth Addresses - Real crypto demo
 * 4. Viewing Keys - Permission cards
 * 5. Security - Biometric check
 */

import { View, Text, Dimensions, useWindowDimensions } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { useState, useRef, useCallback, useMemo } from "react"
import { Button } from "@/components/ui"
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from "react-native-reanimated"
import type { SharedValue } from "react-native-reanimated"
import { useSettingsStore } from "@/stores/settings"
import {
  WelcomeSlide,
  PrivacyToggleSlide,
  StealthAddressSlide,
  ViewingKeysSlide,
  SecuritySlide,
} from "@/components/onboarding"

const { width } = Dimensions.get("window")
const SLIDE_COUNT = 5

// ============================================================================
// SLIDE COMPONENTS ARRAY
// ============================================================================

const SLIDE_COMPONENTS = [
  WelcomeSlide,
  PrivacyToggleSlide,
  StealthAddressSlide,
  ViewingKeysSlide,
  SecuritySlide,
]

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const scrollX = useSharedValue(0)
  const flatListRef = useRef<Animated.FlatList<number>>(null)
  const setOnboardingCompleted = useSettingsStore((s) => s.setOnboardingCompleted)
  const { height: windowHeight } = useWindowDimensions()

  // Calculate slide height (window minus safe areas and bottom controls ~180px)
  const slideHeight = windowHeight - 180

  // Slide indices for FlatList
  const slideIndices = useMemo(() => Array.from({ length: SLIDE_COUNT }, (_, i) => i), [])

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x
    },
  })

  const handleNext = useCallback(() => {
    if (currentIndex < SLIDE_COUNT - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      })
      setCurrentIndex(currentIndex + 1)
    } else {
      handleComplete()
    }
  }, [currentIndex])

  const handleComplete = useCallback(() => {
    setOnboardingCompleted()
    router.replace("/(auth)/wallet-setup")
  }, [setOnboardingCompleted])

  const renderSlide = useCallback(({ item }: { item: number }) => {
    const SlideComponent = SLIDE_COMPONENTS[item]
    if (!SlideComponent) return null
    return (
      <View style={{ width, height: slideHeight }}>
        <SlideComponent />
      </View>
    )
  }, [slideHeight])

  const keyExtractor = useCallback((item: number) => `slide-${item}`, [])

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: width,
      offset: width * index,
      index,
    }),
    []
  )

  const handleMomentumScrollEnd = useCallback(
    (e: { nativeEvent: { contentOffset: { x: number } } }) => {
      const index = Math.round(e.nativeEvent.contentOffset.x / width)
      setCurrentIndex(index)
    },
    []
  )

  const isLastSlide = currentIndex === SLIDE_COUNT - 1

  return (
    <SafeAreaView className="flex-1 bg-dark-950">
      {/* Slides - Centered vertically */}
      <View className="flex-1 justify-center items-center">
        <Animated.FlatList
          ref={flatListRef}
          data={slideIndices}
          renderItem={renderSlide}
          keyExtractor={keyExtractor}
          getItemLayout={getItemLayout}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          initialNumToRender={1}
          maxToRenderPerBatch={1}
          windowSize={3}
        />
      </View>

      {/* Pagination & Button */}
      <View className="px-6 pb-8">
        {/* Dots */}
        <View className="flex-row justify-center mb-4">
          {slideIndices.map((index) => (
            <PaginationDot key={index} index={index} scrollX={scrollX} />
          ))}
        </View>

        {/* Slide count */}
        <Text className="text-dark-500 text-sm font-medium text-center mb-6">
          {currentIndex + 1} of {SLIDE_COUNT}
        </Text>

        {/* Action Button */}
        <Button fullWidth size="lg" onPress={handleNext}>
          {isLastSlide ? "Get Started" : "Next"}
        </Button>
      </View>
    </SafeAreaView>
  )
}

// ============================================================================
// PAGINATION DOT
// ============================================================================

function PaginationDot({
  index,
  scrollX,
}: {
  index: number
  scrollX: SharedValue<number>
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * width,
      index * width,
      (index + 1) * width,
    ]

    const dotWidth = interpolate(
      scrollX.value,
      inputRange,
      [8, 24, 8],
      Extrapolation.CLAMP
    )

    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0.3, 1, 0.3],
      Extrapolation.CLAMP
    )

    return {
      width: dotWidth,
      opacity,
    }
  })

  return (
    <Animated.View
      className="h-2 rounded-full bg-brand-600 mx-1"
      style={animatedStyle}
    />
  )
}
