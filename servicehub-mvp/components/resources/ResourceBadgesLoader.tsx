'use client'

import { useEffect, useState } from 'react'
import ResourceBadges, { type ResourceBadgeFlags } from './ResourceBadges'

/**
 * Self-contained: fetches its own resource's badges rather than requiring
 * every page that renders a resource card to thread the data through.
 * Renders nothing while loading and nothing if no badge applies — never a
 * skeleton implying a badge is coming.
 */
export default function ResourceBadgesLoader({ resourceId, surprisingFind = false }: { resourceId: string; surprisingFind?: boolean }) {
  const [flags, setFlags] = useState<ResourceBadgeFlags | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/resources/badges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resourceIds: [resourceId] }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled) setFlags(j?.badges?.[resourceId] || null) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [resourceId])

  if (!flags && !surprisingFind) return null
  return <ResourceBadges {...(flags || {})} surprisingFind={surprisingFind} />
}
