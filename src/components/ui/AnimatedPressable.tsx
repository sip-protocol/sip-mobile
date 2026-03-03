/**
 * AnimatedPressable
 *
 * A TouchableOpacity wrapper that adds a subtle scale-down animation
 * on press using react-native-reanimated for smooth native-thread
 * animations. Drop-in replacement for TouchableOpacity with extra
 * press feedback.
 */

import { TouchableOpacity, type TouchableOpacityProps } from "react-native"
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated"

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity)

export const DEFAULT_SCALE_VALUE = 0.97

export interface AnimatedPressableProps extends TouchableOpacityProps {
  /** Scale factor on press (default: 0.97) */
  scaleValue?: number
}

export function AnimatedPressable({
  scaleValue = DEFAULT_SCALE_VALUE,
  onPressIn,
  onPressOut,
  style,
  ...props
}: AnimatedPressableProps) {
  const scale = useSharedValue(1)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <AnimatedTouchable
      {...props}
      style={[animatedStyle, style]}
      onPressIn={(e) => {
        scale.value = withSpring(scaleValue, {
          damping: 15,
          stiffness: 300,
        })
        onPressIn?.(e)
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, {
          damping: 15,
          stiffness: 300,
        })
        onPressOut?.(e)
      }}
    />
  )
}
