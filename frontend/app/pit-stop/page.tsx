'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, UserPlus, UserMinus, Users, UserCheck, Sparkles, Share2, Lock, Globe, MessageSquare, Bell, Trophy, Video, X, Filter, Heart, Star, Users2, Crown, Code, Eye, ChevronRight, ChevronLeft } from 'lucide-react'
import axios from 'axios'
import AgentInsightsBanner from '../components/AgentInsightsBanner'
import { useAgentPath } from '../context/AgentPathContext'

// Service Hub URL - defaults to localhost:3001 (Service Hub should run on a different port)
const SERVICE_HUB_URL = process.env.NEXT_PUBLIC_SERVICE_HUB_URL || 'http://localhost:3001'
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

function PitStopContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toolRecommendation } = useAgentPath()
  
  // Read URL params on mount
  const initialTab = searchParams.get('tab') as 'tools' | 'haveworld' || 'tools'
  const initialView = searchParams.get('view') as 'people' | 'collab' | 'relationships' || 'people'
  
  const [activeTab, setActiveTab] = useState<'tools' | 'haveworld'>(initialTab)
  const [haveWorldView, setHaveWorldView] = useState<'people' | 'collab' | 'relationships'>(initialView)
  
  // Update state when URL params change
  useEffect(() => {
    const tab = searchParams.get('tab') as 'tools' | 'haveworld'
    const view = searchParams.get('view') as 'people' | 'collab' | 'relationships'
    if (tab) setActiveTab(tab)
    if (view) setHaveWorldView(view)
  }, [searchParams])
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<'rolemodels' | 'mentors' | 'friends' | null>(null)
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [showMatchModal, setShowMatchModal] = useState(false)
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0)
  const [selectedCollabType, setSelectedCollabType] = useState<string | null>(null)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showRemoveModal, setShowRemoveModal] = useState(false)
  const [actionType, setActionType] = useState<'add' | 'remove' | null>(null)
  const [showCodeModal, setShowCodeModal] = useState(false)
  const [selectedGroupForJoin, setSelectedGroupForJoin] = useState<{ id: string; name: string; code: string } | null>(null)
  const [codeInput, setCodeInput] = useState('')
  const [matchedProfiles, setMatchedProfiles] = useState<Array<{ id: string; name: string; dream: string }>>([])
  const [showMatchSuccess, setShowMatchSuccess] = useState(false)
  const [lastMatchedName, setLastMatchedName] = useState<string | null>(null)
  const [showFeatureModal, setShowFeatureModal] = useState<string | null>(null)
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
  const [messageInput, setMessageInput] = useState('')
  const [messages, setMessages] = useState<any[]>([])
  const [isSendingMessage, setIsSendingMessage] = useState(false)
  const [activeCallId, setActiveCallId] = useState<string | null>(null)
  const [activeCallStartTime, setActiveCallStartTime] = useState<Date | null>(null)
  const [callDuration, setCallDuration] = useState(0)
  const [callHistory, setCallHistory] = useState<any[]>([])
  const [showCallHistory, setShowCallHistory] = useState(false)
  const [messagePollInterval, setMessagePollInterval] = useState<NodeJS.Timeout | null>(null)
  const [memeFeed, setMemeFeed] = useState<any[]>([])
  const [showMemeFeed, setShowMemeFeed] = useState(false)
  const [isSharingMeme, setIsSharingMeme] = useState(false)
  const [showTextMemeModal, setShowTextMemeModal] = useState(false)
  const [textMemeInput, setTextMemeInput] = useState('')
  
  // Mock data for features
  const [rivalNotifications, setRivalNotifications] = useState([
    { id: 'n1', rival: 'Marcus Johnson', task: 'Completed "Build Portfolio"', time: '2 hours ago' },
    { id: 'n2', rival: 'Alex Taylor', task: 'Completed "Study Session"', time: '5 hours ago' },
  ])
  
  const [mentorTasks, setMentorTasks] = useState([
    { id: 'mt1', mentor: 'James Wilson', task: 'Review your progress this week', due: 'Tomorrow', completed: false },
    { id: 'mt2', mentor: 'Lisa Park', task: 'Practice presentation skills', due: '3 days', completed: false },
  ])
  
  const [supportMessages, setSupportMessages] = useState([
    { id: 's1', from: 'Sarah Chen', message: 'You\'re doing great! Keep it up! 💪', time: '1 hour ago' },
    { id: 's2', from: 'Alex Taylor', message: 'Proud of your progress! 🎉', time: '3 hours ago' },
  ])

  // Mock data - converted to state so it can be modified
  const [roleModels, setRoleModels] = useState([
    { id: 'rm1', name: 'Sarah Chen', role: 'Software Engineer', status: 'connected', icon: '👤' },
    { id: 'rm2', name: 'Marcus Johnson', role: 'Entrepreneur', status: 'pending', icon: '👤' },
  ])

  const [mentors, setMentors] = useState([
    { id: 'm1', name: 'James Wilson', role: 'Career Coach', status: 'connected', icon: '👤' },
    { id: 'm2', name: 'Lisa Park', role: 'Academic Advisor', status: 'connected', icon: '👤' },
  ])

  const [friends, setFriends] = useState([
    { id: 'f1', name: 'Alex Taylor', role: 'Study Buddy', status: 'connected', icon: '👤' },
    { id: 'f2', name: 'Jordan Smith', role: 'Peer', status: 'connected', icon: '👤' },
  ])

  // Collab Types
  const collabTypes = [
    { id: 'parent_child', label: 'Parent/Child', icon: '👨‍👩‍👧‍👦' },
    { id: 'siblings', label: 'Siblings', icon: '👫' },
    { id: 'education', label: 'Education', icon: '📚' },
    { id: 'work', label: 'Work', icon: '💼' },
    { id: 'dating', label: 'Dating Relationships', icon: '💑' },
    { id: 'mentorship', label: 'Mentorship', icon: '🤝' },
  ]

  // Collab Groups - converted to state so we can track joined groups
  const [collabGroups, setCollabGroups] = useState([
    { id: 'g1', name: 'ADHD Study Group', type: 'education', leader: 'You', members: 8, isPublic: true, code: null, joined: false },
    { id: 'g2', name: 'Parent Support Circle', type: 'parent_child', leader: 'Sarah Chen', members: 12, isPublic: false, code: 'PARENT2024', joined: false },
    { id: 'g3', name: 'Tech Career Mentors', type: 'work', leader: 'Marcus Johnson', members: 15, isPublic: true, code: null, joined: false },
  ])
  const [showJoinSuccessModal, setShowJoinSuccessModal] = useState(false)
  const [joinedGroupName, setJoinedGroupName] = useState<string | null>(null)

  // Match Profiles (for swiping)
  const matchProfiles = [
    { 
      id: 'p1', 
      name: 'Taylor Kim', 
      dream: 'Build a neurodivergent-friendly workspace',
      interests: [
        { name: 'Technology', degree: 5 },
        { name: 'Accessibility', degree: 5 },
        { name: 'Design', degree: 4 },
      ],
      mutualFriends: ['Alex Taylor'],
      collabType: 'work'
    },
    { 
      id: 'p2', 
      name: 'Jordan Lee', 
      dream: 'Complete university with accommodations',
      interests: [
        { name: 'Education', degree: 5 },
        { name: 'Advocacy', degree: 4 },
        { name: 'Writing', degree: 3 },
      ],
      mutualFriends: ['Jordan Smith'],
      collabType: 'education'
    },
  ]

  // Enhanced Role Models with metrics
  const roleModelsWithMetrics = [
    { 
      ...roleModels[0], 
      modelCount: 45, 
      rating: 4.8,
      collabType: 'work'
    },
    { 
      ...roleModels[1], 
      modelCount: 32, 
      rating: 4.6,
      collabType: 'mentorship'
    },
  ]

  const handleToolsRedirect = () => {
    try {
      // Try replace first, fallback to href
      if (window.location.replace) {
        window.location.replace(SERVICE_HUB_URL)
      } else {
        window.location.href = SERVICE_HUB_URL
      }
    } catch (error) {
      console.error('Redirect error:', error)
      // Fallback: open in new tab
      window.open(SERVICE_HUB_URL, '_blank')
    }
  }

  // Auto-redirect to ServiceHub when Tools tab is selected
  useEffect(() => {
    if (activeTab === 'tools') {
      // Small delay to show loading state, then redirect
      const timer = setTimeout(() => {
        handleToolsRedirect()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [activeTab])

  const handleAddConnection = (category: 'rolemodels' | 'mentors' | 'friends') => {
    setSelectedCategory(category)
    setShowAddModal(true)
  }

  const handleRemoveConnection = (id: string, category: string) => {
    // Actually remove from state
    if (category === 'rolemodel') {
      setRoleModels(prev => prev.filter(rm => rm.id !== id))
    } else if (category === 'mentor') {
      setMentors(prev => prev.filter(m => m.id !== id))
    } else if (category === 'friend') {
      setFriends(prev => prev.filter(f => f.id !== id))
    }
  }

  const getUserId = () => {
    try {
      const userStr = localStorage.getItem('user')
      if (userStr) {
        const user = JSON.parse(userStr)
        return user.id || 'demo_user'
      }
    } catch (e) {
      console.error('Error getting user ID:', e)
    }
    return 'demo_user'
  }

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedConversation || isSendingMessage) return
    
    setIsSendingMessage(true)
    try {
      const userId = getUserId()
      const response = await axios.post(`${API_URL}/api/messaging/send?user_id=${userId}`, {
        receiver_id: selectedConversation,
        content: messageInput.trim()
      })
      
      setMessages(prev => [...prev, response.data])
      setMessageInput('')
    } catch (error: any) {
      console.error('Error sending message:', error)
      alert(error.response?.data?.detail || 'Failed to send message. Please try again.')
    } finally {
      setIsSendingMessage(false)
    }
  }

  const handleStartCall = async (mentorId: string, mentorName: string) => {
    try {
      const userId = getUserId()
      const response = await axios.post(`${API_URL}/api/calls/start?user_id=${userId}`, {
        receiver_id: mentorId,
        call_type: 'mentor',
        notes: `Video call with ${mentorName}`
      })
      
      const callId = response.data.id
      setActiveCallId(callId)
      setActiveCallStartTime(new Date())
      setCallDuration(0)
      setShowFeatureModal(null)
    } catch (error: any) {
      console.error('Error starting call:', error)
      alert(error.response?.data?.detail || 'Failed to start call. Please try again.')
    }
  }

  const handleEndCall = async () => {
    if (!activeCallId) return
    
    try {
      const userId = getUserId()
      await axios.post(`${API_URL}/api/calls/${activeCallId}/end?user_id=${userId}`)
      
      setActiveCallId(null)
      setActiveCallStartTime(null)
      setCallDuration(0)
      
      // Refresh call history
      if (showCallHistory) {
        loadCallHistory()
      }
      
      alert('Call ended and saved to database!')
    } catch (error: any) {
      console.error('Error ending call:', error)
      alert(error.response?.data?.detail || 'Failed to end call.')
    }
  }

  const loadCallHistory = async () => {
    try {
      const userId = getUserId()
      const response = await axios.get(`${API_URL}/api/calls/history?user_id=${userId}`)
      setCallHistory(response.data)
    } catch (error) {
      console.error('Error loading call history:', error)
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Load call history when component mounts or when showing history
  useEffect(() => {
    if (showCallHistory) {
      loadCallHistory()
    }
  }, [showCallHistory])

  // Poll for new messages when in a conversation
  useEffect(() => {
    if (selectedConversation && showFeatureModal === 'messaging') {
      const interval = setInterval(async () => {
        try {
          const userId = getUserId()
          const response = await axios.get(`${API_URL}/api/messaging/conversation/${selectedConversation}?user_id=${userId}`)
          setMessages(response.data)
        } catch (error) {
          console.error('Error polling messages:', error)
        }
      }, 2000) // Poll every 2 seconds
      
      setMessagePollInterval(interval)
      
      return () => {
        clearInterval(interval)
        setMessagePollInterval(null)
      }
    }
  }, [selectedConversation, showFeatureModal])

  const handleRequestConnection = (username: string, category: 'rolemodels' | 'mentors' | 'friends') => {
    // Actually add to state
    const newId = `${category.charAt(0)}${Date.now()}`
    const newConnection = {
      id: newId,
      name: username || `New ${category === 'rolemodels' ? 'Role Model' : category === 'mentors' ? 'Mentor' : 'Friend'}`,
      role: 'Pending Connection',
      status: 'pending',
      icon: '👤'
    }
    
    if (category === 'rolemodels') {
      setRoleModels(prev => [...prev, newConnection])
    } else if (category === 'mentors') {
      setMentors(prev => [...prev, newConnection])
    } else if (category === 'friends') {
      setFriends(prev => [...prev, newConnection])
    }
    
    setShowAddModal(false)
    setSelectedCategory(null)
  }

  // Keep call timer running even when modal is closed
  useEffect(() => {
    if (activeCallId) {
      const timer = setInterval(() => {
        setCallDuration(prev => prev + 1)
      }, 1000)
      
      return () => {
        clearInterval(timer)
      }
    }
  }, [activeCallId])

  return (
    <div className="min-h-screen bg-white/20 backdrop-blur-sm p-4 md:p-8 relative overflow-hidden">
      <div className="max-w-6xl mx-auto mb-4 space-y-3 relative z-10">
        <AgentInsightsBanner agent="adaptation" />
        <AgentInsightsBanner agent="reflection_analysis" />
        <AgentInsightsBanner agent="pattern_recognition" />
      </div>
      {/* Background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '5s', animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-pink-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
      </div>
      <div className="relative z-10">
      <div className="max-w-6xl mx-auto">
        {/* Header — Tool Market / Shed / Shop */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-4xl">🛒</span>
            <div>
              <h1 className="text-3xl font-bold text-slate-800">Pit Stop</h1>
              <p className="text-slate-600 text-sm italic">Tool Market · Shed · Shop</p>
            </div>
            <div className="flex gap-1 ml-auto text-2xl">
              <span title="Key">🔑</span><span title="Hammer">🔨</span><span title="Shield">🛡️</span><span title="Boots">👢</span><span title="Wrench">🔧</span>
            </div>
          </div>
          <p className="text-slate-700">Your hub for tools and connections — search for autism-friendly services</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-4 mb-6 border-b-2 border-slate-300">
          <button
            onClick={() => setActiveTab('tools')}
            className={`px-6 py-3 font-medium transition-all border-b-2 ${
              activeTab === 'tools'
                ? 'border-cyan-500 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-700'
            }`}
          >
            Tools & Resources 🔧
          </button>
          <button
            onClick={() => setActiveTab('haveworld')}
            className={`px-6 py-3 font-medium transition-all border-b-2 ${
              activeTab === 'haveworld'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-slate-600 hover:text-slate-700'
            }`}
          >
            3.5. Pit Stop #2: Hare World
          </button>
        </div>

        {/* Tools Tab - Redirects to ServiceHub */}
        {activeTab === 'tools' && (
          <div className="space-y-4">
            {/* Agent-recommended pit-stop tools (from tool_recommendation agent) */}
            {(() => {
              const pit: any = toolRecommendation?.pit_stop_tools || {}
              const buckets: Array<{ key: string; label: string; icon: string; color: string }> = [
                { key: 'services', label: 'Services', icon: '🔑', color: 'border-cyan-200 bg-cyan-50' },
                { key: 'products', label: 'Products', icon: '👢', color: 'border-amber-200 bg-amber-50' },
                { key: 'commentaries', label: 'Commentaries', icon: '🏋️', color: 'border-purple-200 bg-purple-50' },
                { key: 'other', label: 'Other', icon: '🔨', color: 'border-slate-200 bg-slate-50' },
              ]
              const hasAny = buckets.some((b) => (pit[b.key] || []).length > 0)
              if (!hasAny) return null
              return (
                <div className="bg-white rounded-2xl border-2 border-purple-200 p-6 shadow-sm">
                  <h3 className="text-lg font-bold mb-1">Recommended for you</h3>
                  <p className="text-sm text-slate-600 mb-4">Personalised pit-stop picks from your tool recommendation agent.</p>
                  <div className="grid md:grid-cols-2 gap-4">
                    {buckets.map((b) => {
                      const items = (pit[b.key] || []).slice(0, 4)
                      if (!items.length) return null
                      return (
                        <div key={b.key} className={`rounded-xl border-2 ${b.color} p-4`}>
                          <div className="font-semibold mb-2 flex items-center gap-2"><span>{b.icon}</span>{b.label}</div>
                          <ul className="space-y-2">
                            {items.map((t: any) => (
                              <li key={t.id} className="text-sm">
                                <a href={t.url || '#'} target="_blank" rel="noopener noreferrer" className="font-medium text-slate-900 hover:underline">{t.name}</a>
                                {t.description && <div className="text-xs text-slate-600 line-clamp-2">{t.description}</div>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

          <div className="bg-white rounded-2xl border-2 border-slate-200 p-8 shadow-sm">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600 mx-auto mb-4"></div>
              <p className="text-slate-600 mb-4">Redirecting to Resource Hub for tools and resources...</p>
              <div className="space-y-3">
                <button
                  onClick={handleToolsRedirect}
                  className="w-full px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-medium hover:shadow-lg transition-all"
                >
                  Go to Resource Hub
                </button>
                <a
                  href={SERVICE_HUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm text-cyan-600 hover:text-cyan-700 hover:underline"
                >
                  Or open Resource Hub in a new tab →
                </a>
                <p className="text-xs text-slate-500 mt-4">
                  Resource Hub URL: {SERVICE_HUB_URL}
                </p>
              </div>
            </div>
          </div>
          </div>
        )}

        {/* Hare World Tab */}
        {activeTab === 'haveworld' && (
          <div className="space-y-6">
            {/* Description */}
            <div className="bg-white rounded-2xl border-2 border-purple-200 p-6 shadow-sm">
              <h2 className="text-xl font-bold mb-2">3.5. Pit Stop #2: Hare World</h2>
              <p className="text-slate-600 mb-4">Pit Stop hub for people: Connect with Role Models, Mentors, and Friends</p>
              
              {/* View Toggle */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setHaveWorldView('people')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    haveWorldView === 'people'
                      ? 'bg-purple-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  People
                </button>
                <button
                  onClick={() => setHaveWorldView('collab')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    haveWorldView === 'collab'
                      ? 'bg-purple-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Collab Groups
                </button>
                <button
                  onClick={() => setHaveWorldView('relationships')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    haveWorldView === 'relationships'
                      ? 'bg-purple-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Relationships
                </button>
              </div>
              
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Find/Search people or groups..."
                  className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-purple-500 bg-white text-slate-900 placeholder-slate-400"
                />
              </div>
            </div>

            {/* People View */}
            {haveWorldView === 'people' && (
            <div className="grid md:grid-cols-3 gap-6">
              {/* Role Models */}
              <div className="bg-white rounded-2xl border-2 border-orange-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Users className="w-5 h-5 text-orange-500" />
                    R.M.'s (Role Models)
                  </h3>
                  <button
                    onClick={() => handleAddConnection('rolemodels')}
                    className="p-2 hover:bg-orange-50 rounded-lg transition-colors"
                  >
                    <UserPlus className="w-5 h-5 text-orange-500" />
                  </button>
                </div>
                <div className="space-y-3">
                  {roleModels.map((rm, i) => (
                    <div key={rm.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{['🔑','🔨','🛡️','🔧','👢'][i % 5]}</span>
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold">
                          {rm.icon}
                        </div>
                        <div>
                          <div className="font-medium">{rm.name}</div>
                          <div className="text-xs text-slate-600">{rm.role}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {rm.status === 'pending' && (
                          <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded">Pending</span>
                        )}
                        <button
                          onClick={() => handleRemoveConnection(rm.id, 'rolemodel')}
                          className="p-1 hover:bg-red-100 rounded transition-colors"
                        >
                          <UserMinus className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mentors */}
              <div className="bg-white rounded-2xl border-2 border-blue-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-blue-500" />
                    Mentors
                  </h3>
                  <button
                    onClick={() => handleAddConnection('mentors')}
                    className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <UserPlus className="w-5 h-5 text-blue-500" />
                  </button>
                </div>
                <div className="space-y-3">
                  {mentors.map((m, i) => (
                    <div key={m.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{['🔧','🔑','🏋️','🛡️','🔨'][i % 5]}</span>
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold">
                          {m.icon}
                        </div>
                        <div>
                          <div className="font-medium">{m.name}</div>
                          <div className="text-xs text-slate-600">{m.role}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveConnection(m.id, 'mentor')}
                        className="p-1 hover:bg-red-100 rounded transition-colors"
                      >
                        <UserMinus className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Friends */}
              <div className="bg-white rounded-2xl border-2 border-pink-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Users className="w-5 h-5 text-pink-500" />
                    Friends
                  </h3>
                  <button
                    onClick={() => handleAddConnection('friends')}
                    className="p-2 hover:bg-pink-50 rounded-lg transition-colors"
                  >
                    <UserPlus className="w-5 h-5 text-pink-500" />
                  </button>
                </div>
                <div className="space-y-3">
                  {friends.map((f, i) => (
                    <div key={f.id} className="flex items-center justify-between p-3 bg-pink-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{['👢','🔨','🔑','🧴','🛡️'][i % 5]}</span>
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 flex items-center justify-center text-white font-bold">
                          {f.icon}
                        </div>
                        <div>
                          <div className="font-medium">{f.name}</div>
                          <div className="text-xs text-slate-600">{f.role}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveConnection(f.id, 'friend')}
                        className="p-1 hover:bg-red-100 rounded transition-colors"
                      >
                        <UserMinus className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            )}

            {/* Collab Groups View */}
            {haveWorldView === 'collab' && (
              <div className="space-y-6">
                {/* Collab Types */}
                <div className="bg-white rounded-2xl border-2 border-indigo-200 p-6 shadow-sm">
                  <h3 className="text-lg font-bold mb-4">Collab TYPES</h3>
                  <div className="grid md:grid-cols-3 gap-4">
                    {collabTypes.map((type) => (
                      <button
                        key={type.id}
                        onClick={() => {
                          setSelectedCollabType(selectedCollabType === type.id ? null : type.id)
                        }}
                        className={`flex items-center gap-3 p-4 rounded-lg transition-all text-left border-2 cursor-pointer ${
                          selectedCollabType === type.id
                            ? 'bg-indigo-100 border-indigo-400 hover:bg-indigo-200'
                            : 'bg-slate-50 border-transparent hover:bg-slate-100 hover:border-indigo-300'
                        }`}
                      >
                        <span className="text-2xl">{type.icon}</span>
                        <span className="font-medium">{type.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Collab Groups */}
                <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold">Collab Groups (via Collab Type)</h3>
                    <button
                      onClick={() => setShowGroupModal(true)}
                      className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg font-medium hover:shadow-lg transition-all flex items-center gap-2"
                    >
                      <UserPlus className="w-4 h-4" />
                      Create Group
                    </button>
                  </div>
                  <p className="text-sm text-slate-600 mb-4">
                    Like Mentor Groups but w/o mentor. Search if public & get via code if private.
                  </p>
                  
                  <div className="space-y-4">
                    {(selectedCollabType 
                      ? collabGroups.filter(g => g.type === selectedCollabType)
                      : collabGroups
                    ).map((group) => (
                      <div key={group.id} className="border-2 border-slate-200 rounded-lg p-4 hover:border-indigo-300 transition-all">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-bold text-lg">{group.name}</h4>
                              {group.leader === 'You' && (
                                <Crown className="w-5 h-5 text-amber-500" />
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-slate-600 mb-2">
                              <span className="flex items-center gap-1">
                                <Users2 className="w-4 h-4" />
                                {group.members} members
                              </span>
                              <span className="flex items-center gap-1">
                                {group.isPublic ? (
                                  <>
                                    <Eye className="w-4 h-4 text-green-500" />
                                    Public
                                  </>
                                ) : (
                                  <>
                                    <Lock className="w-4 h-4 text-amber-500" />
                                    Private
                                  </>
                                )}
                              </span>
                              <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs">
                                {collabTypes.find(t => t.id === group.type)?.label}
                              </span>
                            </div>
                            {group.leader === 'You' && (
                              <p className="text-xs text-amber-600 font-medium">You are the group leader - you set rules</p>
                            )}
                            {!group.isPublic && group.code && (
                              <div className="mt-2 flex items-center gap-2">
                                <Code className="w-4 h-4 text-slate-500" />
                                <span className="text-sm font-mono bg-slate-100 px-2 py-1 rounded">Code: {group.code}</span>
                              </div>
                            )}
                          </div>
                          <button 
                            onClick={() => {
                              if (group.joined) {
                                // Already joined - could show leave option
                                if (confirm(`Leave ${group.name}?`)) {
                                  setCollabGroups(prev => prev.map(g => 
                                    g.id === group.id ? { ...g, joined: false, members: g.members - 1 } : g
                                  ))
                                }
                              } else if (group.isPublic) {
                                // Join public group
                                setCollabGroups(prev => prev.map(g => 
                                  g.id === group.id ? { ...g, joined: true, members: g.members + 1 } : g
                                ))
                                setJoinedGroupName(group.name)
                                setShowJoinSuccessModal(true)
                                setTimeout(() => {
                                  setShowJoinSuccessModal(false)
                                  setJoinedGroupName(null)
                                }, 2000)
                              } else if (group.code) {
                                // For private groups, show code input modal
                                setSelectedGroupForJoin({ id: group.id, name: group.name, code: group.code })
                                setShowCodeModal(true)
                                setCodeInput('')
                              }
                            }}
                            className={`px-4 py-2 rounded-lg transition-all text-sm font-medium cursor-pointer ${
                              group.joined
                                ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                : 'bg-indigo-500 text-white hover:bg-indigo-600'
                            }`}
                          >
                            {group.joined ? '✓ Joined' : 'Join'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Relationships View */}
            {haveWorldView === 'relationships' && (
              <div className="space-y-6">
                {/* Match Prompt */}
                <div className="bg-white rounded-2xl border-2 border-pink-200 p-6 shadow-sm">
                  <h3 className="text-lg font-bold mb-4">Relationships / Profiles</h3>
                  <p className="text-sm text-slate-600 mb-4">
                    Generate smaller friends + swipe. Match based on dreams and interests.
                  </p>
                  
                  <button
                    onClick={() => {
                      setShowMatchModal(true)
                      setCurrentMatchIndex(0)
                    }}
                    className="w-full px-6 py-4 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl font-medium hover:shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    <Heart className="w-5 h-5" />
                    Start Matching
                  </button>
                  
                  {matchedProfiles.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-pink-200">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-slate-700">
                          Your Matches ({matchedProfiles.length})
                        </span>
                        <button
                          onClick={() => setMatchedProfiles([])}
                          className="text-xs text-slate-500 hover:text-slate-700"
                        >
                          Clear
                        </button>
                      </div>
                      <div className="space-y-2">
                        {matchedProfiles.map((match) => (
                          <div key={match.id} className="flex items-center gap-3 p-3 bg-pink-50 rounded-lg border border-pink-200">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center text-white font-bold">
                              {match.name.charAt(0)}
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-slate-900">{match.name}</div>
                              <div className="text-xs text-slate-600 italic">"{match.dream}"</div>
                            </div>
                            <Heart className="w-5 h-5 text-pink-500 fill-pink-500" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Role Models with Metrics */}
                <div className="bg-white rounded-2xl border-2 border-orange-200 p-6 shadow-sm">
                  <h3 className="text-lg font-bold mb-4">Role Models (Enhanced)</h3>
                  <p className="text-xs text-slate-500 mb-4">If a R.M., add: a) Model Count, b) Rating metric</p>
                  <div className="space-y-4">
                    {roleModelsWithMetrics.map((rm) => (
                      <div key={rm.id} className="border-2 border-orange-200 rounded-lg p-4 bg-orange-50">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold">
                              {rm.icon}
                            </div>
                            <div>
                              <div className="font-bold">{rm.name}</div>
                              <div className="text-sm text-slate-600">{rm.role}</div>
                              <div className="text-xs text-slate-500 mt-1">
                                Collab Type: {collabTypes.find(t => t.id === rm.collabType)?.label}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1 mb-1">
                              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                              <span className="font-bold">{rm.rating}</span>
                            </div>
                            <div className="text-xs text-slate-600">
                              Model Count: <span className="font-bold">{rm.modelCount}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Functions Section - Only show in People view */}
            {haveWorldView === 'people' && (
            <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm">
              <h3 className="text-lg font-bold mb-4">Functions:</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <button 
                  onClick={() => {
                    // Focus the search input
                    const searchInput = document.querySelector('input[placeholder*="Find/Search"]') as HTMLInputElement
                    if (searchInput) {
                      searchInput.focus()
                      searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    }
                  }}
                  className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-all text-left cursor-pointer"
                >
                  <Search className="w-5 h-5 text-slate-600" />
                  <span className="font-medium">Find/Search</span>
                </button>
                <button 
                  onClick={() => {
                    setActionType('add')
                    setShowCategoryModal(true)
                  }}
                  className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-all text-left cursor-pointer"
                >
                  <UserPlus className="w-5 h-5 text-slate-600" />
                  <span className="font-medium">Add</span>
                </button>
                <button 
                  onClick={() => {
                    setActionType('remove')
                    setShowRemoveModal(true)
                  }}
                  className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-all text-left cursor-pointer"
                >
                  <UserMinus className="w-5 h-5 text-slate-600" />
                  <span className="font-medium">Remove</span>
                </button>
                <button 
                  onClick={() => {
                    alert('AI suggestions for connections based on your profile and goals will appear here!')
                  }}
                  className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-all text-left cursor-pointer"
                >
                  <Sparkles className="w-5 h-5 text-slate-600" />
                  <span className="font-medium">Suggest</span>
                </button>
                <button 
                  onClick={() => {
                    router.push('/reflection?contextType=people')
                  }}
                  className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-all text-left cursor-pointer"
                >
                  <Sparkles className="w-5 h-5 text-slate-600" />
                  <span className="font-medium">Journal</span>
                </button>
                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                  <Share2 className="w-5 h-5 text-slate-600" />
                  <span className="font-medium">Share/Restrict/Private</span>
                  <div className="ml-auto flex gap-2">
                    <button 
                      onClick={() => {
                        alert('Setting visibility to Public (Share)')
                      }}
                      className="p-1 hover:bg-slate-200 rounded cursor-pointer"
                      title="Set to Public"
                    >
                      <Globe className="w-4 h-4 text-green-500" />
                    </button>
                    <button 
                      onClick={() => {
                        alert('Setting visibility to Private (Restrict)')
                      }}
                      className="p-1 hover:bg-slate-200 rounded cursor-pointer"
                      title="Set to Private"
                    >
                      <Lock className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    router.push('/path')
                  }}
                  className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-all text-left cursor-pointer"
                >
                  <span className="font-medium">Paths</span>
                </button>
                <button 
                  onClick={() => {
                    router.push('/races')
                  }}
                  className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-all text-left cursor-pointer"
                >
                  <span className="font-medium">Races</span>
                </button>
              </div>
            </div>
            )}

            {/* Additional Features - Only show in People view */}
            {haveWorldView === 'people' && (
            <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm">
              <h3 className="text-lg font-bold mb-4">Additional Features:</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <button
                  onClick={() => setShowFeatureModal('rival')}
                  className="flex items-center gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200 hover:bg-amber-100 hover:border-amber-300 transition-all text-left cursor-pointer"
                >
                  <Bell className="w-5 h-5 text-amber-600" />
                  <div className="flex-1">
                    <div className="font-medium">Rival Notifs / Watch Tasks</div>
                    <div className="text-xs text-slate-600">Get notified when rivals complete tasks</div>
                  </div>
                  {rivalNotifications.length > 0 && (
                    <span className="bg-amber-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                      {rivalNotifications.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => {
                    router.push('/races?compare=rolemodel')
                  }}
                  className="flex items-center gap-3 p-4 bg-purple-50 rounded-lg border border-purple-200 hover:bg-purple-100 hover:border-purple-300 transition-all text-left cursor-pointer"
                >
                  <Trophy className="w-5 h-5 text-purple-600" />
                  <div>
                    <div className="font-medium">Person's Icon @ Goal</div>
                    <div className="text-xs text-slate-600">See who's competing on same goals</div>
                  </div>
                </button>
                <button
                  onClick={() => setShowFeatureModal('mentor')}
                  className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-all text-left cursor-pointer"
                >
                  <UserCheck className="w-5 h-5 text-blue-600" />
                  <div className="flex-1">
                    <div className="font-medium">Mentor Tasks</div>
                    <div className="text-xs text-slate-600">Tasks assigned by mentors</div>
                  </div>
                  {mentorTasks.filter(t => !t.completed).length > 0 && (
                    <span className="bg-blue-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                      {mentorTasks.filter(t => !t.completed).length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setShowFeatureModal('support')}
                  className="flex items-center gap-3 p-4 bg-pink-50 rounded-lg border border-pink-200 hover:bg-pink-100 hover:border-pink-300 transition-all text-left cursor-pointer"
                >
                  <Sparkles className="w-5 h-5 text-pink-600" />
                  <div className="flex-1">
                    <div className="font-medium">Supporting</div>
                    <div className="text-xs text-slate-600">Support and encouragement</div>
                  </div>
                  {supportMessages.length > 0 && (
                    <span className="bg-pink-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                      {supportMessages.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setShowFeatureModal('messaging')}
                  className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200 hover:bg-green-100 hover:border-green-300 transition-all text-left cursor-pointer"
                >
                  <MessageSquare className="w-5 h-5 text-green-600" />
                  <div>
                    <div className="font-medium">(MODERATED) Messaging</div>
                    <div className="text-xs text-slate-600">Safe, moderated communication</div>
                  </div>
                </button>
                <button
                  onClick={() => setShowFeatureModal('memes')}
                  className="flex items-center gap-3 p-4 bg-yellow-50 rounded-lg border border-yellow-200 hover:bg-yellow-100 hover:border-yellow-300 transition-all text-left cursor-pointer"
                >
                  <span className="text-2xl">😄</span>
                  <div>
                    <div className="font-medium">MEMES</div>
                    <div className="text-xs text-slate-600">Share memes and fun content</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    router.push('/races')
                  }}
                  className="flex items-center gap-3 p-4 bg-indigo-50 rounded-lg border border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 transition-all text-left cursor-pointer"
                >
                  <Users className="w-5 h-5 text-indigo-600" />
                  <div>
                    <div className="font-medium">Collab on "Projects" (Races)</div>
                    <div className="text-xs text-slate-600">Collaborate on shared goals</div>
                  </div>
                </button>
                <button
                  onClick={() => setShowFeatureModal('mentor-call')}
                  className="flex items-center gap-3 p-4 bg-rose-50 rounded-lg border border-rose-200 hover:bg-rose-100 hover:border-rose-300 transition-all text-left cursor-pointer"
                >
                  <Video className="w-5 h-5 text-rose-600" />
                  <div>
                    <div className="font-medium">Mentor Stream/Call</div>
                    <div className="text-xs text-slate-600">Video calls with mentors</div>
                  </div>
                </button>
              </div>
            </div>
            )}
          </div>
        )}

        {/* Add Connection Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">
                  Add {selectedCategory === 'rolemodels' ? 'Role Model' : selectedCategory === 'mentors' ? 'Mentor' : 'Friend'}
                </h3>
                <button
                  onClick={() => {
                    setShowAddModal(false)
                    setSelectedCategory(null)
                  }}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Request via username:</label>
                  <input
                    type="text"
                    id="username-input"
                    placeholder="Enter username"
                    className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-purple-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && selectedCategory) {
                        const input = e.target as HTMLInputElement
                        handleRequestConnection(input.value, selectedCategory)
                      }
                    }}
                  />
                </div>
                {selectedCategory && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Collab Type (if in a relationship):</label>
                    <select className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-purple-500">
                      <option value="">Select type...</option>
                      {collabTypes.map((type) => (
                        <option key={type.id} value={type.id}>{type.label}</option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500 mt-1">In Request, should specify this</p>
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowAddModal(false)
                      setSelectedCategory(null)
                    }}
                    className="flex-1 px-4 py-2 border-2 border-slate-200 rounded-lg font-medium hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (selectedCategory) {
                        const input = document.getElementById('username-input') as HTMLInputElement
                        handleRequestConnection(input?.value || '', selectedCategory)
                      }
                    }}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:shadow-lg transition-all"
                  >
                    Send Request
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Group Modal */}
        {showGroupModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">Create Collab Group</h3>
                <button
                  onClick={() => setShowGroupModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Group Name:</label>
                  <input
                    type="text"
                    placeholder="Enter group name"
                    className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Collab Type:</label>
                  <select className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500">
                    {collabTypes.map((type) => (
                      <option key={type.id} value={type.id}>{type.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Visibility:</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input type="radio" name="visibility" value="public" defaultChecked />
                      <span>Public (searchable)</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="visibility" value="private" />
                      <span>Private (code required)</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Group Rules:</label>
                  <textarea
                    placeholder="Set rules (e.g., If groups can see others' data)"
                    className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 h-24"
                  />
                  <p className="text-xs text-slate-500 mt-1">As group leader, you set the rules</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowGroupModal(false)}
                    className="flex-1 px-4 py-2 border-2 border-slate-200 rounded-lg font-medium hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setShowGroupModal(false)}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg font-medium hover:shadow-lg transition-all"
                  >
                    Create Group
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Category Selection Modal */}
        {showCategoryModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">
                  {actionType === 'add' ? 'Add Connection' : 'Select Category'}
                </h3>
                <button
                  onClick={() => {
                    setShowCategoryModal(false)
                    setActionType(null)
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => {
                    if (actionType === 'add') {
                      handleAddConnection('rolemodels')
                    }
                    setShowCategoryModal(false)
                    setActionType(null)
                  }}
                  className="w-full p-4 bg-orange-50 border-2 border-orange-200 rounded-lg hover:bg-orange-100 transition-all text-left"
                >
                  <div className="font-medium text-orange-900">Role Models</div>
                  <div className="text-sm text-orange-700">Add a role model connection</div>
                </button>
                <button
                  onClick={() => {
                    if (actionType === 'add') {
                      handleAddConnection('mentors')
                    }
                    setShowCategoryModal(false)
                    setActionType(null)
                  }}
                  className="w-full p-4 bg-blue-50 border-2 border-blue-200 rounded-lg hover:bg-blue-100 transition-all text-left"
                >
                  <div className="font-medium text-blue-900">Mentors</div>
                  <div className="text-sm text-blue-700">Add a mentor connection</div>
                </button>
                <button
                  onClick={() => {
                    if (actionType === 'add') {
                      handleAddConnection('friends')
                    }
                    setShowCategoryModal(false)
                    setActionType(null)
                  }}
                  className="w-full p-4 bg-pink-50 border-2 border-pink-200 rounded-lg hover:bg-pink-100 transition-all text-left"
                >
                  <div className="font-medium text-pink-900">Friends</div>
                  <div className="text-sm text-pink-700">Add a friend connection</div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Remove Connection Modal */}
        {showRemoveModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">Remove Connection</h3>
                <button
                  onClick={() => setShowRemoveModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-slate-600 mb-4">
                Select a category to see connections you can remove:
              </p>
              <div className="space-y-3 mb-4">
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {roleModels.map((rm) => (
                    <div key={rm.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                      <div>
                        <div className="font-medium text-orange-900">{rm.name}</div>
                        <div className="text-sm text-orange-700">{rm.role}</div>
                      </div>
                      <button
                        onClick={() => {
                          handleRemoveConnection(rm.id, 'rolemodel')
                          if (roleModels.length === 1) setShowRemoveModal(false)
                        }}
                        className="p-2 hover:bg-red-100 rounded transition-colors"
                      >
                        <UserMinus className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  ))}
                  {mentors.map((m) => (
                    <div key={m.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <div>
                        <div className="font-medium text-blue-900">{m.name}</div>
                        <div className="text-sm text-blue-700">{m.role}</div>
                      </div>
                      <button
                        onClick={() => {
                          handleRemoveConnection(m.id, 'mentor')
                          if (mentors.length === 1 && roleModels.length === 0) setShowRemoveModal(false)
                        }}
                        className="p-2 hover:bg-red-100 rounded transition-colors"
                      >
                        <UserMinus className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  ))}
                  {friends.map((f) => (
                    <div key={f.id} className="flex items-center justify-between p-3 bg-pink-50 rounded-lg">
                      <div>
                        <div className="font-medium text-pink-900">{f.name}</div>
                        <div className="text-sm text-pink-700">{f.role}</div>
                      </div>
                      <button
                        onClick={() => {
                          handleRemoveConnection(f.id, 'friend')
                          if (friends.length === 1 && mentors.length === 0 && roleModels.length === 0) setShowRemoveModal(false)
                        }}
                        className="p-2 hover:bg-red-100 rounded transition-colors"
                      >
                        <UserMinus className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  ))}
                  {roleModels.length === 0 && mentors.length === 0 && friends.length === 0 && (
                    <div className="text-center text-slate-500 py-4">No connections to remove</div>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowRemoveModal(false)}
                className="w-full px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Join Success Modal */}
        {showJoinSuccessModal && joinedGroupName && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
              <div className="text-center">
                <div className="text-5xl mb-4">🎉</div>
                <h3 className="text-xl font-bold mb-2">Successfully Joined!</h3>
                <p className="text-slate-600 mb-4">
                  You've joined <span className="font-semibold">{joinedGroupName}</span>
                </p>
                <button
                  onClick={() => {
                    setShowJoinSuccessModal(false)
                    setJoinedGroupName(null)
                  }}
                  className="px-6 py-2 bg-indigo-500 text-white rounded-lg font-medium hover:bg-indigo-600 transition-all"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Group Code Input Modal */}
        {showCodeModal && selectedGroupForJoin && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">Join Private Group</h3>
                <button
                  onClick={() => {
                    setShowCodeModal(false)
                    setSelectedGroupForJoin(null)
                    setCodeInput('')
                  }}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-600 mb-2">
                    Enter the group code to join <span className="font-semibold">{selectedGroupForJoin.name}</span>:
                  </p>
                  <input
                    type="text"
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value)}
                    placeholder="Enter group code"
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 text-center font-mono text-lg tracking-wider bg-white text-slate-900 placeholder-slate-400"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (codeInput === selectedGroupForJoin.code) {
                          setShowCodeModal(false)
                          setSelectedGroupForJoin(null)
                          setCodeInput('')
                          alert(`Successfully joined ${selectedGroupForJoin.name}!`)
                        } else {
                          alert('Invalid code. Please try again.')
                          setCodeInput('')
                        }
                      }
                    }}
                    autoFocus
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowCodeModal(false)
                      setSelectedGroupForJoin(null)
                      setCodeInput('')
                    }}
                    className="flex-1 px-4 py-2 border-2 border-slate-200 rounded-lg font-medium hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (codeInput === selectedGroupForJoin.code) {
                        // Update the group to show as joined
                        setCollabGroups(prev => prev.map(g => 
                          g.id === selectedGroupForJoin.id ? { ...g, joined: true, members: g.members + 1 } : g
                        ))
                        setShowCodeModal(false)
                        setJoinedGroupName(selectedGroupForJoin.name)
                        setShowJoinSuccessModal(true)
                        setSelectedGroupForJoin(null)
                        setCodeInput('')
                        setTimeout(() => {
                          setShowJoinSuccessModal(false)
                          setJoinedGroupName(null)
                        }, 2000)
                      } else {
                        alert('Invalid code. Please try again.')
                        setCodeInput('')
                      }
                    }}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg font-medium hover:shadow-lg transition-all"
                  >
                    Join Group
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Match Modal (Swipe Interface) */}
        {showMatchModal && matchProfiles[currentMatchIndex] && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl relative">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">Match Prompt: Dream(s)</h3>
                <button
                  onClick={() => {
                    setShowMatchModal(false)
                    setCurrentMatchIndex(0)
                  }}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="text-center">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 mx-auto mb-3 flex items-center justify-center text-white text-2xl font-bold">
                    {matchProfiles[currentMatchIndex].name.charAt(0)}
                  </div>
                  <h4 className="text-xl font-bold">{matchProfiles[currentMatchIndex].name}</h4>
                </div>

                <div className="bg-pink-50 rounded-lg p-4">
                  <div className="text-sm font-medium mb-2">Dream:</div>
                  <div className="text-slate-700">"{matchProfiles[currentMatchIndex].dream}"</div>
                </div>

                <div>
                  <div className="text-sm font-medium mb-2">Interests + Degree of interest:</div>
                  <div className="space-y-2">
                    {matchProfiles[currentMatchIndex].interests.map((interest, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-sm">{interest.name}</span>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-4 h-4 ${
                                star <= interest.degree
                                  ? 'text-amber-500 fill-amber-500'
                                  : 'text-slate-300'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {matchProfiles[currentMatchIndex].mutualFriends.length > 0 && (
                  <div>
                    <div className="text-sm font-medium mb-2">Also friends with:</div>
                    <div className="flex flex-wrap gap-2">
                      {matchProfiles[currentMatchIndex].mutualFriends.map((friend, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            // In production, this would navigate to friend's profile
                            alert(`Viewing ${friend}'s profile...`)
                          }}
                          className="text-sm text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                        >
                          {friend}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => {
                      // Pass - move to next profile
                      if (currentMatchIndex < matchProfiles.length - 1) {
                        setCurrentMatchIndex(currentMatchIndex + 1)
                      } else {
                        // No more profiles, show summary or close
                        if (matchedProfiles.length > 0) {
                          alert(`You passed on this profile. You've matched with ${matchedProfiles.length} person${matchedProfiles.length > 1 ? 's' : ''}!`)
                        }
                        setShowMatchModal(false)
                        setCurrentMatchIndex(0)
                      }
                    }}
                    className="flex-1 px-4 py-3 border-2 border-slate-300 rounded-lg font-medium hover:bg-slate-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" />
                    Pass
                  </button>
                  <button
                    onClick={() => {
                      const currentProfile = matchProfiles[currentMatchIndex]
                      
                      // Add to matched profiles if not already matched
                      if (!matchedProfiles.find(m => m.id === currentProfile.id)) {
                        setMatchedProfiles(prev => [...prev, {
                          id: currentProfile.id,
                          name: currentProfile.name,
                          dream: currentProfile.dream
                        }])
                        setLastMatchedName(currentProfile.name)
                        setShowMatchSuccess(true)
                        
                        // Auto-hide success message after 2 seconds
                        setTimeout(() => {
                          setShowMatchSuccess(false)
                        }, 2000)
                      }
                      
                      // Move to next profile after a brief delay
                      setTimeout(() => {
                        if (currentMatchIndex < matchProfiles.length - 1) {
                          setCurrentMatchIndex(currentMatchIndex + 1)
                        } else {
                          // No more profiles, show summary
                          alert(`🎉 You've matched with ${matchedProfiles.length + 1} person${matchedProfiles.length > 0 ? 's' : ''}! Check your connections.`)
                          setShowMatchModal(false)
                          setCurrentMatchIndex(0)
                        }
                      }, 1500)
                    }}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-lg font-medium hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ChevronRight className="w-5 h-5" />
                    Match
                  </button>
                </div>
                
                {/* Match Success Overlay */}
                {showMatchSuccess && lastMatchedName && (
                  <div className="absolute inset-0 bg-gradient-to-br from-pink-500/90 to-rose-500/90 rounded-2xl flex items-center justify-center z-10 animate-pulse">
                    <div className="text-center text-white">
                      <div className="text-6xl mb-4">🎉</div>
                      <div className="text-2xl font-bold mb-2">It's a Match!</div>
                      <div className="text-lg">You matched with {lastMatchedName}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Feature Modals */}
        {showFeatureModal === 'rival' && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Bell className="w-5 h-5 text-amber-600" />
                  Rival Notifications
                </h3>
                <button onClick={() => setShowFeatureModal(null)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {rivalNotifications.length > 0 ? (
                  rivalNotifications.map((notif) => (
                    <div key={notif.id} className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="font-medium text-amber-900">{notif.rival}</div>
                      <div className="text-sm text-slate-700">{notif.task}</div>
                      <div className="text-xs text-slate-500 mt-1">{notif.time}</div>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500 text-center py-4">No rival notifications yet</p>
                )}
              </div>
            </div>
          </div>
        )}

        {showFeatureModal === 'mentor' && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-blue-600" />
                  Mentor Tasks
                </h3>
                <button onClick={() => setShowFeatureModal(null)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {mentorTasks.map((task) => (
                  <div key={task.id} className={`p-3 border rounded-lg ${task.completed ? 'bg-slate-50 border-slate-200' : 'bg-blue-50 border-blue-200'}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-slate-900">{task.task}</div>
                        <div className="text-sm text-slate-600">From: {task.mentor}</div>
                        <div className="text-xs text-slate-500 mt-1">Due: {task.due}</div>
                      </div>
                      <button
                        onClick={() => {
                          setMentorTasks(prev => prev.map(t => 
                            t.id === task.id ? { ...t, completed: !t.completed } : t
                          ))
                        }}
                        className={`px-3 py-1 rounded text-xs font-medium ${
                          task.completed 
                            ? 'bg-slate-200 text-slate-600' 
                            : 'bg-blue-500 text-white hover:bg-blue-600'
                        }`}
                      >
                        {task.completed ? 'Completed' : 'Mark Done'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {showFeatureModal === 'support' && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-pink-600" />
                  Support Messages
                </h3>
                <button onClick={() => setShowFeatureModal(null)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {supportMessages.map((msg) => (
                  <div key={msg.id} className="p-3 bg-pink-50 border border-pink-200 rounded-lg">
                    <div className="font-medium text-pink-900">{msg.from}</div>
                    <div className="text-sm text-slate-700 mt-1">{msg.message}</div>
                    <div className="text-xs text-slate-500 mt-1">{msg.time}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {showFeatureModal === 'messaging' && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 max-w-2xl w-full mx-4 shadow-xl max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-green-600" />
                    Moderated Messaging
                  </h3>
                  {selectedConversation && messagePollInterval && (
                    <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                      Live
                    </span>
                  )}
                </div>
                <button 
                  onClick={() => {
                    if (messagePollInterval) {
                      clearInterval(messagePollInterval)
                      setMessagePollInterval(null)
                    }
                    setShowFeatureModal(null)
                    setSelectedConversation(null)
                    setMessages([])
                  }} 
                  className="p-2 hover:bg-slate-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {!selectedConversation ? (
                <div className="space-y-4 flex-1 overflow-y-auto">
                  <p className="text-slate-600 text-sm">
                    Safe, moderated communication with your connections. All messages are reviewed for safety.
                  </p>
                  <div className="space-y-2">
                    {roleModels.concat(mentors as any).concat(friends as any).slice(0, 3).map((person) => (
                      <button
                        key={person.id}
                        onClick={async () => {
                          setSelectedConversation(person.id)
                          try {
                            const userId = getUserId()
                            const response = await axios.get(`${API_URL}/api/messaging/conversation/${person.id}?user_id=${userId}`)
                            setMessages(response.data)
                          } catch (error) {
                            console.error('Error loading conversation:', error)
                            setMessages([])
                          }
                        }}
                        className="w-full p-3 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 text-left"
                      >
                        <div className="font-medium">{person.name}</div>
                        <div className="text-xs text-slate-600">Click to start conversation</div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col flex-1 min-h-0">
                  <div className="flex-1 overflow-y-auto space-y-2 mb-4 p-2 bg-slate-50 rounded-lg">
                    {messages.length > 0 ? (
                      messages.map((msg, index) => {
                        const isNew = index === messages.length - 1 && Date.now() - new Date(msg.created_at).getTime() < 5000
                        return (
                          <div
                            key={msg.id}
                            className={`p-2 rounded-lg transition-all ${
                              msg.sender_id === 'demo_user' 
                                ? 'bg-green-500 text-white ml-auto max-w-[80%]' 
                                : 'bg-white border border-slate-200 max-w-[80%]'
                            } ${isNew ? 'animate-pulse' : ''}`}
                          >
                            <div className="text-sm">{msg.content}</div>
                            <div className={`text-xs mt-1 ${msg.sender_id === 'demo_user' ? 'text-green-100' : 'text-slate-500'}`}>
                              {new Date(msg.created_at).toLocaleTimeString()}
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <p className="text-center text-slate-500 py-4">No messages yet. Start the conversation!</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter' && messageInput.trim() && !isSendingMessage) {
                          await handleSendMessage()
                        }
                      }}
                      placeholder="Type a message..."
                      className="flex-1 px-4 py-2 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-green-500 bg-white text-slate-900 placeholder-slate-400"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!messageInput.trim() || isSendingMessage}
                      className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSendingMessage ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {showFeatureModal === 'memes' && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 max-w-2xl w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <span className="text-2xl">😄</span>
                    MEMES
                  </h3>
                  <button
                    onClick={async () => {
                      setShowMemeFeed(!showMemeFeed)
                      if (!showMemeFeed) {
                        try {
                          const userId = getUserId()
                          const response = await axios.get(`${API_URL}/api/memes/feed?user_id=${userId}`)
                          setMemeFeed(response.data)
                        } catch (error) {
                          console.error('Error loading meme feed:', error)
                          setMemeFeed([])
                        }
                      }
                    }}
                    className="ml-2 px-3 py-1 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg"
                  >
                    {showMemeFeed ? 'Hide' : 'Show'} Feed
                  </button>
                </div>
                <button onClick={() => setShowFeatureModal(null)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Meme Feed */}
              {showMemeFeed && (
                <div className="mb-6">
                  <h4 className="font-bold mb-3 text-slate-800">Meme Feed</h4>
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {memeFeed.length > 0 ? (
                      memeFeed.map((meme) => (
                        <div key={meme.id} className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              {meme.content_type === 'emoji' && (
                                <div className="text-4xl mb-2">{meme.content}</div>
                              )}
                              {meme.caption && (
                                <div className="text-sm text-slate-700 mb-2">{meme.caption}</div>
                              )}
                              <div className="text-xs text-slate-500">
                                {new Date(meme.created_at).toLocaleString()}
                              </div>
                            </div>
                            <button
                              onClick={async () => {
                                try {
                                  const userId = getUserId()
                                  await axios.post(`${API_URL}/api/memes/like?user_id=${userId}&meme_id=${meme.id}`)
                                  // Refresh feed
                                  const response = await axios.get(`${API_URL}/api/memes/feed?user_id=${userId}`)
                                  setMemeFeed(response.data)
                                } catch (error) {
                                  console.error('Error liking meme:', error)
                                }
                              }}
                              className={`ml-2 px-3 py-1 rounded-lg text-sm ${
                                meme.liked_by_user
                                  ? 'bg-red-500 text-white'
                                  : 'bg-white border border-slate-300 hover:bg-red-50'
                              }`}
                            >
                              ❤️ {meme.likes}
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-slate-500 py-4">No memes in feed yet. Share one to get started!</p>
                    )}
                  </div>
                </div>
              )}

              {/* Share Memes */}
              <div className="space-y-4">
                <p className="text-slate-600 text-sm">Share memes and fun content with your connections!</p>
                <div className="grid grid-cols-2 gap-3">
                  {['🎯', '💪', '🚀', '✨'].map((emoji, idx) => (
                    <button
                      key={idx}
                      onClick={async () => {
                        if (isSharingMeme) return
                        setIsSharingMeme(true)
                        try {
                          const userId = getUserId()
                          await axios.post(`${API_URL}/api/memes/share?user_id=${userId}`, {
                            content_type: 'emoji',
                            content: emoji,
                            caption: `Shared ${emoji} meme!`
                          })
                          alert(`✅ ${emoji} meme shared successfully!`)
                          // Refresh feed if open
                          if (showMemeFeed) {
                            const response = await axios.get(`${API_URL}/api/memes/feed?user_id=${userId}`)
                            setMemeFeed(response.data)
                          }
                        } catch (error: any) {
                          console.error('Error sharing meme:', error)
                          alert(error.response?.data?.detail || 'Failed to share meme. Please try again.')
                        } finally {
                          setIsSharingMeme(false)
                        }
                      }}
                      disabled={isSharingMeme}
                      className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg hover:bg-yellow-100 text-3xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowTextMemeModal(true)}
                  disabled={isSharingMeme}
                  className="w-full px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Share Text Meme
                </button>
              </div>
            </div>
          </div>
        )}

        {showFeatureModal === 'mentor-call' && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 max-w-2xl w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Video className="w-5 h-5 text-rose-600" />
                  Mentor Video Calls
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setShowCallHistory(!showCallHistory)
                      if (!showCallHistory) loadCallHistory()
                    }}
                    className="px-3 py-1 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg"
                  >
                    {showCallHistory ? 'Hide' : 'Show'} History
                  </button>
                  <button onClick={() => setShowFeatureModal(null)} className="p-2 hover:bg-slate-100 rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Active Call Interface */}
              {activeCallId && (
                <div className="mb-6 p-6 bg-gradient-to-br from-rose-50 to-pink-50 border-2 border-rose-300 rounded-xl">
                  <div className="text-center">
                    <div className="w-20 h-20 rounded-full bg-rose-500 mx-auto mb-4 flex items-center justify-center">
                      <Video className="w-10 h-10 text-white" />
                    </div>
                    <h4 className="text-xl font-bold text-rose-900 mb-2">Call in Progress</h4>
                    <div className="text-4xl font-mono font-bold text-rose-700 mb-4">
                      {formatDuration(callDuration)}
                    </div>
                    <div className="flex gap-3 justify-center">
                      <button
                        onClick={handleEndCall}
                        className="px-6 py-3 bg-red-500 text-white rounded-full hover:bg-red-600 font-medium flex items-center gap-2"
                      >
                        <X className="w-5 h-5" />
                        End Call
                      </button>
                    </div>
                    <p className="text-xs text-rose-600 mt-4">Call ID: {activeCallId}</p>
                  </div>
                </div>
              )}

              {/* Call History */}
              {showCallHistory && (
                <div className="mb-6">
                  <h4 className="font-bold mb-3 text-slate-800">Call History</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {callHistory.length > 0 ? (
                      callHistory.map((call) => (
                        <div key={call.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="font-medium text-slate-900">
                                {call.call_type === 'mentor' ? 'Mentor Call' : 'Call'}
                              </div>
                              <div className="text-xs text-slate-600">
                                {call.started_at ? new Date(call.started_at).toLocaleString() : 'Scheduled'}
                              </div>
                              {call.duration && (
                                <div className="text-xs text-slate-500 mt-1">
                                  Duration: {formatDuration(call.duration)}
                                </div>
                              )}
                            </div>
                            <div className="text-right">
                              <div className={`text-xs px-2 py-1 rounded ${
                                call.status === 'completed' ? 'bg-green-100 text-green-700' :
                                call.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                'bg-slate-100 text-slate-700'
                              }`}>
                                {call.status}
                              </div>
                            </div>
                          </div>
                          {call.notes && (
                            <div className="text-xs text-slate-600 mt-2 italic">{call.notes}</div>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-slate-500 py-4">No call history yet</p>
                    )}
                  </div>
                </div>
              )}

              {/* Start New Call */}
              {!activeCallId && (
                <div className="space-y-4">
                  <p className="text-slate-600 text-sm">Schedule or start a video call with your mentors. Calls are saved to your database.</p>
                  <div className="space-y-2">
                    {mentors.map((mentor) => (
                      <div key={mentor.id} className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{mentor.name}</div>
                            <div className="text-xs text-slate-600">{mentor.role}</div>
                          </div>
                          <button
                            onClick={() => handleStartCall(mentor.id, mentor.name)}
                            className="px-4 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 text-sm"
                          >
                            Call
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Floating Active Call Indicator */}
        {activeCallId && (
          <div className="fixed bottom-6 right-6 bg-gradient-to-br from-rose-500 to-pink-600 text-white p-4 rounded-2xl shadow-2xl z-50 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <Video className="w-6 h-6" />
              </div>
              <div>
                <div className="font-bold text-sm">Call in Progress</div>
                <div className="text-xs opacity-90">{formatDuration(callDuration)}</div>
              </div>
              <button
                onClick={() => setShowFeatureModal('mentor-call')}
                className="ml-2 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-medium"
              >
                View
              </button>
            </div>
          </div>
        )}

        {/* Text Meme Input Modal */}
        {showTextMemeModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">Share Text Meme</h3>
                <button 
                  onClick={() => {
                    setShowTextMemeModal(false)
                    setTextMemeInput('')
                  }} 
                  className="p-2 hover:bg-slate-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <textarea
                  value={textMemeInput}
                  onChange={(e) => setTextMemeInput(e.target.value)}
                  placeholder="Enter your meme text..."
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-yellow-500 resize-none bg-white text-slate-900 placeholder-slate-400"
                  rows={4}
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowTextMemeModal(false)
                      setTextMemeInput('')
                    }}
                    className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!textMemeInput.trim()) return
                      
                      setIsSharingMeme(true)
                      try {
                        const userId = getUserId()
                        await axios.post(`${API_URL}/api/memes/share?user_id=${userId}`, {
                          content_type: 'text',
                          content: textMemeInput.trim(),
                          caption: 'Text meme'
                        })
                        setShowTextMemeModal(false)
                        setTextMemeInput('')
                        alert('✅ Text meme shared successfully!')
                        // Refresh feed if open
                        if (showMemeFeed) {
                          const response = await axios.get(`${API_URL}/api/memes/feed?user_id=${userId}`)
                          setMemeFeed(response.data)
                        }
                      } catch (error: any) {
                        console.error('Error sharing meme:', error)
                        alert(error.response?.data?.detail || 'Failed to share meme. Please try again.')
                      } finally {
                        setIsSharingMeme(false)
                      }
                    }}
                    disabled={!textMemeInput.trim() || isSharingMeme}
                    className="flex-1 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSharingMeme ? 'Sharing...' : 'Share'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  )
}

export default function PitStopView() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 p-8 flex items-center justify-center">Loading...</div>}>
      <PitStopContent />
    </Suspense>
  )
}
