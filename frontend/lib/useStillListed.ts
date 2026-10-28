'use client'
import { useEffect, useMemo, useState } from 'react'
import { resourceIdOf, stillListed, type PlanTool } from './milestoneTools'
import type { ResourceLabels } from './resourceLabels'

/**
 * ResourceHub's labels for a plan's tools, and the plan's tools without the listings that were taken down
 * (stillListed). /api/resources/labels answers only for approved listings, up to 20 at a time.
 */
export function useStillListed(base: readonly PlanTool[], added: readonly PlanTool[]) {
  const [labels, setLabels] = useState<Record<string, ResourceLabels>>({})
  const [checked, setChecked] = useState<ReadonlySet<string>>(() => new Set())
  const ask = Array.from(new Set([...base, ...added].map(resourceIdOf).filter((x): x is string => !!x)))
  const askKey = ask.join(',')
  useEffect(() => {
    const need = ask.filter((id) => !checked.has(id)).slice(0, 20)
    if (!need.length) return
    let cancelled = false
    fetch(`/api/resources/labels?ids=${need.join(',')}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled || !j?.labels) return
        setLabels((prev) => ({ ...prev, ...j.labels }))
        setChecked((prev) => new Set([...Array.from(prev), ...need]))
      })
      .catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askKey, checked])
  const listed = useMemo(() => stillListed(base, checked, new Set(Object.keys(labels))), [base, checked, labels])
  return { labels, listed }
}
