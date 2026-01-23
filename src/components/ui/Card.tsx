import { View, type ViewProps } from "react-native"

type CardVariant = "default" | "elevated" | "outlined" | "filled"

interface CardProps extends ViewProps {
  children: React.ReactNode
  variant?: CardVariant
  padding?: "none" | "sm" | "md" | "lg"
}

const variantStyles: Record<CardVariant, string> = {
  default: "bg-dark-900 border border-dark-800",
  elevated: "bg-dark-900 shadow-lg",
  outlined: "bg-transparent border border-dark-700",
  filled: "bg-dark-800",
}

const paddingStyles: Record<"none" | "sm" | "md" | "lg", string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
}

export function Card({
  children,
  variant = "default",
  padding = "md",
  className,
  ...props
}: CardProps) {
  return (
    <View
      className={`
        rounded-xl
        ${variantStyles[variant]}
        ${paddingStyles[padding]}
        ${className ?? ""}
      `}
      {...props}
    >
      {children}
    </View>
  )
}
