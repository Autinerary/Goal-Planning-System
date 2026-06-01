'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Sparkles, CheckCircle, Clock, TrendingUp, Star, ExternalLink, Filter } from 'lucide-react'

interface RecommendedChoice {
  id: string
  name: string
  description: string
  service: string
  successRate: number
  attempts: number
  estimatedTime?: number
  bestFor?: string[]
  status?: 'not_started' | 'in_progress' | 'completed'
  progress?: number
}

export default function RecommendChoicesPage() {
  const router = useRouter()
  const [filterService, setFilterService] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'success' | 'attempts' | 'name'>('success')

  // Mock data - choices organized by service
  const choicesByService: Record<string, RecommendedChoice[]> = {
    'University Accommodations': [
      {
        id: 'choice_1',
        name: 'Early Accommodation Request',
        description: 'Request accommodations at the start of your program for best results. Works especially well for autistic individuals who benefit from clear structures early on.',
        service: 'University Accommodations',
        successRate: 90,
        attempts: 1000,
        estimatedTime: 45,
        bestFor: ['Autism', 'ADHD'],
        status: 'in_progress',
        progress: 65
      },
      {
        id: 'choice_2',
        name: 'Join Study Group',
        description: 'Find a supportive study group with peers who understand neurodivergent needs.',
        service: 'University Accommodations',
        successRate: 89,
        attempts: 101,
        estimatedTime: 30,
        bestFor: ['ADHD', 'First-Gen'],
        status: 'not_started',
        progress: 0
      },
      {
        id: 'choice_3',
        name: 'Find Autism-Friendly Study Environment',
        description: 'Identify sensory-friendly spaces on campus that support your learning style.',
        service: 'University Accommodations',
        successRate: 85,
        attempts: 250,
        estimatedTime: 20,
        bestFor: ['Autism'],
        status: 'completed',
        progress: 100
      },
    ],
    'Career Development': [
      {
        id: 'choice_4',
        name: 'Build Portfolio Early',
        description: 'Start building your portfolio from day one. Showcase projects that demonstrate your unique strengths.',
        service: 'Career Development',
        successRate: 88,
        attempts: 750,
        estimatedTime: 60,
        bestFor: ['ADHD', 'Visible Minority'],
        status: 'in_progress',
        progress: 40
      },
      {
        id: 'choice_5',
        name: 'Network with Neurodivergent Professionals',
        description: 'Connect with professionals who share similar barriers and can provide mentorship.',
        service: 'Career Development',
        successRate: 92,
        attempts: 320,
        estimatedTime: 90,
        bestFor: ['Autism', 'ADHD', 'Visible Minority'],
        status: 'not_started',
        progress: 0
      },
    ],
    'Mental Health Support': [
      {
        id: 'choice_6',
        name: 'Regular Therapy Sessions',
        description: 'Schedule consistent therapy sessions to maintain mental wellness throughout your journey.',
        service: 'Mental Health Support',
        successRate: 87,
        attempts: 1200,
        estimatedTime: 50,
        bestFor: ['Anxiety', 'Bipolar'],
        status: 'in_progress',
        progress: 55
      },
    ],
  }

  const allChoices = Object.values(choicesByService).flat()
  const services = Object.keys(choicesByService)

  const filteredChoices = filterService
    ? choicesByService[filterService] || []
    : allChoices

  const sortedChoices = [...filteredChoices].sort((a, b) => {
    switch (sortBy) {
      case 'success':
        return b.successRate - a.successRate
      case 'attempts':
        return b.attempts - a.attempts
      case 'name':
        return a.name.localeCompare(b.name)
      default:
        return 0
    }
  })

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500'
      case 'in_progress': return 'bg-blue-500'
      default: return 'bg-gray-300'
    }
  }

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700 border-green-300'
      case 'in_progress': return 'bg-blue-100 text-blue-700 border-blue-300'
      default: return 'bg-gray-100 text-gray-700 border-gray-300'
    }
  }

  return (
    <div className="min-h-screen bg-white/20 backdrop-blur-sm p-4 md:p-8 relative overflow-hidden">
      {/* Background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-cyan-300/30 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-300/30 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '5s', animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => router.back()}
              className="px-4 py-2 bg-white/90 backdrop-blur-sm border-2 border-slate-300 rounded-xl font-medium hover:bg-white hover:shadow-md transition-all flex items-center gap-2 shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <div className="flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-purple-600" />
              <h1 className="text-3xl font-bold text-slate-800">Recommended Choices</h1>
            </div>
          </div>
          <p className="text-slate-600 text-lg">
            Explore personalized choices for each service based on what worked for people like you
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl border-2 border-slate-300 p-4 mb-6 shadow-lg">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-slate-600" />
              <span className="font-semibold text-slate-700">Filter:</span>
            </div>
            <button
              onClick={() => setFilterService(null)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filterService === null
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-md'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All Services
            </button>
            {services.map((service) => (
              <button
                key={service}
                onClick={() => setFilterService(service)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  filterService === service
                    ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-md'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {service}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <span className="text-sm text-slate-600">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'success' | 'attempts' | 'name')}
                className="px-3 py-2 bg-white border-2 border-slate-300 rounded-lg text-sm font-medium focus:outline-none focus:border-blue-500"
              >
                <option value="success">Success Rate</option>
                <option value="attempts">Most Attempts</option>
                <option value="name">Name</option>
              </select>
            </div>
          </div>
        </div>

        {/* Choices by Service */}
        {filterService ? (
          // Show filtered choices
          <div className="space-y-6">
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl border-2 border-blue-300 p-6 shadow-lg">
              <h2 className="text-2xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-blue-600" />
                {filterService}
              </h2>
              <div className="space-y-4">
                {sortedChoices.map((choice) => (
                  <ChoiceCard key={choice.id} choice={choice} />
                ))}
              </div>
            </div>
          </div>
        ) : (
          // Show all services
          <div className="space-y-6">
            {services.map((service) => (
              <div key={service} className="bg-white/90 backdrop-blur-sm rounded-2xl border-2 border-slate-300 p-6 shadow-lg">
                <h2 className="text-2xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-purple-600" />
                  {service}
                </h2>
                <div className="space-y-4">
                  {choicesByService[service]
                    .sort((a, b) => b.successRate - a.successRate)
                    .map((choice) => (
                      <ChoiceCard key={choice.id} choice={choice} />
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {sortedChoices.length === 0 && (
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl border-2 border-slate-300 p-12 text-center shadow-lg">
            <Sparkles className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-700 mb-2">No choices found</h3>
            <p className="text-slate-600">Try selecting a different service or check back later.</p>
          </div>
        )}
      </div>
    </div>
  )

  function ChoiceCard({ choice }: { choice: RecommendedChoice }) {
    return (
      <div className="border-2 border-slate-200 rounded-xl p-5 hover:shadow-lg transition-all bg-gradient-to-br from-white to-slate-50">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-bold text-slate-800">{choice.name}</h3>
              {choice.status && (
                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusBadge(choice.status)}`}>
                  {choice.status === 'completed' ? '✓ Completed' : choice.status === 'in_progress' ? '⏳ In Progress' : '○ Not Started'}
                </span>
              )}
            </div>
            <p className="text-slate-600 mb-3">{choice.description}</p>
            
            {/* Stats */}
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="font-semibold text-slate-700">{choice.successRate}%</span>
                <span className="text-slate-500">success rate</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-blue-600" />
                <span className="font-semibold text-slate-700">{choice.attempts.toLocaleString()}</span>
                <span className="text-slate-500">attempts</span>
              </div>
              {choice.estimatedTime && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-600" />
                  <span className="font-semibold text-slate-700">{choice.estimatedTime} min</span>
                  <span className="text-slate-500">estimated</span>
                </div>
              )}
            </div>

            {/* Best For Tags */}
            {choice.bestFor && choice.bestFor.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {choice.bestFor.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium border border-purple-200"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Progress Bar */}
            {choice.progress !== undefined && choice.progress > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-600">Progress</span>
                  <span className="text-xs font-bold text-slate-700">{choice.progress}%</span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${getStatusColor(choice.status)}`}
                    style={{ width: `${choice.progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action Button */}
          <Link
            href={`/milestones/${choice.id}`}
            className="ml-4 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-medium hover:shadow-lg transition-all flex items-center gap-2 whitespace-nowrap"
          >
            View Details
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      </div>
    )
  }
}
