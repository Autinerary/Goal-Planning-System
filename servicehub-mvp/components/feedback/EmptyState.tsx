'use client'

import { Search, Star, FileText, Heart, XCircle } from 'lucide-react'
import Link from 'next/link'

interface EmptyStateProps {
  type?: 'search' | 'saved' | 'rated' | 'submitted' | 'ratings' | 'custom'
  title?: string
  message?: string
  actionLabel?: string
  actionHref?: string
  onAction?: () => void
  icon?: React.ReactNode
}

export default function EmptyState({
  type = 'custom',
  title,
  message,
  actionLabel,
  actionHref,
  onAction,
  icon,
}: EmptyStateProps) {
  const getDefaultContent = () => {
    switch (type) {
      case 'search':
        return {
          icon: <Search className="w-16 h-16 text-gray-300" aria-hidden="true" />,
          title: 'No resources found',
          message: 'Try adjusting your search filters or browse by category.',
          actionLabel: 'Browse Categories',
          actionHref: '/search',
        }
      case 'saved':
        return {
          icon: <Heart className="w-16 h-16 text-gray-300" aria-hidden="true" />,
          title: 'No saved resources yet',
          message: 'Start saving resources you find useful for quick access later.',
          actionLabel: 'Search Resources',
          actionHref: '/search',
        }
      case 'rated':
        return {
          icon: <Star className="w-16 h-16 text-gray-300" aria-hidden="true" />,
          title: 'No ratings yet',
          message: 'Share your experiences by rating resources that have helped you.',
          actionLabel: 'Browse Resources',
          actionHref: '/search',
        }
      case 'submitted':
        return {
          icon: <FileText className="w-16 h-16 text-gray-300" aria-hidden="true" />,
          title: 'No submitted resources',
          message: 'Help the community by recommending resources that have helped you.',
          actionLabel: 'Recommend a Resource',
          actionHref: '/resources/new',
        }
      case 'ratings':
        return {
          icon: <Star className="w-16 h-16 text-gray-300" aria-hidden="true" />,
          title: 'No ratings yet',
          message: 'Be the first to rate this resource and help others in the community.',
          actionLabel: 'Add Your Rating',
          actionHref: undefined, // Will be handled by onAction
        }
      default:
        return {
          icon: <XCircle className="w-16 h-16 text-gray-300" aria-hidden="true" />,
          title: title || 'No results',
          message: message || 'There\'s nothing here yet.',
          actionLabel,
          actionHref,
        }
    }
  }

  const content = getDefaultContent()

  return (
    <div className="text-center py-12 px-4">
      <div className="flex justify-center mb-4" aria-hidden="true">
        {icon || content.icon}
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">
        {title || content.title}
      </h3>
      <p className="text-gray-600 mb-6 max-w-md mx-auto">
        {message || content.message}
      </p>
      {(actionLabel || content.actionLabel) && (
        <div className="flex justify-center">
          {actionHref || content.actionHref ? (
            <Link
              href={actionHref || content.actionHref || '#'}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors min-h-[44px]"
            >
              {actionLabel || content.actionLabel}
            </Link>
          ) : onAction ? (
            <button
              onClick={onAction}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors min-h-[44px]"
            >
              {actionLabel || content.actionLabel}
            </button>
          ) : null}
        </div>
      )}
    </div>
  )
}