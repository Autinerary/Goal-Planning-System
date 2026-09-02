'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'
import { 
  User, Check, ChevronRight, ChevronLeft, Loader2,
  Target, Sparkles, Heart, Zap, AlertCircle, Palette, Rocket
} from 'lucide-react'
import {
  AGE_RANGES, TECH_SAVVY, VIEW_PREFERENCES, REMINDER_TIMES, DEFAULT_REMINDERS,
  savePreferences, type ReminderPreferences,
} from '@/lib/preferences'
import { isSimpleView } from '@/lib/disclosure'
import { buildAvatarSvg, HAIR_COLORS, SKIN_TONES, DEFAULT_HAIR_COLOR, DEFAULT_SKIN_TONE } from '@/lib/avatar'
import UserAvatar from '@/app/components/UserAvatar'
import { playPageTurnSound } from '@/lib/taskSound'
import DiagnosticProfileSection from './DiagnosticProfileSection'
import {
  CONDITION_GROUPS,
  EMPTY_DIAGNOSTIC_PROFILE,
  toRecommendationSupportContext,
  type DiagnosticProfile,
} from '@/lib/diagnostic-profile'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const SERVICE_HUB_URL = process.env.NEXT_PUBLIC_SERVICE_HUB_URL || 'http://localhost:3001'
// Character avatar options — spirit animal selection is done later in the Spirit Animals step
const characterTypes = [
  { id: 'avatar', label: 'Create Your Avatar', description: 'Design a character that looks like you', icon: '👤' },
]

const hairStyles = [
  { id: 'short_straight', label: 'Short & Straight', emoji: '💇' },
  { id: 'short_curly', label: 'Short & Curly', emoji: '🌀' },
  { id: 'long_straight', label: 'Long & Straight', emoji: '💇‍♀️' },
  { id: 'long_curly', label: 'Long & Curly', emoji: '🌊' },
  { id: 'braids', label: 'Braids', emoji: '🎀' },
  { id: 'buzz', label: 'Buzz Cut', emoji: '✂️' },
  { id: 'none', label: 'No Hair / Bald', emoji: '🌟' },
]

const bodyTypes = [
  { id: 'tall', label: 'Tall' },
  { id: 'short', label: 'Short' },
]

const cloudThemes = [
  { id: 'sunrise', label: 'Sunrise', colors: 'from-orange-200 via-pink-200 to-purple-200' },
  { id: 'daydream', label: 'Daydream', colors: 'from-sky-200 via-blue-100 to-indigo-200' },
  { id: 'sunset', label: 'Sunset', colors: 'from-amber-200 via-rose-200 to-violet-200' },
  { id: 'night', label: 'Night Sky', colors: 'from-indigo-300 via-purple-300 to-slate-300' },
]

// Spirit animal options for the spirit animal step
const spiritAnimalOptions = [
  { id: 'bunny', emoji: '🐰', label: 'Bunny' },
  { id: 'fox', emoji: '🦊', label: 'Fox' },
  { id: 'owl', emoji: '🦉', label: 'Owl' },
  { id: 'cat', emoji: '🐱', label: 'Cat' },
  { id: 'dog', emoji: '🐶', label: 'Dog' },
  { id: 'bear', emoji: '🐻', label: 'Bear' },
  { id: 'deer', emoji: '🦌', label: 'Deer' },
  { id: 'butterfly', emoji: '🦋', label: 'Butterfly' },
  { id: 'turtle', emoji: '🐢', label: 'Turtle' },
  { id: 'penguin', emoji: '🐧', label: 'Penguin' },
  { id: 'dolphin', emoji: '🐬', label: 'Dolphin' },
  { id: 'dragon', emoji: '🐉', label: 'Dragon' },
]

const spiritAnimalColors = [
  { id: 'pink', label: 'Pink', hex: '#f472b6', bg: 'bg-pink-300' },
  { id: 'blue', label: 'Blue', hex: '#60a5fa', bg: 'bg-blue-300' },
  { id: 'purple', label: 'Purple', hex: '#a78bfa', bg: 'bg-purple-300' },
  { id: 'green', label: 'Green', hex: '#4ade80', bg: 'bg-green-300' },
  { id: 'orange', label: 'Orange', hex: '#fb923c', bg: 'bg-orange-300' },
  { id: 'gold', label: 'Gold', hex: '#fbbf24', bg: 'bg-yellow-300' },
  { id: 'teal', label: 'Teal', hex: '#2dd4bf', bg: 'bg-teal-300' },
  { id: 'red', label: 'Red', hex: '#f87171', bg: 'bg-red-300' },
]

// Spirit animal modes (Odosa): how many animals the user assigns.
const spiritAnimalModes = [
  { id: 'general', label: 'One spirit animal', desc: 'A single guide for every day.', count: 1, emoji: '🐾' },
  { id: 'fastSlow', label: 'Fast & slow day', desc: 'Two guides — one for high-energy days, one for rest days.', count: 2, emoji: '⚡' },
  { id: 'weekly', label: 'One per weekday', desc: 'Seven guides — a different animal for each day of the week.', count: 7, emoji: '📅' },
] as const

// Labels for the 7-per-week mode slots.
const weekdayLabels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/** How many spirit-animal slots a mode uses. */
function spiritAnimalSlotCount(mode: 'general' | 'fastSlow' | 'weekly'): number {
  return spiritAnimalModes.find(m => m.id === mode)?.count ?? 2
}

/** Label for a spirit-animal slot given the mode and index. */
function spiritAnimalSlotLabel(mode: 'general' | 'fastSlow' | 'weekly', idx: number): string {
  if (mode === 'general') return '🐾 Your Spirit Animal'
  if (mode === 'fastSlow') return idx === 0 ? '⚡ Fast Day Spirit Animal' : '🌙 Slow Day Spirit Animal'
  return `${weekdayLabels[idx] || `Day ${idx + 1}`} Spirit Animal`
}

// Step components
const steps = [
  { id: 'character', title: 'Character Select', icon: User },
  { id: 'barrierConnections', title: 'Your Norms', icon: AlertCircle },
  { id: 'location', title: 'Location', icon: User },
  { id: 'goalsAndDreams', title: 'Goals & Dreams', icon: Target },
  { id: 'motivation', title: 'Motivation Style', icon: Zap },
  { id: 'profile', title: 'Dream Self', icon: Palette },
  { id: 'spiritAnimal', title: 'Spirit Animals', icon: Heart },
  { id: 'personalize', title: 'Personalize', icon: Palette },
  { id: 'recommendations', title: 'AI Recommendations', icon: Sparkles },
]

// Steps the user is allowed to skip without filling anything in. The core
// steps (barriers, location, goals) stay required.
const skippableSteps = new Set([0, 4, 5, 6, 7])

const goalCategories = [
  { id: 'education', label: 'Education', emoji: '🎓', placeholder: 'e.g., Graduate university, Learn a trade' },
  { id: 'career', label: 'Career', emoji: '💼', placeholder: 'e.g., Get a tech job, Start a business' },
  { id: 'relationships', label: 'Relationships', emoji: '❤️', placeholder: 'e.g., Build a support network, Improve communication' },
  { id: 'health', label: 'Healthcare & Wellness', emoji: '🏥', placeholder: 'e.g., Find an ADHD coach, Start therapy' },
  // Odosa: never show the word "barrier". The id stays for data matching.
  { id: 'barrier', label: 'Norms', emoji: '🌟', placeholder: 'e.g., Normalizing/Positivity, Self-advocacy skills' },
  { id: 'other', label: 'Other', emoji: '✨', placeholder: 'e.g., Travel, Learn to cook, Move to a new city' },
]

// ── Goal suggestions ──────────────────────────────────────────────────
// Suggest goals based on what the user selected in "Barrier Connections".
// These are gentle, lived-experience prompts (never clinical advice) that a
// user can tap to add as a starting goal. Keyed by barrier item label.

// Strategies that apply to any barrier. "Normalizing/Positivity" is an
// explicit Barrier-Specific strategy (reframing challenges, self-acceptance,
// celebrating strengths).
const universalBarrierStrategies: string[] = [
  'Normalizing/Positivity',
  'Self-advocacy skills',
  'Build a support network',
]

// Barrier-specific goal ideas, grouped by goal category id.
const barrierGoalSuggestions: Record<string, Partial<Record<string, string[]>>> = {
  Autism: {
    barrier: ['Sensory-friendly routines', 'Normalizing/Positivity'],
    career: ['Find neurodivergent-friendly workplaces'],
    relationships: ['Practice social scripts I find helpful'],
  },
  ADHD: {
    barrier: ['Focus & time-management strategies', 'Normalizing/Positivity'],
    education: ['Set up study accommodations'],
    career: ['Find an ADHD-friendly work rhythm'],
  },
  AuDHD: {
    barrier: ['Balance focus & sensory needs', 'Normalizing/Positivity'],
  },
  Dyslexia: {
    barrier: ['Assistive reading tools', 'Normalizing/Positivity'],
    education: ['Request learning accommodations'],
  },
  OCD: {
    barrier: ['Grounding & coping strategies', 'Normalizing/Positivity'],
  },
  Anxiety: {
    barrier: ['Calming & grounding strategies', 'Normalizing/Positivity'],
  },
  'Anxiety Disorder': {
    barrier: ['Calming & grounding strategies', 'Normalizing/Positivity'],
  },
  Depression: {
    barrier: ['Daily wellbeing routine', 'Normalizing/Positivity'],
    health: ['Explore therapy or a support group'],
  },
  'Wheelchair User': {
    barrier: ['Map accessible routes & spaces', 'Self-advocacy skills'],
    career: ['Find accessible workplaces'],
  },
  'Limited Mobility': {
    barrier: ['Find accessible spaces & tools'],
  },
  Blind: {
    barrier: ['Screen-reader & assistive tech skills'],
  },
  'Low Vision': {
    barrier: ['Screen-reader & assistive tech skills'],
  },
  Deaf: {
    barrier: ['Captioning & communication tools'],
    relationships: ['Build a signing / Deaf community network'],
  },
  'Hard of Hearing': {
    barrier: ['Captioning & communication tools'],
  },
  'Language Barrier': {
    education: ['Improve language skills'],
    barrier: ['Find translation & interpreter support'],
  },
  'First Generation': {
    education: ['Find first-gen mentorship'],
    career: ['Build professional networks'],
  },
  'Immigrant / Refugee': {
    barrier: ['Find newcomer support services'],
    career: ['Get credentials recognized'],
  },
  'Limited Income': {
    barrier: ['Find financial assistance programs'],
  },
  'Housing Instability': {
    barrier: ['Find housing support services'],
  },
  'Limited Technology Access': {
    barrier: ['Find low-cost tech & internet programs'],
  },
}

/**
 * Build suggested goals for a category based on the user's selected barriers.
 * Returns a de-duplicated list. The Barrier-Specific category always includes
 * the universal strategies (Normalizing/Positivity, etc.).
 */
function getGoalSuggestions(categoryId: string, barrierTypes: string[]): string[] {
  const out = new Set<string>()

  if (categoryId === 'barrier') {
    universalBarrierStrategies.forEach(s => out.add(s))
  }

  barrierTypes.forEach(barrier => {
    const perCategory = barrierGoalSuggestions[barrier]?.[categoryId]
    perCategory?.forEach(s => out.add(s))
  })

  return Array.from(out)
}

const connectionTypes = [
  { id: 'self', label: 'Self (Lived Experience)', icon: '👤' },
  { id: 'parent', label: 'Parent', icon: '👨‍👩‍👧‍👦' },
  { id: 'sibling', label: 'Sibling', icon: '👫' },
  { id: 'educator', label: 'Educator', icon: '📚' },
  { id: 'employer', label: 'Employer', icon: '💼' },
  { id: 'therapist', label: 'Therapist', icon: '🧠' },
  { id: 'researcher', label: 'Researcher', icon: '🔬' },
  { id: 'ally', label: 'Ally', icon: '🤝' },
  { id: 'medical', label: 'Medical Professional (coming soon)', icon: '🏥', disabled: true },
]

const lifeStages = [
  { id: 'preschool', label: 'Preschool (Ages 3-5)' },
  { id: 'elementary', label: 'Elementary School' },
  { id: 'middle_school', label: 'Middle School' },
  { id: 'high_school', label: 'High School / Secondary' },
  { id: 'post_secondary', label: 'University / College / Trade School' },
  { id: 'post_graduate', label: 'Post-Graduate' },
  { id: 'employment', label: 'Employment / Career' },
  { id: 'retirement', label: 'Retirement' },
  { id: 'not_sure', label: "I'm Not Sure" },
]

const barrierCategories = [
  ...CONDITION_GROUPS.map((group) => ({
    name: group.label,
    subcategories: [{ name: 'Conditions and differences', items: group.conditions.map((condition) => condition.label) }],
  })),
  {
    name: 'Social & Cultural',
    subcategories: [
      { name: 'Identity', items: ['Visible Minority', 'LGBTQ+', 'Gender Identity', 'Religious Minority'] },
      { name: 'Circumstance', items: ['Language Barrier', 'First Generation', 'Immigrant / Refugee'] },
    ]
  },
  {
    name: 'Economic & Access',
    subcategories: [
      { name: 'Economic', items: ['Limited Income', 'Food Insecurity', 'Housing Instability'] },
      { name: 'Access', items: ['Limited Technology Access', 'Rural / Remote Area', 'Transportation Barrier'] },
    ]
  },
]

const motivationOptions = [
  { 
    value: 'intrinsic', 
    label: 'Intrinsic', 
    description: 'Driven by personal satisfaction and internal goals',
    emoji: '🧠'
  },
  { 
    value: 'achievement', 
    label: 'Achievement', 
    description: 'Motivated by accomplishments and milestones',
    emoji: '🏆'
  },
  { 
    value: 'social', 
    label: 'Social Connection', 
    description: 'Energized by community and relationships',
    emoji: '👥'
  },
  { 
    value: 'reward', 
    label: 'Reward-Based', 
    description: 'Responds well to incentives and treats',
    emoji: '🎁'
  },
  { 
    value: 'deadline', 
    label: 'Deadline-Driven', 
    description: 'Works best with time pressure',
    emoji: '⏰'
  },
  { 
    value: 'curiosity', 
    label: 'Curiosity', 
    description: 'Motivated by learning and discovery',
    emoji: '🔍'
  },
]

// CSS animations for bunny
const bunnyStyles = `
  @keyframes bunnyHop {
    0%, 100% { transform: translateX(-50%) translateY(-50%) translateY(0px); }
    50% { transform: translateX(-50%) translateY(-50%) translateY(-10px); }
  }
  @keyframes bounce {
    0%, 100% { transform: translate(-50%, -50%) scale(1); }
    50% { transform: translate(-50%, -50%) scale(1.2); }
  }
`

// ── Character-select avatar ───────────────────────────────────────────────
// Code-generated character avatar (DiceBear "avataaars", inline SVG) so people
// can actually see what they're picking — a video-game-style character select.
// Replaces the old hand-drawn SVG, which looked "wonky" (Odosa/Eliyana). Only
// the user's choices (hairstyle, hair colour, skin tone) vary; see lib/avatar.
function CharacterAvatar({
  hairStyle = '',
  hairColor,
  skinColor,
  size = 96,
}: { hairStyle?: string; hairColor?: string; skinColor?: string; size?: number }) {
  const svg = useMemo(
    () => buildAvatarSvg({ hairStyle, hairColor, skinColor, size }),
    [hairStyle, hairColor, skinColor, size]
  )
  return (
    <div
      style={{ width: size, height: size }}
      role="img"
      aria-label="Character preview"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

export default function OnboardingPage() {
  const router = useRouter()
  const { user, completeOnboarding, isLoading: authLoading } = useAuth()
  const [currentStep, setCurrentStep] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Path generation takes ~55s alone and ~90s when a few people submit at once
  // (both measured against production). A static spinner for that long reads as
  // frozen — people refresh, abandon the request, and report it as broken.
  // Count the seconds and say what is happening instead.
  const [elapsed, setElapsed] = useState(0)
  // Stage reported by the job itself. Preferred over the elapsed-time guess
  // below, which is only a stand-in for when the server cannot tell us.
  const [generationStage, setGenerationStage] = useState<string>('')
  useEffect(() => {
    if (!isSubmitting) { setElapsed(0); return }
    const t = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(t)
  }, [isSubmitting])
  
  // Rocket ship launch animation state
  const [showRocketTransition, setShowRocketTransition] = useState(false)

  const [formData, setFormData] = useState({
    // Character select
    characterType: 'avatar' as string, // always avatar now (spirit animal selection at end)
    bodyType: '' as string,
    hairStyle: '' as string,
    hairColor: DEFAULT_HAIR_COLOR as string,
    skinColor: DEFAULT_SKIN_TONE as string,
    cloudTheme: 'daydream' as string,
    // Barrier Connections (combined role + barriers)
    role: '' as string, // kept for backward compat with backend
    barrierConnections: {} as Record<string, string[]>, // { connectionType: [barriers] }
    barrierConnectionText: '' as string, // free-text mode input
    // Questions
    location: {
      city: '',
      province: '',
      country: ''
    },
    additionalLocations: [] as Array<{ city: string; province: string; country: string }>,
    lifeStage: '' as string,
    barrierTypes: [] as string[],
    // Categorized goals with per-goal dreams and obstacles
    goalsByCategory: {} as Record<string, Array<{ goal: string; dreams: string; obstacles: string; idealRelationship?: string }>>,
    ultimateDream: '' as string,
    // Flat arrays kept for backward compat with backend API
    goals: [''] as string[],
    dreams: [''] as string[],
    currentChallenges: [''] as string[],
    motivationType: '' as string,
    motivationTypes: [] as string[],
    // View & interaction preferences (recorded for intersecting-profile insights)
    ageRange: '' as string,
    techSavvy: '' as string,
    viewPreference: '' as string,
    // Daily goal-reminder opt-in (storage/consent groundwork; delivery not yet wired)
    reminders: { ...DEFAULT_REMINDERS } as ReminderPreferences,
    // Profile customization
    dreamSelf: '',
    // Alternate Persona (optional) — a named alter-ego for the Dream Self
    alternatePersonaName: '' as string,
    alternatePersonaNote: '' as string,
    // Spirit animals — mode decides how many slots:
    //   general = 1, fastSlow = 2 (fast/slow day), weekly = 7 (one per day)
    spiritAnimalMode: 'fastSlow' as 'general' | 'fastSlow' | 'weekly',
    spiritAnimals: [] as Array<{ type: string; color: string }>,
  })

  // Active Path Market context (null when the user started their own path).
  // Drives the pathway banner and the tailored goal suggestions so a chosen
  // path doesn't feel identical to the generic onboarding.
  const [pathSeed, setPathSeed] = useState<
    { key: string; title: string; focusCategory: string; suggestions: string[] } | null
  >(null)
  // True when we prefilled stable answers (barriers/location/etc.) from a prior
  // completed onboarding so a returning user doesn't re-enter everything.
  const [carriedOver, setCarriedOver] = useState(false)
  // Simple view starts new users with just one spirit animal (Eliyana: "cut the
  // fast/slow day spirit animals for simple view"). Set after mount to avoid a
  // hydration mismatch. `showAdvancedModes` lets them opt into fast/slow/weekly.
  const [simpleView, setSimpleView] = useState(false)
  const [showAdvancedModes, setShowAdvancedModes] = useState(false)

  const [barrierInputMode, setBarrierInputMode] = useState<'text' | 'manual'>('manual')
  // Free-text custom barriers the user adds per connection (e.g. "public speaking").
  const [customBarrierDraft, setCustomBarrierDraft] = useState<Record<string, string>>({})
  // Sensitive optional details intentionally stay out of the localStorage
  // onboarding draft. They are persisted only after explicit consent.
  const [diagnosticProfile, setDiagnosticProfile] = useState<DiagnosticProfile>(() => ({
    ...EMPTY_DIAGNOSTIC_PROFILE,
    conditions: [],
    supportContext: { ...EMPTY_DIAGNOSTIC_PROFILE.supportContext },
  }))

  const selectedBarrierTypes = formData.barrierTypes.length > 0
    ? formData.barrierTypes
    : formData.barrierConnectionText.trim()
      ? [formData.barrierConnectionText.trim()]
      : []
  const recommendationSupportContext = toRecommendationSupportContext(diagnosticProfile)
  
  const [recommendations, setRecommendations] = useState<any[]>([])
  const [savedResources, setSavedResources] = useState<Set<string>>(new Set())
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false)
  const [recommendationExplanation, setRecommendationExplanation] = useState('')

  // ─── Autosave: persist progress to localStorage so it survives page reloads ───
  const AUTOSAVE_KEY = 'autinerary_onboarding_draft'
  // Stable answers from the last completed onboarding, reused to prefill when a
  // returning user starts another path (see the carry-over block on mount).
  const CARRYOVER_KEY = 'autinerary_onboarding_carryover'

  // Restore saved draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY)
      let restoredDraft = false
      if (saved) {
        const { step, data } = JSON.parse(saved)
        if (data && typeof step === 'number') {
          setFormData(prev => ({ ...prev, ...data }))
          setCurrentStep(step)
          restoredDraft = true
        }
      }

      // Path Market seed — if the user picked a path template, capture its
      // context (for the banner + tailored suggestions) and pre-fill its goals
      // into that path's focus category so onboarding feels tailored, not
      // identical to "start your own path". Kept in localStorage until submit so
      // it survives a reload; the clobber guard below prevents re-seeding.
      const seedRaw = localStorage.getItem('autinerary_path_seed')
      if (seedRaw) {
        const seed = JSON.parse(seedRaw)
        const focusCategory: string = seed?.focusCategory || 'other'
        if (seed?.key) {
          setPathSeed({
            key: seed.key,
            title: seed.title || 'Your path',
            focusCategory,
            suggestions: Array.isArray(seed.suggestions) ? seed.suggestions : [],
          })
        }
        if (seed?.goals?.length) {
          setFormData(prev => {
            const existing = prev.goalsByCategory || {}
            if (Object.keys(existing).length > 0) return prev // don't clobber a resumed draft
            return {
              ...prev,
              goalsByCategory: {
                [focusCategory]: seed.goals.map((g: string) => ({ goal: g, dreams: '', obstacles: '' })),
              },
            }
          })
        }
      }

      // Carry-over — a returning user starting another path shouldn't re-enter
      // stable answers. If there's no in-progress draft, prefill barriers,
      // location, life stage, motivation and view preferences from the snapshot
      // saved at their last completed onboarding. Goals are intentionally left
      // blank so they're fresh for the new path.
      if (!restoredDraft) {
        const carryRaw = localStorage.getItem(CARRYOVER_KEY)
        if (carryRaw) {
          const c = JSON.parse(carryRaw)
          if (c && typeof c === 'object') {
            setFormData(prev => ({
              ...prev,
              barrierTypes: Array.isArray(c.barrierTypes) ? c.barrierTypes : prev.barrierTypes,
              location: c.location && typeof c.location === 'object' ? c.location : prev.location,
              lifeStage: c.lifeStage || prev.lifeStage,
              motivationType: c.motivationType || prev.motivationType,
              motivationTypes: Array.isArray(c.motivationTypes) ? c.motivationTypes : prev.motivationTypes,
              ageRange: c.ageRange || prev.ageRange,
              techSavvy: c.techSavvy || prev.techSavvy,
              viewPreference: c.viewPreference || prev.viewPreference,
              bodyType: c.bodyType || prev.bodyType,
              hairStyle: c.hairStyle || prev.hairStyle,
              hairColor: c.hairColor || prev.hairColor,
              skinColor: c.skinColor || prev.skinColor,
            }))
            if ((Array.isArray(c.barrierTypes) && c.barrierTypes.length > 0) || c.location?.city) {
              setCarriedOver(true)
            }
          }
        }
      }
    } catch {
      // corrupt data — ignore
    }
  }, [])

  // Save on every step change or formData change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          AUTOSAVE_KEY,
          JSON.stringify({ step: currentStep, data: formData })
        )
      } catch {
        // quota exceeded — ignore
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [currentStep, formData])

  // Clear autosave + consumed path seed on successful submission
  const clearAutosave = () => {
    try {
      localStorage.removeItem(AUTOSAVE_KEY)
      localStorage.removeItem('autinerary_path_seed')
    } catch {}
  }
  // ─────────────────────────────────────────────────────────────────────────────

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/signup')
    }
  }, [user, authLoading, router])

  // Progressive disclosure: brand-new users start in simple view. Read once
  // after mount (SSR-safe — avoids a hydration mismatch).
  useEffect(() => {
    setSimpleView(isSimpleView())
  }, [])

  // While simple view is on and advanced modes aren't expanded, keep the
  // spirit-animal mode at the single "general" guide (cut fast/slow + weekly).
  useEffect(() => {
    if (simpleView && !showAdvancedModes && formData.spiritAnimalMode !== 'general') {
      setSpiritAnimalMode('general')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simpleView, showAdvancedModes])

  const handleBarrierToggle = (barrier: string) => {
    setFormData(prev => ({
      ...prev,
      barrierTypes: prev.barrierTypes.includes(barrier)
        ? prev.barrierTypes.filter(b => b !== barrier)
        : [...prev.barrierTypes, barrier]
    }))
  }

  const updateArrayField = (field: 'goals' | 'dreams' | 'currentChallenges', index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].map((item, i) => i === index ? value : item)
    }))
  }

  const addArrayItem = (field: 'goals' | 'dreams' | 'currentChallenges') => {
    setFormData(prev => ({
      ...prev,
      [field]: [...prev[field], '']
    }))
  }

  const removeArrayItem = (field: 'goals' | 'dreams' | 'currentChallenges', index: number) => {
    if (formData[field].length > 1) {
      setFormData(prev => ({
        ...prev,
        [field]: prev[field].filter((_, i) => i !== index)
      }))
    }
  }

  const canProceed = () => {
    switch (currentStep) {
      case 0: return formData.bodyType !== '' && formData.hairStyle !== '' // Character select — body + hair chosen or skipped
      case 1: return selectedBarrierTypes.length > 0 // Barrier Connections — selection or free-text description
      case 2: return formData.location.city.trim() !== '' && formData.location.province.trim() !== '' && formData.location.country.trim() !== ''
      case 3: { // Goals & Dreams — at least one goal in any category
        const hasGoal = Object.values(formData.goalsByCategory).some(entries => entries.some(e => e.goal.trim()))
        return hasGoal
      }
      case 4: return formData.motivationTypes.length > 0 && formData.lifeStage !== ''
      case 5: return formData.dreamSelf.trim() !== '' // Profile customization
      case 6: return formData.spiritAnimals.length === spiritAnimalSlotCount(formData.spiritAnimalMode) && formData.spiritAnimals.every(a => a.type && a.color) // Spirit animals — all slots for the chosen mode filled
      case 7: return true // Personalize — all optional, can always proceed
      case 8: return true // Recommendations step - can always proceed (optional to save)
      default: return false
    }
  }
  
  // Fetch AI recommendations when reaching the recommendations step
  useEffect(() => {
    if (currentStep === 8 && recommendations.length === 0 && !isLoadingRecommendations) {
      fetchRecommendations()
    }
  }, [currentStep])
  
  const fetchRecommendations = async () => {
    setIsLoadingRecommendations(true)
    try {
      const serviceHubBarriers = mapBarriersToServiceHub(selectedBarrierTypes)
      
      // Derive role from barrierConnections (first key, or 'self' as fallback)
      const connectionKeys = Object.keys(formData.barrierConnections)
      const derivedRole = connectionKeys.length > 0 ? connectionKeys[0] : 'self'
      
      // Flatten goalsByCategory into a goals array (goals live there now, not in formData.goals)
      const flattenedGoals: string[] = []
      const flattenedChallenges: string[] = []
      Object.values(formData.goalsByCategory).forEach(entries => {
        entries.forEach(entry => {
          if (entry.goal.trim()) flattenedGoals.push(entry.goal.trim())
          if (entry.obstacles.trim()) flattenedChallenges.push(entry.obstacles.trim())
        })
      })
      // Fallback to old goals array if goalsByCategory is empty
      const goalsToSend = flattenedGoals.length > 0 
        ? flattenedGoals 
        : formData.goals.filter(g => g.trim())
      const challengesToSend = flattenedChallenges.length > 0
        ? flattenedChallenges
        : formData.currentChallenges.filter(c => c.trim())
      
      // Same-origin proxy — a direct cross-origin POST to ServiceHub was blocked
      // by CORS preflight, which is why this step never worked (Odosa).
      const serviceHubResponse = await axios.post('/api/recommendations', {
        role: derivedRole,
        location: formData.location,
        barriers: serviceHubBarriers,
        lifeStage: formData.lifeStage,
        goals: goalsToSend.length > 0 ? goalsToSend : ['General wellbeing'],
        culturalNotes: '',
        additionalNotes: challengesToSend.join('; '),
        supportContext: recommendationSupportContext,
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
        validateStatus: () => true // Don't throw on any status
      })

      if (serviceHubResponse.status === 200 && serviceHubResponse.data.recommendations) {
        setRecommendations(serviceHubResponse.data.recommendations || [])
        setRecommendationExplanation(serviceHubResponse.data.recommendationExplanation || '')
      } else {
        console.warn('Recommendations API returned:', serviceHubResponse.status, serviceHubResponse.data)
        setRecommendations([])
        setRecommendationExplanation(
          serviceHubResponse.data?.error || 'Recommendations will be available after you sign in to ResourceHub.'
        )
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error)
      setRecommendations([])
      setRecommendationExplanation('Unable to load recommendations at this time. Please try again later.')
    } finally {
      setIsLoadingRecommendations(false)
    }
  }
  
  const handleSaveResource = async (resourceId: string) => {
    // Toggle save state
    if (savedResources.has(resourceId)) {
      setSavedResources(prev => {
        const next = new Set(prev)
        next.delete(resourceId)
        return next
      })
      
      // Try to unsave from ServiceHub if authenticated
      try {
        await axios.delete(`${SERVICE_HUB_URL}/api/resources/${resourceId}/save`, {
          validateStatus: () => true
        })
      } catch (error) {
        // Silent fail
      }
    } else {
      setSavedResources(prev => new Set([...prev, resourceId]))
      
      // Try to save to ServiceHub if user is authenticated
      // Since both apps now use Supabase Auth, the user should be authenticated
      try {
        const response = await axios.post(`${SERVICE_HUB_URL}/api/resources/${resourceId}/save`, {}, {
          validateStatus: () => true
        })
        
        if (response.status === 200 || response.status === 201) {
          console.log('Resource saved to ServiceHub')
        } else if (response.status === 401) {
          // User not authenticated in ServiceHub - will save after sign-in
          console.log('Resource will be saved after ServiceHub sign-in')
        }
      } catch (error) {
        // Silent fail - will be saved when user signs into ServiceHub
        console.log('Resource will be saved after ServiceHub sign-in')
      }
    }
  }

  // Map Goal Planning barriers to ServiceHub format
  const mapBarriersToServiceHub = (barriers: string[]) => {
    const barrierMap: Record<string, { id: string; category: string; categoryLabel: string }> = {
      'Autism': { id: 'autism', category: 'neurodivergence', categoryLabel: 'Neurodivergence' },
      'ADHD': { id: 'adhd', category: 'neurodivergence', categoryLabel: 'Neurodivergence' },
      'OCD': { id: 'ocd', category: 'neurodivergence', categoryLabel: 'Neurodivergence' },
      'Bipolar Disorder': { id: 'bipolar', category: 'neurodivergence', categoryLabel: 'Neurodivergence' },
      'Dyslexia': { id: 'neurodivergence_other', category: 'neurodivergence', categoryLabel: 'Neurodivergence' },
      'Anxiety': { id: 'mental_health', category: 'health', categoryLabel: 'Health' },
      'Depression': { id: 'mental_health', category: 'health', categoryLabel: 'Health' },
      'Sensory Impairment': { id: 'sensory_deaf', category: 'disability', categoryLabel: 'Non-Neurodivergent Disabilities' },
      'Physical Impairment': { id: 'physical_mobility', category: 'disability', categoryLabel: 'Non-Neurodivergent Disabilities' },
      'Chronic Illness': { id: 'chronic_health', category: 'health', categoryLabel: 'Health' },
      'Chronic Pain': { id: 'chronic_health', category: 'health', categoryLabel: 'Health' },
      'Visible Minority': { id: 'race_visible_minority', category: 'identity', categoryLabel: 'Identity & Background' },
      'Language Barrier': { id: 'language', category: 'identity', categoryLabel: 'Identity & Background' },
      'First Generation': { id: 'ethnicity', category: 'identity', categoryLabel: 'Identity & Background' },
      'Gender': { id: 'gender', category: 'identity', categoryLabel: 'Identity & Background' },
      'LGBTQ+': { id: 'lgbtq', category: 'identity', categoryLabel: 'Identity & Background' },
      'Religious Minority': { id: 'ethnicity', category: 'identity', categoryLabel: 'Identity & Background' },
      'Limited Income': { id: 'socioeconomic', category: 'identity', categoryLabel: 'Identity & Background' },
      'Food Insecurity': { id: 'socioeconomic', category: 'identity', categoryLabel: 'Identity & Background' },
      'Housing Instability': { id: 'socioeconomic', category: 'identity', categoryLabel: 'Identity & Background' },
      'Limited Technology Access': { id: 'socioeconomic', category: 'identity', categoryLabel: 'Identity & Background' },
    }

    return barriers.map(barrier => {
      const mapped = barrierMap[barrier] || { id: 'neurodivergence_other', category: 'neurodivergence', categoryLabel: 'Neurodivergence' }
      return {
        id: mapped.id,
        label: barrier,
        category: mapped.category,
        categoryLabel: mapped.categoryLabel,
        severity: 3, // Default severity
        notes: null
      }
    })
  }

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1)
    }
  }

  // Skip an optional step without validating its fields.
  const handleSkip = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1)
    }
  }

  const addSpiritAnimal = () => {
    const max = spiritAnimalSlotCount(formData.spiritAnimalMode)
    if (formData.spiritAnimals.length < max) {
      setFormData(prev => ({
        ...prev,
        spiritAnimals: [...prev.spiritAnimals, { type: '', color: '' }]
      }))
    }
  }

  // Switch mode and resize the slot list to fit (trim extras, keep existing).
  const setSpiritAnimalMode = (mode: 'general' | 'fastSlow' | 'weekly') => {
    const max = spiritAnimalSlotCount(mode)
    setFormData(prev => ({
      ...prev,
      spiritAnimalMode: mode,
      spiritAnimals: prev.spiritAnimals.slice(0, max),
    }))
  }

  const updateSpiritAnimal = (index: number, field: 'type' | 'color', value: string) => {
    setFormData(prev => ({
      ...prev,
      spiritAnimals: prev.spiritAnimals.map((a, i) => i === index ? { ...a, [field]: value } : a)
    }))
  }

  const removeSpiritAnimal = (index: number) => {
    setFormData(prev => ({
      ...prev,
      spiritAnimals: prev.spiritAnimals.filter((_, i) => i !== index)
    }))
  }

  const updateReminders = (patch: Partial<ReminderPreferences>) => {
    setFormData(prev => ({ ...prev, reminders: { ...prev.reminders, ...patch } }))
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }

  const handleSubmit = async () => {
    // Paper/page-turn cue so the submission clearly registered (Liam).
    playPageTurnSound()
    if (!user) return
    
    setIsSubmitting(true)
    try {
      // Only persist a reminder opt-in that's actually complete (enabled +
      // explicit consent + a contact). Otherwise store it disabled so we never
      // record a half-opted-in reminder we couldn't honor.
      const r = formData.reminders
      const remindersToSave: ReminderPreferences =
        r.enabled && r.consent && r.contact.trim()
          ? { ...r, contact: r.contact.trim() }
          : { ...DEFAULT_REMINDERS }

      // Record view/interaction preferences (age, tech savvy, view style) so the
      // rest of the app can adapt and we can learn from intersecting profiles.
      savePreferences({
        ageRange: (formData.ageRange || '') as any,
        techSavvy: (formData.techSavvy || '') as any,
        viewPreference: (formData.viewPreference || '') as any,
        reminders: remindersToSave,
      })

      // Flatten categorized goals into flat arrays for backend compat
      const allGoals: string[] = []
      const allDreams: string[] = []
      const allObstacles: string[] = []
      Object.values(formData.goalsByCategory).forEach(entries => {
        entries.forEach(entry => {
          if (entry.goal.trim()) allGoals.push(entry.goal.trim())
          if (entry.dreams.trim()) allDreams.push(entry.dreams.trim())
          if (entry.idealRelationship?.trim()) allDreams.push(entry.idealRelationship.trim())
          if (entry.obstacles.trim()) allObstacles.push(entry.obstacles.trim())
        })
      })
      if (formData.ultimateDream.trim()) allDreams.push(formData.ultimateDream.trim())

      // The full private profile never enters local autosave or agent payloads.
      // After consent, it is saved separately; agents receive only the bounded
      // functional support context built above (no status, subtype, medication).
      if (diagnosticProfile.consentToStore) {
        const selectedLabels = new Set(formData.barrierTypes.map((barrier) => barrier.toLowerCase()))
        await axios.put('/api/me/diagnostic-profile', {
          ...diagnosticProfile,
          conditions: diagnosticProfile.conditions.filter((condition) =>
            selectedLabels.has(condition.conditionLabel.toLowerCase())
          ),
        }, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000,
        })
      }

      // Send to Goal Planning backend.
      //
      // Async first: POST /jobs returns in milliseconds and the pipeline runs
      // server-side, so a slow generation no longer occupies an HTTP
      // connection for its whole duration. That is what caps how many people
      // can onboard at once — measured at ~55s alone and ~160s at five
      // concurrent, against a client that has to guess a timeout covering the
      // worst case. Polling also survives a reload, which the blocking call
      // never did.
      //
      // Falls back to the blocking endpoint when the job store is unavailable
      // (503), so this cannot make onboarding worse than it already was.
      const onboardingBody = {
        email: user.email,
        userId: user.id, // Supabase auth UUID — shared with ServiceHub via public.user_barriers
        barrierTypes: selectedBarrierTypes,
        goals: allGoals.length > 0 ? allGoals : formData.goals.filter(g => g.trim()),
        dreams: allDreams.length > 0 ? allDreams : formData.dreams.filter(d => d.trim()),
        currentChallenges: allObstacles.length > 0 ? allObstacles : formData.currentChallenges.filter(c => c.trim()),
        motivationType: formData.motivationType,
        supportContext: recommendationSupportContext,
        preferences: {
          ageRange: formData.ageRange,
          techSavvy: formData.techSavvy,
          viewPreference: formData.viewPreference,
          spiritAnimalMode: formData.spiritAnimalMode,
          spiritAnimals: formData.spiritAnimals,
          reminders: remindersToSave,
        },
      }

      let response: { data: { pathId?: string } }

      const enqueued = await axios
        .post(`${API_URL}/api/onboarding/jobs`, onboardingBody, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 20000,
          validateStatus: (status) => status === 202 || status === 503,
        })
        .catch(() => null)

      if (enqueued && enqueued.status === 202 && enqueued.data?.jobId) {
        const jobId = enqueued.data.jobId as string
        // Remembered so a refresh mid-generation can rejoin the same job
        // instead of starting a second one.
        try { localStorage.setItem('autinerary_generation_job', jobId) } catch {}

        // Poll every 3s. Generous ceiling: this is a bound on a stuck job, not
        // an expectation of how long the work takes.
        const deadline = Date.now() + 8 * 60 * 1000
        let pathId: string | undefined
        while (Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 3000))
          const poll = await axios
            .get(`${API_URL}/api/onboarding/jobs/${jobId}`, { timeout: 15000 })
            .catch(() => null)
          if (!poll) continue // a dropped poll is not a failed job
          const { status, stage, pathId: donePathId, error: jobError } = poll.data || {}
          if (stage) setGenerationStage(stage)
          if (status === 'succeeded' && donePathId) { pathId = donePathId; break }
          if (status === 'failed') throw new Error(jobError || 'Path generation failed')
        }
        try { localStorage.removeItem('autinerary_generation_job') } catch {}
        if (!pathId) throw new Error('Path generation is taking longer than expected. Please try again.')
        response = { data: { pathId } }
      } else {
        // Blocking path — job store unavailable or the enqueue never landed.
        response = await axios.post(`${API_URL}/api/onboarding/`, onboardingBody, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 360000,
        })
      }

      // Save saved resources to ServiceHub if user is authenticated
      // Since both apps use Supabase Auth, try to save directly
      if (savedResources.size > 0) {
        const resourcesToSave = Array.from(savedResources)
        
        // Try to save each resource to ServiceHub
        for (const resourceId of resourcesToSave) {
          try {
            await axios.post(`${SERVICE_HUB_URL}/api/resources/${resourceId}/save`, {}, {
              validateStatus: () => true
            })
          } catch (error) {
            // If save fails, store in localStorage for later sync
            const pendingResources = JSON.parse(localStorage.getItem('pendingSavedResources') || '[]')
            if (!pendingResources.includes(resourceId)) {
              pendingResources.push(resourceId)
              localStorage.setItem('pendingSavedResources', JSON.stringify(pendingResources))
            }
          }
        }
      }

      // Note: ServiceHub sync already happened in step 7 (recommendations step)
      // We don't need to sync onboarding data again here

      // Check if response has pathId
      if (!response.data || !response.data.pathId) {
        throw new Error('Invalid response from server: missing pathId')
      }

      // Save the barrier profile so ServiceHub can personalize recommendations
      const serviceHubBarriers = mapBarriersToServiceHub(selectedBarrierTypes)
      localStorage.setItem('autinerary_profile', JSON.stringify({
        barriers: serviceHubBarriers,
        // The character the user builds in step 0 was never persisted — it was
        // collected, rendered, and dropped on submit. Anything that shows an
        // avatar later had nothing to read.
        avatar: {
          bodyType: formData.bodyType,
          hairStyle: formData.hairStyle,
          hairColor: formData.hairColor,
          skinColor: formData.skinColor,
        },
        goals: formData.goals.filter(g => g.trim()),
        lifeStage: formData.lifeStage,
        location: formData.location,
        role: formData.role,
        alternatePersona: {
          name: formData.alternatePersonaName.trim(),
          note: formData.alternatePersonaNote.trim(),
        },
        preferences: {
          ageRange: formData.ageRange,
          techSavvy: formData.techSavvy,
          viewPreference: formData.viewPreference,
        },
      }))

      // Snapshot stable answers so a returning user starting another path can
      // skip re-entering them (goals stay per-path, so they're excluded).
      try {
        localStorage.setItem(CARRYOVER_KEY, JSON.stringify({
          barrierTypes: selectedBarrierTypes,
          // Your character is a stable answer — a returning user should not
          // have to rebuild it for every new path.
          bodyType: formData.bodyType,
          hairStyle: formData.hairStyle,
          hairColor: formData.hairColor,
          skinColor: formData.skinColor,
          location: formData.location,
          lifeStage: formData.lifeStage,
          motivationType: formData.motivationType,
          motivationTypes: formData.motivationTypes,
          ageRange: formData.ageRange,
          techSavvy: formData.techSavvy,
          viewPreference: formData.viewPreference,
        }))
      } catch {}

      await completeOnboarding(response.data.pathId)
      clearAutosave()
      // Play the "Launch to Dream Land" celebration only now — at the very end,
      // after every question is answered and the path has actually been created.
      setShowRocketTransition(true)
      setTimeout(() => router.push('/onboarding-confirmation'), 1600)
    } catch (error: any) {
      console.error('Error creating path:', error)
      console.error('Error details:', {
        message: error?.message,
        response: error?.response?.data,
        status: error?.response?.status,
        API_URL
      })
      
      // More detailed error handling
      let errorMessage = 'Error creating your path. Please try again.'
      
      if (error?.response) {
        // Server responded with error
        errorMessage = error.response.data?.detail || error.response.data?.message || error.response.data?.error || `Server error: ${error.response.status}`
      } else if (error?.request) {
        // Request made but no response (network error)
        errorMessage = `Cannot connect to server at ${API_URL}. Please check if the backend is running.`
      } else if (error?.message) {
        // Other error
        errorMessage = error.message
      }
      
      alert(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    )
  }

  // Stages follow the real agent order in the backend pipeline. The last one is
  // open-ended rather than promising a finish — over-promising here is worse
  // than a longer wait.
  const localStage =
    elapsed < 12 ? 'Reading your answers…'
    : elapsed < 30 ? 'Finding people with a similar profile…'
    : elapsed < 55 ? 'Mapping out your milestones…'
    : elapsed < 80 ? 'Matching resources to your goals…'
    : 'Laying out your schedule — nearly there…'
  const displayStage = generationStage || localStage

  const progressPercentage = (currentStep / (steps.length - 1)) * 100
  
  // Food items evenly spaced along the path
  const foodItems = [
    { emoji: '🥕', position: 11 },
    { emoji: '🍎', position: 22 },
    { emoji: '🥬', position: 33 },
    { emoji: '🍌', position: 44 },
    { emoji: '🥕', position: 55 },
    { emoji: '🍓', position: 66 },
    { emoji: '🥕', position: 77 },
  ]

  return (
    <div className="min-h-screen bg-white/20 backdrop-blur-sm text-slate-900 p-4 md:p-8 relative overflow-hidden">
      {/* Cloudy Background — static, soft gradients. Previously each cloud ran a
          continuous `animate-pulse` (5 stacked blur-2xl/3xl layers repainting
          nonstop), which caused scroll jank on lower-end machines. The look is
          preserved without the per-frame repaint cost. */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Clouds */}
        <div className="absolute top-10 left-10 w-64 h-32 bg-white/40 rounded-full blur-2xl" />
        <div className="absolute top-32 right-20 w-80 h-40 bg-white/30 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-1/4 w-72 h-36 bg-white/35 rounded-full blur-2xl" />
        <div className="absolute top-1/3 right-1/3 w-56 h-28 bg-white/40 rounded-full blur-2xl" />
        <div className="absolute bottom-1/4 right-10 w-96 h-44 bg-white/30 rounded-full blur-3xl" />
      </div>

      <style dangerouslySetInnerHTML={{ __html: bunnyStyles }} />
      <div className="relative max-w-4xl mx-auto z-10">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-2 text-slate-800">
            Welcome{user?.name ? `, ${user.name}` : ''}! 👋
          </h1>
          <p className="text-slate-600 text-lg">Let's build your personalized path to success</p>

          {/* Pathway banner — shows this onboarding is tailored to the chosen
              Path Market template, not the generic "start your own path" flow. */}
          {pathSeed && (
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-700 text-sm font-medium">
              <Sparkles className="w-4 h-4" />
              Tailored for your <span className="font-semibold">{pathSeed.title}</span> path
            </div>
          )}

          {/* Carry-over note — reassures returning users we kept their info. */}
          {carriedOver && (
            <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
              <Check className="w-4 h-4" />
              Welcome back — we kept your barriers and location. Just set goals for this path.
            </div>
          )}
        </div>

        {/* Animated Bunny Progress Path */}
        <div className="mb-12 relative">
          {/* Path Line */}
          <div className="relative h-32 md:h-40 bg-gradient-to-r from-green-200 via-green-300 to-green-400 rounded-full shadow-lg border-4 border-green-500/50 overflow-hidden">
            {/* Grass texture */}
            <div className="absolute inset-0 bg-gradient-to-b from-green-400/50 to-green-600/30" />
            
            {/* Completed path (green) */}
            <div 
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-700 ease-out rounded-l-full"
              style={{ width: `${progressPercentage}%` }}
            />
            
            {/* Finish Line */}
            <div className="absolute right-0 top-0 h-full w-12 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 border-l-4 border-yellow-700 flex items-center justify-center shadow-lg">
              <span className="text-2xl font-bold text-yellow-900 drop-shadow-lg">🏁</span>
            </div>
            
            {/* Food Items along the path */}
            {foodItems.map((food, idx) => (
              <div
                key={idx}
                className="absolute top-1/2 -translate-y-1/2 text-3xl md:text-4xl transition-all duration-500 drop-shadow-lg z-10"
                style={{ 
                  left: `${food.position}%`,
                  transform: `translate(-50%, -50%) ${currentStep >= Math.floor((food.position / 100) * steps.length) ? 'scale(0.8) opacity-60' : 'scale(1) opacity-100'}`,
                  animation: currentStep >= Math.floor((food.position / 100) * steps.length) ? 'bounce 0.5s' : 'none'
                }}
              >
                {food.emoji}
              </div>
            ))}
            
            {/* Animated Bunny */}
            <div
              className="absolute top-1/2 text-4xl md:text-5xl transition-all duration-700 ease-out drop-shadow-2xl z-20"
              style={{ 
                left: `${progressPercentage}%`,
                transform: 'translateX(-50%)',
                animation: 'bunnyHop 0.6s ease-in-out infinite'
              }}
            >
              🐰
            </div>
          </div>
          
          {/* Step Labels Below Path */}
          <div className="flex justify-between mt-4 px-2">
            {steps.map((step, idx) => {
              const Icon = step.icon
              const isActive = idx === currentStep
              const isCompleted = idx < currentStep
              
              return (
                <div 
                  key={step.id} 
                  className="flex flex-col items-center flex-1"
                >
                  <div 
                    className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all z-10 shadow-lg ${
                      isActive 
                        ? 'bg-gradient-to-r from-cyan-500 to-purple-500 scale-125 ring-4 ring-cyan-300' 
                        : isCompleted 
                          ? 'bg-green-500 scale-110' 
                          : 'bg-slate-300 scale-100'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="w-4 h-4 md:w-5 md:h-5 text-white" />
                    ) : (
                      <Icon className={`w-4 h-4 md:w-5 md:h-5 ${isActive ? 'text-white' : 'text-slate-600'}`} />
                    )}
                  </div>
                  <span className={`text-xs mt-1 text-center max-w-[60px] ${isActive ? 'text-slate-800 font-bold' : isCompleted ? 'text-green-600' : 'text-slate-500'}`}>
                    {step.title}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Step Content Card */}
        <div className="bg-white/90 backdrop-blur-lg border-2 border-white/50 rounded-2xl p-6 md:p-8 shadow-2xl">
          {/* Rocket Ship Transition Overlay */}
          {showRocketTransition && (
            <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-sky-300 via-indigo-400 to-purple-600 transition-all">
              <div className="animate-bounce text-8xl mb-4">🚀</div>
              <h2 className="text-3xl font-bold text-white mb-2 animate-pulse">Launching to Dream Land!</h2>
              <div className="flex gap-2 mt-4">
                {['☁️', '⭐', '☁️', '✨', '☁️'].map((e, i) => (
                  <span key={i} className="text-3xl animate-pulse" style={{ animationDelay: `${i * 0.2}s` }}>{e}</span>
                ))}
              </div>
            </div>
          )}

          {/* Step 0: Character Select */}
          {currentStep === 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-2 text-slate-800">Create Your Character ✨</h2>
              <p className="text-slate-600 mb-6">Design an avatar to represent you on your journey through Dream Land.</p>

              {/* Avatar Customization */}
              <div className="space-y-6">
                {/* Body Type */}
                <div>
                  <h3 className="text-sm font-medium text-slate-700 mb-3">Body Type</h3>
                  <div className="flex gap-3">
                    {bodyTypes.map((bt) => (
                      <button
                        key={bt.id}
                        onClick={() => setFormData(prev => ({ ...prev, bodyType: bt.id }))}
                        className={`px-6 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                          formData.bodyType === bt.id
                            ? 'border-cyan-500 bg-cyan-500/20 text-cyan-700'
                            : 'border-slate-200 hover:border-cyan-400 text-slate-600'
                        }`}
                      >
                        {bt.label}
                      </button>
                    ))}
                    <button
                      onClick={() => setFormData(prev => ({ ...prev, bodyType: 'skip' }))}
                      className={`px-6 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                        formData.bodyType === 'skip'
                          ? 'border-cyan-500 bg-cyan-500/20 text-cyan-700'
                          : 'border-slate-200 hover:border-cyan-400 text-slate-600'
                      }`}
                    >
                      Skip / None
                    </button>
                  </div>
                </div>
                
                {/* Hair Style with visual preview */}
                <div>
                  <h3 className="text-sm font-medium text-slate-700 mb-3">Hair Style</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {hairStyles.map((hs) => (
                      <button
                        key={hs.id}
                        onClick={() => setFormData(prev => ({ ...prev, hairStyle: hs.id }))}
                        className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-sm font-medium transition-all ${
                          formData.hairStyle === hs.id
                            ? 'border-cyan-500 bg-cyan-500/10 text-cyan-700 ring-2 ring-cyan-300'
                            : 'border-slate-200 hover:border-cyan-400 text-slate-600'
                        }`}
                      >
                        <CharacterAvatar hairStyle={hs.id} hairColor={formData.hairColor} skinColor={formData.skinColor} size={46} />
                        <span className="text-xs text-center">{hs.label}</span>
                        {formData.hairStyle === hs.id && (
                          <Check className="absolute top-1.5 right-1.5 w-4 h-4 text-cyan-500" />
                        )}
                      </button>
                    ))}
                    <button
                      onClick={() => setFormData(prev => ({ ...prev, hairStyle: 'skip' }))}
                      className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-sm font-medium transition-all ${
                        formData.hairStyle === 'skip'
                          ? 'border-cyan-500 bg-cyan-500/10 text-cyan-700 ring-2 ring-cyan-300'
                          : 'border-slate-200 hover:border-cyan-400 text-slate-600'
                      }`}
                    >
                      <span className="text-3xl">⏭️</span>
                      <span className="text-xs text-center">Skip / None</span>
                      {formData.hairStyle === 'skip' && (
                        <Check className="absolute top-1.5 right-1.5 w-4 h-4 text-cyan-500" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Hair colour */}
                <div>
                  <h3 className="text-sm font-medium text-slate-700 mb-3">Hair Colour</h3>
                  <div className="flex flex-wrap gap-2">
                    {HAIR_COLORS.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setFormData(prev => ({ ...prev, hairColor: c.id }))}
                        title={c.label}
                        aria-label={c.label}
                        aria-pressed={formData.hairColor === c.id}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          formData.hairColor === c.id ? 'border-cyan-500 ring-2 ring-cyan-300 scale-110' : 'border-slate-300 hover:border-cyan-400'
                        }`}
                        style={{ backgroundColor: `#${c.id}` }}
                      />
                    ))}
                  </div>
                </div>

                {/* Skin tone */}
                <div>
                  <h3 className="text-sm font-medium text-slate-700 mb-3">Skin Tone</h3>
                  <div className="flex flex-wrap gap-2">
                    {SKIN_TONES.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setFormData(prev => ({ ...prev, skinColor: c.id }))}
                        title={c.label}
                        aria-label={c.label}
                        aria-pressed={formData.skinColor === c.id}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          formData.skinColor === c.id ? 'border-cyan-500 ring-2 ring-cyan-300 scale-110' : 'border-slate-300 hover:border-cyan-400'
                        }`}
                        style={{ backgroundColor: `#${c.id}` }}
                      />
                    ))}
                  </div>
                </div>

                {/* Live Character Preview */}
                <div className="border-t border-slate-200 pt-6">
                  <h3 className="text-sm font-medium text-slate-700 mb-3">Your Character Preview</h3>
                  <div className="flex justify-center">
                    <div className="relative w-44 rounded-2xl border-2 border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col items-center justify-center overflow-hidden py-4">
                      <UserAvatar hairStyle={formData.hairStyle} hairColor={formData.hairColor} skinColor={formData.skinColor} size={120} />
                      <p className="text-[10px] text-slate-500 font-medium mt-1 text-center px-2">
                        {formData.bodyType && formData.bodyType !== 'skip' ? bodyTypes.find(b => b.id === formData.bodyType)?.label : ''}
                        {formData.hairStyle && formData.hairStyle !== 'skip' ? ` · ${hairStyles.find(h => h.id === formData.hairStyle)?.label || ''}` : ''}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
            </div>
          )}

          {/* Step 1: Role */}
          {currentStep === 1 && (
            <div>
              <h2 className="text-2xl font-bold mb-2 text-slate-800">Your Norms</h2>
              <p className="text-slate-600 mb-2">Tell us about your norms — the systemic realities you navigate — either describe them in your own words, or select manually below.</p>
              <p className="text-xs text-slate-500 mb-4 italic">Your identity is not a barrier. Things like your disability, ethnicity, or gender aren&apos;t barriers themselves — the barriers are the systemic obstacles society puts in the way. We use this only to find support built for those obstacles.</p>

              {/* Mode toggle */}
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => setBarrierInputMode('text')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    barrierInputMode === 'text'
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white'
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Describe in your words
                </button>
                <button
                  onClick={() => setBarrierInputMode('manual')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    barrierInputMode === 'manual'
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white'
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Manual selection
                </button>
              </div>

              <div className="mb-6 flex flex-wrap gap-2">
                {['No current barriers', 'Prefer not to share'].map((choice) => {
                  const selected = formData.barrierTypes.length === 1 && formData.barrierTypes[0] === choice
                  return (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => setFormData((prev) => ({
                        ...prev,
                        barrierTypes: selected ? [] : [choice],
                        barrierConnections: selected ? ({} as Record<string, string[]>) : { self: [choice] },
                        role: selected ? '' : 'self_advocate',
                      }))}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        selected
                          ? 'border-cyan-600 bg-cyan-50 text-cyan-800'
                          : 'border-slate-300 bg-white text-slate-700 hover:border-cyan-400'
                      }`}
                    >
                      {selected && <Check className="mr-1 inline h-4 w-4" />}
                      {choice}
                    </button>
                  )
                })}
              </div>

              {/* Mode 1: Free-text */}
              {barrierInputMode === 'text' && (
                <div className="space-y-4">
                  <p className="text-sm text-slate-500">
                    Example: &quot;I identify as Black, have ADHD, and a sibling who is autistic&quot;
                  </p>
                  <textarea
                    value={formData.barrierConnectionText}
                    onChange={(e) => setFormData(prev => ({ ...prev, barrierConnectionText: e.target.value }))}
                    placeholder="Describe your barrier connections in a sentence..."
                    rows={3}
                    className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  />
                  <button
                    onClick={() => setFormData(prev => ({ ...prev, barrierConnectionText: '' }))}
                    className="text-sm text-slate-400 hover:text-red-400 transition-colors"
                  >
                    Reset text
                  </button>
                </div>
              )}

              {/* Mode 2: Manual selection */}
              {barrierInputMode === 'manual' && (
                <div className="space-y-6">
                  {/* Connection type multi-select */}
                  <div>
                    <h3 className="text-sm font-medium text-slate-700 mb-3">Your connection to these systemic barriers (select all that apply)</h3>
                    <div className="flex flex-wrap gap-2">
                      {connectionTypes.map((conn) => (
                        <button
                          key={conn.id}
                          disabled={'disabled' in conn && conn.disabled}
                          onClick={() => {
                            setFormData(prev => {
                              const current = { ...prev.barrierConnections }
                              if (current[conn.id]) {
                                delete current[conn.id]
                              } else {
                                current[conn.id] = []
                              }
                              // Derive role from first selected connection for backend compat
                              const selectedKeys = Object.keys(current)
                              const role = selectedKeys.includes('self') ? 'self_advocate' : selectedKeys.length > 0 ? selectedKeys[0] : ''
                              return { ...prev, barrierConnections: current, role }
                            })
                          }}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            'disabled' in conn && conn.disabled
                              ? 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed'
                              : formData.barrierConnections[conn.id] !== undefined
                                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white'
                                : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-cyan-400'
                          }`}
                        >
                          <span>{conn.icon}</span>
                          {conn.label}
                          {formData.barrierConnections[conn.id] !== undefined && <Check className="w-4 h-4 ml-1" />}
                        </button>
                      ))}
                    </div>

                    {/* Yourself + whoever else — when you've picked someone
                        other than yourself, quickly add that these barriers
                        also apply to you (you can pick both). */}
                    {Object.keys(formData.barrierConnections).some(id => id !== 'self') && (
                      <label className="mt-3 flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={formData.barrierConnections['self'] !== undefined}
                          onChange={() => {
                            setFormData(prev => {
                              const current = { ...prev.barrierConnections }
                              if (current['self'] !== undefined) {
                                delete current['self']
                              } else {
                                current['self'] = []
                              }
                              const selectedKeys = Object.keys(current)
                              const role = selectedKeys.includes('self') ? 'self_advocate' : selectedKeys.length > 0 ? selectedKeys[0] : ''
                              const allBarriers = [...new Set(Object.values(current).flat())]
                              return { ...prev, barrierConnections: current, role, barrierTypes: allBarriers }
                            })
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-cyan-500 focus:ring-cyan-400"
                        />
                        <span>👤 These barriers also apply to me (add yourself)</span>
                      </label>
                    )}
                  </div>

                  {/* Per-connection barrier selectors */}
                  {Object.keys(formData.barrierConnections).length > 0 && (
                    <div className="space-y-4">
                      {Object.keys(formData.barrierConnections).map((connId) => {
                        const conn = connectionTypes.find(c => c.id === connId)
                        if (!conn) return null
                        return (
                          <div key={connId} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                            <h4 className="font-medium text-slate-800 mb-3 flex items-center gap-2">
                              <span>{conn.icon}</span> Barriers for: {conn.label}
                            </h4>
                            <div className="space-y-4">
                              {barrierCategories.map((category) => (
                                <div key={category.name}>
                                  <p className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">{category.name}</p>
                                  <div className="space-y-2 ml-2">
                                    {category.subcategories.map((sub) => (
                                      <div key={sub.name}>
                                        <p className="text-xs text-slate-400 mb-1">{sub.name}</p>
                                        <div className="flex flex-wrap gap-1.5 mb-2">
                                          {sub.items.map((barrier) => {
                                            const isSelected = formData.barrierConnections[connId]?.includes(barrier)
                                            return (
                                              <button
                                                key={barrier}
                                                onClick={() => {
                                                  setFormData(prev => {
                                                    const current = { ...prev.barrierConnections }
                                                    const list = [...(current[connId] || [])]
                                                    if (list.includes(barrier)) {
                                                      current[connId] = list.filter(b => b !== barrier)
                                                    } else {
                                                      current[connId] = [...list, barrier]
                                                    }
                                                    // Flatten all barriers into barrierTypes for backend compat
                                                    const allBarriers = [...new Set(Object.values(current).flat())]
                                                    return { ...prev, barrierConnections: current, barrierTypes: allBarriers }
                                                  })
                                                }}
                                                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                                                  isSelected
                                                    ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white'
                                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-cyan-400'
                                                }`}
                                              >
                                                {isSelected && <Check className="w-3 h-3 inline mr-1" />}
                                                {barrier}
                                              </button>
                                            )
                                          })}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Add your own — custom / more specific barriers */}
                            <div className="mt-4 pt-3 border-t border-slate-200">
                              <p className="text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Add your own</p>
                              <p className="text-xs text-slate-400 mb-2">Don&apos;t see a barrier that fits? Add something specific — e.g. &quot;public speaking&quot;, &quot;test anxiety&quot;, &quot;sensory overload in crowds&quot;.</p>
                              {/* Chips for already-added custom barriers on this connection */}
                              {(formData.barrierConnections[connId] || []).filter(b => !barrierCategories.some(c => c.subcategories.some(s => s.items.includes(b)))).length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mb-2">
                                  {(formData.barrierConnections[connId] || [])
                                    .filter(b => !barrierCategories.some(c => c.subcategories.some(s => s.items.includes(b))))
                                    .map(b => (
                                      <button
                                        key={b}
                                        onClick={() => {
                                          setFormData(prev => {
                                            const current = { ...prev.barrierConnections }
                                            current[connId] = (current[connId] || []).filter(x => x !== b)
                                            const allBarriers = [...new Set(Object.values(current).flat())]
                                            return { ...prev, barrierConnections: current, barrierTypes: allBarriers }
                                          })
                                        }}
                                        className="px-3 py-1 rounded-md text-xs font-medium bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                                      >
                                        {b} ✕
                                      </button>
                                    ))}
                                </div>
                              )}
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={customBarrierDraft[connId] || ''}
                                  onChange={(e) => setCustomBarrierDraft(prev => ({ ...prev, [connId]: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault()
                                      const val = (customBarrierDraft[connId] || '').trim()
                                      if (!val) return
                                      setFormData(prev => {
                                        const current = { ...prev.barrierConnections }
                                        const list = current[connId] || []
                                        if (!list.some(x => x.toLowerCase() === val.toLowerCase())) current[connId] = [...list, val]
                                        const allBarriers = [...new Set(Object.values(current).flat())]
                                        return { ...prev, barrierConnections: current, barrierTypes: allBarriers }
                                      })
                                      setCustomBarrierDraft(prev => ({ ...prev, [connId]: '' }))
                                    }
                                  }}
                                  placeholder="Type a specific barrier and press Enter"
                                  maxLength={60}
                                  className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                                />
                                <button
                                  onClick={() => {
                                    const val = (customBarrierDraft[connId] || '').trim()
                                    if (!val) return
                                    setFormData(prev => {
                                      const current = { ...prev.barrierConnections }
                                      const list = current[connId] || []
                                      if (!list.some(x => x.toLowerCase() === val.toLowerCase())) current[connId] = [...list, val]
                                      const allBarriers = [...new Set(Object.values(current).flat())]
                                      return { ...prev, barrierConnections: current, barrierTypes: allBarriers }
                                    })
                                    setCustomBarrierDraft(prev => ({ ...prev, [connId]: '' }))
                                  }}
                                  className="px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:opacity-90"
                                >
                                  Add
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              <DiagnosticProfileSection
                selectedBarriers={formData.barrierTypes}
                value={diagnosticProfile}
                onChange={setDiagnosticProfile}
              />
            </div>
          )}

          {/* Step 2: Location */}
          {currentStep === 2 && (
            <div>
              <h2 className="text-2xl font-bold mb-2 text-slate-800">Where are you located?</h2>
              <p className="text-slate-600 mb-6">This helps us find resources in your area. All location data is private and optional.</p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">City *</label>
                  <input
                    type="text"
                    value={formData.location.city}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: { ...prev.location, city: e.target.value } }))}
                    placeholder="e.g., Toronto"
                    className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Province/State *</label>
                  <input
                    type="text"
                    value={formData.location.province}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: { ...prev.location, province: e.target.value } }))}
                    placeholder="e.g., Ontario"
                    className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Country *</label>
                  <input
                    type="text"
                    value={formData.location.country}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: { ...prev.location, country: e.target.value } }))}
                    placeholder="e.g., Canada"
                    className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Additional resource locations */}
              <div className="mt-8 border-t border-slate-200 pt-6">
                <h3 className="text-sm font-medium text-slate-700 mb-1">Where else can you access resources? <span className="text-slate-400 font-normal">(optional)</span></h3>
                <p className="text-xs text-slate-500 mb-4">For example, dual citizenship, family in another city, etc. Not including online.</p>

                {formData.additionalLocations.map((loc, idx) => (
                  <div key={idx} className="mb-4 bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-slate-600">Additional location {idx + 1}</span>
                      <button
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          additionalLocations: prev.additionalLocations.filter((_, i) => i !== idx)
                        }))}
                        className="text-slate-400 hover:text-red-400 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input
                        type="text"
                        value={loc.city}
                        onChange={(e) => setFormData(prev => {
                          const updated = [...prev.additionalLocations]
                          updated[idx] = { ...updated[idx], city: e.target.value }
                          return { ...prev, additionalLocations: updated }
                        })}
                        placeholder="City"
                        className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                      />
                      <input
                        type="text"
                        value={loc.province}
                        onChange={(e) => setFormData(prev => {
                          const updated = [...prev.additionalLocations]
                          updated[idx] = { ...updated[idx], province: e.target.value }
                          return { ...prev, additionalLocations: updated }
                        })}
                        placeholder="Province/State"
                        className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                      />
                      <input
                        type="text"
                        value={loc.country}
                        onChange={(e) => setFormData(prev => {
                          const updated = [...prev.additionalLocations]
                          updated[idx] = { ...updated[idx], country: e.target.value }
                          return { ...prev, additionalLocations: updated }
                        })}
                        placeholder="Country"
                        className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                      />
                    </div>
                  </div>
                ))}

                <button
                  onClick={() => setFormData(prev => ({
                    ...prev,
                    additionalLocations: [...prev.additionalLocations, { city: '', province: '', country: '' }]
                  }))}
                  className="text-cyan-600 hover:text-cyan-700 text-sm font-medium"
                >
                  + Add another location
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Goals, Dreams & Obstacles (combined) */}
          {currentStep === 3 && (() => {
            // Detect connections to another person (sibling, parent, etc.) so we
            // can offer an "ideal relationship" option alongside the dream — the
            // user answers whichever speaks to them (one optional out of two).
            const otherConnectionIds = Object.keys(formData.barrierConnections).filter(id => id !== 'self')
            const hasOtherPerson = otherConnectionIds.length > 0
            const otherPersonLabel = otherConnectionIds.length === 1
              ? (connectionTypes.find(c => c.id === otherConnectionIds[0])?.label || 'them').replace(' (Lived Experience)', '')
              : 'them'
            return (
            <div>
              <h2 className="text-2xl font-bold mb-2 text-slate-800">Your Goals, Dreams & Obstacles</h2>
              <p className="text-slate-600 mb-6">Pick a category, add your goals, and optionally add dreams and obstacles for each one.</p>
              
              {/* Category tabs */}
              <div className="flex flex-wrap gap-2 mb-6">
                {goalCategories.map((cat) => {
                  const count = (formData.goalsByCategory[cat.id] || []).filter(e => e.goal.trim()).length
                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        // Toggle open/scroll to that category
                        const el = document.getElementById(`goal-cat-${cat.id}`)
                        el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        count > 0
                          ? 'bg-cyan-100 text-cyan-700 border border-cyan-300'
                          : 'bg-white border border-slate-200 text-slate-600 hover:border-cyan-400'
                      }`}
                    >
                      <span>{cat.emoji}</span>
                      {cat.label}
                      {count > 0 && <span className="bg-cyan-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{count}</span>}
                    </button>
                  )
                })}
              </div>

              {/* Category sections */}
              <div className="space-y-6">
                {goalCategories.map((cat) => {
                  const entries = formData.goalsByCategory[cat.id] || []
                  return (
                    <div key={cat.id} id={`goal-cat-${cat.id}`} className="bg-white border border-slate-200 rounded-xl p-4">
                      <h3 className="font-medium text-slate-800 mb-3 flex items-center gap-2">
                        <span>{cat.emoji}</span> {cat.label}
                      </h3>

                      {/* Suggestions tailored to the chosen Path Market path —
                          only on that path's focus category. */}
                      {(() => {
                        if (!pathSeed || pathSeed.focusCategory !== cat.id) return null
                        const pathSuggestions = pathSeed.suggestions
                          .filter(s => !entries.some(e => e.goal.trim().toLowerCase() === s.toLowerCase()))
                        if (pathSuggestions.length === 0) return null
                        return (
                          <div className="mb-3">
                            <p className="text-xs text-cyan-600 mb-2 flex items-center gap-1">
                              <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
                              Ideas for your {pathSeed.title} path
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {pathSuggestions.map((sug) => (
                                <button
                                  key={sug}
                                  type="button"
                                  onClick={() => {
                                    setFormData(prev => {
                                      const updated = { ...prev.goalsByCategory }
                                      const list = [...(updated[cat.id] || [])]
                                      const emptyIdx = list.findIndex(e => !e.goal.trim())
                                      if (emptyIdx >= 0) {
                                        list[emptyIdx] = { ...list[emptyIdx], goal: sug }
                                      } else {
                                        list.push({ goal: sug, dreams: '', obstacles: '' })
                                      }
                                      updated[cat.id] = list
                                      return { ...prev, goalsByCategory: updated }
                                    })
                                  }}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-cyan-50 text-cyan-700 border border-cyan-200 hover:bg-cyan-100 transition-all"
                                >
                                  + {sug}
                                </button>
                              ))}
                            </div>
                          </div>
                        )
                      })()}

                      {/* Suggestions based on selected barriers */}
                      {(() => {
                        const suggestions = getGoalSuggestions(cat.id, selectedBarrierTypes)
                          .filter(s => !entries.some(e => e.goal.trim().toLowerCase() === s.toLowerCase()))
                        if (suggestions.length === 0) return null
                        return (
                          <div className="mb-3">
                            <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                              Suggestions based on your barriers
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {suggestions.map((sug) => (
                                <button
                                  key={sug}
                                  type="button"
                                  onClick={() => {
                                    setFormData(prev => {
                                      const updated = { ...prev.goalsByCategory }
                                      const list = [...(updated[cat.id] || [])]
                                      // Fill the first empty goal, or append a new one.
                                      const emptyIdx = list.findIndex(e => !e.goal.trim())
                                      if (emptyIdx >= 0) {
                                        list[emptyIdx] = { ...list[emptyIdx], goal: sug }
                                      } else {
                                        list.push({ goal: sug, dreams: '', obstacles: '' })
                                      }
                                      updated[cat.id] = list
                                      return { ...prev, goalsByCategory: updated }
                                    })
                                  }}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-all"
                                >
                                  + {sug}
                                </button>
                              ))}
                            </div>
                          </div>
                        )
                      })()}

                      {entries.map((entry, idx) => (
                        <div key={idx} className="mb-4 bg-slate-50 rounded-lg p-3 border border-slate-100">
                          <div className="flex gap-2 mb-2">
                            <input
                              type="text"
                              value={entry.goal}
                              onChange={(e) => {
                                setFormData(prev => {
                                  const updated = { ...prev.goalsByCategory }
                                  const list = [...(updated[cat.id] || [])]
                                  list[idx] = { ...list[idx], goal: e.target.value }
                                  updated[cat.id] = list
                                  return { ...prev, goalsByCategory: updated }
                                })
                              }}
                              placeholder={cat.placeholder}
                              className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                            />
                            <button
                              onClick={() => {
                                setFormData(prev => {
                                  const updated = { ...prev.goalsByCategory }
                                  updated[cat.id] = (updated[cat.id] || []).filter((_, i) => i !== idx)
                                  if (updated[cat.id].length === 0) delete updated[cat.id]
                                  return { ...prev, goalsByCategory: updated }
                                })
                              }}
                              className="px-2 text-slate-400 hover:text-red-400 text-sm"
                            >
                              ×
                            </button>
                          </div>
                          
                          {/* Per-goal dream */}
                          <div className="ml-4 mb-1">
                            <label className="text-xs text-purple-500 font-medium">
                              {hasOtherPerson ? `Dream for ${otherPersonLabel}` : 'Dream for this goal'} <span className="text-slate-400">(optional)</span>
                            </label>
                            <input
                              type="text"
                              value={entry.dreams}
                              onChange={(e) => {
                                setFormData(prev => {
                                  const updated = { ...prev.goalsByCategory }
                                  const list = [...(updated[cat.id] || [])]
                                  list[idx] = { ...list[idx], dreams: e.target.value }
                                  updated[cat.id] = list
                                  return { ...prev, goalsByCategory: updated }
                                })
                              }}
                              placeholder="Where does this goal lead in 5-10 years?"
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400 mt-1"
                            />
                          </div>

                          {/* Ideal relationship — second option when the goal
                              involves another person (e.g. a sibling). Both this
                              and the dream are optional; answer whichever fits. */}
                          {hasOtherPerson && (
                            <div className="ml-4 mb-1">
                              <label className="text-xs text-indigo-500 font-medium">
                                Ideal relationship with {otherPersonLabel} <span className="text-slate-400">(optional — instead of, or as well as, the dream)</span>
                              </label>
                              <input
                                type="text"
                                value={entry.idealRelationship || ''}
                                onChange={(e) => {
                                  setFormData(prev => {
                                    const updated = { ...prev.goalsByCategory }
                                    const list = [...(updated[cat.id] || [])]
                                    list[idx] = { ...list[idx], idealRelationship: e.target.value }
                                    updated[cat.id] = list
                                    return { ...prev, goalsByCategory: updated }
                                  })
                                }}
                                placeholder={`What does a good relationship with ${otherPersonLabel} look like?`}
                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 mt-1"
                              />
                            </div>
                          )}

                          {/* Per-goal obstacle */}
                          <div className="ml-4">
                            <label className="text-xs text-pink-500 font-medium">Obstacle <span className="text-slate-400">(optional)</span></label>
                            <input
                              type="text"
                              value={entry.obstacles}
                              onChange={(e) => {
                                setFormData(prev => {
                                  const updated = { ...prev.goalsByCategory }
                                  const list = [...(updated[cat.id] || [])]
                                  list[idx] = { ...list[idx], obstacles: e.target.value }
                                  updated[cat.id] = list
                                  return { ...prev, goalsByCategory: updated }
                                })
                              }}
                              placeholder="What's stopping you from achieving this?"
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-pink-400 focus:border-pink-400 mt-1"
                            />
                          </div>
                        </div>
                      ))}
                      
                      <button
                        onClick={() => {
                          setFormData(prev => {
                            const updated = { ...prev.goalsByCategory }
                            updated[cat.id] = [...(updated[cat.id] || []), { goal: '', dreams: '', obstacles: '' }]
                            return { ...prev, goalsByCategory: updated }
                          })
                        }}
                        className="text-cyan-600 hover:text-cyan-700 text-xs font-medium"
                      >
                        + Add a {cat.label.toLowerCase()} goal
                      </button>
                    </div>
                  )
                })}
              </div>

              {/* Ultimate Dream */}
              <div className="mt-6 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-4">
                <h3 className="font-medium text-purple-800 mb-2 flex items-center gap-2">
                  <span>🌟</span> Ultimate Dream
                </h3>
                <p className="text-xs text-purple-600 mb-3">Beyond all your goals — what&apos;s your biggest dream?</p>
                <input
                  type="text"
                  value={formData.ultimateDream}
                  onChange={(e) => setFormData(prev => ({ ...prev, ultimateDream: e.target.value }))}
                  placeholder='e.g., "Create a world where neurodivergent people thrive"'
                  className="w-full bg-white border border-purple-200 rounded-lg px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400"
                />
              </div>
            </div>
            )
          })()}

          {/* Step 4: Motivation & Life Stage */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-2 text-slate-800">What motivates you most?</h2>
                <p className="text-slate-600 mb-6">Select all that apply — most people are motivated by more than one thing.</p>
                
                <div className="grid gap-3">
                  {motivationOptions.map((option) => {
                    const isSelected = formData.motivationTypes.includes(option.value)
                    return (
                      <button
                        key={option.value}
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          motivationTypes: isSelected
                            ? prev.motivationTypes.filter(v => v !== option.value)
                            : [...prev.motivationTypes, option.value],
                          // Keep first selection as primary for backward compat
                          motivationType: isSelected && prev.motivationTypes.length === 1
                            ? ''
                            : (!isSelected && prev.motivationTypes.length === 0 ? option.value : prev.motivationType)
                        }))}
                        className={`flex items-center gap-4 p-4 rounded-xl text-left transition-all ${
                          isSelected
                            ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border-2 border-cyan-500'
                            : 'bg-white border border-slate-200 hover:bg-slate-50 hover:border-cyan-400'
                        }`}
                      >
                        <span className="text-2xl">{option.emoji}</span>
                        <div className="flex-1">
                          <div className="font-medium text-slate-800">{option.label}</div>
                          <div className="text-sm text-slate-500">{option.description}</div>
                        </div>
                        {isSelected && (
                          <Check className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="pt-6 border-t border-slate-200">
                <h2 className="text-2xl font-bold mb-2 text-slate-800">What&apos;s your current life stage?</h2>
                <p className="text-slate-600 mb-6">This helps us match you with relevant resources.</p>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {lifeStages.map((stage) => (
                    <button
                      key={stage.id}
                      onClick={() => setFormData(prev => ({ ...prev, lifeStage: stage.id }))}
                      className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                        formData.lifeStage === stage.id
                          ? 'border-cyan-500 bg-cyan-500/20 text-cyan-700'
                          : 'border-slate-200 hover:border-cyan-400 text-slate-700'
                      }`}
                    >
                      {stage.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Profile Customization - Dreams & Dream Self */}
          {currentStep === 5 && (
            <div>
              {/* Variant heading based on connection type */}
              {(() => {
                const isParent = formData.barrierConnections['parent'] !== undefined
                const isSibling = formData.barrierConnections['sibling'] !== undefined
                const isSelfOnly = Object.keys(formData.barrierConnections).length === 0 || 
                  (Object.keys(formData.barrierConnections).length === 1 && formData.barrierConnections['self'] !== undefined)
                
                if (isParent) {
                  return (
                    <>
                      <h2 className="text-2xl font-bold mb-2 text-slate-800">Dream Future ✨</h2>
                      <p className="text-slate-600 mb-6">Close your eyes. Where do you dream of seeing your child/children? What does their best life look like?</p>
                    </>
                  )
                }
                if (isSibling) {
                  return (
                    <>
                      <h2 className="text-2xl font-bold mb-2 text-slate-800">Dream Future ✨</h2>
                      <p className="text-slate-600 mb-6">Close your eyes. Where do you dream of seeing your sibling? What does their best life look like?</p>
                    </>
                  )
                }
                return (
                  <>
                    <h2 className="text-2xl font-bold mb-2 text-slate-800">Your Dream Self ✨</h2>
                    <p className="text-slate-600 mb-6">Close your eyes and imagine the best version of you — your Dream Self. What does that look like?</p>
                  </>
                )
              })()}
              
              {/* Dreams Summary — pulled from per-goal dreams + ultimate dream */}
              {(() => {
                const allDreams = Object.values(formData.goalsByCategory)
                  .flatMap(entries => entries.map(e => e.dreams).filter(d => d.trim()))
                if (formData.ultimateDream.trim()) allDreams.push(formData.ultimateDream.trim())
                // Fallback to old flat dreams array
                const legacyDreams = formData.dreams.filter(d => d.trim())
                const dreamsToShow = allDreams.length > 0 ? allDreams : legacyDreams
                if (dreamsToShow.length === 0) return null
                return (
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-4 mb-6">
                    <h3 className="text-sm font-medium text-purple-700 mb-2">Your Dreams So Far 💭</h3>
                    <div className="flex flex-wrap gap-2">
                      {dreamsToShow.map((dream, idx) => (
                        <span key={idx} className="px-3 py-1 bg-white/80 border border-purple-200 rounded-full text-sm text-purple-700">{dream}</span>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* Dream Self Description */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    {formData.barrierConnections['parent'] !== undefined
                      ? 'Describe your dream future for your child/children'
                      : formData.barrierConnections['sibling'] !== undefined
                        ? 'Describe your dream future for your sibling'
                        : 'Describe your Dream Self'}
                  </label>
                  <textarea
                    value={formData.dreamSelf}
                    onChange={(e) => setFormData(prev => ({ ...prev, dreamSelf: e.target.value }))}
                    placeholder={
                      formData.barrierConnections['parent'] !== undefined
                        ? "When I close my eyes and imagine my child's best future, I see them..."
                        : "When I close my eyes and imagine my best future self, I see someone who..."
                    }
                    rows={5}
                    className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                  />
                  <p className="text-xs text-slate-400 mt-2">Think about: What do you look like? What are you doing? How do you feel? Who is around you?</p>
                </div>

                {/* Avatar Preview */}
                <div className="bg-gradient-to-br from-sky-100 via-purple-50 to-pink-100 rounded-xl p-6 text-center border border-purple-200">
                  <div className="text-6xl mb-3">
                    {formData.characterType === 'avatar' ? '👤' : formData.characterType === 'spirit_animal' ? '🐾' : '✨'}
                  </div>
                  <p className="text-sm text-purple-600 font-medium">
                    {formData.dreamSelf ? `"${formData.dreamSelf.slice(0, 80)}${formData.dreamSelf.length > 80 ? '...' : ''}"` : 'Your Dream Self awaits...'}
                  </p>
                </div>

                {/* Alternate Persona (optional) — a named alter-ego for the Dream Self */}
                <div className="border-t border-slate-200 pt-6">
                  <h3 className="text-lg font-bold text-slate-800 mb-1">Alternate Persona <span className="text-xs font-normal text-slate-400">(optional)</span></h3>
                  <p className="text-slate-600 text-sm mb-4">Some people picture their Dream Self as a named alter-ego — a confident version of them they can step into. Give yours a name if you like.</p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Persona name</label>
                      <input
                        type="text"
                        value={formData.alternatePersonaName}
                        onChange={(e) => setFormData(prev => ({ ...prev, alternatePersonaName: e.target.value }))}
                        placeholder="e.g. Nova, Captain Focus, Future Me"
                        maxLength={60}
                        className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">What are they like? <span className="text-slate-400">(optional)</span></label>
                      <textarea
                        value={formData.alternatePersonaNote}
                        onChange={(e) => setFormData(prev => ({ ...prev, alternatePersonaNote: e.target.value }))}
                        placeholder="Bold, calm under pressure, speaks up in meetings, takes the first step..."
                        rows={3}
                        maxLength={400}
                        className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 6: Spirit Animals */}
          {currentStep === 6 && (() => {
            const slotCount = spiritAnimalSlotCount(formData.spiritAnimalMode)
            // In simple view we hide the fast/slow + per-day modes behind a
            // "More options" toggle so new users just pick one guide.
            const modesCollapsed = simpleView && !showAdvancedModes
            const visibleModes = modesCollapsed
              ? spiritAnimalModes.filter(m => m.id === 'general')
              : spiritAnimalModes
            return (
            <div>
              <h2 className="text-2xl font-bold mb-2 text-slate-800">Choose Your Spirit Animal(s) 🐾</h2>
              <p className="text-slate-600 mb-4">Your spirit animals are friendly guides that represent you.{modesCollapsed ? ' Keeping it simple with one guide — you can add more anytime.' : " Pick how many you'd like."}</p>

              {/* Mode selector (Odosa's 3 options; simplified in simple view) */}
              <div className={`grid grid-cols-1 gap-3 mb-4 ${modesCollapsed ? '' : 'sm:grid-cols-3'}`}>
                {visibleModes.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSpiritAnimalMode(m.id)}
                    className={`text-left p-4 rounded-xl border-2 transition-all ${
                      formData.spiritAnimalMode === m.id
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-slate-200 hover:border-purple-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-medium text-slate-800">
                      <span className="text-lg">{m.emoji}</span> {m.label}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{m.desc}</p>
                  </button>
                ))}
              </div>

              {/* Simple-view expander: reveal fast/slow + per-day guides on demand */}
              {simpleView && (
                <button
                  type="button"
                  onClick={() => setShowAdvancedModes(v => !v)}
                  className="text-sm text-purple-600 hover:text-purple-700 font-medium mb-4"
                >
                  {showAdvancedModes
                    ? '← Keep it simple (one guide)'
                    : 'Want fast/slow or a guide per day? Show more options →'}
                </button>
              )}

              {/* Fast vs slow day explainer (answers Eliyana's question) */}
              {formData.spiritAnimalMode === 'fastSlow' && (
                <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                  <p className="font-medium mb-1">⚡ Fast day vs 🌙 slow day</p>
                  <p>
                    A <strong>fast day</strong> is when you feel energized and productive — you want a guide that
                    matches that momentum. A <strong>slow day</strong> is when you need rest and recharge — a
                    gentler guide meets you there. Picking one for each lets the app adapt its tone to how
                    you&apos;re actually feeling.
                  </p>
                </div>
              )}

              {/* Spirit Animal Slots */}
              {formData.spiritAnimals.map((animal, idx) => (
                <div key={idx} className="mb-6 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium text-purple-700">
                      {spiritAnimalSlotLabel(formData.spiritAnimalMode, idx)}
                    </h3>
                    <button
                      onClick={() => removeSpiritAnimal(idx)}
                      className="text-sm text-red-400 hover:text-red-500"
                    >
                      Remove
                    </button>
                  </div>
                  
                  {/* Step ① Select Animal */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">① Choose Animal</label>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {spiritAnimalOptions.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => updateSpiritAnimal(idx, 'type', opt.id)}
                          className={`flex flex-col items-center p-3 rounded-lg border-2 transition-all ${
                            animal.type === opt.id
                              ? 'border-purple-500 bg-purple-100 scale-105'
                              : 'border-slate-200 hover:border-purple-300 hover:bg-purple-50'
                          }`}
                        >
                          <span className="text-2xl">{opt.emoji}</span>
                          <span className="text-xs mt-1 text-slate-600">{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Step ② Select Color */}
                  {animal.type && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">② Choose Color</label>
                      <div className="flex flex-wrap gap-2">
                        {spiritAnimalColors.map((color) => (
                          <button
                            key={color.id}
                            onClick={() => updateSpiritAnimal(idx, 'color', color.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
                              animal.color === color.id
                                ? 'border-purple-500 ring-2 ring-purple-300'
                                : 'border-slate-200 hover:border-purple-300'
                            }`}
                          >
                            <span className={`w-4 h-4 rounded-full ${color.bg}`} />
                            <span className="text-sm text-slate-700">{color.label}</span>
                          </button>
                        ))}
                      </div>
                      
                      {/* Preview */}
                      {animal.color && (
                        <div className="mt-3 flex items-center gap-3 bg-white rounded-lg p-3 border border-purple-100">
                          <span className="text-4xl" style={{ filter: `drop-shadow(0 0 8px ${spiritAnimalColors.find(c => c.id === animal.color)?.hex || '#a78bfa'})` }}>
                            {spiritAnimalOptions.find(o => o.id === animal.type)?.emoji}
                          </span>
                          <span className="text-sm text-purple-600 font-medium">
                            {spiritAnimalColors.find(c => c.id === animal.color)?.label} {spiritAnimalOptions.find(o => o.id === animal.type)?.label}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Add Spirit Animal Button */}
              {formData.spiritAnimals.length < slotCount && (
                <button
                  onClick={addSpiritAnimal}
                  className="w-full py-4 border-2 border-dashed border-purple-300 rounded-xl text-purple-500 hover:bg-purple-50 hover:border-purple-400 transition-all font-medium"
                >
                  + Add {spiritAnimalSlotLabel(formData.spiritAnimalMode, formData.spiritAnimals.length).replace(/^[^\s]+\s/, '')}
                  {slotCount > 1 && <span className="text-purple-400 text-sm"> ({formData.spiritAnimals.length + 1} of {slotCount})</span>}
                </button>
              )}
              
              {formData.spiritAnimals.length === slotCount && slotCount > 0 && (
                <p className="text-sm text-slate-500 text-center mt-2">
                  {formData.spiritAnimalMode === 'general' && 'Your spirit animal is set! 🐾'}
                  {formData.spiritAnimalMode === 'fastSlow' && 'You\u2019ve got both — your \u26A1 Fast Day and \uD83C\uDF19 Slow Day spirit animals!'}
                  {formData.spiritAnimalMode === 'weekly' && 'All 7 days have a spirit animal! 📅'}
                </p>
              )}
            </div>
            )
          })()}

          {/* Step 7: Personalize — view & interaction preferences */}
          {currentStep === 7 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Palette className="w-6 h-6 text-cyan-600" />
                <h2 className="text-2xl font-bold text-slate-800">Personalize your experience</h2>
              </div>
              <p className="text-slate-600 mb-6">
                This helps us tailor how the app looks and feels for you. Every mode is still a
                fun, gamified checklist — this just tunes how much visual energy we add. All optional.
              </p>

              {/* Age Range */}
              <div className="mb-6">
                <label className="block font-semibold text-slate-800 mb-2">Age range</label>
                <div className="grid grid-cols-3 gap-3">
                  {AGE_RANGES.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, ageRange: o.id }))}
                      className={`px-4 py-3 rounded-xl border-2 font-medium transition-all ${
                        formData.ageRange === o.id
                          ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tech Savvyness */}
              <div className="mb-6">
                <label className="block font-semibold text-slate-800 mb-1">
                  How often do you use apps?
                </label>
                <p className="text-xs text-slate-500 mb-2">
                  Why we ask: this tunes how much detail the interface shows — if apps
                  aren&apos;t your thing, we keep screens simpler. It&apos;s never shared.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {TECH_SAVVY.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, techSavvy: o.id }))}
                      className={`px-4 py-3 rounded-xl border-2 text-left transition-all ${
                        formData.techSavvy === o.id
                          ? 'border-cyan-500 bg-cyan-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className={`font-medium ${formData.techSavvy === o.id ? 'text-cyan-700' : 'text-slate-700'}`}>{o.label}</div>
                      <div className="text-xs text-slate-500">{o.hint}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* View Preference */}
              <div className="mb-2">
                <label className="block font-semibold text-slate-800 mb-2">View preference</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {VIEW_PREFERENCES.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, viewPreference: o.id }))}
                      className={`px-4 py-4 rounded-xl border-2 text-center transition-all ${
                        formData.viewPreference === o.id
                          ? 'border-cyan-500 bg-cyan-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="text-2xl mb-1">{o.emoji}</div>
                      <div className={`font-medium text-sm ${formData.viewPreference === o.id ? 'text-cyan-700' : 'text-slate-700'}`}>{o.label}</div>
                      <div className="text-[11px] text-slate-500 leading-tight mt-0.5">{o.hint}</div>
                    </button>
                  ))}
                </div>
              </div>
              {/* Daily goal reminders (opt-in) */}
              <div className="mt-6 border-t border-slate-200 pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <label htmlFor="reminders-toggle" className="block font-semibold text-slate-800">
                      Daily goal reminders
                    </label>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Get a gentle nudge about your goals for the day. Optional, and you can turn it
                      off anytime in Settings.
                    </p>
                  </div>
                  <button
                    id="reminders-toggle"
                    type="button"
                    role="switch"
                    aria-checked={formData.reminders.enabled}
                    onClick={() => updateReminders({
                      enabled: !formData.reminders.enabled,
                      // Prefill email contact when turning on with the email channel.
                      contact: !formData.reminders.enabled && formData.reminders.channel === 'email' && !formData.reminders.contact
                        ? (user?.email || '')
                        : formData.reminders.contact,
                    })}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                      formData.reminders.enabled ? 'bg-cyan-500' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                        formData.reminders.enabled ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>

                {formData.reminders.enabled && (
                  <div className="mt-4 space-y-4">
                    {/* Channel */}
                    <div>
                      <span className="block text-sm font-medium text-slate-700 mb-2">How should we reach you?</span>
                      <div className="grid grid-cols-2 gap-3">
                        {([
                          { id: 'email', label: 'Email' },
                          { id: 'sms', label: 'Text message' },
                        ] as const).map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => updateReminders({
                              channel: c.id,
                              // Swap in the email as a sensible default when switching to email.
                              contact: c.id === 'email' && !formData.reminders.contact ? (user?.email || '') : (c.id === 'sms' ? '' : formData.reminders.contact),
                            })}
                            className={`px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                              formData.reminders.channel === c.id
                                ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                                : 'border-slate-200 text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Contact */}
                    <div>
                      <label htmlFor="reminder-contact" className="block text-sm font-medium text-slate-700 mb-1">
                        {formData.reminders.channel === 'email' ? 'Email address' : 'Phone number'}
                      </label>
                      <input
                        id="reminder-contact"
                        type={formData.reminders.channel === 'email' ? 'email' : 'tel'}
                        value={formData.reminders.contact}
                        onChange={(e) => updateReminders({ contact: e.target.value })}
                        placeholder={formData.reminders.channel === 'email' ? 'you@example.com' : '+1 555 123 4567'}
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                      />
                    </div>

                    {/* Time */}
                    <div>
                      <span className="block text-sm font-medium text-slate-700 mb-2">When?</span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {REMINDER_TIMES.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => updateReminders({ time: t.id })}
                            className={`px-3 py-2 rounded-lg border-2 text-xs font-medium transition-all ${
                              formData.reminders.time === t.id
                                ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                                : 'border-slate-200 text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Consent */}
                    <label className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.reminders.consent}
                        onChange={(e) => updateReminders({ consent: e.target.checked })}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                      />
                      <span>
                        I agree to receive daily goal reminders at the contact above. I can turn these
                        off anytime.
                      </span>
                    </label>

                    {formData.reminders.consent && !formData.reminders.contact.trim() && (
                      <p className="text-xs text-amber-600">Add a {formData.reminders.channel === 'email' ? 'email' : 'phone number'} so we know where to send reminders.</p>
                    )}

                    {/* Honest note: we store the preference now; delivery isn't live yet. */}
                    <p className="text-[11px] text-slate-400 italic">
                      We&apos;ll save this to your profile now. Reminder delivery is rolling out soon —
                      we won&apos;t message you until it&apos;s switched on.
                    </p>
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-400 mt-4">
                You can fine-tune placement, size, and colors later in Settings and on each screen.
              </p>
            </div>
          )}

          {/* Step 8: AI Recommendations */}
          {currentStep === 8 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-6 h-6 text-cyan-600" />
                <h2 className="text-2xl font-bold text-slate-800">AI-Recommended Services</h2>
              </div>
              <p className="text-slate-600 mb-4">
                Based on your profile, we&apos;ve found resources that may help you achieve your goals.
                Free and lower-cost options are listed first. Save any that interest you to access
                them later in ResourceHub.
              </p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
                <p className="text-sm text-blue-700">
                  💡 <strong>Note:</strong> To save resources permanently and access &quot;My Resources&quot; in ResourceHub, 
                  you&apos;ll need to sign in to ResourceHub with the same email. Your saved selections will be synced automatically.
                </p>
              </div>

              {isLoadingRecommendations ? (
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-indigo-950 via-purple-900 to-sky-400 py-16 px-6">
                  {/* Twinkling stars */}
                  {Array.from({ length: 25 }, (_, i) => (
                    <div
                      key={i}
                      className="absolute w-1 h-1 bg-white rounded-full"
                      style={{
                        left: `${(i * 37 + 13) % 100}%`,
                        top: `${(i * 23 + 7) % 70}%`,
                        opacity: ((i * 17) % 80 + 20) / 100,
                        animation: `twinkle ${1 + (i % 3)}s ease-in-out infinite`,
                        animationDelay: `${(i * 13 % 200) / 100}s`,
                      }}
                    />
                  ))}
                  <style>{`
                    @keyframes twinkle { 0%,100%{opacity:.2} 50%{opacity:1} }
                    @keyframes rocketFloat { 0%,100%{transform:translateY(0) rotate(-4deg)} 50%{transform:translateY(-14px) rotate(4deg)} }
                  `}</style>

                  <div className="relative z-10 flex flex-col items-center text-center">
                    <div className="text-7xl mb-4" style={{ animation: 'rocketFloat 2.5s ease-in-out infinite' }}>🚀</div>
                    <h3 className="text-2xl font-bold text-white mb-2">☁️ Welcome to Dream Land!</h3>
                    <p className="text-sky-100 text-sm max-w-sm mb-6">
                      Our AI agents are analyzing your norms, your goals, and your location to find the best matches. Hang tight while we build your Dream Land.
                    </p>
                    <div className="space-y-2 w-full max-w-sm text-left">
                      <div className="flex items-center gap-3 text-sm text-sky-100">
                        <div className="w-2 h-2 bg-cyan-300 rounded-full animate-pulse" />
                        Analyzing your barrier profile...
                      </div>
                      <div className="flex items-center gap-3 text-sm text-sky-100">
                        <div className="w-2 h-2 bg-purple-300 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
                        Matching with community-rated resources...
                      </div>
                      <div className="flex items-center gap-3 text-sm text-sky-100">
                        <div className="w-2 h-2 bg-pink-300 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
                        Personalizing recommendations...
                      </div>
                    </div>
                  </div>
                </div>
              ) : recommendations.length === 0 ? (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
                  <Sparkles className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                  <p className="text-slate-700 mb-2 font-medium">No recommendations available yet</p>
                  <p className="text-sm text-slate-500 mb-4">
                    {recommendationExplanation || 'Sign in to ResourceHub to get personalized recommendations based on your profile.'}
                  </p>
                  <button
                    onClick={() => { setRecommendations([]); fetchRecommendations() }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-all"
                  >
                    <Sparkles className="w-4 h-4" /> Try again
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {recommendationExplanation && (
                    <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4 mb-4">
                      <p className="text-sm text-cyan-700">{recommendationExplanation}</p>
                    </div>
                  )}
                  
                  <div className="grid gap-4 max-h-[500px] overflow-y-auto pr-2">
                    {recommendations.map((resource) => (
                      <div
                        key={resource.id}
                        className="bg-white border border-slate-200 rounded-xl p-4 hover:bg-slate-50 transition-all"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-lg text-slate-800">{resource.name}</h3>
                              {resource.category && (
                                <span className="px-2 py-1 text-xs bg-cyan-100 text-cyan-700 rounded">
                                  {resource.category}
                                </span>
                              )}
                              {/* Cost up front (Chi): free options are surfaced
                                  first and labelled, so you know before clicking. */}
                              {resource.price === 0 ? (
                                <span className="px-2 py-1 text-xs font-semibold bg-emerald-100 text-emerald-700 rounded">
                                  Free
                                </span>
                              ) : typeof resource.price === 'number' ? (
                                <span className="px-2 py-1 text-xs bg-slate-100 text-slate-600 rounded">
                                  ${resource.price}
                                </span>
                              ) : null}
                            </div>
                            <p className="text-sm text-slate-600 mb-2 line-clamp-2">
                              {resource.description}
                            </p>
                            {resource.location && (
                              <p className="text-xs text-slate-500 mb-2">
                                📍 {resource.location.city}, {resource.location.province}
                              </p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-slate-500">
                              {resource.averageRating > 0 && (
                                <span>⭐ {resource.averageRating.toFixed(1)} ({resource.ratingCount} reviews)</span>
                              )}
                              {resource.score > 0 && (
                                <span className="text-cyan-600 font-medium">{resource.score}% match</span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleSaveResource(resource.id)}
                            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                              savedResources.has(resource.id)
                                ? 'bg-green-100 text-green-700 border border-green-300'
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {savedResources.has(resource.id) ? (
                              <>
                                <Check className="w-4 h-4 inline mr-1" />
                                Saved
                              </>
                            ) : (
                              'Save'
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                    <p className="text-sm text-blue-700">
                      💡 <strong>Tip:</strong> You can always find these resources later in ResourceHub&apos;s &quot;My Resources&quot; section. 
                      You can also recommend new resources to help others in the community.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between items-center mt-8 pt-6 border-t border-slate-200">
            <button
              onClick={handleBack}
              disabled={currentStep === 0}
              className="flex items-center gap-2 px-5 py-3 rounded-xl border-2 border-slate-300 text-slate-700 font-medium hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
              Back
            </button>

            <div className="flex items-center gap-3">
              {skippableSteps.has(currentStep) && currentStep < steps.length - 1 && (
                <button
                  onClick={handleSkip}
                  className="px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-800 underline underline-offset-2 transition-all"
                >
                  Skip for now
                </button>
              )}

              {currentStep < steps.length - 1 ? (
                <button
                  onClick={handleNext}
                  disabled={!canProceed()}
                  className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-xl transition-all"
                >
                  {currentStep === 7 ? 'View Recommendations' : 'Continue'}
                  <ChevronRight className="w-5 h-5" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={!canProceed() || isSubmitting}
                  className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-xl transition-all"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Creating your path...
                    </>
                  ) : (
                    <>
                      🚀 Launch to Dream Land!
                      <Rocket className="w-5 h-5" />
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Honest waiting state. No progress bar — we cannot see inside the
                pipeline, and a bar that stalls at 80% is worse than a clock. */}
            {isSubmitting && (
              <div className="mt-4 text-center" role="status" aria-live="polite">
                <p className="text-sm font-medium text-slate-700">{displayStage}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {elapsed}s elapsed · usually about a minute, longer if others are starting at the same time
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Please keep this tab open — refreshing starts it over.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Step indicator for mobile */}
        <div className="text-center mt-4 text-slate-500 text-sm">
          Step {currentStep + 1} of {steps.length}
        </div>
      </div>
    </div>
  )
}
