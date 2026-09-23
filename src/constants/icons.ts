/**
 * Icon Constants
 *
 * Centralized Phosphor icon mappings for consistent UI.
 * Single source of truth for all icons used in the app.
 *
 * Usage:
 *   import { ICONS, ICON_SIZES, ICON_COLORS } from '@/constants/icons'
 *   <ICONS.privacy.shielded size={24} color={ICON_COLORS.brand} />
 *
 * Or with Icon component:
 *   import { Icon } from '@/components/ui'
 *   <Icon category="privacy" name="shielded" size="md" color="brand" />
 */

import {
  // Privacy & Security
  ShieldCheck,
  Shield,
  Eye,
  EyeSlash,
  Lock,
  LockKey,
  Key,
  Fingerprint,
  FaceMask,

  // Wallet & Finance
  Wallet,
  Receipt,

  // Navigation
  House,
  PaperPlaneTilt,
  Download,
  ArrowsLeftRight,
  GearSix,

  // Actions
  QrCode,
  Camera,
  Copy,
  Share,
  Plus,
  Minus,
  Check,
  X,
  ArrowsClockwise,
  MagnifyingGlass,
  Trash,
  PencilSimple,
  Upload,
  DownloadSimple,
  Export,

  // Status
  CheckCircle,
  XCircle,
  Clock,
  Warning,
  Info,
  CircleNotch,

  // Transaction
  ArrowUp,
  ArrowDown,
  ArrowRight,

  // Communication
  Bell,

  // Network & Settings
  Globe,
  GlobeHemisphereWest,
  Lightning,

  // Documents & Data
  ClipboardText,
  FileText,
  FolderOpen,
  BookOpen,
  ChartBar,

  // User
  User,

  // Misc
  Bug,
  Timer,
  Numpad,
  Flask,
  Fire,
} from "phosphor-react-native"

// ============================================================================
// ICON MAPPINGS
// ============================================================================

export const ICONS = {
  // Privacy Levels (send screen, settings)
  privacy: {
    shielded: ShieldCheck,
    compliant: Lock,
    transparent: Eye,
    provider: Shield,
    level: ShieldCheck,
    score: ChartBar,
    scanning: Bell,
  },

  // Wallet Section (settings)
  wallet: {
    accounts: Wallet,
    viewingKeys: Key,
    security: LockKey,
    backup: DownloadSimple,
    connected: Wallet,
    disconnected: Wallet,
  },

  // Network Section
  network: {
    network: Globe,
    rpc: GlobeHemisphereWest,
    helius: Fire,
    quicknode: Lightning,
    triton: GlobeHemisphereWest,
    publicnode: Globe,
  },

  // Data Section
  data: {
    clearHistory: Trash,
    clearSwap: ArrowsClockwise,
  },

  // About Section
  about: {
    info: Info,
    docs: BookOpen,
    bug: Bug,
  },

  // Status Icons
  status: {
    pending: Clock,
    confirmed: CheckCircle,
    completed: CheckCircle,
    failed: XCircle,
    error: XCircle,
    warning: Warning,
    info: Info,
    success: CheckCircle,
    loading: CircleNotch,
  },

  // Action Icons
  actions: {
    scan: QrCode,
    camera: Camera,
    copy: Copy,
    share: Share,
    add: Plus,
    remove: Minus,
    delete: Trash,
    edit: PencilSimple,
    refresh: ArrowsClockwise,
    search: MagnifyingGlass,
    close: X,
    check: Check,
    upload: Upload,
    download: DownloadSimple,
    export: Export,
  },

  // Transaction Icons
  transaction: {
    send: ArrowUp,
    receive: ArrowDown,
    swap: ArrowsLeftRight,
    transfer: ArrowRight,
    pending: Clock,
    confirmed: CheckCircle,
    failed: XCircle,
  },

  // Biometric Icons
  biometric: {
    fingerprint: Fingerprint,
    face: FaceMask,
    facial: FaceMask,
    iris: Eye,
    pin: Numpad,
    lock: Lock,
    none: Lock,
  },

  // Disclosure Purpose Icons
  disclosure: {
    compliance: ClipboardText,
    audit: MagnifyingGlass,
    personal: User,
    other: FileText,
  },

  // Navigation (tab bar - already using Phosphor)
  nav: {
    home: House,
    send: PaperPlaneTilt,
    receive: Download,
    swap: ArrowsLeftRight,
    settings: GearSix,
  },

  // Security Settings
  security: {
    biometrics: Fingerprint,
    pin: Numpad,
    autoLock: Timer,
    timeout: Clock,
    hideBalance: EyeSlash,
    screenshot: Camera,
    secure: Shield,
  },

  // Compliance
  compliance: {
    dashboard: ChartBar,
    report: FileText,
    audit: MagnifyingGlass,
    disclosure: ClipboardText,
    viewing: Eye,
  },

  // Empty States
  empty: {
    transactions: Receipt,
    payments: Wallet,
    swaps: ArrowsLeftRight,
    audit: FileText,
    disclosures: Key,
    search: MagnifyingGlass,
    wallet: Wallet,
    folder: FolderOpen,
  },

  // Test & Debug
  debug: {
    test: Flask,
    stealth: ShieldCheck,
  },
} as const

// ============================================================================
// ICON SIZES
// ============================================================================

export const ICON_SIZES = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 28,
  xl: 32,
  xxl: 40,
  huge: 48,
} as const

// ============================================================================
// ICON COLORS
// ============================================================================

export const ICON_COLORS = {
  // Brand
  brand: "#8b5cf6",
  brandDark: "#7c3aed",
  brandLight: "#a78bfa",

  // Neutral
  white: "#ffffff",
  inactive: "#71717a",
  muted: "#a1a1aa",
  dark: "#3f3f46",

  // Status
  success: "#22c55e",
  error: "#ef4444",
  warning: "#f59e0b",
  info: "#3b82f6",

  // Special
  cyan: "#06b6d4",
  green: "#22c55e",
  yellow: "#eab308",
  red: "#ef4444",
  blue: "#3b82f6",
  purple: "#8b5cf6",
  orange: "#f97316",
} as const

// ============================================================================
// TYPES
// ============================================================================

export type IconCategory = keyof typeof ICONS
export type IconSize = keyof typeof ICON_SIZES
export type IconColor = keyof typeof ICON_COLORS
