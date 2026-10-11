'use client'

import { useEffect, type RefObject } from 'react'

/**
 * Keeps a CSS variable on <html> equal to an element's height, so sticky
 * things can sit below it instead of sliding underneath (0px while the
 * element isn't shown). The top bar sets --nav-h: page headers that stuck at
 * top: 0 went under it once you scrolled, Back arrow and all (Riipen Labs,
 * Group 34: "pop-ups misaligned", "no back button").
 */
export function useCssHeightVar(ref: RefObject<HTMLElement | null>, name: string, active = true) {
  useEffect(() => {
    const root = document.documentElement
    const el = ref.current
    if (!active || !el) {
      root.style.setProperty(name, '0px')
      return
    }
    const set = () => root.style.setProperty(name, `${Math.round(el.getBoundingClientRect().height)}px`)
    set()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(set) : null
    observer?.observe(el)
    return () => {
      observer?.disconnect()
      root.style.setProperty(name, '0px')
    }
  }, [ref, name, active])
}
