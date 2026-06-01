'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import StepIndicator from '@/components/onboarding/StepIndicator'
import RoleSelector from '@/components/onboarding/RoleSelector'
import BarrierSelector, { SelectedBarrier } from '@/components/onboarding/BarrierSelector'
import IntersectionalityBadge from '@/components/onboarding/IntersectionalityBadge'

const steps = ['Welcome', 'Location', 'Barriers', 'Impact', 'Context']

interface OnboardingData {
  role: string | null
  location: {
    city: string
    province: string
    country: string
  }
  barriers: SelectedBarrier[]
  lifeStage: string
  goals: string[]
  culturalNotes: string
  additionalNotes: string
}

export default function OnboardingPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState<OnboardingData>({
    role: null,
    location: {
      city: '',
      province: '',
      country: '',
    },
    barriers: [],
    lifeStage: '',
    goals: [],
    culturalNotes: '',
    additionalNotes: '',
  })

  const lifeStages = [
    { id: 'preschool', label: 'Preschool' },
    { id: 'school_age', label: 'School-age' },
    { id: 'university', label: 'University' },
    { id: 'employment', label: 'Employment' },
    { id: 'retirement', label: 'Retirement' },
  ]

  const goals = [
    { id: 'education', label: 'Education' },
    { id: 'employment', label: 'Employment' },
    { id: 'independence', label: 'Independence' },
    { id: 'relationships', label: 'Relationships' },
    { id: 'health', label: 'Health' },
  ]

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    if (!user) {
      setError('You must be logged in to complete onboarding')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Save onboarding data via API
      const response = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to complete onboarding')
      }

      // Redirect to home page
      window.location.href = '/'
    } catch (err) {
      console.error('Error completing onboarding:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
      setLoading(false)
    }
  }

  function nextStep() {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1)
    }
  }

  function prevStep() {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  function canProceed(): boolean {
    switch (currentStep) {
      case 1:
        return formData.role !== null
      case 2:
        return (
          formData.location.city.trim() !== '' &&
          formData.location.province.trim() !== '' &&
          formData.location.country.trim() !== ''
        )
      case 3:
        return formData.barriers.length > 0
      case 4:
        return true // Severity already set in barrier selector
      case 5:
        return formData.lifeStage !== '' && formData.goals.length > 0
      default:
        return false
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900">Welcome to ServiceHub</h1>
          <p className="mt-2 text-lg text-gray-600">
            Help us understand your experiences to find resources that work for you
          </p>
        </div>

        {/* Step Indicator */}
        <StepIndicator currentStep={currentStep} totalSteps={steps.length} steps={steps} />

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-8">
          <div className="bg-white shadow rounded-lg p-6 sm:p-8">
            {/* Step 1: Welcome + Role */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Tell us about yourself</h2>
                  <p className="text-gray-600">
                    Your role helps us personalize your experience and match you with relevant
                    resources.
                  </p>
                </div>

                <RoleSelector
                  selectedRole={formData.role}
                  onSelectRole={(role) => setFormData({ ...formData, role })}
                />

                {/* Patent Compliance Notice */}
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-900">
                    <strong className="font-semibold">Your ratings will help others in your community.</strong>
                    <br />
                    <span className="mt-1 block">
                      Rated BY people like you, FOR people like you. You control what you share.
                    </span>
                  </p>
                </div>
              </div>
            )}

            {/* Step 2: Location */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Where are you located?</h2>
                  <p className="text-gray-600">
                    This helps us find resources in your area. All location data is private and optional.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="city" className="block text-sm font-medium text-gray-700">
                      City *
                    </label>
                    <input
                      type="text"
                      id="city"
                      required
                      value={formData.location.city}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          location: { ...formData.location, city: e.target.value },
                        })
                      }
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder="e.g., Toronto"
                    />
                  </div>

                  <div>
                    <label htmlFor="province" className="block text-sm font-medium text-gray-700">
                      Province/State *
                    </label>
                    <input
                      type="text"
                      id="province"
                      required
                      value={formData.location.province}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          location: { ...formData.location, province: e.target.value },
                        })
                      }
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder="e.g., Ontario"
                    />
                  </div>

                  <div>
                    <label htmlFor="country" className="block text-sm font-medium text-gray-700">
                      Country *
                    </label>
                    <input
                      type="text"
                      id="country"
                      required
                      value={formData.location.country}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          location: { ...formData.location, country: e.target.value },
                        })
                      }
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder="e.g., Canada"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Barrier Selection */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Systematic Barrier Identification
                  </h2>
                  <p className="text-gray-600">
                    Select all that apply to you. This is the <strong>core innovation</strong> of
                    ServiceHub - we find resources rated by people with similar barriers.
                  </p>
                </div>

                <BarrierSelector
                  selectedBarriers={formData.barriers}
                  onBarriersChange={(barriers) => setFormData({ ...formData, barriers })}
                />
              </div>
            )}

            {/* Step 4: Impact Rating */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Impact on Daily Life</h2>
                  <p className="text-gray-600">
                    For each barrier you selected, indicate how much it impacts your daily life. You
                    can adjust these in the previous step if needed.
                  </p>
                </div>

                {formData.barriers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No barriers selected. Please go back to select at least one barrier.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {formData.barriers.map((barrier) => (
                      <div key={barrier.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h3 className="font-medium text-gray-900">{barrier.label}</h3>
                            <p className="text-sm text-gray-500">{barrier.categoryLabel}</p>
                          </div>
                          <span className="text-lg font-semibold text-blue-600">
                            {barrier.severity || 3}/5
                          </span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="5"
                          value={barrier.severity || 3}
                          onChange={(e) => {
                            const updated = formData.barriers.map((b) =>
                              b.id === barrier.id
                                ? { ...b, severity: parseInt(e.target.value) }
                                : b
                            )
                            setFormData({ ...formData, barriers: updated })
                          }}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                          aria-label={`Impact rating for ${barrier.label}`}
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>Low impact</span>
                          <span>High impact</span>
                        </div>
                        {barrier.notes && (
                          <p className="mt-2 text-sm text-gray-600">
                            <strong>Notes:</strong> {barrier.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <IntersectionalityBadge
                  count={formData.barriers.length}
                  barriers={formData.barriers.map((b) => b.label)}
                />
              </div>
            )}

            {/* Step 5: Additional Context */}
            {currentStep === 5 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Additional Context</h2>
                  <p className="text-gray-600">
                    Help us better understand your situation and goals. All fields are optional.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Life Stage *
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {lifeStages.map((stage) => (
                        <button
                          key={stage.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, lifeStage: stage.id })}
                          className={`px-4 py-2 rounded-md border-2 text-sm font-medium transition-colors ${
                            formData.lifeStage === stage.id
                              ? 'border-blue-600 bg-blue-50 text-blue-900'
                              : 'border-gray-200 hover:border-gray-300 text-gray-700'
                          } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                        >
                          {stage.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Current Goals * (select all that apply)
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {goals.map((goal) => {
                        const isSelected = formData.goals.includes(goal.id)
                        return (
                          <button
                            key={goal.id}
                            type="button"
                            onClick={() => {
                              const updated = isSelected
                                ? formData.goals.filter((g) => g !== goal.id)
                                : [...formData.goals, goal.id]
                              setFormData({ ...formData, goals: updated })
                            }}
                            className={`px-4 py-2 rounded-md border-2 text-sm font-medium transition-colors ${
                              isSelected
                                ? 'border-blue-600 bg-blue-50 text-blue-900'
                                : 'border-gray-200 hover:border-gray-300 text-gray-700'
                            } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                          >
                            {goal.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="culturalNotes" className="block text-sm font-medium text-gray-700">
                      Cultural/Religious Considerations (optional)
                    </label>
                    <textarea
                      id="culturalNotes"
                      rows={3}
                      value={formData.culturalNotes}
                      onChange={(e) =>
                        setFormData({ ...formData, culturalNotes: e.target.value })
                      }
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Any cultural or religious considerations that are important to you..."
                    />
                  </div>

                  <div>
                    <label htmlFor="additionalNotes" className="block text-sm font-medium text-gray-700">
                      Additional Notes (optional)
                    </label>
                    <textarea
                      id="additionalNotes"
                      rows={4}
                      value={formData.additionalNotes}
                      onChange={(e) =>
                        setFormData({ ...formData, additionalNotes: e.target.value })
                      }
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Anything else you'd like us to know..."
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="mt-4 rounded-md bg-red-50 p-4" role="alert">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-red-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">{error}</h3>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Buttons */}
          <div className="mt-6 flex justify-between">
            <button
              type="button"
              onClick={prevStep}
              disabled={currentStep === 1 || loading}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>

            {currentStep < steps.length ? (
              <button
                type="button"
                onClick={nextStep}
                disabled={!canProceed() || loading}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            ) : (
              <button
                type="submit"
                disabled={!canProceed() || loading}
                className="px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Completing...
                  </span>
                ) : (
                  'Complete Onboarding'
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
