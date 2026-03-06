/**
 * Sidebar Context Provider
 *
 * Manages sidebar open/close state globally.
 * Consumed by avatar tap (open) and Sidebar component (visibility).
 */

import { createContext, useContext, useState, useCallback, useMemo } from "react"
import type { ReactNode } from "react"

// ============================================================================
// TYPES
// ============================================================================

interface SidebarContextType {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

// ============================================================================
// CONTEXT
// ============================================================================

const SidebarContext = createContext<SidebarContextType | null>(null)

// ============================================================================
// PROVIDER
// ============================================================================

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen((prev) => !prev), [])

  const value = useMemo(() => ({ isOpen, open, close, toggle }), [isOpen, open, close, toggle])

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  )
}

// ============================================================================
// HOOK
// ============================================================================

export function useSidebar(): SidebarContextType {
  const ctx = useContext(SidebarContext)
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider")
  return ctx
}
