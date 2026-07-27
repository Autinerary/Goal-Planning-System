'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Eye, Flag, Target } from 'lucide-react'

interface SupervisionData {
  child: { id: string; name: string; email: string | null }
  payload: any | null
  updatedAt: string | null
  completedMilestoneIds: string[]
}

export default function ChildSupervisionPage() {
  const params = useParams()
  const childId = params.childId as string
  const [data, setData] = useState<SupervisionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch(`/api/family/children/${childId}/path`, { cache: 'no-store', credentials: 'include' })
        const j = await res.json()
        if (!res.ok) {
          setError(j.error || 'Could not load this child.')
          return
        }
        setData(j)
      } catch {
        setError('Could not load this child.')
      } finally {
        setLoading(false)
      }
    })()
  }, [childId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading…
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-slate-600">{error}</p>
        <Link href="/family" className="text-sm font-semibold text-purple-600 hover:underline">← Back to Family</Link>
      </div>
    )
  }

  const completed = new Set(data?.completedMilestoneIds || [])
  const races: any[] = data?.payload?.races || []
  const allMilestones: any[] = races.flatMap((r) => r.milestones || [])
  const totalDone = allMilestones.filter((m) => completed.has(m.id)).length
  const overall = allMilestones.length ? Math.round((totalDone / allMilestones.length) * 100) : 0

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/family" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Family
        </Link>

        <div className="flex items-center gap-2 mb-1">
          <Eye className="w-5 h-5 text-purple-500" />
          <h1 className="text-2xl font-bold text-slate-900">{data?.child.name}</h1>
        </div>
        <p className="text-slate-500 text-sm mb-6">
          Supervision view — read-only. {data?.child.email}
        </p>

        {!data?.payload ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center">
            <p className="text-slate-500 mb-2">No path yet.</p>
            <p className="text-sm text-slate-400">
              Once {data?.child.name} completes onboarding on their account, their goals and progress appear here.
            </p>
          </div>
        ) : (
          <>
            {/* Overall progress */}
            <div className="rounded-2xl border-2 border-slate-200 bg-white p-5 mb-5">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-slate-800 flex items-center gap-2"><Target className="w-4 h-4 text-cyan-500" /> Overall progress</span>
                <span className="text-sm font-bold text-cyan-600">{overall}%</span>
              </div>
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full transition-all" style={{ width: `${overall}%` }} />
              </div>
              <p className="text-xs text-slate-400 mt-2">{totalDone} of {allMilestones.length} milestones complete</p>
            </div>

            {/* Per-goal races */}
            <div className="space-y-3">
              {races.map((r: any, idx: number) => {
                const ms: any[] = r.milestones || []
                const done = ms.filter((m) => completed.has(m.id)).length
                const pct = ms.length ? Math.round((done / ms.length) * 100) : 0
                return (
                  <div key={r.id || idx} className="rounded-xl border-2 border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-slate-800 flex items-center gap-2"><Flag className="w-4 h-4 text-purple-500" /> {r.name}</span>
                      <span className="text-xs font-bold text-purple-600">{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5">{done}/{ms.length} milestones</p>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
