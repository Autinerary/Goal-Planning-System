'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'

function RacesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const viewMode = searchParams.get('mode') || 'combined'
  const [showPreviousSteps, setShowPreviousSteps] = useState(false)
  const [isWheelSpinning, setIsWheelSpinning] = useState(false)
  const [wheelRotation, setWheelRotation] = useState(0)
  const [todaysMotivation, setTodaysMotivation] = useState<string | null>(null)

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

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      {/* View Toggle */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => router.push('/races?mode=combined')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            viewMode === 'combined' 
              ? 'bg-slate-900 text-white' 
              : 'bg-white border-2 border-slate-200 hover:border-slate-300'
          }`}
        >
          Combined View
        </button>
        <button
          onClick={() => router.push('/races?mode=separate')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            viewMode === 'separate' 
              ? 'bg-slate-900 text-white' 
              : 'bg-white border-2 border-slate-200 hover:border-slate-300'
          }`}
        >
          Separate Races
        </button>
      </div>

      {viewMode === 'combined' ? (
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm">
          {/* Top Section: Stats + Goal + Motivation Wheel */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
          <div className="relative">
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
                  className={`p-4 rounded-xl border-2 transition-all hover:shadow-md ${
                    choice.id === 'see_more' 
                      ? 'border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100' 
                      : idx === recommendedChoices.length - 1
                        ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800'
                        : 'border-slate-200 bg-white hover:border-cyan-500'
                  }`}
                >
                  <div className={`font-semibold text-sm mb-1 ${idx === recommendedChoices.length - 1 ? 'text-cyan-400' : 'text-cyan-600'}`}>
                    {choice.name}
                  </div>
                  {choice.success !== null && (
                    <>
                      <div className="text-xs">
                        Success %: <span className={`font-bold ${idx === recommendedChoices.length - 1 ? 'text-emerald-400' : 'text-emerald-500'}`}>{choice.success}%</span>
                      </div>
                      <div className="text-xs">
                        Attempts: <span className={`font-bold ${idx === recommendedChoices.length - 1 ? 'text-emerald-400' : 'text-emerald-500'}`}>{choice.attempts}</span>
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
        /* Separate View - Two Race Cards matching wireframe */
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
              <div key={race.id} className="bg-white rounded-2xl border-2 border-slate-900 p-4 shadow-sm">
                {/* Top Row: Stats | Race Info | Models | Motivation Wheel */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {/* Stats Box */}
                  <div className="border-2 border-slate-900 rounded p-2 text-xs">
                    <div className="font-bold mb-1">Stats:</div>
                    <div>-Mentality: <span className="text-green-500 font-bold">3XP</span></div>
                    <div>-Happiness: <span className="text-green-500 font-bold">5XP</span></div>
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
                    <div className="relative">
                      <svg viewBox="0 0 60 60" className="w-14 h-14 drop-shadow-md">
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
                      </svg>
                      {/* Pointer triangle */}
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[8px] border-l-transparent border-r-transparent border-t-slate-800 drop-shadow-sm" />
                    </div>
                  </div>
                </div>

                {/* Goal/Ideal Self */}
                <div className="flex flex-col items-center mb-4">
                  <svg viewBox="0 0 60 70" className="w-14 h-16">
                    {/* Platform */}
                    <ellipse cx="30" cy="60" rx="25" ry="8" fill="#e2e8f0" stroke="#1e293b" strokeWidth="2"/>
                    {/* Stick figure */}
                    <circle cx="30" cy="18" r="8" fill="none" stroke="#1e293b" strokeWidth="2"/>
                    <line x1="30" y1="26" x2="30" y2="42" stroke="#1e293b" strokeWidth="2"/>
                    <line x1="30" y1="30" x2="20" y2="38" stroke="#1e293b" strokeWidth="2"/>
                    <line x1="30" y1="30" x2="40" y2="38" stroke="#1e293b" strokeWidth="2"/>
                    <line x1="30" y1="42" x2="22" y2="55" stroke="#1e293b" strokeWidth="2"/>
                    <line x1="30" y1="42" x2="38" y2="55" stroke="#1e293b" strokeWidth="2"/>
                  </svg>
                  <div className="text-sm font-medium mt-1">Goal/Ideal Self</div>
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
  )
}

export default function RacesView() {
  return (
    <Suspense fallback={<div className="p-8">Loading races...</div>}>
      <RacesContent />
    </Suspense>
  )
}
