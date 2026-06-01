'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, TrendingUp, Target, Zap, Heart, Brain, Users, UserCheck, UserPlus, Wand2, X, Lock, Star, Trophy, Coins } from 'lucide-react'

const gameStyles = `
  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }
  @keyframes walk {
    0%, 100% { transform: translateX(0); }
    50% { transform: translateX(5px); }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-8px); }
  }
  .character-bounce {
    animation: bounce 2s ease-in-out infinite;
  }
  .character-walk {
    animation: walk 1.5s ease-in-out infinite;
  }
  .star-float {
    animation: float 3s ease-in-out infinite;
  }
`

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

  // Game path nodes
  const pathNodes = [
    { id: 1, number: 1, completed: true, stars: 3, position: { x: 10, y: 80 } },
    { id: 2, number: 2, completed: true, stars: 2, position: { x: 25, y: 60 } },
    { id: 3, number: 3, completed: true, stars: 1, position: { x: 40, y: 75 } },
    { id: 4, number: 4, completed: true, stars: 3, position: { x: 55, y: 50 } },
    { id: 5, number: 5, completed: true, stars: 3, position: { x: 70, y: 65 }, isCurrent: true },
    { id: 6, number: 6, completed: false, locked: false, position: { x: 85, y: 45 } },
    { id: 7, number: 7, completed: false, locked: true, position: { x: 90, y: 30 } },
    { id: 8, number: 8, completed: false, locked: true, position: { x: 95, y: 15 } },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-300 via-green-100 to-green-200 p-4 md:p-8 relative overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: gameStyles }} />
      
      {/* Sky with clouds */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-10 left-10 w-32 h-16 bg-white/40 rounded-full blur-xl" />
        <div className="absolute top-20 right-20 w-40 h-20 bg-white/30 rounded-full blur-2xl" />
        <div className="absolute top-5 left-1/3 w-36 h-18 bg-white/35 rounded-full blur-xl" />
      </div>

      {/* Top UI Bar - Game Stats */}
      <div className="relative z-20 mb-6">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl border-2 border-amber-300 shadow-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Hearts/Lives */}
              <div className="flex items-center gap-1">
                <Heart className="w-6 h-6 text-pink-500 fill-pink-500" />
                <span className="text-lg font-bold text-slate-800">5</span>
              </div>
              
              {/* Timer */}
              <div className="flex items-center gap-2 bg-blue-100 px-3 py-1 rounded-lg border border-blue-300">
                <span className="text-sm font-mono font-bold text-blue-700">39:00</span>
                <button className="text-blue-600 hover:text-blue-800">+</button>
              </div>
              
              {/* Coins */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center border-2 border-amber-700 shadow-md">
                  <span className="text-lg">🐾</span>
                </div>
                <span className="text-lg font-bold text-slate-800">1,000</span>
                <button className="text-amber-600 hover:text-amber-800">+</button>
              </div>
            </div>
            
            {/* Shop Button */}
            <button className="flex flex-col items-center gap-1 hover:scale-105 transition-transform">
              <div className="w-12 h-12 bg-gradient-to-br from-red-400 to-red-600 rounded-lg border-2 border-red-700 shadow-md flex items-center justify-center">
                <span className="text-2xl">🏪</span>
              </div>
              <span className="text-xs font-semibold text-slate-700">Shop</span>
            </button>
          </div>
        </div>
      </div>

      <div className="relative z-10">
        <div className="max-w-7xl mx-auto">
          {/* Game Path Section */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border-4 border-amber-800 shadow-2xl p-6 md:p-8 mb-6 relative overflow-hidden">
            {/* Dirt Road Background */}
            <div className="absolute inset-0 bg-gradient-to-b from-amber-700 via-amber-600 to-amber-800 opacity-30" 
                 style={{
                   backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                 }} />
            
            <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Trophy className="w-6 h-6 text-amber-600" />
              Your Journey Path
            </h2>

            {/* Path Container */}
            <div className="relative h-96 md:h-[500px]">
              {/* Winding Dirt Path */}
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1000 500" preserveAspectRatio="none">
                <path
                  d="M 50 400 Q 200 350, 250 300 T 400 250 T 550 200 T 700 150 T 850 100 T 950 50"
                  fill="none"
                  stroke="#8B6914"
                  strokeWidth="60"
                  strokeLinecap="round"
                  className="drop-shadow-lg"
                />
                <path
                  d="M 50 400 Q 200 350, 250 300 T 400 250 T 550 200 T 700 150 T 850 100 T 950 50"
                  fill="none"
                  stroke="#D4A574"
                  strokeWidth="40"
                  strokeLinecap="round"
                />
                {/* Center line */}
                <path
                  d="M 50 400 Q 200 350, 250 300 T 400 250 T 550 200 T 700 150 T 850 100 T 950 50"
                  fill="none"
                  stroke="#F4D03F"
                  strokeWidth="4"
                  strokeDasharray="10,5"
                />
              </svg>

              {/* Path Nodes */}
              {pathNodes.map((node) => {
                const handleNodeClick = () => {
                  if (node.locked) {
                    alert(`Node ${node.number} is locked. Complete previous nodes to unlock it!`)
                    return
                  }
                  // Navigate to milestone or show details
                  if (node.completed || node.isCurrent || !node.locked) {
                    router.push(`/milestones/node_${node.number}`)
                  }
                }

                return (
                  <div
                    key={node.id}
                    className="absolute cursor-pointer group"
                    style={{
                      left: `${node.position.x}%`,
                      top: `${node.position.y}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                    onClick={handleNodeClick}
                    title={node.locked ? `Node ${node.number} is locked` : `Click to view Node ${node.number} details`}
                  >
                    {node.isCurrent && (
                      <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-pink-500 text-white px-4 py-1 rounded-lg border-2 border-pink-700 shadow-lg whitespace-nowrap z-10">
                        <div className="text-xs font-bold">YOU ARE HERE</div>
                      </div>
                    )}
                    
                    <div className={`relative ${
                      node.completed 
                        ? 'bg-green-500 border-green-700 hover:bg-green-600' 
                        : node.locked 
                          ? 'bg-gray-400 border-gray-600 cursor-not-allowed opacity-60' 
                          : 'bg-orange-500 border-orange-700 hover:bg-orange-600'
                    } border-4 rounded-full w-16 h-16 md:w-20 md:h-20 flex items-center justify-center shadow-xl hover:scale-125 active:scale-110 transition-all duration-200 ${
                      !node.locked ? 'cursor-pointer' : ''
                    }`}>
                      {node.locked ? (
                        <Lock className="w-8 h-8 md:w-10 md:h-10 text-white" />
                      ) : (
                        <span className="text-2xl md:text-3xl font-bold text-white">{node.number}</span>
                      )}
                      
                      {/* Stars for completed nodes */}
                      {node.completed && node.stars && (
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex gap-1">
                          {[1, 2, 3].map((starNum) => (
                            <Star
                              key={starNum}
                              className={`w-4 h-4 md:w-5 md:h-5 star-float ${
                                starNum <= node.stars! 
                                  ? 'text-yellow-400 fill-yellow-400' 
                                  : 'text-gray-300'
                              }`}
                              style={{ animationDelay: `${starNum * 0.2}s` }}
                            />
                          ))}
                        </div>
                      )}

                      {/* Hover tooltip */}
                      {!node.locked && (
                        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20">
                          Node {node.number}
                          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Characters - Hare and Turtle */}
              <div className="absolute" style={{ left: '70%', top: '65%', transform: 'translate(-50%, -50%)' }}>
                <div className="text-6xl md:text-8xl character-bounce">🐰</div>
              </div>
              <div className="absolute" style={{ left: '65%', top: '70%', transform: 'translate(-50%, -50%)' }}>
                <div className="text-5xl md:text-7xl character-walk">🐢</div>
              </div>
            </div>
          </div>

          {/* Stats and Races Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl border-2 border-purple-300 p-6 shadow-lg">
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

            <div className="bg-white/90 backdrop-blur-sm rounded-2xl border-2 border-cyan-300 p-6 shadow-lg">
              <h3 className="font-bold text-lg mb-4 text-slate-800 flex items-center gap-2">
                <Target className="w-5 h-5 text-cyan-500" />
                Races
              </h3>
              <div className="space-y-4">
                {races.map((race) => (
                  <Link 
                    key={race.id}
                    href="/races"
                    className="block p-3 bg-white rounded-lg border-2 border-slate-200 hover:border-slate-300 hover:shadow-md transition-all"
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

          {/* Have World Section */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl border-2 border-purple-300 p-6 mb-6 shadow-lg relative">
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
              Have World:
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

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-4">
            <button 
              onClick={() => router.push('/onboarding')}
              className="px-6 py-3 bg-white border-2 border-slate-300 rounded-xl font-medium hover:border-slate-400 hover:bg-slate-50 transition-all shadow-md"
            >
              Create another path
            </button>
            <button
              onClick={() => router.push('/pit-stop?tab=haveworld&view=people')}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer shadow-md"
            >
              <Users className="w-4 h-4" />
              View R.M.s
            </button>
            <Link 
              href="/reflection?contextType=path"
              className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium hover:shadow-lg transition-all flex items-center gap-2 shadow-md"
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
