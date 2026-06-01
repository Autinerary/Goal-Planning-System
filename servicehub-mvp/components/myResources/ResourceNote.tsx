'use client'

import { useState } from 'react'
import { Edit2, Trash2, X, Save, Plus } from 'lucide-react'

interface ResourceNoteProps {
  resourceId: string
  initialNote?: string
  onSave: (resourceId: string, note: string) => Promise<void>
  onDelete: (resourceId: string) => Promise<void>
}

export default function ResourceNote({
  resourceId,
  initialNote,
  onSave,
  onDelete,
}: ResourceNoteProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [note, setNote] = useState(initialNote || '')
  const [saving, setSaving] = useState(false)
  const [showInput, setShowInput] = useState(false)

  const handleSave = async () => {
    if (note.trim() === initialNote?.trim()) {
      setIsEditing(false)
      return
    }

    setSaving(true)
    try {
      await onSave(resourceId, note.trim())
      setIsEditing(false)
      setShowInput(false)
    } catch (error) {
      console.error('Error saving note:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this note?')) {
      return
    }

    setSaving(true)
    try {
      await onDelete(resourceId)
      setNote('')
      setIsEditing(false)
      setShowInput(false)
    } catch (error) {
      console.error('Error deleting note:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setNote(initialNote || '')
    setIsEditing(false)
    if (!initialNote) {
      setShowInput(false)
    }
  }

  if (!showInput && !initialNote) {
    return (
      <button
        onClick={() => setShowInput(true)}
        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label="Add note"
      >
        <Plus className="w-3 h-3" aria-hidden="true" />
        Add note
      </button>
    )
  }

  if (!isEditing && initialNote) {
    return (
      <div className="group relative">
        <div className="text-xs text-gray-600 max-w-xs truncate" title={initialNote}>
          {initialNote}
        </div>
        <div className="absolute top-0 left-0 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-10 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity max-w-xs">
          <div className="text-sm text-gray-900 whitespace-pre-wrap break-words">{initialNote}</div>
        </div>
        <div className="absolute top-0 right-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setIsEditing(true)}
            className="p-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Edit note"
          >
            <Edit2 className="w-3 h-3" aria-hidden="true" />
          </button>
          <button
            onClick={handleDelete}
            className="p-1 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
            aria-label="Delete note"
          >
            <Trash2 className="w-3 h-3" aria-hidden="true" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        maxLength={500}
        className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        placeholder="Add a private note about this resource..."
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-gray-500">
          {note.length}/500 characters
        </span>
        <div className="flex gap-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Save note"
          >
            <Save className="w-3 h-3" aria-hidden="true" />
          </button>
          <button
            onClick={handleCancel}
            disabled={saving}
            className="p-1 text-gray-600 hover:text-gray-700 hover:bg-gray-50 rounded focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Cancel"
          >
            <X className="w-3 h-3" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}