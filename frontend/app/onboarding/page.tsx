'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'
import { 
  User, Check, ChevronRight, ChevronLeft, ChevronDown, Loader2,
  Target, Sparkles, Heart, Zap, AlertCircle, Palette, Rocket
} from 'lucide-react'
import {
  AGE_RANGES, TECH_SAVVY, VIEW_PREFERENCES, DEFAULT_REMINDERS,
  savePreferences, type ReminderPreferences,
} from '@/lib/preferences'
import { isSimpleView } from '@/lib/disclosure'
import { buildAvatarSvg, HAIR_GROUPS, HAIR_OPTIONS, ACCESSORIES, FACIAL_HAIR, CLOTHING,
  HAIR_COLORS, SKIN_TONES, DEFAULT_HAIR_COLOR, DEFAULT_SKIN_TONE, DEFAULT_CLOTHING } from '@/lib/avatar'
import UserAvatar from '@/app/components/UserAvatar'
import AppearanceEditor, { type Appearance } from '@/app/components/AvatarEditor'
import { playPageTurnSound } from '@/lib/taskSound'
import { toLlmConfig } from '@/lib/modelPrefs'
import { createClient } from '@/lib/supabase/client'
import { track } from '@/lib/funnel'
import { wakeBackend } from '@/lib/wakeBackend'
import { START_FOR_KEY, START_NEED_KEY, START_GOALS, isStartGoal, isStartRole, suggestedStart } from '@/lib/startHere'
import DiagnosticProfileSection from './DiagnosticProfileSection'
import GoalHelper from '@/app/components/GoalHelper'
import ReminderFields from '@/app/components/ReminderFields'
import ChatSetup from '@/app/components/ChatSetup'
import { browserTimeZone } from '@/lib/reminderSchedule'
import {
  CONDITION_GROUPS,
  EMPTY_DIAGNOSTIC_PROFILE,
  toRecommendationSupportContext,
  type DiagnosticProfile,
} from '@/lib/diagnostic-profile'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
// Character avatar options — spirit animal selection is done later in the Spirit Animals step
const characterTypes = [
  { id: 'avatar', label: 'Create Your Avatar', description: 'Design a character that looks like you', icon: '👤' },
]

// The hair vocabulary lives in lib/avatar.ts now — all 34 avataaars options
// grouped for browsing, rather than the 7 this file used to hard-code.
// Legacy ids from profiles saved before that still render, via HAIR_TOP.

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

const animalHue: Record<string, number> = { pink: 290, blue: 170, purple: 230, green: 70, orange: 0, gold: 20, teal: 120, red: 330 }

// Spirit animal modes (Odosa): how many animals the user assigns.
const spiritAnimalModes = [
  { id: 'general', label: 'One spirit animal', desc: 'A single guide for every day.', count: 1, emoji: '🐾' },
  { id: 'fastSlow', label: 'Fast & slow day', desc: 'Two guides: one for busier schedules, one for lighter schedules.', count: 2, emoji: '⚡' },
  { id: 'weekly', label: 'One per weekday', desc: 'Seven guides: a different animal for each day of the week.', count: 7, emoji: '📅' },
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
// `short` is what the progress rail shows. Up to seven labels share one row,
// so "Character Select" and "AI Recommendations" wrapped to three lines each,
// pushed their neighbours out of line and collided with the circle above.
// `title` stays the full name and remains the accessible label.
//
// Goal-first order (Riipen Labs, Group 2): "sort the questions into need now
// and ask later", then an optional condition question. Group 5 then asked to
// "reduce initial sign-up to 3 core steps (account setup, primary role,
// immediate goal)" and to ask about conditions and sensory needs later. So
// the first CORE_STEP_COUNT steps (after the account) are the whole start,
// and the path is created at the end of them. Norms are the first optional
// extra; if nothing about the person was shared, the Path asks about sensory
// needs and conditions in the second week (app/components/AskLaterCard.tsx).
// The AI recommendations step was dropped from setup (Group 5: keep the AI
// "running behind the scenes until basic onboarding is fully completed");
// Start here's resources follow setup instead.
const steps = [
  { id: 'about', title: 'About you', short: 'About you', icon: User },
  { id: 'goalsAndDreams', title: 'Your goal', short: 'Goal', icon: Target },
  { id: 'barrierConnections', title: 'Your Norms', short: 'Norms', icon: AlertCircle },
  { id: 'location', title: 'Location', short: 'Location', icon: User },
  { id: 'motivation', title: 'Motivation Style', short: 'Motivation', icon: Zap },
  { id: 'character', title: 'Character', short: 'Character', icon: User },
  { id: 'profile', title: 'Dream Self', short: 'Dream Self', icon: Palette },
  { id: 'spiritAnimal', title: 'Spirit Animals', short: 'Animals', icon: Heart },
  { id: 'personalize', title: 'Personalize', short: 'Personalize', icon: Palette },
]
const CORE_STEP_COUNT = 2
const stepIndex = (id: string) => steps.findIndex((s) => s.id === id)
// Only these must be answered (age is confirmed inside 'about').
const REQUIRED_STEP_IDS = new Set(['about', 'goalsAndDreams'])
// Drafts saved before the reorder stored a position in this order; position 0
// held the age question, which now lives in 'about'.
const LEGACY_STEP_ORDER = ['about', 'barrierConnections', 'location', 'goalsAndDreams', 'motivation', 'profile', 'spiritAnimal', 'personalize', 'recommendations']

// "Who are you here for?" `connection` is the Norms step connection type it
// pre-selects; null where the right one is ambiguous (the person picks it).
const AUDIENCES: { id: string; label: string; connection: string | null }[] = [
  { id: 'self', label: 'Myself', connection: 'self' },
  { id: 'child', label: 'My child', connection: 'parent' },
  { id: 'family', label: 'Another family member', connection: null },
  { id: 'friend', label: 'A friend', connection: 'friend' },
  { id: 'work', label: 'Someone I teach, support or work with', connection: null },
  { id: 'ally', label: "I'm an ally, or just learning", connection: 'ally' },
  // Riipen Labs, Group 4: "Include 'not sure' to avoid blocking progress".
  // Setup then reads as if for themselves, the default.
  { id: 'unsure', label: 'Not sure yet', connection: null },
]

// What Autinerary does for each of them, shown once they choose (Riipen Labs,
// Group 5: "make the value of Autinerary clearer for each user group during
// onboarding"). Matches what "Start here" says for the same answer.
const AUDIENCE_VALUE: Record<string, string> = {
  self: 'You\u2019ll turn your goal into small, clear steps planned around your energy, and find services rated by people with similar norms.',
  child: 'You\u2019ll plan a goal you are working on together in small, clear steps, and find services and places for families. If your child is under 18, you can add them from the Family page.',
  family: 'You\u2019ll plan a goal you are helping with in small, clear steps, and find services and ideas that fit how they work.',
  friend: 'You\u2019ll plan a goal you are helping with in small, clear steps, and find services and ideas that fit how they work.',
  work: 'You\u2019ll plan a goal you are helping with in small, clear steps, and find tools and services to recommend.',
  ally: 'You\u2019ll learn from questions and answers in Tidbits, browse services, and can start a plan of your own.',
  unsure: 'That\u2019s fine. You\u2019ll get one goal turned into small, clear steps, and can explore the rest whenever you like.',
}

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

// Steps the user is allowed to skip without filling anything in. Only the
// core steps (age, norms, goals) stay required. Location joined the
// optional set after Riipen Labs' review ("reduce mandatory questions"):
// its own copy already called it optional while the form required it.
const skippableSteps = new Set(['barrierConnections', 'location', 'motivation', 'character', 'profile', 'spiritAnimal', 'personalize'])

// One line per step on what the answer is used for, so people can see how
// setup connects to the plan they get (Riipen: "show how key features
// connect"). Each line was checked against where the app reads it.
const STEP_PURPOSE: Record<string, string> = {
  about: 'The wording of the next questions, and what you see first once your path is ready.',
  character: 'Your avatar in Dream Land.',
  barrierConnections: 'The tools and services suggested for each milestone, and matching you with people who share similar norms. Optional: skipped, it counts as “Prefer not to share”.',
  location: 'Showing services near you in ResourceHub. Skip it and everything else still works.',
  goalsAndDreams: 'Your races. Each goal becomes a race with its own milestones.',
  motivation: 'Matching you with people who are motivated in similar ways.',
  profile: 'Your Ideal Self page: a picture of who you are working toward.',
  spiritAnimal: 'The guides shown on your Path.',
  personalize: 'How the app looks and how much it shows at once. You can change this later in Settings.',
}

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

const connectionTypes = [
  { id: 'self', label: 'Self (Lived Experience)', icon: '👤' },
  { id: 'parent', label: 'Parent', icon: '👨‍👩‍👧‍👦' },
  { id: 'sibling', label: 'Sibling', icon: '👫' },
  // 'partner' and 'coworker' already mapped to a trust tier in
  // relationship.ts (direct_support / indirect_support respectively) but
  // were never offered as options here, so no one could actually select
  // them. 'friend' had no tier at all — added as indirect_support, the same
  // proximity as a coworker: closer than an ally, not daily-life-sharing.
  { id: 'partner', label: 'Partner', icon: '💞' },
  { id: 'coworker', label: 'Coworker', icon: '🧑‍🤝‍🧑' },
  { id: 'friend', label: 'Friend', icon: '🙋' },
  { id: 'educator', label: 'Educator', icon: '📚' },
  { id: 'employer', label: 'Employer', icon: '💼' },
  { id: 'therapist', label: 'Therapist', icon: '🧠' },
  { id: 'researcher', label: 'Researcher', icon: '🔬' },
  { id: 'ally', label: 'Ally', icon: '🤝' },
  { id: 'medical', label: 'Medical Professional (coming soon)', icon: '🏥', disabled: true },
]

// Autinerary is 18+ for now (Odosa), so the stages nobody over 18 can be in
// are gone: Preschool, Elementary and Middle School. High School stays
// because final-year students are commonly 18.
//
// People are also routinely in more than one of these at once — working
// through a degree, studying while employed, retraining after retirement —
// so this is a multi-select. Picking "Employment" used to mean unpicking
// "University", which described almost nobody accurately.
const lifeStages = [
  { id: 'high_school', label: 'High School / Secondary' },
  { id: 'post_secondary', label: 'University / College / Trade School' },
  { id: 'post_graduate', label: 'Post-Graduate' },
  { id: 'employment', label: 'Employment / Career' },
  { id: 'retirement', label: 'Retirement' },
  { id: 'not_sure', label: "I'm Not Sure" },
]

const barrierCategories = [
  {
    name: 'Combined Norms',
    subcategories: [{ name: 'Combined experiences', items: ['AuDHD'] }],
  },
  ...CONDITION_GROUPS.map((group) => ({
    name: group.label,
    subcategories: [{ name: 'Conditions and differences', items: group.conditions.map((condition) => condition.label) }],
  })),
  {
    name: 'Social & Cultural',
    subcategories: [
      // "Visible Minority" is the Statistics Canada term, but a tester found
      // it vague sitting next to a label as specific as LGBTQ+, so the
      // plainer word leads and the official one stays in parentheses for
      // anyone who recognises it from a form.
      //
      // "Language Barrier" is renamed on Odosa's standing instruction not to
      // use that word anywhere in the product.
      { name: 'Identity', items: ['Racialized Person (Visible Minority)', 'LGBTQ+', 'Gender Identity', 'Religious Minority'] },
      { name: 'Circumstance', items: ['English as an Additional Language', 'First Generation', 'Immigrant / Refugee'] },
    ]
  },
  {
    name: 'Economic & Access',
    subcategories: [
      { name: 'Economic', items: ['Limited Income', 'Food Insecurity', 'Housing Instability'] },
      { name: 'Access', items: ['Limited Technology Access', 'Rural / Remote Area', 'Limited Transportation'] },
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

// ── Character-select avatar ───────────────────────────────────────────────
// Code-generated character avatar (DiceBear "avataaars", inline SVG) so people
// can actually see what they're picking — a video-game-style character select.
// Replaces the old hand-drawn SVG, which looked "wonky" (Odosa/Eliyana). Only
// the user's choices (hairstyle, hair colour, skin tone) vary; see lib/avatar.
function CharacterAvatar({
  hairStyle = '',
  hairColor,
  skinColor,
  accessory,
  facialHair,
  clothing,
  size = 96,
}: {
  hairStyle?: string
  hairColor?: string
  skinColor?: string
  accessory?: string
  facialHair?: string
  clothing?: string
  size?: number
}) {
  const svg = useMemo(
    () => buildAvatarSvg({ hairStyle, hairColor, skinColor, accessory, facialHair, clothing, size }),
    [hairStyle, hairColor, skinColor, accessory, facialHair, clothing, size]
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
  const { user, supabaseUser, completeOnboarding, isLoading: authLoading } = useAuth()
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
  const [carriedOver, setCarriedOver] = useState(false)
  // Simple view starts new users with just one spirit animal (Eliyana: "cut the
  // fast/slow day spirit animals for simple view"). Set after mount to avoid a
  // hydration mismatch. `showAdvancedModes` lets them opt into fast/slow/weekly.
  const [simpleView, setSimpleView] = useState(false)
  const [showAdvancedModes, setShowAdvancedModes] = useState(false)

  const [barrierInputMode, setBarrierInputMode] = useState<'text' | 'manual'>('manual')
  // Which section of the norms list is open, per connection: one at a time.
  const [openNormSection, setOpenNormSection] = useState<Record<string, string | null>>({})
  // The goal step shows the category picked (and any that already hold a
  // goal), not all six at once; the dream box opens on request.
  const [openGoalCategory, setOpenGoalCategory] = useState<string | null>(null)
  const [showUltimateDream, setShowUltimateDream] = useState(false)
  // Free-text custom barriers the user adds per connection (e.g. "public speaking").
  const [customBarrierDraft, setCustomBarrierDraft] = useState<Record<string, string>>({})
  // Sensitive optional details intentionally stay out of the localStorage
  // onboarding draft. They are persisted only after explicit consent.
  const [diagnosticProfile, setDiagnosticProfile] = useState<DiagnosticProfile>(() => ({
    ...EMPTY_DIAGNOSTIC_PROFILE,
    conditions: [],
    supportContext: { ...EMPTY_DIAGNOSTIC_PROFILE.supportContext },
  }))

  // Norms are optional now. Left unanswered, they are sent exactly as an
  // explicit "Prefer not to share", the value existing rows and the condition
  // taxonomy already use, so nothing downstream sees a new shape.
  const selectedBarrierTypes = formData.barrierTypes.length > 0
    ? formData.barrierTypes
    : formData.barrierConnectionText.trim()
      ? [formData.barrierConnectionText.trim()]
      : ['Prefer not to share']
  // The consented, non-clinical part of the detailed profile, sent with the
  // path request. Empty when nothing was shared.
  const agentSupportContext = toRecommendationSupportContext(diagnosticProfile)

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
            if ((Array.isArray(c.barrierTypes) && c.barrierTypes.length > 0) || c.location?.city) {
              setCarriedOver(true)
            }
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

  // A reminder to finish setup, by email, only when asked for (see the
  // footer). Remembered in this browser so the offer is not repeated.
  const SETUP_REMINDER_KEY = 'autinerary_setup_reminder'
  const [setupReminder, setSetupReminder] = useState<'none' | 'asked' | 'failed'>('none')
  useEffect(() => {
    try { if (localStorage.getItem(SETUP_REMINDER_KEY)) setSetupReminder('asked') } catch {}
  }, [])
  const saveSetupReminder = (value: { requestedAt: string; timeZone: string } | null) =>
    fetch('/api/me/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ setupReminder: value }),
    }).then(res => res.ok).catch(() => false)
  const requestSetupReminder = async () => {
    const ok = await saveSetupReminder({ requestedAt: new Date().toISOString(), timeZone: browserTimeZone() })
    setSetupReminder(ok ? 'asked' : 'failed')
    if (ok) try { localStorage.setItem(SETUP_REMINDER_KEY, '1') } catch {}
  }
  const cancelSetupReminder = async () => {
    if (!(await saveSetupReminder(null))) return
    setSetupReminder('none')
    try { localStorage.removeItem(SETUP_REMINDER_KEY) } catch {}
  }

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

  const canProceed = (step = currentStep) => {
    if (!canAccessOnboarding) return false
    switch (steps[step]?.id) {
      case 'about': return formData.audience !== '' // who this is for (age is checked above)
      case 'goalsAndDreams': { // at least one goal in any category
        const hasGoal = Object.values(formData.goalsByCategory).some(entries => entries.some(e => e.goal.trim()))
        return hasGoal
      }
      case 'barrierConnections': return true // optional (Riipen Group 2: "an optional condition question")
      case 'location': return true // optional; skipping it only turns off "near you" sorting
      case 'motivation': return formData.motivationTypes.length > 0 && formData.lifeStages.length > 0
      case 'character': return true // optional
      case 'profile': return formData.dreamSelf.trim() !== ''
      case 'spiritAnimal': return formData.spiritAnimals.length === spiritAnimalSlotCount(formData.spiritAnimalMode) && formData.spiritAnimals.every(a => a.type && a.color) // every slot for the chosen mode filled
      case 'personalize': return true // all optional
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
      case 'motivation': return 'Pick at least one motivation and one life stage, or skip this step.'
      case 'profile': return 'Describe your dream self, or skip this step.'
      case 'spiritAnimal': return 'Choose an animal and colour for each guide, or skip this step.'
      default: return ''
    }
  }
  // Once age, norms and goals are in, the optional steps can be skipped in
  // one go instead of one at a time.
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

  // Picking who this is for pre-selects the matching connection on the
  // Norms step, only while no norms are chosen, so it never wipes answers.
  const chooseAudience = (id: string) => {
    const conn = AUDIENCES.find((a) => a.id === id)?.connection ?? null
    setFormData((prev) => {
      const untouched = prev.barrierTypes.length === 0
      const barrierConnections: Record<string, string[]> = untouched ? (conn ? { [conn]: [] } : {}) : prev.barrierConnections
      const role = untouched ? (conn === 'self' ? 'self_advocate' : conn || '') : prev.role
      return { ...prev, audience: id, barrierConnections, role }
    })
  }

  // Wording that follows who the person is here for (Riipen: "a parent,
  // sibling and a neurodivergent adult may need different first steps").
  const supporting = ['child', 'family', 'friend', 'work'].includes(formData.audience)
  const normsCopy = formData.audience === 'child'
    ? { heading: 'Your child\u2019s norms', intro: 'Which norms does your child navigate? You can add your own too.' }
    : supporting
      ? { heading: 'Their norms', intro: 'Which norms does the person you support navigate? You can add your own too.' }
      : formData.audience === 'ally'
        ? { heading: 'Norms you care about', intro: 'Which norms would you like to understand or support?' }
        : { heading: 'Your Norms', intro: 'Tell us about your norms: the systemic realities you navigate.' }
  const goalIntro = supporting
    ? 'Start with one goal. It can be yours, or something you are working on for the person you support (for example, \u201cFind an occupational therapist for my child\u201d). More goals, dreams and obstacles are optional.'
    : 'Start with one goal. Pick a category and add it. More goals, dreams and obstacles are optional and can come later.'

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
      // Only persist a reminder opt-in that's actually complete (enabled +
      // explicit consent + a contact). Otherwise store it disabled so we never
      // record a half-opted-in reminder we couldn't honor.
      const r = formData.reminders
      const reachable = r.channel === 'sms' ? Boolean(r.smsVerified) : Boolean(r.contact.trim())
      const remindersToSave: ReminderPreferences =
        r.enabled && r.consent && reachable
          ? { ...r, contact: r.contact.trim(), timeZone: r.timeZone || browserTimeZone() }
          : { ...DEFAULT_REMINDERS }

      // Record view/interaction preferences (age, tech savvy, view style) so the
      // rest of the app can adapt and we can learn from intersecting profiles.
      savePreferences({
        dreamAppearance: formData.dreamAppearance,
        alternatePersona: { name: formData.alternatePersonaName.trim(), note: formData.alternatePersonaNote.trim(), appearance: formData.personaAppearance },
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
          if (entry.selfDream?.trim()) allDreams.push(`Dream for self: ${entry.selfDream.trim()}`)
          if (entry.idealRelationship?.trim()) allDreams.push(entry.idealRelationship.trim())
          if (entry.obstacles.trim()) allObstacles.push(entry.obstacles.trim())
        })
      })
      if (formData.ultimateDream.trim()) allDreams.push(formData.ultimateDream.trim())
      if (formData.dreamSelf.trim()) allDreams.push(`Dream for self: ${formData.dreamSelf.trim()}`)
      if (formData.dreamForOther.trim()) allDreams.push(`Dream for another person: ${formData.dreamForOther.trim()}`)
      if (formData.dreamRelationship.trim()) allDreams.push(`Dream for the relationship: ${formData.dreamRelationship.trim()}`)

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
        userId: user.id, // Supabase auth UUID, shared with ServiceHub via public.user_barriers
        barrierTypes: selectedBarrierTypes,
        goals: allGoals.length > 0 ? allGoals : formData.goals.filter(g => g.trim()),
        dreams: allDreams.length > 0 ? allDreams : formData.dreams.filter(d => d.trim()),
        currentChallenges: allObstacles.length > 0 ? allObstacles : formData.currentChallenges.filter(c => c.trim()),
        motivationType: formData.motivationType,
        supportContext: agentSupportContext,
        preferences: {
          pathModel: chosenModel,
          ageRange: formData.ageRange,
          techSavvy: formData.techSavvy,
          viewPreference: formData.viewPreference,
          spiritAnimalMode: formData.spiritAnimalMode,
          spiritAnimals: formData.spiritAnimals,
          dreamAppearance: formData.dreamAppearance,
          alternatePersona: { name: formData.alternatePersonaName.trim(), note: formData.alternatePersonaNote.trim(), appearance: formData.personaAppearance },
          reminders: remindersToSave,
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
          headers: authHeaders,
          timeout: 360000,
        })
      }

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
          accessory: formData.accessory,
          facialHair: formData.facialHair,
          clothing: formData.clothing,
        },
        goals: onboardingBody.goals,
        dreams: onboardingBody.dreams,
        currentChallenges: onboardingBody.currentChallenges,
        goalsByCategory: formData.goalsByCategory,
        barrierTypes: selectedBarrierTypes,
        lifeStage: formData.lifeStage,
        lifeStages: formData.lifeStages,
        location: formData.location,
        role: formData.role,
        alternatePersona: {
          name: formData.alternatePersonaName.trim(),
          note: formData.alternatePersonaNote.trim(),
          appearance: formData.personaAppearance,
        },
        dreamSelf: { description: formData.dreamSelf, appearance: formData.dreamAppearance },
        dreamForOther: formData.dreamForOther,
        dreamRelationship: formData.dreamRelationship,
        preferences: {
          ageRange: formData.ageRange,
          techSavvy: formData.techSavvy,
          viewPreference: formData.viewPreference,
          // The Path header reads these; without them it fell back to a
          // default owl/fox pair that was nobody's actual choice.
          spiritAnimalMode: formData.spiritAnimalMode,
          spiritAnimals: formData.spiritAnimals,
        },
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
        dreamAppearance: formData.dreamAppearance,
        alternatePersona: { name: formData.alternatePersonaName.trim(), note: formData.alternatePersonaNote.trim(), appearance: formData.personaAppearance },
        // Who this is for and what they came for: drives what the next pages
        // show first, and lets the funnel be compared by user type.
        audience: formData.audience || null,
        lookingFor: formData.lookingFor,
        ...(startPath ? { startPath } : {}),
      }).then(() => true, () => false)
      try {
        // Without a saved Start here pathway, the page after setup still opens
        // with starter resources, picked from who this is for, what they are
        // looking for and their goal (Riipen Labs, Group 5).
        const goalCategory = Object.keys(formData.goalsByCategory).find((id) =>
          formData.goalsByCategory[id].some((e) => e.goal.trim()))
        const suggested = suggestedStart(formData.audience, formData.lookingFor, goalCategory)
        localStorage.setItem('autinerary_onboarding_choices', JSON.stringify({ audience: formData.audience, lookingFor: formData.lookingFor, startPath, suggestedStart: suggested }))
        // Saved with the account now, so not left for whoever uses this
        // browser next.
        if (prefsSaved && startPath) {
          localStorage.removeItem(START_FOR_KEY)
          localStorage.removeItem(START_NEED_KEY)
        }
        // "Ask later": the optional extras this person did not get to, offered
        // on the Path later (app/components/AskLaterCard.tsx). "aboutYou" is
        // sensory needs and conditions (the detailed profile), asked in the
        // second week when nothing about them was shared (Group 5: "gradually
        // prompt for secondary preferences ... over Days 7 to 14").
        const sharedAboutThem = formData.barrierTypes.length > 0 || formData.barrierConnectionText.trim() !== '' ||
          diagnosticProfile.conditions.length > 0 || agentSupportContext !== undefined
        const askLater = ['location', 'aboutYou', 'character', 'spiritAnimal', 'personalize'].filter((id) =>
          id === 'location' ? !formData.location.city.trim()
            : id === 'aboutYou' ? !sharedAboutThem
            : !stepsSeen.current.has(stepIndex(id)))
        localStorage.setItem('autinerary_ask_later', JSON.stringify(askLater))
      } catch {}
      // Save the location to the profile so ResourceHub can recommend places
      // near this person. Bounded and best-effort: never holds up the path.
      if (formData.location.city.trim()) {
        await axios.post('/api/me/location', formData.location, { timeout: 8000 }).catch(() => {})
      }
      clearAutosave()
      router.push('/onboarding-confirmation')
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

  // The rail shows one group at a time: the two-step start, or the
  // optional extras once someone chooses to add more. Nine labels in a row
  // read as "a lot"; two do not.
  const inExtras = currentStep >= CORE_STEP_COUNT
  const groupStart = inExtras ? CORE_STEP_COUNT : 0
  const groupSteps = inExtras ? steps.slice(CORE_STEP_COUNT) : steps.slice(0, CORE_STEP_COUNT)
  const progressPercentage = groupSteps.length > 1 ? ((currentStep - groupStart) / (groupSteps.length - 1)) * 100 : 100
  

  return (
    <div className="min-h-screen text-slate-900 p-4 md:p-8 relative overflow-hidden surface-veil">
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

      <div className="relative max-w-4xl mx-auto z-10">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-2 text-slate-800">
            Welcome{user?.name ? `, ${user.name}` : ''}
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
              Welcome back. We kept your norms and location. Just set goals for this path.
            </div>
          )}
        </div>

        {/* Progress: a slim rail with the bunny on it. It was a tall grass
            track with seven food emoji, a finish flag and a bunny that hopped
            without stopping. Riipen Labs Group 9 found "the frequent use of
            emojis, bright colours, and game-like visual elements" made setup
            feel less polished, and motion that never stops is hard on
            attention (WCAG 2.2.2). The bunny stays, the one playful touch,
            and moves only when the step does. */}
        <div className="mb-12 relative">
          <div className="relative mx-4 h-10" aria-hidden="true">
            <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-slate-200" />
            <div
              className="absolute left-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-emerald-500 transition-all duration-500 ease-out"
              style={{ width: `${progressPercentage}%` }}
            />
            <span
              className="absolute top-1/2 text-2xl leading-none transition-all duration-500 ease-out"
              style={{ left: `${progressPercentage}%`, transform: 'translate(-50%, -70%)' }}
            >
              🐰
            </span>
          </div>

          {/* Step Labels Below Path */}
          {inExtras && (
            <p className="mt-3 text-center text-sm text-slate-700">Optional extras: skip any of them, or create your path now.</p>
          )}
          <div className={`grid ${inExtras ? 'grid-cols-4 sm:grid-cols-7' : 'grid-cols-2'} gap-4 mt-4 px-2`}>
            {groupSteps.map((step, i) => {
              const idx = groupStart + i
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
                  className="flex min-h-[72px] flex-col items-center flex-1"
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
                      grows downward into whatever sits directly beneath it.
                      leading-tight plus a wider box keeps two short words on
                      one or two tidy lines instead of a ragged stack. */}
                  <span className={`text-xs leading-tight mt-3 text-center w-full max-w-[76px] ${isActive ? 'text-slate-900 font-bold' : isCompleted ? 'text-green-800 font-medium' : 'text-slate-700'}`}>
                    {step.short}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Step Content Card */}
        <div className="rounded-2xl p-6 md:p-8 surface">
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

          {chatMode && !inExtras && (
            <ChatSetup
              name={(user?.name || '').split(' ')[0]}
              audiences={AUDIENCES}
              audienceValue={AUDIENCE_VALUE}
              categories={goalCategories}
              ideasFor={ideasFor}
              helperIdeas={helperIdeas}
              onAge={(value) => setFormData(prev => ({ ...prev, ageConfirmation: value }))}
              onAudience={chooseAudience}
              onGoal={addGoal}
              onUndoGoal={removeGoal}
              onCity={(city) => setFormData(prev => ({ ...prev, location: { ...prev.location, city } }))}
              onCreate={handleSubmit}
              onMore={() => { setChatMode(false); setCurrentStep(CORE_STEP_COUNT) }}
              onForm={() => setChatMode(false)}
              isSubmitting={isSubmitting}
            />
          )}

          <div className={`mb-5 flex flex-wrap items-center gap-2 text-sm ${chatMode && !inExtras ? 'hidden' : ''}`}>
            {!REQUIRED_STEP_IDS.has(currentId) && (
              <span className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-0.5 font-semibold text-slate-700">Optional step</span>
            )}
            {STEP_PURPOSE[steps[currentStep].id] && (
              <p className="text-slate-700"><span className="font-semibold text-slate-900">How this is used:</span> {STEP_PURPOSE[steps[currentStep].id]}</p>
            )}
          </div>

          {/* About you: the short goal-first start. Age is required (18+ for
              now); who this is for is one tap; what they came for is optional. */}
          {currentId === 'about' && !chatMode && (
            <div>
              {/* A welcoming, plain first screen (Riipen Labs, Group 6: "a cohesive
                  and empathetic voice to build immediate trust"; docs/voice.md). */}
              <h2 className="text-2xl font-bold mb-2 text-slate-800">Welcome. Let&apos;s start with you</h2>
              <p className="text-slate-600 mb-4">Two quick questions, then your path is ready. There are no wrong answers.</p>

              <div className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-slate-800">
                <p className="font-semibold text-slate-900">How setup works</p>
                <p className="mt-1">
                  This step and one goal. Then we build your path, with starter resources for what you need. Everything
                  else (norms, location, your character, spirit animals, how the app looks) is optional, and you can add it later.
                </p>
                <p className="mt-2">We don&apos;t sell your information, show ads, or use it to train AI.</p>
              </div>
              <p className="mb-6 text-sm">
                <button type="button" onClick={() => setChatMode(true)} className="font-medium text-indigo-800 underline underline-offset-2 hover:text-indigo-950">
                  Prefer to answer by chatting? Try the chat version
                </button>
              </p>

              <label className="block mb-6 font-medium">
                Confirm your age
                <select
                  value={formData.ageConfirmation}
                  onChange={event => setFormData(previous => ({ ...previous, ageConfirmation: event.target.value as '' | 'adult' | 'under18' }))}
                  className="mt-2 block w-full rounded-lg border border-slate-300 p-3"
                >
                  <option value="">Select your age group</option>
                  <option value="adult">I am 18 or older</option>
                  <option value="under18">I am under 18</option>
                </select>
              </label>
              {guardianApproved && <p role="status" className="mb-4 text-sm text-emerald-700">Your legal adult has approved this supervised account.</p>}
              {!guardianApproved && (formData.ageConfirmation === 'under18' || isManagedAccount) && (
                <p role="alert" className="mb-6 rounded-lg border border-amber-400 bg-amber-50 p-4">Sorry, this app is only for those who are 18+ right now. Soon, we’ll have an option to sign in with a trusted legal adult!</p>
              )}

              <fieldset className="mb-6" disabled={!canAccessOnboarding}>
                <legend className="mb-2 font-medium text-slate-900">Who are you here for?</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {AUDIENCES.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => chooseAudience(a.id)}
                      aria-pressed={formData.audience === a.id}
                      className={`rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                        formData.audience === a.id
                          ? 'border-indigo-700 bg-indigo-50 text-indigo-900'
                          : 'border-slate-300 bg-white text-slate-800 hover:border-indigo-400'
                      }`}
                    >
                      {formData.audience === a.id && <Check className="mr-1 inline h-4 w-4" aria-hidden="true" />}
                      {a.label}
                    </button>
                  ))}
                </div>
                {AUDIENCE_VALUE[formData.audience] && (
                  <p role="status" className="mt-3 rounded-lg bg-indigo-50 px-4 py-3 text-sm text-indigo-950">
                    {AUDIENCE_VALUE[formData.audience]}
                  </p>
                )}
              </fieldset>

              <fieldset disabled={!canAccessOnboarding}>
                <legend className="mb-1 font-medium text-slate-900">
                  What are you looking for today? <span className="font-normal text-slate-700">(optional, pick any)</span>
                </legend>
                <p className="mb-2 text-sm text-slate-700">We&apos;ll show you that first once your path is ready.</p>
                <div className="flex flex-wrap gap-2">
                  {LOOKING_FOR.map((o) => {
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
                        className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                          on ? 'border-indigo-700 bg-indigo-50 text-indigo-900' : 'border-slate-300 bg-white text-slate-800 hover:border-indigo-400'
                        }`}
                      >
                        {on && <Check className="mr-1 inline h-4 w-4" aria-hidden="true" />}
                        {o.label}
                      </button>
                    )
                  })}
                </div>
              </fieldset>
            </div>
          )}

          {/* Character (optional extra): the avatar designer. */}
          {currentId === 'character' && (
            <div>
              <h2 className="text-2xl font-bold mb-2 text-slate-800">Create Your Character</h2>
              <p className="text-slate-600 mb-6">Design an avatar to represent you on your journey through Dream Land. You can change it later on your Ideal Self page.</p>

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
                
                {/* Hair & headwear.
                    A tester asked for the full Avataaars range; this offered
                    7 of 34. All of them are here now, grouped so the list
                    stays browsable, and each swatch previews in the user's
                    own colours rather than as a generic thumbnail. */}
                <div>
                  <h3 className="text-sm font-medium text-slate-700 mb-1">Hair &amp; headwear</h3>
                  <p className="text-xs text-slate-600 mb-3">Tap any option to try it. You can change it later.</p>
                  <div className="space-y-4">
                    {HAIR_GROUPS.map((group) => (
                      <div key={group.name}>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">{group.name}</p>
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                          {group.options.map((hs) => (
                            <button
                              key={hs.id}
                              type="button"
                              aria-pressed={formData.hairStyle === hs.id}
                              onClick={() => setFormData(prev => ({ ...prev, hairStyle: hs.id }))}
                              className={`relative flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${
                                formData.hairStyle === hs.id
                                  ? 'border-cyan-500 bg-cyan-500/10 ring-2 ring-cyan-300'
                                  : 'border-slate-200 hover:border-cyan-400'
                              }`}
                            >
                              <CharacterAvatar
                                hairStyle={hs.id}
                                hairColor={formData.hairColor}
                                skinColor={formData.skinColor}
                                accessory={formData.accessory}
                                facialHair={formData.facialHair}
                                clothing={formData.clothing}
                                size={44}
                              />
                              <span className="text-xs leading-tight text-center text-slate-700">{hs.label}</span>
                              {formData.hairStyle === hs.id && (
                                <Check className="absolute top-1 right-1 w-3.5 h-3.5 text-cyan-700" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Glasses and other face accessories */}
                <div>
                  <h3 className="text-sm font-medium text-slate-700 mb-3">Glasses &amp; accessories</h3>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {ACCESSORIES.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        aria-pressed={formData.accessory === a.id}
                        onClick={() => setFormData(prev => ({ ...prev, accessory: a.id }))}
                        className={`px-3 py-2 rounded-lg border-2 text-xs font-medium transition-all ${
                          formData.accessory === a.id
                            ? 'border-cyan-500 bg-cyan-500/10 text-cyan-700'
                            : 'border-slate-200 hover:border-cyan-400 text-slate-600'
                        }`}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Facial hair */}
                <div>
                  <h3 className="text-sm font-medium text-slate-700 mb-3">Facial hair</h3>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {FACIAL_HAIR.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        aria-pressed={formData.facialHair === f.id}
                        onClick={() => setFormData(prev => ({ ...prev, facialHair: f.id }))}
                        className={`px-3 py-2 rounded-lg border-2 text-xs font-medium transition-all ${
                          formData.facialHair === f.id
                            ? 'border-cyan-500 bg-cyan-500/10 text-cyan-700'
                            : 'border-slate-200 hover:border-cyan-400 text-slate-600'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Clothing */}
                <div>
                  <h3 className="text-sm font-medium text-slate-700 mb-3">Outfit</h3>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {CLOTHING.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        aria-pressed={formData.clothing === c.id}
                        onClick={() => setFormData(prev => ({ ...prev, clothing: c.id }))}
                        className={`px-3 py-2 rounded-lg border-2 text-xs font-medium transition-all ${
                          formData.clothing === c.id
                            ? 'border-cyan-500 bg-cyan-500/10 text-cyan-700'
                            : 'border-slate-200 hover:border-cyan-400 text-slate-600'
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
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
                    <div className="relative w-44 rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col items-center justify-center overflow-hidden py-4">
                      <UserAvatar
                        hairStyle={formData.hairStyle}
                        hairColor={formData.hairColor}
                        skinColor={formData.skinColor}
                        accessory={formData.accessory}
                        facialHair={formData.facialHair}
                        clothing={formData.clothing}
                        size={120}
                      />
                      <p className="text-xs text-slate-600 font-medium mt-1 text-center px-2">
                        {formData.bodyType && formData.bodyType !== 'skip' ? bodyTypes.find(b => b.id === formData.bodyType)?.label : ''}
                        {formData.hairStyle && formData.hairStyle !== 'skip' ? ` · ${HAIR_OPTIONS.find(h => h.id === formData.hairStyle)?.label || ''}` : ''}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
            </div>
          )}

          {/* Step 1: Role */}
          {currentId === 'barrierConnections' && (
            <div>
              <h2 className="text-2xl font-bold mb-2 text-slate-800">{normsCopy.heading}</h2>
              <p className="text-slate-600 mb-2">{normsCopy.intro} Either describe them in your own words, or select manually below. This step is optional: skip it and it counts as &ldquo;Prefer not to share&rdquo;.</p>
              <p className="text-xs text-slate-500 mb-4 italic">Your identity is not the problem. Things like your disability, ethnicity, or gender aren&apos;t obstacles themselves: the obstacles are the systemic ones society puts in the way. We use this only to find support built for them.</p>

              {/* Mode toggle */}
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => setBarrierInputMode('text')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    barrierInputMode === 'text'
                      ? 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white'
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Describe in your words
                </button>
                <button
                  onClick={() => setBarrierInputMode('manual')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    barrierInputMode === 'manual'
                      ? 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white'
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
                      {/* Shown as "norms" (Odosa); the saved value is unchanged so existing data still matches. */}
                      {choice === 'No current barriers' ? 'No current norms' : choice}
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
                    placeholder="Describe the norms you navigate in a sentence..."
                    rows={3}
                    className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-800 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  />
                  <button
                    onClick={() => setFormData(prev => ({ ...prev, barrierConnectionText: '' }))}
                    className="text-sm text-slate-600 hover:text-red-700 transition-colors"
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
                    <h3 className="text-sm font-medium text-slate-700 mb-3">Your connection to these norms (select all that apply)</h3>
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
                              return { ...prev, barrierConnections: current, role, barrierTypes: [...new Set(Object.values(current).flat())] }
                            })
                          }}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            'disabled' in conn && conn.disabled
                              ? 'bg-slate-100 border border-slate-200 text-slate-600 cursor-not-allowed'
                              : formData.barrierConnections[conn.id] !== undefined
                                ? 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white'
                                : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-cyan-400'
                          }`}
                        >
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
                          className="w-4 h-4 rounded border-slate-300 text-cyan-700 focus:ring-cyan-500"
                        />
                        <span>These norms also apply to me (add yourself)</span>
                      </label>
                    )}
                  </div>

                  {/* Per-connection barrier selectors */}
                  {Object.keys(formData.barrierConnections).length > 0 && (
                    <div className="space-y-4">
                      {Object.keys(formData.barrierConnections).map((connId) => {
                        const conn = connectionTypes.find(c => c.id === connId)
                        if (!conn) return null
                        // How well you can be expected to know someone's
                        // clinical details varies enormously by relationship.
                        // You know your own. A parent usually knows a child's.
                        // You very likely do not know whether a coworker or a
                        // friend has a diagnosis, and a guessed diagnosis is
                        // worse input than a blank one, because it shapes the
                        // plan around something that may not be true.
                        const isSelf = connId === 'self'
                        const distantRelationship = ['coworker', 'friend', 'employer', 'educator', 'ally'].includes(connId)
                        return (
                          <div key={connId} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                            <h4 className="font-medium text-slate-800 mb-1 flex items-center gap-2">
                              Norms for: {conn.label}
                            </h4>
                            <p className="text-xs text-slate-500 mb-3">
                              {isSelf
                                ? 'Pick whatever applies to you. Nothing here is required.'
                                : distantRelationship
                                  ? `Only pick what you actually know about your ${conn.label.toLowerCase()}. If you are not sure whether they have a diagnosis, leave it blank: a guess would shape their plan around something that may not be true. What you have seen yourself, like sensory needs or accommodations, is the useful part.`
                                  : 'Pick what you know. Anything you are unsure about is better left blank than guessed.'}
                            </p>
                            {/* What is picked so far, so a closed section hides nothing. */}
                            {(formData.barrierConnections[connId] || []).length > 0 && (
                              <p className="mb-3 text-xs text-slate-700">
                                <span className="font-semibold text-slate-900">Picked:</span>{' '}
                                {(formData.barrierConnections[connId] || []).join(', ')}
                              </p>
                            )}
                            {/* Nine groups, one open at a time. Every one used to be
                                open at once, repeated for each connection picked:
                                Riipen Labs Group 9's "too much information at once",
                                against W3C's advice to present "smaller, easier-to-
                                understand sections". */}
                            <div className="space-y-2">
                              {barrierCategories.map((category) => {
                                const sectionItems = category.subcategories.flatMap((sub) => sub.items)
                                const pickedHere = sectionItems.filter((item) => formData.barrierConnections[connId]?.includes(item)).length
                                const isOpen = openNormSection[connId] === category.name
                                return (
                                <div key={category.name} className="rounded-lg border border-slate-200 bg-white">
                                  <button
                                    type="button"
                                    aria-expanded={isOpen}
                                    onClick={() => setOpenNormSection(prev => ({ ...prev, [connId]: isOpen ? null : category.name }))}
                                    className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-800 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                                  >
                                    <span>
                                      {category.name}
                                      {pickedHere > 0 && <span className="ml-2 text-xs font-semibold text-indigo-700">{pickedHere} picked</span>}
                                    </span>
                                    <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                                  </button>
                                  {isOpen && (
                                  <div className="space-y-2 border-t border-slate-100 px-3 pb-3 pt-2">
                                    {category.subcategories.map((sub) => (
                                      <div key={sub.name}>
                                        {category.subcategories.length > 1 && <p className="text-xs text-slate-600 mb-1">{sub.name}</p>}
                                        <div className="flex flex-wrap gap-1.5 mb-2">
                                          {sub.items.map((barrier) => {
                                            const isSelected = formData.barrierConnections[connId]?.includes(barrier)
                                            const includedInCombination = ['Autism', 'Autism spectrum disorder', 'ADHD'].includes(barrier) && formData.barrierConnections[connId]?.includes('AuDHD')
                                            return (
                                              <button
                                                key={barrier}
                                                disabled={includedInCombination}
                                                title={includedInCombination ? 'Already included in AuDHD for this person' : undefined}
                                                onClick={() => {
                                                  setFormData(prev => {
                                                    const current = { ...prev.barrierConnections }
                                                    const list = [...(current[connId] || [])]
                                                    if (list.includes(barrier)) {
                                                      current[connId] = list.filter(b => b !== barrier)
                                                    } else {
                                                      current[connId] = barrier === 'AuDHD'
                                                        ? [...list.filter(item => !['Autism', 'Autism spectrum disorder', 'ADHD'].includes(item)), barrier]
                                                        : [...list, barrier]
                                                    }
                                                    // Flatten all barriers into barrierTypes for backend compat
                                                    const allBarriers = [...new Set(Object.values(current).flat())]
                                                    return { ...prev, barrierConnections: current, barrierTypes: allBarriers }
                                                  })
                                                }}
                                                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                                                  isSelected
                                                    ? 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white'
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
                                  )}
                                </div>
                                )
                              })}
                            </div>

                            {/* Add your own — custom / more specific barriers */}
                            <div className="mt-4 pt-3 border-t border-slate-200">
                              <p className="text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">Add your own</p>
                              <p className="text-xs text-slate-600 mb-2">Don&apos;t see a norm that fits? Add something specific: e.g. &quot;public speaking&quot;, &quot;test anxiety&quot;, &quot;sensory overload in crowds&quot;.</p>
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
                                        className="px-3 py-1 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white"
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
                                  placeholder="Type a specific norm and press Enter"
                                  maxLength={60}
                                  className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
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
                                  className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white"
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
          {currentId === 'location' && (
            <div>
              <h2 className="text-2xl font-bold mb-2 text-slate-800">Where are you located?</h2>
              <p className="text-slate-600 mb-6">This helps us find resources in your area. All location data is private and optional.</p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">City</label>
                  <input
                    type="text"
                    value={formData.location.city}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: { ...prev.location, city: e.target.value } }))}
                    placeholder="e.g., Toronto"
                    className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-800 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Province/State</label>
                  <input
                    type="text"
                    value={formData.location.province}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: { ...prev.location, province: e.target.value } }))}
                    placeholder="e.g., Ontario"
                    className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-800 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Country</label>
                  <input
                    type="text"
                    value={formData.location.country}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: { ...prev.location, country: e.target.value } }))}
                    placeholder="e.g., Canada"
                    className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-800 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Additional resource locations */}
              <div className="mt-8 border-t border-slate-200 pt-6">
                <h3 className="text-sm font-medium text-slate-700 mb-1">Where else can you access resources? <span className="text-slate-600 font-normal">(optional)</span></h3>
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
                        className="text-slate-600 hover:text-red-700 text-sm"
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
                        className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
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
                        className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
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
                        className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                      />
                    </div>
                  </div>
                ))}

                <button
                  onClick={() => setFormData(prev => ({
                    ...prev,
                    additionalLocations: [...prev.additionalLocations, { city: '', province: '', country: '' }]
                  }))}
                  className="text-cyan-800 hover:text-cyan-900 text-sm font-medium"
                >
                  + Add another location
                </button>
              </div>
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
              ? (connectionTypes.find(c => c.id === otherConnectionIds[0])?.label || 'them').replace(' (Lived Experience)', '')
              : 'them'
            return (
            <div>
              <h2 className="text-2xl font-bold mb-2 text-slate-800">Your goal</h2>
              <p className="text-slate-600 mb-6">{goalIntro}</p>
              
              {/* Category tabs: pick one, and only that one opens (Riipen Labs,
                  Group 9: all six used to show at once, each with its own
                  ideas and fields, on a step everyone has to complete). */}
              <div className="flex flex-wrap gap-2 mb-6">
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
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        isOpen
                          ? 'bg-indigo-600 text-white border border-indigo-600'
                          : count > 0
                            ? 'bg-cyan-100 text-cyan-700 border border-cyan-300'
                            : 'bg-white border border-slate-200 text-slate-600 hover:border-cyan-400'
                      }`}
                    >
                      {cat.label}
                      {count > 0 && <span className="bg-cyan-700 text-white text-xs px-1.5 py-0.5 rounded-full">{count}</span>}
                    </button>
                  )
                })}
              </div>

              {/* Optional AI help for the hardest question in setup (Riipen
                  Labs, Group 11): one line until asked for. */}
              <GoalHelper
                ideas={helperIdeas}
                categoryLabel={(id) => goalCategories.find(c => c.id === id)?.label || 'Other'}
                audience={formData.audience}
                onAdd={addGoal}
              />

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
                              <Sparkles className="w-3.5 h-3.5 text-cyan-700" />
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
                            <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                              Goal ideas
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
                              className="px-2 text-slate-600 hover:text-red-700 text-sm"
                            >
                              ×
                            </button>
                          </div>
                          
                          {/* Per-goal dream */}
                          {(() => {
                            const fields: Array<{ key: 'dreams' | 'selfDream'; label: string }> = [{ key: 'dreams', label: hasOtherPerson ? 'Dream for the other person' : 'Dream for Self' }]
                            if (hasOtherPerson && formData.barrierConnections.self?.length) {
                              const selfField = { key: 'selfDream' as const, label: 'Dream for Self' }
                              if (formData.barrierConnections.parent !== undefined) fields.push(selfField)
                              else fields.unshift(selfField)
                            }
                            return fields.map(field => (
                              <label key={field.key} className="ml-4 mb-2 block text-xs font-medium text-purple-600">
                                {field.label} (optional)
                                <input value={entry[field.key] || ''} onChange={event => setFormData(previous => ({ ...previous, goalsByCategory: { ...previous.goalsByCategory, [cat.id]: previous.goalsByCategory[cat.id].map((goal, index) => index === idx ? { ...goal, [field.key]: event.target.value } : goal) } }))} placeholder="Where does this goal lead in 5-10 years?" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700" />
                              </label>
                            ))
                          })()}

                          {/* Ideal relationship — second option when the goal
                              involves another person (e.g. a sibling). Both this
                              and the dream are optional; answer whichever fits. */}
                          {hasOtherPerson && (
                            <div className="ml-4 mb-1">
                              <label className="text-xs text-indigo-500 font-medium">
                                Ideal relationship with {otherPersonLabel} <span className="text-slate-600">(optional: instead of, or as well as, the dream)</span>
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
                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 mt-1"
                              />
                            </div>
                          )}

                          {/* Per-goal obstacle */}
                          <div className="ml-4">
                            <label className="text-xs text-pink-700 font-medium">Obstacle <span className="text-slate-600">(optional)</span></label>
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
                              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-pink-400 focus:border-pink-400 mt-1"
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
                        className="text-cyan-800 hover:text-cyan-900 text-xs font-medium"
                      >
                        + Add a {cat.label.toLowerCase()} goal
                      </button>
                    </div>
                  )
                })}
              </div>

              {/* Ultimate Dream: optional, so one line until someone wants it. */}
              {!showUltimateDream && !formData.ultimateDream.trim() ? (
                <button
                  type="button"
                  onClick={() => setShowUltimateDream(true)}
                  className="mt-6 text-sm font-medium text-purple-700 underline hover:text-purple-900"
                >
                  + Add your biggest dream (optional)
                </button>
              ) : (
              <div className="mt-6 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-4">
                <h3 className="font-medium text-purple-800 mb-2 flex items-center gap-2">
                  Ultimate Dream
                </h3>
                <p className="text-xs text-purple-600 mb-3">Beyond all your goals, what&apos;s your biggest dream?</p>
                <input
                  type="text"
                  value={formData.ultimateDream}
                  onChange={(e) => setFormData(prev => ({ ...prev, ultimateDream: e.target.value }))}
                  placeholder='e.g., "Create a world where neurodivergent people thrive"'
                  className="w-full bg-white border border-purple-200 rounded-lg px-4 py-3 text-sm text-slate-800 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400"
                />
              </div>
              )}
            </div>
            )
          })()}

          {/* Step 4: Motivation & Life Stage */}
          {currentId === 'motivation' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-2 text-slate-800">What motivates you most?</h2>
                <p className="text-slate-600 mb-6">Select all that apply: most people are motivated by more than one thing.</p>
                
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
                <h2 className="text-2xl font-bold mb-2 text-slate-800">What life stage are you in?</h2>
                <p className="text-slate-600 mb-6">
                  Pick as many as apply. Plenty of people are studying and working at the same time.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {lifeStages.map((stage) => {
                    const selected = formData.lifeStages.includes(stage.id)
                    return (
                      <button
                        key={stage.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setFormData(prev => {
                          // "I'm Not Sure" is the absence of an answer, so it
                          // cannot sit alongside a real one.
                          let next: string[]
                          if (stage.id === 'not_sure') {
                            next = selected ? [] : ['not_sure']
                          } else {
                            next = selected
                              ? prev.lifeStages.filter(id => id !== stage.id)
                              : [...prev.lifeStages.filter(id => id !== 'not_sure'), stage.id]
                          }
                          return { ...prev, lifeStages: next, lifeStage: next[0] || '' }
                        })}
                        className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                          selected
                            ? 'border-cyan-500 bg-cyan-500/20 text-cyan-700'
                            : 'border-slate-200 hover:border-cyan-400 text-slate-700'
                        }`}
                      >
                        {stage.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Profile Customization - Dreams & Dream Self */}
          {currentId === 'profile' && (
            <div>
              <h2 className="text-2xl font-bold mb-6 text-slate-800">Dream Self &amp; Alternate Persona</h2>
              
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
                    <h3 className="text-sm font-medium text-purple-700 mb-2">Your Dreams So Far</h3>
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
                {(() => {
                  const hasOther = Object.keys(formData.barrierConnections).some(key => key !== 'self' && formData.barrierConnections[key].length > 0)
                  const hasSelf = !!formData.barrierConnections.self?.length || !hasOther || !!formData.dreamSelf
                  const fields: Array<{ key: 'dreamSelf' | 'dreamForOther' | 'dreamRelationship'; label: string }> = []
                  if (hasSelf) fields.push({ key: 'dreamSelf', label: 'Dream for Self' })
                  if (hasOther) {
                    const other = { key: 'dreamForOther' as const, label: 'Dream for the other person' }
                    if (formData.barrierConnections.parent !== undefined) fields.unshift(other)
                    else fields.push(other)
                    fields.push({ key: 'dreamRelationship', label: 'Dream for your relationship with them' })
                  }
                  return fields.map(field => (
                    <label key={field.key} className="block text-sm font-medium text-slate-700">
                      {field.label} (optional)
                      <textarea value={formData[field.key]} onChange={event => setFormData(previous => ({ ...previous, [field.key]: event.target.value }))} rows={3} className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3" />
                    </label>
                  ))
                })()}
                <AppearanceEditor title="Dream Self appearance" value={formData.dreamAppearance} onChange={value => setFormData(previous => ({ ...previous, dreamAppearance: value }))} />

                {/* Alternate Persona (optional) — a named alter-ego for the Dream Self */}
                <div className="border-t border-slate-200 pt-6">
                  <h3 className="text-lg font-bold text-slate-800 mb-1">Alternate Persona <span className="text-xs font-normal text-slate-600">(optional)</span></h3>
                  <p className="text-slate-600 text-sm mb-4">Some people picture their Dream Self as a named alter-ego: a confident version of them they can step into. Give yours a name if you like.</p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Persona name</label>
                      <input
                        type="text"
                        value={formData.alternatePersonaName}
                        onChange={(e) => setFormData(prev => ({ ...prev, alternatePersonaName: e.target.value }))}
                        placeholder="e.g. Nova, Captain Focus, Future Me"
                        maxLength={60}
                        className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-800 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">What are they like? <span className="text-slate-600">(optional)</span></label>
                      <textarea
                        value={formData.alternatePersonaNote}
                        onChange={(e) => setFormData(prev => ({ ...prev, alternatePersonaNote: e.target.value }))}
                        placeholder="Bold, calm under pressure, speaks up in meetings, takes the first step..."
                        rows={3}
                        maxLength={400}
                        className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-800 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                      />
                    </div>
                    <AppearanceEditor title="Alternate Persona appearance" value={formData.personaAppearance} onChange={value => setFormData(previous => ({ ...previous, personaAppearance: value }))} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 6: Spirit Animals */}
          {currentId === 'spiritAnimal' && (() => {
            const slotCount = spiritAnimalSlotCount(formData.spiritAnimalMode)
            // In simple view we hide the fast/slow + per-day modes behind a
            // "More options" toggle so new users just pick one guide.
            const modesCollapsed = simpleView && !showAdvancedModes
            const visibleModes = modesCollapsed
              ? spiritAnimalModes.filter(m => m.id === 'general')
              : spiritAnimalModes
            return (
            <div>
              <h2 className="text-2xl font-bold mb-2 text-slate-800">Choose Your Spirit Animal(s)</h2>
              <p className="text-slate-600 mb-4">Your spirit animals are friendly guides that represent you.{modesCollapsed ? ' Keeping it simple with one guide. You can add more anytime.' : " Pick how many you'd like."}</p>

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
                    <p className="text-xs text-slate-600 mt-1">{m.desc}</p>
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
                    A <strong>fast day</strong> has more planned activity. A <strong>slow day</strong> has fewer
                    activities or more room for rest. Neither is better. Your Path chooses the guide from
                    your schedule; it does not infer how you feel.
                  </p>
                </div>
              )}

              {/* Spirit Animal Slots */}
              {formData.spiritAnimals.map((animal, idx) => (
                <div key={idx} className="mb-6 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium text-purple-700">
                      {spiritAnimalSlotLabel(formData.spiritAnimalMode, idx)}
                    </h3>
                    <button
                      type="button"
                      onClick={() => removeSpiritAnimal(idx)}
                      className="text-sm text-red-400 hover:text-red-500"
                    >
                      Remove
                    </button>
                  </div>
                  
                  {/* Step ① Select Animal
                      A tester reported the animal "won't change without
                      clicking Remove first". The grid stays live and tapping
                      another animal always worked, but once a slot was filled
                      nothing said so, and Remove was the only visible action.
                      The hint below is the affordance that was missing. */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      ① Choose Animal
                      {animal.type && (
                        <span className="ml-2 font-normal text-slate-500">
, tap a different one to change it
                        </span>
                      )}
                    </label>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {spiritAnimalOptions.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          aria-pressed={animal.type === opt.id}
                          onClick={() => updateSpiritAnimal(idx, 'type', opt.id)}
                          className={`flex flex-col items-center p-3 rounded-lg border-2 transition-all ${
                            animal.type === opt.id
                              ? 'border-purple-500 bg-purple-100 scale-105'
                              : 'border-slate-200 hover:border-purple-300 hover:bg-purple-50'
                          }`}
                        >
                          <img src={`/spirit-animals/${opt.id}.png`} alt="" width={48} height={48} className="h-12 w-12 object-contain" />
                          <span className="text-xs mt-1 text-slate-600">{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Step ② Select Color */}
                  {animal.type && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        ② Choose Color
                        {animal.color && (
                          <span className="ml-2 font-normal text-slate-500">
, tap a different one to change it
                          </span>
                        )}
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {spiritAnimalColors.map((color) => (
                          <button
                            key={color.id}
                            type="button"
                            aria-pressed={animal.color === color.id}
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
                          <img src={`/spirit-animals/${spiritAnimalOptions.find(option => option.id === animal.type)?.id || 'owl'}.png`} alt={`${animal.color} ${animal.type}`} width={72} height={72} className="h-16 w-16 object-contain" style={{ filter: `hue-rotate(${animalHue[animal.color] || 0}deg)` }} />
                          <span className="text-sm text-purple-600 font-medium">
                            {spiritAnimalColors.find(c => c.id === animal.color)?.label} {spiritAnimalOptions.find(o => o.id === animal.type)?.label}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              <a href="/spirit-animals/ATTRIBUTION.md" target="_blank" rel="noopener noreferrer" className="mb-3 block text-xs text-slate-500 underline">Twemoji artwork · CC BY 4.0</a>

              {/* Add Spirit Animal Button */}
              {formData.spiritAnimals.length < slotCount && (
                <button
                  onClick={addSpiritAnimal}
                  className="w-full py-4 border-2 border-dashed border-purple-300 rounded-xl text-purple-700 hover:bg-purple-50 hover:border-purple-400 transition-all font-medium"
                >
                  {formData.spiritAnimalMode === 'general' ? 'Choose your spirit animal' : `Choose ${spiritAnimalSlotLabel(formData.spiritAnimalMode, formData.spiritAnimals.length).replace(/^(?:🐾|⚡|🌙)\s*/u, '')}`}
                  {slotCount > 1 && <span className="text-purple-700 text-sm"> ({formData.spiritAnimals.length + 1}/{slotCount})</span>}
                </button>
              )}
              
              {formData.spiritAnimals.length === slotCount && formData.spiritAnimals.every(animal => animal.type && animal.color) && (
                <p className="text-sm text-slate-500 text-center mt-2">
                  {formData.spiritAnimalMode === 'general' && 'Your spirit animal is set! 🐾'}
                  {formData.spiritAnimalMode === 'fastSlow' && 'You\u2019ve got both: your \u26A1 Fast Day and \uD83C\uDF19 Slow Day spirit animals!'}
                  {formData.spiritAnimalMode === 'weekly' && 'All 7 days have a spirit animal! 📅'}
                </p>
              )}
            </div>
            )
          })()}

          {/* Step 7: Personalize — view & interaction preferences */}
          {currentId === 'personalize' && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Palette className="w-6 h-6 text-cyan-600" />
                <h2 className="text-2xl font-bold text-slate-800">Personalize your experience</h2>
              </div>
              <p className="text-slate-600 mb-6">
                This helps us tailor how the app looks and feels for you. Every mode is still a
                fun, gamified checklist, this just tunes how much visual energy we add. All optional.
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
                  Why we ask: this tunes how much detail the interface shows. If apps
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
                      <div className="text-xs text-slate-600 leading-tight mt-0.5">{o.hint}</div>
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
                      // Prefill the account's email when turning on.
                      contact: !formData.reminders.enabled && !formData.reminders.contact
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
                  <div className="mt-4">
                    {/* When, and by email or text (components/ReminderFields). */}
                    <ReminderFields value={formData.reminders} onChange={updateReminders} />
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-600 mt-4">
                You can fine-tune placement, size, and colors later in Settings and on each screen.
              </p>
            </div>
          )}

          {/* Navigation Buttons (the chat has its own) */}
          <div className="flex flex-wrap justify-between items-center mt-8 pt-6 border-t border-slate-200">
            {!(chatMode && !inExtras) && (<>
            <button
              onClick={handleBack}
              disabled={currentStep === 0}
              className="flex items-center gap-2 px-4 py-3 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 hover:text-slate-900 disabled:invisible transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
              Back
            </button>

            <div className="flex flex-wrap items-center justify-end gap-3">
              {/* In the extras the path can be created at any point: everything
                  required was answered in the first two steps. */}
              {inExtras && requiredDone && (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="px-2 py-3 text-sm font-medium text-indigo-800 underline underline-offset-2 hover:text-indigo-950 disabled:text-slate-600"
                >
                  Create my path now
                </button>
              )}
              {skippableSteps.has(currentId) && currentStep < steps.length - 1 && (
                <button
                  onClick={handleSkip}
                  className="px-4 py-3 text-sm font-medium text-slate-700 hover:text-slate-900 underline underline-offset-2 transition-all"
                >
                  Skip for now
                </button>
              )}
              {/* End of the short start: the extras are offered, not required. */}
              {currentStep === CORE_STEP_COUNT - 1 && (
                <button
                  type="button"
                  onClick={() => setCurrentStep(CORE_STEP_COUNT)}
                  disabled={isSubmitting}
                  className="px-2 py-3 text-sm font-medium text-indigo-800 underline underline-offset-2 hover:text-indigo-950 disabled:text-slate-600"
                >
                  Add more details first (optional)
                </button>
              )}

              {currentStep === CORE_STEP_COUNT - 1 || currentStep === steps.length - 1 ? (
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
                  Continue
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}
            </div>

            {continueHint() && (
              <p id="continue-hint" className="mt-3 w-full text-right text-sm text-slate-700" role="status">
                {continueHint()}
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
          {inExtras
            ? <>Optional extra {currentStep - CORE_STEP_COUNT + 1} of {steps.length - CORE_STEP_COUNT}</>
            : <>Step {currentStep + 1} of {CORE_STEP_COUNT}</>}
        </div>

        {/* Need a break? (Riipen Labs, Group 11: "Your progress is saved ...
            Send an email reminder if the user shared an email.") The draft is
            kept in this browser (AUTOSAVE_KEY). The email is sent only when
            asked for here, once, by the daily send (app/api/cron/reminders). */}
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
                Email me a reminder tomorrow
              </button>
            )}
            {setupReminder === 'asked' && (
              <p role="status" className="mt-1">
                We&apos;ll send one email to {user?.email} tomorrow morning, and nothing else.{' '}
                <button type="button" onClick={cancelSetupReminder} className="font-medium text-indigo-800 underline underline-offset-2 hover:text-indigo-950">
                  Don&apos;t send it
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
