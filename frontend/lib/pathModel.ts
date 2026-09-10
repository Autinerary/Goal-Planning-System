'use client'

/**
 * The Path Market model a path was started from.
 *
 * Starting a model in the Path Market only ever wrote a localStorage seed that
 * onboarding consumed for goal suggestions and then deleted, so nothing
 * recorded which model a path came from. This reads the record onboarding now
 * keeps.
 *
 * `norms` are the user's own onboarding answers, not properties of the model —
 * `path_models` has no norms column, and inferring them from a model name
 * would be invention.
 */

export interface ChosenPathModel {
  key: string
  /** "Career · Model Az" — category and model together. */
  title: string
  /** Model name alone, e.g. "Model Az". Null for a category's Foundations. */
  name: string | null
  categoryTitle: string | null
  description: string | null
  /** Norms the user selected during onboarding. */
  norms: string[]
}

export function loadChosenPathModel(): ChosenPathModel | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem('autinerary_profile')
    if (!raw) return null
    const model = JSON.parse(raw)?.pathModel
    if (!model || typeof model.key !== 'string') return null
    return {
      key: model.key,
      title: model.title || 'Your path',
      name: model.name ?? null,
      categoryTitle: model.categoryTitle ?? null,
      description: model.description ?? null,
      norms: Array.isArray(model.norms) ? model.norms.filter(Boolean) : [],
    }
  } catch {
    return null
  }
}

/** Short label for the Races header — the model name, nothing else. */
export function pathModelShortName(model: ChosenPathModel | null): string | null {
  if (!model) return null
  return model.name && model.name !== 'Foundations'
    ? model.name
    : model.categoryTitle || model.title
}
