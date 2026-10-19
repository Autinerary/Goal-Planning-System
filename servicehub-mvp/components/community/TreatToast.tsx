'use client'

import { useEffect, useState } from 'react'
import { ChefHat, Cookie } from 'lucide-react'

export interface Treat {
  kind: 'bite' | 'well-done'
  /** For a Well-Done: the rating given. */
  rating?: number
  /** Changes each time, so the same treat can play again. */
  key: number
}

/**
 * The little animation for a Bite (a cookie with a bite out of it) and a
 * Well-Done (a chef's hat) (the Tidbits round's planning note, Goal 3). It
 * pops up, says what happened to screen readers, and fades. With Reduce
 * motion on, it appears and goes without moving (globals.css).
 */
export default function TreatToast({ treat }: { treat: Treat | null }) {
  const [shown, setShown] = useState<Treat | null>(null)
  useEffect(() => {
    if (!treat) return
    setShown(treat)
    const t = setTimeout(() => setShown(null), 2200)
    return () => clearTimeout(t)
  }, [treat])

  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center">
      {shown && (
        <div key={shown.key} className="animate-treat flex items-center gap-2 rounded-full border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-lg">
          {shown.kind === 'bite' ? (
            <>
              <Cookie className="h-5 w-5 text-amber-700" aria-hidden="true" /> You took a Bite: thanks for reading to the end.
            </>
          ) : (
            <>
              <ChefHat className="h-5 w-5 text-amber-700" aria-hidden="true" /> Well done! You gave it {shown.rating} out of 5.
            </>
          )}
        </div>
      )}
    </div>
  )
}
