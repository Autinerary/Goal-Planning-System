'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, BookOpen, Lock, Unlock, Music, Play, Pause, Upload } from 'lucide-react'

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
  • After ready → Done
*/

const todaysTasks = [
  { id: 't1', name: 'Fill out accommodation form' },
  { id: 't2', name: 'Email disability office' },
  { id: 't3', name: 'Read accommodation guide' },
  { id: 't4', name: 'Set up Tiimo schedule' },
  { id: 't5', name: 'Join study group chat' },
  { id: 't6', name: 'Practice self-advocacy script' },
]

const todaysGoals = [
  { id: 'g1', name: 'Complete 3 accommodation tasks' },
  { id: 'g2', name: 'Use 2 new tools' },
  { id: 'g3', name: 'Break through 1 big barrier' },
  { id: 'g4', name: 'Reflect in journal' },
]

export default function TaskView() {
  const router = useRouter()
  const params = useParams()
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set())
  const [completedGoals, setCompletedGoals] = useState<Set<string>>(new Set())
  const [isPlaying, setIsPlaying] = useState(false)
  const [musicFile, setMusicFile] = useState<string | null>(null)
  const [completed, setCompleted] = useState(false)
  const [isDoneDancing, setIsDoneDancing] = useState(false)
  const [todaysMotivation, setTodaysMotivation] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('todaysMotivation')
    }
    return null
  })
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Listen for motivation updates from pinwheel (stored in localStorage by races page)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'todaysMotivation' && e.newValue) setTodaysMotivation(e.newValue)
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  // Derive task name from the route param ID
  const taskId = params.id as string
  const currentTask = todaysTasks.find(t => t.id === taskId)
  const taskName = currentTask?.name || taskId.replace(/_/g, ' ').replace(/-/g, ' ')

  const completionCount = completedTasks.size
  const totalTasks = todaysTasks.length
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

  const handleDone = () => {
    setCompleted(true)
    setIsDoneDancing(true)
    playCelebrationMusic()
    // Dance for 4 seconds, then navigate to calendar
    setTimeout(() => router.push('/calendar'), 4000)
  }

  const playCelebrationMusic = () => {
    try {
      const ctx = new AudioContext()
      // A fun major-key melody: C E G C' E' G' C'' (ascending celebration)
      const notes = [
        { freq: 523.25, start: 0.0,  dur: 0.15 },  // C5
        { freq: 659.25, start: 0.15, dur: 0.15 },  // E5
        { freq: 783.99, start: 0.30, dur: 0.15 },  // G5
        { freq: 1046.5, start: 0.45, dur: 0.30 },  // C6 (hold)
        { freq: 783.99, start: 0.80, dur: 0.12 },  // G5
        { freq: 1046.5, start: 0.95, dur: 0.12 },  // C6
        { freq: 1318.5, start: 1.10, dur: 0.40 },  // E6 (hold)
        // Second phrase — bouncy rhythm
        { freq: 783.99, start: 1.60, dur: 0.10 },  // G5
        { freq: 880.00, start: 1.72, dur: 0.10 },  // A5
        { freq: 987.77, start: 1.84, dur: 0.10 },  // B5
        { freq: 1046.5, start: 1.96, dur: 0.30 },  // C6
        { freq: 1318.5, start: 2.30, dur: 0.15 },  // E6
        { freq: 1046.5, start: 2.50, dur: 0.15 },  // C6
        { freq: 1318.5, start: 2.70, dur: 0.15 },  // E6
        { freq: 1568.0, start: 2.90, dur: 0.50 },  // G6 (big finish)
        // Final fanfare
        { freq: 1046.5, start: 3.50, dur: 0.12 },  // C6
        { freq: 1318.5, start: 3.65, dur: 0.12 },  // E6
        { freq: 1568.0, start: 3.80, dur: 0.20 },  // G6
      ]

      for (const n of notes) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.value = n.freq
        gain.gain.setValueAtTime(0.18, ctx.currentTime + n.start)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + n.start + n.dur)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(ctx.currentTime + n.start)
        osc.stop(ctx.currentTime + n.start + n.dur + 0.05)
      }

      // Add a simple kick-drum-like beat underneath
      const beats = [0, 0.3, 0.6, 0.9, 1.2, 1.6, 1.96, 2.3, 2.7, 2.9, 3.5, 3.8]
      for (const t of beats) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(150, ctx.currentTime + t)
        osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + t + 0.08)
        gain.gain.setValueAtTime(0.3, ctx.currentTime + t)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.1)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(ctx.currentTime + t)
        osc.stop(ctx.currentTime + t + 0.15)
      }

      // Close context after music ends
      setTimeout(() => ctx.close(), 4200)
    } catch {
      // Web Audio not available — dance silently
    }
  }

  // Cleanup audio URL
  useEffect(() => {
    return () => { if (musicFile) URL.revokeObjectURL(musicFile) }
  }, [musicFile])

  return (
    <div className="min-h-screen bg-white/20 backdrop-blur-sm text-slate-800 p-4 md:p-8 relative overflow-hidden">
      <style>{`
        @keyframes bunnyIdle{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
        @keyframes bunnyHappy{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-12px) rotate(3deg)}}
        @keyframes bunnyExcited{0%{transform:translateY(0) rotate(0)}25%{transform:translateY(-16px) rotate(-8deg)}50%{transform:translateY(0) rotate(0)}75%{transform:translateY(-16px) rotate(8deg)}100%{transform:translateY(0) rotate(0)}}
        @keyframes bunnyCelebrate{0%{transform:translateY(0) rotate(0) scale(1)}25%{transform:translateY(-20px) rotate(-15deg) scale(1.1)}50%{transform:translateY(0) rotate(0) scale(1)}75%{transform:translateY(-20px) rotate(15deg) scale(1.1)}100%{transform:translateY(0) rotate(0) scale(1)}}
        @keyframes striped{0%{background-position:0 0}100%{background-position:40px 0}}
        @keyframes doneDance{0%{transform:translateY(0) rotate(0) scale(1)}12%{transform:translateY(-30px) rotate(-20deg) scale(1.2)}25%{transform:translateY(0) rotate(0) scale(1)}37%{transform:translateY(-25px) rotate(20deg) scale(1.15)}50%{transform:translateY(0) rotate(0) scale(1)}62%{transform:translateY(-30px) rotate(-15deg) scale(1.2)}75%{transform:translateY(0) rotate(0) scale(1)}87%{transform:translateY(-20px) rotate(15deg) scale(1.1)}100%{transform:translateY(0) rotate(0) scale(1)}}
        @keyframes turtleDance{0%{transform:translateY(0) rotate(0)}20%{transform:translateY(-10px) rotate(8deg)}40%{transform:translateY(0) rotate(-8deg)}60%{transform:translateY(-10px) rotate(8deg)}80%{transform:translateY(0) rotate(-8deg)}100%{transform:translateY(0) rotate(0)}}
        .bunny-idle{animation:bunnyIdle 2s ease-in-out infinite}
        .bunny-happy{animation:bunnyHappy 1.2s ease-in-out infinite}
        .bunny-excited{animation:bunnyExcited 0.8s ease-in-out infinite}
        .bunny-celebrating{animation:bunnyCelebrate 0.5s ease-in-out infinite}
        .bunny-dancing{animation:bunnyExcited 0.4s ease-in-out infinite}
        .done-dance{animation:doneDance 1s ease-in-out infinite}
        .turtle-dance{animation:turtleDance 0.8s ease-in-out infinite}
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

      {/* Journal Button - Floating */}
      <Link
        href={`/reflection?contextType=task&contextId=${params.id}`}
        className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-amber-500 to-orange-500 text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform flex items-center gap-2"
        title="Journal / Reflection"
      >
        <BookOpen className="w-6 h-6" />
        <span className="hidden sm:inline font-semibold">Journal</span>
      </Link>

      <div className="relative z-10 max-w-5xl mx-auto">
        {/* Main card */}
        <div className="bg-white/60 backdrop-blur-lg border-2 border-slate-300 rounded-2xl shadow-2xl overflow-hidden">

          {/* Task Title */}
          <div className="text-center py-5 px-4">
            <h1 className="text-2xl font-bold text-slate-800">Task View</h1>
            <p className="text-sm text-slate-600 mt-1">{taskName}</p>
            <div className="h-px bg-slate-300 w-32 mx-auto mt-2" />
          </div>

          {/* === Three-column layout: Tasks | Stage | Goals === */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1.4fr_1fr] min-h-[400px]">

            {/* LEFT PANEL — Today's Tasks / Hack: */}
            <div className="border-r-0 md:border-r-2 border-b-2 md:border-b-0 border-slate-200 p-4 flex flex-col">
              <h2 className="text-sm font-bold text-slate-800 mb-1">Today&apos;s</h2>
              <h2 className="text-sm font-bold text-slate-800 mb-3">Trick/Hack:</h2>
              <div className="flex-1 space-y-2">
                {todaysTasks.map(task => {
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

            {/* CENTER — Stage / Turtle & Bunny */}
            <div className="flex flex-col relative border-b-2 md:border-b-0 border-slate-200">

              {/* Stage area */}
              <div className="flex-1 flex flex-col items-center justify-center px-6">
                <div className="w-full max-w-[240px] flex-1 flex flex-col items-center justify-center">
                  {/* Progress */}
                  <div className="text-center mb-4">
                    <div className="text-xs font-bold text-slate-500 mb-1">{completionCount} / {totalTasks} tasks</div>
                    <div className="w-40 h-2 bg-slate-200 rounded-full overflow-hidden border border-slate-300">
                      <div
                        className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${(completionCount / totalTasks) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* TURTLE above bunny */}
                  <div className={`text-6xl ${isDoneDancing ? 'turtle-dance' : ''}`}>
                    🐢
                  </div>

                  {/* BUNNY MASCOT */}
                  <div className={`text-8xl ${isDoneDancing ? 'done-dance' : `bunny-${isPlaying ? 'dancing' : mascotMood}`}`}>
                    🐰
                  </div>

                  {/* Speech / celebration text */}
                  <div className="mt-3 text-center text-sm text-slate-600 max-w-[200px]">
                    {isDoneDancing && "🎊 Dance time! 🎊"}
                    {!isDoneDancing && mascotMood === 'idle' && "Ready to tackle today? 💪"}
                    {!isDoneDancing && mascotMood === 'happy' && "Nice progress! Keep going! ✨"}
                    {!isDoneDancing && mascotMood === 'excited' && "Almost there! 🔥"}
                    {!isDoneDancing && mascotMood === 'celebrating' && "ALL DONE! Amazing! 🎊"}
                  </div>
                </div>
              </div>

              {/* Music controls */}
              <div className="border-t border-slate-200 px-4 py-3 flex items-center justify-center gap-3 flex-wrap">
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

            {/* RIGHT PANEL — Today's Quote */}
            <div className="border-l-0 md:border-l-2 border-slate-200 p-4 flex flex-col">
              <h2 className="text-sm font-bold text-slate-800 mb-3">Today&apos;s<br />Quote:</h2>
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center px-4">
                  <p className="text-lg italic text-slate-600 leading-relaxed">&ldquo;The only way to do great work is to love what you do.&rdquo;</p>
                  <p className="text-xs text-slate-400 mt-3">&mdash; Steve Jobs</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Today's Motivation (from pinwheel spin on Races page) */}
        {todaysMotivation && (
          <div className="mt-6 max-w-md mx-auto text-center">
            <div className="bg-white/60 backdrop-blur-sm border border-amber-200 rounded-xl px-6 py-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Today&apos;s Motivation</p>
              <p className="text-sm italic text-slate-700">&ldquo;{todaysMotivation}&rdquo;</p>
            </div>
          </div>
        )}

        {/* DONE button */}
        <div className="flex justify-center mt-8">
          <button
            onClick={handleDone}
            disabled={completed}
            className={`px-16 py-5 rounded-2xl font-bold text-xl shadow-2xl transition-all transform hover:scale-105 ${
              completed
                ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                : 'bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 text-white hover:shadow-purple-500/30'
            }`}
          >
            {completed ? '✓ Done!' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  )
}
