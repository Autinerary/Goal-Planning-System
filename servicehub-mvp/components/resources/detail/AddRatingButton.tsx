'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import AddRatingModal from './AddRatingModal'

interface AddRatingButtonProps {
  resourceId: string
  onRatingAdded?: () => void
}

export default function AddRatingButton({ resourceId, onRatingAdded }: AddRatingButtonProps) {
  const [showModal, setShowModal] = useState(false)

  const handleRatingAdded = () => {
    setShowModal(false)
    if (onRatingAdded) {
      onRatingAdded()
    }
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <Plus className="w-4 h-4" aria-hidden="true" />
        Add Your Rating
      </button>

      {showModal && (
        <AddRatingModal
          resourceId={resourceId}
          onClose={() => setShowModal(false)}
          onRatingAdded={handleRatingAdded}
        />
      )}
    </>
  )
}