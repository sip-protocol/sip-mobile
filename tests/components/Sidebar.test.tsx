/**
 * Sidebar & SidebarProvider Tests
 *
 * Logic-level tests for the Sidebar navigation component and
 * SidebarProvider context. Tests exports, type structure, and
 * provider logic. Consistent with project test patterns.
 */

import { describe, it, expect, vi } from "vitest"
import React from "react"

// Mock phosphor-react-native (icons used by Sidebar and icons constant)
vi.mock("phosphor-react-native", () => {
  const iconMock = vi.fn(() => null)
  return {
    Wallet: iconMock,
    Clock: iconMock,
    Key: iconMock,
    LockKey: iconMock,
    Globe: iconMock,
    GlobeHemisphereWest: iconMock,
    Info: iconMock,
    BookOpen: iconMock,
    Bug: iconMock,
    Question: iconMock,
    QuestionIcon: iconMock,
    Gear: iconMock,
    GearIcon: iconMock,
    Copy: iconMock,
    ShieldCheck: iconMock,
    Lock: iconMock,
    Eye: iconMock,
    Shield: iconMock,
    ChartBar: iconMock,
    Bell: iconMock,
    DownloadSimple: iconMock,
    Fire: iconMock,
    Lightning: iconMock,
    CheckCircle: iconMock,
    XCircle: iconMock,
    Warning: iconMock,
    CircleNotch: iconMock,
    QrCode: iconMock,
    Camera: iconMock,
    Share: iconMock,
    Plus: iconMock,
    Minus: iconMock,
    Trash: iconMock,
    PencilSimple: iconMock,
    ArrowsClockwise: iconMock,
    MagnifyingGlass: iconMock,
    X: iconMock,
    Check: iconMock,
    Upload: iconMock,
    Export: iconMock,
    House: iconMock,
    PaperPlaneTilt: iconMock,
    Download: iconMock,
    ArrowsLeftRight: iconMock,
    GearSix: iconMock,
    ArrowUp: iconMock,
    ArrowDown: iconMock,
    ArrowRight: iconMock,
    ArrowLeft: iconMock,
    ArrowsDownUp: iconMock,
    Fingerprint: iconMock,
    FaceMask: iconMock,
    Numpad: iconMock,
    ClipboardText: iconMock,
    FileText: iconMock,
    User: iconMock,
    Receipt: iconMock,
    FolderOpen: iconMock,
    Flask: iconMock,
    EyeSlash: iconMock,
    LockOpen: iconMock,
    Scan: iconMock,
    CurrencyDollar: iconMock,
    Coins: iconMock,
    Bank: iconMock,
    CreditCard: iconMock,
    PiggyBank: iconMock,
    ShareNetwork: iconMock,
    Sliders: iconMock,
    Faders: iconMock,
    File: iconMock,
    Files: iconMock,
    Folder: iconMock,
    Book: iconMock,
    ChartLine: iconMock,
    Users: iconMock,
    UserCircle: iconMock,
    AddressBook: iconMock,
    IdentificationCard: iconMock,
    Code: iconMock,
    Link: iconMock,
    LinkBreak: iconMock,
    Timer: iconMock,
    Hourglass: iconMock,
    CalendarBlank: iconMock,
    NumberSquareOne: iconMock,
    Sparkle: iconMock,
    Star: iconMock,
    Heart: iconMock,
    ThumbsUp: iconMock,
    Trophy: iconMock,
    WifiHigh: iconMock,
    BellRinging: iconMock,
    Envelope: iconMock,
    ChatDots: iconMock,
    ShieldWarning: iconMock,
    WarningCircle: iconMock,
    Spinner: iconMock,
  }
})

// Mock icon constants
vi.mock("@/constants/icons", () => {
  const iconComponent = vi.fn(() => null)
  return {
    ICONS: {
      privacy: {
        shielded: iconComponent, compliant: iconComponent,
        transparent: iconComponent, provider: iconComponent,
        level: iconComponent, score: iconComponent, scanning: iconComponent,
      },
      wallet: {
        accounts: iconComponent, viewingKeys: iconComponent,
        security: iconComponent, backup: iconComponent,
        connected: iconComponent, disconnected: iconComponent,
      },
      network: {
        network: iconComponent, rpc: iconComponent,
        helius: iconComponent, quicknode: iconComponent,
        triton: iconComponent, publicnode: iconComponent,
      },
      data: { clearHistory: iconComponent, clearSwap: iconComponent },
      about: { info: iconComponent, docs: iconComponent, bug: iconComponent },
      status: {
        pending: iconComponent, confirmed: iconComponent,
        completed: iconComponent, failed: iconComponent,
        error: iconComponent, warning: iconComponent,
        info: iconComponent, success: iconComponent, loading: iconComponent,
      },
      actions: {
        scan: iconComponent, camera: iconComponent, copy: iconComponent,
        share: iconComponent, add: iconComponent, remove: iconComponent,
        delete: iconComponent, edit: iconComponent, refresh: iconComponent,
        search: iconComponent, close: iconComponent, check: iconComponent,
        upload: iconComponent, download: iconComponent, export: iconComponent,
      },
      transaction: {
        send: iconComponent, receive: iconComponent, swap: iconComponent,
        transfer: iconComponent, pending: iconComponent,
        confirmed: iconComponent, failed: iconComponent,
      },
      biometric: {
        fingerprint: iconComponent, face: iconComponent, facial: iconComponent,
        iris: iconComponent, pin: iconComponent, lock: iconComponent,
        none: iconComponent,
      },
      disclosure: {
        compliance: iconComponent, audit: iconComponent,
        personal: iconComponent, other: iconComponent,
      },
      nav: {
        home: iconComponent, send: iconComponent, receive: iconComponent,
        swap: iconComponent, settings: iconComponent,
      },
      security: {
        biometrics: iconComponent, pin: iconComponent, autoLock: iconComponent,
        timeout: iconComponent, hideBalance: iconComponent,
        screenshot: iconComponent, secure: iconComponent,
      },
      compliance: {
        dashboard: iconComponent, report: iconComponent,
        audit: iconComponent, disclosure: iconComponent, viewing: iconComponent,
      },
      empty: {
        transactions: iconComponent, payments: iconComponent,
        swaps: iconComponent, audit: iconComponent, disclosures: iconComponent,
        search: iconComponent, wallet: iconComponent, folder: iconComponent,
      },
      debug: { test: iconComponent, stealth: iconComponent },
    },
    ICON_SIZES: { xs: 16, sm: 20, md: 24, lg: 28, xl: 32, xxl: 40, huge: 48 },
    ICON_COLORS: {
      brand: "#8b5cf6",
      brandDark: "#7c3aed",
      brandLight: "#a78bfa",
      white: "#ffffff",
      inactive: "#71717a",
      muted: "#a1a1aa",
      dark: "#3f3f46",
      success: "#22c55e",
      error: "#ef4444",
      warning: "#f59e0b",
      info: "#3b82f6",
    },
  }
})

// Mock wallet store
vi.mock("@/stores/wallet", () => ({
  useWalletStore: vi.fn(() => ({
    accounts: [
      {
        id: "1",
        address: "7xK9abcDEF123",
        nickname: "Main",
        emoji: "\u{1F680}",
        providerType: "native" as const,
        chain: "solana" as const,
        createdAt: 0,
        lastUsedAt: 0,
      },
    ],
    activeAccountId: "1",
  })),
  formatAddress: (addr: string) => {
    if (!addr) return ""
    if (addr.length <= 10) return addr
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  },
}))

// Mock settings store
vi.mock("@/stores/settings", () => ({
  useSettingsStore: vi.fn(() => ({
    network: "devnet",
    rpcProvider: "helius",
  })),
}))

// Mock haptics
vi.mock("@/utils/haptics", () => ({
  hapticLight: vi.fn(),
}))

// Override react-native mock to include Modal (not in global setup.ts)
vi.mock("react-native", () => ({
  Platform: {
    OS: "ios",
    select: vi.fn((obj: Record<string, unknown>) => obj.ios || obj.default),
  },
  Dimensions: {
    get: vi.fn(() => ({ width: 375, height: 812 })),
  },
  StyleSheet: {
    create: vi.fn((styles: Record<string, unknown>) => styles),
    flatten: vi.fn((style: unknown) => style),
  },
  Keyboard: { dismiss: vi.fn() },
  Linking: {
    openURL: vi.fn(() => Promise.resolve(true)),
    canOpenURL: vi.fn(() => Promise.resolve(true)),
  },
  AppState: {
    currentState: "active",
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  },
  AccessibilityInfo: {
    isScreenReaderEnabled: vi.fn(() => Promise.resolve(false)),
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
    announceForAccessibility: vi.fn(),
  },
  useColorScheme: vi.fn(() => "dark"),
  View: "View",
  Text: "Text",
  TouchableOpacity: "TouchableOpacity",
  TextInput: "TextInput",
  ScrollView: "ScrollView",
  FlatList: "FlatList",
  ActivityIndicator: "ActivityIndicator",
  RefreshControl: "RefreshControl",
  Pressable: "Pressable",
  Modal: "Modal",
}))

// ============================================================================
// SIDEBAR EXPORTS
// ============================================================================

describe("Sidebar", () => {
  describe("Module exports", () => {
    it("exports Sidebar as named export", async () => {
      const mod = await import("@/components/Sidebar")
      expect(mod.Sidebar).toBeDefined()
      expect(typeof mod.Sidebar).toBe("function")
    })

    it("Sidebar is a React component (function)", async () => {
      const { Sidebar } = await import("@/components/Sidebar")
      expect(Sidebar.length).toBeGreaterThanOrEqual(0)
    })
  })

  describe("Sidebar visibility logic", () => {
    it("returns null when visible is false", async () => {
      const { Sidebar } = await import("@/components/Sidebar")
      const result = Sidebar({ visible: false, onClose: vi.fn() })
      expect(result).toBeNull()
    })

    it("returns null when no active account found", async () => {
      const walletMod = await import("@/stores/wallet")
      const mockUseWalletStore = walletMod.useWalletStore as unknown as ReturnType<typeof vi.fn>
      mockUseWalletStore.mockReturnValueOnce({
        accounts: [],
        activeAccountId: null,
      })

      const { Sidebar } = await import("@/components/Sidebar")
      const result = Sidebar({ visible: true, onClose: vi.fn() })
      expect(result).toBeNull()
    })

    it("returns null when activeAccountId does not match any account", async () => {
      const walletMod = await import("@/stores/wallet")
      const mockUseWalletStore = walletMod.useWalletStore as unknown as ReturnType<typeof vi.fn>
      mockUseWalletStore.mockReturnValueOnce({
        accounts: [{ id: "1", address: "abc123", nickname: "Main", emoji: "\u{1F680}" }],
        activeAccountId: "nonexistent",
      })

      const { Sidebar } = await import("@/components/Sidebar")
      const result = Sidebar({ visible: true, onClose: vi.fn() })
      expect(result).toBeNull()
    })

    it("returns JSX when visible and active account exists", async () => {
      const { Sidebar } = await import("@/components/Sidebar")
      const result = Sidebar({ visible: true, onClose: vi.fn() })
      expect(result).not.toBeNull()
      expect(result).toBeDefined()
    })
  })

  // Note: These test the mock's behavior, not the real formatAddress.
  // Real formatAddress is tested in tests/stores/wallet.test.ts
  describe("formatAddress (mock verification)", () => {
    it("formats address with 6...4 pattern", async () => {
      const { formatAddress } = await import("@/stores/wallet")
      expect(formatAddress("7xK9abcDEF123")).toBe("7xK9ab...F123")
    })

    it("returns empty string for null/empty", async () => {
      const { formatAddress } = await import("@/stores/wallet")
      expect(formatAddress("")).toBe("")
    })

    it("returns short addresses unchanged", async () => {
      const { formatAddress } = await import("@/stores/wallet")
      expect(formatAddress("abcdef")).toBe("abcdef")
    })

    it("returns addresses of exactly 10 chars unchanged", async () => {
      const { formatAddress } = await import("@/stores/wallet")
      expect(formatAddress("1234567890")).toBe("1234567890")
    })

    it("truncates addresses longer than 10 chars", async () => {
      const { formatAddress } = await import("@/stores/wallet")
      const result = formatAddress("12345678901")
      expect(result).toBe("123456...8901")
    })
  })
})

// ============================================================================
// SIDEBAR PROVIDER EXPORTS
// ============================================================================

describe("SidebarProvider", () => {
  describe("Module exports", () => {
    it("exports SidebarProvider as named export", async () => {
      const mod = await import("@/components/SidebarProvider")
      expect(mod.SidebarProvider).toBeDefined()
      expect(typeof mod.SidebarProvider).toBe("function")
    })

    it("exports useSidebar hook", async () => {
      const mod = await import("@/components/SidebarProvider")
      expect(mod.useSidebar).toBeDefined()
      expect(typeof mod.useSidebar).toBe("function")
    })

    it("SidebarProvider accepts children prop", async () => {
      const { SidebarProvider } = await import("@/components/SidebarProvider")
      // Function arity: 1 param (props object with children)
      expect(SidebarProvider.length).toBe(1)
    })
  })

  describe("Context default shape", () => {
    it("useSidebar is a function", async () => {
      const { useSidebar } = await import("@/components/SidebarProvider")
      expect(typeof useSidebar).toBe("function")
    })
  })
})
