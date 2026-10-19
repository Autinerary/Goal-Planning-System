'use client'

import { useEffect, useRef } from 'react'

/**
 * Counts a Bite when someone reads a Tidbit to the end (the Tidbits round's
 * planning note, Goal 3): the end of the article is on screen, and they have
 * had the page open long enough to read some of it (a second for every 15
 * words, between 8 and 40 seconds), so scrolling straight to the bottom isn't
 * a Bite. Once per person: the server keeps them.
 */
export default function BiteTracker({
  postId,
  words,
  enabled,
  onBite,
}: {
  postId: string
  words: number
  enabled: boolean
  onBite: (first: boolean) => void
}) {
  const marker = useRef<HTMLDivElement>(null)
  const done = useRef(false)
  useEffect(() => {
    if (!enabled || done.current || !marker.current) return
    const opened = Date.now()
    const need = Math.min(40, Math.max(8, Math.round(words / 15))) * 1000
    let waiting: ReturnType<typeof setTimeout> | null = null
    const record = async () => {
      if (done.current) return
      done.current = true
      const res = await fetch(`/api/community/posts/${postId}/bite`, { method: 'POST', credentials: 'include' }).catch(() => null)
      const d = await res?.json().catch(() => null)
      if (res?.ok && d?.first) onBite(true)
    }
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return
      const left = need - (Date.now() - opened)
      if (left <= 0) void record()
      else if (!waiting) waiting = setTimeout(() => void record(), left)
    })
    observer.observe(marker.current)
    return () => {
      observer.disconnect()
      if (waiting) clearTimeout(waiting)
    }
  }, [postId, words, enabled, onBite])
  return <div ref={marker} aria-hidden="true" className="h-px" />
}
