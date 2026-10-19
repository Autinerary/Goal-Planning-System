import taxonomy from './taxonomy.json'

/**
 * The shop's vocabulary, for the app's Resource Accounts (vendors adding and
 * editing products). The same file as ResourceHub's
 * (servicehub-mvp/lib/shop/taxonomy.json, kept in step by
 * scripts/qa/check-taxonomy.mjs): 40 categories in 11 groups, and the
 * qualities per group.
 */
export const SHOP_GROUPS = taxonomy.groups
export const SHOP_CATEGORIES = taxonomy.categories
export const QUALITIES = taxonomy.qualities

const CAT = new Map(taxonomy.categories.map((c) => [c.id, c]))
export const isShopCategory = (id: unknown) => typeof id === 'string' && CAT.has(id)
export const groupOf = (category: string) => CAT.get(category)?.group || 'other'
export const qualitiesFor = (category: string) => {
  const g = groupOf(category)
  return taxonomy.qualities.filter((q) => q.groups.includes('*') || q.groups.includes(g))
}

/** The kinds of service a provider can add (the checked lists' categories, scripts/import-curated-services.mjs). */
export const SERVICE_CATEGORIES = ['Therapist', 'Doctor', 'School', 'Education Support', 'Social Services', 'Support Group', 'Employment', 'Recreation', 'Legal & Future Planning', 'Funding & Benefits', 'Organization']
