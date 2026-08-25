'use client'

import { useState } from 'react'
import { Star, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react'
import type { DiagnosticBreakdown, OrgBreakdown } from '@/lib/supabase/queries'
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
  diagnosticBreakdown?: DiagnosticBreakdown[]
  orgBreakdown?: OrgBreakdown[]
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'] // Red to Green

// Friendly labels for diagnostic features (rater's barrier_type).
const FEATURE_LABELS: { [k: string]: string } = {
  autism: 'Autism',
  adhd: 'ADHD',
  ocd: 'OCD',
  bipolar: 'Bipolar',
  anxiety: 'Anxiety',
  sensory_deaf: 'Deaf / Hard of Hearing',
  sensory_blind: 'Blind / Low Vision',
  physical_wheelchair: 'Wheelchair User',
  physical_mobility: 'Mobility',
  intellectual: 'Intellectual Disability',
}
const featureLabel = (f: string) => FEATURE_LABELS[f] || f.charAt(0).toUpperCase() + f.slice(1).replace(/_/g, ' ')

export default function RatingsBreakdown({
  averageRating,
  ratingCount,
  ratingDistribution,
  barrierScores,
  diagnosticBreakdown = [],
  orgBreakdown = [],
}: RatingsBreakdownProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [openFeature, setOpenFeature] = useState<string | null>(null)
  const [openOrg, setOpenOrg] = useState<string | null>(null)
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
    autism: 'Autism Friendliness',
    adhd: 'ADHD Friendliness',
    sensory: 'Sensory Friendliness',
    mobility: 'Mobility Friendliness',
    cognitive: 'Cognitive Friendliness',
    social: 'Social Friendliness',
  }

  const getQualityName = (barrier: string): string => {
    return qualityNameMap[barrier.toLowerCase()] || barrier.charAt(0).toUpperCase() + barrier.slice(1).replace(/_/g, ' ')
  }

  // Compact list of area ratings (Sensory Friendliness: ★ 4.5 (2)), reused for
  // the "all levels" and per-level rows of the nested breakdown.
  const areaRows = (entries: [string, { average: number; count: number }][]) => {
    if (entries.length === 0) return <div className="text-xs text-gray-400">No area ratings yet.</div>
    return (
      <div className="space-y-0.5">
        {entries.map(([area, s]) => (
          <div key={area} className="flex items-center justify-between text-sm py-0.5">
            <span className="text-gray-700">{getQualityName(area)}</span>
            <span className="flex items-center gap-1.5 text-gray-900">
              <Star className="w-3.5 h-3.5 text-yellow-400 fill-current" aria-hidden="true" />
              <span className="font-semibold">{s.average.toFixed(1)}</span>
              <span className="text-xs text-gray-400">({s.count})</span>
            </span>
          </div>
        ))}
      </div>
    )
  }
  const sortedAreas = (a: { [k: string]: { average: number; count: number } }) =>
    Object.entries(a).sort((x, y) => y[1].count - x[1].count)

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

          {/* Nested breakdown by diagnostic feature + severity level (Odosa) */}
          {diagnosticBreakdown.length > 0 && (
            <section>
              <h3 className="text-lg font-medium text-gray-900 mb-1">By norm &amp; level</h3>
              <p className="text-xs text-gray-500 mb-1">
                How each area is rated by people who share a given norm — overall and by severity level.
              </p>
              {/* Say plainly where these norms come from, rather than implying
                  clinical verification we don't do (Odosa). */}
              <p className="text-[11px] text-gray-400 mb-4">
                Norms are self-identified. We don&apos;t ask for diagnosis paperwork — assessment is
                costly and hard to access, and self-identification is valid here.
              </p>
              <div className="space-y-2">
                {diagnosticBreakdown.map((d) => {
                  const isOpen = openFeature === d.feature
                  return (
                    <div key={d.feature} className="border border-gray-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setOpenFeature(isOpen ? null : d.feature)}
                        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 text-left"
                        aria-expanded={isOpen}
                      >
                        <span className="text-sm font-semibold text-gray-900">{featureLabel(d.feature)}</span>
                        <span className="flex items-center gap-2 text-xs text-gray-500">
                          {d.count} {d.count === 1 ? 'rater' : 'raters'}
                          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </span>
                      </button>
                      {isOpen && (
                        <div className="px-4 py-3 space-y-4">
                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
                              All levels
                            </div>
                            {areaRows(sortedAreas(d.areas))}
                          </div>
                          {d.levels
                            .filter((l) => l.level >= 1)
                            .map((l) => (
                              <div key={l.level}>
                                <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
                                  Level {l.level} · {l.count} {l.count === 1 ? 'rater' : 'raters'}
                                </div>
                                {areaRows(sortedAreas(l.areas))}
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Rating groups — how each organisation's members rate this (Odosa).
              Only admin-verified organisations appear. */}
          {orgBreakdown.length > 0 && (
            <section>
              <h3 className="text-lg font-medium text-gray-900 mb-1">By organisation</h3>
              <p className="text-xs text-gray-500 mb-4">
                How members of community organisations rate this resource — people often trust
                their own community&apos;s experience most.
              </p>
              <div className="space-y-2">
                {orgBreakdown.map((o) => {
                  const isOpen = openOrg === o.orgId
                  return (
                    <div key={o.orgId} className="border border-gray-200 rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setOpenOrg(isOpen ? null : o.orgId)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
                        aria-expanded={isOpen}
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900">{o.name}</div>
                          <div className="text-xs text-gray-500">
                            {o.count} {o.count === 1 ? 'rating' : 'ratings'} from members
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="flex items-center gap-1 text-sm font-semibold text-gray-900">
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" aria-hidden="true" />
                            {o.average.toFixed(1)}
                          </span>
                          {isOpen ? (
                            <ChevronUp className="w-4 h-4 text-gray-500" aria-hidden="true" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-500" aria-hidden="true" />
                          )}
                        </div>
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-3 bg-gray-50">
                          {Object.keys(o.areas).length === 0 ? (
                            <p className="text-xs text-gray-500 py-2">
                              No area-level ratings from this organisation yet.
                            </p>
                          ) : (
                            areaRows(sortedAreas(o.areas))
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
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