'use client'

import { Phone, Mail, Globe, MapPin, Navigation } from 'lucide-react'
import type { ResourceDetail } from '@/lib/supabase/queries'
import ResourceBadgesLoader from '../ResourceBadgesLoader'
import RelatedTidbits from '../RelatedTidbits'
import ServiceMap from './ServiceMap'
import ContactActions from './ContactActions'
import type { Location, ContactInfo } from '@/types/database'
import { costLabel } from '../ResourceCard'
import { SERVICE_TAGS, tagLabel } from '@/lib/filters/tags'

interface ResourceContentProps {
  resource: ResourceDetail
}

export default function ResourceContent({ resource }: ResourceContentProps) {
  const location = resource.location as Location | null
  const contactInfo = resource.contact_info as ContactInfo | null

  const hasLocation = location && (location.lat || location.address)
  const hasContact = contactInfo && (contactInfo.phone || contactInfo.email || contactInfo.website)

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-8">
      <ResourceBadgesLoader resourceId={resource.id} surprisingFind={Array.isArray((resource as any).tags) && (resource as any).tags.includes('surprising_find')} />

      {/* Description */}
      {resource.description && (
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">About</h2>
          <p className="text-gray-700 whitespace-pre-wrap">{resource.description}</p>
        </section>
      )}

      {/* Cost, how it is offered, and its tags (the planning note, October 2026). */}
      <ServiceFacts resource={resource} />

      <RelatedTidbits resourceName={resource.name} />

      {/* Location Map */}
      {hasLocation && (
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Location</h2>
          <div className="mb-4 space-y-2 text-gray-700">
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
          </div>
          {(location.lat && location.lng) ? (
            <>
              <ServiceMap lat={location.lat} lng={location.lng} name={resource.name} />
              <div className="mt-4">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                >
                  <Navigation className="w-4 h-4" aria-hidden="true" />
                  Get Directions
                </a>
              </div>
            </>
          ) : (
            <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
              Map not available (coordinates missing)
            </div>
          )}
        </section>
      )}

      {/* Provider Hours */}
      {contactInfo && (contactInfo as any).hours && (
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Hours of Provider</h2>
          <p className="text-gray-700">{(contactInfo as any).hours}</p>
        </section>
      )}

      {/* Type of Services */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Type of Services</h2>
        <p className="text-gray-700 capitalize">{resource.category}</p>
      </section>

      {/* Contact Information */}
      {hasContact && (
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Contact Details</h2>

          {/* Call / email-draft buttons sit above the raw details: the common
              case is wanting to make contact, not wanting to read an address. */}
          <div className="mb-4">
            <ContactActions
              resourceName={resource.name}
              category={resource.category}
              phone={contactInfo.phone}
              email={contactInfo.email}
            />
          </div>

          <div className="space-y-3">
            {contactInfo.phone && (
              <div className="flex items-center text-gray-700">
                <Phone className="w-5 h-5 mr-3 text-gray-500 flex-shrink-0" aria-hidden="true" />
                <a
                  href={`tel:${contactInfo.phone}`}
                  className="hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                >
                  {contactInfo.phone}
                </a>
              </div>
            )}
            {contactInfo.email && (
              <div className="flex items-center text-gray-700">
                <Mail className="w-5 h-5 mr-3 text-gray-500 flex-shrink-0" aria-hidden="true" />
                <a
                  href={`mailto:${contactInfo.email}`}
                  className="hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                >
                  {contactInfo.email}
                </a>
              </div>
            )}
            {contactInfo.website && (
              <div className="flex items-center text-gray-700">
                <Globe className="w-5 h-5 mr-3 text-gray-500 flex-shrink-0" aria-hidden="true" />
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

      {/* Image */}
      {resource.image_url && (
        <section>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resource.image_url}
            alt={resource.name}
            className="w-full h-auto rounded-lg object-cover"
          />
        </section>
      )}

      {/*
        Where this listing came from.

        Not decoration and not optional. An imported venue arrives under
        a licence, and OpenStreetMap's ODbL makes crediting the source a
        condition of using the data rather than a courtesy. It also tells
        a reader that nobody from this community has checked the place
        yet, which is the more useful half of the message.
      */}
      {(resource as any).source_attribution && (
        <section className="border-t border-gray-200 pt-4 text-xs text-gray-500">
          <p>
            Listing from{' '}
            {(resource as any).source_url ? (
              <a
                href={(resource as any).source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-gray-700"
              >
                {(resource as any).source_attribution}
              </a>
            ) : (
              (resource as any).source_attribution
            )}
            {(resource as any).last_verified_at && (
              <> · last checked against the source on{' '}
                {new Date((resource as any).last_verified_at).toLocaleDateString()}</>
            )}
          </p>
          <p className="mt-1">
            Details like hours and phone numbers come from that source and can go out of date.
            Worth a call before travelling.
          </p>
        </section>
      )}
    </div>
  )
}

function ServiceFacts({ resource }: { resource: ResourceDetail }) {
  const r = resource as any
  const cost = costLabel(r)
  const tags: string[] = Array.isArray(r.tags) ? r.tags : []
  const delivery = { in_person: 'In person', online: 'Online', both: 'In person and online' }[String(r.delivery)] || null
  if (!cost && !delivery && tags.length === 0) return null
  const requires = SERVICE_TAGS.find((t) => t.id === 'requires_diagnosis')
  return (
    <section aria-labelledby="facts-heading">
      <h2 id="facts-heading" className="text-xl font-semibold text-gray-900 mb-3">At a glance</h2>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {cost && (
          <div>
            <dt className="font-medium text-gray-900">Cost</dt>
            <dd className="text-gray-700">
              {cost}
              {r.cost_source === 'usual' && (
                <span className="block text-xs text-gray-600">
                  {r.cost_type === 'free' ? 'Usually free for this kind of place.' : 'Usually paid for this kind of place; the cost is not listed.'}
                </span>
              )}
            </dd>
          </div>
        )}
        {delivery && (
          <div>
            <dt className="font-medium text-gray-900">Offered</dt>
            <dd className="text-gray-700">{delivery}</dd>
          </div>
        )}
      </dl>
      {tags.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Tags">
          {tags.map((t) => (
            <li key={t} className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
              {tagLabel(t)}
            </li>
          ))}
        </ul>
      )}
      {tags.includes('requires_diagnosis') && requires?.note && (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{requires.note}</p>
      )}
    </section>
  )
}
