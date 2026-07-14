'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, GitCompare, Trash2, Target, Trophy, Flag } from 'lucide-react'
import {
  loadSnapshots,
  deleteSnapshot,
  snapshotOverallProgress,
  type PathSnapshot,
} from '@/lib/pathSnapshots'

export default function ComparePathsPage() {
  const router = useRouter()
  const [snapshots, setSnapshots] = useState<PathSnapshot[]>([])
  const [leftId, setLeftId] = useState<string>('')
  const [rightId, setRightId] = useState<string>('')

  useEffect(() => {
    const load = () => {
      const snaps = loadSnapshots()
      setSnapshots(snaps)
      setLeftId((prev) => prev || snaps[0]?.id || '')
      setRightId((prev) => prev || snaps[1]?.id || '')
    }
    load()
    window.addEventListener('autinerary:snapshots', load)
    return () => window.removeEventListener('autinerary:snapshots', load)
  }, [])

  const left = snapshots.find((s) => s.id === leftId) || null
  const right = snapshots.find((s) => s.id === rightId) || null

  const handleDelete = (id: string) => {
    deleteSnapshot(id)
    const remaining = loadSnapshots()
    setSnapshots(remaining)
    if (leftId === id) setLeftId(remaining[0]?.id || '')
    if (rightId === id) setRightId(remaining[1]?.id || remaining[0]?.id || '')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-cyan-50/40">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-2">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <button onClick={() => router.back()} className="p-1 rounded-lg hover:bg-slate-100 text-slate-700"><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2"><GitCompare className="w-5 h-5 text-purple-600" /> Compare Paths</h1>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <p className="text-sm text-slate-600 mb-6">
          Save more than one path and compare them side by side to decide which direction fits you best.
          Snapshots are kept on this device.
        </p>

        {snapshots.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
            <GitCompare className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="text-slate-700 font-medium mb-1">No saved paths yet</p>
            <p className="text-sm text-slate-500 mb-4">
              Go to your Path and tap <span className="font-semibold">Save snapshot</span> to keep a version here,
              then generate a new path to compare against it.
            </p>
            <button onClick={() => router.push('/path')} className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-sm font-medium">
              Go to Path
            </button>
          </div>
        ) : (
          <>
            {/* Selectors */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <PathSelect label="Path A" value={leftId} onChange={setLeftId} snapshots={snapshots} />
              <PathSelect label="Path B" value={rightId} onChange={setRightId} snapshots={snapshots} />
            </div>

            {/* Side-by-side */}
            <div className="grid grid-cols-2 gap-3">
              <SnapshotColumn snapshot={left} onDelete={handleDelete} accent="cyan" />
              <SnapshotColumn snapshot={right} onDelete={handleDelete} accent="purple" />
            </div>

            {/* Quick verdict */}
            {left && right && left.id !== right.id && (
              <div className="mt-5 bg-white border border-slate-200 rounded-2xl p-4 text-sm text-slate-700">
                <span className="font-semibold">At a glance: </span>
                {snapshotOverallProgress(left) === snapshotOverallProgress(right)
                  ? 'Both paths are at the same overall progress.'
                  : `${snapshotOverallProgress(left) > snapshotOverallProgress(right) ? left.name : right.name} is further along overall.`}{' '}
                {left.data.races.length !== right.data.races.length &&
                  `${left.data.races.length > right.data.races.length ? left.name : right.name} has more races.`}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function PathSelect({ label, value, onChange, snapshots }: {
  label: string
  value: string
  onChange: (id: string) => void
  snapshots: PathSnapshot[]
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-400"
      >
        <option value="">— none —</option>
        {snapshots.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
    </label>
  )
}

function SnapshotColumn({ snapshot, onDelete, accent }: {
  snapshot: PathSnapshot | null
  onDelete: (id: string) => void
  accent: 'cyan' | 'purple'
}) {
  if (!snapshot) {
    return (
      <div className="bg-white/60 border border-dashed border-slate-300 rounded-2xl p-5 text-center text-sm text-slate-400 flex items-center justify-center min-h-[200px]">
        Select a path to compare
      </div>
    )
  }
  const overall = snapshotOverallProgress(snapshot)
  const ring = accent === 'cyan' ? 'border-cyan-200' : 'border-purple-200'
  const bar = accent === 'cyan' ? 'bg-cyan-500' : 'bg-purple-500'
  const chip = accent === 'cyan' ? 'bg-cyan-50 text-cyan-700' : 'bg-purple-50 text-purple-700'

  return (
    <div className={`bg-white border ${ring} rounded-2xl p-5 shadow-sm`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h3 className="font-bold text-slate-800 leading-tight">{snapshot.name}</h3>
          <p className="text-[11px] text-slate-400">{new Date(snapshot.createdAt).toLocaleDateString()}</p>
        </div>
        <button onClick={() => onDelete(snapshot.id)} className="p-1 text-slate-300 hover:text-rose-500" title="Delete snapshot">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {snapshot.data.ultimateDream && (
        <div className={`rounded-lg px-3 py-2 mb-3 text-xs ${chip}`}>
          <Trophy className="w-3 h-3 inline mr-1" /> {snapshot.data.ultimateDream}
        </div>
      )}

      {/* Overall progress */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>Overall progress</span>
          <span className="font-semibold text-slate-700">{overall}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full ${bar} rounded-full`} style={{ width: `${overall}%` }} />
        </div>
      </div>

      {/* Races */}
      <div className="space-y-2">
        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 flex items-center gap-1">
          <Flag className="w-3 h-3" /> {snapshot.data.races.length} race{snapshot.data.races.length === 1 ? '' : 's'}
        </div>
        {snapshot.data.races.slice(0, 6).map((r, i) => (
          <div key={r.id || i} className="text-xs">
            <div className="flex justify-between text-slate-600 mb-0.5">
              <span className="flex items-center gap-1"><Target className="w-3 h-3 text-slate-400" /> {r.name}</span>
              <span className="text-slate-400">{r.progress}%</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full ${bar} rounded-full`} style={{ width: `${r.progress}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
