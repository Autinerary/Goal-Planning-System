'use client'

import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Keyboard and focus for a dialog or drawer while it is open: Escape closes
 * it, focus moves into it, Tab stays inside it, and when it closes, focus goes
 * back to what had it before (usually the button that opened it).
 *
 * `panel` is the dialog's box; give it tabIndex={-1} so it can hold focus
 * itself when nothing inside it can. `initialFocus` is what gets focus first;
 * without it, the first thing in the box that can take focus.
 */
export function useDialogFocus(
  open: boolean,
  panel: RefObject<HTMLElement>,
  onClose: () => void,
  initialFocus?: RefObject<HTMLElement>
) {
  // The newest onClose, without running the effect again (which would move focus).
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusables = () =>
      Array.from(panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
        (el) => el.getClientRects().length > 0
      )
    const timer = window.setTimeout(() => {
      const box = panel.current
      if (!box || box.contains(document.activeElement)) return
      ;(initialFocus?.current ?? focusables()[0] ?? box).focus()
    }, 0)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Something inside (a menu, say) already used this Escape.
        if (e.defaultPrevented) return
        close.current()
        return
      }
      if (e.key !== 'Tab') return
      const box = panel.current
      // Not on screen (a drawer hidden on a wider screen): leave Tab alone.
      if (!box || box.getClientRects().length === 0) return
      const items = focusables()
      if (items.length === 0) {
        e.preventDefault()
        box.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      const outside = !box.contains(active)
      if (e.shiftKey ? active === first || outside : active === last || outside) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('keydown', onKey)
      if (opener && opener.isConnected) opener.focus()
    }
    // Runs as the dialog opens and closes; `panel` and `initialFocus` are refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
}
