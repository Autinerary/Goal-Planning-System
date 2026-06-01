'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, ChevronDown, ChevronUp, ExternalLink, ArrowLeft, Users, UserCheck, UserPlus, Bell, MessageSquare, Trophy, RefreshCw, Filter, X, Info, AlertTriangle } from 'lucide-react'

function RacesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const viewMode = searchParams.get('mode') || 'combined'
  const comparisonView = searchParams.get('compare') || null // 'rolemodel' | 'friend' | 'mentor'
  const newView = searchParams.get('newview') || null // 'avoidance' | 'suggestions' | 'compete'
  const [showPreviousSteps, setShowPreviousSteps] = useState(false)
  const [isWheelSpinning, setIsWheelSpinning] = useState(false)
  const [wheelRotation, setWheelRotation] = useState(0)
  const [todaysMotivation, setTodaysMotivation] = useState<string | null>(null)
  const [showCompareMenu, setShowCompareMenu] = useState(false)
  const [showNewViewsMenu, setShowNewViewsMenu] = useState(false)
  const [suggestionFilter, setSuggestionFilter] = useState<string>('All')
  // Separate races wheel states
  const [raceWheelRotations, setRaceWheelRotations] = useState<Record<string, number>>({})
  const [raceWheelSpinning, setRaceWheelSpinning] = useState<Record<string, boolean>>({})
  const [raceMotivations, setRaceMotivations] = useState<Record<string, string | null>>({})

  // Mock comparison data
  const theirStats = {
    mentality: 7,
    happiness: 9,
    focus: 8,
    energy: 6
  }

  const theirProgress = 65
  const yourProgress = 45

  const stats = [
    { name: 'Mentality', value: 5, maxValue: 10, color: 'text-emerald-500' },
    { name: 'Happiness', value: 8, maxValue: 10, color: 'text-emerald-500' },
    { name: 'Fear-Overcoming', value: 3, maxValue: 10, color: 'text-amber-500' },
    { name: 'Creativity', value: 7, maxValue: 10, color: 'text-cyan-500' },
  ]

  const motivations = [
    'Focus on progress, not perfection',
    'One small step at a time',
    'Your barriers are your superpowers',
    'Rest is part of the journey',
    'Celebrate every win',
    'You are enough',
  ]

  const recommendedChoices = [
    { id: 'choice_1', name: 'Recommended Choice 1', success: 90, attempts: 1000, description: 'Request accommodations early' },
    { id: 'choice_2', name: 'Recommended Choice 2', success: 89, attempts: 101, description: 'Join study group with peers' },
    { id: 'see_more', name: '(See more choices)', success: null, attempts: null, description: null },
    { id: 'choice_last', name: 'Recommended Choice X, Last', success: 10, attempts: 102, description: 'Alternative path option' },
  ]

  const previousSteps = [
    { id: 'step_1', name: 'Completed: Research accommodations', completed: true },
    { id: 'step_2', name: 'Completed: Initial assessment', completed: true },
    { id: 'step_3', name: 'Completed: Set up profile', completed: true },
  ]

  const races = [
    { 
      id: 'race_1', 
      name: 'Graduate University', 
      progress: 45,
      currentMilestone: 'Request Accommodations',
      models: ['Autism', 'ADHD', 'First-Gen']
    },
    { 
      id: 'race_2', 
      name: 'Get Tech Job', 
      progress: 20,
      currentMilestone: 'Build Portfolio',
      models: ['ADHD', 'Visible Minority']
    },
  ]

  const spinWheel = () => {
    if (isWheelSpinning) return
    setIsWheelSpinning(true)
    const spins = 3 + Math.random() * 2 // 3-5 full spins
    const finalAngle = spins * 360 + Math.random() * 360
    setWheelRotation(prev => prev + finalAngle)
    
    setTimeout(() => {
      const randomMotivation = motivations[Math.floor(Math.random() * motivations.length)]
      setTodaysMotivation(randomMotivation)
      setIsWheelSpinning(false)
    }, 2000)
  }

  const spinRaceWheel = (raceId: string) => {
    if (raceWheelSpinning[raceId]) return
    setRaceWheelSpinning(prev => ({ ...prev, [raceId]: true }))
    const spins = 3 + Math.random() * 2 // 3-5 full spins
    const finalAngle = spins * 360 + Math.random() * 360
    setRaceWheelRotations(prev => ({ ...prev, [raceId]: (prev[raceId] || 0) + finalAngle }))
    
    setTimeout(() => {
      const randomMotivation = motivations[Math.floor(Math.random() * motivations.length)]
      setRaceMotivations(prev => ({ ...prev, [raceId]: randomMotivation }))
      setRaceWheelSpinning(prev => ({ ...prev, [raceId]: false }))
    }, 2000)
  }

  const raceStyles = `
    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
    @keyframes walk {
      0%, 100% { transform: translateX(0); }
      50% { transform: translateX(5px); }
    }
    .character-bounce {
      animation: bounce 2s ease-in-out infinite;
    }
    .character-walk {
      animation: walk 1.5s ease-in-out infinite;
    }
  `

  return (
    <div className="min-h-screen bg-white/20 backdrop-blur-sm p-4 md:p-8 relative overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: raceStyles }} />
      
      {/* Sky with clouds */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-10 left-10 w-32 h-16 bg-white/40 rounded-full blur-xl" />
        <div className="absolute top-20 right-20 w-40 h-20 bg-white/30 rounded-full blur-2xl" />
        <div className="absolute top-5 left-1/3 w-36 h-18 bg-white/35 rounded-full blur-xl" />
      </div>
      
      {/* Background decorations - lighter, more playful */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-cyan-300/30 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-300/30 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '5s', animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-pink-300/25 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
      </div>
      <div className="relative z-10">
      {/* Header Section - More playful but still professional */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="px-4 py-2 bg-white/90 backdrop-blur-sm border-2 border-slate-300 rounded-xl font-medium hover:bg-white hover:shadow-md transition-all flex items-center gap-2 shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-slate-800">🏁 Race View</h1>
              <div className="text-sm bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full border border-amber-300 shadow-sm">
                <span className="text-amber-700 font-semibold">Level 3</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setShowCompareMenu(!showCompareMenu)}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg font-medium hover:shadow-lg transition-all flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Compare
              </button>
              {showCompareMenu && (
                <div className="absolute right-0 top-full mt-2 bg-white border-2 border-slate-200 rounded-lg shadow-xl z-20 min-w-[200px]">
                  <div className="p-2">
                    <div className="text-xs font-semibold text-slate-500 mb-2 px-2">(NEW: View Mentors / Collaborators /...)</div>
                    <button
                      onClick={() => {
                        router.push('/races?compare=rolemodel')
                        setShowCompareMenu(false)
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded text-sm flex items-center gap-2"
                    >
                      <Users className="w-4 h-4" />
                      To Role Model (s)
                    </button>
                    <button
                      onClick={() => {
                        router.push('/races?compare=friend')
                        setShowCompareMenu(false)
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded text-sm flex items-center gap-2"
                    >
                      <UserPlus className="w-4 h-4" />
                      To Friend-vals
                    </button>
                    <button
                      onClick={() => {
                        router.push('/races?compare=mentor')
                        setShowCompareMenu(false)
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded text-sm flex items-center gap-2"
                    >
                      <UserCheck className="w-4 h-4" />
                      To Mentoring
                    </button>
                    <button
                      onClick={() => {
                        router.push('/races?compare=recommendations')
                        setShowCompareMenu(false)
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded text-sm flex items-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      To Recommendations
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="relative">
              <button
                onClick={() => setShowNewViewsMenu(!showNewViewsMenu)}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:shadow-lg transition-all flex items-center gap-2"
              >
                <Filter className="w-4 h-4" />
                New Views
              </button>
              {showNewViewsMenu && (
                <div className="absolute right-0 top-full mt-2 bg-white border-2 border-slate-200 rounded-lg shadow-xl z-20 min-w-[200px]">
                  <div className="p-2">
                    <button
                      onClick={() => {
                        router.push('/races?newview=avoidance')
                        setShowNewViewsMenu(false)
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded text-sm"
                    >
                      ① Avoidance
                    </button>
                    <button
                      onClick={() => {
                        router.push('/races?newview=suggestions')
                        setShowNewViewsMenu(false)
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded text-sm"
                    >
                      ② Suggestions
                    </button>
                    <button
                      onClick={() => {
                        router.push('/races?newview=compete')
                        setShowNewViewsMenu(false)
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded text-sm"
                    >
                      ③ Compete
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* View Toggle - More colorful and fun */}
        <div className="flex gap-4">
          <button
            onClick={() => router.push('/races?mode=combined')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all shadow-md ${
              viewMode === 'combined' 
                ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg scale-105' 
                : 'bg-white/90 backdrop-blur-sm border-2 border-blue-300 hover:border-blue-400 text-slate-700 hover:shadow-lg'
            }`}
          >
            📊 Combined View
          </button>
          <button
            onClick={() => router.push('/races?mode=separate')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all shadow-md ${
              viewMode === 'separate' 
                ? 'bg-gradient-to-r from-pink-500 to-orange-500 text-white shadow-lg scale-105' 
                : 'bg-white/90 backdrop-blur-sm border-2 border-pink-300 hover:border-pink-400 text-slate-700 hover:shadow-lg'
            }`}
          >
            🎯 Separate Races
          </button>
        </div>
      </div>

      {/* Comparison View */}
      {comparisonView && (
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Compare: {comparisonView === 'rolemodel' ? 'Role Model' : comparisonView === 'friend' ? 'Friend' : comparisonView === 'mentor' ? 'Mentor' : 'Recommendations'}</h2>
            <button
              onClick={() => router.push('/races')}
              className="text-slate-500 hover:text-slate-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: You vs. Them Flow */}
            <div className="space-y-4">
              <button
                onClick={() => router.push('/tasks/current')}
                className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to task view
              </button>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <h3 className="font-bold mb-2">Their Stats:</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Mentality:</span>
                    <span className="font-bold text-emerald-500">{theirStats.mentality}XP</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Happiness:</span>
                    <span className="font-bold text-emerald-500">{theirStats.happiness}XP</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Focus:</span>
                    <span className="font-bold text-emerald-500">{theirStats.focus}XP</span>
                  </div>
                  <div className="text-slate-400">...</div>
                </div>
              </div>

              <div className="text-sm">
                <span className="font-medium">Progress: </span>
                <span className="text-emerald-500 font-bold">{theirProgress}%</span>
                <span className="text-slate-500"> (vs. Your {yourProgress}%)</span>
              </div>

              {/* You vs. Them Stick Figures */}
              <div className="flex items-center justify-center gap-8 py-4">
                <div className="flex flex-col items-center">
                  <div className="text-xs font-medium mb-2">You</div>
                  <svg viewBox="0 0 40 50" className="w-12 h-14">
                    <circle cx="20" cy="12" r="6" fill="none" stroke="#1e293b" strokeWidth="2"/>
                    <line x1="20" y1="18" x2="20" y2="32" stroke="#1e293b" strokeWidth="2"/>
                    <line x1="20" y1="22" x2="12" y2="28" stroke="#1e293b" strokeWidth="2"/>
                    <line x1="20" y1="22" x2="28" y2="28" stroke="#1e293b" strokeWidth="2"/>
                    <line x1="20" y1="32" x2="14" y2="42" stroke="#1e293b" strokeWidth="2"/>
                    <line x1="20" y1="32" x2="26" y2="42" stroke="#1e293b" strokeWidth="2"/>
                  </svg>
                </div>
                <div className="flex flex-col items-center">
                  <div className="text-xs font-medium mb-2">Them</div>
                  <svg viewBox="0 0 40 50" className="w-12 h-14">
                    <circle cx="20" cy="12" r="6" fill="none" stroke="#1e293b" strokeWidth="2"/>
                    <line x1="20" y1="18" x2="20" y2="32" stroke="#1e293b" strokeWidth="2"/>
                    <line x1="20" y1="22" x2="12" y2="28" stroke="#1e293b" strokeWidth="2"/>
                    <line x1="20" y1="22" x2="28" y2="28" stroke="#1e293b" strokeWidth="2"/>
                    <line x1="20" y1="32" x2="14" y2="42" stroke="#1e293b" strokeWidth="2"/>
                    <line x1="20" y1="32" x2="26" y2="42" stroke="#1e293b" strokeWidth="2"/>
                  </svg>
                </div>
              </div>

              {/* Milestone Buttons */}
              <div className="space-y-2">
                <button 
                  onClick={() => router.push('/milestones/their_current')}
                  className="w-full px-4 py-2 bg-slate-100 border-2 border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Their Curr
                </button>
                <div className="w-full h-px bg-slate-300 border-dashed"></div>
                <button 
                  onClick={() => router.push('/milestones/next_step')}
                  className="w-full px-4 py-2 bg-amber-100 border-2 border-amber-400 rounded-lg text-sm font-medium hover:bg-amber-200 transition-colors cursor-pointer"
                >
                  AT YOUR NEXT STEP
                </button>
                <button 
                  onClick={() => router.push('/milestones/current')}
                  className="w-full px-4 py-2 bg-cyan-100 border-2 border-cyan-400 rounded-lg text-sm font-medium hover:bg-cyan-200 transition-colors cursor-pointer"
                >
                  AT YOUR CURR
                </button>
                <button 
                  onClick={() => router.push('/milestones/your_step')}
                  className="w-full px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Your Step
                </button>
              </div>
            </div>

            {/* Right: Models Comparison & New Views */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-slate-500" />
                  <span className="font-medium">Compare</span>
                </div>
                <span className="text-xs text-slate-500">→ (can change Race View here)</span>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <h3 className="font-bold mb-2">Models: vs. yours</h3>
                <div className="text-sm space-y-1">
                  <div>Their: Autism + Parent + Black + Canadian</div>
                  <div>Yours: Autism + ADHD + First-Gen</div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border-2 border-purple-200">
                <h3 className="font-bold mb-3">New Views:</h3>
                <div className="space-y-3 text-sm">
                  <button
                    onClick={() => router.push('/races?newview=avoidance')}
                    className="w-full text-left p-2 hover:bg-purple-100 rounded-lg transition-colors cursor-pointer"
                  >
                    <span className="font-medium">① Avoidance</span>
                  </button>
                  <button
                    onClick={() => router.push('/races?newview=suggestions')}
                    className="w-full text-left p-2 hover:bg-purple-100 rounded-lg transition-colors cursor-pointer"
                  >
                    <div>
                      <span className="font-medium">② Suggestions</span>
                      <div className="text-xs text-slate-600 mt-1 ml-4">
                        <div>L should be like to filter by ppl;</div>
                        <div>us, R.M.'s, M's, ...)</div>
                        <div className="mt-1">→ could be like Journal</div>
                        <div>→ Or Daily suggestions in Notifs/Bell</div>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => router.push('/races?newview=compete')}
                    className="w-full text-left p-2 hover:bg-purple-100 rounded-lg transition-colors cursor-pointer"
                  >
                    <div>
                      <span className="font-medium">③ Compete</span>
                      <div className="text-xs text-slate-600 mt-1 ml-4">
                        <div>Rival Notifs</div>
                        <div>Person's Icon @ goal</div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Views Content */}
      {newView && (
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {newView === 'avoidance' && <Info className="w-5 h-5 text-slate-600" />}
              {newView === 'suggestions' && <span className="text-lg">②</span>}
              {newView === 'compete' && <span className="text-lg">③</span>}
              <h2 className="text-xl font-bold">
                {newView === 'avoidance' ? 'Avoidance View' : 
                 newView === 'suggestions' ? 'Suggestions View' : 
                 'Compete View'}
              </h2>
            </div>
            <button
              onClick={() => router.push('/races')}
              className="text-slate-500 hover:text-slate-700 p-1 hover:bg-slate-100 rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {newView === 'avoidance' && (
            <div className="space-y-4">
              <p className="text-slate-600">
                View showing tasks/approaches to avoid based on your barriers and past experiences.
              </p>
              
              {/* Avoidance List */}
              <div className="mt-6 space-y-3">
                <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  Things to Avoid:
                </h3>
                <div className="space-y-2">
                  {[
                    { task: 'All-night study sessions', reason: 'Triggers ADHD burnout' },
                    { task: 'Cramming before exams', reason: 'Increases anxiety' },
                    { task: 'Skipping meals for work', reason: 'Affects focus and mood' },
                    { task: 'Overcommitting to projects', reason: 'Leads to overwhelm' },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="font-medium text-red-900">{item.task}</div>
                        <div className="text-sm text-red-700">{item.reason}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {newView === 'suggestions' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Bell className="w-5 h-5 text-purple-500" />
                <h3 className="font-semibold text-lg">Daily Suggestions</h3>
              </div>
              <p className="text-slate-600 mb-4">
                Filter suggestions by people: us, Role Models, Mentors, etc.
              </p>
              <div className="space-y-2 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <span>→</span>
                  <span>Could be like Journal format</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>→</span>
                  <span>Or Daily suggestions in Notifications/Bell</span>
                </div>
              </div>

              {/* Suggestions List */}
              <div className="mt-6 space-y-3">
                <div className="flex items-center gap-2 mb-3">
                  <Filter className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-medium text-slate-600">Filter by:</span>
                  <div className="flex gap-2">
                    {['All', 'Role Models', 'Mentors', 'Friends'].map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setSuggestionFilter(filter)}
                        className={`px-3 py-1 text-xs border rounded-lg transition-colors ${
                          suggestionFilter === filter
                            ? 'bg-purple-500 text-white border-purple-500'
                            : 'border-slate-300 hover:bg-purple-50 hover:border-purple-300'
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  {(() => {
                    const allSuggestions = [
                      { from: 'Sarah Chen (Role Model)', suggestion: 'Try the Pomodoro technique for this task', time: '2 hours ago', type: 'Role Models' },
                      { from: 'Marcus Johnson (Role Model)', suggestion: 'Use body doubling for focus sessions', time: '3 hours ago', type: 'Role Models' },
                      { from: 'James Wilson (Mentor)', suggestion: 'Break this into 3 smaller steps', time: '5 hours ago', type: 'Mentors' },
                      { from: 'Lisa Park (Mentor)', suggestion: 'Take breaks every 25 minutes to maintain focus', time: '6 hours ago', type: 'Mentors' },
                      { from: 'Alex Taylor (Friend)', suggestion: 'We can body double on this together', time: '1 day ago', type: 'Friends' },
                      { from: 'Jordan Smith (Friend)', suggestion: 'Want to compete on completing this task?', time: '2 days ago', type: 'Friends' },
                    ]
                    const filteredSuggestions = allSuggestions.filter(item => suggestionFilter === 'All' || item.type === suggestionFilter)
                    
                    if (filteredSuggestions.length === 0) {
                      return (
                        <div className="text-center py-8 text-slate-500">
                          No suggestions found for this filter.
                        </div>
                      )
                    }
                    
                    return filteredSuggestions.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          // Apply suggestion to calendar
                          const suggestionData = {
                            suggestion: item.suggestion,
                            from: item.from,
                            time: new Date().toISOString(),
                            type: item.type
                          }
                          
                          // Store in localStorage for calendar to pick up
                          const existingSuggestions = JSON.parse(localStorage.getItem('pendingCalendarSuggestions') || '[]')
                          existingSuggestions.push(suggestionData)
                          localStorage.setItem('pendingCalendarSuggestions', JSON.stringify(existingSuggestions))
                          
                          // Navigate to calendar with suggestion
                          router.push(`/calendar?suggestion=${encodeURIComponent(item.suggestion)}&from=${encodeURIComponent(item.from)}`)
                        }}
                        className="w-full text-left p-3 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 hover:border-purple-300 transition-all cursor-pointer"
                      >
                        <div className="flex items-start justify-between mb-1">
                          <div className="font-medium text-purple-900 text-sm">{item.from}</div>
                          <div className="text-xs text-slate-500">{item.time}</div>
                        </div>
                        <div className="text-sm text-slate-700">{item.suggestion}</div>
                      </button>
                    ))
                  })()}
                </div>
              </div>
            </div>
          )}

          {newView === 'compete' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-5 h-5 text-amber-500" />
                <h3 className="font-semibold text-lg">Compete Features</h3>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <Bell className="w-4 h-4 text-amber-600" />
                  <span className="font-medium text-amber-900">Rival Notifications</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <Users className="w-4 h-4 text-amber-600" />
                  <span className="font-medium text-amber-900">Person's Icon @ goal</span>
                </div>
              </div>

              {/* Active Competitions */}
              <div className="mt-6 space-y-3">
                <h3 className="font-semibold text-slate-800 mb-3">Active Competitions:</h3>
                <div className="space-y-2">
                  {[
                    { rival: 'Marcus Johnson', goal: 'Complete 10 tasks this week', yourProgress: 6, theirProgress: 8 },
                    { rival: 'Alex Taylor', goal: 'Study 20 hours this week', yourProgress: 12, theirProgress: 15 },
                  ].map((comp, idx) => (
                    <div key={idx} className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm">
                            {comp.rival.charAt(0)}
                          </div>
                          <div>
                            <div className="font-medium text-slate-900">{comp.rival}</div>
                            <div className="text-xs text-slate-600">{comp.goal}</div>
                          </div>
                        </div>
                        <Trophy className="w-5 h-5 text-amber-500" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600">You:</span>
                          <span className="font-bold text-emerald-600">{comp.yourProgress}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600">Them:</span>
                          <span className="font-bold text-amber-600">{comp.theirProgress}</span>
                        </div>
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-emerald-500 to-amber-500 rounded-full" style={{ width: `${(comp.yourProgress / Math.max(comp.yourProgress, comp.theirProgress)) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats/Goal/Motivation Wheel Section - Show when newView is active */}
      {newView && (
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm mb-6">
          {/* Top Section: Stats + Goal + Motivation Wheel */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Stats Box */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <h3 className="font-bold text-lg mb-3">Stats:</h3>
              <div className="space-y-2">
                {stats.map((stat, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-sm">- {stat.name}:</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            stat.value >= 7 ? 'bg-emerald-500' : stat.value >= 4 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${(stat.value / stat.maxValue) * 100}%` }}
                        />
                      </div>
                      <span className={`font-bold text-sm ${stat.color}`}>{stat.value}XP</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Goal/Ideal Self - Center */}
            <div className="flex flex-col items-center justify-center">
              {/* Stick Figure on Platform */}
              <div className="relative">
                <svg viewBox="0 0 80 100" className="w-20 h-24">
                  {/* Platform/podium */}
                  <ellipse cx="40" cy="85" rx="35" ry="12" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="2"/>
                  <ellipse cx="40" cy="80" rx="25" ry="8" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1"/>
                  
                  {/* Stick figure */}
                  <circle cx="40" cy="25" r="10" fill="none" stroke="#1e293b" strokeWidth="3"/>
                  <line x1="40" y1="35" x2="40" y2="60" stroke="#1e293b" strokeWidth="3"/>
                  <line x1="40" y1="42" x2="25" y2="52" stroke="#1e293b" strokeWidth="3"/>
                  <line x1="40" y1="42" x2="55" y2="52" stroke="#1e293b" strokeWidth="3"/>
                  <line x1="40" y1="60" x2="28" y2="78" stroke="#1e293b" strokeWidth="3"/>
                  <line x1="40" y1="60" x2="52" y2="78" stroke="#1e293b" strokeWidth="3"/>
                </svg>
              </div>
              <div className="text-center mt-2">
                <span className="text-lg font-semibold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
                  Goal/Ideal Self
                </span>
              </div>
            </div>

            {/* Motivation Wheel */}
            <div className="flex flex-col items-center">
              <span className="text-sm font-medium text-slate-600 mb-2">Motivation Wheel:</span>
              <button 
                onClick={spinWheel}
                disabled={isWheelSpinning}
                className="relative group"
              >
                <svg 
                  viewBox="0 0 100 100" 
                  className="w-24 h-24 transition-transform duration-[2000ms] ease-out"
                  style={{ transform: `rotate(${wheelRotation}deg)` }}
                >
                  {/* Wheel segments */}
                  {[0, 60, 120, 180, 240, 300].map((angle, i) => {
                    const colors = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ec4899', '#3b82f6']
                    const startAngle = (angle - 90) * Math.PI / 180
                    const endAngle = (angle + 60 - 90) * Math.PI / 180
                    const x1 = 50 + 40 * Math.cos(startAngle)
                    const y1 = 50 + 40 * Math.sin(startAngle)
                    const x2 = 50 + 40 * Math.cos(endAngle)
                    const y2 = 50 + 40 * Math.sin(endAngle)
                    return (
                      <path
                        key={i}
                        d={`M 50 50 L ${x1} ${y1} A 40 40 0 0 1 ${x2} ${y2} Z`}
                        fill={colors[i]}
                        stroke="white"
                        strokeWidth="2"
                      />
                    )
                  })}
                  {/* Center circle */}
                  <circle cx="50" cy="50" r="12" fill="white" stroke="#1e293b" strokeWidth="2"/>
                  <text x="50" y="54" textAnchor="middle" fontSize="8" fontWeight="bold">SPIN</text>
                </svg>
                {/* Pointer */}
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-t-[12px] border-l-transparent border-r-transparent border-t-slate-900" />
              </button>
              {todaysMotivation && (
                <div className="mt-3 text-center max-w-[200px]">
                  <div className="text-xs text-slate-500">Today's motivation:</div>
                  <div className="text-sm font-medium text-slate-700 italic">"{todaysMotivation}"</div>
                </div>
              )}
              {!todaysMotivation && !isWheelSpinning && (
                <div className="mt-2 text-xs text-slate-400">Click to spin!</div>
              )}
            </div>
          </div>
        </div>
      )}

      {viewMode === 'combined' ? (
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl border-4 border-amber-800 shadow-2xl p-6 md:p-8 relative overflow-hidden">
          {/* Dirt Road Background Pattern */}
          <div className="absolute inset-0 bg-gradient-to-b from-amber-700 via-amber-600 to-amber-800 opacity-20" 
               style={{
                 backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
               }} />
          
          {/* Hare and Turtle Characters */}
          <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
            <div className="text-4xl character-bounce">🐰</div>
            <div className="text-3xl character-walk">🐢</div>
          </div>

          {/* Top Section: Stats + Goal + Motivation Wheel */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 relative z-10">
            {/* Stats Box */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <h3 className="font-bold text-lg mb-3">Stats:</h3>
              <div className="space-y-2">
                {stats.map((stat, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-sm">- {stat.name}:</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            stat.value >= 7 ? 'bg-emerald-500' : stat.value >= 4 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${(stat.value / stat.maxValue) * 100}%` }}
                        />
                      </div>
                      <span className={`font-bold text-sm ${stat.color}`}>{stat.value}XP</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Goal/Ideal Self - Center */}
            <div className="flex flex-col items-center justify-center">
              {/* Stick Figure on Platform */}
              <div className="relative">
                <svg viewBox="0 0 80 100" className="w-20 h-24">
                  {/* Platform/podium */}
                  <ellipse cx="40" cy="85" rx="35" ry="12" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="2"/>
                  <ellipse cx="40" cy="80" rx="25" ry="8" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1"/>
                  
                  {/* Stick figure */}
                  <circle cx="40" cy="25" r="10" fill="none" stroke="#1e293b" strokeWidth="3"/>
                  <line x1="40" y1="35" x2="40" y2="60" stroke="#1e293b" strokeWidth="3"/>
                  <line x1="40" y1="42" x2="25" y2="52" stroke="#1e293b" strokeWidth="3"/>
                  <line x1="40" y1="42" x2="55" y2="52" stroke="#1e293b" strokeWidth="3"/>
                  <line x1="40" y1="60" x2="28" y2="78" stroke="#1e293b" strokeWidth="3"/>
                  <line x1="40" y1="60" x2="52" y2="78" stroke="#1e293b" strokeWidth="3"/>
                </svg>
              </div>
              <div className="text-center mt-2">
                <span className="text-lg font-semibold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
                  Goal/Ideal Self
                </span>
              </div>
            </div>

            {/* Motivation Wheel */}
            <div className="flex flex-col items-center">
              <span className="text-sm font-medium text-slate-600 mb-2">Motivation Wheel:</span>
              <button 
                onClick={spinWheel}
                disabled={isWheelSpinning}
                className="relative group"
              >
                <svg 
                  viewBox="0 0 100 100" 
                  className="w-24 h-24 transition-transform duration-[2000ms] ease-out"
                  style={{ transform: `rotate(${wheelRotation}deg)` }}
                >
                  {/* Wheel segments */}
                  {[0, 60, 120, 180, 240, 300].map((angle, i) => {
                    const colors = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ec4899', '#3b82f6']
                    const startAngle = (angle - 90) * Math.PI / 180
                    const endAngle = (angle + 60 - 90) * Math.PI / 180
                    const x1 = 50 + 40 * Math.cos(startAngle)
                    const y1 = 50 + 40 * Math.sin(startAngle)
                    const x2 = 50 + 40 * Math.cos(endAngle)
                    const y2 = 50 + 40 * Math.sin(endAngle)
                    return (
                      <path
                        key={i}
                        d={`M 50 50 L ${x1} ${y1} A 40 40 0 0 1 ${x2} ${y2} Z`}
                        fill={colors[i]}
                        stroke="white"
                        strokeWidth="2"
                      />
                    )
                  })}
                  {/* Center circle */}
                  <circle cx="50" cy="50" r="12" fill="white" stroke="#1e293b" strokeWidth="2"/>
                  <text x="50" y="54" textAnchor="middle" fontSize="8" fontWeight="bold">SPIN</text>
                </svg>
                {/* Pointer */}
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-t-[12px] border-l-transparent border-r-transparent border-t-slate-900" />
              </button>
              {todaysMotivation && (
                <div className="mt-3 text-center max-w-[200px]">
                  <div className="text-xs text-slate-500">Today's motivation:</div>
                  <div className="text-sm font-medium text-slate-700 italic">"{todaysMotivation}"</div>
                </div>
              )}
              {!todaysMotivation && !isWheelSpinning && (
                <div className="mt-2 text-xs text-slate-400">Click to spin!</div>
              )}
            </div>
          </div>

          {/* Connecting lines visual */}
          <div className="flex justify-center mb-4">
            <svg viewBox="0 0 300 40" className="w-full max-w-md h-10">
              <line x1="150" y1="0" x2="60" y2="35" stroke="#fbbf24" strokeWidth="2"/>
              <line x1="150" y1="0" x2="120" y2="35" stroke="#fbbf24" strokeWidth="2"/>
              <line x1="150" y1="0" x2="180" y2="35" stroke="#fbbf24" strokeWidth="2" strokeDasharray="4"/>
              <line x1="150" y1="0" x2="240" y2="35" stroke="#fbbf24" strokeWidth="2"/>
            </svg>
          </div>

          {/* Recommended Choices with connecting lines to Current button */}
          <div className="relative z-10">
            {/* SVG connecting lines from boxes down to Current button */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ height: 'calc(100% + 80px)' }}>
              {/* Lines from each box to center point (Current button area) */}
              <line x1="12.5%" y1="100%" x2="50%" y2="calc(100% + 60px)" stroke="#fbbf24" strokeWidth="2" />
              <line x1="37.5%" y1="100%" x2="50%" y2="calc(100% + 60px)" stroke="#fbbf24" strokeWidth="2" />
              <line x1="62.5%" y1="100%" x2="50%" y2="calc(100% + 60px)" stroke="#fbbf24" strokeWidth="2" strokeDasharray="6" />
              <line x1="87.5%" y1="100%" x2="50%" y2="calc(100% + 60px)" stroke="#fbbf24" strokeWidth="2" />
            </svg>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-0">
              {recommendedChoices.map((choice, idx) => (
                <Link
                  key={choice.id}
                  href={choice.id === 'see_more' ? '/races?mode=combined' : `/milestones/${choice.id}`}
                  className={`p-4 rounded-xl border-2 transition-all hover:shadow-lg hover:scale-105 ${
                    choice.id === 'see_more' 
                      ? 'border-dashed border-amber-400 bg-amber-50/50 hover:bg-amber-100/50' 
                      : idx === recommendedChoices.length - 1
                        ? 'border-amber-800 bg-gradient-to-br from-amber-700 to-amber-900 text-white hover:from-amber-800 hover:to-amber-950 shadow-xl'
                        : 'border-amber-500 bg-gradient-to-br from-white to-amber-50 hover:border-amber-600 shadow-md'
                  }`}
                >
                  <div className={`font-semibold text-sm mb-1 ${idx === recommendedChoices.length - 1 ? 'text-cyan-300' : 'text-cyan-700'}`}>
                    {choice.name}
                  </div>
                  {choice.success !== null && (
                    <>
                      <div className="text-xs">
                        Success %: <span className={`font-bold ${idx === recommendedChoices.length - 1 ? 'text-emerald-300' : 'text-emerald-600'}`}>{choice.success}%</span>
                      </div>
                      <div className="text-xs">
                        Attempts: <span className={`font-bold ${idx === recommendedChoices.length - 1 ? 'text-emerald-300' : 'text-emerald-600'}`}>{choice.attempts}</span>
                      </div>
                    </>
                  )}
                </Link>
              ))}
            </div>
          </div>

          {/* Connecting lines from boxes to Current - using div-based approach */}
          <div className="flex justify-center py-4">
            <svg viewBox="0 0 400 50" className="w-full max-w-2xl h-12">
              {/* Lines converging from 4 points to center bottom */}
              <line x1="50" y1="0" x2="200" y2="45" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="150" y1="0" x2="200" y2="45" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="250" y1="0" x2="200" y2="45" stroke="#fbbf24" strokeWidth="2.5" strokeDasharray="6" strokeLinecap="round" />
              <line x1="350" y1="0" x2="200" y2="45" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" />
              {/* Small dots at connection points */}
              <circle cx="50" cy="0" r="3" fill="#fbbf24" />
              <circle cx="150" cy="0" r="3" fill="#fbbf24" />
              <circle cx="250" cy="0" r="3" fill="#94a3b8" />
              <circle cx="350" cy="0" r="3" fill="#fbbf24" />
            </svg>
          </div>

          {/* Path Visualization - Clean vertical timeline */}
          <div className="flex flex-col items-center pb-8 relative">
            {/* Pit Stop - Top right */}
            <div className="absolute right-4 md:right-16 top-0">
              <Link
                href="/pit-stop"
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all shadow-md text-sm font-medium"
              >
                Pit Stop
                <ExternalLink className="w-4 h-4" />
              </Link>
            </div>

            {/* Current Milestone Button */}
            <button
              onClick={() => router.push('/milestones')}
              className="px-10 py-4 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-900 rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all border-2 border-amber-500"
            >
              Current
            </button>

            {/* Vertical line */}
            <div className="w-1 h-8 bg-gradient-to-b from-amber-400 to-amber-300 rounded-full"></div>

            {/* See Previous Steps */}
            <button
              onClick={() => setShowPreviousSteps(!showPreviousSteps)}
              className="flex items-center gap-2 px-4 py-2 text-slate-500 hover:text-slate-700 transition-colors"
            >
              {showPreviousSteps ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              <span className="text-sm italic">(see previous steps)</span>
            </button>

            {/* Previous Steps Dropdown */}
            {showPreviousSteps && (
              <div className="mt-2 bg-white border-2 border-slate-200 rounded-xl p-4 w-full max-w-xs shadow-sm">
                <div className="space-y-3">
                  {previousSteps.map((step) => (
                    <div key={step.id} className="flex items-center gap-3 text-sm">
                      <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs">✓</span>
                      </div>
                      <span className="text-slate-600">{step.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Vertical line to Start */}
            <div className="w-1 h-8 bg-gradient-to-b from-slate-300 to-slate-200 rounded-full mt-2"></div>

            {/* Start Point */}
            <div className="px-6 py-2 border-2 border-slate-200 rounded-full bg-slate-50">
              <span className="text-sm text-slate-500 font-medium">Start</span>
            </div>
          </div>

          {/* Journal Button */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <Link 
              href="/reflection?contextType=race"
              className="inline-flex items-center gap-2 px-6 py-3 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-all"
            >
              <Sparkles className="w-4 h-4" />
              Journal / Reflection Window
            </Link>
          </div>
        </div>
      ) : (
        /* Separate View - Two Race Cards with gamified theme */
        <div>
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {[
              { 
                id: 'race_1', 
                name: 'Race 1', 
                progress: 80,
                models: [
                  { name: 'Autism', color: 'text-orange-500' },
                  { name: 'Parent', color: 'text-orange-500' },
                  { name: 'Black', color: 'text-blue-500' },
                  { name: 'Canadian', color: 'text-blue-500' },
                ],
                choices: [
                  { id: 'r1c1', name: 'Recommended Choice 1', success: 90, attempts: 1000 },
                  { id: 'r1c2', name: 'Recommended Choice 2', success: 89, attempts: 101 },
                  { id: 'r1see', name: '(See more choices)', success: null, attempts: null },
                  { id: 'r1last', name: 'Recommended Choice X, Last', success: 10, attempts: 102 },
                ]
              },
              { 
                id: 'race_2', 
                name: 'Race 2', 
                progress: 25,
                models: [
                  { name: 'ADHD', color: 'text-green-500' },
                  { name: 'Adult', color: 'text-green-500' },
                  { name: 'Black', color: 'text-orange-500' },
                  { name: 'Canadian', color: 'text-orange-500' },
                ],
                choices: [
                  { id: 'r2c1', name: 'Recommended Choice 1', success: 90, attempts: 1000 },
                  { id: 'r2c2', name: 'Recommended Choice 2', success: 88, attempts: 101 },
                  { id: 'r2see', name: '(See more choices)', success: null, attempts: null },
                  { id: 'r2last', name: 'Recommended Choice X, Last', success: 10, attempts: 102 },
                ]
              },
            ].map((race, raceIdx) => (
              <div key={race.id} className="bg-white/90 backdrop-blur-sm rounded-2xl border-4 border-amber-800 shadow-2xl p-4 relative overflow-hidden">
                {/* Dirt Road Background Pattern */}
                <div className="absolute inset-0 bg-gradient-to-b from-amber-700 via-amber-600 to-amber-800 opacity-15" 
                     style={{
                       backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                     }} />
                
                {/* Hare and Turtle Characters */}
                <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                  <div className="text-2xl character-bounce">🐰</div>
                  <div className="text-xl character-walk">🐢</div>
                </div>
                {/* Top Row: Stats | Race Info | Models | Motivation Wheel */}
                <div className="grid grid-cols-4 gap-2 mb-4 relative z-10">
                  {/* Stats Box - Gamified */}
                  <div className="border-2 border-purple-500 rounded-lg p-2 text-xs bg-gradient-to-br from-purple-50 to-pink-50 shadow-md">
                    <div className="font-bold mb-1 flex items-center gap-1">
                      <Trophy className="w-3 h-3 text-purple-600" />
                      Stats:
                    </div>
                    <div className="bg-white/60 rounded px-1 mb-1">-Mentality: <span className="text-green-500 font-bold">3XP</span></div>
                    <div className="bg-white/60 rounded px-1 mb-1">-Happiness: <span className="text-green-500 font-bold">5XP</span></div>
                    <div className="text-slate-400">-...</div>
                  </div>

                  {/* Race Info */}
                  <div className="text-sm">
                    <div className="font-bold">{race.name}:...</div>
                    <div>Progress: <span className="text-green-500 font-bold">{race.progress}%</span></div>
                  </div>

                  {/* Models */}
                  <div className="text-sm">
                    <div className="font-bold">Models:</div>
                    {race.models.map((model, idx) => (
                      <div key={idx} className={`${model.color} font-medium`}>
                        {model.name} +
                      </div>
                    ))}
                  </div>

                  {/* Motivation Wheel */}
                  <div className="flex flex-col items-center">
                    <div className="text-xs text-slate-500 mb-1">Motivation Wheel:</div>
                    <button
                      onClick={() => spinRaceWheel(race.id)}
                      disabled={raceWheelSpinning[race.id]}
                      className="relative group cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <svg 
                        viewBox="0 0 60 60" 
                        className="w-14 h-14 drop-shadow-md transition-transform duration-[2000ms] ease-out"
                        style={{ transform: `rotate(${raceWheelRotations[race.id] || 0}deg)` }}
                      >
                        {/* Gradient definitions */}
                        <defs>
                          <linearGradient id={`wheelGrad1-${race.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#06b6d4" />
                            <stop offset="100%" stopColor="#0891b2" />
                          </linearGradient>
                          <linearGradient id={`wheelGrad2-${race.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#8b5cf6" />
                            <stop offset="100%" stopColor="#7c3aed" />
                          </linearGradient>
                          <linearGradient id={`wheelGrad3-${race.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#f59e0b" />
                            <stop offset="100%" stopColor="#d97706" />
                          </linearGradient>
                          <linearGradient id={`wheelGrad4-${race.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#10b981" />
                            <stop offset="100%" stopColor="#059669" />
                          </linearGradient>
                          <linearGradient id={`wheelGrad5-${race.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#ec4899" />
                            <stop offset="100%" stopColor="#db2777" />
                          </linearGradient>
                          <linearGradient id={`wheelGrad6-${race.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#3b82f6" />
                            <stop offset="100%" stopColor="#2563eb" />
                          </linearGradient>
                          <filter id={`glow-${race.id}`} x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="1" result="coloredBlur"/>
                            <feMerge>
                              <feMergeNode in="coloredBlur"/>
                              <feMergeNode in="SourceGraphic"/>
                            </feMerge>
                          </filter>
                        </defs>
                        {/* Outer glow ring */}
                        <circle cx="30" cy="30" r="26" fill="none" stroke="rgba(99, 102, 241, 0.2)" strokeWidth="3"/>
                        {/* Wheel segments with gradients */}
                        {[0, 60, 120, 180, 240, 300].map((angle, i) => {
                          const gradients = [
                            `url(#wheelGrad1-${race.id})`, `url(#wheelGrad2-${race.id})`, 
                            `url(#wheelGrad3-${race.id})`, `url(#wheelGrad4-${race.id})`, 
                            `url(#wheelGrad5-${race.id})`, `url(#wheelGrad6-${race.id})`
                          ]
                          const startAngle = (angle - 90) * Math.PI / 180
                          const endAngle = (angle + 60 - 90) * Math.PI / 180
                          const x1 = 30 + 22 * Math.cos(startAngle)
                          const y1 = 30 + 22 * Math.sin(startAngle)
                          const x2 = 30 + 22 * Math.cos(endAngle)
                          const y2 = 30 + 22 * Math.sin(endAngle)
                          return (
                            <path
                              key={i}
                              d={`M 30 30 L ${x1} ${y1} A 22 22 0 0 1 ${x2} ${y2} Z`}
                              fill={gradients[i]}
                              stroke="white"
                              strokeWidth="1.5"
                              filter={`url(#glow-${race.id})`}
                            />
                          )
                        })}
                        {/* Inner circle with shine */}
                        <circle cx="30" cy="30" r="8" fill="white" stroke="#e2e8f0" strokeWidth="1"/>
                        <circle cx="30" cy="30" r="6" fill="url(#centerShine)" />
                        <defs>
                          <radialGradient id="centerShine">
                            <stop offset="0%" stopColor="#f8fafc" />
                            <stop offset="100%" stopColor="#e2e8f0" />
                          </radialGradient>
                        </defs>
                        {/* Sparkle dots */}
                        <circle cx="30" cy="30" r="2" fill="#6366f1"/>
                        {/* Spin text in center */}
                        <text x="30" y="35" textAnchor="middle" fontSize="6" fontWeight="bold" fill="#1e293b">SPIN</text>
                      </svg>
                      {/* Pointer triangle */}
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[8px] border-l-transparent border-r-transparent border-t-slate-800 drop-shadow-sm" />
                    </button>
                    {raceMotivations[race.id] && (
                      <div className="mt-1 text-center max-w-[120px]">
                        <div className="text-[10px] text-slate-500">Motivation:</div>
                        <div className="text-[10px] font-medium text-slate-700 italic leading-tight">"{raceMotivations[race.id]}"</div>
                      </div>
                    )}
                    {!raceMotivations[race.id] && !raceWheelSpinning[race.id] && (
                      <div className="mt-1 text-[10px] text-slate-400">Click to spin!</div>
                    )}
                  </div>
                </div>

                {/* Goal/Ideal Self - with Hare and Turtle */}
                <div className="flex flex-col items-center mb-4 relative z-10">
                  <div className="relative">
                    <svg viewBox="0 0 60 70" className="w-14 h-16">
                      {/* Platform - dirt road style */}
                      <ellipse cx="30" cy="60" rx="25" ry="8" fill="#8B6914" stroke="#654321" strokeWidth="2"/>
                      <ellipse cx="30" cy="58" rx="20" ry="6" fill="#D4A574" stroke="#8B6914" strokeWidth="1"/>
                    </svg>
                    {/* Characters on platform */}
                    <div className="absolute top-0 left-2 text-xl character-bounce">🐰</div>
                    <div className="absolute top-1 right-2 text-lg character-walk">🐢</div>
                  </div>
                  <div className="text-sm font-medium mt-1 bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">Goal/Ideal Self</div>
                </div>

                {/* Connecting lines (decorative) */}
                <div className="flex justify-center mb-2">
                  <svg viewBox="0 0 200 30" className="w-full h-6">
                    <line x1="100" y1="0" x2="30" y2="25" stroke="#1e293b" strokeWidth="1" strokeDasharray="3"/>
                    <line x1="100" y1="0" x2="70" y2="25" stroke="#1e293b" strokeWidth="1" strokeDasharray="3"/>
                    <line x1="100" y1="0" x2="130" y2="25" stroke="#1e293b" strokeWidth="1" strokeDasharray="3"/>
                    <line x1="100" y1="0" x2="170" y2="25" stroke="#1e293b" strokeWidth="1" strokeDasharray="3"/>
                  </svg>
                </div>

                {/* Recommended Choices Row */}
                <div className="flex gap-2 mb-0 relative">
                  {/* Left arrow */}
                  <button className="absolute -left-2 top-1/2 -translate-y-1/2 w-6 h-6 bg-white border-2 border-slate-900 rounded-full flex items-center justify-center text-xs hover:bg-slate-100">
                    ◀
                  </button>

                  <div className="flex gap-2 flex-1 overflow-hidden px-4">
                    {race.choices.map((choice, idx) => (
                      <Link
                        key={choice.id}
                        href={choice.id.includes('see') ? '#' : `/milestones/${choice.id}`}
                        className={`flex-1 min-w-0 border-2 border-slate-900 rounded p-2 text-xs hover:bg-slate-50 transition-all ${
                          idx === race.choices.length - 1 ? 'bg-slate-900 text-white' : ''
                        }`}
                      >
                        <div className={`font-bold text-cyan-500 ${idx === race.choices.length - 1 ? 'text-cyan-400' : ''}`}>
                          {choice.name}
                        </div>
                        {choice.success !== null && (
                          <>
                            <div>Success %: <span className={`font-bold ${idx === race.choices.length - 1 ? 'text-green-400' : 'text-green-500'}`}>{choice.success}%</span></div>
                            <div>Attempts: <span className={`font-bold ${idx === race.choices.length - 1 ? 'text-green-400' : 'text-green-500'}`}>{choice.attempts}</span></div>
                          </>
                        )}
                      </Link>
                    ))}
                  </div>

                  {/* Right arrow */}
                  <button className="absolute -right-2 top-1/2 -translate-y-1/2 w-6 h-6 bg-slate-900 text-white border-2 border-slate-900 rounded-full flex items-center justify-center text-xs hover:bg-slate-800">
                    ▶
                  </button>
                </div>

                {/* Connecting lines from boxes to Current button */}
                <div className="flex justify-center py-2">
                  <svg viewBox="0 0 200 35" className="w-full h-8">
                    {/* Lines converging from 4 points to center bottom */}
                    <line x1="25" y1="0" x2="100" y2="30" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
                    <line x1="75" y1="0" x2="100" y2="30" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
                    <line x1="125" y1="0" x2="100" y2="30" stroke="#1e293b" strokeWidth="1.5" strokeDasharray="4" strokeLinecap="round" />
                    <line x1="175" y1="0" x2="100" y2="30" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
                    {/* Small dots at connection points */}
                    <circle cx="25" cy="0" r="2" fill="#fbbf24" />
                    <circle cx="75" cy="0" r="2" fill="#fbbf24" />
                    <circle cx="125" cy="0" r="2" fill="#94a3b8" />
                    <circle cx="175" cy="0" r="2" fill="#fbbf24" />
                    {/* Center dot where lines meet */}
                    <circle cx="100" cy="30" r="3" fill="#fbbf24" />
                  </svg>
                </div>

                {/* Path: Current → See Previous → Start | Pit Stop */}
                <div className="relative flex flex-col items-center">
                  {/* Current Button */}
                  <button
                    onClick={() => router.push('/milestones')}
                    className="px-6 py-2 bg-gradient-to-r from-amber-400 to-yellow-400 rounded-full border-2 border-amber-500 font-bold text-sm hover:scale-105 transition-all shadow-md"
                  >
                    Current
                  </button>

                  {/* Pit Stop - positioned to the right */}
                  <Link
                    href="/pit-stop"
                    className="absolute right-0 top-0 px-3 py-1.5 border-2 border-slate-900 rounded text-xs font-medium hover:bg-slate-100 transition-all"
                  >
                    Pit Stop
                  </Link>

                  {/* Path line */}
                  <div className="w-0.5 h-6 bg-amber-400 my-1"></div>

                  {/* See previous steps */}
                  <button 
                    onClick={() => setShowPreviousSteps(!showPreviousSteps)}
                    className="text-xs text-slate-500 italic hover:text-slate-700 border border-dashed border-slate-300 rounded px-3 py-1 hover:border-slate-400 transition-colors"
                  >
                    (see previous steps)
                  </button>
                  
                  {/* Previous steps dropdown */}
                  {showPreviousSteps && (
                    <div className="mt-2 bg-slate-50 rounded-lg p-3 text-left w-full">
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">✓</span>
                          <span className="text-slate-600">Research accommodations</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">✓</span>
                          <span className="text-slate-600">Initial assessment</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">✓</span>
                          <span className="text-slate-600">Set up profile</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Path line */}
                  <div className="w-0.5 h-6 bg-slate-300 my-1"></div>

                  {/* Start */}
                  <div className="px-4 py-1 border-2 border-slate-300 rounded-full text-xs text-slate-500">
                    (Start)
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Shared Journal/Reflection Window */}
          <div className="flex justify-center">
            <Link 
              href="/reflection?contextType=race"
              className="inline-flex items-center gap-2 px-8 py-3 border-2 border-slate-900 rounded-lg font-medium hover:bg-slate-100 transition-all"
            >
              Journal / Reflection Window
            </Link>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

export default function RacesView() {
  return (
    <Suspense fallback={<div className="p-8">Loading races...</div>}>
      <RacesContent />
    </Suspense>
  )
}
