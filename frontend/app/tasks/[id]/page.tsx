'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { BookOpen, Check, Lightbulb, Lock, Music, Pause, Play, PauseCircle, Unlock, Upload } from 'lucide-react'
import TaskCompanions from '../../components/TaskCompanions'
import StreakCelebration from '../../components/StreakCelebration'
import MotivationWheel from '../../components/MotivationWheel'
import MomentCapture from '../../components/MomentCapture'
import NoteToFutureSelf from '../../components/NoteToFutureSelf'
import PastYouNotes from '../../components/PastYouNotes'
import { recordActiveDay, getPendingCelebration, markCelebrated, getStreak } from '@/lib/streak'
import { notify } from '@/lib/notifications'
import { useAgentPath } from '../../context/AgentPathContext'
import { isTaskSoundEnabled, playTaskCompleteSound } from '../../../lib/taskSound'
import { usePreferences } from '../../context/usePreferences'
import { loadPreferences } from '@/lib/preferences'
import { doneThisWeek, togglePlanTaskDone } from '@/lib/planTaskDone'
import { guidanceFor } from '@/lib/guidanceData'
import { selectTodaysAnimal } from '@/lib/spiritAnimal'
import { socialAvailable } from '@/lib/moments'
import BackButton from '../../components/BackButton'
import CompanionSwitch from '../../components/CompanionSwitch'
import { GENERAL_TRICKS, todayIn } from '@/lib/taskDay'

/*
  TASK VIEW (Screen 5), redesigned (the team's notes, October 2026: "The
  screen overall needs a re-design"):
  ┌──────────────────────────────────────────────────────────────┐
  │ ← Back   Task: <name>   part of <milestone> · ~20 min  [Companion ◯] │
  ├───────────────────┬────────────────────────┬──────────────────┤
  │ Tricks & hacks    │ Motivation Wheel        │ From past you    │
  │ for this task     │ (one spin, at the start)│ Today's other    │
  │                   │ [ I've done it ✓ ]      │ tasks            │
  │                   │ [ Stop for now ]        │                  │
  │                   │ Music · Journal         │                  │
  └───────────────────┴────────────────────────┴──────────────────┘
  • "Today's trick/hack" showed the day's tasks; it now shows the tricks
    written for this task (helperTricks), then its milestone's tips.
  • One companion (your spirit animal), off unless you turn it on.
  • Done: celebrate, then "Capture this moment" (Hare World Social).
  • Stop for now: a note to future you, back on your next task.
*/

export default function TaskView() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-lg">Loading task…</div>}>
      <TaskViewContent />
    </Suspense>
  )
}

function TaskViewContent() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  // Ticks are saved with the account, shared with the calendar (lib/planTaskDone.ts).
  const { prefs, update: updatePreferences } = usePreferences()
  const completedTasks = doneThisWeek(prefs.planTaskDone)
  const [isPlaying, setIsPlaying] = useState(false)
  const [musicFile, setMusicFile] = useState<string | null>(null)
  const [completed, setCompleted] = useState(false)
  const [isDoneDancing, setIsDoneDancing] = useState(false)
  const [streakCelebration, setStreakCelebration] = useState<number | null>(null)
  const [capture, setCapture] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [social, setSocial] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const { pathPlanning, calendarOptimization, payload } = useAgentPath()
  const schedule: any[] = (payload?.schedule || calendarOptimization?.schedule || []) as any[]
  // Today is today's weekday in the schedule (it used to be the first day).
  const today = todayIn(schedule)
  const allTasks: any[] = [...schedule.flatMap((d) => d?.tasks || []), ...((pathPlanning?.tasks as any[]) || [])]

  const taskId = params.id as string
  const current = allTasks.find((t) => t?.id === taskId)
  // ?name= when opened from the calendar, so the real title shows.
  const nameParam = searchParams.get('name')
  const taskName = nameParam || current?.name || current?.title || taskId.replace(/_/g, ' ').replace(/-/g, ' ')
  const milestone = ((pathPlanning?.milestones as any[]) || []).find((m) => m?.id && m.id === current?.milestoneId)
  const minutes = current?.adjustedDuration || current?.estimatedDuration

  // Tricks for this task: its own (written with the plan), then its
  // milestone's tips, then general ones, said as such.
  const ownTricks: string[] = Array.isArray(current?.helperTricks) ? current.helperTricks.filter((t: unknown) => typeof t === 'string' && t.trim()) : []
  const milestoneTips = milestone ? guidanceFor((payload as any)?.milestoneGuidance, milestone.id, milestone.name)?.tips || [] : []
  const tricks = ownTricks.length ? ownTricks : milestoneTips.length ? milestoneTips : GENERAL_TRICKS
  const tricksSource = ownTricks.length ? 'Written for this task.' : milestoneTips.length ? `Tips for “${milestone?.name}”.` : 'General tricks that help many people.'

  const todaysTasks = ((today?.tasks || pathPlanning?.tasks || []) as any[])
    .slice(0, 8)
    .map((t: any, idx: number) => ({ id: t.id || `t${idx + 1}`, name: t.name || t.title || 'Task' }))
    .filter((t) => t.id !== taskId)

  // One companion, your spirit animal; off unless you turn it on.
  const companionOn = prefs.taskCompanion === true
  const todaysAnimal = selectTodaysAnimal(prefs.gamification?.animals, prefs.gamification?.mode, schedule as any)

  const toggleTask = (id: string) => {
    const done = loadPreferences().planTaskDone
    updatePreferences({ planTaskDone: togglePlanTaskDone(done, id) })
    if (!doneThisWeek(done).has(id)) playTaskCompleteSound()
  }
  const isDone = completed || completedTasks.has(taskId)

  const handleMusicUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setMusicFile(url)
    if (audioRef.current) {
      audioRef.current.src = url
      audioRef.current.play()
      setIsPlaying(true)
    }
  }

  const togglePlay = () => {
    if (!audioRef.current) return
    if (isPlaying) audioRef.current.pause()
    else audioRef.current.play()
    setIsPlaying(!isPlaying)
  }

  const handleDone = () => {
    setCompleted(true)
    const done = loadPreferences().planTaskDone
    if (!doneThisWeek(done).has(taskId)) updatePreferences({ planTaskDone: togglePlanTaskDone(done, taskId) })
    setIsDoneDancing(true)
    playCelebrationMusic()
    // Streak: completing a task marks today active.
    recordActiveDay()
    const streakMilestone = getPendingCelebration()
    if (streakMilestone) {
      setStreakCelebration(streakMilestone)
      markCelebrated(streakMilestone)
      notify({ title: `${streakMilestone}-day streak! 🔥`, body: 'You’re on a roll. Keep it going.', icon: '🔥', href: '/path' })
    } else {
      const { current: streak } = getStreak()
      notify({ title: 'Task complete! 🎉', body: streak > 0 ? `Nice work. You’re on a ${streak}-day streak.` : 'Nice work today.', icon: '✅', href: '/path' })
    }
    // A moment to celebrate, then "Capture this moment" (Hare World Social),
    // or straight back to the Calendar where that isn't switched on yet.
    socialAvailable().then((on) => {
      if (on) window.setTimeout(() => setCapture(true), streakMilestone ? 2600 : 1200)
      else window.setTimeout(() => router.replace('/calendar'), streakMilestone ? 5200 : 4000)
    })
  }

  // After capturing (or not): back to the Calendar. replace: Back from the
  // Calendar goes where you were before the task (Riipen Labs, Group 31).
  const afterCapture = () => {
    setCapture(false)
    router.replace('/calendar')
  }

  // The fanfare follows the sound setting (it used to always play).
  const playCelebrationMusic = () => {
    if (!isTaskSoundEnabled()) return
    try {
      const ctx = new AudioContext()
      const notes = [
        { freq: 523.25, start: 0.0, dur: 0.15 }, { freq: 659.25, start: 0.15, dur: 0.15 }, { freq: 783.99, start: 0.3, dur: 0.15 },
        { freq: 1046.5, start: 0.45, dur: 0.3 }, { freq: 783.99, start: 0.8, dur: 0.12 }, { freq: 1046.5, start: 0.95, dur: 0.12 },
        { freq: 1318.5, start: 1.1, dur: 0.4 },
      ]
      for (const n of notes) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.value = n.freq
        gain.gain.setValueAtTime(0.16, ctx.currentTime + n.start)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + n.start + n.dur)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(ctx.currentTime + n.start)
        osc.stop(ctx.currentTime + n.start + n.dur + 0.05)
      }
      setTimeout(() => ctx.close(), 1800)
    } catch {
      // Web Audio not available: celebrate silently.
    }
  }

  useEffect(() => {
    return () => {
      if (musicFile) URL.revokeObjectURL(musicFile)
    }
  }, [musicFile])

  useEffect(() => {
    socialAvailable().then(setSocial)
  }, [])

  return (
    <div className="min-h-screen text-slate-800 p-4 md:p-8 relative surface-veil">
      {companionOn && (
        <TaskCompanions energized={isDoneDancing} animal={todaysAnimal?.animal || null} taskName={taskName} onTurnOff={() => updatePreferences({ taskCompanion: false })} />
      )}
      <StreakCelebration milestone={streakCelebration} onDone={() => setStreakCelebration(null)} />
      <MomentCapture open={capture} kind="task" refId={taskId} title={taskName} onClose={afterCapture} />
      <NoteToFutureSelf
        open={stopping}
        taskRef={taskId}
        taskTitle={taskName}
        onClose={(saved) => {
          setStopping(false)
          if (saved) router.replace('/calendar')
        }}
      />
      <audio ref={audioRef} loop onEnded={() => setIsPlaying(false)} />
      <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleMusicUpload} />

      <div className="relative z-10 mx-auto max-w-5xl space-y-4">
        {/* The task */}
        <header className="rounded-2xl p-4 surface md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <BackButton fallback="/calendar" />
            <CompanionSwitch on={companionOn} onChange={(on) => updatePreferences({ taskCompanion: on })} />
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-700">Task</p>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{taskName}</h1>
          <p className="mt-1 text-sm text-slate-800">
            {milestone ? (
              <>
                Part of{' '}
                <Link href={`/milestones/${encodeURIComponent(milestone.id)}`} className="font-medium text-indigo-800 underline underline-offset-2">
                  {milestone.name}
                </Link>
              </>
            ) : null}
            {milestone && minutes ? ' · ' : null}
            {minutes ? `About ${minutes} min` : null}
            {isDone ? (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-900">
                <Check className="h-3 w-3" aria-hidden="true" /> Done this week
              </span>
            ) : null}
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-3">
          {/* Tricks & hacks for this task */}
          <section aria-labelledby="tricks-heading" className="rounded-2xl p-4 surface">
            <h2 id="tricks-heading" className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-900">
              <Lightbulb className="h-4 w-4 text-amber-600" aria-hidden="true" /> Tricks &amp; hacks
            </h2>
            <p className="mt-1 text-xs text-slate-700">{tricksSource}</p>
            <ul className="mt-3 space-y-2">
              {tricks.slice(0, 5).map((t: string, i: number) => (
                <li key={i} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-slate-900">
                  {t}
                </li>
              ))}
            </ul>
          </section>

          {/* Start, do, finish */}
          <section aria-label="Do the task" className="space-y-4">
            <MotivationWheel taskId={taskId} types={prefs.motivation?.types} />
            <div className="space-y-2 rounded-2xl p-4 text-center surface">
              <button
                type="button"
                onClick={handleDone}
                disabled={isDone}
                className={`w-full rounded-2xl px-6 py-4 text-xl font-bold shadow-lg transition-all ${isDone ? 'bg-emerald-600 text-white' : 'bg-indigo-700 text-white hover:bg-indigo-800'}`}
              >
                {isDone ? '✓ Done!' : 'I’ve done it'}
              </button>
              {!isDone && social && (
                <button
                  type="button"
                  onClick={() => setStopping(true)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-900 hover:bg-slate-50"
                >
                  <PauseCircle className="h-5 w-5" aria-hidden="true" /> Stop for now
                </button>
              )}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50">
                  <Upload className="h-3 w-3" aria-hidden="true" /> Music
                </button>
                {musicFile && (
                  <button type="button" onClick={togglePlay} className="inline-flex items-center gap-1 rounded-lg bg-indigo-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-800">
                    {isPlaying ? <Pause className="h-3 w-3" aria-hidden="true" /> : <Play className="h-3 w-3" aria-hidden="true" />}
                    {isPlaying ? 'Pause' : 'Play'}
                  </button>
                )}
                <Link
                  href={`/reflection?contextType=task&contextId=${encodeURIComponent(taskId)}&mode=write`}
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-100"
                >
                  <BookOpen className="h-3 w-3" aria-hidden="true" /> Journal
                </Link>
              </div>
              {musicFile && (
                <p className="text-[0.6875rem] text-slate-700">
                  <Music className="inline h-3 w-3" aria-hidden="true" /> Your music plays while you work.
                </p>
              )}
            </div>
          </section>

          {/* Notes from past you, and the rest of today */}
          <div className="space-y-4">
            <PastYouNotes />
            <section aria-labelledby="today-heading" className="rounded-2xl p-4 surface">
              <h2 id="today-heading" className="text-sm font-bold uppercase tracking-wide text-slate-900">
                Today&apos;s other tasks
              </h2>
              {todaysTasks.length === 0 ? (
                <p className="mt-2 text-sm text-slate-700">
                  Nothing else today.{' '}
                  <Link href="/calendar" className="font-semibold text-indigo-800 underline underline-offset-2">
                    Open your Calendar
                  </Link>
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {todaysTasks.map((task) => {
                    const done = completedTasks.has(task.id)
                    return (
                      <li key={task.id}>
                        <button
                          type="button"
                          onClick={() => toggleTask(task.id)}
                          aria-pressed={done}
                          className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-all ${
                            done ? 'border-green-300 bg-green-50 text-green-900 line-through' : 'border-slate-200 bg-white text-slate-900 hover:border-slate-300'
                          }`}
                        >
                          {done ? <Unlock className="h-4 w-4 flex-shrink-0 text-green-700" aria-hidden="true" /> : <Lock className="h-4 w-4 flex-shrink-0 text-slate-500" aria-hidden="true" />}
                          <span className="flex-1 truncate">{task.name}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
