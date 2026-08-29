'use client'

import { useEffect, useRef, useState } from 'react'
import {
  creatorUrl,
  isConfigured,
  parseRpmEvent,
  RPM_ORIGIN,
  SUBSCRIBE_MESSAGE,
} from '@/lib/readyPlayerMe'

interface AvatarCreatorProps {
  /** Called with the finished avatar's .glb URL. */
  onExported: (glbUrl: string) => void
  onCancel?: () => void
  height?: number
}

/**
 * Embeds the Ready Player Me 3D avatar creator.
 *
 * Renders nothing when RPM has no subdomain configured, so the caller can fall
 * back to the vector picker rather than showing a broken frame.
 */
export default function AvatarCreator({ onExported, onCancel, height = 560 }: AvatarCreatorProps) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!isConfigured()) return

    const onMessage = (e: MessageEvent) => {
      // Only trust the creator's own origin. Without this check any frame or
      // opener on the page could post a crafted "avatar exported" message and
      // choose the URL we save against the user's profile.
      if (e.origin !== RPM_ORIGIN) return

      const ev = parseRpmEvent(e)
      if (!ev) return

      if (ev.eventName === 'v1.frame.ready') {
        // The frame emits nothing until subscribed.
        frameRef.current?.contentWindow?.postMessage(SUBSCRIBE_MESSAGE, RPM_ORIGIN)
        setReady(true)
        return
      }
      if (ev.eventName === 'v1.avatar.exported' && ev.data?.url) {
        onExported(String(ev.data.url))
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [onExported])

  if (!isConfigured()) return null

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border-2 border-slate-200 bg-slate-50">
      {!ready && (
        <div className="absolute inset-0 grid place-items-center bg-slate-50 z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-600 mx-auto mb-3" />
            <p className="text-sm text-slate-600">Loading the character creator…</p>
            <p className="text-xs text-slate-400 mt-1">This one takes a moment — it&apos;s fully 3D.</p>
          </div>
        </div>
      )}
      <iframe
        ref={frameRef}
        title="Create your 3D character"
        src={creatorUrl({ bodyType: 'halfbody' })}
        allow="camera *; microphone *; clipboard-write"
        className="w-full border-0"
        style={{ height }}
      />
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-3 right-3 z-20 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow hover:bg-white"
        >
          Use the simple picker instead
        </button>
      )}
    </div>
  )
}
