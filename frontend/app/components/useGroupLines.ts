'use client'

import { useEffect, useState } from 'react'
import { readGroups } from '@/lib/groups'
import type { GroupLines } from './CrisisLines'

let loaded: Promise<GroupLines[]> | null = null

/** The crisis lines of the groups someone belongs to (STEP 102; app/api/me/groups), for their crisis card. Read once
 *  per page load; nothing for someone signed out or in no group. */
export function useGroupLines(): GroupLines[] {
  const [groups, setGroups] = useState<GroupLines[]>([])
  useEffect(() => {
    loaded ??= fetch('/api/me/groups', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => readGroups(d).filter((g) => g.lines.length).map((g) => ({ name: g.name, lines: g.lines })))
      .catch(() => [])
    let live = true
    loaded.then((g) => { if (live) setGroups(g) })
    return () => { live = false }
  }, [])
  return groups
}

/** After joining or leaving a group (app/groups): read them again next time. */
export function forgetGroupLines() {
  loaded = null
}
