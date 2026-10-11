/**
 * The names of a path's milestones by id, from a saved path payload, whatever
 * shape it was saved in (payload.milestones, path_planning, races). Progress
 * rows only keep the id.
 */
export function milestoneNames(payload: any): Map<string, string> {
  const out = new Map<string, string>()
  if (!payload || typeof payload !== 'object') return out
  const add = (list: unknown) => {
    if (!Array.isArray(list)) return
    for (const m of list) {
      const id = m?.id != null ? String(m.id) : ''
      const name = String(m?.name || m?.title || '').trim()
      if (id && name && !out.has(id)) out.set(id, name)
    }
  }
  add(payload.milestones)
  add(payload.pathPlanning?.milestones)
  add(payload.path_planning?.milestones)
  for (const races of [payload.races, payload.path?.races]) {
    if (Array.isArray(races)) for (const r of races) add(r?.milestones)
  }
  return out
}
