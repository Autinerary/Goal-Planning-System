'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, TrendingUp, Target, Zap, Heart, Brain, Users, UserCheck, UserPlus, Wand2, X } from 'lucide-react'

export default function PathView() {
  const router = useRouter()
  const [showMotivationPopUp, setShowMotivationPopUp] = useState(false)
  const [generatedMotivation, setGeneratedMotivation] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  // Motivation tips based on progress
  const motivationTips = [
    "You're making great progress! Remember: small steps lead to big achievements.",
    "Your current stats show you're on the right track. Keep pushing forward!",
    "Based on your progress, try breaking down your next goal into smaller tasks.",
    "You've got this! Your consistency is building momentum.",
    "Focus on one race at a time. You're doing better than you think!",
    "Your happiness stat is strong - use that positive energy to fuel your next steps.",
    "Remember why you started. Your goals are within reach!",
    "Progress isn't always linear. Celebrate how far you've come!",
  ]

  const handleGenerateMotivation = () => {
    setIsGenerating(true)
    // Simulate API call delay
    setTimeout(() => {
      const randomTip = motivationTips[Math.floor(Math.random() * motivationTips.length)]
      setGeneratedMotivation(randomTip)
      setIsGenerating(false)
    }, 1000)
  }

  // Mock data for Have World
  const roleModels = [
    { id: 'rm1', name: 'Sarah Chen', role: 'Software Engineer' },
    { id: 'rm2', name: 'Marcus Johnson', role: 'Entrepreneur' },
  ]

  const mentors = [
    { id: 'm1', name: 'James Wilson', role: 'Career Coach' },
    { id: 'm2', name: 'Lisa Park', role: 'Academic Advisor' },
  ]

  const friendModels = [
    { id: 'f1', name: 'Alex Taylor', role: 'Study Buddy' },
  ]
  
  const stats = [
    { name: 'Mentality', value: 3, icon: Brain, color: 'text-purple-500' },
    { name: 'Happiness', value: 8, icon: Heart, color: 'text-pink-500' },
    { name: 'Focus', value: 5, icon: Target, color: 'text-cyan-500' },
    { name: 'Energy', value: 6, icon: Zap, color: 'text-amber-500' },
  ]
  
  const races = [
    { id: 'race_1', name: 'Graduate University', progress: 45, color: 'from-cyan-500 to-blue-500' },
    { id: 'race_2', name: 'Get Tech Job', progress: 20, color: 'from-purple-500 to-pink-500' },
  ]


  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Your Path</h1>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Level 3 Explorer</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 md:p-8 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-5 border border-slate-200">
              <h3 className="font-bold text-lg mb-4 text-slate-800 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                Stats
              </h3>
              <div className="space-y-4">
                {stats.map((stat, idx) => {
                  const Icon = stat.icon
                  return (
                    <div key={idx} className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${stat.color}`} />
                        <span className="text-slate-600">{stat.name}</span>
                      </div>
                      <span className={`font-bold text-lg ${stat.color}`}>{stat.value}XP</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-5 border border-slate-200 relative">
              <h3 className="font-bold text-lg mb-4 text-slate-800 flex items-center gap-2">
                <Target className="w-5 h-5 text-cyan-500" />
                Races
              </h3>
              <div className="space-y-4">
                {races.map((race) => (
                  <Link 
                    key={race.id}
                    href="/races"
                    className="block p-3 bg-white rounded-lg border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-slate-700 font-medium">{race.name}</span>
                      <span className="font-bold text-emerald-500">{race.progress}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full bg-gradient-to-r ${race.color} rounded-full`} style={{ width: `${race.progress}%` }}/>
                    </div>
                  </Link>
                ))}
                <Link href="/races" className="block text-center text-sm text-slate-500 hover:text-cyan-600 pt-2">
                  View all races →
                </Link>
              </div>
            </div>
          </div>

          {/* NEW: Have World Section */}
          <div className="mt-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-5 border-2 border-purple-200 relative">
            <div className="absolute -top-3 -right-3">
              <button
                onClick={() => setShowMotivationPopUp(!showMotivationPopUp)}
                className="w-10 h-10 rounded-full bg-gradient-to-r from-orange-400 to-yellow-400 flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                title="Motivation wand pop-up"
              >
                <Wand2 className="w-5 h-5 text-white" />
              </button>
            </div>

            {showMotivationPopUp && (
              <div className="absolute top-12 right-0 bg-white rounded-lg shadow-xl border-2 border-orange-200 p-4 z-20 min-w-[250px] max-w-[300px]">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-bold text-slate-800">Motivation Wand</h4>
                  <button
                    onClick={() => {
                      setShowMotivationPopUp(false)
                      setGeneratedMotivation(null)
                    }}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-sm text-slate-600 mb-3">
                  Get personalized motivation tips based on your current progress!
                </p>
                
                {generatedMotivation ? (
                  <div className="mb-3 p-3 bg-gradient-to-br from-orange-50 to-yellow-50 rounded-lg border border-orange-200">
                    <div className="flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-slate-700 italic">"{generatedMotivation}"</p>
                    </div>
                  </div>
                ) : null}
                
                <button 
                  onClick={handleGenerateMotivation}
                  disabled={isGenerating}
                  className={`w-full bg-gradient-to-r from-orange-400 to-yellow-400 text-white px-4 py-2 rounded-lg text-sm font-medium hover:shadow-md transition-all ${
                    isGenerating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                  }`}
                >
                  {isGenerating ? 'Generating...' : 'Generate Motivation'}
                </button>
                
                {generatedMotivation && (
                  <button
                    onClick={() => setGeneratedMotivation(null)}
                    className="w-full mt-2 text-xs text-slate-500 hover:text-slate-700"
                  >
                    Generate another
                  </button>
                )}
              </div>
            )}

            <h3 className="font-bold text-lg mb-4 text-slate-800 flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-500" />
              (NEW) Have World:
            </h3>
            <div className="space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <UserCheck className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-semibold text-slate-700">Role Models:</span>
                </div>
                <div className="flex flex-wrap gap-2 ml-6">
                  {roleModels.map((rm) => (
                    <span key={rm.id} className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                      {rm.name}
                    </span>
                  ))}
                  <span className="text-xs text-slate-500">...</span>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <UserCheck className="w-4 h-4 text-cyan-600" />
                  <span className="text-sm font-semibold text-slate-700">Mentors:</span>
                </div>
                <div className="flex flex-wrap gap-2 ml-6">
                  {mentors.map((m) => (
                    <span key={m.id} className="px-2 py-1 bg-cyan-100 text-cyan-700 rounded text-xs">
                      {m.name}
                    </span>
                  ))}
                  <span className="text-xs text-slate-500">...</span>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <UserPlus className="w-4 h-4 text-pink-600" />
                  <span className="text-sm font-semibold text-slate-700">Friend-mls:</span>
                </div>
                <div className="flex flex-wrap gap-2 ml-6">
                  {friendModels.map((f) => (
                    <span key={f.id} className="px-2 py-1 bg-pink-100 text-pink-700 rounded text-xs">
                      {f.name}
                    </span>
                  ))}
                  <span className="text-xs text-slate-500">...</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 mt-8 pt-6 border-t border-slate-200">
            <button 
              onClick={() => router.push('/onboarding')}
              className="px-6 py-3 bg-white border-2 border-slate-200 rounded-xl font-medium hover:border-slate-300 hover:bg-slate-50 transition-all"
            >
              Create another path
            </button>
            <button
              onClick={() => router.push('/pit-stop?tab=haveworld&view=people')}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer"
            >
              <Users className="w-4 h-4" />
              View R.M.s (NEW: View)
            </button>
            <Link 
              href="/reflection?contextType=path"
              className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium hover:shadow-lg transition-all flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Journal
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
