'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, X, AlertCircle, CheckCircle } from 'lucide-react'
import CategorySelect from './CategorySelect'
import LocationSearch from './LocationSearch'
import type { Location, ContactInfo } from '@/types/database'
import imageCompression from 'browser-image-compression'

interface ResourceFormProps {
  initialData?: {
    name?: string
    category?: string
    description?: string
    location?: Location | null
    contact_info?: ContactInfo
    price?: number | null
    image_url?: string
    recommendation_reason?: string
  }
  onSubmit: (data: ResourceFormData) => Promise<void>
  submitting?: boolean
  errors?: { [key: string]: string }
  onDraftSave?: (data: Partial<ResourceFormData>) => void
}

export interface ResourceFormData {
  name: string
  category: string
  description: string
  location: Location | null
  contact_info: ContactInfo
  price?: number | null
  image?: File
  recommendation_reason?: string
}

const MAX_DESCRIPTION_LENGTH = 1000
const MAX_RECOMMENDATION_LENGTH = 500

const AUTO_SAVE_INTERVAL = 30000 // 30 seconds

export default function ResourceForm({
  initialData,
  onSubmit,
  submitting = false,
  errors = {},
  onDraftSave,
}: ResourceFormProps) {
  const [name, setName] = useState(initialData?.name || '')
  const [category, setCategory] = useState(initialData?.category || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [location, setLocation] = useState<Location | null>(initialData?.location || null)
  const [phone, setPhone] = useState(initialData?.contact_info?.phone || '')
  const [email, setEmail] = useState(initialData?.contact_info?.email || '')
  const [website, setWebsite] = useState(initialData?.contact_info?.website || '')
  const [price, setPrice] = useState(initialData?.price ? initialData.price.toString() : '')
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(
    initialData?.image_url || null
  )
  const [recommendationReason, setRecommendationReason] = useState(
    initialData?.recommendation_reason || ''
  )
  const [localErrors, setLocalErrors] = useState<{ [key: string]: string }>(errors)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const autoSaveTimerRef = useRef<NodeJS.Timeout>()

  // Sync errors prop
  useEffect(() => {
    setLocalErrors(errors)
  }, [errors])

  // Auto-save draft every 30 seconds
  useEffect(() => {
    if (!onDraftSave) return

    const saveDraft = () => {
      if (name.trim() || category || description.trim() || location) {
        onDraftSave({
          name: name.trim() || undefined,
          category: category || undefined,
          description: description.trim() || undefined,
          location: location || undefined,
          contact_info: {
            phone: phone.trim() || undefined,
            email: email.trim() || undefined,
            website: website.trim() || undefined,
          },
          price: price.trim() ? parseFloat(price.trim()) : null,
          recommendation_reason: recommendationReason.trim() || undefined,
        })
      }
    }

    // Initial save
    saveDraft()

    // Auto-save every 30 seconds
    autoSaveTimerRef.current = setInterval(saveDraft, AUTO_SAVE_INTERVAL)

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current)
      }
    }
  }, [name, category, description, location, phone, email, website, price, recommendationReason, onDraftSave])

  const validatePhone = (phone: string): boolean => {
    if (!phone) return true // Optional field
    // Basic phone validation (allows various formats)
    const phoneRegex = /^[\d\s\-\+\(\)]+$/
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10
  }

  const validateEmail = (email: string): boolean => {
    if (!email) return true // Optional field
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const validateURL = (url: string): boolean => {
    if (!url) return true // Optional field
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`)
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
    } catch {
      return false
    }
  }

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setLocalErrors((prev) => ({
        ...prev,
        image: 'File must be an image',
      }))
      return
    }

    try {
      // Compress image
      const compressedFile = await imageCompression(file, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      })

      setImage(compressedFile)
      setImagePreview(URL.createObjectURL(compressedFile))
      setLocalErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors.image
        return newErrors
      })
    } catch (error) {
      console.error('Error compressing image:', error)
      setLocalErrors((prev) => ({
        ...prev,
        image: 'Failed to process image',
      }))
    }
  }

  const handleRemoveImage = () => {
    setImage(null)
    setImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Clear previous errors
    setLocalErrors({})

    // Validate form
    const newErrors: { [key: string]: string } = {}

    if (!name.trim()) {
      newErrors.name = 'Name is required'
    }

    if (!category) {
      newErrors.category = 'Category is required'
    }

    if (description.length > MAX_DESCRIPTION_LENGTH) {
      newErrors.description = `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less`
    }

    if (phone && !validatePhone(phone)) {
      newErrors.phone = 'Please enter a valid phone number'
    }

    if (email && !validateEmail(email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    if (website && !validateURL(website)) {
      newErrors.website = 'Please enter a valid URL'
    }

    if (recommendationReason.length > MAX_RECOMMENDATION_LENGTH) {
      newErrors.recommendation_reason = `Recommendation reason must be ${MAX_RECOMMENDATION_LENGTH} characters or less`
    }

    if (Object.keys(newErrors).length > 0) {
      setLocalErrors(newErrors)
      return
    }

    // Prepare form data
    const formData: ResourceFormData = {
      name: name.trim(),
      category,
      description: description.trim(),
      location,
      contact_info: {
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        website: website.trim() || undefined,
      },
      price: price.trim() ? parseFloat(price.trim()) : null,
      recommendation_reason: recommendationReason.trim() || undefined,
    }

    if (image) {
      formData.image = image
    }

    await onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Basic Information</h2>

        {/* Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-900 mb-2">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (localErrors.name) {
                setLocalErrors((prev) => {
                  const newErrors = { ...prev }
                  delete newErrors.name
                  return newErrors
                })
              }
            }}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              localErrors.name ? 'border-red-300 bg-red-50' : 'border-gray-300'
            }`}
            placeholder="Enter resource name"
            required
          />
          {localErrors.name && (
            <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" aria-hidden="true" />
              {localErrors.name}
            </p>
          )}
        </div>

        {/* Category */}
        <CategorySelect
          value={category}
          onChange={(value) => {
            setCategory(value)
            if (localErrors.category) {
              setLocalErrors((prev) => {
                const newErrors = { ...prev }
                delete newErrors.category
                return newErrors
              })
            }
          }}
          required
          error={localErrors.category}
        />

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-900 mb-2">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value)
              if (localErrors.description) {
                setLocalErrors((prev) => {
                  const newErrors = { ...prev }
                  delete newErrors.description
                  return newErrors
                })
              }
            }}
            rows={6}
            maxLength={MAX_DESCRIPTION_LENGTH}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              localErrors.description ? 'border-red-300 bg-red-50' : 'border-gray-300'
            }`}
            placeholder="Describe this resource..."
            required
          />
          <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
            <span>{description.length}/{MAX_DESCRIPTION_LENGTH} characters</span>
            {localErrors.description && (
              <span className="text-red-600 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" aria-hidden="true" />
                {localErrors.description}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Location */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Location</h2>
        <LocationSearch value={location} onChange={setLocation} error={localErrors.location} />
      </section>

      {/* Contact Details */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Contact Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Phone */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-900 mb-2">
              Phone <span className="text-gray-500 text-xs">(Optional)</span>
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value)
                if (localErrors.phone) {
                  setLocalErrors((prev) => {
                    const newErrors = { ...prev }
                    delete newErrors.phone
                    return newErrors
                  })
                }
              }}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                localErrors.phone ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="(123) 456-7890"
            />
            {localErrors.phone && (
              <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" aria-hidden="true" />
                {localErrors.phone}
              </p>
            )}
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-900 mb-2">
              Email <span className="text-gray-500 text-xs">(Optional)</span>
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (localErrors.email) {
                  setLocalErrors((prev) => {
                    const newErrors = { ...prev }
                    delete newErrors.email
                    return newErrors
                  })
                }
              }}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                localErrors.email ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="example@email.com"
            />
            {localErrors.email && (
              <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" aria-hidden="true" />
                {localErrors.email}
              </p>
            )}
          </div>

          {/* Website */}
          <div className="sm:col-span-2">
            <label htmlFor="website" className="block text-sm font-medium text-gray-900 mb-2">
              Website <span className="text-gray-500 text-xs">(Optional)</span>
            </label>
            <input
              id="website"
              type="url"
              value={website}
              onChange={(e) => {
                setWebsite(e.target.value)
                if (localErrors.website) {
                  setLocalErrors((prev) => {
                    const newErrors = { ...prev }
                    delete newErrors.website
                    return newErrors
                  })
                }
              }}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                localErrors.website ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="https://example.com"
            />
            {localErrors.website && (
              <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" aria-hidden="true" />
                {localErrors.website}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Price */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Pricing</h2>
        <div>
          <label htmlFor="price" className="block text-sm font-medium text-gray-900 mb-2">
            Price (in dollars) <span className="text-gray-500 text-xs">(Optional, leave blank for free resources)</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500 sm:text-sm">$</span>
            </div>
            <input
              id="price"
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => {
                setPrice(e.target.value)
                if (localErrors.price) {
                  setLocalErrors((prev) => {
                    const newErrors = { ...prev }
                    delete newErrors.price
                    return newErrors
                  })
                }
              }}
              className={`w-full pl-7 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                localErrors.price ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="0.00"
            />
          </div>
          {localErrors.price && (
            <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" aria-hidden="true" />
              {localErrors.price}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500">Leave blank if the resource is free or pricing is not applicable.</p>
        </div>
      </section>

      {/* Photo */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Photo</h2>
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Main Image <span className="text-gray-500 text-xs">(Optional, max 500KB)</span>
          </label>
          {imagePreview ? (
            <div className="relative inline-block">
              <img
                src={imagePreview}
                alt="Preview"
                className="h-48 w-auto rounded-lg border border-gray-200 object-cover"
              />
              <button
                type="button"
                onClick={handleRemoveImage}
                className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-full hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                aria-label="Remove image"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <Upload className="w-6 h-6 mx-auto mb-2 text-gray-400" aria-hidden="true" />
                <span className="text-sm font-medium text-gray-700">Upload Image</span>
              </button>
            </div>
          )}
          {localErrors.image && (
            <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" aria-hidden="true" />
              {localErrors.image}
            </p>
          )}
        </div>
      </section>

      {/* Recommendation Reason */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Why are you recommending this?</h2>
        <div>
          <label htmlFor="recommendation-reason" className="block text-sm font-medium text-gray-900 mb-2">
            Your Recommendation <span className="text-gray-500 text-xs">(Optional)</span>
          </label>
          <textarea
            id="recommendation-reason"
            value={recommendationReason}
            onChange={(e) => {
              setRecommendationReason(e.target.value)
              if (localErrors.recommendation_reason) {
                setLocalErrors((prev) => {
                  const newErrors = { ...prev }
                  delete newErrors.recommendation_reason
                  return newErrors
                })
              }
            }}
            rows={4}
            maxLength={MAX_RECOMMENDATION_LENGTH}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              localErrors.recommendation_reason ? 'border-red-300 bg-red-50' : 'border-gray-300'
            }`}
            placeholder="Tell others why you recommend this resource..."
          />
          <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
            <span>{recommendationReason.length}/{MAX_RECOMMENDATION_LENGTH} characters</span>
            {localErrors.recommendation_reason && (
              <span className="text-red-600 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" aria-hidden="true" />
                {localErrors.recommendation_reason}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Submission Review</p>
            <p>
              Your submission will be reviewed before appearing publicly. We'll notify you once it's
              approved or if we need more information.
            </p>
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Submitting...' : 'Submit for Review'}
        </button>
      </div>
    </form>
  )
}