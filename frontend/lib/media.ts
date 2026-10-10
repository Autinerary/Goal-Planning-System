// Videos and audio Autinerary publishes (Riipen Labs, Group 11: an explainer
// video, a "how to use the app" video, and podcasts). Every item follows the
// rules in docs/voice.md: captions on by default, a transcript, nothing that
// plays by itself, 60 to 90 seconds for a video.
//
// The two videos are built by docs/media/make-videos.mjs from
// docs/media/videos.json, which also writes their transcripts here
// (mediaTranscripts.json), so the page always matches what is said.

import transcripts from './mediaTranscripts.json'

export interface MediaItem {
  id: string
  kind: 'video' | 'audio'
  title: string
  src: string
  /** WebVTT captions, shown by default. */
  captions?: string
  poster?: string
  seconds: number
  transcript: string[]
  /** Said next to the player, e.g. that the voice is an AI voice. */
  note?: string
}

const AI_VOICE = 'Narrated by an AI voice. Captions are on; you can turn them off in the player.'

function video(id: keyof typeof transcripts): MediaItem {
  const t = transcripts[id]
  return {
    id,
    kind: 'video',
    title: t.title,
    src: `/media/${id}.mp4`,
    captions: `/media/${id}.vtt`,
    poster: `/media/${id}.jpg`,
    seconds: t.seconds,
    transcript: t.transcript,
    note: AI_VOICE,
  }
}

/** The home page's explainer: what Autinerary is, in 90 seconds. */
export const EXPLAINER = video('what-is-autinerary')

/** After setup: how to use your Path, in a minute. */
export const HOW_TO = video('how-to-use-your-path')

/**
 * Podcast episodes for the home page's "Listen" section, which shows only when
 * there is at least one. Each needs an audio file in public/media, a written
 * transcript, and, for a lived-experience story, the teller's consent
 * (docs/beta/testimonials.md). About 10 minutes each (Group 11).
 */
export const EPISODES: MediaItem[] = []

/**
 * Recordings of shared stories, keyed by the story's id in public.stories
 * (Riipen Labs, Group 11: testimonials "in video, audio, and text ... in the
 * format each visitor prefers"). "In their words" shows the approved text and,
 * when there is a recording, a button to watch or listen. Record only with the
 * teller's consent for audio or video (docs/beta/testimonials.md), and only
 * once the story is published. Put the file and its captions in
 * public/media/stories/. Leave `transcript` empty when the recording says the
 * approved text word for word: the text on the card is then the transcript.
 */
export const STORY_RECORDINGS: Record<string, MediaItem> = {}

/** "1 minute", "1½ minutes", "10 minutes", for labels. */
export function lengthLabel(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} seconds`
  const halves = Math.round(seconds / 30)
  const minutes = Math.floor(halves / 2)
  return halves % 2 ? `${minutes}½ minutes` : `${minutes} minute${minutes === 1 ? '' : 's'}`
}
