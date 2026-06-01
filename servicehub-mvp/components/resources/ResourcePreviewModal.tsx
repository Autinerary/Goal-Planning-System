'use client'

import { X, CheckCircle, MapPin, Phone, Mail, Globe } from 'lucide-react'
import type { ResourceFormData } from './ResourceForm'
import type { Location, ContactInfo } from '@/types/database'

interface ResourcePreviewModalProps {
  data: ResourceFormData
  onClose: () => void
  onConfirm: () => void
  submitting?: boolean
}

const categoryLabels: { [key: string]: string } = {
  therapist: 'Therapist',
  school: 'School',
  doctor: 'Doctor',
  park: 'Park',
  store: 'Store',
  app: 'App',
  book: 'Book',
  support_group: 'Support Group',
  organization: 'Organization',
  workshop: 'Workshop',
  recreation: 'Recreation',
  other: 'Other',
}

export default function ResourcePreviewModal({
  data,
  onClose,
  onConfirm,
  submitting = false,
}: ResourcePreviewModalProps) {
  const location = data.location
  const contactInfo = data.contact_info
  const imagePreview = data.image ? URL.createObjectURL(data.image) : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-semibold text-gray-900">Preview Your Submission</h2>
          <button
            onClick={onClose}
            disabled={submitting}
            className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Close preview"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Image */}
          {imagePreview && (
            <div>
              <img
                src={imagePreview}
                alt={data.name}
                className="w-full h-64 object-cover rounded-lg border border-gray-200"
              />
            </div>
          )}

          {/* Basic Information */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Basic Information</h3>
            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium text-gray-500">Name</div>
                <div className="text-base text-gray-900">{data.name}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Category</div>
                <div className="text-base text-gray-900">
                  {categoryLabels[data.category] || data.category}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Description</div>
                <div className="text-base text-gray-900 whitespace-pre-wrap">{data.description}</div>
              </div>
            </div>
          </section>

          {/* Location */}
          {location && (
            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Location</h3>
              <div className="space-y-2 text-base text-gray-900">
                {location.address && (
                  <div className="flex items-start">
                    <MapPin className="w-5 h-5 mr-2 mt-0.5 text-gray-500 flex-shrink-0" aria-hidden="true" />
                    <div>
                      <div className="font-medium">{location.address}</div>
                      {location.city && (
                        <div className="text-sm text-gray-600">
                          {location.city}
                          {location.province && `, ${location.province}`}
                          {location.postal_code && ` ${location.postal_code}`}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {(location.lat || location.lng) && (
                  <div className="text-sm text-gray-600 ml-7">
                    Coordinates: {location.lat}, {location.lng}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Contact Details */}
          {(contactInfo?.phone || contactInfo?.email || contactInfo?.website) && (
            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Contact Details</h3>
              <div className="space-y-2 text-base text-gray-900">
                {contactInfo.phone && (
                  <div className="flex items-center">
                    <Phone className="w-5 h-5 mr-2 text-gray-500 flex-shrink-0" aria-hidden="true" />
                    <a
                      href={`tel:${contactInfo.phone}`}
                      className="hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                    >
                      {contactInfo.phone}
                    </a>
                  </div>
                )}
                {contactInfo.email && (
                  <div className="flex items-center">
                    <Mail className="w-5 h-5 mr-2 text-gray-500 flex-shrink-0" aria-hidden="true" />
                    <a
                      href={`mailto:${contactInfo.email}`}
                      className="hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                    >
                      {contactInfo.email}
                    </a>
                  </div>
                )}
                {contactInfo.website && (
                  <div className="flex items-center">
                    <Globe className="w-5 h-5 mr-2 text-gray-500 flex-shrink-0" aria-hidden="true" />
                    <a
                      href={contactInfo.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded break-all"
                    >
                      {contactInfo.website}
                    </a>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Recommendation Reason */}
          {data.recommendation_reason && (
            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Why You&apos;re Recommending This</h3>
              <div className="text-base text-gray-900 whitespace-pre-wrap">
                {data.recommendation_reason}
              </div>
            </section>
          )}

          {/* Info Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Submission Review</p>
                <p>
                  Your submission will be reviewed before appearing publicly. We&apos;ll notify you once
                  it&apos;s approved or if we need more information.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Go Back
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Submitting...' : 'Confirm & Submit'}
          </button>
        </div>
      </div>
    </div>
  )
}