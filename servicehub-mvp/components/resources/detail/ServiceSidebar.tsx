'use client'

import PositiveNote from '@/components/layout/PositiveNote'
import { useMyProfile } from '@/lib/useMyProfile'
import { normIds } from '@/lib/positive'

/** The service page's sidebar note: one for the person's norms, if they shared any (Goal 11). */
export default function ServiceSidebarNote() {
  const { profile } = useMyProfile()
  const ids = normIds((profile?.norms || []).flatMap((n) => [n.type, n.label]))
  if (!ids.length) return null
  return <PositiveNote norms={ids} onlyNorms variant="card" />
}
