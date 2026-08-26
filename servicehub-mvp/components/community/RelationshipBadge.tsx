'use client'

import { RELATIONSHIP_META, type Relationship } from '@/lib/trust/relationship'

/**
 * "Whose experience is this?" badge for Tidbits posts and answers (Odosa).
 *
 * We never verify identity — this is the author's own declaration, shown so
 * readers can weigh it themselves. Renders nothing when unknown rather than
 * guessing.
 */
export default function RelationshipBadge({
  relationship,
  className = '',
}: {
  relationship?: string | null
  className?: string
}) {
  if (!relationship) return null
  const meta = RELATIONSHIP_META[relationship as Relationship]
  if (!meta) return null
  return (
    <span
      className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${meta.className} ${className}`}
      title={meta.description}
    >
      {meta.label}
    </span>
  )
}
