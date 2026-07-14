// Multi-Path snapshots (Odosa: "What if someone wants to generate another path
// just to compare the two?").
//
// A lightweight, client-side way to keep more than one path. The user can save
// the path they're currently viewing as a named snapshot, then open the Compare
// view to see two paths side by side. Stored in localStorage so it works without
// any backend/schema change; a future server-backed multi-path system can adopt
// the same shape.

export interface PathSnapshot {
  id: string
  name: string
  createdAt: string
  /** Trimmed copy of the path payload used by the Path/Races views. */
  data: {
    ultimateDream?: string
    races: Array<{ id?: string; name: string; progress: number; category?: string }>
    milestones?: Array<{ id?: string; name?: string }>
    goals?: string[]
  }
}

const LS_KEY = 'autinerary_path_snapshots'
const MAX_SNAPSHOTS = 8

export function loadSnapshots(): PathSnapshot[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persist(snapshots: PathSnapshot[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(snapshots.slice(0, MAX_SNAPSHOTS)))
    window.dispatchEvent(new CustomEvent('autinerary:snapshots'))
  } catch {
    /* quota — ignore */
  }
}

export function saveSnapshot(name: string, data: PathSnapshot['data']): PathSnapshot {
  const snapshot: PathSnapshot = {
    id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim() || `Path ${new Date().toLocaleDateString()}`,
    createdAt: new Date().toISOString(),
    data,
  }
  const next = [snapshot, ...loadSnapshots()]
  persist(next)
  return snapshot
}

export function deleteSnapshot(id: string): void {
  persist(loadSnapshots().filter((s) => s.id !== id))
}

export function renameSnapshot(id: string, name: string): void {
  persist(loadSnapshots().map((s) => (s.id === id ? { ...s, name: name.trim() || s.name } : s)))
}

/** Average progress across a snapshot's races (0–100). */
export function snapshotOverallProgress(snapshot: PathSnapshot): number {
  const races = snapshot.data.races || []
  if (races.length === 0) return 0
  return Math.round(races.reduce((sum, r) => sum + (r.progress || 0), 0) / races.length)
}
