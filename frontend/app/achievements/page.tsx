'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Lock, RefreshCw, Trophy } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { ACHIEVEMENTS, type AchievementUnlock } from '@/lib/achievements'

export default function AchievementsPage() {
  const { fetchWithAuth, supabaseUser } = useAuth()
  const [friendCount, setFriendCount] = useState(0)
  const [unlocks, setUnlocks] = useState<AchievementUnlock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadAchievements = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetchWithAuth('/api/achievements', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not load achievements.')
      setFriendCount(typeof result.friendCount === 'number' ? result.friendCount : 0)
      setUnlocks(Array.isArray(result.unlocks) ? result.unlocks : [])
    } catch (loadError) {
      console.error('Could not load achievements:', loadError)
      setError(loadError instanceof Error ? loadError.message : 'Could not load achievements.')
    } finally {
      setLoading(false)
    }
  }, [fetchWithAuth])

  useEffect(() => {
    if (supabaseUser?.id) void loadAchievements()
  }, [loadAchievements, supabaseUser?.id])

  const unlocksById = new Map(unlocks.map(unlock => [unlock.achievement_id, unlock]))
  const earnedCount = ACHIEVEMENTS.filter(achievement => unlocksById.has(achievement.id)).length

  return (
    <section className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <header className="mb-8 rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-700 p-6 text-white shadow-lg sm:p-9">
        <div className="flex items-center gap-3">
          <Trophy aria-hidden="true" className="h-8 w-8" />
          <h1 className="text-3xl font-bold sm:text-4xl">Achievements</h1>
        </div>
        <p className="mt-3 max-w-2xl text-indigo-50">
          Small moments worth celebrating. Your achievements stay earned once you unlock them.
        </p>
        <p className="mt-5 text-sm font-semibold">
          {loading ? 'Checking your progress…' : `${earnedCount} of ${ACHIEVEMENTS.length} earned`}
        </p>
      </header>

      {error && (
        <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
          <p>{error}</p>
          <button type="button" onClick={() => void loadAchievements()} className="mt-2 inline-flex items-center gap-2 font-semibold underline">
            <RefreshCw aria-hidden="true" className="h-4 w-4" /> Try again
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {ACHIEVEMENTS.map(achievement => {
          const unlock = unlocksById.get(achievement.id)
          const earned = Boolean(unlock)
          const progress = achievement.threshold
            ? Math.min(friendCount, achievement.threshold)
            : earned ? 1 : 0
          const progressMax = achievement.threshold || 1

          return (
            <article
              key={achievement.id}
              className={`rounded-2xl border bg-white p-5 shadow-sm ${earned ? 'border-amber-300 ring-1 ring-amber-100' : 'border-slate-200'}`}
            >
              <div className="flex items-start gap-4">
                <span aria-hidden="true" className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl ${earned ? 'bg-amber-100' : 'bg-slate-100 grayscale'}`}>
                  {achievement.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-lg font-bold text-slate-900">{achievement.title}</h2>
                    {earned
                      ? <Check aria-label="Earned" className="h-5 w-5 shrink-0 text-emerald-600" />
                      : <Lock aria-label="Not yet earned" className="h-5 w-5 shrink-0 text-slate-400" />}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{achievement.description}</p>
                </div>
              </div>

              <div className="mt-5">
                {achievement.threshold ? (
                  <>
                    <div className="mb-2 flex justify-between text-sm text-slate-600">
                      <span>Connected friends</span>
                      <span className="font-semibold text-slate-900">{Math.min(friendCount, achievement.threshold)} / {achievement.threshold}</span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label={`${achievement.title} progress`}
                      aria-valuemin={0}
                      aria-valuemax={progressMax}
                      aria-valuenow={progress}
                      className="h-2.5 overflow-hidden rounded-full bg-slate-100"
                    >
                      <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${progress / progressMax * 100}%` }} />
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">
                    {earned && unlock
                      ? `Earned ${new Date(unlock.unlocked_at).toLocaleDateString()}`
                      : 'Available on Halloween'}
                  </p>
                )}
                {earned && unlock && achievement.threshold && (
                  <p className="mt-2 text-xs text-emerald-700">Earned {new Date(unlock.unlocked_at).toLocaleDateString()}</p>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
