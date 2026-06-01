'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import ResourceForm, { type ResourceFormData } from '@/components/resources/ResourceForm'
import ResourcePreviewModal from '@/components/resources/ResourcePreviewModal'
import { showToast } from '@/lib/toast'
import { formatErrorForUser } from '@/lib/errors/handler'
import { ArrowLeft, Save, Eye } from 'lucide-react'
import Link from 'next/link'

const DRAFT_KEY = 'resource-submission-draft'
const AUTO_SAVE_INTERVAL = 30000 // 30 seconds

export default function NewResourcePage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [formData, setFormData] = useState<ResourceFormData | null>(null)
  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  // Auto-save draft to localStorage
  const saveDraft = useCallback((data: Partial<ResourceFormData>) => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(data))
    } catch (error) {
      console.error('Error saving draft:', error)
    }
  }, [])

  // Load draft from localStorage
  const loadDraft = useCallback((): Partial<ResourceFormData> | null => {
    try {
      const draft = localStorage.getItem(DRAFT_KEY)
      if (draft) {
        return JSON.parse(draft)
      }
    } catch (error) {
      console.error('Error loading draft:', error)
    }
    return null
  }, [])

  // Clear draft
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(DRAFT_KEY)
    } catch (error) {
      console.error('Error clearing draft:', error)
    }
  }, [])

  // Check for authentication
  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        showToast.error('You must be logged in to submit a resource')
        setTimeout(() => {
          router.push('/login')
        }, 1000)
      }
    }

    checkAuth()
  }, [router])

  // Load draft on mount
  useEffect(() => {
    const draft = loadDraft()
    if (draft) {
      // Convert draft to initial data format
      const initialData = {
        name: draft.name || '',
        category: draft.category || '',
        description: draft.description || '',
        location: draft.location || null,
        contact_info: draft.contact_info || {},
        recommendation_reason: draft.recommendation_reason || '',
      }
      // Restore form data (this will be handled by ResourceForm)
    }
  }, [loadDraft])

  // Handle draft save
  const handleDraftSave = useCallback(
    (data: Partial<ResourceFormData>) => {
      saveDraft(data)
    },
    [saveDraft]
  )

  // Handle form submission
  const handleSubmit = async (data: ResourceFormData) => {
    // Set form data for preview
    setFormData(data)
    setErrors({})
    setShowPreview(true)
  }

  // Handle preview confirmation
  const handleConfirmSubmit = async () => {
    if (!formData) return

    setSubmitting(true)
    setErrors({})

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        showToast.error('You must be logged in to submit a resource')
        router.push('/login')
        return
      }

      // Create FormData for file upload
      const submitFormData = new FormData()
      submitFormData.append('name', formData.name)
      submitFormData.append('category', formData.category)
      submitFormData.append('description', formData.description)
      submitFormData.append('recommendation_reason', formData.recommendation_reason || '')

      if (formData.location) {
        submitFormData.append('location', JSON.stringify(formData.location))
      }

          if (formData.contact_info) {
            submitFormData.append('contact_info', JSON.stringify(formData.contact_info))
          }

          if (formData.price !== null && formData.price !== undefined) {
            submitFormData.append('price', formData.price.toString())
          }

          if (formData.image) {
            submitFormData.append('image', formData.image)
          }

      // Submit resource
      const response = await fetch('/api/resources/new', {
        method: 'POST',
        body: submitFormData,
      })

      if (!response.ok) {
        const data = await response.json()
        if (data.errors) {
          setErrors(data.errors)
          showToast.error('Please fix the errors in the form')
          setShowPreview(false)
          return
        }
        const formattedError = formatErrorForUser(
          new Error(data.error || 'Failed to submit resource')
        )
        throw new Error(formattedError.message)
      }

      // Clear draft on successful submission
      clearDraft()

      showToast.success('Resource submitted successfully! It will be reviewed before appearing publicly.')

      // Redirect after short delay
      setTimeout(() => {
        router.push('/')
      }, 2000)
    } catch (error: any) {
      console.error('Error submitting resource:', error)
      const formattedError = formatErrorForUser(error)
      showToast.error(formattedError.message)
      setShowPreview(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <main id="main-content" className="flex-1" role="main">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Breadcrumbs
            items={[
              { label: 'Home', href: '/' },
              { label: 'Search', href: '/search' },
              { label: 'Submit Resource', href: '#' },
            ]}
          />

          <div className="mt-6 mb-6">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              Back to Home
            </Link>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sm:p-8">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Submit a Resource</h1>
              <p className="text-gray-600">
                Share a resource that has helped you or someone you know. Your submission will be
                reviewed before appearing publicly.
              </p>
            </div>

            <ResourceForm
              initialData={loadDraft() || undefined}
              onSubmit={handleSubmit}
              submitting={submitting}
              errors={errors}
              onDraftSave={handleDraftSave}
            />

            {/* Draft Save Indicator */}
            <div className="mt-4 text-xs text-gray-500 text-center">
              <Save className="w-4 h-4 inline mr-1" aria-hidden="true" />
              Draft automatically saved
            </div>
          </div>
        </div>
      </main>

      {/* Preview Modal */}
      {showPreview && formData && (
        <ResourcePreviewModal
          data={formData}
          onClose={() => setShowPreview(false)}
          onConfirm={handleConfirmSubmit}
          submitting={submitting}
        />
      )}

      <Footer />
    </div>
  )
}