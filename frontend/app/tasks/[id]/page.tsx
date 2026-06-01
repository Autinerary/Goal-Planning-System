'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Users, UserCheck, Phone, MessageSquare, Sparkles, Share2, X } from 'lucide-react'

export default function TaskView() {
  const router = useRouter()
  const params = useParams()
  const [completed, setCompleted] = useState(false)
  const [activeTab, setActiveTab] = useState<'helper' | 'friends' | 'mentors' | 'rolemodels'>('helper')
  const [currentTrickIndex, setCurrentTrickIndex] = useState(0)
  const [showModal, setShowModal] = useState<string | null>(null)
  const [modalData, setModalData] = useState<any>(null)

  const allTricks = [
    ['- Mentality Trick/', '  ADHD Trick/', '  ... Trick or Quote'],
    ['- Focus Hack:', '  Use the 2-minute rule', '  If it takes < 2 mins, do it now'],
    ['- Motivation Boost:', '  Visualize completion', '  Imagine how good it will feel'],
    ['- Energy Tip:', '  Take a 5-min walk', '  Movement increases focus'],
    ['- Calm Mind:', '  Box breathing: 4-4-4-4', '  Inhale, hold, exhale, hold'],
  ]

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
    <div className="min-h-screen bg-white p-8">
      <h1 className="text-2xl font-bold mb-6">5. Task View</h1>

      <div className="border-2 border-black rounded-lg p-6 max-w-2xl">
        {/* Task Title */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold underline">Task:</h2>
          <div className="h-px bg-black w-32 mx-auto mt-1"></div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Left: Fun Animation */}
          <div className="flex flex-col items-center">
            <div className="text-sm italic mb-2">(Fun Animation)</div>
            {/* Stick figure */}
            <svg viewBox="0 0 60 100" className="w-24 h-32">
              <circle cx="30" cy="15" r="12" fill="none" stroke="black" strokeWidth="2"/>
              <line x1="30" y1="27" x2="30" y2="60" stroke="black" strokeWidth="2"/>
              <line x1="30" y1="40" x2="10" y2="55" stroke="black" strokeWidth="2"/>
              <line x1="30" y1="40" x2="50" y2="55" stroke="black" strokeWidth="2"/>
              <line x1="30" y1="60" x2="15" y2="90" stroke="black" strokeWidth="2"/>
              <line x1="30" y1="60" x2="45" y2="90" stroke="black" strokeWidth="2"/>
            </svg>
          </div>

          {/* Right: Helper Screen / Social Features */}
          <div className="border-l-2 border-black pl-4">
            {/* Tabs */}
            <div className="flex gap-2 mb-3 border-b-2 border-black">
              <button
                onClick={() => setActiveTab('helper')}
                className={`px-2 py-1 text-xs border-b-2 ${activeTab === 'helper' ? 'border-black font-bold' : 'border-transparent'}`}
              >
                Helper
              </button>
              <button
                onClick={() => setActiveTab('friends')}
                className={`px-2 py-1 text-xs border-b-2 ${activeTab === 'friends' ? 'border-black font-bold' : 'border-transparent'}`}
              >
                Friends
              </button>
              <button
                onClick={() => setActiveTab('mentors')}
                className={`px-2 py-1 text-xs border-b-2 ${activeTab === 'mentors' ? 'border-black font-bold' : 'border-transparent'}`}
              >
                Mentors
              </button>
              <button
                onClick={() => setActiveTab('rolemodels')}
                className={`px-2 py-1 text-xs border-b-2 ${activeTab === 'rolemodels' ? 'border-black font-bold' : 'border-transparent'}`}
              >
                R.M.'s
              </button>
            </div>

            {/* Helper Tab */}
            {activeTab === 'helper' && (
              <>
                <h3 className="font-bold underline mb-2">Helper Screen</h3>
                <div className="space-y-1 text-sm mb-4">
                  {helperTricks.map((trick, idx) => (
                    <div key={idx}>{trick}</div>
                  ))}
                </div>
                <button 
                  onClick={handleGenerateAnother}
                  className="border-2 border-black px-3 py-1 rounded text-sm hover:bg-gray-100 cursor-pointer transition-colors"
                >
                  Generate Another
                </button>
              </>
            )}

            {/* Friends Tab */}
            {activeTab === 'friends' && (
              <>
                <h3 className="font-bold underline mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Friend-vals: Shared Tasks
                </h3>
                <div className="space-y-2 text-sm mb-4">
                  {friendModels.map((friend) => (
                    <div key={friend.id} className="border border-gray-300 rounded p-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{friend.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          friend.status === 'available' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {friend.status}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleCompete(friend)}
                          className="flex-1 border border-black px-2 py-1 rounded text-xs hover:bg-gray-100 flex items-center justify-center gap-1 cursor-pointer transition-colors"
                        >
                          <Share2 className="w-3 h-3" />
                          Compete
                        </button>
                        <button 
                          onClick={() => handleCollaborate(friend)}
                          className="flex-1 border border-black px-2 py-1 rounded text-xs hover:bg-gray-100 flex items-center justify-center gap-1 cursor-pointer transition-colors"
                        >
                          <Users className="w-3 h-3" />
                          Collaborate
                        </button>
                        <button 
                          onClick={() => handleCall(friend, 'friend')}
                          disabled={friend.status === 'busy'}
                          className={`flex-1 border border-black px-2 py-1 rounded text-xs flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                            friend.status === 'busy' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'
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
                  className="w-full border-2 border-black px-3 py-1 rounded text-sm hover:bg-gray-100 cursor-pointer transition-colors"
                >
                  Invite More Friends
                </button>
              </>
            )}

            {/* Mentors Tab */}
            {activeTab === 'mentors' && (
              <>
                <h3 className="font-bold underline mb-2 flex items-center gap-2">
                  <UserCheck className="w-4 h-4" />
                  Mentors: Shared Tasks with Guidance
                </h3>
                <div className="space-y-2 text-sm mb-4">
                  {mentors.map((mentor) => (
                    <div key={mentor.id} className="border border-gray-300 rounded p-2">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="font-medium">{mentor.name}</div>
                          <div className="text-xs text-gray-600">{mentor.role}</div>
                        </div>
                        {mentor.available && (
                          <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">
                            Available
                          </span>
                        )}
                      </div>
                      <div className="space-y-2">
                        <button 
                          onClick={() => handleCall(mentor, 'mentor')}
                          className="w-full border border-black px-2 py-1 rounded text-xs hover:bg-gray-100 flex items-center justify-center gap-1 cursor-pointer transition-colors"
                        >
                          <Phone className="w-3 h-3" />
                          Call for Guidance
                        </button>
                        <div className="border-t border-gray-200 pt-2">
                          <div className="text-xs font-medium mb-1">Recommended Tricks/Approaches:</div>
                          <ul className="text-xs text-gray-600 space-y-1">
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
                <h3 className="font-bold underline mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  R.M.'s: Their Tricks/Approaches
                </h3>
                <div className="space-y-2 text-sm mb-4">
                  {roleModels.map((rm) => (
                    <div key={rm.id} className="border border-gray-300 rounded p-2">
                      <div className="font-medium mb-1">{rm.name}</div>
                      <div className="text-xs text-gray-600 italic">
                        "{rm.trick}"
                      </div>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={handleSeeMoreTricks}
                  className="w-full border-2 border-black px-3 py-1 rounded text-sm hover:bg-gray-100 cursor-pointer transition-colors"
                >
                  See More Tricks
                </button>
              </>
            )}
          </div>
        </div>

        {/* Today's Motivation */}
        <div className="mt-6 mb-6">
          <span className="font-bold">Today's Motivation:</span>
          <span className="ml-2">_____________</span>
        </div>

        {/* Done Button */}
        <div className="text-center mb-4">
          <button
            onClick={handleDone}
            disabled={completed}
            className={`border-2 border-black px-6 py-2 rounded font-bold ${
              completed ? 'bg-green-200' : 'hover:bg-gray-100'
            }`}
          >
            {completed ? '✓ Done!' : 'Done?'}
          </button>
        </div>

        {/* Journal Button */}
        <div className="text-center">
          <Link 
            href={`/reflection?contextType=task&contextId=${params.id}`}
            className="inline-block border-2 border-black px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
          >
            Journal / Reflection Window
          </Link>
        </div>

        {/* Note */}
        <div className="mt-6 text-sm italic text-gray-600 text-center">
          (THIS, and any "Journal / Reflection Window" button)
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
