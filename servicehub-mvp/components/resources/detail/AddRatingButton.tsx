'use client'

import { useState } from 'react'
import { Plus, Pencil } from 'lucide-react'
import AddRatingModal from './AddRatingModal'

interface AddRatingButtonProps {
  resourceId: string
  /**
   * Whether this viewer has already rated this resource.
   *
   * The button used to say "Add Your Rating" unconditionally, which is how a
   * tester concluded they could rate the same resource twice. They could not:
   * ratings carries UNIQUE(resource_id, user_id) and the modal already detects
   * the existing row, prefills it and sends a PUT. The label was the only thing
   * lying -- it invited a second rating and then quietly overwrote the first,
   * which reads as worse than a duplicate because you lose your own review
   * without being told.
   */
  hasRated?: boolean
  onRatingAdded?: () => void
}

export default function AddRatingButton({
  resourceId,
  hasRated = false,
  onRatingAdded,
}: AddRatingButtonProps) {
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
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 whitespace-nowrap"
      >
        {hasRated ? (
          <Pencil className="w-4 h-4" aria-hidden="true" />
        ) : (
          <Plus className="w-4 h-4" aria-hidden="true" />
        )}
        {hasRated ? 'Edit your rating' : 'Add Your Rating'}
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