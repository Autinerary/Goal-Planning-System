/**
 * Hare World Social (the team's notes, October 2026: "Video-ify / social
 * media-ify the app"): at the end of a task or milestone, a photo or video and
 * a caption to remember it by, focused on the mess-ups and the beginning that
 * led to the end, not only the finish. They make up your Memories, and the
 * ones you share, the most cheered, the Reels feed. STEP 87 (moments,
 * moment_cheers, moment_reports, the private "moments" bucket).
 */

export type MomentKind = 'task' | 'milestone'
export type MomentVisibility = 'private' | 'friends' | 'everyone'
export type ReviewStatus = 'none' | 'pending' | 'approved' | 'rejected'

export interface MomentPerson {
  id: string
  name: string
  icon: string
  avatar_url: string | null
}

export interface Moment {
  id: string
  kind: MomentKind
  ref: string | null
  title: string
  caption: string | null
  media_url: string | null
  media_type: 'image' | 'video' | null
  visibility: MomentVisibility
  review_status: ReviewStatus
  hidden: boolean
  cheers: number
  cheered: boolean
  mine: boolean
  by: MomentPerson | null
  created_at: string
}

export const VISIBILITY: { id: MomentVisibility; label: string; hint: string }[] = [
  { id: 'private', label: 'Only me', hint: 'In your Memories. Nobody else sees it.' },
  { id: 'friends', label: 'My people', hint: 'Your connections, unless you share nothing with them.' },
  { id: 'everyone', label: 'Everyone in Hare World', hint: 'Shown on Hare World Social once the team has looked at it.' },
]

export const visibilityLabel = (v: MomentVisibility) => VISIBILITY.find((x) => x.id === v)?.label || v

/** Questions for the caption: the messy middle and the start, not only the finish. */
export const CAPTION_PROMPTS = [
  'What went wrong along the way, and what did you do next?',
  'How did it start? What was the very first small step?',
  'What would you tell someone who is just beginning this?',
  'What almost made you stop?',
]

export const MAX_VIDEO_BYTES = 50 * 1024 * 1024
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
export const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']

/** Recent cheers count most: a moment's cheers over its age, gently. */
export function trendingScore(cheers: number, createdAt: string | Date, now = Date.now()): number {
  const hours = Math.max(0, (now - new Date(createdAt).getTime()) / 3_600_000)
  return (cheers + 1) / Math.pow(hours + 2, 1.5)
}

/** Notes to your future self (STEP 87 future_notes). */
export type FutureNoteKind = 'note' | 'do_better' | 'keep_going' | 'remember_today'

export const NOTE_KINDS: { id: FutureNoteKind; label: string; starter: string }[] = [
  { id: 'do_better', label: 'Do better next time', starter: 'Next time, I want to…' },
  { id: 'keep_going', label: 'Keep doing good', starter: 'Keep going: today I…' },
  { id: 'remember_today', label: 'Remember today', starter: 'Today walked so that tomorrow could run: ' },
]

export const noteKindLabel = (k: FutureNoteKind) => (k === 'note' ? 'Quick note to self' : NOTE_KINDS.find((x) => x.id === k)?.label || k)

export interface FutureNote {
  id: string
  kind: FutureNoteKind
  body: string
  task_title: string | null
  show_after: string
  seen_at: string | null
  created_at: string
}

let socialCheck: Promise<boolean> | null = null
/**
 * Whether moments and notes to future you are switched on (STEP 87), asked
 * once per page load: until then, finishing a task doesn't offer "Capture
 * this moment" and the Task View has no "Stop for now".
 */
export function socialAvailable(): Promise<boolean> {
  if (!socialCheck) {
    socialCheck = fetch('/api/moments?scope=check', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { available: false }))
      .then((d) => d?.available === true)
      .catch(() => false)
  }
  return socialCheck
}
