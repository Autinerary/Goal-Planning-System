/**
 * The Path Market's models and filters (the team's notes, October 2026):
 *
 *   * Filters like ResourceHub's, with "Path Categories" first: the five life
 *     categories (Education, Career, Relationships, Health & Wellness, Norms),
 *     each opening onto its specialised categories. A specialised category
 *     can be under several ("Medicine & Science" under Career and Education).
 *   * Every model is a whole path: its categories, its norms (and connection
 *     type, e.g. self-diagnosed, as ResourceHub has it), its races, each with
 *     its milestones, the people on it, its contributors and a short
 *     description. A path can be one race and no people.
 *   * Models have unique names ("Medicine & Science Foundations", "Model Jet")
 *     and "Start this Path".
 *
 * Nothing here invents a race or a milestone: a model's races are what its
 * contributor wrote (or its starting goals, with no steps yet), and step
 * ideas are the category's own examples.
 */

export const PATH_CATEGORIES = [
  { id: 'education', label: 'Education', emoji: '🎓' },
  { id: 'career', label: 'Career', emoji: '💼' },
  { id: 'relationships', label: 'Relationships', emoji: '❤️' },
  { id: 'health', label: 'Health & Wellness', emoji: '🏥' },
  { id: 'barrier', label: 'Norms', emoji: '🌟' },
] as const

export type LifeArea = (typeof PATH_CATEGORIES)[number]['id']
const LIFE_AREA_IDS = PATH_CATEGORIES.map((c) => c.id) as readonly string[]
export const isLifeArea = (v: unknown): v is LifeArea => typeof v === 'string' && LIFE_AREA_IDS.includes(v)

/** Until STEP 85 is in the database: the same life categories it sets. */
export const DEFAULT_LIFE_AREAS: Record<string, LifeArea[]> = {
  'med-sci': ['education', 'career'],
  living: ['barrier', 'health'],
  career: ['career'],
  education: ['education'],
  health: ['health'],
  relationships: ['relationships'],
  creative: ['career', 'relationships'],
  travel: ['barrier'],
  adulting: ['barrier'],
  recovery: ['health'],
  nutrition: ['health'],
  veganism: ['health'],
  entrepreneurship: ['career', 'barrier'],
  'public-health': ['education', 'career'],
}

/** STEP 85's new name, shown before it reaches the database. */
export const RENAMED: Record<string, string> = {
  'Entrepreneurship & ADHD/Neurodivergence': 'Entrepreneurship & Neurodivergence',
}

export type ModelStatus = 'live' | 'coming' | 'pending'

export interface MarketCategory {
  key: string
  title: string
  blurb: string
  focusCategory: string
  examples: string[]
  lifeAreas: LifeArea[]
  foundations: { description: string; seedGoals: string[]; status: 'live' | 'coming' }
}

export interface Race {
  name: string
  /** The life category it is about, for where its goal goes in setup. */
  area: LifeArea | 'other'
  milestones: string[]
}

export interface Person {
  role: string
  note?: string
}

export interface MarketModel {
  key: string
  id?: string
  name: string
  description: string
  status: ModelStatus
  categoryKeys: string[]
  norms: string[]
  connectionTypes: string[]
  races: Race[]
  people: Person[]
  contributors: string[]
  /** Smaller steps that could join a race: the category's own examples. */
  stepIdeas: string[]
  community: boolean
  isOwn?: boolean
}

/** A category's areas: what the database says, else STEP 85's, else its focus. */
export function lifeAreasOf(key: string, stored: unknown, focus: string): LifeArea[] {
  const list = Array.isArray(stored) ? stored.filter(isLifeArea) : []
  if (list.length) return list
  if (DEFAULT_LIFE_AREAS[key]) return DEFAULT_LIFE_AREAS[key]
  return isLifeArea(focus) ? [focus] : []
}

/** The area a race's goal is about: the category's focus when it is one of the five. */
function areaFor(category: MarketCategory | undefined): LifeArea | 'other' {
  if (!category) return 'other'
  if (isLifeArea(category.focusCategory)) return category.focusCategory
  return category.lifeAreas[0] || 'other'
}

/** Each category's general starter, named for its category so no two share a name. */
export function foundationsModel(c: MarketCategory): MarketModel {
  return {
    key: `${c.key}-foundations`,
    name: `${c.title} Foundations`,
    description: c.foundations.description || c.blurb,
    status: c.foundations.status,
    categoryKeys: [c.key],
    norms: [],
    connectionTypes: [],
    races: c.foundations.seedGoals.map((name) => ({ name, area: areaFor(c), milestones: [] })),
    people: [],
    contributors: ['Autinerary team'],
    stepIdeas: c.examples,
    community: false,
  }
}

const strings = (v: unknown, max = 20): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()).map((x) => x.trim()).slice(0, max) : []

/** A model from path_models (GET /api/path-models), whole. */
export function communityModel(row: any, byKey: Record<string, MarketCategory>): MarketModel {
  const categoryKeys = strings(row.categoryKeys).length ? strings(row.categoryKeys) : strings([row.categoryKey])
  const first = byKey[categoryKeys[0]]
  const stored = Array.isArray(row.races) ? row.races : []
  const races: Race[] = stored.length
    ? stored
        .filter((r: any) => r && typeof r.name === 'string' && r.name.trim())
        .slice(0, 8)
        .map((r: any) => ({
          name: r.name.trim(),
          area: isLifeArea(r.area) ? r.area : areaFor(first),
          milestones: strings(r.milestones, 12),
        }))
    : strings(row.seedGoals, 8).map((name) => ({ name, area: areaFor(first), milestones: [] }))
  const contributors = strings(row.contributors).length ? strings(row.contributors) : strings([row.contributor])
  return {
    key: `community-${row.id}`,
    id: row.id,
    name: String(row.name || 'Path model'),
    description: String(row.description || ''),
    status: row.status === 'live' || row.status === 'approved' ? 'live' : 'pending',
    categoryKeys,
    norms: strings(row.norms, 12),
    connectionTypes: strings(row.connectionTypes, 6),
    races,
    people: (Array.isArray(row.people) ? row.people : [])
      .filter((p: any) => p && typeof p.role === 'string' && p.role.trim())
      .slice(0, 10)
      .map((p: any) => ({ role: p.role.trim(), ...(typeof p.note === 'string' && p.note.trim() ? { note: p.note.trim() } : {}) })),
    contributors,
    stepIdeas: categoryKeys.flatMap((k) => byKey[k]?.examples || []).filter((v, i, a) => a.indexOf(v) === i).slice(0, 8),
    community: true,
    isOwn: !!row.isOwn,
  }
}

export interface MarketFilters {
  areas: string[]
  categories: string[]
  norms: string[]
  connections: string[]
  status: string[]
  q: string
}

export const NO_FILTERS: MarketFilters = { areas: [], categories: [], norms: [], connections: [], status: [], q: '' }

export const isFiltered = (f: MarketFilters) =>
  !!(f.areas.length || f.categories.length || f.norms.length || f.connections.length || f.status.length || f.q.trim())

/** The life categories a model is under, through its categories. */
export function modelAreas(m: MarketModel, byKey: Record<string, MarketCategory>): Set<string> {
  return new Set(m.categoryKeys.flatMap((k) => byKey[k]?.lifeAreas || []))
}

/**
 * Whether a model passes the filters. Specialised categories, when any are
 * chosen, narrow their life categories; otherwise a chosen life category
 * takes everything under it. Norms and connection types: any chosen one.
 */
export function matches(m: MarketModel, f: MarketFilters, byKey: Record<string, MarketCategory>): boolean {
  if (f.categories.length || f.areas.length) {
    const inCategory = m.categoryKeys.some((k) => f.categories.includes(k))
    // A life category with none of its specialised ones chosen takes them all.
    const openAreas = f.areas.filter((a) => !f.categories.some((k) => byKey[k]?.lifeAreas.includes(a as LifeArea)))
    const areas = modelAreas(m, byKey)
    const inArea = openAreas.some((a) => areas.has(a))
    if (!inCategory && !inArea) return false
  }
  if (f.norms.length && !m.norms.some((n) => f.norms.includes(n))) return false
  if (f.connections.length && !m.connectionTypes.some((c) => f.connections.includes(c))) return false
  if (f.status.length && !f.status.includes(m.status)) return false
  const q = f.q.trim().toLowerCase()
  if (q) {
    const text = [
      m.name, m.description, ...m.contributors, ...m.races.map((r) => r.name), ...m.races.flatMap((r) => r.milestones),
      ...m.categoryKeys.map((k) => byKey[k]?.title || ''), ...m.stepIdeas,
    ].join(' ').toLowerCase()
    if (!text.includes(q)) return false
  }
  return true
}

/** How many models each option would show, with the other filters as they are. */
export function facetCounts(models: MarketModel[], f: MarketFilters, byKey: Record<string, MarketCategory>) {
  const count = (patch: Partial<MarketFilters>) => models.filter((m) => matches(m, { ...f, ...patch }, byKey)).length
  const out = { areas: {} as Record<string, number>, categories: {} as Record<string, number>, norms: {} as Record<string, number>, connections: {} as Record<string, number>, status: {} as Record<string, number> }
  for (const a of PATH_CATEGORIES) out.areas[a.id] = count({ areas: [a.id], categories: [] })
  for (const k of Object.keys(byKey)) out.categories[k] = count({ areas: [], categories: [k] })
  for (const n of new Set(models.flatMap((m) => m.norms))) out.norms[n] = count({ norms: [n] })
  for (const c of new Set(models.flatMap((m) => m.connectionTypes))) out.connections[c] = count({ connections: [c] })
  for (const s of ['live', 'coming', 'pending']) out.status[s] = count({ status: [s] })
  return out
}

/** Available first, then coming, then waiting for review; categories in their order. */
export function sortModels(models: MarketModel[], order: string[]): MarketModel[] {
  const rank = { live: 0, coming: 1, pending: 2 } as const
  const pos = (m: MarketModel) => Math.min(...m.categoryKeys.map((k) => (order.indexOf(k) < 0 ? 999 : order.indexOf(k))), 999)
  return [...models].sort((a, b) => rank[a.status] - rank[b.status] || pos(a) - pos(b) || Number(a.community) - Number(b.community) || a.name.localeCompare(b.name))
}

// Norms as setup stores them (its labels), as ResourceHub's ids.
const NORM_IDS: Record<string, string> = {
  autism: 'autism', 'autism spectrum': 'autism', adhd: 'adhd', ocd: 'ocd', 'bipolar disorder': 'bipolar', bipolar: 'bipolar',
  depression: 'depression', anxiety: 'mental_health', 'mental health considerations': 'mental_health',
  'sensory impairment': 'sensory_deaf', 'deaf or hard of hearing': 'sensory_deaf', 'blind or low vision': 'sensory_blind',
  'physical impairment': 'physical_mobility', 'mobility challenges': 'physical_mobility', 'wheelchair user': 'physical_wheelchair',
  'intellectual disabilities': 'intellectual', 'chronic illness': 'chronic_health', 'chronic pain': 'chronic_health',
  'chronic health conditions': 'chronic_health', 'racialized person (visible minority)': 'race_visible_minority',
  'visible minority': 'race_visible_minority', 'race/visible minority': 'race_visible_minority',
  'english as an additional language': 'language', 'language barrier': 'language', 'primary language': 'language',
  'first generation': 'ethnicity', 'religious minority': 'ethnicity', ethnicity: 'ethnicity', gender: 'gender',
  'gender identity': 'gender', 'lgbtq+': 'lgbtq', 'limited income': 'socioeconomic', 'food insecurity': 'socioeconomic',
  'housing instability': 'socioeconomic', 'limited technology access': 'socioeconomic', 'socioeconomic considerations': 'socioeconomic',
  'substance use / recovery': 'substance_use',
}

/** The person's norms (as setup saved them) as ResourceHub's ids, for "Match my norms". */
export function userNormIds(labels: readonly string[]): string[] {
  return Array.from(new Set(labels.map((l) => NORM_IDS[String(l || '').trim().toLowerCase()]).filter((x): x is string => !!x)))
}

/** Pathways asked for that have no content yet: listed, never filled in by us. */
export const AWAITING: { name: string; note: string; categories: string[]; areas: LifeArea[] }[] = [
  { name: 'Model Jet', note: 'Life organization with ADHD, OCD and Depression. Its labels are set; waiting for Odosa’s model.', categories: ['entrepreneurship'], areas: ['career', 'barrier'] },
  { name: 'Adulting for Neurodivs', note: 'Awaiting contributor milestones and resources.', categories: ['adulting'], areas: ['barrier'] },
  { name: 'Addictions', note: 'Awaiting qualified clinical review; no recovery curriculum supplied.', categories: ['recovery'], areas: ['health'] },
  { name: 'Healthy Options / Eating Healthy', note: 'Awaiting reviewed resources.', categories: ['nutrition'], areas: ['health'] },
  { name: 'Veganism', note: 'Awaiting reviewed resources, including the proposed cultural version.', categories: ['veganism'], areas: ['health'] },
  { name: 'Undergraduate study', note: 'A separate stream from medical-school admission.', categories: ['education', 'public-health'], areas: ['education'] },
  { name: 'Getting into Med School', note: 'Awaiting institution-specific admission resources.', categories: ['med-sci'], areas: ['education', 'career'] },
  { name: 'Nursing', note: 'A separate stream from becoming a doctor.', categories: ['public-health'], areas: ['education', 'career'] },
  { name: 'Doctor', note: 'Awaiting jurisdiction-specific training resources.', categories: ['med-sci', 'public-health'], areas: ['education', 'career'] },
  { name: 'Public Health', note: 'Awaiting reviewed curriculum; no program supplied.', categories: ['public-health'], areas: ['education', 'career'] },
  { name: 'Entrepreneurship & Neurodivergence', note: 'Awaiting Odosa and Aayush’s reviewed material.', categories: ['entrepreneurship'], areas: ['career', 'barrier'] },
  { name: 'Parents', note: 'Awaiting contributor models and resources.', categories: [], areas: ['relationships'] },
  { name: 'Siblings', note: 'Awaiting contributor models and resources.', categories: [], areas: ['relationships'] },
  { name: 'Young Leaders', note: 'Awaiting contributor models and resources.', categories: [], areas: ['career'] },
  { name: 'Neurodiv', note: 'Awaiting contributor models and resources.', categories: [], areas: ['barrier'] },
  { name: 'Visible Minorities', note: 'Awaiting contributor models and resources.', categories: [], areas: ['barrier'] },
]

/** The awaited pathways the category filters and search allow. */
export function awaitingFor(f: MarketFilters, byKey: Record<string, MarketCategory>) {
  const q = f.q.trim().toLowerCase()
  return AWAITING.filter((p) => {
    if (q && !`${p.name} ${p.note}`.toLowerCase().includes(q)) return false
    if (f.categories.length || f.areas.length) {
      const inCategory = p.categories.some((k) => f.categories.includes(k))
      const openAreas = f.areas.filter((a) => !f.categories.some((k) => byKey[k]?.lifeAreas.includes(a as LifeArea)))
      if (!inCategory && !p.areas.some((a) => openAreas.includes(a))) return false
    }
    // Norms, connection types and status describe models, which these aren't yet.
    return !(f.norms.length || f.connections.length || f.status.length)
  })
}

export interface StartSeed {
  key: string
  title: string
  goals: string[]
  selectedGoals: string[]
  selectedRaces: { goal: string; area: string }[]
  stepIdeas: Record<string, string[]>
  focusCategory: string
  suggestions: string[]
  modelName: string
  categoryTitle: string
  description: string
}

/**
 * What "Start this Path" hands to setup (localStorage autinerary_path_seed):
 * the races chosen become goals in their own areas, and the steps chosen go
 * with their race's goal, for the planner to use (stepIdeas).
 */
export function startSeed(
  m: MarketModel,
  first: MarketCategory | undefined,
  chosenRaces: string[],
  chosenSteps: Record<string, string[]>,
): StartSeed {
  const races = m.races.filter((r) => chosenRaces.includes(r.name))
  const stepIdeas: Record<string, string[]> = {}
  for (const r of races) {
    const steps = (chosenSteps[r.name] || []).filter((s) => s.trim())
    if (steps.length) stepIdeas[r.name] = Array.from(new Set(steps)).slice(0, 8)
  }
  return {
    key: `${m.categoryKeys[0] || 'path'}:${m.key}`,
    title: m.name,
    goals: m.races.map((r) => r.name),
    selectedGoals: races.map((r) => r.name),
    selectedRaces: races.map((r) => ({ goal: r.name, area: r.area })),
    stepIdeas,
    focusCategory: first?.focusCategory || races[0]?.area || 'other',
    suggestions: first?.examples || [],
    modelName: m.name,
    categoryTitle: first?.title || '',
    description: m.description,
  }
}
