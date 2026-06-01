'use client'

import { useState, useEffect } from 'react'
import { Sparkles } from 'lucide-react'
import PatternInsight from '@/components/agents/PatternInsight'
import type { DiscoveredPattern } from '@/lib/agents/pattern-agent/types'

interface ResourcePatternsProps {
  resourceId: string
  category?: string
}

export default function ResourcePatterns({ resourceId, category }: ResourcePatternsProps) {
  const [patterns, setPatterns] = useState<DiscoveredPattern[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPatterns()
  }, [resourceId, category])

  const fetchPatterns = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        resourceId,
        limit: '3',
        ...(category && { category }),
      })

      const response = await fetch(`/api/agents/patterns?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch patterns')
      }

      const data = await response.json()
      setPatterns(data.patterns || [])
    } catch (error) {
      console.error('Error fetching patterns:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-24 bg-gray-200 rounded-lg"></div>
      </div>
    )
  }

  if (patterns.length === 0) {
    return null
  }

  return (
    <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-blue-600" aria-hidden="true" />
        <h3 className="text-lg font-semibold text-gray-900">Pattern Insights</h3>
      </div>
      <div className="space-y-3">
        {patterns.map((pattern) => (
          <PatternInsight key={pattern.id || JSON.stringify(pattern.pattern)} pattern={pattern} variant="default" />
        ))}
      </div>
    </section>
  )
}