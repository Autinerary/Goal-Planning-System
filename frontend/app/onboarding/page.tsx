'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'
import { 
  User, Check, ChevronRight, ChevronLeft, Loader2,
  Target, Sparkles, Heart, Zap, AlertCircle
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// Step components
const steps = [
  { id: 'barriers', title: 'Your Barriers', icon: AlertCircle },
  { id: 'goals', title: 'Your Goals', icon: Target },
  { id: 'dreams', title: 'Your Dreams', icon: Sparkles },
  { id: 'challenges', title: 'Current Challenges', icon: Heart },
  { id: 'motivation', title: 'Motivation Style', icon: Zap },
]

const barrierCategories = [
  {
    name: 'Neurodivergence',
    items: ['Autism', 'ADHD', 'OCD', 'Bipolar Disorder', 'Dyslexia', 'Anxiety', 'Depression']
  },
  {
    name: 'Physical & Sensory',
    items: ['Sensory Impairment', 'Physical Impairment', 'Chronic Illness', 'Chronic Pain']
  },
  {
    name: 'Social & Cultural',
    items: ['Visible Minority', 'Language Barrier', 'First Generation', 'Gender', 'LGBTQ+', 'Religious Minority']
  },
  {
    name: 'Economic & Access',
    items: ['Limited Income', 'Food Insecurity', 'Housing Instability', 'Limited Technology Access']
  },
]

const motivationOptions = [
  { 
    value: 'intrinsic', 
    label: 'Intrinsic', 
    description: 'Driven by personal satisfaction and internal goals',
    emoji: '🧠'
  },
  { 
    value: 'achievement', 
    label: 'Achievement', 
    description: 'Motivated by accomplishments and milestones',
    emoji: '🏆'
  },
  { 
    value: 'social', 
    label: 'Social Connection', 
    description: 'Energized by community and relationships',
    emoji: '👥'
  },
  { 
    value: 'reward', 
    label: 'Reward-Based', 
    description: 'Responds well to incentives and treats',
    emoji: '🎁'
  },
  { 
    value: 'deadline', 
    label: 'Deadline-Driven', 
    description: 'Works best with time pressure',
    emoji: '⏰'
  },
  { 
    value: 'curiosity', 
    label: 'Curiosity', 
    description: 'Motivated by learning and discovery',
    emoji: '🔍'
  },
]

export default function OnboardingPage() {
  const router = useRouter()
  const { user, completeOnboarding, isLoading: authLoading } = useAuth()
  const [currentStep, setCurrentStep] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const [formData, setFormData] = useState({
    barrierTypes: [] as string[],
    goals: [''],
    dreams: [''],
    currentChallenges: [''],
    motivationType: ''
  })

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/signup')
    }
  }, [user, authLoading, router])

  const handleBarrierToggle = (barrier: string) => {
    setFormData(prev => ({
      ...prev,
      barrierTypes: prev.barrierTypes.includes(barrier)
        ? prev.barrierTypes.filter(b => b !== barrier)
        : [...prev.barrierTypes, barrier]
    }))
  }

  const updateArrayField = (field: 'goals' | 'dreams' | 'currentChallenges', index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].map((item, i) => i === index ? value : item)
    }))
  }

  const addArrayItem = (field: 'goals' | 'dreams' | 'currentChallenges') => {
    setFormData(prev => ({
      ...prev,
      [field]: [...prev[field], '']
    }))
  }

  const removeArrayItem = (field: 'goals' | 'dreams' | 'currentChallenges', index: number) => {
    if (formData[field].length > 1) {
      setFormData(prev => ({
        ...prev,
        [field]: prev[field].filter((_, i) => i !== index)
      }))
    }
  }

  const canProceed = () => {
    switch (currentStep) {
      case 0: return formData.barrierTypes.length > 0
      case 1: return formData.goals.some(g => g.trim())
      case 2: return formData.dreams.some(d => d.trim())
      case 3: return formData.currentChallenges.some(c => c.trim())
      case 4: return formData.motivationType !== ''
      default: return false
    }
  }

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }

  const handleSubmit = async () => {
    if (!user) return
    
    setIsSubmitting(true)
    try {
      const response = await axios.post(`${API_URL}/api/onboarding/`, {
        email: user.email,
        barrierTypes: formData.barrierTypes,
        goals: formData.goals.filter(g => g.trim()),
        dreams: formData.dreams.filter(d => d.trim()),
        currentChallenges: formData.currentChallenges.filter(c => c.trim()),
        motivationType: formData.motivationType
      })

      completeOnboarding(response.data.pathId)
      router.push('/path')
    } catch (error) {
      console.error('Error creating path:', error)
      alert('Error creating your path. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4 md:p-8">
      {/* Background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">
            Welcome{user?.name ? `, ${user.name}` : ''}! 👋
          </h1>
          <p className="text-slate-400">Let's build your personalized path to success</p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-between mb-8 relative">
          {/* Progress Line */}
          <div className="absolute top-5 left-0 right-0 h-0.5 bg-slate-700">
            <div 
              className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-500"
              style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
            />
          </div>
          
          {steps.map((step, idx) => {
            const Icon = step.icon
            const isActive = idx === currentStep
            const isCompleted = idx < currentStep
            
            return (
              <div key={step.id} className="relative flex flex-col items-center">
                <div 
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all z-10 ${
                    isActive 
                      ? 'bg-gradient-to-r from-cyan-500 to-purple-500 scale-110' 
                      : isCompleted 
                        ? 'bg-green-500' 
                        : 'bg-slate-700'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                <span className={`text-xs mt-2 hidden md:block ${isActive ? 'text-white' : 'text-slate-500'}`}>
                  {step.title}
                </span>
              </div>
            )
          })}
        </div>

        {/* Step Content Card */}
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl">
          {/* Step 0: Barriers */}
          {currentStep === 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-2">What barriers do you face?</h2>
              <p className="text-slate-400 mb-6">Select all that apply. This helps us find strategies that worked for people like you.</p>
              
              <div className="space-y-6">
                {barrierCategories.map((category) => (
                  <div key={category.name}>
                    <h3 className="text-sm font-medium text-slate-400 mb-3">{category.name}</h3>
                    <div className="flex flex-wrap gap-2">
                      {category.items.map((barrier) => (
                        <button
                          key={barrier}
                          onClick={() => handleBarrierToggle(barrier)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            formData.barrierTypes.includes(barrier)
                              ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white'
                              : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10'
                          }`}
                        >
                          {formData.barrierTypes.includes(barrier) && <Check className="w-4 h-4 inline mr-1" />}
                          {barrier}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 1: Goals */}
          {currentStep === 1 && (
            <div>
              <h2 className="text-2xl font-bold mb-2">What are your goals?</h2>
              <p className="text-slate-400 mb-6">What do you want to achieve? Be specific!</p>
              
              <div className="space-y-3">
                {formData.goals.map((goal, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="text"
                      value={goal}
                      onChange={(e) => updateArrayField('goals', idx, e.target.value)}
                      placeholder={`Goal ${idx + 1} (e.g., "Graduate university", "Get a tech job")`}
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    {formData.goals.length > 1 && (
                      <button
                        onClick={() => removeArrayItem('goals', idx)}
                        className="px-3 text-slate-400 hover:text-red-400"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => addArrayItem('goals')}
                  className="text-cyan-400 hover:text-cyan-300 text-sm font-medium"
                >
                  + Add another goal
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Dreams */}
          {currentStep === 2 && (
            <div>
              <h2 className="text-2xl font-bold mb-2">What are your dreams?</h2>
              <p className="text-slate-400 mb-6">Think bigger! Where do you see yourself in 5-10 years?</p>
              
              <div className="space-y-3">
                {formData.dreams.map((dream, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="text"
                      value={dream}
                      onChange={(e) => updateArrayField('dreams', idx, e.target.value)}
                      placeholder={`Dream ${idx + 1} (e.g., "Lead a team that values neurodiversity")`}
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    {formData.dreams.length > 1 && (
                      <button
                        onClick={() => removeArrayItem('dreams', idx)}
                        className="px-3 text-slate-400 hover:text-red-400"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => addArrayItem('dreams')}
                  className="text-purple-400 hover:text-purple-300 text-sm font-medium"
                >
                  + Add another dream
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Challenges */}
          {currentStep === 3 && (
            <div>
              <h2 className="text-2xl font-bold mb-2">What's currently stopping you?</h2>
              <p className="text-slate-400 mb-6">Be honest about the obstacles you're facing right now.</p>
              
              <div className="space-y-3">
                {formData.currentChallenges.map((challenge, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="text"
                      value={challenge}
                      onChange={(e) => updateArrayField('currentChallenges', idx, e.target.value)}
                      placeholder={`Challenge ${idx + 1} (e.g., "Hard to focus in lectures", "Overwhelmed by group projects")`}
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
                    />
                    {formData.currentChallenges.length > 1 && (
                      <button
                        onClick={() => removeArrayItem('currentChallenges', idx)}
                        className="px-3 text-slate-400 hover:text-red-400"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => addArrayItem('currentChallenges')}
                  className="text-pink-400 hover:text-pink-300 text-sm font-medium"
                >
                  + Add another challenge
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Motivation */}
          {currentStep === 4 && (
            <div>
              <h2 className="text-2xl font-bold mb-2">What motivates you most?</h2>
              <p className="text-slate-400 mb-6">Understanding your motivation style helps us personalize your plan.</p>
              
              <div className="grid gap-3">
                {motivationOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setFormData(prev => ({ ...prev, motivationType: option.value }))}
                    className={`flex items-center gap-4 p-4 rounded-xl text-left transition-all ${
                      formData.motivationType === option.value
                        ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border-2 border-cyan-500'
                        : 'bg-white/5 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <span className="text-2xl">{option.emoji}</span>
                    <div>
                      <div className="font-medium">{option.label}</div>
                      <div className="text-sm text-slate-400">{option.description}</div>
                    </div>
                    {formData.motivationType === option.value && (
                      <Check className="w-5 h-5 text-cyan-400 ml-auto" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t border-white/10">
            <button
              onClick={handleBack}
              disabled={currentStep === 0}
              className="flex items-center gap-2 px-6 py-3 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
              Back
            </button>

            {currentStep < steps.length - 1 ? (
              <button
                onClick={handleNext}
                disabled={!canProceed()}
                className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-xl transition-all"
              >
                Continue
                <ChevronRight className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canProceed() || isSubmitting}
                className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-xl transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating your path...
                  </>
                ) : (
                  <>
                    Generate My Path
                    <Sparkles className="w-5 h-5" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Step indicator for mobile */}
        <div className="text-center mt-4 text-slate-500 text-sm">
          Step {currentStep + 1} of {steps.length}
        </div>
      </div>
    </div>
  )
}
