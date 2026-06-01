'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  change?: number // Percentage change
  changeLabel?: string
  icon?: React.ReactNode
  color?: 'blue' | 'green' | 'purple' | 'yellow' | 'red'
  onClick?: () => void
}

const colorClasses = {
  blue: 'bg-blue-50 border-blue-200 text-blue-600',
  green: 'bg-green-50 border-green-200 text-green-600',
  purple: 'bg-purple-50 border-purple-200 text-purple-600',
  yellow: 'bg-yellow-50 border-yellow-200 text-yellow-600',
  red: 'bg-red-50 border-red-200 text-red-600',
}

export default function StatCard({
  title,
  value,
  change,
  changeLabel,
  icon,
  color = 'blue',
  onClick,
}: StatCardProps) {
  const isPositive = change !== undefined && change > 0
  const isNegative = change !== undefined && change < 0
  const isNeutral = change === undefined || change === 0

  const TrendIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus

  return (
    <div
      className={`bg-white p-6 rounded-lg border-2 ${
        onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''
      } ${colorClasses[color].split(' ')[1]}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2 rounded-lg ${colorClasses[color].split(' ')[0]}`}>
          {icon || <TrendingUp className="w-5 h-5" aria-hidden="true" />}
        </div>
        {change !== undefined && (
          <div
            className={`flex items-center gap-1 text-sm font-medium ${
              isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-600'
            }`}
          >
            <TrendIcon className="w-4 h-4" aria-hidden="true" />
            <span>
              {Math.abs(change)}% {changeLabel || 'change'}
            </span>
          </div>
        )}
      </div>
      <div className="mb-1">
        <div className="text-3xl font-bold text-gray-900">{value}</div>
      </div>
      <div className="text-sm font-medium text-gray-600">{title}</div>
    </div>
  )
}