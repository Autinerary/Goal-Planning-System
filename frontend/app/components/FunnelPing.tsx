'use client'

import { useEffect } from 'react'
import { track, type FunnelEvent } from '@/lib/funnel'

/** Records one funnel event when a page mounts (for server-rendered pages). */
export default function FunnelPing({ event }: { event: FunnelEvent }) {
  useEffect(() => {
    track(event)
  }, [event])
  return null
}
