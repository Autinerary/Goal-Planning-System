'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'
import {
  User, Check, ChevronRight, ChevronLeft, Loader2,
  Target, Rocket, Lightbulb, Map as MapIcon
} from 'lucide-react'
import { DEFAULT_REMINDERS, loadPreferences, type ReminderPreferences } from '@/lib/preferences'
import Define from '../components/Define'
import { DEFAULT_HAIR_COLOR, DEFAULT_SKIN_TONE, DEFAULT_CLOTHING } from '@/lib/avatar'
import { type Appearance } from '@/app/components/AvatarEditor'
import { ageBandFromDob, isAdult } from '@/lib/age'
import { playPageTurnSound } from '@/lib/taskSound'
import { toLlmConfig } from '@/lib/modelPrefs'
import { createClient } from '@/lib/supabase/client'
import { track } from '@/lib/funnel'
import { wakeBackend } from '@/lib/wakeBackend'
import { START_FOR_KEY, START_NEED_KEY, START_GOALS, isStartGoal, isStartRole, suggestedStart } from '@/lib/startHere'
import GoalHelper from '@/app/components/GoalHelper'
import { GOAL_AREAS, isGoalArea } from '@/lib/goalAreas'
import ChatSetup from '@/app/components/ChatSetup'
import { AUDIENCES, AUDIENCE_GROUPS, AUDIENCE_VALUE, AUDIENCE_EFFECT } from '@/lib/audiences'
import { browserTimeZone } from '@/lib/reminderSchedule'
import { KIT_AUDIENCES } from '@/lib/starterKits'
import CrisisLines from '@/app/components/CrisisLines'
import { DisplayButton, DisplayPanel, useDisplayToggle } from '@/app/components/DisplayToggle'
import {
  EMPTY_DIAGNOSTIC_PROFILE,
  toRecommendationSupportContext,
  type DiagnosticProfile,
} from '@/lib/diagnostic-profile'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
/** A required question's red asterisk, with the word for screen readers. */
function RequiredMark() {
  return (
    <>
      <span className="font-bold text-red-700" aria-hidden="true">*</span>
      <span className="sr-only"> (required)</span>
    </>
  )
}

// Step components
// `short` is what the progress rail shows; `title` stays the full name and
// remains the accessible label.
//
// Goal-first order (Riipen Labs, Group 2): "sort the questions into need now
// and ask later", then an optional condition question. Group 5 then asked to
// "reduce initial sign-up to 3 core steps (account setup, primary role,
// immediate goal)" and to ask about conditions and sensory needs later. So
// the two steps (after the account) are the whole start, and the path is
// created at the end of them. The Path suggests norms and sensory needs from
// the second week (components/ProfileCompletion.tsx).
// The AI recommendations step was dropped from setup (Group 5: keep the AI
// "running behind the scenes until basic onboarding is fully completed");
// Start here's resources follow setup instead.
//
// Riipen Labs, Groups 25 to 30 (September 2026) then asked for the optional
// extras to leave setup altogether: "move personalization questions after
// users enter the app" (25), "remove the Location, Personalize, and AI
// Recommendations steps" (26), "reduce open-ended questions and personal
// information requests before users see value" (27), "everything else ...
// should move inside, where it can come up at the moment it is useful" (28),
// character, avatar and preferences on "an optional 'Complete Your Profile'
// card" (29), and "move deferred questions into contextual prompts" (30). So
// setup is these two steps, and the rest (norms, city, what motivates you,
// character and Dream Self, spirit animals, how the app looks, reminders) is
// on the Path's "Complete your profile" card (components/ProfileCompletion),
// each where it is used, and in Settings.
const steps = [
  { id: 'about', title: 'About you', short: 'About you', icon: User },
  { id: 'goalsAndDreams', title: 'Your goal', short: 'Goal', icon: Target },
]
// Every action in setup that isn't the next step: outlined, never underlined
// text (see the buttons at the bottom of each step).
const SECONDARY_BUTTON =
  'inline-flex items-center gap-2 rounded-xl border-2 border-slate-400 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition-all hover:border-indigo-500 hover:bg-indigo-50/40 disabled:cursor-not-allowed disabled:opacity-60'
const stepIndex = (id: string) => steps.findIndex((s) => s.id === id)
// Only these must be answered (age is confirmed inside 'about').
const REQUIRED_STEP_IDS = new Set(['about', 'goalsAndDreams'])
// Drafts saved before the reorder stored a position in this order; position 0
// held the age question, which now lives in 'about'. A draft saved on a step
// that has since left setup resumes on the goal (see the restore below).
const LEGACY_STEP_ORDER = ['about', 'barrierConnections', 'location', 'goalsAndDreams', 'motivation', 'profile', 'spiritAnimal', 'personalize', 'recommendations']

// "Who are you here for?", its groups and what each answer gets: lib/audiences.ts,
// shared with Settings, where the answer can be changed later.

// The "Start here" answers kept in this browser, if both were given.
function keptStartPath(): { for: string; need: string; savedAt: string } | null {
  try {
    const role = localStorage.getItem(START_FOR_KEY)
    const need = localStorage.getItem(START_NEED_KEY)
    if (isStartRole(role) && isStartGoal(need)) return { for: role, need, savedAt: new Date().toISOString() }
  } catch {}
  return null
}

// Why the path could not be made, in plain words, with what to do next. It
// used to be a browser pop-up with the server's own words ("Cannot connect to
// server at https://...", "Agent orchestration failed: ..."). Riipen Labs'
// cohort report: "test technical error states". The backend's own messages
// are kept only where they are written for people: a goal the guardrails
// turned down (422) and the daily limit (429).
function submitErrorMessage(error: any): string {
  const saved = 'Your answers are saved on this device, so nothing is lost.'
  const status: number | undefined = error?.response?.status
  const detail = error?.response?.data?.detail
  if ((status === 422 || status === 429) && typeof detail === 'string' && detail.trim()) return detail
  if (status === 401 || status === 403) return `Your sign-in needs refreshing. Sign in again and come back here. ${saved}`
  if (error?.request && !error?.response) return `We couldn't reach Autinerary just now. Check your internet connection, then try again. ${saved}`
  if (String(error?.message || '').includes('longer than expected')) return `Making your path is taking much longer than usual. Please try again in a few minutes. ${saved}`
  return `Your path couldn't be made just now. Please try again in a minute. ${saved}`
}

// "What are you looking for today?" decides what is shown first after setup.
const LOOKING_FOR = [
  { id: 'plan', label: 'A step-by-step plan for a goal' },
  { id: 'services', label: 'Services or places that can help' },
  { id: 'community', label: 'Advice from people with similar experiences' },
  { id: 'tools', label: 'Tools, apps and products' },
  { id: 'learning', label: 'To learn and understand more' },
]
// For parents, family and people who support others at school or work
// (Riipen Labs, Group 24: "Immediate Need: Diagnosis Navigator vs. School IEP
// vs. Crisis Support"); each leads to a starter kit (lib/starterKits.ts).
const LOOKING_FOR_CARE = [
  { id: 'assessment', label: 'An assessment or diagnosis' },
  { id: 'school', label: 'Support at school, like an IEP' },
]
// For everyone: picking it shows who to call at once, before anything else.
const LOOKING_FOR_URGENT = { id: 'urgent', label: 'Help right now' }

// How much energy someone has for setting up today (Riipen Labs, Group 23:
// "an initial question asking users to select their current energy level ...
// so the setup length dynamically adapts to what they can handle in that
// moment"; it "must remain optional and very brief", and people "should be
// able to change paths or skip the check-in"). Setup is already the two
// questions a plan needs, so the answer changes what comes after it: nothing
// more today, or a few more questions straight away (app/onboarding-confirmation).
const ENERGY_CHOICES: { id: 'low' | 'some' | 'plenty'; label: string; hint?: string }[] = [
  { id: 'low', label: 'Not much', hint: 'just the essentials' },
  { id: 'some', label: 'Some' },
  { id: 'plenty', label: 'Plenty', hint: 'I’d like to set up more' },
]
const ENERGY_NOTE: Record<string, string> = {
  low: 'Two short questions, then your plan. Nothing else today.',
  some: 'Two short questions, then your plan. The rest can wait.',
  plenty: 'Two short questions, then your plan. After that, a few more if you like.',
}

// The person a connection is about, for the optional relationship question:
// a parent's is their child (it used to say "Ideal relationship with Parent").
const OTHER_PERSON: Record<string, string> = {
  parent: 'your child', sibling: 'your sibling', partner: 'your partner', coworker: 'your coworker',
  friend: 'your friend', educator: 'your student', employer: 'the person you employ', therapist: 'your client',
}

// One life area first (Riipen Labs, Group 20: "introduce one life path first
// instead of showing all four at once ... Choose which life path should be
// introduced first"). The area that fits the answers so far, or else
// Education: of 63 people's first goals on 12 October 2026 (test accounts
// left out), 32 were about education, more than any other area.
const AREA_FOR_LOOKING: Record<string, string> = {
  learning: 'education', school: 'education', services: 'health', assessment: 'health', community: 'relationships', tools: 'health',
}
const AREA_FOR_START_NEED: Record<string, string> = {
  services: 'health', community: 'relationships', learn: 'barrier', sensory: 'health',
}

// Why each question is asked, shown with it (Riipen Labs, Group 28: "each
// question carries a visible reason for being asked"; Riipen: "show how key
// features connect"). Each line was checked against where the app reads it.
const WHY_WE_ASK = {
  age: 'Autinerary is for adults 18 and over for now.',
  energy: 'So setup asks only what you have energy for today. You can change it at any point.',
  // Who you're here for says why in AUDIENCE_EFFECT (lib/audiences.ts), shared with Settings.
  lookingFor: 'We show you that first once your plan is ready.',
  goal: 'Your path is built from it: the goal broken into small steps, called milestones, each with tools that can help.',
}

// What the next step involves, beside the button that leads to it (Riipen
// Labs, Group 26: "a preview of what the next step involves"; Group 28:
// people should know "what their next step should be").
const NEXT_PREVIEW: Record<string, string> = {
  about: 'Next: your goal. Pick an idea or type your own, about a minute.',
  goalsAndDreams: 'Next: we make your plan, in about a minute, then you are on your Path. Everything else is optional and can be added there.',
}
// The goal step's preview, by the energy answer.
const NEXT_PREVIEW_BY_ENERGY: Record<string, string> = {
  low: 'Next: we make your plan, in about a minute. That is all for today.',
  plenty: 'Next: we make your plan, in about a minute. Then, if you like, a few more questions to make it fit you.',
}

// The areas are shared with the Dream Self page (lib/goalAreas.ts).
const goalCategories: { id: string; label: string; emoji: string; placeholder: string }[] = [...GOAL_AREAS]

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
  'English as an Additional Language': {
    education: ['Improve language skills'],
    barrier: ['Find translation & interpreter support'],
  },
  // Kept as an alias, not replaced: profiles saved under the old label are
  // real user data and must keep resolving.
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
  const sourceSuggestions: Record<string, string[]> = {
    education: ['Learn a new language', 'Take a course in a practical skill'],
    career: ['Practice presentation skills', 'Mentor a colleague'],
    relationships: ['Arrange a regular catch-up with a friend', 'Plan shared time with family', 'Volunteer in my community'],
    health: ['Find a physical activity I enjoy', 'Make time for a mindful pause'],
    other: ['Learn to cook a new meal', 'Start a creative hobby', 'Build a personal budget', 'Start an emergency fund', 'Reduce weekly expenses', 'Plan to pay down debt'],
  }
  const out = new Set<string>(sourceSuggestions[categoryId] || [])

  if (categoryId === 'barrier') {
    universalBarrierStrategies.forEach(s => out.add(s))
  }

  barrierTypes.forEach(barrier => {
    const perCategory = barrierGoalSuggestions[barrier]?.[categoryId]
    perCategory?.forEach(s => out.add(s))
  })

  return Array.from(out)
}

export default function OnboardingPage() {
  const router = useRouter()
  const { user, supabaseUser, completeOnboarding, skipSetup, isLoading: authLoading } = useAuth()
  // "Skip for now" (Riipen Labs, Group 33): into the app without a plan.
  const [skipping, setSkipping] = useState(false)
  const [skipError, setSkipError] = useState('')
  const skipForNow = async (to: 'path' | 'resources' = 'path', href = '/path') => {
    setSkipping(true)
    setSkipError('')
    try {
      await skipSetup(to, href)
    } catch {
      setSkipError('That didn’t work. Check your connection and try again.')
      setSkipping(false)
    }
  }
  // Display, from the first screen (Riipen Labs, Group 22: sensory control
  // "before the animations load"; it was step 8 of 9).
  const display = useDisplayToggle()
  // The path is made on the backend at the end of setup; wake it now, while
  // the questions are answered (lib/wakeBackend.ts).
  useEffect(() => {
    wakeBackend()
  }, [])
  const [guardianApproved, setGuardianApproved] = useState(false)
  const isManagedAccount = !!(supabaseUser?.app_metadata?.managed_by_guardian || supabaseUser?.user_metadata?.managed_by_guardian)
  const [currentStep, setCurrentStep] = useState(0)
  const currentId = steps[currentStep]?.id ?? 'about'
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Why the last try to create the path failed, in plain words (shown under the buttons).
  const [submitError, setSubmitError] = useState('')
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
  const [missingSections, setMissingSections] = useState<number[]>([])

  const [formData, setFormData] = useState({
    // Character select
    characterType: 'avatar' as string, // always avatar now (spirit animal selection at end)
    ageConfirmation: '' as '' | 'adult' | 'under18',
    // Goal-first start: who this is for, and what they came for.
    audience: '' as string,
    lookingFor: [] as string[],
    // The optional energy check-in (ENERGY_CHOICES): '' when not answered.
    setupEnergy: '' as '' | 'low' | 'some' | 'plenty',
    bodyType: '' as string,
    hairStyle: '' as string,
    hairColor: DEFAULT_HAIR_COLOR as string,
    skinColor: DEFAULT_SKIN_TONE as string,
    accessory: 'none' as string,
    facialHair: 'none' as string,
    clothing: DEFAULT_CLOTHING as string,
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
    // lifeStages is the real answer; lifeStage keeps the first selection so
    // the recommendations call, which takes a single stage, still works.
    // Same pattern as motivationType / motivationTypes below.
    lifeStage: '' as string,
    lifeStages: [] as string[],
    barrierTypes: [] as string[],
    // Categorized goals with per-goal dreams and obstacles
    goalsByCategory: {} as Record<string, Array<{ goal: string; dreams: string; obstacles: string; idealRelationship?: string; selfDream?: string }>>,
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
    dreamForOther: '',
    dreamRelationship: '',
    dreamAppearance: { hairStyle: 'short_straight', hairColor: DEFAULT_HAIR_COLOR, skinColor: DEFAULT_SKIN_TONE } as Appearance,
    personaAppearance: { hairStyle: 'short_straight', hairColor: DEFAULT_HAIR_COLOR, skinColor: DEFAULT_SKIN_TONE } as Appearance,
    // Alternate Persona (optional) — a named alter-ego for the Dream Self
    alternatePersonaName: '' as string,
    alternatePersonaNote: '' as string,
    // Spirit animals — mode decides how many slots:
    //   general = 1, fastSlow = 2 (fast/slow day), weekly = 7 (one per day)
    spiritAnimalMode: 'general' as 'general' | 'fastSlow' | 'weekly',
    spiritAnimals: [] as Array<{ type: string; color: string }>,
  })
  // Sign-up asks for the date of birth (18+), so setup does not ask the age
  // again when that says 18 or older.
  const ageFromSignup = !isManagedAccount && isAdult(supabaseUser?.app_metadata?.date_of_birth || supabaseUser?.user_metadata?.date_of_birth)
  useEffect(() => {
    if (ageFromSignup) setFormData(prev => prev.ageConfirmation === 'adult' ? prev : { ...prev, ageConfirmation: 'adult' })
  }, [ageFromSignup])
  const canAccessOnboarding = isManagedAccount ? guardianApproved : formData.ageConfirmation === 'adult'

  useEffect(() => {
    setGuardianApproved(false)
    if (!isManagedAccount) return
    let cancelled = false
    fetch('/api/me/guardian-approval', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : { approved: false })
      .then(result => { if (!cancelled) setGuardianApproved(result.approved === true) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user?.id, isManagedAccount])

  // Active Path Market context (null when the user started their own path).
  // Drives the pathway banner and the tailored goal suggestions so a chosen
  // path doesn't feel identical to the generic onboarding.
  const [pathSeed, setPathSeed] = useState<
    { key: string; title: string; focusCategory: string; suggestions: string[] } | null
  >(null)
  // The Path Market model this path was started from. Kept separately because
  // pathSeed is consumed for suggestions, while this is a lasting fact about
  // the path that the Path view names back to the user.
  const [chosenModel, setChosenModel] = useState<
    { key: string; title: string; name: string | null; categoryTitle: string | null; description: string | null } | null
  >(null)
  // True when we prefilled stable answers (barriers/location/etc.) from a prior
  // completed onboarding so a returning user doesn't re-enter everything.
  // What was kept from an earlier plan, to say exactly that (it said "your
  // norms and location" when only one was kept).
  const [carriedOver, setCarriedOver] = useState<{ norms: boolean; location: boolean } | null>(null)
  // The goal step shows the category picked (and any that already hold a
  // goal), not all six at once; the dream box opens on request.
  const [openGoalCategory, setOpenGoalCategory] = useState<string | null>(null)
  // Every area's button, or only the one setup starts with (Group 20).
  const [showAllAreas, setShowAllAreas] = useState(false)
  const [startNeed, setStartNeed] = useState<string | null>(null)
  // A goal's dream, relationship and obstacle are folded away until asked for
  // (Riipen Labs, Groups 27 and 30: open-ended questions "may be difficult to
  // answer immediately"). Keyed "<category>:<index>".
  const [openGoalDetails, setOpenGoalDetails] = useState<Record<string, boolean>>({})
  // Norms and the private condition and support details are no longer asked
  // in setup (Riipen Labs, Groups 25 to 30): they are added in the app, from
  // the "Complete your profile" card, ResourceHub or /profile/diagnostic. What
  // someone has saved there is sent with the path request, as setup's own
  // answers used to be, so a plan made later still fits them. Neither is
  // written back from here (the backend only ever adds norms).
  const [savedNorms, setSavedNorms] = useState<string[]>([])
  const [savedSupport, setSavedSupport] = useState<DiagnosticProfile | null>(null)
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    fetch('/api/me/norms', { cache: 'no-store', credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => { if (!cancelled && Array.isArray(json?.norms)) setSavedNorms(json.norms) })
      .catch(() => {})
    fetch('/api/me/diagnostic-profile', { cache: 'no-store', credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const saved = json?.diagnosticProfile?.profile
        if (cancelled || !saved) return
        setSavedSupport({ ...EMPTY_DIAGNOSTIC_PROFILE, ...saved, consentToStore: true, supportContext: { ...EMPTY_DIAGNOSTIC_PROFILE.supportContext, ...(saved.supportContext || {}) } })
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user?.id])

  // Norms are optional. Left unanswered, they are sent exactly as an explicit
  // "Prefer not to share", the value existing rows and the condition taxonomy
  // already use, so nothing downstream sees a new shape.
  const selectedBarrierTypes = formData.barrierTypes.length > 0
    ? formData.barrierTypes
    : savedNorms.length > 0
      ? savedNorms
      : formData.barrierConnectionText.trim()
        ? [formData.barrierConnectionText.trim()]
        : ['Prefer not to share']
  // The non-clinical part of the private profile they saved, sent with the
  // path request. Empty when nothing was saved.
  const agentSupportContext = savedSupport ? toRecommendationSupportContext(savedSupport) : undefined

  // ─── Autosave: persist progress to localStorage so it survives page reloads ───
  const AUTOSAVE_KEY = 'autinerary_onboarding_draft'
  const [draftReady, setDraftReady] = useState(false)
  const draftRestored = useRef(false)
  // The step a saved draft reopened on, to say so there (Riipen Labs, Group
  // 11: "Need a break? Your progress is saved"). Null on a fresh start.
  const [resumedStep, setResumedStep] = useState<number | null>(null)
  const draftSubmitted = useRef(false)
  // Stable answers from the last completed onboarding, reused to prefill when a
  // returning user starts another path (see the carry-over block on mount).
  const CARRYOVER_KEY = 'autinerary_onboarding_carryover'

  // Restore saved draft on mount
  useEffect(() => {
    if (draftRestored.current) return
    draftRestored.current = true
    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY)
      let restoredDraft = false
      if (saved) {
        const { step, stepId, data } = JSON.parse(saved)
        if (data && typeof step === 'number') {
          setFormData(prev => ({ ...prev, ...data }))
          // Restore by id; drafts from before the goal-first reorder only
          // know their position in the old order.
          const id = typeof stepId === 'string' ? stepId : LEGACY_STEP_ORDER[step]
          // A step that no longer exists (AI recommendations, the last one)
          // resumes at the last step there is.
          const at = stepIndex(id)
          const resumeAt = data.ageConfirmation === 'adult' ? (at >= 0 ? at : steps.length - 1) : 0
          setCurrentStep(resumeAt)
          // Only when something was answered: every visit saves a draft.
          if (data.ageConfirmation || data.audience) setResumedStep(resumeAt)
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
        // Odosa: pathway selection should SUGGEST, not pre-select — picking a
        // Path Market model used to write its seedGoals directly into
        // goalsByCategory as if the user had typed them, so a model's goals
        // were already "chosen" before onboarding even started and the user
        // had to notice and remove the ones they did not want. The model's
        // goals now join the same tap-to-add suggestion chips the category's
        // general examples already use, instead of a second, separate
        // mechanism that silently pre-fills real entries.
        if (seed?.key) {
          if (Array.isArray(seed.selectedGoals) && seed.selectedGoals.length > 0) {
            setFormData(previous => {
              const entries = [...(previous.goalsByCategory[focusCategory] || [])]
              for (const goal of seed.selectedGoals) {
                if (typeof goal === 'string' && goal.trim() && !entries.some(entry => entry.goal === goal)) entries.push({ goal, dreams: '', obstacles: '' })
              }
              return { ...previous, goalsByCategory: { ...previous.goalsByCategory, [focusCategory]: entries } }
            })
            localStorage.setItem('autinerary_path_seed', JSON.stringify({ ...seed, selectedGoals: [] }))
          }
          const modelGoals: string[] = Array.isArray(seed.goals) ? seed.goals : []
          const generalSuggestions: string[] = Array.isArray(seed.suggestions) ? seed.suggestions : []
          const merged = [...modelGoals, ...generalSuggestions.filter((s) => !modelGoals.includes(s))]
          setPathSeed({
            key: seed.key,
            title: seed.title || 'Your path',
            focusCategory,
            suggestions: merged,
          })
          setChosenModel({
            key: seed.key,
            title: seed.title || 'Your path',
            name: seed.modelName || null,
            categoryTitle: seed.categoryTitle || null,
            description: seed.description || null,
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
              lifeStages: Array.isArray(c.lifeStages)
                ? c.lifeStages
                : (c.lifeStage ? [c.lifeStage] : prev.lifeStages),
              motivationType: c.motivationType || prev.motivationType,
              motivationTypes: Array.isArray(c.motivationTypes) ? c.motivationTypes : prev.motivationTypes,
              ageRange: c.ageRange || prev.ageRange,
              techSavvy: c.techSavvy || prev.techSavvy,
              viewPreference: c.viewPreference || prev.viewPreference,
              bodyType: c.bodyType || prev.bodyType,
              hairStyle: c.hairStyle || prev.hairStyle,
              hairColor: c.hairColor || prev.hairColor,
              skinColor: c.skinColor || prev.skinColor,
              accessory: c.accessory || prev.accessory,
              facialHair: c.facialHair || prev.facialHair,
              clothing: c.clothing || prev.clothing,
            }))
            const keptNorms = Array.isArray(c.barrierTypes) && c.barrierTypes.length > 0
            const keptLocation = Boolean(c.location?.city)
            if (keptNorms || keptLocation) setCarriedOver({ norms: keptNorms, location: keptLocation })
          }
        }
      }
    } catch {
      // corrupt data — ignore
    } finally {
      setDraftReady(true)
    }
  }, [])

  useEffect(() => {
      if (!draftReady || draftSubmitted.current) return
      try {
        localStorage.setItem(
          AUTOSAVE_KEY,
          JSON.stringify({ step: currentStep, stepId: steps[currentStep].id, data: formData })
        )
      } catch {
        // quota exceeded — ignore
      }
  }, [currentStep, formData, draftReady])

  // Funnel: which steps people reach, to see where setup loses them. Every
  // visit is sent, coming back included, so the report can show where people
  // pause and which steps they return to (Riipen Labs, Group 10: "where do
  // users pause, leave, or repeat steps?"); "reached" still counts each
  // browser once.
  // stepsSeen also decides which optional extras are asked later (below).
  const stepsSeen = useRef(new Set<number>())
  const lastStepTracked = useRef<number | null>(null)
  useEffect(() => {
    if (!draftReady || lastStepTracked.current === currentStep) return
    lastStepTracked.current = currentStep
    stepsSeen.current.add(currentStep)
    track('onboarding_step_view', steps[currentStep].id)
  }, [currentStep, draftReady])

  // Reminders to finish setup, by email, only when asked for (see the
  // footer): up to three, each with "finish now, remind me in a few days, or
  // stop" (Riipen Labs, Groups 20 and 24; lib/setupReminders.ts). Remembered in
  // this browser so the offer is not repeated.
  const SETUP_REMINDER_KEY = 'autinerary_setup_reminder'
  const [setupReminder, setSetupReminder] = useState<'none' | 'asked' | 'failed'>('none')
  useEffect(() => {
    try { if (localStorage.getItem(SETUP_REMINDER_KEY)) setSetupReminder('asked') } catch {}
  }, [])
  const setupReminderAction = (body: Record<string, unknown>) =>
    fetch('/api/me/setup-reminder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    }).then(res => res.ok).catch(() => false)
  const requestSetupReminder = async () => {
    const ok = await setupReminderAction({ action: 'ask', timeZone: browserTimeZone(), audience: formData.audience || null })
    setSetupReminder(ok ? 'asked' : 'failed')
    if (ok) try { localStorage.setItem(SETUP_REMINDER_KEY, '1') } catch {}
  }
  const cancelSetupReminder = async () => {
    if (!(await setupReminderAction({ action: 'cancel' }))) return
    setSetupReminder('none')
    try { localStorage.removeItem(SETUP_REMINDER_KEY) } catch {}
  }
  // Opened from a reminder's "Finish setting up": counted once (the funnel's
  // "reminder return rate", Group 24).
  useEffect(() => {
    if (!user?.id) return
    try {
      if (new URLSearchParams(window.location.search).get('from') !== 'setup-reminder') return
      if (sessionStorage.getItem('autinerary_reminder_clicked')) return
      sessionStorage.setItem('autinerary_reminder_clicked', '1')
    } catch { return }
    void setupReminderAction({ action: 'clicked' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // What the goal helper may suggest: the ideas the goal step shows (and the
  // examples in each field), nothing else (components/GoalHelper, ChatSetup).
  const ideasFor = (categoryId: string) => {
    const cat = goalCategories.find(c => c.id === categoryId)
    const examples = (cat?.placeholder || '').replace(/^e\.g\.,\s*/, '').split(',').map(s => s.trim()).filter(Boolean)
    const seeded = pathSeed?.focusCategory === categoryId ? pathSeed.suggestions : []
    return Array.from(new Set([...seeded, ...getGoalSuggestions(categoryId, selectedBarrierTypes), ...examples]))
  }
  const helperIdeas = goalCategories.flatMap(cat => ideasFor(cat.id).map(text => ({ category: cat.id, text })))
  const addGoal = (category: string, goal: string) => {
    setOpenGoalCategory(category)
    setFormData(prev => {
      const list = [...(prev.goalsByCategory[category] || [])]
      if (list.some(e => e.goal.trim().toLowerCase() === goal.toLowerCase())) return prev
      const emptyIdx = list.findIndex(e => !e.goal.trim())
      if (emptyIdx >= 0) list[emptyIdx] = { ...list[emptyIdx], goal }
      else list.push({ goal, dreams: '', obstacles: '' })
      return { ...prev, goalsByCategory: { ...prev.goalsByCategory, [category]: list } }
    })
  }
  // From the Dream Self page's "Make a plan" (app/ideal-self/DreamGoals):
  // /onboarding?goal=…&area=… starts with that goal added.
  const goalFromLink = useRef(false)
  useEffect(() => {
    if (!draftReady || goalFromLink.current) return
    goalFromLink.current = true
    const params = new URLSearchParams(window.location.search)
    const goal = (params.get('goal') || '').trim().slice(0, 200)
    if (!goal) return
    const area = params.get('area')
    addGoal(isGoalArea(area) ? area : 'other', goal)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftReady])

  const removeGoal = (category: string, goal: string) => {
    setFormData(prev => {
      const list = (prev.goalsByCategory[category] || []).filter(e => e.goal !== goal)
      const goalsByCategory = { ...prev.goalsByCategory, [category]: list }
      if (list.length === 0) delete goalsByCategory[category]
      return { ...prev, goalsByCategory }
    })
  }
  // Setup as a chat (components/ChatSetup, Riipen Labs, Group 11): the same
  // two questions, answered in a conversation; the extras stay the form.
  const [chatMode, setChatMode] = useState(false)

  // Clear autosave + consumed path seed on successful submission
  const clearAutosave = () => {
    draftSubmitted.current = true
    try {
      localStorage.removeItem(AUTOSAVE_KEY)
      localStorage.removeItem('autinerary_path_seed')
      localStorage.removeItem(SETUP_REMINDER_KEY)
    } catch {}
  }
  // ─────────────────────────────────────────────────────────────────────────────

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/signup')
    }
  }, [user, authLoading, router])

  const canProceed = (step = currentStep) => {
    if (!canAccessOnboarding) return false
    switch (steps[step]?.id) {
      case 'about': return formData.audience !== '' // who this is for (age is checked above)
      case 'goalsAndDreams': { // at least one goal in any category
        const hasGoal = Object.values(formData.goalsByCategory).some(entries => entries.some(e => e.goal.trim()))
        return hasGoal
      }
      default: return false
    }
  }
  
  // What a disabled Continue is waiting for, in plain words. A greyed-out
  // button alone does not say what to do next.
  const continueHint = (): string => {
    if (canProceed()) return ''
    if (!canAccessOnboarding) return 'Confirm your age at the top of this step to continue.'
    switch (currentId) {
      case 'about': return 'Choose who you are here for to continue.'
      case 'goalsAndDreams': return 'Add one goal to continue.'
      default: return ''
    }
  }
  // Both steps answered: the path can be made.
  const requiredDone = canAccessOnboarding && canProceed(stepIndex('about')) && canProceed(stepIndex('goalsAndDreams'))

  // "Start here" (Riipen Labs, Groups 3 and 4) may already have asked who this
  // is for and what they need: use those answers unless setup has its own
  // (from a draft).
  useEffect(() => {
    let pre: string | null = null
    let need: string | null = null
    try {
      pre = localStorage.getItem(START_FOR_KEY)
      need = localStorage.getItem(START_NEED_KEY)
    } catch {}
    const conn = AUDIENCES.find((a) => a.id === pre)
    const lookingFor = START_GOALS.find((g) => g.id === need)?.lookingFor
    if (isStartGoal(need)) setStartNeed(need)
    if (!conn && !lookingFor) return
    setFormData((prev) => {
      const next = { ...prev }
      if (conn && !prev.audience) {
        const untouched = prev.barrierTypes.length === 0
        next.audience = conn.id
        if (untouched) {
          next.barrierConnections = conn.connection ? { [conn.connection]: [] } : {}
          next.role = conn.connection === 'self' ? 'self_advocate' : conn.connection || ''
        }
      }
      if (lookingFor && prev.lookingFor.length === 0) next.lookingFor = [lookingFor]
      return next
    })
  }, [])

  // Picking who this is for pre-selects the matching connection for the
  // norms (now asked on the profile card, not in setup), only while no norms
  // are chosen, so it never wipes answers.
  const chooseAudience = (id: string) => {
    const conn = AUDIENCES.find((a) => a.id === id)?.connection ?? null
    setFormData((prev) => {
      const untouched = prev.barrierTypes.length === 0
      const barrierConnections: Record<string, string[]> = untouched ? (conn ? { [conn]: [] } : {}) : prev.barrierConnections
      const role = untouched ? (conn === 'self' ? 'self_advocate' : conn || '') : prev.role
      // A parent's needs (LOOKING_FOR_CARE) go when the answer is no longer one they are shown for.
      const lookingFor = KIT_AUDIENCES.has(id) ? prev.lookingFor : prev.lookingFor.filter((k) => !LOOKING_FOR_CARE.some((c) => c.id === k))
      return { ...prev, audience: id, barrierConnections, role, lookingFor }
    })
  }

  // Wording that follows who the person is here for (Riipen: "a parent,
  // sibling and a neurodivergent adult may need different first steps").
  const supporting = ['child', 'family', 'friend', 'work'].includes(formData.audience)

  // The life area setup starts with (AREA_FOR_LOOKING above): a chosen path's,
  // one that already holds a goal, what they are looking for, what they
  // needed in Start here, or Education.
  const firstArea: { id: string; fromAnswers: boolean } = (() => {
    if (pathSeed?.focusCategory && isGoalArea(pathSeed.focusCategory)) return { id: pathSeed.focusCategory, fromAnswers: true }
    const withGoal = goalCategories.find(c => (formData.goalsByCategory[c.id] || []).some(e => e.goal.trim()))
    if (withGoal) return { id: withGoal.id, fromAnswers: true }
    const looked = formData.lookingFor.map(k => AREA_FOR_LOOKING[k]).find(Boolean)
    if (looked) return { id: looked, fromAnswers: true }
    if (startNeed === 'school_work') return { id: ['child', 'work'].includes(formData.audience) ? 'education' : 'career', fromAnswers: true }
    if (startNeed && AREA_FOR_START_NEED[startNeed]) return { id: AREA_FOR_START_NEED[startNeed], fromAnswers: true }
    return { id: 'education', fromAnswers: false }
  })()
  const areasWithGoals = goalCategories.filter(c => (formData.goalsByCategory[c.id] || []).some(e => e.goal.trim())).length
  const allAreasShown = showAllAreas || areasWithGoals > 1
  // On reaching the goal step, its first area is open with the field ready.
  useEffect(() => {
    if (currentId !== 'goalsAndDreams' || chatMode || openGoalCategory) return
    const id = firstArea.id
    setOpenGoalCategory(id)
    setFormData(prev => (prev.goalsByCategory[id] || []).length > 0 ? prev : {
      ...prev,
      goalsByCategory: { ...prev.goalsByCategory, [id]: [{ goal: '', dreams: '', obstacles: '' }] },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, chatMode, openGoalCategory, firstArea.id])

  const chooseEnergy = (id: 'low' | 'some' | 'plenty') => {
    const next = formData.setupEnergy === id ? '' : id
    setFormData(prev => ({ ...prev, setupEnergy: next }))
    if (next) track('setup_energy', next)
  }

  // "Skip to resources" (Riipen Labs, Group 24: "a visible, permanent 'Skip to
  // Resources' link on all intake screens"; "time to first resource: under 60
  // seconds"). Parents and people supporting someone get the starter kits;
  // everyone else Start here's resources for their answers, or its two
  // questions when there are none yet.
  const resourcesHref = (): string => {
    if (KIT_AUDIENCES.has(formData.audience)) return '/kits'
    if (!formData.audience) return '/start'
    const goalCategory = Object.keys(formData.goalsByCategory).find(id => formData.goalsByCategory[id].some(e => e.goal.trim()))
    const next = suggestedStart(formData.audience, formData.lookingFor, goalCategory)
    return `/start?for=${next.for}&need=${next.need}`
  }
  const goalIntro = supporting
    ? 'Start with one goal. It can be yours, or something you are working on for the person you support (for example, \u201cFind an occupational therapist for my child\u201d). More goals, dreams and obstacles are optional.'
    : 'Start with one goal. More goals, dreams and obstacles can come later.'

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
      'Racialized Person (Visible Minority)': { id: 'race_visible_minority', category: 'identity', categoryLabel: 'Identity & Background' },
      'English as an Additional Language': { id: 'language', category: 'identity', categoryLabel: 'Identity & Background' },
      // Old labels kept as aliases so previously saved selections still map
      // to the same ids. Renaming what people see must not silently drop
      // what they already told us.
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

  // A new step starts at the top of its card, with focus on its heading: the
  // page stayed where the last step was left, and focus went with the button
  // that was pressed (Riipen Labs, Group 13: "the user has to scroll past
  // these elements each time they submit a section").
  const stepCardRef = useRef<HTMLDivElement>(null)
  const shownStep = useRef(currentStep)
  useEffect(() => {
    if (shownStep.current === currentStep) return
    shownStep.current = currentStep
    stepCardRef.current?.scrollIntoView({ block: 'start' })
    document.getElementById(`step-heading-${currentId}`)?.focus({ preventScroll: true })
  }, [currentStep, currentId])

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }

  const handleSubmit = async () => {
    if (isManagedAccount) {
      const approval = await fetch('/api/me/guardian-approval', { cache: 'no-store' }).then(response => response.ok ? response.json() : { approved: false }).catch(() => ({ approved: false }))
      if (!approval.approved) { setGuardianApproved(false); setCurrentStep(0); return }
    }
    const missing = steps.flatMap((step, index) => REQUIRED_STEP_IDS.has(step.id) && !canProceed(index) ? [index] : [])
    setMissingSections(missing)
    if (missing.length > 0) return
    // Paper/page-turn cue so the submission clearly registered (Liam).
    playPageTurnSound()
    if (!user) return
    
    setIsSubmitting(true)
    setSubmitError('')
    try {
      // What the person has set in the app since (Settings, the "Complete
      // your profile" card). Setup no longer asks for any of it, so nothing
      // here is written over it: reminders, the look, the character, spirit
      // animals and the Dream Self stay as they are.
      const saved = loadPreferences()

      // Flatten categorized goals into flat arrays for backend compat
      const allGoals: string[] = []
      const allDreams: string[] = []
      const allObstacles: string[] = []
      Object.values(formData.goalsByCategory).forEach(entries => {
        entries.forEach(entry => {
          if (entry.goal.trim()) allGoals.push(entry.goal.trim())
          if (entry.dreams.trim()) allDreams.push(entry.dreams.trim())
          if (entry.selfDream?.trim()) allDreams.push(`Dream for self: ${entry.selfDream.trim()}`)
          if (entry.idealRelationship?.trim()) allDreams.push(entry.idealRelationship.trim())
          if (entry.obstacles.trim()) allObstacles.push(entry.obstacles.trim())
        })
      })
      // Their biggest dream: asked on the Ideal Self page since Riipen Labs,
      // Group 17 (an older draft of setup may still hold one).
      const biggestDream = (formData.ultimateDream.trim() || (saved.biggestDream || '').trim()).slice(0, 300)
      if (biggestDream) allDreams.push(biggestDream)
      if (formData.dreamSelf.trim()) allDreams.push(`Dream for self: ${formData.dreamSelf.trim()}`)
      if (formData.dreamForOther.trim()) allDreams.push(`Dream for another person: ${formData.dreamForOther.trim()}`)
      if (formData.dreamRelationship.trim()) allDreams.push(`Dream for the relationship: ${formData.dreamRelationship.trim()}`)

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
        userId: user.id, // Supabase auth UUID, shared with ServiceHub via public.user_barriers
        barrierTypes: selectedBarrierTypes,
        goals: allGoals.length > 0 ? allGoals : formData.goals.filter(g => g.trim()),
        dreams: allDreams.length > 0 ? allDreams : formData.dreams.filter(d => d.trim()),
        currentChallenges: allObstacles.length > 0 ? allObstacles : formData.currentChallenges.filter(c => c.trim()),
        // Asked on the "Complete your profile" card now; the first one, as setup sent it.
        motivationType: saved.motivation?.types?.[0] || formData.motivationType,
        supportContext: agentSupportContext,
        // Who the plan is for: a parent's plan is about supporting their child,
        // never the parent's own career (Riipen Labs, Group 24;
        // backend/core/agents/path_planning_agent.py).
        audience: formData.audience || null,
        // "Words we use" (Settings; Riipen Labs, Group 15): how the plan's
        // text talks about autism and ADHD.
        languageStyle: loadPreferences().languageStyle || null,
        // Only setup's own answers: the backend merges these into the saved
        // preferences (it used to replace them all).
        preferences: {
          pathModel: chosenModel,
          ageRange: formData.ageRange || ageBandFromDob(supabaseUser?.app_metadata?.date_of_birth || supabaseUser?.user_metadata?.date_of_birth) || '',
        },
        llmConfig: toLlmConfig(),
      }

      let response: { data: { pathId?: string } }

      // Lets the backend attribute generation spend to this account rather than
      // to the shared anonymous budget.
      const { data: { session } } = await createClient().auth.getSession()
      const authHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      }

      // 60 s, not 20: a sleeping backend took 41 s to answer, and giving up
      // sooner sent a second request that ran a second generation beside the
      // first (the backend now joins them; core/jobs.py, in_flight_for_user).
      const enqueued = await axios
        .post(`${API_URL}/api/onboarding/jobs`, onboardingBody, {
          headers: authHeaders,
          timeout: 60000,
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
          // A job is shown only to the person it belongs to. The session is
          // read each time, so a token refreshed during a long run is used.
          const { data: { session: current } } = await createClient().auth.getSession()
          const poll = await axios
            .get(`${API_URL}/api/onboarding/jobs/${jobId}`, {
              timeout: 15000,
              headers: current?.access_token ? { Authorization: `Bearer ${current.access_token}` } : {},
            })
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
          headers: authHeaders,
          timeout: 360000,
        })
      }

      // Check if response has pathId
      if (!response.data || !response.data.pathId) {
        throw new Error('Invalid response from server: missing pathId')
      }

      // This browser's copy of the plan's answers, read by the assistant,
      // Path Market and lib/pathModel. Kept from the copy already here: the
      // character, spirit animals and Dream Self in it came from setup's old
      // steps (the pages that read them now prefer the saved preferences), and
      // setup no longer asks for them, so they are not reset to defaults.
      let previous: Record<string, any> = {}
      try { previous = JSON.parse(localStorage.getItem('autinerary_profile') || '{}') || {} } catch {}
      localStorage.setItem('autinerary_profile', JSON.stringify({
        ...previous,
        barriers: mapBarriersToServiceHub(selectedBarrierTypes),
        goals: onboardingBody.goals,
        dreams: onboardingBody.dreams,
        currentChallenges: onboardingBody.currentChallenges,
        goalsByCategory: formData.goalsByCategory,
        barrierTypes: selectedBarrierTypes,
        role: formData.role,
        // Norms are the user's own answers, not the model's — a model does not
        // know which norms the person selected.
        pathModel: chosenModel
          ? { ...chosenModel, norms: selectedBarrierTypes }
          : null,
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
          accessory: formData.accessory,
          facialHair: formData.facialHair,
          clothing: formData.clothing,
          location: formData.location,
          lifeStage: formData.lifeStage,
          lifeStages: formData.lifeStages,
          motivationType: formData.motivationType,
          motivationTypes: formData.motivationTypes,
          ageRange: formData.ageRange,
          techSavvy: formData.techSavvy,
          viewPreference: formData.viewPreference,
        }))
      } catch {}

      await completeOnboarding(response.data.pathId)
      track('onboarding_complete')
      // The "Start here" pathway chosen before signing up ("Save this path"),
      // kept with the account so it can be reopened from the Path.
      const startPath = keptStartPath()
      const prefsSaved = await axios.post('/api/me/preferences', {
        // Who this is for and what they came for: drives what the next pages
        // show first, and lets the funnel be compared by user type.
        audience: formData.audience || null,
        lookingFor: formData.lookingFor,
        // The energy check-in, so the page after setup and the Path follow it.
        ...(formData.setupEnergy ? { setupEnergy: formData.setupEnergy } : {}),
        ...(startPath ? { startPath } : {}),
      }).then(() => true, () => false)
      try {
        // Without a saved Start here pathway, the page after setup still opens
        // with starter resources, picked from who this is for, what they are
        // looking for and their goal (Riipen Labs, Group 5).
        const goalCategory = Object.keys(formData.goalsByCategory).find((id) =>
          formData.goalsByCategory[id].some((e) => e.goal.trim()))
        const suggested = suggestedStart(formData.audience, formData.lookingFor, goalCategory)
        localStorage.setItem('autinerary_onboarding_choices', JSON.stringify({ audience: formData.audience, lookingFor: formData.lookingFor, startPath, suggestedStart: suggested, setupEnergy: formData.setupEnergy || null }))
        // Saved with the account now, so not left for whoever uses this
        // browser next.
        if (prefsSaved && startPath) {
          localStorage.removeItem(START_FOR_KEY)
          localStorage.removeItem(START_NEED_KEY)
        }
        // The optional questions are on the Path's "Complete your profile"
        // card (components/ProfileCompletion.tsx), which works out for itself
        // what is answered; the list the old "ask later" card read is gone.
        localStorage.removeItem('autinerary_ask_later')
      } catch {}
      // Save the location to the profile so ResourceHub can recommend places
      // near this person. Bounded and best-effort: never holds up the path.
      if (formData.location.city.trim()) {
        await axios.post('/api/me/location', formData.location, { timeout: 8000 }).catch(() => {})
      }
      clearAutosave()
      // Back from the confirmation shouldn't reopen an emptied setup.
      router.replace('/onboarding-confirmation')
    } catch (error: any) {
      console.error('Error creating path:', error)
      console.error('Error details:', {
        message: error?.message,
        response: error?.response?.data,
        status: error?.response?.status,
        API_URL
      })
      
      setSubmitError(submitErrorMessage(error))
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
    : 'Laying out your schedule. Nearly there…'
  const displayStage = generationStage || localStage

  // The rail: the two steps. (The optional extras that followed them are in
  // the app now; Riipen Labs, Groups 25 to 30.)
  const progressPercentage = steps.length > 1 ? (currentStep / (steps.length - 1)) * 100 : 100

  return (
    <div className="min-h-screen text-slate-900 p-4 md:p-8 relative overflow-hidden surface-veil">
      {/* The five blurred clouds that sat behind setup are gone: a plain
          background (Riipen Labs, Group 30: "calmer visuals, reduced sensory
          load"), and less above the first question (Group 26: "scroll-free
          sections"). */}
      <div className="relative max-w-3xl mx-auto z-10">
        <div className="mb-2 flex justify-end">
          <DisplayButton open={display.open} onToggle={display.toggle} />
        </div>
        {display.open && <DisplayPanel onClose={display.close} />}

        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
            Welcome{user?.name ? `, ${user.name}` : ''}
          </h1>
          {/* One line on what this is (Riipen Labs, Group 33: "remove redundant
              setup text"). It was "Let's build your personalized path to
              success", then a second welcome inside the first step. */}
          <p className="text-slate-700 text-lg">Two quick questions, then your path is ready.</p>

          {/* Pathway banner — shows this onboarding is tailored to the chosen
              Path Market template, not the generic "start your own path" flow. */}
          {pathSeed && (
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-700 text-sm font-medium">
              <MapIcon className="w-4 h-4" aria-hidden="true" />
              Tailored for your <span className="font-semibold">{pathSeed.title}</span> path
            </div>
          )}

          {/* Carry-over note — reassures returning users we kept their info. */}
          {carriedOver && (
            <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
              <Check className="w-4 h-4" />
              Welcome back. We kept your {carriedOver.norms && carriedOver.location ? 'norms and location' : carriedOver.norms ? 'norms' : 'location'}. Just set goals for this path.
            </div>
          )}
        </div>

        {/* Progress: a slim rail with the bunny on it. It was a tall grass
            track with seven food emoji, a finish flag and a bunny that hopped
            without stopping. Riipen Labs Group 9 found "the frequent use of
            emojis, bright colours, and game-like visual elements" made setup
            feel less polished, and motion that never stops is hard on
            attention (WCAG 2.2.2). The bunny stays, the one playful touch,
            and moves only when the step does. A step's circle turns into a
            tick once it is answered (Group 29: "progress bars and ... mini-
            rewards so account creation feels small and doable"). */}
        <div className="mb-6 relative">
          <div className="relative mx-4 h-10" aria-hidden="true">
            <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-slate-200" />
            <div
              className="absolute left-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-emerald-500 transition-all duration-500 ease-out"
              style={{ width: `${progressPercentage}%` }}
            />
            {/* Kept inside the rail at both ends (Riipen Labs, Group 17:
                "errors in the icon (rabbit being cut off)"): centred on the
                point, but never closer than half its width to an edge. */}
            <span
              className="absolute top-1/2 text-2xl leading-none transition-all duration-500 ease-out"
              style={{ left: `clamp(0.875rem, ${progressPercentage}%, calc(100% - 0.875rem))`, transform: 'translate(-50%, -70%)' }}
            >
              🐰
            </span>
          </div>

          {/* Step Labels Below Path */}
          <div className="grid grid-cols-2 gap-4 mt-2 px-2">
            {steps.map((step, idx) => {
              const Icon = step.icon
              const isActive = idx === currentStep
              const isCompleted = canProceed(idx)
              return (
                <button
                  type="button"
                  key={step.id}
                  onClick={() => setCurrentStep(idx)}
                  disabled={isSubmitting || (idx !== 0 && !canAccessOnboarding)}
                  aria-current={isActive ? 'step' : undefined}
                  aria-label={`${step.title}${isCompleted ? ', complete' : ''}`}
                  className="flex min-h-[60px] flex-col items-center flex-1"
                >
                  <div
                    className={`w-8 h-8 md:w-10 md:h-10 shrink-0 rounded-full flex items-center justify-center transition-all z-10 shadow-lg ${
                      isActive
                        ? 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 scale-125 ring-4 ring-cyan-300'
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
                  {/* mt-3 clears the active circle, which is scale-125 and
                      grows downward into whatever sits directly beneath it. */}
                  <span className={`text-xs leading-tight mt-3 text-center w-full max-w-[76px] ${isActive ? 'text-slate-900 font-bold' : isCompleted ? 'text-green-800 font-medium' : 'text-slate-700'}`}>
                    {step.short}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Step Content Card */}
        <div ref={stepCardRef} className="scroll-mt-4 rounded-2xl p-5 md:p-8 surface">
          {resumedStep === currentStep && (
            <p role="status" className="mb-5 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-slate-800">
              Welcome back. Your answers were saved, so you are where you left off.
            </p>
          )}
          {missingSections.length > 0 && (
            <div role="alert" className="mb-6 rounded-lg border border-amber-400 bg-amber-50 p-4">
              <p className="font-semibold">Complete these required sections:</p>
              <ul className="mt-2 space-y-2">
                {missingSections.filter(index => !canProceed(index)).map(index => (
                  <li key={index}><button type="button" onClick={() => setCurrentStep(canAccessOnboarding ? index : 0)} className="underline">{steps[index].title}</button></li>
                ))}
              </ul>
            </div>
          )}

          {/* Skip, on every step (Riipen Labs, Group 33: "Allow users to bypass
              initial setup prompts with a single tap"; Group 29: a "Skip /
              Fast-Track" option on step 1; Group 24: "a visible, permanent
              'Skip to Resources' link on all intake screens"). Straight to
              resources (the starter kits for parents, or Start here's for
              everyone else), or into the app; the Path offers to make a plan
              later. Pronouns and a username were offered here once; they are
              on the "Complete your profile" card (Groups 25 to 30). */}
          {/* One line and two buttons side by side: it was a box of three
              lines and two stacked buttons, a fifth of a phone screen above
              the first question on every step (Riipen Labs, Group 13: "the
              user has to scroll past these elements each time"). */}
          {!user?.hasCompletedOnboarding && (
            <div className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-2">
              <p className="w-full text-sm text-slate-800 sm:w-auto sm:mr-1">Not ready for questions?</p>
              <button
                type="button"
                onClick={() => skipForNow('resources', resourcesHref())}
                disabled={!canAccessOnboarding || skipping}
                className="inline-flex min-h-[2.75rem] items-center rounded-lg border-2 border-indigo-700 bg-white px-3 text-sm font-semibold text-indigo-900 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Skip to resources
              </button>
              <button
                type="button"
                onClick={() => skipForNow('path', '/path')}
                disabled={!canAccessOnboarding || skipping}
                className="inline-flex min-h-[2.75rem] items-center rounded-lg border-2 border-slate-700 bg-white px-3 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {skipping ? 'Opening…' : 'Skip setup for now'}
              </button>
              {!canAccessOnboarding && !isManagedAccount && (
                <p className="w-full text-xs text-slate-700">Confirm your age below first.</p>
              )}
              {skipError && <p role="alert" className="w-full text-sm text-red-800">{skipError}</p>}
            </div>
          )}

          {chatMode && (
            <ChatSetup
              name={(user?.name || '').split(' ')[0]}
              audiences={AUDIENCES}
              audienceValue={AUDIENCE_VALUE}
              categories={goalCategories}
              ideasFor={ideasFor}
              helperIdeas={helperIdeas}
              onAge={(value) => setFormData(prev => ({ ...prev, ageConfirmation: value }))}
              ageKnown={ageFromSignup}
              onAudience={chooseAudience}
              onGoal={addGoal}
              onUndoGoal={removeGoal}
              onCreate={handleSubmit}
              onForm={() => setChatMode(false)}
              isSubmitting={isSubmitting}
            />
          )}

          {/* Required questions carry a red asterisk, said in words too
              (Riipen Labs, Group 26: "red indicators for required fields";
              WCAG 1.4.1, not by colour alone). */}
          {!chatMode && (
            <p className="mb-4 text-sm text-slate-700">
              <RequiredMark /> Required. Everything else is optional.
            </p>
          )}

          {/* About you: the short goal-first start. Age comes from sign-up;
              who this is for is one tap; what they came for is optional. */}
          {currentId === 'about' && !chatMode && (
            <div>
              {/* One heading and one short note before the first question
                  (Riipen Labs, Group 33: "reduce text density", "remove
                  redundant setup text"). The warm voice (Group 6;
                  docs/voice.md) is in the welcome above and in "There are no
                  wrong answers". */}
              <h2 id="step-heading-about" tabIndex={-1} className="text-2xl font-bold mb-3 text-slate-800 focus:outline-none">About you</h2>

              {/* A note, not a box: tinted and bordered it looked like the chosen
                  answers below (Group 33: "clickable options blending into
                  static text"). */}
              <p className="mb-5 border-l-4 border-indigo-400 pl-4 text-sm text-slate-800">
                There are no wrong answers. We don&apos;t sell your information, show ads, or use it to train AI.
              </p>

              {/* Age: sign-up already asked for the date of birth, so it is not
                  asked twice (Riipen Labs, Groups 25 to 30: fewer questions
                  before the app). Asked here only when it is not known. */}
              {ageFromSignup ? (
                <p className="mb-5 flex items-center gap-2 text-sm text-slate-800" role="status">
                  <Check className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                  Age: 18 or older, from the date of birth you gave when you signed up.
                </p>
              ) : (
                <label className="block mb-5 font-medium">
                  Confirm your age <RequiredMark />
                  <span className="mt-0.5 block text-sm font-normal text-slate-700">Why we ask: {WHY_WE_ASK.age}</span>
                  <select
                    value={formData.ageConfirmation}
                    onChange={event => setFormData(previous => ({ ...previous, ageConfirmation: event.target.value as '' | 'adult' | 'under18' }))}
                    className="mt-2 block w-full rounded-lg border border-slate-300 p-3"
                    aria-required="true"
                  >
                    <option value="">Select your age group</option>
                    <option value="adult">I am 18 or older</option>
                    <option value="under18">I am under 18</option>
                  </select>
                </label>
              )}
              {guardianApproved && <p role="status" className="mb-4 text-sm text-emerald-700">Your legal adult has approved this supervised account.</p>}
              {!guardianApproved && (formData.ageConfirmation === 'under18' || isManagedAccount) && (
                <p role="alert" className="mb-6 rounded-lg border border-amber-400 bg-amber-50 p-4">Sorry, Autinerary is only for people 18 or older right now. A parent or legal guardian can add you from their own account, on their Family page.</p>
              )}

              {/* The energy check-in (ENERGY_CHOICES; Riipen Labs, Group 23). */}
              <fieldset className="mb-6">
                <legend className="mb-1 font-medium text-slate-900">
                  How much energy do you have for this today? <span className="font-normal text-slate-700">(optional)</span>
                </legend>
                <p className="mb-2 text-sm text-slate-700">Why we ask: {WHY_WE_ASK.energy}</p>
                <div className="flex flex-wrap gap-2">
                  {ENERGY_CHOICES.map((e) => {
                    const on = formData.setupEnergy === e.id
                    return (
                      <button
                        key={e.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => chooseEnergy(e.id)}
                        className={`rounded-full border-2 px-3 py-1.5 text-sm font-medium shadow-sm transition-colors ${
                          on ? 'border-indigo-700 bg-indigo-50 text-indigo-900' : 'border-slate-400 bg-white text-slate-800 hover:border-indigo-500 hover:bg-indigo-50/40'
                        }`}
                      >
                        {on && <Check className="mr-1 inline h-4 w-4" aria-hidden="true" />}
                        {e.label}{e.hint ? `: ${e.hint}` : ''}
                      </button>
                    )
                  })}
                </div>
                {formData.setupEnergy && <p role="status" className="mt-2 text-sm text-slate-800">{ENERGY_NOTE[formData.setupEnergy]}</p>}
              </fieldset>

              <fieldset className="mb-6" disabled={!canAccessOnboarding}>
                <legend className="mb-1 font-medium text-slate-900">Who are you here for? <RequiredMark /></legend>
                {/* Why it is asked, and that it can be changed (Riipen Labs,
                    Group 32: "assurance that their selected role will tailor
                    the content visible to them"; Group 28: "each question
                    carries a visible reason for being asked"). */}
                <p className="mb-2 text-sm text-slate-700">Why we ask: {AUDIENCE_EFFECT}</p>
                {(() => {
                  const audienceButton = (a: typeof AUDIENCES[number]) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => chooseAudience(a.id)}
                      aria-pressed={formData.audience === a.id}
                      className={`rounded-lg border-2 px-4 py-3 text-left text-sm font-medium shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                        formData.audience === a.id
                          ? 'border-indigo-700 bg-indigo-50 text-indigo-900'
                          : 'border-slate-400 bg-white text-slate-800 hover:border-indigo-500 hover:bg-indigo-50/40'
                      }`}
                    >
                      {formData.audience === a.id && <Check className="mr-1 inline h-4 w-4" aria-hidden="true" />}
                      {a.label}
                      {a.hint && <span className="mt-0.5 block text-xs font-normal text-slate-700">{a.hint}</span>}
                    </button>
                  )
                  return (
                    <div className="space-y-3">
                      {AUDIENCE_GROUPS.map((g, i) => (
                        <div key={g.label} role="group" aria-labelledby={`audience-group-${i}`}>
                          <p id={`audience-group-${i}`} className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">{g.label}</p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {AUDIENCES.filter((a) => g.ids.includes(a.id)).map(audienceButton)}
                          </div>
                        </div>
                      ))}
                      <div className="grid gap-2 sm:grid-cols-2">
                        {AUDIENCES.filter((a) => !AUDIENCE_GROUPS.some((g) => g.ids.includes(a.id))).map(audienceButton)}
                      </div>
                    </div>
                  )
                })()}
                {/* Riipen Labs, Group 15: role choices can feel "binary, or ...
                    exclusionary"; many people are both neurodivergent and
                    supporting someone. A plan has one goal, so one answer for
                    it, and another plan can be for the other. */}
                <p className="mt-2 text-sm text-slate-700">
                  More than one fits? Pick who this first plan is for. You can make another plan for the other later, and change this in Settings.
                </p>
                {AUDIENCE_VALUE[formData.audience] && (
                  <p role="status" className="mt-3 rounded-lg bg-indigo-50 px-4 py-3 text-sm text-indigo-950">
                    <Check className="mr-1 inline h-4 w-4 text-emerald-700" aria-hidden="true" />
                    {AUDIENCE_VALUE[formData.audience]}
                  </p>
                )}
              </fieldset>

              <fieldset disabled={!canAccessOnboarding}>
                <legend className="mb-1 font-medium text-slate-900">
                  What are you looking for today? <span className="font-normal text-slate-700">(optional, pick any)</span>
                </legend>
                <p className="mb-2 text-sm text-slate-700">Why we ask: {WHY_WE_ASK.lookingFor}</p>
                <div className="flex flex-wrap gap-2">
                  {[...LOOKING_FOR, ...(KIT_AUDIENCES.has(formData.audience) ? LOOKING_FOR_CARE : []), LOOKING_FOR_URGENT].map((o) => {
                    const on = formData.lookingFor.includes(o.id)
                    return (
                      <button
                        key={o.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          lookingFor: on ? prev.lookingFor.filter(x => x !== o.id) : [...prev.lookingFor, o.id],
                        }))}
                        className={`rounded-full border-2 px-3 py-1.5 text-sm font-medium shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                          on ? 'border-indigo-700 bg-indigo-50 text-indigo-900' : 'border-slate-400 bg-white text-slate-800 hover:border-indigo-500 hover:bg-indigo-50/40'
                        }`}
                      >
                        {on && <Check className="mr-1 inline h-4 w-4" aria-hidden="true" />}
                        {o.label}
                      </button>
                    )
                  })}
                </div>
                {/* Who to call, at once (Group 24's "Crisis Support"). Setup
                    can carry on underneath, or wait. */}
                {formData.lookingFor.includes('urgent') && (
                  <div className="mt-3">
                    <CrisisLines ontario={KIT_AUDIENCES.has(formData.audience)} headingLevel={3} />
                    <p className="mt-2 text-sm text-slate-800">You can carry on with setup whenever you are ready, or come back to it later.</p>
                  </div>
                )}
              </fieldset>

              <p className="mt-4 text-sm">
                <button type="button" onClick={() => setChatMode(true)} className="font-medium text-indigo-800 underline underline-offset-2 hover:text-indigo-950">
                  Prefer to answer by chatting? Try the chat version
                </button>
              </p>
            </div>
          )}

          {/* Step 3: Goals, Dreams & Obstacles (combined) */}
          {currentId === 'goalsAndDreams' && !chatMode && (() => {
            // Detect connections to another person (sibling, parent, etc.) so we
            // can offer an "ideal relationship" option alongside the dream — the
            // user answers whichever speaks to them (one optional out of two).
            const otherConnectionIds = Object.keys(formData.barrierConnections).filter(id => id !== 'self')
            const hasOtherPerson = otherConnectionIds.length > 0
            const otherPersonLabel = otherConnectionIds.length === 1
              ? OTHER_PERSON[otherConnectionIds[0]] || 'them'
              : 'them'
            const startArea = goalCategories.find(c => c.id === firstArea.id) || goalCategories[0]
            return (
            <div>
              {/* A small "done" for the first step (Riipen Labs, Group 29:
                  "mini-rewards so account creation feels small and doable"). */}
              {canProceed(stepIndex('about')) && (
                <p role="status" className="mb-4 flex items-center gap-2 text-sm font-medium text-emerald-800">
                  <Check className="h-4 w-4 shrink-0" aria-hidden="true" /> About you is done. This is the last question.
                </p>
              )}
              <h2 id="step-heading-goalsAndDreams" tabIndex={-1} className="text-2xl font-bold mb-2 text-slate-800 focus:outline-none">Your goal <RequiredMark /></h2>
              <p className="text-slate-700 mb-2">{goalIntro}</p>
              <p className="mb-6 text-sm text-slate-700">
                Why we ask: {WHY_WE_ASK.goal}{' '}
                {/* Riipen Labs, Group 19: "terms like 'milestone' and 'path'
                    are not clearly defined"; Group 16: the screen before the
                    plan "does not explain what a path even does". */}
                <Define term="path" ask />
              </p>

              {/* One life area first (Riipen Labs, Group 20: "Start with one,
                  and reveal the others after a first step"): the area that
                  fits the answers, with the others one tap away. */}
              {!allAreasShown && (
                <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <p className="text-sm text-slate-800">
                    Starting with <strong>{startArea.label}</strong>
                    {firstArea.fromAnswers ? ', from your answers.' : ', the area people pick most often.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowAllAreas(true)}
                    className="rounded-lg border-2 border-slate-400 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:border-indigo-500 hover:bg-indigo-50/40"
                  >
                    Choose a different area
                  </button>
                </div>
              )}

              {/* Category tabs: pick one, and only that one opens (Riipen Labs,
                  Group 9: all six used to show at once, each with its own
                  ideas and fields, on a step everyone has to complete). */}
              {allAreasShown && <div className="flex flex-wrap gap-2 mb-6">
                {goalCategories.map((cat) => {
                  const count = (formData.goalsByCategory[cat.id] || []).filter(e => e.goal.trim()).length
                  const isOpen = openGoalCategory === cat.id
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      aria-pressed={isOpen}
                      onClick={() => {
                        setOpenGoalCategory(cat.id)
                        // Its goal field is ready to type in.
                        setFormData(prev => (prev.goalsByCategory[cat.id] || []).length > 0 ? prev : {
                          ...prev,
                          goalsByCategory: { ...prev.goalsByCategory, [cat.id]: [{ goal: '', dreams: '', obstacles: '' }] },
                        })
                        setTimeout(() => document.getElementById(`goal-cat-${cat.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50)
                      }}
                      // Drawn like setup's other answers, with a firm border and a
                      // shadow: with a pale border on white they read as labels
                      // (Riipen Labs, Group 33: "clickable options blending into
                      // static text").
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full border-2 text-sm font-medium shadow-sm transition-all ${
                        isOpen
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : count > 0
                            ? 'bg-cyan-50 text-cyan-900 border-cyan-600'
                            : 'bg-white border-slate-400 text-slate-800 hover:border-indigo-500 hover:bg-indigo-50/40'
                      }`}
                    >
                      {cat.label}
                      {count > 0 && <span className="bg-cyan-700 text-white text-xs px-1.5 py-0.5 rounded-full">{count}</span>}
                    </button>
                  )
                })}
              </div>}

              {/* Category sections: the one picked, the chosen path's focus, and
                  any that already hold a goal. */}
              {!openGoalCategory && !pathSeed && !goalCategories.some(c => (formData.goalsByCategory[c.id] || []).some(e => e.goal.trim())) && (
                <p className="mb-6 text-sm text-slate-600">Pick a category above to add your goal.</p>
              )}
              <div className="space-y-6">
                {goalCategories.map((cat) => {
                  const entries = formData.goalsByCategory[cat.id] || []
                  const shown = openGoalCategory === cat.id
                    || entries.some(e => e.goal.trim())
                    || (!openGoalCategory && pathSeed?.focusCategory === cat.id)
                  if (!shown) return null
                  return (
                    <div key={cat.id} id={`goal-cat-${cat.id}`} className="bg-white border border-slate-200 rounded-xl p-4">
                      <h3 className="font-medium text-slate-800 mb-3 flex items-center gap-2">
                        {cat.label}
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
                            <p className="text-xs text-cyan-800 mb-2 flex items-center gap-1">
                              <Lightbulb className="w-3.5 h-3.5 text-cyan-700" aria-hidden="true" />
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
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-cyan-50 text-cyan-800 border border-cyan-200 hover:bg-cyan-100 transition-all"
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
                            {/* Pick instead of typing (Riipen Labs, Groups 27 and
                                30: fewer open-ended questions). */}
                            <p className="text-xs text-slate-700 mb-2 flex items-center gap-1">
                              <Lightbulb className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
                              Goal ideas: pick one, or type your own below
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
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-all"
                                >
                                  + {sug}
                                </button>
                              ))}
                            </div>
                          </div>
                        )
                      })()}

                      {/* Predictive text: typing offers this area's ideas
                          (Riipen Labs, Group 26: "autofill, autocomplete, or
                          predictive text to reduce the amount of typing"). */}
                      <datalist id={`goal-ideas-${cat.id}`}>
                        {ideasFor(cat.id).map((idea) => <option key={idea} value={idea} />)}
                      </datalist>
                      {entries.map((entry, idx) => {
                        const detailsKey = `${cat.id}:${idx}`
                        const detailsOpen = openGoalDetails[detailsKey] || Boolean(entry.dreams?.trim() || entry.selfDream?.trim() || entry.idealRelationship?.trim() || entry.obstacles?.trim())
                        return (
                        <div key={idx} className="mb-4 bg-slate-50 rounded-lg p-3 border border-slate-100">
                          <div className="flex gap-2 mb-2">
                            <input
                              type="text"
                              list={`goal-ideas-${cat.id}`}
                              autoComplete="off"
                              aria-label={`${cat.label} goal${entries.length > 1 ? ` ${idx + 1}` : ''}`}
                              aria-required="true"
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
                              className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
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
                              aria-label="Remove this goal"
                              className="px-2 text-slate-600 hover:text-red-700 text-sm"
                            >
                              <span aria-hidden="true">×</span>
                            </button>
                          </div>

                          {/* A dream, a relationship and an obstacle for the goal:
                              optional, open-ended, and folded away until asked
                              for (Riipen Labs, Group 30: "open-ended questions,
                              such as goals, dreams, and obstacles, may be
                              difficult to answer immediately"). */}
                          {!detailsOpen && (
                            <button
                              type="button"
                              onClick={() => setOpenGoalDetails(prev => ({ ...prev, [detailsKey]: true }))}
                              className="ml-4 rounded-lg border-2 border-dashed border-slate-400 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:border-indigo-500 hover:bg-indigo-50/40"
                            >
                              + Add more about this goal (optional)
                            </button>
                          )}
                          {detailsOpen && (<>
                          {/* Per-goal dream */}
                          {(() => {
                            // Plain questions (Riipen Labs, Group 17 found "dream
                            // for the other person" unclear). The answers are
                            // stored as before.
                            const forThem = `What do you hope this leads to for ${otherPersonLabel}?`
                            const forYou = 'What do you hope this leads to for you?'
                            const fields: Array<{ key: 'dreams' | 'selfDream'; label: string }> = [{ key: 'dreams', label: hasOtherPerson ? forThem : forYou }]
                            if (hasOtherPerson && formData.barrierConnections.self?.length) {
                              const selfField = { key: 'selfDream' as const, label: forYou }
                              if (formData.barrierConnections.parent !== undefined) fields.push(selfField)
                              else fields.unshift(selfField)
                            }
                            return fields.map(field => (
                              <label key={field.key} className="ml-4 mb-2 block text-xs font-medium text-purple-600">
                                {field.label} (optional)
                                <input value={entry[field.key] || ''} onChange={event => setFormData(previous => ({ ...previous, goalsByCategory: { ...previous.goalsByCategory, [cat.id]: previous.goalsByCategory[cat.id].map((goal, index) => index === idx ? { ...goal, [field.key]: event.target.value } : goal) } }))} placeholder="For example: more confidence, or a job they enjoy" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700" />
                              </label>
                            ))
                          })()}

                          {/* Ideal relationship — second option when the goal
                              involves another person (e.g. a sibling). Both this
                              and the dream are optional; answer whichever fits. */}
                          {hasOtherPerson && (
                            <div className="ml-4 mb-1">
                              {/* Group 17 found "ideal relationship with ally" unclear. */}
                              <label className="text-xs text-indigo-800 font-medium">
                                How would you like things to be between you and {otherPersonLabel}? <span className="text-slate-600">(optional)</span>
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
                                placeholder="For example: calmer mornings together"
                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 mt-1"
                              />
                            </div>
                          )}

                          {/* Per-goal obstacle */}
                          <div className="ml-4">
                            <label className="text-xs text-pink-700 font-medium">What might get in the way? <span className="text-slate-600">(optional)</span></label>
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
                              placeholder="For example: mornings are rushed"
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-pink-400 focus:border-pink-400 mt-1"
                            />
                          </div>
                          </>)}
                        </div>
                        )
                      })}
                      
                      <button
                        onClick={() => {
                          setFormData(prev => {
                            const updated = { ...prev.goalsByCategory }
                            updated[cat.id] = [...(updated[cat.id] || []), { goal: '', dreams: '', obstacles: '' }]
                            return { ...prev, goalsByCategory: updated }
                          })
                        }}
                        type="button"
                        className="rounded-xl border-2 border-dashed border-cyan-600 bg-white px-4 py-2.5 text-sm font-semibold text-cyan-900 hover:bg-cyan-50"
                      >
                        + Add a {cat.label.toLowerCase()} goal
                      </button>
                    </div>
                  )
                })}
              </div>

              {/* Optional AI help for the hardest question in setup (Riipen
                  Labs, Group 11): one line until asked for. After the ideas
                  and the goal field, not before them, so they are higher on a
                  phone (Group 13); step 1 ends with its chat version the same way. */}
              <div className="mt-6">
                <GoalHelper
                  ideas={helperIdeas}
                  categoryLabel={(id) => goalCategories.find(c => c.id === id)?.label || 'Other'}
                  audience={formData.audience}
                  onAdd={addGoal}
                />
              </div>

              {/* "Beyond all your goals, what's your biggest dream?" was here.
                  Riipen Labs, Group 17: it "front loads personal questions ...
                  before trust is established". It is on the Ideal Self page
                  now (preferences.biggestDream), and a new plan still uses
                  it. */}
            </div>
            )
          })()}

          {/* Navigation Buttons (the chat has its own). One filled button, the
              next step, named for where it goes; every other action is an
              outlined button, never underlined text (Riipen Labs, Group 33:
              "Fix Visual Button Hierarchies", "clearly separate interactive
              buttons from static text content"; the Government of Canada's
              guidance for autistic users: "make buttons descriptive"). */}
          <div className="flex flex-wrap justify-between items-center gap-3 mt-8 pt-6 border-t border-slate-200">
            {!chatMode && (<>
            {/* Not there on the first step (it was hidden but kept its space,
                which left a gap above the next button on a phone). */}
            {currentStep > 0 && (
              <button
                type="button"
                onClick={handleBack}
                className={SECONDARY_BUTTON}
              >
                <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                Back
              </button>
            )}

            <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
              {currentStep === steps.length - 1 ? (
                <button
                  onClick={handleSubmit}
                  disabled={!requiredDone || isSubmitting}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 hover:from-purple-600 hover:to-pink-600 disabled:bg-slate-200 disabled:hover:bg-slate-200 disabled:text-slate-700 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-xl transition-all"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Creating your path...
                    </>
                  ) : (
                    <>
                      Create my path
                      <Rocket className="w-5 h-5" />
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  disabled={!canProceed()}
                  aria-describedby={continueHint() ? 'continue-hint' : undefined}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 hover:from-cyan-600 hover:to-blue-600 disabled:bg-slate-200 disabled:hover:bg-slate-200 disabled:text-slate-700 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-xl transition-all"
                >
                  {currentStep === 0 ? 'Continue to your goal' : `Next: ${steps[currentStep + 1].title}`}
                  <ChevronRight className="w-5 h-5" aria-hidden="true" />
                </button>
              )}
            </div>

            {continueHint() && (
              <p id="continue-hint" className="mt-3 w-full text-right text-sm text-slate-700" role="status">
                {continueHint()}
              </p>
            )}
            {/* What comes after the button (Riipen Labs, Group 26: "a preview
                of what the next step involves"). */}
            {!isSubmitting && NEXT_PREVIEW[currentId] && (
              <p className="w-full text-right text-sm text-slate-700">
                {(currentId === 'goalsAndDreams' && NEXT_PREVIEW_BY_ENERGY[formData.setupEnergy]) || NEXT_PREVIEW[currentId]}
              </p>
            )}

            </>)}

            {/* Honest waiting state. No progress bar — we cannot see inside the
                pipeline, and a bar that stalls at 80% is worse than a clock. */}
            {isSubmitting && (
              <div className="mt-4 text-center" role="status" aria-live="polite">
                <p className="text-sm font-medium text-slate-700">{displayStage}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {elapsed}s elapsed · usually about a minute, longer if others are starting at the same time
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  Please keep this tab open. Refreshing starts it over.
                </p>
              </div>
            )}
            {/* Shown in the form and in the chat version alike. */}
            {submitError && !isSubmitting && (
              <div role="alert" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-slate-800">
                <p>{submitError}</p>
                <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <button type="button" onClick={handleSubmit} className="font-semibold text-indigo-800 underline underline-offset-2 hover:text-indigo-950">
                    Try again
                  </button>
                  <span>If it keeps happening, email aayush@autinerary.ca.</span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Step indicator for mobile */}
        <div className="text-center mt-4 text-slate-700 text-sm">
          Step {currentStep + 1} of {steps.length}
        </div>

        {/* Need a break? (Riipen Labs, Group 11: "Your progress is saved ...
            Send an email reminder if the user shared an email.") The draft is
            kept in this browser (AUTOSAVE_KEY). Reminders are sent only when
            asked for here: up to three, each with finish now, remind me later
            or stop (Groups 20 and 24; lib/setupReminders.ts, sent by the
            hourly run, app/api/cron/reminders). */}
        {!isSubmitting && (
          <div className="mt-2 text-center text-sm text-slate-700">
            <p>Need a break? Your answers are saved on this device, so you can close this page and finish later.</p>
            {/* Not for someone making another path: setup counts as done for
                them, so the reminder would never be sent. */}
            {user?.email && !user.hasCompletedOnboarding && canAccessOnboarding && setupReminder === 'none' && (
              <button
                type="button"
                onClick={requestSetupReminder}
                className="mt-1 font-medium text-indigo-800 underline underline-offset-2 hover:text-indigo-950"
              >
                Email me reminders to finish
              </button>
            )}
            {setupReminder === 'asked' && (
              <p role="status" className="mt-1">
                We&apos;ll email {user?.email} at most three times: later today, in 3 days and in a week, and stop
                once setup is done. Each email lets you finish, wait longer or stop.{' '}
                <button type="button" onClick={cancelSetupReminder} className="font-medium text-indigo-800 underline underline-offset-2 hover:text-indigo-950">
                  Don&apos;t send them
                </button>
              </p>
            )}
            {setupReminder === 'failed' && (
              <p role="status" className="mt-1">The reminder could not be set up just now. Please try again later.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
