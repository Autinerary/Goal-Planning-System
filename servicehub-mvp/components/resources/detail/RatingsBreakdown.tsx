'use client'

import { useState } from 'react'
import { Star, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

interface RatingsBreakdownProps {
  averageRating: number
  ratingCount: number
  ratingDistribution: { [key: number]: number }
  barrierScores: { [barrier: string]: { average: number; count: number } }
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'] // Red to Green

export default function RatingsBreakdown({
  averageRating,
  ratingCount,
  ratingDistribution,
  barrierScores,
}: RatingsBreakdownProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  // Prepare rating distribution data for bar chart
  const distributionData = [
    { rating: '5', count: ratingDistribution[5] || 0, label: '5 stars' },
    { rating: '4', count: ratingDistribution[4] || 0, label: '4 stars' },
    { rating: '3', count: ratingDistribution[3] || 0, label: '3 stars' },
    { rating: '2', count: ratingDistribution[2] || 0, label: '2 stars' },
    { rating: '1', count: ratingDistribution[1] || 0, label: '1 star' },
  ].reverse()

  // Map barrier types to quality names (as shown in wireframes)
  const qualityNameMap: { [key: string]: string } = {
    accessibility: 'Accessibility',
    staff_knowledge: 'Staff Knowledge',
    sensory_friendly: 'Sensory-Friendly',
    communication: 'Communication',
    wait_time: 'Wait Times',
    affordability: 'Affordability',
    autism: 'Autism Support',
    adhd: 'ADHD Support',
    sensory: 'Sensory Support',
    mobility: 'Mobility Access',
    cognitive: 'Cognitive Support',
    social: 'Social Support',
  }

  const getQualityName = (barrier: string): string => {
    return qualityNameMap[barrier.toLowerCase()] || barrier.charAt(0).toUpperCase() + barrier.slice(1).replace(/_/g, ' ')
  }

  // Prepare barrier scores data
  const barrierData = Object.entries(barrierScores)
    .map(([barrier, data]) => ({
      key: barrier, // Keep original key for getQualityName
      name: getQualityName(barrier), // Use formatted name for display
      average: data.average,
      count: data.count,
    }))
    .sort((a, b) => b.count - a.count) // Sort by number of ratings

  // Calculate total for pie chart
  const totalRatings = Object.values(ratingDistribution).reduce((a, b) => a + b, 0)
  const pieData = distributionData
    .filter((d) => d.count > 0)
    .map((d) => ({
      name: d.label,
      value: d.count,
      percentage: totalRatings > 0 ? ((d.count / totalRatings) * 100).toFixed(0) : 0,
    }))

  if (ratingCount === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Ratings Breakdown</h2>
        <p className="text-gray-600">No ratings yet. Be the first to rate this resource!</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between gap-2 text-left focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg p-2 -m-2"
        aria-expanded={isExpanded}
        aria-controls="ratings-breakdown-content"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-blue-600" aria-hidden="true" />
          <h2 className="text-xl font-semibold text-gray-900">Rating Breakdown</h2>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-500" aria-hidden="true" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-500" aria-hidden="true" />
        )}
      </button>

      {isExpanded && (
        <div id="ratings-breakdown-content" className="mt-6 space-y-8">

          {/* Overall Rating Summary */}
          <div className="flex items-center gap-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Star className="w-8 h-8 text-yellow-400 fill-current" aria-hidden="true" />
              <span className="text-3xl font-bold text-gray-900">Total: {averageRating.toFixed(1)}</span>
            </div>
            <div className="text-gray-600">
              <div className="text-sm">Based on {ratingCount} {ratingCount === 1 ? 'review' : 'reviews'}</div>
            </div>
          </div>

          {/* Quality Ratings (as shown in wireframes) */}
          {barrierData.length > 0 && (
            <section>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Quality Ratings</h3>
              <div className="space-y-3">
                {barrierData.map((barrier) => (
                  <div key={barrier.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-sm font-medium text-gray-900 min-w-[180px]">
                        {barrier.name}:
                      </span>
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-yellow-400 fill-current" aria-hidden="true" />
                        <span className="text-sm font-semibold text-gray-900">
                          {barrier.average.toFixed(1)}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {barrier.count} {barrier.count === 1 ? 'rating' : 'ratings'}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Rating Distribution Bar Chart */}
          {totalRatings > 0 && (
            <section>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Rating Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={distributionData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="rating" label={{ value: 'Stars', position: 'insideBottom', offset: -5 }} />
              <YAxis label={{ value: 'Count', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6">
                {distributionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[parseInt(entry.rating) - 1]} />
                ))}
              </Bar>
              </BarChart>
            </ResponsiveContainer>
          </section>
          )}

          {/* Pie Chart */}
          {pieData.length > 0 && (
            <section>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Rating Distribution Chart</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percentage }) => `${name}: ${percentage}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index]} />
                ))}
              </Pie>
              <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </section>
          )}
        </div>
      )}
    </div>
  )
}