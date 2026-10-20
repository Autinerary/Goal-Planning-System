/**
 * The marks AI image tools leave in a file (the team's notes, October 2026:
 * Visuals is for real art, "No to AI-generated art or visuals").
 *
 * Looks for: the IPTC "trained algorithmic media" source type that Content
 * Credentials (C2PA) and XMP carry (OpenAI, Adobe Firefly, Google and others
 * write it); the settings Stable Diffusion front ends save in a PNG
 * ("Negative prompt", "CFG scale", ComfyUI's prompt and workflow, InvokeAI);
 * and the tools' own names in the metadata. A file without these can still
 * be AI-made (screenshots and re-saves drop them), so the artist's two
 * statements and the team's review stay the real check; this only stops the
 * plain cases at the door.
 */

const MARKS: { needle: string; what: string }[] = [
  { needle: 'trainedalgorithmicmedia', what: 'Content Credentials say an AI model made it' },
  { needle: 'negative prompt', what: 'Stable Diffusion settings are saved in it' },
  { needle: 'cfg scale', what: 'Stable Diffusion settings are saved in it' },
  { needle: 'sd-metadata', what: 'Stable Diffusion settings are saved in it' },
  { needle: 'invokeai_metadata', what: 'InvokeAI settings are saved in it' },
  { needle: '"class_type"', what: 'A ComfyUI workflow is saved in it' },
  { needle: 'comfyui', what: 'A ComfyUI workflow is saved in it' },
  { needle: 'automatic1111', what: 'Stable Diffusion settings are saved in it' },
  { needle: 'stable diffusion', what: 'It names Stable Diffusion' },
  { needle: 'stablediffusion', what: 'It names Stable Diffusion' },
  { needle: 'midjourney', what: 'It names Midjourney' },
  { needle: 'dall-e', what: 'It names DALL-E' },
  { needle: 'dallÂ·e', what: 'It names DALL-E' },
  { needle: 'novelai', what: 'It names NovelAI' },
  { needle: 'adobe firefly', what: 'It names Adobe Firefly' },
  { needle: 'ideogram', what: 'It names Ideogram' },
  { needle: 'leonardo.ai', what: 'It names Leonardo.Ai' },
  { needle: 'bing image creator', what: 'It names Bing Image Creator' },
  { needle: 'nightcafe', what: 'It names NightCafe' },
]

export interface AiCheck {
  /** True when the file carries an AI tool's mark. */
  ai: boolean
  /** What was found, in plain words. */
  found: string[]
}

/** Checks a file's bytes for the marks above. */
export function checkForAiMarks(bytes: Uint8Array): AiCheck {
  // Latin-1 keeps every byte as one character, so text in the metadata reads
  // as itself whatever the image data around it is.
  let text = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) text += String.fromCharCode(...Array.from(bytes.subarray(i, i + CHUNK)))
  const lower = text.toLowerCase()
  const found = Array.from(new Set(MARKS.filter((m) => lower.includes(m.needle)).map((m) => m.what)))
  return { ai: found.length > 0, found }
}

/** The image types Visuals takes, by their first bytes (never by the name a browser sends). */
export function imageKind(bytes: Uint8Array): 'png' | 'jpg' | 'webp' | 'gif' | null {
  const b = bytes
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png'
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg'
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp'
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'gif'
  return null
}
