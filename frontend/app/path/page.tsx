'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, TrendingUp, Target, Zap, Heart, Brain } from 'lucide-react'

export default function PathView() {
  const router = useRouter()
  const [spinning, setSpinning] = useState(false)
  const [wheelRotation, setWheelRotation] = useState(0)
  const [currentMotivation, setCurrentMotivation] = useState<string | null>(null)
  
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

  const motivations = ['Focus', 'Energy', 'Growth', 'Confidence', 'Resilience', 'Connection']

  const spinWheel = () => {
    if (spinning) return
    setSpinning(true)
    
    const spins = 3 + Math.random() * 2
    const finalAngle = spins * 360 + Math.random() * 360
    setWheelRotation(prev => prev + finalAngle)
    
    setTimeout(() => {
      const random = motivations[Math.floor(Math.random() * motivations.length)]
      setCurrentMotivation(random)
      setSpinning(false)
    }, 2000)
  }

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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            
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

            <div className="flex flex-col items-center">
              <h3 className="font-bold text-lg mb-4 text-slate-800">Motivation Wheel</h3>
              
              <div className="relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-emerald-500 drop-shadow-md" />
                </div>
                
                <svg 
                  viewBox="0 0 120 120" 
                  className="w-40 h-40 transition-transform duration-[2000ms] ease-out drop-shadow-lg"
                  style={{ transform: `rotate(${wheelRotation}deg)` }}
                >
                  {motivations.map((_, i) => {
                    const angle = (i * 60) - 90
                    const colors = ['#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6']
                    return (
                      <path
                        key={i}
                        d={`M60,60 L${60 + 55 * Math.cos(angle * Math.PI / 180)},${60 + 55 * Math.sin(angle * Math.PI / 180)} A55,55 0 0,1 ${60 + 55 * Math.cos((angle + 60) * Math.PI / 180)},${60 + 55 * Math.sin((angle + 60) * Math.PI / 180)} Z`}
                        fill={colors[i]}
                        stroke="white"
                        strokeWidth="2"
                      />
                    )
                  })}
                  <circle cx="60" cy="60" r="15" fill="white" stroke="#e2e8f0" strokeWidth="2"/>
                  <circle cx="60" cy="60" r="8" fill="#1e293b"/>
                </svg>
              </div>
              
              <div className="mt-4 px-6 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full">
                <span className="font-bold text-white">{currentMotivation || 'Confidence'}</span>
              </div>
              
              <button 
                onClick={spinWheel}
                disabled={spinning}
                className="mt-4 px-8 py-2.5 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-all disabled:opacity-50"
              >
                {spinning ? 'Spinning...' : 'Spin'}
              </button>

              <div className="mt-6">
                <svg viewBox="0 0 100 90" className="w-24 h-20">
                  <path d="M15,55 Q10,55 10,60 L10,70 Q10,75 15,75 L85,75 Q90,75 90,70 L90,60 Q90,55 85,55 Z" fill="#3b82f6" stroke="#1e40af" strokeWidth="2"/>
                  <path d="M25,55 L35,35 L65,35 L75,55" fill="#60a5fa" stroke="#1e40af" strokeWidth="2"/>
                  <path d="M37,52 L42,40 L58,40 L63,52" fill="#bfdbfe" stroke="#1e40af" strokeWidth="1"/>
                  <circle cx="28" cy="75" r="10" fill="#1e293b" stroke="#0f172a" strokeWidth="2"/>
                  <circle cx="28" cy="75" r="4" fill="#64748b"/>
                  <circle cx="72" cy="75" r="10" fill="#1e293b" stroke="#0f172a" strokeWidth="2"/>
                  <circle cx="72" cy="75" r="4" fill="#64748b"/>
                  <circle cx="50" cy="42" r="6" fill="#fcd34d" stroke="#1e293b" strokeWidth="1.5"/>
                  <line x1="50" y1="48" x2="50" y2="55" stroke="#1e293b" strokeWidth="2"/>
                </svg>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-5 border border-slate-200">
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

          <div className="flex flex-wrap gap-4 mt-8 pt-6 border-t border-slate-200">
            <button 
              onClick={() => router.push('/onboarding')}
              className="px-6 py-3 bg-white border-2 border-slate-200 rounded-xl font-medium hover:border-slate-300 hover:bg-slate-50 transition-all"
            >
              Create another path
            </button>
            <Link 
              href="/reflection?contextType=path"
              className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium hover:shadow-lg transition-all flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Journal / Reflection
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
