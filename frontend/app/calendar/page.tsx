'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Zap, Battery, BatteryLow } from 'lucide-react'

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
  const [scenario, setScenario] = useState<'worst' | 'average' | 'best'>('average')
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set())

  const currentData = scenarioData[scenario]
  const ScenarioIcon = currentData.icon

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

  return (
    <div className="min-h-screen bg-white p-8">
      {/* View Toggle */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => router.push('/calendar?view=list')}
          className={`px-4 py-2 border-2 border-black rounded ${viewType === 'list' ? 'bg-gray-200' : ''}`}
        >
          4. Calendar View 1 - Lists
        </button>
        <button
          onClick={() => router.push('/calendar?view=timeblock')}
          className={`px-4 py-2 border-2 border-black rounded ${viewType === 'timeblock' ? 'bg-gray-200' : ''}`}
        >
          Calendar View 2 - Time Blocks
        </button>
      </div>

      <div className="border-2 border-black rounded-lg p-6">
        {/* Scenario Info Banner */}
        <div className={`mb-6 p-4 rounded-lg border-2 ${
          scenario === 'worst' ? 'bg-red-50 border-red-200' :
          scenario === 'average' ? 'bg-yellow-50 border-yellow-200' :
          'bg-green-50 border-green-200'
        }`}>
          <div className="flex items-center gap-3">
            <ScenarioIcon className={`w-6 h-6 ${
              scenario === 'worst' ? 'text-red-500' :
              scenario === 'average' ? 'text-yellow-600' :
              'text-green-500'
            }`} />
            <div>
              <h3 className="font-bold capitalize">{scenario} Case Schedule</h3>
              <p className="text-sm text-gray-600">{currentData.description}</p>
            </div>
          </div>
        </div>

        {viewType === 'list' ? (
          <ListView 
            days={currentData.days} 
            completedTasks={completedTasks}
            toggleTask={toggleTask}
          />
        ) : (
          <TimeBlockView 
            days={currentData.days}
            completedTasks={completedTasks}
            toggleTask={toggleTask}
          />
        )}

        {/* Scenario Toggle */}
        <div className="flex justify-center gap-0 mt-6">
          <div className="border-2 border-black inline-flex rounded overflow-hidden">
            <button
              onClick={() => setScenario('worst')}
              className={`px-4 py-2 border-r-2 border-black flex items-center gap-2 ${scenario === 'worst' ? 'bg-red-100' : 'hover:bg-gray-100'}`}
            >
              <BatteryLow className="w-4 h-4" />
              Worst-Case
            </button>
            <button
              onClick={() => setScenario('average')}
              className={`px-4 py-2 border-r-2 border-black flex items-center gap-2 ${scenario === 'average' ? 'bg-yellow-100' : 'hover:bg-gray-100'}`}
            >
              <Battery className="w-4 h-4" />
              Average Case
            </button>
            <button
              onClick={() => setScenario('best')}
              className={`px-4 py-2 flex items-center gap-2 ${scenario === 'best' ? 'bg-green-100' : 'hover:bg-gray-100'}`}
            >
              <Zap className="w-4 h-4" />
              Best Case
            </button>
          </div>
        </div>

        {/* Journal Button */}
        <div className="mt-4 text-center">
          <Link 
            href="/reflection?contextType=calendar"
            className="inline-block border-2 border-black px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
          >
            Journal / Reflection Window
          </Link>
        </div>
      </div>
    </div>
  )
}

function ListView({ days, completedTasks, toggleTask }: { 
  days: typeof scenarioData.average.days, 
  completedTasks: Set<string>,
  toggleTask: (id: string) => void 
}) {
  const [currentDayIndex, setCurrentDayIndex] = useState(0)
  const visibleDays = days.slice(currentDayIndex, currentDayIndex + 2)

  return (
    <div>
      <div className="flex gap-6">
        {visibleDays.map((day, idx) => (
          <div key={idx} className="flex-1 border-2 border-black rounded p-4">
            <div className="mb-3">
              <h3 className="font-bold text-lg">{day.name}</h3>
              <div className="text-xs italic text-gray-600">Theme: {day.theme}</div>
              <div className="text-xs italic text-gray-600">{day.typeOfDay}</div>
              <div className="text-xs italic text-blue-600 mt-1">"{day.motivation}"</div>
            </div>

            <div className="space-y-2">
              {day.tasks.map((task) => (
                <div 
                  key={task.id}
                  className={`flex items-center gap-2 p-2 rounded border ${priorityColors[task.priority] || 'bg-gray-50'} ${
                    completedTasks.has(task.id) ? 'opacity-50' : ''
                  }`}
                >
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 cursor-pointer"
                    checked={completedTasks.has(task.id)}
                    onChange={() => toggleTask(task.id)}
                  />
                  <span className="text-xs text-gray-500 font-mono">{task.time}</span>
                  <Link 
                    href={`/tasks/${task.id}`}
                    className={`flex-1 hover:underline ${completedTasks.has(task.id) ? 'line-through' : ''}`}
                  >
                    {task.name}
                  </Link>
                  <span className="text-xs text-gray-500">({task.duration})</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex justify-center gap-4 mt-4">
        <button 
          onClick={() => setCurrentDayIndex(Math.max(0, currentDayIndex - 1))}
          disabled={currentDayIndex === 0}
          className="p-2 border border-black rounded disabled:opacity-30"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="py-2 text-sm">
          Days {currentDayIndex + 1}-{Math.min(currentDayIndex + 2, days.length)} of {days.length}
        </span>
        <button 
          onClick={() => setCurrentDayIndex(Math.min(days.length - 2, currentDayIndex + 1))}
          disabled={currentDayIndex >= days.length - 2}
          className="p-2 border border-black rounded disabled:opacity-30"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function TimeBlockView({ days, completedTasks, toggleTask }: { 
  days: typeof scenarioData.average.days,
  completedTasks: Set<string>,
  toggleTask: (id: string) => void
}) {
  // Get all unique time slots
  const allTimes = [...new Set(days.flatMap(d => d.tasks.map(t => t.time)))].sort()

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="border-2 border-black p-2 bg-gray-100 w-20">Time</th>
            {days.map((day, idx) => (
              <th key={idx} className="border-2 border-black p-2 text-left bg-gray-50">
                <div className="font-bold">{day.name}</div>
                <div className="text-xs italic font-normal text-gray-600">{day.theme}</div>
                <div className="text-xs italic font-normal text-gray-500">{day.typeOfDay}</div>
                <div className="text-xs italic font-normal text-blue-600">"{day.motivation}"</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allTimes.map((time, timeIdx) => (
            <tr key={timeIdx}>
              <td className="border-2 border-black p-2 font-bold text-center bg-gray-50">{time}</td>
              {days.map((day, dayIdx) => {
                const task = day.tasks.find(t => t.time === time)
                return (
                  <td key={dayIdx} className={`border-2 border-black p-2 ${task ? priorityColors[task.priority] : ''}`}>
                    {task && (
                      <div className={`flex items-start gap-2 ${completedTasks.has(task.id) ? 'opacity-50' : ''}`}>
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 mt-1 cursor-pointer"
                          checked={completedTasks.has(task.id)}
                          onChange={() => toggleTask(task.id)}
                        />
                        <div className="flex-1">
                          <Link 
                            href={`/tasks/${task.id}`}
                            className={`hover:underline block ${completedTasks.has(task.id) ? 'line-through' : ''}`}
                          >
                            {task.name}
                          </Link>
                          <span className="text-xs text-gray-500">({task.duration})</span>
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
