# Token Icons: Remote Logos via TokenIcon Component

**Date:** 2026-03-05
**Status:** Approved
**Approach:** A — Wire existing `TokenIcon` component + expo-image caching

---

## Problem

All token icons render as emoji (◎, 💵, 🐕, etc.) instead of actual token logos. Three screens have duplicated `getTokenIcon()` emoji functions. The `TokenIcon` component exists but is unused.

## Design

### Fallback Chain

```
Remote logoUri (expo-image, cached) → Emoji → First letter
```

### Changes

1. **Add `expo-image` dependency** — disk + memory caching, blur placeholder
2. **Update `TokenIcon` component** — swap RN `Image` → `expo-image`'s `Image`
3. **Replace 3x `getTokenIcon()` with `<TokenIcon />`:**
   - `app/(tabs)/swap.tsx`
   - `app/swap/tokens.tsx`
   - `app/swap/history.tsx`
4. **Add `TokenIcon` to home Featured Tokens** — `app/(tabs)/index.tsx`

### TokenIcon Props (existing)

```typescript
interface TokenIconProps {
  token: TokenInfo    // has logoUri, symbol
  size?: 'sm' | 'md' | 'lg' | 'xl'  // 24/40/48/64px
  showBackground?: boolean
}
```

### Why This Approach

- Phantom, Jupiter, Solflare all use remote URLs + aggressive caching
- Scales to any token (custom imports, memecoins)
- Logos stay current (no stale bundled assets)
- expo-image: disk cache = instant after first load, blur placeholder during fetch
