/**
 * Test Setup
 *
 * Mocks for React Native and Expo modules
 */

import { vi, beforeEach } from "vitest"

// Mock AsyncStorage
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(() => Promise.resolve(null)),
    setItem: vi.fn(() => Promise.resolve()),
    removeItem: vi.fn(() => Promise.resolve()),
    clear: vi.fn(() => Promise.resolve()),
    getAllKeys: vi.fn(() => Promise.resolve([])),
    multiGet: vi.fn(() => Promise.resolve([])),
    multiSet: vi.fn(() => Promise.resolve()),
  },
}))

// Mock expo-secure-store
vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(() => Promise.resolve(null)),
  setItemAsync: vi.fn(() => Promise.resolve()),
  deleteItemAsync: vi.fn(() => Promise.resolve()),
  isAvailableAsync: vi.fn(() => Promise.resolve(true)),
}))

// Mock expo-local-authentication
vi.mock("expo-local-authentication", () => ({
  hasHardwareAsync: vi.fn(() => Promise.resolve(true)),
  isEnrolledAsync: vi.fn(() => Promise.resolve(true)),
  authenticateAsync: vi.fn(() =>
    Promise.resolve({ success: true, error: null })
  ),
  supportedAuthenticationTypesAsync: vi.fn(() => Promise.resolve([1, 2])),
  AuthenticationType: {
    FINGERPRINT: 1,
    FACIAL_RECOGNITION: 2,
  },
  SecurityLevel: {
    NONE: 0,
    SECRET: 1,
    BIOMETRIC: 2,
  },
}))

// Mock expo-file-system
vi.mock("expo-file-system", () => ({
  Paths: {
    document: { uri: "file:///mock/document/" },
    cache: { uri: "file:///mock/cache/" },
  },
  File: vi.fn().mockImplementation((dir, name) => ({
    uri: `${dir?.uri || "file:///mock/"}${name}`,
    write: vi.fn(() => Promise.resolve()),
    read: vi.fn(() => Promise.resolve("")),
    exists: vi.fn(() => Promise.resolve(false)),
    delete: vi.fn(() => Promise.resolve()),
  })),
  documentDirectory: "file:///mock/document/",
  writeAsStringAsync: vi.fn(() => Promise.resolve()),
  readAsStringAsync: vi.fn(() => Promise.resolve("")),
}))

// Mock expo-sharing
vi.mock("expo-sharing", () => ({
  isAvailableAsync: vi.fn(() => Promise.resolve(true)),
  shareAsync: vi.fn(() => Promise.resolve()),
}))

// Mock expo-clipboard
vi.mock("expo-clipboard", () => ({
  setStringAsync: vi.fn(() => Promise.resolve(true)),
  getStringAsync: vi.fn(() => Promise.resolve("")),
}))

// Mock expo-linking
vi.mock("expo-linking", () => ({
  openURL: vi.fn(() => Promise.resolve(true)),
  canOpenURL: vi.fn(() => Promise.resolve(true)),
}))

// Mock expo-router
vi.mock("expo-router", () => ({
  router: {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    canGoBack: vi.fn(() => true),
  },
  useLocalSearchParams: vi.fn(() => ({})),
  useSegments: vi.fn(() => []),
  usePathname: vi.fn(() => "/"),
  Link: vi.fn(({ children }) => children),
  Stack: {
    Screen: vi.fn(() => null),
  },
}))

// Mock react-native
vi.mock("react-native", () => ({
  Platform: {
    OS: "ios",
    select: vi.fn((obj) => obj.ios || obj.default),
  },
  Dimensions: {
    get: vi.fn(() => ({ width: 375, height: 812 })),
  },
  StyleSheet: {
    create: vi.fn((styles) => styles),
    flatten: vi.fn((style) => style),
  },
  Keyboard: {
    dismiss: vi.fn(),
  },
  Linking: {
    openURL: vi.fn(() => Promise.resolve(true)),
    canOpenURL: vi.fn(() => Promise.resolve(true)),
  },
  View: "View",
  Text: "Text",
  TouchableOpacity: "TouchableOpacity",
  TextInput: "TextInput",
  ScrollView: "ScrollView",
  FlatList: "FlatList",
  ActivityIndicator: "ActivityIndicator",
  RefreshControl: "RefreshControl",
}))

// Mock react-native-safe-area-context
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: "SafeAreaView",
  SafeAreaProvider: vi.fn(({ children }) => children),
  useSafeAreaInsets: vi.fn(() => ({ top: 0, bottom: 0, left: 0, right: 0 })),
}))

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks()
})
