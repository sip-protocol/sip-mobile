import React from "react"
import { View, Text, TouchableOpacity } from "react-native"

interface Props {
  children: React.ReactNode
  fallbackMessage?: string
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <View className="flex-1 bg-dark-950 items-center justify-center p-6">
          <Text className="text-white text-lg font-semibold mb-2">
            Something went wrong
          </Text>
          <Text className="text-dark-400 text-center mb-6">
            {this.props.fallbackMessage || "An unexpected error occurred."}
          </Text>
          <TouchableOpacity
            className="bg-brand-600 rounded-xl px-6 py-3"
            onPress={() => this.setState({ hasError: false })}
          >
            <Text className="text-white font-semibold">Try Again</Text>
          </TouchableOpacity>
        </View>
      )
    }

    return this.props.children
  }
}
