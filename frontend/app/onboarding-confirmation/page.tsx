'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Sparkles, Users, UserCheck, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react'
import AgentInsightsBanner from '../components/AgentInsightsBanner'
import { useAgentPath } from '../context/AgentPathContext'

interface RoleModelMilestone {
  id: string
  name: string
  description: string
  resources: { id: string; name: string; type: string }[]
}

interface RoleModel {
  id: string
  name: string
  role: string
  description: string
  category: string
  milestones: RoleModelMilestone[]
}

interface Mentor {
  id: string
  name: string
  role: string
  description: string
  barrierCategory: string
  raceCategory: string
}

// Mock role models with milestones & resources
const mockRoleModels: RoleModel[] = [
  {
    id: 'rm1', name: 'Sarah Chen', role: 'Software Engineer', category: 'Professional',
    description: 'Autistic professional who graduated university and now works at a tech company',
    milestones: [
      { id: 'rm1-m1', name: 'Get diagnosed & build support network', description: 'Formal assessment and connecting with advocacy groups', resources: [
        { id: 'r1', name: 'Autism Self-Advocacy Network', type: 'Organization' },
        { id: 'r2', name: 'Workplace Disclosure Guide', type: 'Guide' },
      ]},
      { id: 'rm1-m2', name: 'Complete post-secondary education', description: 'University degree with accommodations', resources: [
        { id: 'r3', name: 'Disability Services Office', type: 'Service' },
        { id: 'r4', name: 'Assistive Tech for Students', type: 'Tool' },
      ]},
      { id: 'rm1-m3', name: 'Land first tech role', description: 'Interview prep and workplace accommodations', resources: [
        { id: 'r5', name: 'Neurodivergent Job Board', type: 'Platform' },
        { id: 'r6', name: 'Interview Skills Workshop', type: 'Workshop' },
      ]},
    ],
  },
  {
    id: 'rm2', name: 'Marcus Johnson', role: 'Entrepreneur', category: 'Entrepreneur',
    description: 'ADHD entrepreneur who built a successful business',
    milestones: [
      { id: 'rm2-m1', name: 'Develop coping strategies', description: 'Executive function coaching and routines', resources: [
        { id: 'r7', name: 'ADHD Coaching Program', type: 'Service' },
        { id: 'r8', name: 'Focus & Productivity Toolkit', type: 'Tool' },
      ]},
      { id: 'rm2-m2', name: 'Validate business idea', description: 'Market research and MVP launch', resources: [
        { id: 'r9', name: 'Startup Incubator for ND Founders', type: 'Program' },
        { id: 'r10', name: 'Business Plan Template', type: 'Template' },
      ]},
      { id: 'rm2-m3', name: 'Scale and sustain', description: 'Grow while managing ADHD challenges', resources: [
        { id: 'r11', name: 'Peer Mentorship Network', type: 'Community' },
        { id: 'r12', name: 'Delegation & Systems Guide', type: 'Guide' },
      ]},
    ],
  },
  {
    id: 'rm3', name: 'Dr. Emily Rodriguez', role: 'Researcher', category: 'Academic',
    description: 'Neurodivergent researcher who completed PhD',
    milestones: [
      { id: 'rm3-m1', name: 'Secure academic accommodations', description: 'Work with disability office and advisors', resources: [
        { id: 'r13', name: 'Graduate Student Accommodation Guide', type: 'Guide' },
        { id: 'r14', name: 'Academic Writing Support', type: 'Service' },
      ]},
      { id: 'rm3-m2', name: 'Complete PhD program', description: 'Research, thesis defense, and graduation', resources: [
        { id: 'r15', name: 'ND Researchers Network', type: 'Community' },
        { id: 'r16', name: 'Thesis Writing Bootcamp', type: 'Program' },
      ]},
      { id: 'rm3-m3', name: 'Publish and present research', description: 'Conferences and peer-reviewed publications', resources: [
        { id: 'r17', name: 'Academic Conference Prep', type: 'Workshop' },
        { id: 'r18', name: 'Research Grant Database', type: 'Platform' },
      ]},
    ],
  },
]

// Mock mentors categorized by barrier & race category
const mockMentors: Mentor[] = [
  { id: 'm1', name: 'James Wilson', role: 'Career Coach', description: 'Specializes in helping neurodivergent individuals navigate careers', barrierCategory: 'Neurodivergence', raceCategory: 'Workplace' },
  { id: 'm2', name: 'Lisa Park', role: 'Academic Advisor', description: 'Experienced in supporting students with accommodations', barrierCategory: 'Neurodivergence', raceCategory: 'Education' },
  { id: 'm3', name: 'David Thompson', role: 'Life Coach', description: 'Focuses on executive function and daily living skills', barrierCategory: 'Neurodivergence', raceCategory: 'Workplace' },
  { id: 'm4', name: 'Aisha Okafor', role: 'Accessibility Specialist', description: 'Helps navigate physical and sensory accommodations in schools', barrierCategory: 'Physical & Sensory', raceCategory: 'Education' },
  { id: 'm5', name: 'Carlos Mendez', role: 'Vocational Rehab Counselor', description: 'Assists with workplace modifications and job placement for physical disabilities', barrierCategory: 'Physical & Sensory', raceCategory: 'Workplace' },
  { id: 'm6', name: 'Priya Sharma', role: 'Student Success Coach', description: 'Supports first-generation and minority students through post-secondary', barrierCategory: 'Social & Cultural', raceCategory: 'Education' },
  { id: 'm7', name: 'Marcus Lee', role: 'DEI Workplace Consultant', description: 'Helps navigate cultural barriers and bias in professional settings', barrierCategory: 'Social & Cultural', raceCategory: 'Workplace' },
]

// Group mentors by barrier category, then by race category within each
function groupMentors(mentors: Mentor[]) {
  const byBarrier: Record<string, Record<string, Mentor[]>> = {}
  mentors.forEach(m => {
    if (!byBarrier[m.barrierCategory]) byBarrier[m.barrierCategory] = {}
    if (!byBarrier[m.barrierCategory][m.raceCategory]) byBarrier[m.barrierCategory][m.raceCategory] = []
    byBarrier[m.barrierCategory][m.raceCategory].push(m)
  })
  return byBarrier
}

export default function OnboardingConfirmationPage() {
  const router = useRouter()
  const { payload, patternRecognition, pathPlanning } = useAgentPath()
  const [currentStep, setCurrentStep] = useState<'roleModels' | 'mentors'>('roleModels')
  const [roleModelChoices, setRoleModelChoices] = useState<Record<string, string>>({})
  const [selectedMentors, setSelectedMentors] = useState<Record<string, boolean>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Milestone & resource selection per role model
  const [expandedRoleModel, setExpandedRoleModel] = useState<string | null>(null)
  const [expandedMilestone, setExpandedMilestone] = useState<string | null>(null)
  const [selectedMilestones, setSelectedMilestones] = useState<Record<string, boolean>>({})
  const [selectedResources, setSelectedResources] = useState<Record<string, boolean>>({})

  const handleRoleModelChoice = (roleModelId: string, choice: string) => {
    setRoleModelChoices(prev => ({
      ...prev,
      [roleModelId]: choice
    }))
    // When choosing customize/follow, auto-expand their milestones
    if (choice === 'follow' || choice === 'customize') {
      setExpandedRoleModel(roleModelId)
      // Auto-select all milestones & resources for "follow"
      if (choice === 'follow') {
        const rm = mockRoleModels.find(r => r.id === roleModelId)
        if (rm) {
          const newMilestones = { ...selectedMilestones }
          const newResources = { ...selectedResources }
          rm.milestones.forEach(m => {
            newMilestones[m.id] = true
            m.resources.forEach(r => { newResources[r.id] = true })
          })
          setSelectedMilestones(newMilestones)
          setSelectedResources(newResources)
        }
      }
    } else {
      // Collapse and deselect if "adjust" or "none"
      if (expandedRoleModel === roleModelId) setExpandedRoleModel(null)
      const rm = mockRoleModels.find(r => r.id === roleModelId)
      if (rm && choice === 'none') {
        const newMilestones = { ...selectedMilestones }
        const newResources = { ...selectedResources }
        rm.milestones.forEach(m => {
          delete newMilestones[m.id]
          m.resources.forEach(r => { delete newResources[r.id] })
        })
        setSelectedMilestones(newMilestones)
        setSelectedResources(newResources)
      }
    }
  }

  const toggleMilestone = (milestoneId: string, rm: RoleModel) => {
    const newVal = !selectedMilestones[milestoneId]
    setSelectedMilestones(prev => ({ ...prev, [milestoneId]: newVal }))
    // Also toggle all resources under this milestone
    const milestone = rm.milestones.find(m => m.id === milestoneId)
    if (milestone) {
      const newResources = { ...selectedResources }
      milestone.resources.forEach(r => { newResources[r.id] = newVal })
      setSelectedResources(newResources)
    }
  }

  const toggleResource = (resourceId: string) => {
    setSelectedResources(prev => ({ ...prev, [resourceId]: !prev[resourceId] }))
  }

  const handleMentorToggle = (mentorId: string) => {
    setSelectedMentors(prev => ({
      ...prev,
      [mentorId]: !prev[mentorId]
    }))
  }

  const handleSelectAllMentors = () => {
    const allSelected = mockMentors.every(m => selectedMentors[m.id])
    if (allSelected) {
      setSelectedMentors({})
    } else {
      const all: Record<string, boolean> = {}
      mockMentors.forEach(m => { all[m.id] = true })
      setSelectedMentors(all)
    }
  }

  const handleNext = () => {
    if (currentStep === 'roleModels') {
      setCurrentStep('mentors')
    }
  }

  const handleBack = () => {
    if (currentStep === 'mentors') {
      setCurrentStep('roleModels')
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    // In production, save choices to backend
    await new Promise(resolve => setTimeout(resolve, 1000))
    router.push('/path')
  }

  const canProceed = () => {
    if (currentStep === 'roleModels') {
      // At least one role model should have a choice
      return Object.keys(roleModelChoices).length > 0
    } else {
      // Can proceed even if no mentors selected
      return true
    }
  }

  return (
    <div className="min-h-screen text-slate-900 p-4 md:p-8">
      <div className="max-w-3xl mx-auto mb-4 space-y-3">
        <AgentInsightsBanner agent="pattern_recognition" />
        <AgentInsightsBanner agent="tool_recommendation" />
      </div>
      {/* Background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Confirmation
          </h1>
          <p className="text-slate-600">Let's connect you with role models and mentors</p>
        </div>

        {/* Personalised plan summary — straight from the agents */}
        {(() => {
          const goals: string[] = (payload?.userProfile?.goals || []) as string[]
          const barriers: string[] = (payload?.userProfile?.barrierTypes || []) as string[]
          const firstMilestone = pathPlanning?.milestones?.[0]?.name
          if (!goals.length && !firstMilestone) return null
          return (
            <div className="bg-white/60 backdrop-blur-lg border border-slate-300 rounded-2xl p-5 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-purple-600" />
                <h2 className="font-bold text-slate-900">Your personalised plan</h2>
              </div>
              {goals.length > 0 && (
                <div className="text-sm text-slate-700 mb-1"><span className="font-semibold">Goals: </span>{goals.join(' · ')}</div>
              )}
              {barriers.length > 0 && (
                <div className="text-sm text-slate-700 mb-1"><span className="font-semibold">Barriers: </span>{barriers.join(' · ')}</div>
              )}
              {firstMilestone && (
                <div className="text-sm text-slate-700 mb-1"><span className="font-semibold">First milestone: </span>{firstMilestone}</div>
              )}
            </div>
          )
        })()}

        {/* Step Content Card */}
        <div className="bg-white/60 backdrop-blur-lg border border-slate-300 rounded-2xl p-6 md:p-8 shadow-2xl">
          {/* Step 1: Role Models */}
          {currentStep === 'roleModels' && (
            <div>
              <div className="flex items-center gap-2 mb-6">
                <Users className="w-6 h-6 text-blue-600" />
                <h2 className="text-2xl font-bold text-slate-900">Role Model Selection</h2>
              </div>
              
              <p className="text-slate-700 mb-6">
                We identified role models with similar barriers and goals. Explore their paths and pick what fits you.
              </p>

              <div className="space-y-4 mb-6">
                {mockRoleModels.map((rm) => (
                  <div 
                    key={rm.id} 
                    className="bg-white/60 border border-slate-300 rounded-xl p-4"
                  >
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center text-xl font-bold text-white">
                        {rm.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg text-slate-900">{rm.name}</h3>
                        <p className="text-sm text-slate-600">{rm.role}</p>
                        <p className="text-sm text-slate-700 mt-1">{rm.description}</p>
                        <span className="inline-block mt-2 px-2 py-1 text-xs bg-cyan-500/20 text-blue-600 rounded">
                          {rm.category}
                        </span>
                      </div>
                    </div>

                    <p className="text-slate-700 mb-3 font-medium">Would you like us to:</p>
                    
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {[
                        { value: 'adjust', label: 'Adjust your path according to theirs' },
                        { value: 'follow', label: 'Follow EXACTLY their path' },
                        { value: 'customize', label: 'Customize further' },
                        { value: 'none', label: 'None' },
                      ].map((option) => (
                        <button
                          key={option.value}
                          onClick={() => handleRoleModelChoice(rm.id, option.value)}
                          className={`p-3 rounded-lg text-left text-sm transition-all ${
                            roleModelChoices[rm.id] === option.value
                              ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border-2 border-cyan-500 text-slate-900'
                              : 'bg-white/60 border border-slate-300 hover:bg-white/80 text-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {roleModelChoices[rm.id] === option.value && (
                              <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
                            )}
                            <span>{option.label}</span>
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Expandable milestone dropdown */}
                    <button
                      onClick={() => setExpandedRoleModel(expandedRoleModel === rm.id ? null : rm.id)}
                      className="flex items-center gap-2 w-full text-left text-sm font-medium text-blue-600 hover:text-blue-700 py-2 transition-colors"
                    >
                      {expandedRoleModel === rm.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      View their milestones ({rm.milestones.length})
                    </button>

                    {expandedRoleModel === rm.id && (
                      <div className="mt-2 space-y-2 border-t border-slate-200 pt-3">
                        {rm.milestones.map((milestone, mIdx) => (
                          <div key={milestone.id} className="rounded-lg border border-slate-200 overflow-hidden">
                            {/* Milestone row */}
                            <div className="flex items-center gap-3 p-3 bg-slate-50">
                              <button
                                onClick={() => toggleMilestone(milestone.id, rm)}
                                className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                  selectedMilestones[milestone.id]
                                    ? 'bg-cyan-500 border-cyan-500'
                                    : 'border-slate-400 hover:border-slate-600'
                                }`}
                              >
                                {selectedMilestones[milestone.id] && <Check className="w-3 h-3 text-white" />}
                              </button>
                              <button
                                onClick={() => setExpandedMilestone(expandedMilestone === milestone.id ? null : milestone.id)}
                                className="flex-1 text-left"
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <span className="text-xs font-semibold text-cyan-600 mr-2">Step {mIdx + 1}</span>
                                    <span className="text-sm font-medium text-slate-800">{milestone.name}</span>
                                  </div>
                                  {expandedMilestone === milestone.id ? (
                                    <ChevronUp className="w-4 h-4 text-slate-400" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4 text-slate-400" />
                                  )}
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5">{milestone.description}</p>
                              </button>
                            </div>

                            {/* Resources dropdown */}
                            {expandedMilestone === milestone.id && (
                              <div className="border-t border-slate-200 bg-white p-2 space-y-1">
                                <p className="text-xs font-medium text-slate-500 px-2 py-1">Resources:</p>
                                {milestone.resources.map((resource) => (
                                  <label
                                    key={resource.id}
                                    className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-50 cursor-pointer"
                                  >
                                    <button
                                      onClick={() => toggleResource(resource.id)}
                                      className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                        selectedResources[resource.id]
                                          ? 'bg-purple-500 border-purple-500'
                                          : 'border-slate-400 hover:border-slate-600'
                                      }`}
                                    >
                                      {selectedResources[resource.id] && <Check className="w-3 h-3 text-white" />}
                                    </button>
                                    <div className="flex-1">
                                      <span className="text-sm text-slate-800">{resource.name}</span>
                                      <span className="ml-2 text-xs text-slate-400">{resource.type}</span>
                                    </div>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Mentors */}
          {currentStep === 'mentors' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-6 h-6 text-purple-600" />
                  <h2 className="text-2xl font-bold text-slate-900">Mentor Selection</h2>
                </div>
                <button
                  onClick={handleSelectAllMentors}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    mockMentors.every(m => selectedMentors[m.id])
                      ? 'bg-purple-100 text-purple-700 border border-purple-300'
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {mockMentors.every(m => selectedMentors[m.id]) ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              
              <p className="text-slate-700 mb-6">
                These mentors match your barriers and goals. Select who you&apos;d like on your team.
              </p>

              {/* Grouped by barrier category, then race category */}
              {Object.entries(groupMentors(mockMentors)).map(([barrierCat, raceCats]) => (
                <div key={barrierCat} className="mb-6">
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-purple-500 rounded-full" />
                    {barrierCat}
                  </h3>
                  
                  {Object.entries(raceCats).map(([raceCat, mentors]) => (
                    <div key={raceCat} className="mb-4">
                      <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2 pl-4">{raceCat}</p>
                      <div className="space-y-2">
                        {mentors.map((mentor) => (
                          <div 
                            key={mentor.id} 
                            onClick={() => handleMentorToggle(mentor.id)}
                            className={`bg-white/60 border rounded-xl p-4 cursor-pointer transition-all ${
                              selectedMentors[mentor.id]
                                ? 'border-purple-400 bg-purple-50/50'
                                : 'border-slate-300 hover:bg-white/80'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-lg font-bold text-white flex-shrink-0">
                                {mentor.name.charAt(0)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-slate-900">{mentor.name}</h3>
                                <p className="text-sm text-slate-600">{mentor.role}</p>
                                <p className="text-sm text-slate-700 mt-1">{mentor.description}</p>
                              </div>
                              <div
                                className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                                  selectedMentors[mentor.id]
                                    ? 'bg-purple-500 border-purple-500'
                                    : 'border-slate-400'
                                }`}
                              >
                                {selectedMentors[mentor.id] && (
                                  <Check className="w-4 h-4 text-white" />
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}

              <p className="text-xs text-slate-500 italic">
                You can change your mentor selections anytime from your Path settings.
              </p>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t border-slate-300">
            <button
              onClick={handleBack}
              disabled={currentStep === 'roleModels'}
              className="flex items-center gap-2 px-6 py-3 text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              Back
            </button>

            {currentStep === 'roleModels' ? (
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
                disabled={isSubmitting}
                className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-xl transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Sparkles className="w-5 h-5 animate-spin" />
                    Creating your path...
                  </>
                ) : (
                  <>
                    Complete Setup
                    <Sparkles className="w-5 h-5" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
