'use client'

import { useEffect, useRef } from 'react'
import type { MediaItem } from '@/lib/media'
import { lengthLabel } from '@/lib/media'

/**
 * A video or an audio episode, following docs/voice.md: the browser's own
 * controls (keyboard and screen-reader friendly), nothing plays until someone
 * presses play, captions on by default, and the transcript right below.
 * With `resume`, the place reached is kept in this browser and the next play
 * starts from there (Group 11: "a 'resume' ... option" for episodes).
 */
export default function MediaPlayer({ item, resume = false }: { item: MediaItem; resume?: boolean }) {
  const ref = useRef<HTMLVideoElement & HTMLAudioElement>(null)
  const key = `autinerary_media_at_${item.id}`

  useEffect(() => {
    const el = ref.current
    if (!el || !resume) return
    const restore = () => {
      try {
        const at = Number(localStorage.getItem(key) || 0)
        if (at > 5 && at < el.duration - 5) el.currentTime = at
      } catch {}
    }
    let last = 0
    const save = () => {
      if (Math.abs(el.currentTime - last) < 5) return
      last = el.currentTime
      try {
        if (el.duration && el.currentTime > el.duration - 5) localStorage.removeItem(key)
        else localStorage.setItem(key, String(Math.floor(el.currentTime)))
      } catch {}
    }
    el.addEventListener('loadedmetadata', restore)
    el.addEventListener('timeupdate', save)
    el.addEventListener('pause', save)
    return () => {
      el.removeEventListener('loadedmetadata', restore)
      el.removeEventListener('timeupdate', save)
      el.removeEventListener('pause', save)
    }
  }, [key, resume])

  const track = item.captions ? <track kind="captions" srcLang="en" label="English" src={item.captions} default /> : null

  return (
    <figure>
      {item.kind === 'video' ? (
        <video
          ref={ref}
          controls
          preload="none"
          playsInline
          poster={item.poster}
          className="aspect-video w-full rounded-xl border border-slate-300 bg-slate-900 shadow-sm"
          aria-describedby={`${item.id}-about`}
        >
          <source src={item.src} type="video/mp4" />
          {track}
        </video>
      ) : (
        <audio ref={ref} controls preload="none" className="w-full" aria-describedby={`${item.id}-about`}>
          <source src={item.src} />
        </audio>
      )}
      <figcaption id={`${item.id}-about`} className="mt-2 text-sm text-slate-700">
        <span className="font-semibold text-slate-900">{item.title}</span> · {lengthLabel(item.seconds)}
        {item.note && <> · {item.note}</>}
      </figcaption>
      <details className="mt-2 text-sm text-slate-800">
        <summary className="cursor-pointer font-medium text-indigo-800 underline underline-offset-2">Read the transcript</summary>
        <div className="mt-2 space-y-2">
          {item.transcript.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      </details>
    </figure>
  )
}
