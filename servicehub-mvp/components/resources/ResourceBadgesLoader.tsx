'use client'

import { useEffect, useState } from 'react'
import ResourceBadges from './ResourceBadges'

/**
 * Self-contained: fetches its own resource's badges rather than requiring
 * every page that renders a resource card to thread the data through.
 * Renders nothing while loading and nothing if no badge applies — never a
 * skeleton implying a badge is coming.
 */
export default function ResourceBadgesLoader({ resourceId }: { resourceId: string }) {
  const [flags, setFlags] = useState<{ trending: boolean; highlyRequested: boolean; rare: boolean } | null>(null)

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

  if (!flags) return null
  return <ResourceBadges trending={flags.trending} highlyRequested={flags.highlyRequested} rare={flags.rare} />
}
