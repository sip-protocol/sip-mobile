import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  type TouchableOpacityProps,
} from "react-native"

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger"
type ButtonSize = "sm" | "md" | "lg"

interface ButtonProps extends TouchableOpacityProps {
  children: React.ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  fullWidth?: boolean
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-brand-600 border-brand-600",
  secondary: "bg-dark-800 border-dark-700",
  outline: "bg-transparent border-dark-600",
  ghost: "bg-transparent border-transparent",
  danger: "bg-red-600 border-red-600",
}

const variantTextStyles: Record<ButtonVariant, string> = {
  primary: "text-white",
  secondary: "text-white",
  outline: "text-white",
  ghost: "text-dark-300",
  danger: "text-white",
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-2",
  md: "px-4 py-3",
  lg: "px-6 py-4",
}

const textSizeStyles: Record<ButtonSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  disabled,
  className,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading

  return (
    <TouchableOpacity
      className={`
        rounded-xl border items-center justify-center flex-row
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${fullWidth ? "w-full" : ""}
        ${isDisabled ? "opacity-50" : ""}
        ${className ?? ""}
      `}
      disabled={isDisabled}
      activeOpacity={0.7}
      {...props}
    >
      {loading && (
        <ActivityIndicator
          size="small"
          color={variant === "ghost" ? "#a1a1aa" : "#ffffff"}
          className="mr-2"
        />
      )}
      <Text
        className={`font-semibold ${variantTextStyles[variant]} ${textSizeStyles[size]}`}
      >
        {children}
      </Text>
    </TouchableOpacity>
  )
}
