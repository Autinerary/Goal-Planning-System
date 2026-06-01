'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Zap, Battery, BatteryLow, X, Check, Calendar } from 'lucide-react'

// Scenario-specific task data
const scenarioData = {
  worst: {
    description: "Essentials only - for low energy days",
    icon: BatteryLow,
    days: [
      {
        name: 'Monday',
        theme: 'Gentle Start',
        typeOfDay: 'Recovery Day',
        motivation: "Just showing up counts",
        tasks: [
          { id: 'w1', time: '10:00', name: 'One small win', duration: '15 min', priority: 'essential' },
        ]
      },
      {
        name: 'Tuesday',
        theme: 'Minimum Viable',
        typeOfDay: 'Low Energy',
        motivation: "Progress over perfection",
        tasks: [
          { id: 'w2', time: '11:00', name: 'Essential task only', duration: '20 min', priority: 'essential' },
        ]
      },
      {
        name: 'Wednesday',
        theme: 'Rest & Reset',
        typeOfDay: 'Recovery',
        motivation: "Rest is productive",
        tasks: [
          { id: 'w3', time: '14:00', name: 'Self-care check-in', duration: '10 min', priority: 'essential' },
        ]
      },
      {
        name: 'Thursday',
        theme: 'Gentle Progress',
        typeOfDay: 'Low Energy',
        motivation: "Small steps matter",
        tasks: [
          { id: 'w4', time: '10:00', name: 'Quick review', duration: '15 min', priority: 'essential' },
        ]
      },
      {
        name: 'Friday',
        theme: 'Soft Close',
        typeOfDay: 'Wind Down',
        motivation: "You made it through",
        tasks: [
          { id: 'w5', time: '11:00', name: 'Week reflection', duration: '10 min', priority: 'essential' },
        ]
      },
    ]
  },
  average: {
    description: "Sustainable pace - balanced workload",
    icon: Battery,
    days: [
      {
        name: 'Monday',
        theme: 'Fresh Start',
        typeOfDay: 'Planning Day',
        motivation: "New week, new opportunities",
        tasks: [
          { id: 'a1', time: '9:00', name: 'Week planning session', duration: '30 min', priority: 'high' },
          { id: 'a2', time: '10:00', name: 'Priority task #1', duration: '45 min', priority: 'high' },
          { id: 'a3', time: '14:00', name: 'Review materials', duration: '30 min', priority: 'medium' },
        ]
      },
      {
        name: 'Tuesday',
        theme: 'Deep Work',
        typeOfDay: 'Focus Day',
        motivation: "Channel your focus",
        tasks: [
          { id: 'a4', time: '9:00', name: 'Deep work block', duration: '1 hr', priority: 'high' },
          { id: 'a5', time: '11:00', name: 'Skill practice', duration: '45 min', priority: 'medium' },
          { id: 'a6', time: '15:00', name: 'Light admin', duration: '30 min', priority: 'low' },
        ]
      },
      {
        name: 'Wednesday',
        theme: 'Momentum',
        typeOfDay: 'Progress Day',
        motivation: "Keep the momentum",
        tasks: [
          { id: 'a7', time: '9:00', name: 'Continue project', duration: '1 hr', priority: 'high' },
          { id: 'a8', time: '14:00', name: 'Mid-week check-in', duration: '20 min', priority: 'medium' },
        ]
      },
      {
        name: 'Thursday',
        theme: 'Connection',
        typeOfDay: 'Collaboration Day',
        motivation: "Reach out and connect",
        tasks: [
          { id: 'a9', time: '10:00', name: 'Study group / meeting', duration: '1 hr', priority: 'high' },
          { id: 'a10', time: '14:00', name: 'Follow-up tasks', duration: '30 min', priority: 'medium' },
        ]
      },
      {
        name: 'Friday',
        theme: 'Completion',
        typeOfDay: 'Wrap-up Day',
        motivation: "Finish strong",
        tasks: [
          { id: 'a11', time: '9:00', name: 'Complete open items', duration: '1 hr', priority: 'high' },
          { id: 'a12', time: '14:00', name: 'Week review & celebrate', duration: '30 min', priority: 'medium' },
        ]
      },
    ]
  },
  best: {
    description: "Full schedule - for high energy days",
    icon: Zap,
    days: [
      {
        name: 'Monday',
        theme: 'Power Start',
        typeOfDay: 'High Energy',
        motivation: "Seize the day!",
        tasks: [
          { id: 'b1', time: '8:00', name: 'Morning exercise', duration: '30 min', priority: 'wellness' },
          { id: 'b2', time: '9:00', name: 'Strategic planning', duration: '45 min', priority: 'high' },
          { id: 'b3', time: '10:00', name: 'Priority project work', duration: '1.5 hr', priority: 'high' },
          { id: 'b4', time: '12:00', name: 'Lunch + walk', duration: '45 min', priority: 'wellness' },
          { id: 'b5', time: '14:00', name: 'Skill development', duration: '1 hr', priority: 'growth' },
          { id: 'b6', time: '16:00', name: 'Admin & emails', duration: '30 min', priority: 'medium' },
        ]
      },
      {
        name: 'Tuesday',
        theme: 'Deep Dive',
        typeOfDay: 'Hyperfocus Day',
        motivation: "Dive deep into what matters",
        tasks: [
          { id: 'b7', time: '8:00', name: 'Mindfulness practice', duration: '15 min', priority: 'wellness' },
          { id: 'b8', time: '9:00', name: 'Deep work session 1', duration: '2 hr', priority: 'high' },
          { id: 'b9', time: '11:30', name: 'Movement break', duration: '15 min', priority: 'wellness' },
          { id: 'b10', time: '12:00', name: 'Lunch', duration: '30 min', priority: 'wellness' },
          { id: 'b11', time: '13:00', name: 'Deep work session 2', duration: '1.5 hr', priority: 'high' },
          { id: 'b12', time: '15:00', name: 'Creative project', duration: '1 hr', priority: 'growth' },
          { id: 'b13', time: '16:30', name: 'Review & plan tomorrow', duration: '30 min', priority: 'medium' },
        ]
      },
      {
        name: 'Wednesday',
        theme: 'Full Throttle',
        typeOfDay: 'Peak Performance',
        motivation: "You're unstoppable",
        tasks: [
          { id: 'b14', time: '8:00', name: 'Energizing workout', duration: '45 min', priority: 'wellness' },
          { id: 'b15', time: '9:00', name: 'High-priority deliverable', duration: '2 hr', priority: 'high' },
          { id: 'b16', time: '11:30', name: 'Quick break + snack', duration: '15 min', priority: 'wellness' },
          { id: 'b17', time: '12:00', name: 'Collaboration meeting', duration: '1 hr', priority: 'high' },
          { id: 'b18', time: '14:00', name: 'Action items follow-up', duration: '1 hr', priority: 'high' },
          { id: 'b19', time: '15:30', name: 'Learning new skill', duration: '1 hr', priority: 'growth' },
        ]
      },
      {
        name: 'Thursday',
        theme: 'Connection Day',
        typeOfDay: 'Social + Work',
        motivation: "Connect and create",
        tasks: [
          { id: 'b20', time: '8:00', name: 'Morning routine', duration: '30 min', priority: 'wellness' },
          { id: 'b21', time: '9:00', name: 'Team/study session', duration: '1.5 hr', priority: 'high' },
          { id: 'b22', time: '11:00', name: 'Individual work', duration: '1 hr', priority: 'high' },
          { id: 'b23', time: '12:30', name: 'Lunch with peer/mentor', duration: '1 hr', priority: 'growth' },
          { id: 'b24', time: '14:00', name: 'Project continuation', duration: '1.5 hr', priority: 'high' },
          { id: 'b25', time: '16:00', name: 'Networking/outreach', duration: '30 min', priority: 'growth' },
        ]
      },
      {
        name: 'Friday',
        theme: 'Victory Lap',
        typeOfDay: 'Achievement Day',
        motivation: "Celebrate your wins!",
        tasks: [
          { id: 'b26', time: '8:00', name: 'Light exercise', duration: '30 min', priority: 'wellness' },
          { id: 'b27', time: '9:00', name: 'Complete final items', duration: '1.5 hr', priority: 'high' },
          { id: 'b28', time: '11:00', name: 'Week achievement review', duration: '30 min', priority: 'medium' },
          { id: 'b29', time: '12:00', name: 'Reward lunch', duration: '1 hr', priority: 'wellness' },
          { id: 'b30', time: '14:00', name: 'Creative/fun project', duration: '1 hr', priority: 'growth' },
          { id: 'b31', time: '15:30', name: 'Plan next week', duration: '30 min', priority: 'medium' },
          { id: 'b32', time: '16:30', name: 'Early finish - self-care', duration: 'rest of day', priority: 'wellness' },
        ]
      },
    ]
  }
}

const priorityColors: Record<string, string> = {
  essential: 'bg-red-100 border-red-300',
  high: 'bg-orange-100 border-orange-300',
  medium: 'bg-yellow-100 border-yellow-300',
  low: 'bg-green-100 border-green-300',
  wellness: 'bg-blue-100 border-blue-300',
  growth: 'bg-purple-100 border-purple-300',
}

function CalendarContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const viewType = searchParams.get('view') || 'list'
  const comparisonType = searchParams.get('comparison') || 'day' // 'day' or 'week'
  const suggestionParam = searchParams.get('suggestion')
  const fromParam = searchParams.get('from')
  const [scenario, setScenario] = useState<'worst' | 'average' | 'best'>('average')
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set())
  const [addedTasks, setAddedTasks] = useState<Array<{id: string, day: string, time: string, name: string, duration: string, priority: string, from?: string}>>(() => {
    // Load from localStorage on mount
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('calendarAddedTasks')
      return saved ? JSON.parse(saved) : []
    }
    return []
  })
  const [showSuggestionModal, setShowSuggestionModal] = useState(false)
  const [pendingSuggestion, setPendingSuggestion] = useState<{suggestion: string, from: string} | null>(null)

  const currentData = scenarioData[scenario]
  const ScenarioIcon = currentData.icon

  // Check for pending suggestion on mount or when params change
  useEffect(() => {
    if (suggestionParam && fromParam) {
      setPendingSuggestion({ suggestion: suggestionParam, from: fromParam })
      setShowSuggestionModal(true)
      // Clear URL params
      router.replace('/calendar?view=' + viewType + '&comparison=' + comparisonType, { scroll: false })
    } else {
      // Check localStorage for pending suggestions
      const pending = localStorage.getItem('pendingCalendarSuggestions')
      if (pending) {
        try {
          const suggestions = JSON.parse(pending)
          if (suggestions.length > 0) {
            const latest = suggestions[suggestions.length - 1]
            setPendingSuggestion({ suggestion: latest.suggestion, from: latest.from })
            setShowSuggestionModal(true)
            // Remove from pending
            localStorage.removeItem('pendingCalendarSuggestions')
          }
        } catch (e) {
          console.error('Error parsing pending suggestions:', e)
        }
      }
    }
  }, [suggestionParam, fromParam, router, viewType, comparisonType])

  const toggleTask = (taskId: string) => {
    setCompletedTasks(prev => {
      const newSet = new Set(prev)
      if (newSet.has(taskId)) {
        newSet.delete(taskId)
      } else {
        newSet.add(taskId)
      }
      return newSet
    })
  }

  const addSuggestionToCalendar = (suggestion: string, from: string, selectedDay: string, selectedTime: string) => {
    // Generate task ID
    const taskId = `suggestion_${Date.now()}`
    
    // Parse suggestion to determine duration and priority
    let duration = '30 min'
    let priority = 'medium'
    
    if (suggestion.toLowerCase().includes('body double') || suggestion.toLowerCase().includes('together')) {
      duration = '1 hr'
      priority = 'high'
    } else if (suggestion.toLowerCase().includes('break') || suggestion.toLowerCase().includes('step')) {
      duration = '15 min'
      priority = 'medium'
    } else if (suggestion.toLowerCase().includes('pomodoro') || suggestion.toLowerCase().includes('technique')) {
      duration = '25 min'
      priority = 'high'
    }
    
    // Create task name from suggestion
    const taskName = suggestion.length > 50 ? suggestion.substring(0, 50) + '...' : suggestion
    
    const newTask = {
      id: taskId,
      day: selectedDay,
      time: selectedTime,
      name: taskName,
      duration: duration,
      priority: priority,
      from: from
    }
    
    // Add to state
    const updated = [...addedTasks, newTask]
    setAddedTasks(updated)
    
    // Save to localStorage
    localStorage.setItem('calendarAddedTasks', JSON.stringify(updated))
    
    // Close modal
    setShowSuggestionModal(false)
    setPendingSuggestion(null)
    
    alert(`✅ Task added to ${selectedDay} at ${selectedTime}!\n\n"${taskName}"\n\nFrom: ${from}`)
  }

  // Merge added tasks with scenario data
  const getTasksForDay = (dayName: string) => {
    const dayData = currentData.days.find(d => d.name === dayName)
    const addedForDay = addedTasks.filter(t => t.day === dayName)
    
    if (!dayData) return []
    
    // Merge and sort by time
    const allTasks = [...dayData.tasks, ...addedForDay]
    return allTasks.sort((a, b) => {
      const timeA = a.time.replace(':', '')
      const timeB = b.time.replace(':', '')
      return parseInt(timeA) - parseInt(timeB)
    })
  }

  return (
    <div className="min-h-screen bg-white/20 backdrop-blur-sm p-8 relative overflow-hidden">
      {/* Background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '5s', animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-pink-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
      </div>
      <div className="relative z-10">
        {/* Suggestion Modal */}
        {showSuggestionModal && pendingSuggestion && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white/95 backdrop-blur-sm border-2 border-slate-300 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-purple-500/30 to-pink-500/30 rounded-lg">
                    <Calendar className="w-6 h-6 text-purple-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-800">Add to Calendar</h3>
                </div>
                <button 
                  onClick={() => {
                    setShowSuggestionModal(false)
                    setPendingSuggestion(null)
                  }} 
                  className="p-2 hover:bg-slate-100 rounded-lg text-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-5">
                <div className="p-4 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-300 rounded-xl backdrop-blur-sm">
                  <div className="text-sm font-semibold text-purple-700 mb-2">{pendingSuggestion.from}</div>
                  <div className="text-sm text-slate-800">{pendingSuggestion.suggestion}</div>
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">Select Day:</label>
                  <select
                    id="suggestion-day"
                    className="w-full px-4 py-3 bg-white/80 backdrop-blur-sm border-2 border-slate-300 rounded-lg focus:outline-none focus:border-purple-500 text-slate-800"
                    defaultValue={currentData.days[0]?.name || 'Monday'}
                  >
                    {currentData.days.map(day => (
                      <option key={day.name} value={day.name} className="bg-white text-slate-800">{day.name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">Select Time:</label>
                  <select
                    id="suggestion-time"
                    className="w-full px-4 py-3 bg-white/80 backdrop-blur-sm border-2 border-slate-300 rounded-lg focus:outline-none focus:border-purple-500 text-slate-800"
                    defaultValue="14:00"
                  >
                    {['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'].map(time => (
                      <option key={time} value={time} className="bg-white text-slate-800">{time}</option>
                    ))}
                  </select>
                </div>
                
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      setShowSuggestionModal(false)
                      setPendingSuggestion(null)
                    }}
                    className="flex-1 px-4 py-3 bg-white/60 backdrop-blur-sm border-2 border-slate-300 text-slate-800 rounded-lg hover:bg-white/80 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const daySelect = document.getElementById('suggestion-day') as HTMLSelectElement
                      const timeSelect = document.getElementById('suggestion-time') as HTMLSelectElement
                      if (daySelect && timeSelect) {
                        addSuggestionToCalendar(
                          pendingSuggestion.suggestion,
                          pendingSuggestion.from,
                          daySelect.value,
                          timeSelect.value
                        )
                      }
                    }}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:shadow-lg hover:shadow-purple-500/50 transition-all flex items-center justify-center gap-2 font-semibold"
                  >
                    <Check className="w-5 h-5" />
                    Add to Calendar
                  </button>
                </div>
              </div>
          </div>
        </div>
      )}
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Calendar</h1>
          <p className="text-slate-700">Plan your week with personalized schedules</p>
        </div>

        {/* View Toggle */}
        <div className="flex flex-wrap gap-4 mb-8">
          <div className="flex gap-3">
            <button
              onClick={() => router.push(`/calendar?view=list&comparison=${comparisonType}`)}
              className={`px-5 py-2.5 rounded-lg font-medium transition-all ${
                viewType === 'list' 
                  ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-lg' 
                  : 'bg-white/60 backdrop-blur-lg border-2 border-slate-300 text-slate-800 hover:bg-white/80'
              }`}
            >
              📋 List View
            </button>
            <button
              onClick={() => router.push(`/calendar?view=timeblock&comparison=${comparisonType}`)}
              className={`px-5 py-2.5 rounded-lg font-medium transition-all ${
                viewType === 'timeblock' 
                  ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-lg' 
                  : 'bg-white/60 backdrop-blur-lg border-2 border-slate-300 text-slate-800 hover:bg-white/80'
              }`}
            >
              ⏰ Time Blocks
            </button>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push(`/calendar?view=${viewType}&comparison=day`)}
              className={`px-5 py-2.5 rounded-lg font-medium transition-all ${
                comparisonType === 'day' 
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg' 
                  : 'bg-white/60 backdrop-blur-lg border-2 border-slate-300 text-slate-800 hover:bg-white/80'
              }`}
            >
              📅 Day Comparison
            </button>
            <button
              onClick={() => router.push(`/calendar?view=${viewType}&comparison=week`)}
              className={`px-5 py-2.5 rounded-lg font-medium transition-all ${
                comparisonType === 'week' 
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg' 
                  : 'bg-white/60 backdrop-blur-lg border-2 border-slate-300 text-slate-800 hover:bg-white/80'
              }`}
            >
              📊 Week Comparison
            </button>
          </div>
        </div>

        {/* Scenario Selector */}
        <div className="flex flex-wrap gap-3 mb-8">
          <button
            onClick={() => setScenario('worst')}
            className={`px-5 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 ${
              scenario === 'worst' 
                ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg' 
                : 'bg-white/60 backdrop-blur-lg border-2 border-slate-300 text-slate-800 hover:bg-white/80'
            }`}
          >
            <BatteryLow className="w-5 h-5" />
            Low Energy
          </button>
          <button
            onClick={() => setScenario('average')}
            className={`px-5 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 ${
              scenario === 'average' 
                ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-white shadow-lg' 
                : 'bg-white/60 backdrop-blur-lg border-2 border-slate-300 text-slate-800 hover:bg-white/80'
            }`}
          >
            <Battery className="w-5 h-5" />
            Balanced
          </button>
          <button
            onClick={() => setScenario('best')}
            className={`px-5 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 ${
              scenario === 'best' 
                ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg' 
                : 'bg-white/60 backdrop-blur-lg border-2 border-slate-300 text-slate-800 hover:bg-white/80'
            }`}
          >
            <Zap className="w-5 h-5" />
            High Energy
          </button>
        </div>

        <div className="bg-white/60 backdrop-blur-lg border-2 border-slate-300 rounded-2xl p-6 md:p-8 shadow-2xl">
          {/* Scenario Info Banner */}
          <div className={`mb-8 p-5 rounded-xl border-2 backdrop-blur-sm ${
            scenario === 'worst' ? 'bg-red-500/20 border-red-400/30' :
            scenario === 'average' ? 'bg-yellow-500/20 border-yellow-400/30' :
            'bg-green-500/20 border-green-400/30'
          }`}>
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${
                scenario === 'worst' ? 'bg-red-500/30' :
                scenario === 'average' ? 'bg-yellow-500/30' :
                'bg-green-500/30'
              }`}>
                <ScenarioIcon className={`w-6 h-6 ${
                  scenario === 'worst' ? 'text-red-600' :
                  scenario === 'average' ? 'text-amber-600' :
                  'text-green-600'
                }`} />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-800 capitalize">{scenario} Case Schedule</h3>
                <p className="text-sm text-slate-700 mt-1">{currentData.description}</p>
              </div>
            </div>
          </div>

          {comparisonType === 'day' ? (
            // Side-by-side comparison for a single day
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white/60 backdrop-blur-sm rounded-xl p-5 border border-slate-300">
                <h3 className="font-bold mb-4 text-lg text-slate-800 flex items-center gap-2">
                  <span className="text-blue-600">✨</span> Your Day
                </h3>
                {viewType === 'list' ? (
                  <ListView 
                    days={currentData.days.length > 0 ? [currentData.days[0]] : []} 
                    completedTasks={completedTasks}
                    toggleTask={toggleTask}
                    addedTasks={addedTasks}
                  />
                ) : (
                  <TimeBlockView 
                    days={currentData.days.length > 0 ? [currentData.days[0]] : []}
                    completedTasks={completedTasks}
                    toggleTask={toggleTask}
                    addedTasks={addedTasks}
                  />
                )}
              </div>
              <div className="bg-white/60 backdrop-blur-sm rounded-xl p-5 border border-slate-300">
                <h3 className="font-bold mb-4 text-lg text-slate-800 flex items-center gap-2">
                  <span className="text-purple-600">👥</span> Their Day
                </h3>
                <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-sm rounded-lg p-5 border border-purple-300">
                  <p className="text-sm text-purple-700 mb-4 font-medium">Role Model's / Mentor's schedule:</p>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-3 bg-white/60 p-2 rounded-lg">
                      <span className="text-purple-600 font-mono font-semibold w-16">8:00</span>
                      <span className="text-slate-800">Morning routine + exercise</span>
                    </div>
                    <div className="flex items-center gap-3 bg-white/60 p-2 rounded-lg">
                      <span className="text-purple-600 font-mono font-semibold w-16">9:00</span>
                      <span className="text-slate-800">Deep work session</span>
                    </div>
                    <div className="flex items-center gap-3 bg-white/60 p-2 rounded-lg">
                      <span className="text-purple-600 font-mono font-semibold w-16">12:00</span>
                      <span className="text-slate-800">Lunch break</span>
                    </div>
                    <div className="flex items-center gap-3 bg-white/60 p-2 rounded-lg">
                      <span className="text-purple-600 font-mono font-semibold w-16">14:00</span>
                      <span className="text-slate-800">Continue project work</span>
                    </div>
                    <div className="flex items-center gap-3 bg-white/60 p-2 rounded-lg">
                      <span className="text-purple-600 font-mono font-semibold w-16">16:00</span>
                      <span className="text-slate-800">Review & plan tomorrow</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Top vs. Bottom comparison for week
            <div className="space-y-8">
              <div className="bg-white/60 backdrop-blur-sm rounded-xl p-5 border border-slate-300">
                <h3 className="font-bold mb-4 text-lg text-slate-800 flex items-center gap-2">
                  <span className="text-blue-600">✨</span> Your Week
                </h3>
                {viewType === 'list' ? (
                  <ListView 
                    days={currentData.days} 
                    completedTasks={completedTasks}
                    toggleTask={toggleTask}
                    addedTasks={addedTasks}
                  />
                ) : (
                  <TimeBlockView 
                    days={currentData.days}
                    completedTasks={completedTasks}
                    toggleTask={toggleTask}
                    addedTasks={addedTasks}
                  />
                )}
              </div>
              <div className="border-t-2 border-slate-300 pt-8">
                <h3 className="font-bold mb-4 text-lg text-slate-800 flex items-center gap-2">
                  <span className="text-purple-600">👥</span> Their Week
                </h3>
                <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-sm rounded-lg p-5 border border-purple-300">
                  <p className="text-sm text-purple-700 mb-4 font-medium">Role Model's / Mentor's weekly schedule:</p>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day) => (
                      <div key={day} className="bg-white/60 backdrop-blur-sm rounded-lg p-3 border border-slate-300">
                        <div className="font-bold mb-2 text-slate-800">{day}</div>
                        <div className="space-y-1.5 text-slate-700">
                          <div className="text-purple-600 font-mono">8:00</div>
                          <div className="text-xs">Routine</div>
                          <div className="text-purple-600 font-mono">9:00</div>
                          <div className="text-xs">Work</div>
                          <div className="text-purple-600 font-mono">12:00</div>
                          <div className="text-xs">Break</div>
                          <div className="text-purple-600 font-mono">14:00</div>
                          <div className="text-xs">Continue</div>
                          <div className="text-purple-600 font-mono">16:00</div>
                          <div className="text-xs">Review</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}


        {/* Journal Button */}
          <div className="mt-8 text-center">
            <Link 
              href="/reflection?contextType=calendar"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-amber-200/50 transition-all"
            >
              <Calendar className="w-5 h-5" />
              Journal / Reflection
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function ListView({ days, completedTasks, toggleTask, addedTasks }: { 
  days: typeof scenarioData.average.days, 
  completedTasks: Set<string>,
  toggleTask: (id: string) => void,
  addedTasks?: Array<{id: string, day: string, time: string, name: string, duration: string, priority: string, from?: string}>
}) {
  const [currentDayIndex, setCurrentDayIndex] = useState(0)
  const visibleDays = days.slice(currentDayIndex, currentDayIndex + 2)

  const getTasksForDay = (dayName: string) => {
    const dayData = days.find(d => d.name === dayName)
    const addedForDay = (addedTasks || []).filter(t => t.day === dayName)
    
    if (!dayData) return []
    
    const allTasks = [...dayData.tasks, ...addedForDay]
    return allTasks.sort((a, b) => {
      const timeA = a.time.replace(':', '')
      const timeB = b.time.replace(':', '')
      return parseInt(timeA) - parseInt(timeB)
    })
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {visibleDays.map((day, idx) => (
          <div key={idx} className="bg-white/60 backdrop-blur-sm rounded-xl p-5 border border-slate-300">
            <div className="mb-4 pb-4 border-b border-slate-300">
              <h3 className="font-bold text-xl text-slate-800 mb-2">{day.name}</h3>
              <div className="text-sm italic text-blue-600 mb-1">Theme: {day.theme}</div>
              <div className="text-sm italic text-purple-600 mb-2">{day.typeOfDay}</div>
              <div className="text-sm italic text-pink-600 mt-2">"{day.motivation}"</div>
            </div>

            <div className="space-y-3">
              {getTasksForDay(day.name).map((task) => (
                <div 
                  key={task.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border backdrop-blur-sm transition-all ${
                    task.priority === 'high' ? 'bg-red-500/20 border-red-400/30' :
                    task.priority === 'medium' ? 'bg-yellow-500/20 border-yellow-400/30' :
                    task.priority === 'essential' ? 'bg-orange-500/20 border-orange-400/30' :
                    'bg-cyan-500/20 border-cyan-400/30'
                  } ${completedTasks.has(task.id) ? 'opacity-50' : 'hover:bg-white/40'}`}
                >
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 cursor-pointer accent-blue-600"
                    checked={completedTasks.has(task.id)}
                    onChange={() => toggleTask(task.id)}
                  />
                  <span className="text-sm text-blue-600 font-mono font-semibold w-16">{task.time}</span>
                  <Link 
                    href={`/tasks/${task.id}`}
                    className={`flex-1 text-slate-800 hover:text-blue-600 transition-colors ${
                      completedTasks.has(task.id) ? 'line-through' : ''
                    }`}
                  >
                    {task.name}
                    {(task as any).from && (
                      <span className="text-xs text-purple-600 ml-2">(from {(task as any).from})</span>
                    )}
                  </Link>
                  <span className="text-xs text-slate-600 bg-white/60 px-2 py-1 rounded">{task.duration}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex justify-center items-center gap-4 mt-6">
        <button 
          onClick={() => setCurrentDayIndex(Math.max(0, currentDayIndex - 1))}
          disabled={currentDayIndex === 0}
          className="p-2 bg-white/60 backdrop-blur-lg border-2 border-slate-300 rounded-lg text-slate-800 hover:bg-white/80 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="py-2 text-sm text-slate-700 font-medium">
          Days {currentDayIndex + 1}-{Math.min(currentDayIndex + 2, days.length)} of {days.length}
        </span>
        <button 
          onClick={() => setCurrentDayIndex(Math.min(days.length - 2, currentDayIndex + 1))}
          disabled={currentDayIndex >= days.length - 2}
          className="p-2 bg-white/60 backdrop-blur-lg border-2 border-slate-300 rounded-lg text-slate-800 hover:bg-white/80 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}

function TimeBlockView({ days, completedTasks, toggleTask, addedTasks }: { 
  days: typeof scenarioData.average.days,
  completedTasks: Set<string>,
  toggleTask: (id: string) => void,
  addedTasks?: Array<{id: string, day: string, time: string, name: string, duration: string, priority: string, from?: string}>
}) {
  // Get all unique time slots (including added tasks)
  const allTimes = [...new Set([
    ...days.flatMap(d => d.tasks.map(t => t.time)),
    ...(addedTasks || []).map(t => t.time)
  ])].sort()
  
  const getTasksForDay = (dayName: string) => {
    const dayData = days.find(d => d.name === dayName)
    const addedForDay = (addedTasks || []).filter(t => t.day === dayName)
    
    if (!dayData) return []
    
    const allTasks = [...dayData.tasks, ...addedForDay]
    return allTasks.sort((a, b) => {
      const timeA = a.time.replace(':', '')
      const timeB = b.time.replace(':', '')
      return parseInt(timeA) - parseInt(timeB)
    })
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-300">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="bg-gradient-to-r from-cyan-500/30 to-purple-500/30 backdrop-blur-sm p-3 text-slate-800 font-bold w-24 border-b-2 border-slate-300">Time</th>
            {days.map((day, idx) => (
              <th key={idx} className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-sm p-4 text-left border-b-2 border-slate-300">
                <div className="font-bold text-slate-800 text-lg">{day.name}</div>
                <div className="text-xs italic font-normal text-blue-600 mt-1">{day.theme}</div>
                <div className="text-xs italic font-normal text-purple-600">{day.typeOfDay}</div>
                <div className="text-xs italic font-normal text-pink-600 mt-1">"{day.motivation}"</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allTimes.map((time, timeIdx) => (
            <tr key={timeIdx} className="border-b border-slate-300 hover:bg-white/40 transition-colors">
              <td className="p-3 font-bold text-center bg-gradient-to-r from-cyan-500/20 to-purple-500/20 backdrop-blur-sm text-blue-600 border-r border-slate-300">{time}</td>
              {days.map((day, dayIdx) => {
                const tasksForDay = getTasksForDay(day.name)
                const task = tasksForDay.find(t => t.time === time)
                return (
                  <td key={dayIdx} className={`p-3 border-r border-slate-300 ${
                    task 
                      ? task.priority === 'high' ? 'bg-red-500/10' :
                        task.priority === 'medium' ? 'bg-yellow-500/10' :
                        task.priority === 'essential' ? 'bg-orange-500/10' :
                        'bg-cyan-500/10'
                      : ''
                  }`}>
                    {task && (
                      <div className={`flex items-start gap-2 ${completedTasks.has(task.id) ? 'opacity-50' : ''}`}>
                        <input 
                          type="checkbox" 
                          className="w-5 h-5 mt-0.5 cursor-pointer accent-blue-600"
                          checked={completedTasks.has(task.id)}
                          onChange={() => toggleTask(task.id)}
                        />
                        <div className="flex-1">
                          <Link 
                            href={`/tasks/${task.id}`}
                            className={`text-slate-800 hover:text-blue-600 transition-colors block ${completedTasks.has(task.id) ? 'line-through' : ''}`}
                          >
                            {task.name}
                            {(task as any).from && (
                              <span className="text-xs text-purple-600 ml-1">(from {(task as any).from})</span>
                            )}
                          </Link>
                          <span className="text-xs text-slate-600 mt-1 block">{task.duration}</span>
                        </div>
                      </div>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function CalendarView() {
  return (
    <Suspense fallback={<div className="p-8">Loading calendar...</div>}>
      <CalendarContent />
    </Suspense>
  )
}
