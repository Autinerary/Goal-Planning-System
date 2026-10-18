'use client'

import { useState } from 'react'
import { LIFE_AREAS } from '@/lib/search/lifeAreas'
import {
  ADULTING_TAGS,
  CAREER_TAGS,
  EDUCATION_DOMAINS,
  EDUCATION_LEVELS_CA,
  EDUCATION_PROGRAMS,
  PARENTING_TAGS,
  educationLevelsFor,
  type Tag,
} from '@/lib/filters/tags'

/**
 * Life categories, each with its own choices once chosen (the team's planning
 * note, October 2026): Education (education navigation: level, domains of
 * post-secondary education, programs and options, and the school system where
 * the person lives), Career (workplace life, career level), Adulting and
 * Parenting. The choices are tags (lib/filters/tags.ts).
 */
export default function LifeCategoryFilters({
  lifeAreas,
  tags,
  country,
  onLifeAreaToggle,
  onTagToggle,
}: {
  lifeAreas: string[]
  tags: string[]
  /** The person's country, for "the school system where I live". */
  country?: string | null
  onLifeAreaToggle: (id: string) => void
  onTagToggle: (id: string) => void
}) {
  // Canada's school system unless the person lives in the United States and keeps this on.
  const [local, setLocal] = useState(true)
  const levels = local ? educationLevelsFor(country) : EDUCATION_LEVELS_CA
  const box = 'h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'

  const list = (id: string, label: string, items: Tag[], scroll = false) => (
    <fieldset className="mt-2">
      <legend className="text-xs font-semibold uppercase tracking-wide text-gray-600">{label}</legend>
      <div className={`mt-1 space-y-0.5 ${scroll ? 'max-h-48 overflow-y-auto pr-1' : ''}`} id={id}>
        {items.map((t) => (
          <label key={t.id} className={`flex items-center gap-2 p-1 text-sm text-gray-700 cursor-pointer ${t.parent ? 'ml-5' : ''}`}>
            <input type="checkbox" checked={tags.includes(t.id)} onChange={() => onTagToggle(t.id)} className={box} />
            {t.label}
          </label>
        ))}
      </div>
    </fieldset>
  )

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 mb-1">Life Category</h3>
      <p className="text-xs text-gray-600 mb-3">Choose one to see its own choices.</p>
      <div className="space-y-2">
        {LIFE_AREAS.map((area) => {
          const on = lifeAreas.includes(area.id)
          return (
            <div key={area.id}>
              <label className="flex items-center cursor-pointer hover:bg-gray-50 p-2 rounded">
                <input type="checkbox" checked={on} onChange={() => onLifeAreaToggle(area.id)} className={box} />
                <span className="ml-2 text-sm text-gray-700">{area.label}</span>
              </label>
              {on && area.id === 'afterschool' && (
                <div className="ml-6 border-l-2 border-gray-200 pl-3 pb-2">
                  <p className="text-sm font-medium text-gray-900">Education navigation</p>
                  {list('edu-levels', 'Level of education', levels)}
                  <label className="mt-1 flex items-start gap-2 text-xs text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={local} onChange={() => setLocal(!local)} className={`${box} mt-0.5`} />
                    <span>
                      Match the school system where I live
                      {country ? ` (${country})` : ''}
                    </span>
                  </label>
                  {list('edu-domains', 'Domains of post-secondary education', EDUCATION_DOMAINS, true)}
                  {list('edu-programs', 'Programs and options', EDUCATION_PROGRAMS)}
                </div>
              )}
              {on && area.id === 'workplace' && (
                <div className="ml-6 border-l-2 border-gray-200 pl-3 pb-2">
                  {list('career-life', 'Workplace', CAREER_TAGS.slice(0, 1))}
                  {list('career-level', 'Career level', CAREER_TAGS.slice(1))}
                </div>
              )}
              {on && area.id === 'adulting' && <div className="ml-6 border-l-2 border-gray-200 pl-3 pb-2">{list('adulting', 'Adulting', ADULTING_TAGS)}</div>}
              {on && area.id === 'parenting' && <div className="ml-6 border-l-2 border-gray-200 pl-3 pb-2">{list('parenting', 'Age group', PARENTING_TAGS)}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
