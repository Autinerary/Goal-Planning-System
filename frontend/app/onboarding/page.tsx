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
const SERVICE_HUB_URL = process.env.NEXT_PUBLIC_SERVICE_HUB_URL || 'http://localhost:3001'

// Step components
const steps = [
  { id: 'role', title: 'Your Role', icon: User },
  { id: 'location', title: 'Location', icon: User },
  { id: 'barriers', title: 'Your Barriers', icon: AlertCircle },
  { id: 'goals', title: 'Your Goals', icon: Target },
  { id: 'dreams', title: 'Your Dreams', icon: Sparkles },
  { id: 'challenges', title: 'Current Challenges', icon: Heart },
  { id: 'motivation', title: 'Motivation Style', icon: Zap },
  { id: 'recommendations', title: 'AI Recommendations', icon: Sparkles },
]

const roles = [
  { id: 'self_advocate', label: 'Self-Advocate', description: 'Person with lived experience', icon: '👤' },
  { id: 'parent', label: 'Parent/Family', description: 'Parent or family member', icon: '👨‍👩‍👧‍👦' },
  { id: 'caregiver', label: 'Caregiver', description: 'Professional or family caregiver', icon: '🤝' },
  { id: 'professional', label: 'Professional', description: 'Therapist, educator, researcher', icon: '💼' },
]

const lifeStages = [
  { id: 'preschool', label: 'Preschool' },
  { id: 'school_age', label: 'School-age' },
  { id: 'university', label: 'University' },
  { id: 'employment', label: 'Employment' },
  { id: 'retirement', label: 'Retirement' },
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
    role: '' as string,
    location: {
      city: '',
      province: '',
      country: ''
    },
    lifeStage: '' as string,
    barrierTypes: [] as string[],
    goals: [''],
    dreams: [''],
    currentChallenges: [''],
    motivationType: ''
  })
  
  const [recommendations, setRecommendations] = useState<any[]>([])
  const [savedResources, setSavedResources] = useState<Set<string>>(new Set())
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false)
  const [recommendationExplanation, setRecommendationExplanation] = useState('')

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
      case 0: return formData.role !== ''
      case 1: return formData.location.city.trim() !== '' && formData.location.province.trim() !== '' && formData.location.country.trim() !== ''
      case 2: return formData.barrierTypes.length > 0
      case 3: return formData.goals.some(g => g.trim())
      case 4: return formData.dreams.some(d => d.trim())
      case 5: return formData.currentChallenges.some(c => c.trim())
      case 6: return formData.motivationType !== '' && formData.lifeStage !== ''
      case 7: return true // Recommendations step - can always proceed (optional to save)
      default: return false
    }
  }
  
  // Fetch AI recommendations when reaching the recommendations step
  useEffect(() => {
    if (currentStep === 7 && recommendations.length === 0 && !isLoadingRecommendations) {
      fetchRecommendations()
    }
  }, [currentStep])
  
  const fetchRecommendations = async () => {
    setIsLoadingRecommendations(true)
    try {
      const serviceHubBarriers = mapBarriersToServiceHub(formData.barrierTypes)
      
      const serviceHubResponse = await axios.post(`${SERVICE_HUB_URL}/api/onboarding/complete`, {
        role: formData.role,
        location: formData.location,
        barriers: serviceHubBarriers,
        lifeStage: formData.lifeStage,
        goals: formData.goals.filter(g => g.trim()),
        culturalNotes: '',
        additionalNotes: formData.currentChallenges.filter(c => c.trim()).join('; ')
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
        validateStatus: () => true // Don't throw on any status
      })

      if (serviceHubResponse.status === 200 && serviceHubResponse.data.recommendations) {
        setRecommendations(serviceHubResponse.data.recommendations || [])
        setRecommendationExplanation(serviceHubResponse.data.recommendationExplanation || '')
      } else {
        // Fallback: show empty state with message
        setRecommendations([])
        setRecommendationExplanation('Recommendations will be available after you sign in to ServiceHub.')
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error)
      setRecommendations([])
      setRecommendationExplanation('Unable to load recommendations at this time.')
    } finally {
      setIsLoadingRecommendations(false)
    }
  }
  
  const handleSaveResource = async (resourceId: string) => {
    // Toggle save state
    if (savedResources.has(resourceId)) {
      setSavedResources(prev => {
        const next = new Set(prev)
        next.delete(resourceId)
        return next
      })
      
      // Try to unsave from ServiceHub if authenticated
      try {
        await axios.delete(`${SERVICE_HUB_URL}/api/resources/${resourceId}/save`, {
          validateStatus: () => true
        })
      } catch (error) {
        // Silent fail
      }
    } else {
      setSavedResources(prev => new Set([...prev, resourceId]))
      
      // Try to save to ServiceHub if user is authenticated
      // Since both apps now use Supabase Auth, the user should be authenticated
      try {
        const response = await axios.post(`${SERVICE_HUB_URL}/api/resources/${resourceId}/save`, {}, {
          validateStatus: () => true
        })
        
        if (response.status === 200 || response.status === 201) {
          console.log('Resource saved to ServiceHub')
        } else if (response.status === 401) {
          // User not authenticated in ServiceHub - will save after sign-in
          console.log('Resource will be saved after ServiceHub sign-in')
        }
      } catch (error) {
        // Silent fail - will be saved when user signs into ServiceHub
        console.log('Resource will be saved after ServiceHub sign-in')
      }
    }
  }

  // Map Goal Planning barriers to ServiceHub format
  const mapBarriersToServiceHub = (barriers: string[]) => {
    const barrierMap: Record<string, { id: string; category: string; categoryLabel: string }> = {
      'Autism': { id: 'autism', category: 'neurodivergence', categoryLabel: 'Neurodivergence' },
      'ADHD': { id: 'adhd', category: 'neurodivergence', categoryLabel: 'Neurodivergence' },
      'OCD': { id: 'ocd', category: 'neurodivergence', categoryLabel: 'Neurodivergence' },
      'Bipolar Disorder': { id: 'bipolar', category: 'neurodivergence', categoryLabel: 'Neurodivergence' },
      'Dyslexia': { id: 'neurodivergence_other', category: 'neurodivergence', categoryLabel: 'Neurodivergence' },
      'Anxiety': { id: 'mental_health', category: 'health', categoryLabel: 'Health' },
      'Depression': { id: 'mental_health', category: 'health', categoryLabel: 'Health' },
      'Sensory Impairment': { id: 'sensory_deaf', category: 'disability', categoryLabel: 'Non-Neurodivergent Disabilities' },
      'Physical Impairment': { id: 'physical_mobility', category: 'disability', categoryLabel: 'Non-Neurodivergent Disabilities' },
      'Chronic Illness': { id: 'chronic_health', category: 'health', categoryLabel: 'Health' },
      'Chronic Pain': { id: 'chronic_health', category: 'health', categoryLabel: 'Health' },
      'Visible Minority': { id: 'race_visible_minority', category: 'identity', categoryLabel: 'Identity & Background' },
      'Language Barrier': { id: 'language', category: 'identity', categoryLabel: 'Identity & Background' },
      'First Generation': { id: 'ethnicity', category: 'identity', categoryLabel: 'Identity & Background' },
      'Gender': { id: 'gender', category: 'identity', categoryLabel: 'Identity & Background' },
      'LGBTQ+': { id: 'lgbtq', category: 'identity', categoryLabel: 'Identity & Background' },
      'Religious Minority': { id: 'ethnicity', category: 'identity', categoryLabel: 'Identity & Background' },
      'Limited Income': { id: 'socioeconomic', category: 'identity', categoryLabel: 'Identity & Background' },
      'Food Insecurity': { id: 'socioeconomic', category: 'identity', categoryLabel: 'Identity & Background' },
      'Housing Instability': { id: 'socioeconomic', category: 'identity', categoryLabel: 'Identity & Background' },
      'Limited Technology Access': { id: 'socioeconomic', category: 'identity', categoryLabel: 'Identity & Background' },
    }

    return barriers.map(barrier => {
      const mapped = barrierMap[barrier] || { id: 'neurodivergence_other', category: 'neurodivergence', categoryLabel: 'Neurodivergence' }
      return {
        id: mapped.id,
        label: barrier,
        category: mapped.category,
        categoryLabel: mapped.categoryLabel,
        severity: 3, // Default severity
        notes: null
      }
    })
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
      // Send to Goal Planning backend
      const response = await axios.post(`${API_URL}/api/onboarding/`, {
        email: user.email,
        barrierTypes: formData.barrierTypes,
        goals: formData.goals.filter(g => g.trim()),
        dreams: formData.dreams.filter(d => d.trim()),
        currentChallenges: formData.currentChallenges.filter(c => c.trim()),
        motivationType: formData.motivationType
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 second timeout
      })

      // Save saved resources to ServiceHub if user is authenticated
      // Since both apps use Supabase Auth, try to save directly
      if (savedResources.size > 0) {
        const resourcesToSave = Array.from(savedResources)
        
        // Try to save each resource to ServiceHub
        for (const resourceId of resourcesToSave) {
          try {
            await axios.post(`${SERVICE_HUB_URL}/api/resources/${resourceId}/save`, {}, {
              validateStatus: () => true
            })
          } catch (error) {
            // If save fails, store in localStorage for later sync
            const pendingResources = JSON.parse(localStorage.getItem('pendingSavedResources') || '[]')
            if (!pendingResources.includes(resourceId)) {
              pendingResources.push(resourceId)
              localStorage.setItem('pendingSavedResources', JSON.stringify(pendingResources))
            }
          }
        }
      }

      // Note: ServiceHub sync already happened in step 7 (recommendations step)
      // We don't need to sync onboarding data again here

      // Check if response has pathId
      if (!response.data || !response.data.pathId) {
        throw new Error('Invalid response from server: missing pathId')
      }

      await completeOnboarding(response.data.pathId)
      router.push('/onboarding-confirmation')
    } catch (error: any) {
      console.error('Error creating path:', error)
      console.error('Error details:', {
        message: error?.message,
        response: error?.response?.data,
        status: error?.response?.status,
        API_URL
      })
      
      // More detailed error handling
      let errorMessage = 'Error creating your path. Please try again.'
      
      if (error?.response) {
        // Server responded with error
        errorMessage = error.response.data?.detail || error.response.data?.message || `Server error: ${error.response.status}`
      } else if (error?.request) {
        // Request made but no response (network error)
        errorMessage = `Cannot connect to server at ${API_URL}. Please check if the backend is running.`
      } else if (error?.message) {
        // Other error
        errorMessage = error.message
      }
      
      alert(errorMessage)
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
          {/* Step 0: Role */}
          {currentStep === 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-2">Tell us about yourself</h2>
              <p className="text-slate-400 mb-6">Your role helps us personalize your experience.</p>
              
              <div className="grid gap-3">
                {roles.map((role) => (
                  <button
                    key={role.id}
                    onClick={() => setFormData(prev => ({ ...prev, role: role.id }))}
                    className={`flex items-center gap-4 p-4 rounded-xl text-left transition-all ${
                      formData.role === role.id
                        ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border-2 border-cyan-500'
                        : 'bg-white/5 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <span className="text-2xl">{role.icon}</span>
                    <div className="flex-1">
                      <div className="font-medium">{role.label}</div>
                      <div className="text-sm text-slate-400">{role.description}</div>
                    </div>
                    {formData.role === role.id && (
                      <Check className="w-5 h-5 text-cyan-400" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 1: Location */}
          {currentStep === 1 && (
            <div>
              <h2 className="text-2xl font-bold mb-2">Where are you located?</h2>
              <p className="text-slate-400 mb-6">This helps us find resources in your area. All location data is private and optional.</p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">City *</label>
                  <input
                    type="text"
                    value={formData.location.city}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: { ...prev.location, city: e.target.value } }))}
                    placeholder="e.g., Toronto"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Province/State *</label>
                  <input
                    type="text"
                    value={formData.location.province}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: { ...prev.location, province: e.target.value } }))}
                    placeholder="e.g., Ontario"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Country *</label>
                  <input
                    type="text"
                    value={formData.location.country}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: { ...prev.location, country: e.target.value } }))}
                    placeholder="e.g., Canada"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Barriers */}
          {currentStep === 2 && (
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

          {/* Step 3: Goals */}
          {currentStep === 3 && (
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

          {/* Step 4: Dreams */}
          {currentStep === 4 && (
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

          {/* Step 5: Challenges */}
          {currentStep === 5 && (
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

          {/* Step 6: Motivation & Life Stage */}
          {currentStep === 6 && (
            <div className="space-y-6">
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

              <div className="pt-6 border-t border-white/10">
                <h2 className="text-2xl font-bold mb-2">What's your current life stage?</h2>
                <p className="text-slate-400 mb-6">This helps us match you with relevant resources.</p>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {lifeStages.map((stage) => (
                    <button
                      key={stage.id}
                      onClick={() => setFormData(prev => ({ ...prev, lifeStage: stage.id }))}
                      className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                        formData.lifeStage === stage.id
                          ? 'border-cyan-500 bg-cyan-500/20 text-white'
                          : 'border-white/10 hover:border-cyan-500/50 text-slate-300'
                      }`}
                    >
                      {stage.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 7: AI Recommendations */}
          {currentStep === 7 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-6 h-6 text-cyan-400" />
                <h2 className="text-2xl font-bold">AI-Recommended Services</h2>
              </div>
              <p className="text-slate-400 mb-4">
                Based on your profile, we've found resources that may help you achieve your goals. 
                Save any that interest you to access them later in ServiceHub.
              </p>
              
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-6">
                <p className="text-sm text-blue-300">
                  💡 <strong>Note:</strong> To save resources permanently and access "My Resources" in ServiceHub, 
                  you'll need to sign in to ServiceHub with the same email. Your saved selections will be synced automatically.
                </p>
              </div>

              {isLoadingRecommendations ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mb-4" />
                  <p className="text-slate-400">Generating personalized recommendations...</p>
                </div>
              ) : recommendations.length === 0 ? (
                <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
                  <Sparkles className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                  <p className="text-slate-300 mb-2">No recommendations available yet</p>
                  <p className="text-sm text-slate-500">
                    {recommendationExplanation || 'Sign in to ServiceHub to get personalized recommendations based on your profile.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recommendationExplanation && (
                    <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4 mb-4">
                      <p className="text-sm text-cyan-300">{recommendationExplanation}</p>
                    </div>
                  )}
                  
                  <div className="grid gap-4 max-h-[500px] overflow-y-auto pr-2">
                    {recommendations.map((resource) => (
                      <div
                        key={resource.id}
                        className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-lg">{resource.name}</h3>
                              {resource.category && (
                                <span className="px-2 py-1 text-xs bg-cyan-500/20 text-cyan-300 rounded">
                                  {resource.category}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-slate-400 mb-2 line-clamp-2">
                              {resource.description}
                            </p>
                            {resource.location && (
                              <p className="text-xs text-slate-500 mb-2">
                                📍 {resource.location.city}, {resource.location.province}
                              </p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-slate-500">
                              {resource.averageRating > 0 && (
                                <span>⭐ {resource.averageRating.toFixed(1)} ({resource.ratingCount} reviews)</span>
                              )}
                              {resource.score > 0 && (
                                <span className="text-cyan-400">{resource.score}% match</span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleSaveResource(resource.id)}
                            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                              savedResources.has(resource.id)
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10'
                            }`}
                          >
                            {savedResources.has(resource.id) ? (
                              <>
                                <Check className="w-4 h-4 inline mr-1" />
                                Saved
                              </>
                            ) : (
                              'Save'
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mt-4">
                    <p className="text-sm text-blue-300">
                      💡 <strong>Tip:</strong> You can always find these resources later in ServiceHub's "My Resources" section. 
                      You can also recommend new resources to help others in the community.
                    </p>
                  </div>
                </div>
              )}
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
                {currentStep === 6 ? 'View Recommendations' : 'Continue'}
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
                    Continue to Role Models & Mentors
                    <ChevronRight className="w-5 h-5" />
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
