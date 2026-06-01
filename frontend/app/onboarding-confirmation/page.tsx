'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Sparkles, Users, UserCheck, ChevronRight } from 'lucide-react'

// Mock role models - in production, these would come from AI/backend
const mockRoleModels = [
  { id: 'rm1', name: 'Sarah Chen', role: 'Software Engineer', description: 'Autistic professional who graduated university and now works at a tech company', category: 'Professional' },
  { id: 'rm2', name: 'Marcus Johnson', role: 'Entrepreneur', description: 'ADHD entrepreneur who built a successful business', category: 'Entrepreneur' },
  { id: 'rm3', name: 'Dr. Emily Rodriguez', role: 'Researcher', description: 'Neurodivergent researcher who completed PhD', category: 'Academic' },
]

// Mock mentors - in production, these would come from AI/backend
const mockMentors = [
  { id: 'm1', name: 'James Wilson', role: 'Career Coach', category: 'Professional', description: 'Specializes in helping neurodivergent individuals navigate careers' },
  { id: 'm2', name: 'Lisa Park', role: 'Academic Advisor', category: 'Academic', description: 'Experienced in supporting students with accommodations' },
  { id: 'm3', name: 'David Thompson', role: 'Life Coach', category: 'Personal', description: 'Focuses on executive function and daily living skills' },
]

export default function OnboardingConfirmationPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<'roleModels' | 'mentors'>('roleModels')
  const [roleModelChoices, setRoleModelChoices] = useState<Record<string, string>>({})
  const [selectedMentors, setSelectedMentors] = useState<Record<string, boolean>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleRoleModelChoice = (roleModelId: string, choice: string) => {
    setRoleModelChoices(prev => ({
      ...prev,
      [roleModelId]: choice
    }))
  }

  const handleMentorToggle = (mentorId: string) => {
    setSelectedMentors(prev => ({
      ...prev,
      [mentorId]: !prev[mentorId]
    }))
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
      {/* Background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            O.S. Confirmation Page
          </h1>
          <p className="text-slate-600">Let's connect you with role models and mentors</p>
        </div>

        {/* Step Content Card */}
        <div className="bg-white/60 backdrop-blur-lg border border-slate-300 rounded-2xl p-6 md:p-8 shadow-2xl">
          {/* Step 1: Role Models */}
          {currentStep === 'roleModels' && (
            <div>
              <div className="flex items-center gap-2 mb-6">
                <Users className="w-6 h-6 text-blue-600" />
                <h2 className="text-2xl font-bold text-slate-900">a) Role-Model Q (NEW)</h2>
              </div>
              
              <p className="text-slate-700 mb-6">
                We identified the following role models:
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
                    
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: 'adjust', label: 'a) Adjust your path according to theirs' },
                        { value: 'follow', label: 'b) Follow theirs' },
                        { value: 'customize', label: 'c) Customize Adds' },
                        { value: 'none', label: 'd) None' },
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
                              <Check className="w-4 h-4 text-blue-600" />
                            )}
                            <span>{option.label}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-slate-600 italic mb-6">
                * Check boxes - Multiple mentors possible
              </p>
            </div>
          )}

          {/* Step 2: Mentors */}
          {currentStep === 'mentors' && (
            <div>
              <div className="flex items-center gap-2 mb-6">
                <UserCheck className="w-6 h-6 text-purple-600" />
                <h2 className="text-2xl font-bold text-slate-900">b) Mentors. Q (NEW)</h2>
              </div>
              
              <p className="text-slate-700 mb-6">
                (copy until below:)
              </p>

              <div className="space-y-4 mb-6">
                {mockMentors.map((mentor) => (
                  <div 
                    key={mentor.id} 
                    className="bg-white/60 border border-slate-300 rounded-xl p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xl font-bold text-white">
                        {mentor.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg text-slate-900">{mentor.name}</h3>
                        <p className="text-sm text-slate-600">{mentor.role}</p>
                        <p className="text-sm text-slate-700 mt-1">{mentor.description}</p>
                        <span className="inline-block mt-2 px-2 py-1 text-xs bg-purple-500/20 text-purple-600 rounded">
                          {mentor.category}
                        </span>
                      </div>
                      <button
                        onClick={() => handleMentorToggle(mentor.id)}
                        className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                          selectedMentors[mentor.id]
                            ? 'bg-purple-500 border-purple-500'
                            : 'border-slate-400 hover:border-slate-600'
                        }`}
                      >
                        {selectedMentors[mentor.id] && (
                          <Check className="w-4 h-4 text-white" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4 mb-6">
                <p className="text-sm text-blue-600 font-medium mb-2">Options:</p>
                <div className="space-y-2 text-sm text-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">a)</span>
                    <span>Add all to your path</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">b)</span>
                    <span>Add some /custom</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">c)</span>
                    <span>None</span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-600 italic">
                * Checkboxes - ONLY 1 PER ROLE/CATEGORY
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
