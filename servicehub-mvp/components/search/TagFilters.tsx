'use client'

import { COMMUNITY_GROUP_TAGS, SERVICE_AGES, SERVICE_TAGS, type CostType } from '@/lib/filters/tags'

/**
 * Free or paid, the kind of service, online, and the age of a service (the
 * team's planning note, October 2026, "Goal 1: Service Directory"). Tags come
 * from lib/filters/tags.ts; choosing "Paid" also offers sorting by cost.
 */
export default function TagFilters({
  tags,
  costType,
  online,
  age,
  hasLocation,
  onTagToggle,
  onCostChange,
  onOnlineChange,
  shortWait = false,
  onShortWaitChange,
  onAgeChange,
}: {
  tags: string[]
  costType?: CostType
  online: boolean
  age?: string
  hasLocation: boolean
  onTagToggle: (id: string) => void
  onCostChange: (next: CostType | undefined) => void
  onOnlineChange: (next: boolean) => void
  /** Waits of a month or less (the 5Qs report: wait times; STEP 83). */
  shortWait?: boolean
  onShortWaitChange?: (next: boolean) => void
  onAgeChange: (next: string | undefined) => void
}) {
  const box = 'h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'
  return (
    <>
      <fieldset>
        <legend className="text-sm font-semibold text-gray-900 mb-2">Free or paid</legend>
        <div className="flex flex-wrap gap-2">
          {[
            { id: undefined, label: 'Either' },
            { id: 'free' as const, label: 'Free' },
            { id: 'paid' as const, label: 'Paid' },
          ].map((o) => (
            <label key={o.label} className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 text-sm text-gray-800">
              <input type="radio" name="costType" checked={costType === o.id} onChange={() => onCostChange(o.id)} className="h-4 w-4 text-blue-600" />
              {o.label}
            </label>
          ))}
        </div>
        {costType === 'paid' && <p className="mt-2 text-xs text-gray-600">You can now sort by cost, above the results.</p>}
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold text-gray-900 mb-2">Kind of service</legend>
        <div className="space-y-1">
          {SERVICE_TAGS.map((t) => (
            <div key={t.id}>
              <label className="flex items-start gap-2 rounded p-1.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={tags.includes(t.id)} onChange={() => onTagToggle(t.id)} className={`${box} mt-0.5`} />
                <span>
                  {t.label}
                  {t.id === 'requires_diagnosis' && <span className="block text-xs text-gray-600">{t.note}</span>}
                </span>
              </label>
              {/* How a community group meets, once community groups are chosen. */}
              {t.id === 'community_group' && tags.includes('community_group') && (
                <div className="ml-7 space-y-1 border-l-2 border-gray-200 pl-3">
                  {COMMUNITY_GROUP_TAGS.map((m) => (
                    <label key={m.id} className="flex items-start gap-2 p-1 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={tags.includes(m.id)} onChange={() => onTagToggle(m.id)} className={`${box} mt-0.5`} />
                      <span>
                        {m.label}
                        {m.id === 'community_local' && tags.includes('community_local') && !hasLocation && (
                          <a href="/profile#location" className="block text-xs font-medium text-blue-700 underline">
                            Local needs your city: set your location
                          </a>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold text-gray-900 mb-2">Online</legend>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" checked={online} onChange={() => onOnlineChange(!online)} className={box} />
          Only services offered online
        </label>
      </fieldset>

      {onShortWaitChange && (
        <fieldset>
          <legend className="text-sm font-semibold text-gray-900 mb-2">Wait</legend>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={shortWait} onChange={() => onShortWaitChange(!shortWait)} className={box} />
            A short wait (a month or less)
          </label>
          <p className="mt-1 text-xs text-gray-700">From what people who used it said, or what the service says.</p>
        </fieldset>
      )}

      <div>
        <label htmlFor="service-age" className="text-sm font-semibold text-gray-900">
          Age of service
        </label>
        <select
          id="service-age"
          value={age || ''}
          onChange={(e) => onAgeChange(e.target.value || undefined)}
          className="mt-2 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
        >
          <option value="">Any age</option>
          {SERVICE_AGES.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-600">How long ago it started, or was added here.</p>
      </div>
    </>
  )
}
