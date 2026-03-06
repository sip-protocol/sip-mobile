/**
 * Sidebar Context Provider
 *
 * Manages sidebar open/close state globally.
 * Consumed by avatar tap (open) and Sidebar component (visibility).
 */

import { createContext, useContext, useState, useCallback } from "react"
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

const SidebarContext = createContext<SidebarContextType>({
  isOpen: false,
  open: () => {},
  close: () => {},
  toggle: () => {},
})

// ============================================================================
// PROVIDER
// ============================================================================

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen((prev) => !prev), [])

  return (
    <SidebarContext.Provider value={{ isOpen, open, close, toggle }}>
      {children}
    </SidebarContext.Provider>
  )
}

// ============================================================================
// HOOK
// ============================================================================

export const useSidebar = () => useContext(SidebarContext)
