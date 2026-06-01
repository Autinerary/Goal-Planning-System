'use client'

interface BarrierBadgeProps {
  barrier: string
  variant?: 'default' | 'small'
}

const barrierColors: Record<string, string> = {
  autism: 'bg-blue-100 text-blue-800',
  adhd: 'bg-purple-100 text-purple-800',
  ocd: 'bg-green-100 text-green-800',
  bipolar: 'bg-yellow-100 text-yellow-800',
  deaf: 'bg-red-100 text-red-800',
  blind: 'bg-indigo-100 text-indigo-800',
  wheelchair: 'bg-gray-100 text-gray-800',
  lgbtq: 'bg-pink-100 text-pink-800',
  default: 'bg-gray-100 text-gray-800',
}

export default function BarrierBadge({ barrier, variant = 'default' }: BarrierBadgeProps) {
  // Normalize barrier name for color lookup
  const normalizedBarrier = barrier.toLowerCase().replace(/[^a-z0-9]/g, '')
  const colorClass =
    barrierColors[normalizedBarrier] ||
    Object.values(barrierColors).find((_, i) => i % 3 === 0) ||
    barrierColors.default

  const sizeClass = variant === 'small' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1'

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${colorClass} ${sizeClass}`}
      role="listitem"
      aria-label={`Resource helps with: ${barrier}`}
    >
      {barrier}
    </span>
  )
}
