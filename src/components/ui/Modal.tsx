import {
  Modal as RNModal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  type ModalProps as RNModalProps,
} from "react-native"

interface ModalProps extends Omit<RNModalProps, "children"> {
  children: React.ReactNode
  title?: string
  onClose: () => void
  showCloseButton?: boolean
}

export function Modal({
  children,
  title,
  visible,
  onClose,
  showCloseButton = true,
  ...props
}: ModalProps) {
  return (
    <RNModal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      {...props}
    >
      {/* Backdrop */}
      <Pressable
        className="flex-1 bg-black/60 justify-end"
        onPress={onClose}
      >
        {/* Content container - stop propagation */}
        <Pressable
          className="bg-dark-950 rounded-t-3xl max-h-[90%]"
          onPress={(e) => e.stopPropagation()}
        >
          {/* Handle bar */}
          <View className="items-center pt-3 pb-2">
            <View className="w-10 h-1 bg-dark-700 rounded-full" />
          </View>

          {/* Header */}
          {(title || showCloseButton) && (
            <View className="flex-row items-center justify-between px-4 pb-4">
              <Text className="text-xl font-bold text-white">
                {title ?? ""}
              </Text>
              {showCloseButton && (
                <TouchableOpacity
                  onPress={onClose}
                  className="p-2"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text className="text-2xl text-dark-400">×</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Body */}
          <View className="px-4 pb-8">{children}</View>
        </Pressable>
      </Pressable>
    </RNModal>
  )
}

/**
 * Confirmation modal with actions
 */
export function ConfirmModal({
  visible,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmVariant = "primary",
}: {
  visible: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  confirmVariant?: "primary" | "danger"
}) {
  return (
    <Modal visible={visible} onClose={onClose} title={title}>
      <Text className="text-dark-300 mb-6">{message}</Text>

      <View className="flex-row gap-3">
        <TouchableOpacity
          className="flex-1 bg-dark-800 rounded-xl py-3 items-center"
          onPress={onClose}
        >
          <Text className="text-white font-medium">{cancelText}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className={`flex-1 rounded-xl py-3 items-center ${
            confirmVariant === "danger" ? "bg-red-600" : "bg-brand-600"
          }`}
          onPress={() => {
            onConfirm()
            onClose()
          }}
        >
          <Text className="text-white font-medium">{confirmText}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  )
}
