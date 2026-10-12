'use client'

import { useAuth } from '../context/AuthContext'
import { DisplayButton, DisplayPanel, useDisplayToggle } from './DisplayToggle'

/**
 * Display, on the pages before an account: the home page, Start here,
 * sign-up and sign-in (Riipen Labs, Group 22: people arriving from a short
 * video need "sensory control before the animations load", and the setting
 * was "at step 8 of 9"). Light or dark, contrast, calm motion and text size,
 * kept on this device; the panel floats under the button, so the page around
 * it does not move.
 */
export default function PublicDisplay({ className = '' }: { className?: string }) {
  const { user } = useAuth()
  const display = useDisplayToggle()
  return (
    <div className={className}>
      <DisplayButton open={display.open} onToggle={display.toggle} className="py-1.5" />
      {display.open && (
        <div className="fixed right-3 top-16 z-[95] max-h-[calc(100vh-5rem)] w-[min(28rem,calc(100vw-1.5rem))] overflow-y-auto">
          <DisplayPanel onClose={display.close} visitor={!user} className="mb-0 shadow-2xl" />
        </div>
      )}
    </div>
  )
}
