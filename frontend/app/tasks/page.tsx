'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Sparkles, Check, Lock, Unlock, Music, Play, Pause, Upload } from 'lucide-react'
import { useAgentPath } from '../context/AgentPathContext'
import AgentInsightsBanner from '../components/AgentInsightsBanner'

/*
  TASK VIEW — matches whiteboard sketch:
  ┌──────────┬─────────────────────┬──────────┐
  │ Today's  │   ┌─── awning ───┐  │ Today's  │
  │ Tasks/   │   │  stage area  │  │ Goals:   │
  │ Hack:    │   │              │  │          │
  │ - task 🔒│   │              │  │ - goal 🔒│
  │ - task 🔒│   │              │  │ - goal   │
  │ - task 🔒│   └──────────────┘  │ - goal   │
  │          │       🐰 bunny      │          │
  └──────────┴─────────────────────┴──────────┘
  • Upload/play music
  • Mascots will dance/move to beat
  • After ready → to the right
*/

const FALLBACK_TASKS = [
  { id: 't1', name: 'Fill out accommodation form', icon: '🔒' },
  { id: 't2', name: 'Email disability office', icon: '🔒' },
  { id: 't3', name: 'Read accommodation guide', icon: '🔒' },
  { id: 't4', name: 'Set up Tiimo schedule', icon: '🔒' },
  { id: 't5', name: 'Join study group chat', icon: '🔒' },
  { id: 't6', name: 'Practice self-advocacy script', icon: '🔒' },
]

const FALLBACK_GOALS = [
  { id: 'g1', name: 'Complete 3 accommodation tasks', icon: '🔒' },
  { id: 'g2', name: 'Use 2 new tools', icon: '🔒' },
  { id: 'g3', name: 'Break through 1 big barrier', icon: '🔒' },
  { id: 'g4', name: 'Reflect in journal', icon: '🔒' },
]

export default function TasksPage() {
  const router = useRouter()
  const { pathPlanning, calendarOptimization, payload } = useAgentPath()
  // Real "today's tasks" from the calendar optimisation agent (first scheduled
  // day), falling back to path-planning tasks, then to the static demo list.
  const firstDay: any = (payload?.schedule || calendarOptimization?.schedule || [])[0]
  const agentDayTasks: any[] = firstDay?.tasks || []
  const todaysTasks = (agentDayTasks.length ? agentDayTasks : (pathPlanning?.tasks || []).slice(0, 6))
    .slice(0, 8)
    .map((t: any, idx: number) => ({
      id: t.id || `t${idx + 1}`,
      name: t.name || t.title || 'Task',
      icon: '🔒',
    }))
  const tasksToRender = todaysTasks.length ? todaysTasks : FALLBACK_TASKS
  // "Today's goals" derived from the user's actual goals + first milestone.
  const profileGoals: string[] = (payload?.userProfile?.goals || []) as string[]
  const firstMilestoneName: string | undefined = pathPlanning?.milestones?.[0]?.name
  const agentGoals = profileGoals.length
    ? [
        ...profileGoals.slice(0, 3).map((g: string, idx: number) => ({ id: `g${idx + 1}`, name: g, icon: '🔒' })),
        ...(firstMilestoneName ? [{ id: 'g_ms', name: `Advance: ${firstMilestoneName}`, icon: '🔒' }] : []),
      ]
    : []
  const goalsToRender = agentGoals.length ? agentGoals : FALLBACK_GOALS
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set())
  const [completedGoals, setCompletedGoals] = useState<Set<string>>(new Set())
  const [isPlaying, setIsPlaying] = useState(false)
  const [musicFile, setMusicFile] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const completionCount = completedTasks.size
  const totalTasks = tasksToRender.length
  const allDone = completionCount === totalTasks

  // Mascot mood from progress
  const mascotMood = completionCount === 0 ? 'idle' : completionCount < 3 ? 'happy' : completionCount < totalTasks ? 'excited' : 'celebrating'

  const toggleTask = (id: string) => {
    setCompletedTasks(prev => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id); else s.add(id)
      return s
    })
  }

  const toggleGoal = (id: string) => {
    setCompletedGoals(prev => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id); else s.add(id)
      return s
    })
  }

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
    if (isPlaying) { audioRef.current.pause() } else { audioRef.current.play() }
    setIsPlaying(!isPlaying)
  }

  // Cleanup audio URL
  useEffect(() => {
    return () => { if (musicFile) URL.revokeObjectURL(musicFile) }
  }, [musicFile])

  return (
    <div className="min-h-screen bg-white/20 backdrop-blur-sm relative overflow-hidden">
      <div className="max-w-4xl mx-auto px-4 pt-4 space-y-3 relative z-10">
        <AgentInsightsBanner agent="path_planning" />
        <AgentInsightsBanner agent="calendar_optimization" />
      </div>
      <style>{`
        @keyframes bunnyIdle{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
        @keyframes bunnyHappy{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-12px) rotate(3deg)}}
        @keyframes bunnyExcited{0%{transform:translateY(0) rotate(0)}25%{transform:translateY(-16px) rotate(-8deg)}50%{transform:translateY(0) rotate(0)}75%{transform:translateY(-16px) rotate(8deg)}100%{transform:translateY(0) rotate(0)}}
        @keyframes bunnyCelebrate{0%{transform:translateY(0) rotate(0) scale(1)}25%{transform:translateY(-20px) rotate(-15deg) scale(1.1)}50%{transform:translateY(0) rotate(0) scale(1)}75%{transform:translateY(-20px) rotate(15deg) scale(1.1)}100%{transform:translateY(0) rotate(0) scale(1)}}
        @keyframes striped{0%{background-position:0 0}100%{background-position:40px 0}}
        .bunny-idle{animation:bunnyIdle 2s ease-in-out infinite}
        .bunny-happy{animation:bunnyHappy 1.2s ease-in-out infinite}
        .bunny-excited{animation:bunnyExcited 0.8s ease-in-out infinite}
        .bunny-celebrating{animation:bunnyCelebrate 0.5s ease-in-out infinite}
        .bunny-dancing{animation:bunnyExcited 0.4s ease-in-out infinite}
      `}</style>

      {/* Background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '5s', animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-pink-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
      </div>

      {/* Hidden audio element */}
      <audio ref={audioRef} loop onEnded={() => setIsPlaying(false)} />
      <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleMusicUpload} />

      {/* Header */}
      <header className="relative z-20 px-4 py-3">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-white/30 text-slate-700">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-slate-800">Task View</h1>
          <Link href="/reflection?contextType=task" className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-lg flex items-center gap-1">
            <Sparkles className="w-3 h-3" />Journal
          </Link>
        </div>
      </header>

      <div className="relative z-10 max-w-5xl mx-auto px-4 pb-8">
        {/* Main card — the shop/stage layout from the whiteboard */}
        <div className="bg-white/60 backdrop-blur-lg border-2 border-slate-300 rounded-2xl shadow-2xl overflow-hidden">

          {/* === Three-column layout: Tasks | Stage | Goals === */}
          <div className="grid grid-cols-[1fr_1.4fr_1fr] min-h-[480px]">

            {/* LEFT PANEL — Today's Tasks / Hack: */}
            <div className="border-r-2 border-slate-200 p-4 flex flex-col">
              <h2 className="text-sm font-bold text-slate-800 mb-1">Today&apos;s</h2>
              <h2 className="text-sm font-bold text-slate-800 mb-0.5">Tasks/</h2>
              <h2 className="text-sm font-bold text-slate-800 mb-3">Hack:</h2>
              <div className="flex-1 space-y-2">
                {tasksToRender.map(task => {
                  const done = completedTasks.has(task.id)
                  return (
                    <button
                      key={task.id}
                      onClick={() => toggleTask(task.id)}
                      className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm ${
                        done
                          ? 'bg-green-100 border-green-300 text-green-700 line-through'
                          : 'bg-white/60 border-slate-200 text-slate-700 hover:bg-white/80 hover:border-slate-300'
                      }`}
                    >
                      <span className="flex-shrink-0">
                        {done ? <Unlock className="w-4 h-4 text-green-500" /> : <Lock className="w-4 h-4 text-slate-400" />}
                      </span>
                      <span className="flex-1 truncate">{task.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* CENTER — Awning / Stage / Bunny */}
            <div className="flex flex-col relative">
              {/* Awning / Canopy */}
              <div className="relative">
                {/* Striped awning */}
                <div
                  className="h-14 rounded-b-[40%]"
                  style={{
                    background: 'repeating-linear-gradient(90deg, #f97316 0px, #f97316 20px, #ffffff 20px, #ffffff 40px)',
                    animation: 'striped 2s linear infinite',
                  }}
                />
                {/* Awning shadow */}
                <div className="h-3 bg-gradient-to-b from-black/10 to-transparent" />
              </div>

              {/* Stage area */}
              <div className="flex-1 flex flex-col items-center justify-center px-6">
                {/* Stage floor hint */}
                <div className="w-full max-w-[240px] flex-1 flex flex-col items-center justify-center relative">
                  {/* Progress indicator */}
                  <div className="text-center mb-4">
                    <div className="text-xs font-bold text-slate-500 mb-1">{completionCount} / {totalTasks} tasks done</div>
                    <div className="w-40 h-2 bg-slate-200 rounded-full overflow-hidden border border-slate-300">
                      <div
                        className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${(completionCount / totalTasks) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* BUNNY MASCOT */}
                  <div className={`text-8xl bunny-${isPlaying ? 'dancing' : mascotMood}`}>
                    🐰
                  </div>

                  {/* Bunny speech */}
                  <div className="mt-3 text-center text-sm text-slate-600 max-w-[200px]">
                    {mascotMood === 'idle' && "Ready to tackle today? 💪"}
                    {mascotMood === 'happy' && "Nice progress! Keep going! ✨"}
                    {mascotMood === 'excited' && "Almost there! 🔥"}
                    {mascotMood === 'celebrating' && "ALL DONE! Amazing! 🎊"}
                  </div>
                </div>
              </div>

              {/* Music controls at bottom of stage */}
              <div className="border-t border-slate-200 px-4 py-3 flex items-center justify-center gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 px-3 py-1.5 bg-white/60 border border-slate-300 rounded-lg text-xs text-slate-600 hover:bg-white/80 transition-colors"
                >
                  <Upload className="w-3 h-3" />Upload Music
                </button>
                {musicFile && (
                  <button
                    onClick={togglePlay}
                    className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg text-xs font-medium"
                  >
                    {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                    {isPlaying ? 'Pause' : 'Play'}
                  </button>
                )}
                <span className="text-[10px] text-slate-400 italic">
                  <Music className="w-3 h-3 inline" /> Mascot dances to the beat!
                </span>
              </div>
            </div>

            {/* RIGHT PANEL — Today's Goals: */}
            <div className="border-l-2 border-slate-200 p-4 flex flex-col">
              <h2 className="text-sm font-bold text-slate-800 mb-3">Today&apos;s Goals:</h2>
              <div className="flex-1 space-y-2">
                {goalsToRender.map(goal => {
                  const done = completedGoals.has(goal.id)
                  return (
                    <button
                      key={goal.id}
                      onClick={() => toggleGoal(goal.id)}
                      className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm ${
                        done
                          ? 'bg-green-100 border-green-300 text-green-700 line-through'
                          : 'bg-white/60 border-slate-200 text-slate-700 hover:bg-white/80 hover:border-slate-300'
                      }`}
                    >
                      <span className="flex-shrink-0">
                        {done ? <Unlock className="w-4 h-4 text-green-500" /> : <Lock className="w-4 h-4 text-slate-400" />}
                      </span>
                      <span className="flex-1">{goal.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* DONE button — After ready → to the right */}
        <div className="flex justify-center mt-8">
          <button
            onClick={() => router.push('/calendar')}
            className={`px-16 py-5 rounded-2xl font-bold text-xl shadow-2xl transition-all transform hover:scale-105 ${
              allDone
                ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:shadow-green-500/30'
                : 'bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 text-white hover:shadow-purple-500/30'
            }`}
          >
            {allDone ? '✓ Done!' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  )
}
