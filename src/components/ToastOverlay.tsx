import { View, Text, TouchableOpacity, Animated } from "react-native"
import { useEffect, useRef } from "react"
import { useToastStore } from "@/stores/toast"
import {
  CheckCircleIcon,
  WarningCircleIcon,
  InfoIcon,
  XCircleIcon,
  XIcon,
} from "phosphor-react-native"

const ICON_MAP = {
  success: { Icon: CheckCircleIcon, color: "#22c55e" },
  error: { Icon: XCircleIcon, color: "#ef4444" },
  warning: { Icon: WarningCircleIcon, color: "#f59e0b" },
  info: { Icon: InfoIcon, color: "#3b82f6" },
} as const

const BG_MAP = {
  success: "bg-green-900/90",
  error: "bg-red-900/90",
  warning: "bg-amber-900/90",
  info: "bg-blue-900/90",
} as const

function ToastItem({ id, type, title, message }: {
  id: string
  type: "success" | "error" | "warning" | "info"
  title: string
  message?: string
}) {
  const { removeToast } = useToastStore()
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(-20)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start()
  }, [])

  const { Icon, color } = ICON_MAP[type] ?? ICON_MAP.info
  const bg = BG_MAP[type] ?? BG_MAP.info

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <View className={`${bg} rounded-xl mx-4 mb-2 p-3 flex-row items-start border border-dark-700`}>
        <Icon size={20} color={color} weight="fill" />
        <View className="flex-1 ml-2">
          <Text className="text-white font-medium text-sm">{title}</Text>
          {message && <Text className="text-dark-300 text-xs mt-0.5">{message}</Text>}
        </View>
        <TouchableOpacity onPress={() => removeToast(id)} hitSlop={8}>
          <XIcon size={16} color="#666" weight="bold" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  )
}

export function ToastOverlay() {
  const { toasts } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <View
      className="absolute top-14 left-0 right-0 z-50"
      pointerEvents="box-none"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} id={t.id} type={t.type} title={t.title} message={t.message} />
      ))}
    </View>
  )
}
