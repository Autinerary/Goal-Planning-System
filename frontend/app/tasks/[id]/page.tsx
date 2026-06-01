'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Users, UserCheck, Phone, MessageSquare, Sparkles, Share2, X, BookOpen } from 'lucide-react'

export default function TaskView() {
  const router = useRouter()
  const params = useParams()
  const [completed, setCompleted] = useState(false)
  const [activeTab, setActiveTab] = useState<'helper' | 'friends' | 'mentors' | 'rolemodels'>('helper')
  const [currentTrickIndex, setCurrentTrickIndex] = useState(0)
  const [showModal, setShowModal] = useState<string | null>(null)
  const [modalData, setModalData] = useState<any>(null)
  const [isWheelSpinning, setIsWheelSpinning] = useState(false)
  const [wheelRotation, setWheelRotation] = useState(0)
  const [todaysMotivation, setTodaysMotivation] = useState<string | null>(null)
  const [animalAnimation, setAnimalAnimation] = useState<'chicken' | 'horse' | 'bunny'>('chicken')
  const [currentQuote, setCurrentQuote] = useState<string>('')

  const allTricks = [
    ['- Mentality Trick/', '  ADHD Trick/', '  ... Trick or Quote'],
    ['- Focus Hack:', '  Use the 2-minute rule', '  If it takes < 2 mins, do it now'],
    ['- Motivation Boost:', '  Visualize completion', '  Imagine how good it will feel'],
    ['- Energy Tip:', '  Take a 5-min walk', '  Movement increases focus'],
    ['- Calm Mind:', '  Box breathing: 4-4-4-4', '  Inhale, hold, exhale, hold'],
  ]

  const motivations = [
    'Focus on progress, not perfection',
    'One small step at a time',
    'Your barriers are your superpowers',
    'Rest is part of the journey',
    'Celebrate every win',
    'You are enough',
    'Small steps lead to big achievements',
    'You\'ve got this!',
  ]

  const helpfulQuotes = [
    '"The only way to do great work is to love what you do." - Steve Jobs',
    '"Progress, not perfection." - Unknown',
    '"You don\'t have to be great to start, but you have to start to be great." - Zig Ziglar',
    '"The future belongs to those who believe in the beauty of their dreams." - Eleanor Roosevelt',
    '"It always seems impossible until it\'s done." - Nelson Mandela',
  ]

  // Set initial quote on client side only (fix hydration error)
  useEffect(() => {
    const randomQuote = helpfulQuotes[Math.floor(Math.random() * helpfulQuotes.length)]
    setCurrentQuote(randomQuote)
  }, [])

  // Rotate animal animation
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimalAnimation(prev => {
        if (prev === 'chicken') return 'horse'
        if (prev === 'horse') return 'bunny'
        return 'chicken'
      })
    }, 3000)
    return () => clearInterval(interval)
  }, [])

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

  const helperTricks = allTricks[currentTrickIndex]

  // Mock data for social features
  const friendModels = [
    { id: 'f1', name: 'Alex Taylor', status: 'available' },
    { id: 'f2', name: 'Jordan Smith', status: 'busy' },
  ]

  const mentors = [
    { id: 'm1', name: 'James Wilson', role: 'Career Coach', available: true },
  ]

  const roleModels = [
    { id: 'rm1', name: 'Sarah Chen', trick: 'Break tasks into 25-min Pomodoro blocks' },
    { id: 'rm2', name: 'Marcus Johnson', trick: 'Use body doubling for focus sessions' },
  ]

  const moreTricks = [
    { name: 'Lisa Park', trick: 'Start with the easiest part to build momentum' },
    { name: 'David Kim', trick: 'Use background music without lyrics' },
    { name: 'Emma Watson', trick: 'Set artificial deadlines 30 mins before actual' },
    { name: 'Chris Lee', trick: 'Reward yourself after each completed task' },
  ]

  const handleDone = () => {
    setCompleted(true)
    setTimeout(() => {
      router.push('/calendar')
    }, 1500)
  }

  const handleGenerateAnother = () => {
    setCurrentTrickIndex((prev) => (prev + 1) % allTricks.length)
  }

  const handleCompete = (friend: any) => {
    setModalData({ type: 'compete', friend })
    setShowModal('compete')
  }

  const handleCollaborate = (friend: any) => {
    setModalData({ type: 'collaborate', friend })
    setShowModal('collaborate')
  }

  const handleCall = (person: any, personType: 'friend' | 'mentor') => {
    setModalData({ type: 'call', person, personType })
    setShowModal('call')
  }

  const handleInviteFriends = () => {
    setShowModal('invite')
  }

  const handleSeeMoreTricks = () => {
    setShowModal('tricks')
  }

  return (
    <div className="min-h-screen bg-white/20 backdrop-blur-sm text-slate-800 p-8 relative overflow-hidden">
      {/* Background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '5s', animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-pink-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
      </div>

      {/* Journal Button - Floating on every page */}
      <Link
        href={`/reflection?contextType=task&contextId=${params.id}`}
        className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-amber-500 to-orange-500 text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform flex items-center gap-2"
        title="Journal / Reflection"
      >
        <BookOpen className="w-6 h-6" />
        <span className="hidden sm:inline font-semibold">Journal</span>
      </Link>

      <div className="relative z-10 max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-slate-800">Task View</h1>

        <div className="bg-white/60 backdrop-blur-lg border-2 border-slate-300 rounded-2xl p-6 md:p-8 shadow-2xl">
          {/* Task Title */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Task: Complete Assignment</h2>
            <div className="h-px bg-slate-400 w-32 mx-auto"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 lg:gap-16 mb-8">
            {/* Left: Animal Dancing Animation */}
            <div className="flex flex-col items-center justify-center">
              <div className="text-sm text-slate-600 mb-4 italic">Ultimate Chicken Horse Style</div>
              <div className="relative w-32 h-32 flex items-center justify-center">
                {/* Animated Animals */}
                {animalAnimation === 'chicken' && (
                  <div className="text-8xl animate-bounce" style={{ animationDuration: '0.8s' }}>
                    🐔
                  </div>
                )}
                {animalAnimation === 'horse' && (
                  <div className="text-8xl animate-bounce" style={{ animationDuration: '0.6s' }}>
                    🐴
                  </div>
                )}
                {animalAnimation === 'bunny' && (
                  <div className="text-8xl animate-bounce" style={{ animationDuration: '0.7s' }}>
                    🐰
                  </div>
                )}
              </div>
            </div>

            {/* Middle: Spinning Motivation Wheel */}
            <div className="flex flex-col items-center justify-center px-6 md:px-8 lg:px-12 mb-8 md:mb-0">
              <div className="text-sm text-slate-600 mb-4 font-semibold">Today's Motivation</div>
              <div className="relative w-40 h-40 flex-shrink-0">
                {/* Wheel */}
                <div
                  className="w-40 h-40 rounded-full border-4 border-slate-400 relative overflow-hidden cursor-pointer transition-transform"
                  style={{
                    transform: `rotate(${wheelRotation}deg)`,
                    transition: isWheelSpinning ? 'transform 2s cubic-bezier(0.4, 0, 0.2, 1)' : 'none'
                  }}
                  onClick={spinWheel}
                >
                  {/* Wheel segments */}
                  <div className="absolute inset-0">
                    <div className="absolute top-0 left-0 w-1/2 h-1/2 bg-gradient-to-br from-cyan-500 to-blue-500"></div>
                    <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-gradient-to-bl from-purple-500 to-pink-500"></div>
                    <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-gradient-to-tr from-yellow-500 to-orange-500"></div>
                    <div className="absolute bottom-0 right-0 w-1/2 h-1/2 bg-gradient-to-tl from-green-500 to-emerald-500"></div>
                  </div>
                  {/* Center circle */}
                  <div className="absolute inset-4 bg-slate-800 rounded-full flex items-center justify-center border-2 border-slate-400">
                    <Sparkles className="w-8 h-8 text-yellow-400" />
                  </div>
                  {/* Pointer */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 w-0 h-0 border-l-4 border-r-4 border-t-8 border-t-white"></div>
                </div>
                {/* Motivation Text */}
                {todaysMotivation && (
                  <div className="mt-4 text-center">
                    <p className="text-sm text-blue-600 font-medium bg-white/60 px-3 py-2 rounded-lg">
                      {todaysMotivation}
                    </p>
                  </div>
                )}
                {!todaysMotivation && (
                  <button
                    onClick={spinWheel}
                    disabled={isWheelSpinning}
                    className="mt-4 px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-lg text-sm font-semibold hover:shadow-lg transition-all disabled:opacity-50"
                  >
                    {isWheelSpinning ? 'Spinning...' : 'Spin for Motivation'}
                  </button>
                )}
              </div>
            </div>

            {/* Right: Helper Screen / Social Features */}
            <div className="border-l-2 border-slate-300 pl-8 md:pl-12 lg:pl-16 mt-8 md:mt-0">
              {/* Tabs */}
              <div className="flex gap-2 mb-3 border-b-2 border-slate-300">
              <button
                onClick={() => setActiveTab('helper')}
                className={`px-2 py-1 text-xs border-b-2 transition-colors ${activeTab === 'helper' ? 'border-blue-600 font-bold text-blue-600' : 'border-transparent text-slate-600 hover:text-slate-800'}`}
              >
                Helper
              </button>
              <button
                onClick={() => setActiveTab('friends')}
                className={`px-2 py-1 text-xs border-b-2 ${activeTab === 'friends' ? 'border-slate-800 font-bold text-slate-800' : 'border-transparent text-slate-600'}`}
              >
                Friends
              </button>
              <button
                onClick={() => setActiveTab('mentors')}
                className={`px-2 py-1 text-xs border-b-2 ${activeTab === 'mentors' ? 'border-slate-800 font-bold text-slate-800' : 'border-transparent text-slate-600'}`}
              >
                Mentors
              </button>
              <button
                onClick={() => setActiveTab('rolemodels')}
                className={`px-2 py-1 text-xs border-b-2 ${activeTab === 'rolemodels' ? 'border-slate-800 font-bold text-slate-800' : 'border-transparent text-slate-600'}`}
              >
                R.M.'s
              </button>
            </div>

              {/* Helper Tab */}
              {activeTab === 'helper' && (
                <>
                  <h3 className="font-bold text-slate-800 mb-3">Helper Screen</h3>
                  <div className="space-y-1 text-sm mb-4 text-slate-700">
                    {helperTricks.map((trick, idx) => (
                      <div key={idx}>{trick}</div>
                    ))}
                  </div>
                  <button 
                    onClick={handleGenerateAnother}
                    className="border-2 border-slate-400 px-3 py-1 rounded text-sm text-slate-800 hover:bg-white/60 cursor-pointer transition-colors"
                  >
                    Generate Another
                  </button>
                  {/* Helpful Quote Below */}
                  {currentQuote && (
                    <div className="mt-6 pt-4 border-t border-slate-300">
                      <p className="text-xs text-slate-600 italic text-center">
                        {currentQuote}
                      </p>
                    </div>
                  )}
                </>
              )}

            {/* Friends Tab */}
            {activeTab === 'friends' && (
              <>
                <h3 className="font-bold text-slate-800 underline mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Friend-vals: Shared Tasks
                </h3>
                <div className="space-y-2 text-sm mb-4">
                  {friendModels.map((friend) => (
                    <div key={friend.id} className="border border-slate-300 rounded p-2 bg-white/40">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-slate-800">{friend.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          friend.status === 'available' ? 'bg-green-500/30 text-green-700' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {friend.status}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleCompete(friend)}
                          className="flex-1 border border-slate-400 px-2 py-1 rounded text-xs text-slate-800 hover:bg-white/60 flex items-center justify-center gap-1 cursor-pointer transition-colors"
                        >
                          <Share2 className="w-3 h-3" />
                          Compete
                        </button>
                        <button 
                          onClick={() => handleCollaborate(friend)}
                          className="flex-1 border border-slate-400 px-2 py-1 rounded text-xs text-slate-800 hover:bg-white/60 flex items-center justify-center gap-1 cursor-pointer transition-colors"
                        >
                          <Users className="w-3 h-3" />
                          Collaborate
                        </button>
                        <button 
                          onClick={() => handleCall(friend, 'friend')}
                          disabled={friend.status === 'busy'}
                          className={`flex-1 border border-slate-400 px-2 py-1 rounded text-xs text-slate-800 flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                            friend.status === 'busy' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/60'
                          }`}
                        >
                          <Phone className="w-3 h-3" />
                          Call
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                  <button 
                    onClick={handleInviteFriends}
                    className="w-full border-2 border-slate-400 px-3 py-1 rounded text-sm text-slate-800 hover:bg-white/60 cursor-pointer transition-colors"
                  >
                    Invite More Friends
                  </button>
              </>
            )}

              {/* Mentors Tab */}
              {activeTab === 'mentors' && (
                <>
                  <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                    <UserCheck className="w-4 h-4" />
                    Mentors: Shared Tasks with Guidance
                  </h3>
                  <div className="space-y-2 text-sm mb-4">
                    {mentors.map((mentor) => (
                      <div key={mentor.id} className="border border-slate-300 rounded p-2 bg-white/40">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="font-medium text-slate-800">{mentor.name}</div>
                          <div className="text-xs text-gray-600">{mentor.role}</div>
                        </div>
                        {mentor.available && (
                          <span className="text-xs px-2 py-0.5 rounded bg-green-500/30 text-green-700">
                            Available
                          </span>
                        )}
                      </div>
                      <div className="space-y-2">
                        <button 
                          onClick={() => handleCall(mentor, 'mentor')}
                          className="w-full border border-slate-400 px-2 py-1 rounded text-xs text-slate-800 hover:bg-white/60 flex items-center justify-center gap-1 cursor-pointer transition-colors"
                        >
                          <Phone className="w-3 h-3" />
                          Call for Guidance
                        </button>
                        <div className="border-t border-slate-300 pt-2">
                          <div className="text-xs font-medium mb-1 text-slate-800">Recommended Tricks/Approaches:</div>
                          <ul className="text-xs text-slate-700 space-y-1">
                            <li>• Break task into smaller steps</li>
                            <li>• Use timer for focus sessions</li>
                            <li>• Take breaks every 25 minutes</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

              {/* Role Models Tab */}
              {activeTab === 'rolemodels' && (
                <>
                  <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    R.M.'s: Their Tricks/Approaches
                  </h3>
                  <div className="space-y-2 text-sm mb-4">
                    {roleModels.map((rm) => (
                      <div key={rm.id} className="border border-slate-300 rounded p-2 bg-white/40">
                        <div className="font-medium mb-1 text-slate-800">{rm.name}</div>
                        <div className="text-xs text-slate-700 italic">
                          "{rm.trick}"
                        </div>
                      </div>
                    ))}
                  </div>
                  <button 
                    onClick={handleSeeMoreTricks}
                    className="w-full border-2 border-slate-400 px-3 py-1 rounded text-sm text-slate-800 hover:bg-white/60 cursor-pointer transition-colors"
                  >
                    See More Tricks
                  </button>
                </>
              )}
          </div>
        </div>

          </div>

          {/* Big Done Button */}
          <div className="text-center mt-8 mb-6">
            <button
              onClick={handleDone}
              disabled={completed}
              className={`px-12 py-6 rounded-2xl font-bold text-xl shadow-2xl transition-all transform hover:scale-105 ${
                completed 
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white' 
                  : 'bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 text-white hover:shadow-cyan-500/50'
              }`}
            >
              {completed ? '✓ Done!' : 'Done'}
            </button>
          </div>
      </div>

      {/* Modals */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">
                {showModal === 'compete' && `🏆 Compete with ${modalData?.friend?.name}`}
                {showModal === 'collaborate' && `🤝 Collaborate with ${modalData?.friend?.name}`}
                {showModal === 'call' && `📞 Call ${modalData?.person?.name}`}
                {showModal === 'invite' && '👋 Invite Friends'}
                {showModal === 'tricks' && '✨ More Tricks from Role Models'}
              </h3>
              <button
                onClick={() => setShowModal(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Compete Modal */}
            {showModal === 'compete' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Start a friendly competition with {modalData?.friend?.name} on this task!
                </p>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-sm font-medium mb-2">Competition Options:</div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="radio" name="compete" defaultChecked />
                      Who finishes first
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="radio" name="compete" />
                      Who maintains best streak
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="radio" name="compete" />
                      Most tasks completed this week
                    </label>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowModal(null)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setShowModal(null)
                      // Show success feedback
                    }}
                    className="flex-1 px-4 py-2 bg-black text-white rounded hover:bg-gray-800"
                  >
                    Start Competition
                  </button>
                </div>
              </div>
            )}

            {/* Collaborate Modal */}
            {showModal === 'collaborate' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Work together with {modalData?.friend?.name} on this task!
                </p>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-sm font-medium mb-2">Collaboration Type:</div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="radio" name="collab" defaultChecked />
                      Body doubling (work in parallel)
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="radio" name="collab" />
                      Pair work (work together)
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="radio" name="collab" />
                      Accountability check-ins
                    </label>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowModal(null)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setShowModal(null)
                    }}
                    className="flex-1 px-4 py-2 bg-black text-white rounded hover:bg-gray-800"
                  >
                    Start Collaboration
                  </button>
                </div>
              </div>
            )}

            {/* Call Modal */}
            {showModal === 'call' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  {modalData?.personType === 'mentor' 
                    ? `Request guidance from ${modalData?.person?.name} on this task.`
                    : `Start a call with ${modalData?.person?.name}.`
                  }
                </p>
                <div className="bg-green-50 border border-green-200 p-4 rounded text-center">
                  <Phone className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <div className="text-sm text-green-700">
                    {modalData?.person?.name} is available
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowModal(null)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setShowModal(null)
                    }}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Start Call
                  </button>
                </div>
              </div>
            )}

            {/* Invite Friends Modal */}
            {showModal === 'invite' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Invite friends to collaborate on tasks together.
                </p>
                <div>
                  <label className="block text-sm font-medium mb-2">Enter username or email:</label>
                  <input
                    type="text"
                    placeholder="friend@email.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-black"
                  />
                </div>
                <div className="text-xs text-gray-500">
                  Or share this invite link:
                  <div className="mt-1 p-2 bg-gray-100 rounded text-xs font-mono break-all">
                    autinerary.app/invite/abc123
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowModal(null)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setShowModal(null)
                    }}
                    className="flex-1 px-4 py-2 bg-black text-white rounded hover:bg-gray-800"
                  >
                    Send Invite
                  </button>
                </div>
              </div>
            )}

            {/* More Tricks Modal */}
            {showModal === 'tricks' && (
              <div className="space-y-4">
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {moreTricks.map((trick, idx) => (
                    <div key={idx} className="border border-gray-200 rounded p-3">
                      <div className="font-medium text-sm">{trick.name}</div>
                      <div className="text-xs text-gray-600 italic mt-1">
                        "{trick.trick}"
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => {
                    router.push('/pit-stop?tab=haveworld&view=people')
                  }}
                  className="w-full px-4 py-2 border border-black rounded hover:bg-gray-50 text-sm"
                >
                  View All Role Models →
                </button>
                <button
                  onClick={() => setShowModal(null)}
                  className="w-full px-4 py-2 bg-black text-white rounded hover:bg-gray-800"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
