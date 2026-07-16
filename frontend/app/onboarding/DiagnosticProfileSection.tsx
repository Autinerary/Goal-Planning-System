'use client'

import { ChevronDown, LockKeyhole, ShieldCheck } from 'lucide-react'
import {
  CONDITION_BY_LABEL,
  CONDITION_GROUPS,
  STATUS_OPTIONS,
  type ConditionOption,
  type DiagnosticProfile,
  type SupportContext,
} from '@/lib/diagnostic-profile'

interface DiagnosticProfileSectionProps {
  selectedBarriers: string[]
  value: DiagnosticProfile
  onChange: (value: DiagnosticProfile) => void
  showConsent?: boolean
}

function updateSupport(
  value: DiagnosticProfile,
  onChange: (value: DiagnosticProfile) => void,
  patch: Partial<SupportContext>
) {
  onChange({
    ...value,
    supportContext: { ...value.supportContext, ...patch },
  })
}

export default function DiagnosticProfileSection({
  selectedBarriers,
  value,
  onChange,
  showConsent = true,
}: DiagnosticProfileSectionProps) {
  const knownSelections = selectedBarriers
    .map((label) => CONDITION_BY_LABEL.get(label.toLowerCase()))
    .filter((condition): condition is ConditionOption => Boolean(condition))

  const updateCondition = (condition: ConditionOption, patch: Partial<DiagnosticProfile['conditions'][number]>) => {
    const existing = value.conditions.find((item) => item.conditionId === condition.id)
    const next = existing
      ? value.conditions.map((item) => item.conditionId === condition.id ? { ...item, ...patch } : item)
      : [
          ...value.conditions,
          {
            conditionId: condition.id,
            conditionLabel: condition.label,
            status: 'prefer_not_to_say' as const,
            subtypeIds: [],
            notes: '',
            ...patch,
          },
        ]
    onChange({ ...value, conditions: next })
  }

  return (
    <section className="mt-8 border-t border-slate-200 pt-6" aria-labelledby="diagnostic-profile-title">
      <div className="flex items-start gap-3 rounded-lg border border-cyan-200 bg-cyan-50 p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 flex-none text-cyan-700" />
        <div>
          <h3 id="diagnostic-profile-title" className="font-semibold text-slate-900">Optional condition and support details</h3>
          <p className="mt-1 text-sm text-slate-700">
            This is not a diagnostic test and Autinerary does not diagnose conditions. You can share only what feels useful so recommendations can better reflect communication, access, and support needs.
          </p>
        </div>
      </div>

      {knownSelections.length > 0 ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-slate-600">Details appear only for conditions selected above. Every field below is optional.</p>
          {knownSelections.map((condition) => {
            const response = value.conditions.find((item) => item.conditionId === condition.id)
            return (
              <details key={condition.id} className="group rounded-lg border border-slate-200 bg-white">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-medium text-slate-800">
                  <span>{condition.label}</span>
                  <ChevronDown className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180" />
                </summary>
                <div className="space-y-4 border-t border-slate-100 px-4 py-4">
                  <fieldset>
                    <legend className="mb-2 text-xs font-semibold uppercase text-slate-600">How would you describe this?</legend>
                    <div className="flex flex-wrap gap-2">
                      {STATUS_OPTIONS.map((status) => (
                        <button
                          key={status.id}
                          type="button"
                          onClick={() => updateCondition(condition, { status: status.id })}
                          className={`rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                            response?.status === status.id
                              ? 'border-cyan-600 bg-cyan-50 text-cyan-800'
                              : 'border-slate-200 text-slate-700 hover:border-cyan-300'
                          }`}
                        >
                          {status.label}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  {condition.subtypes && (
                    <fieldset>
                      <legend className="mb-2 text-xs font-semibold uppercase text-slate-600">Optional type or presentation</legend>
                      <div className="space-y-2">
                        {condition.subtypes.map((subtype) => {
                          const checked = response?.subtypeIds.includes(subtype.id) ?? false
                          return (
                            <label key={subtype.id} className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 p-3 hover:border-cyan-300">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  const current = response?.subtypeIds ?? []
                                  const subtypeIds = checked
                                    ? current.filter((id) => id !== subtype.id)
                                    : [...current, subtype.id]
                                  updateCondition(condition, { subtypeIds })
                                }}
                                className="mt-0.5 h-4 w-4 rounded border-slate-300"
                              />
                              <span>
                                <span className="block text-sm font-medium text-slate-800">{subtype.label}</span>
                                {subtype.description && <span className="mt-0.5 block text-xs text-slate-500">{subtype.description}</span>}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    </fieldset>
                  )}

                  <label className="block text-sm font-medium text-slate-700">
                    {condition.notesPrompt ?? 'Optional context or support needs'}
                    <textarea
                      value={response?.notes ?? ''}
                      onChange={(event) => updateCondition(condition, { notes: event.target.value })}
                      rows={2}
                      maxLength={1000}
                      className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200"
                    />
                  </label>
                </div>
              </details>
            )
          })}
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">Select a listed condition above to optionally add type, presentation, or support details.</p>
      )}

      <details className="group mt-4 rounded-lg border border-slate-200 bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-medium text-slate-800">
          <span>General support history and accommodations (optional)</span>
          <ChevronDown className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180" />
        </summary>
        <div className="grid gap-4 border-t border-slate-100 px-4 py-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Approximate therapy hours, if any
            <input
              type="text"
              value={value.supportContext.therapyHours}
              onChange={(event) => updateSupport(value, onChange, { therapyHours: event.target.value })}
              placeholder="e.g. 2 hours per month"
              maxLength={100}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Types of therapy or support tried
            <input
              type="text"
              value={value.supportContext.therapyTypes}
              onChange={(event) => updateSupport(value, onChange, { therapyTypes: event.target.value })}
              maxLength={500}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm font-medium text-slate-700 md:col-span-2">
            Have medications been part of your support?
            <select
              value={value.supportContext.medicationHistory}
              onChange={(event) => updateSupport(value, onChange, { medicationHistory: event.target.value as SupportContext['medicationHistory'] })}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Choose only if you want to</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </label>
          {[
            ['sensoryNeeds', 'Sensory needs or differences (light, sound, smell, touch, movement)'],
            ['strategiesWorked', 'Strategies or methods that helped'],
            ['strategiesNotWorked', 'Strategies or methods that did not help'],
            ['schoolAccommodations', 'School accommodations, if any'],
            ['workplaceAccommodations', 'Workplace accommodations, if any'],
            ['biggestChallenge', 'Biggest ongoing challenge'],
            ['biggestChallengeResponse', 'What you tried for that challenge and what happened'],
            ['recentChallenge', 'Most recent challenge'],
            ['recentChallengeResponse', 'What you tried recently and what happened'],
          ].map(([field, label]) => (
            <label key={field} className="text-sm font-medium text-slate-700">
              {label}
              <textarea
                value={value.supportContext[field as keyof SupportContext]}
                onChange={(event) => updateSupport(value, onChange, { [field]: event.target.value })}
                rows={2}
                maxLength={1000}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          ))}
        </div>
      </details>

      {showConsent && (
        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <input
            type="checkbox"
            checked={value.consentToStore}
            onChange={(event) => onChange({ ...value, consentToStore: event.target.checked })}
            className="mt-0.5 h-4 w-4 rounded border-slate-300"
          />
          <span>
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <LockKeyhole className="h-4 w-4 text-cyan-700" /> Save these optional details privately
            </span>
            <span className="mt-1 block text-xs text-slate-600">
              Stored in your private account for personalization. Not shared publicly, not used to diagnose you, and removable later. Leave unchecked to continue without saving these details.
            </span>
          </span>
        </label>
      )}
    </section>
  )
}
