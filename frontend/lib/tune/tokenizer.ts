/**
 * Qwen3's tokenizer (byte-level BPE, from its tokenizer.json) and chat template, in the browser, so a training set
 * becomes tokens on the person's device (lib/tune/run.ts). Qwen's merges are in token order (merge i makes token
 * 256 + i), so @jax-js/loaders' rank-by-id BPE gives the same tokens as Hugging Face's (checked on 1 November 2026
 * against Python's for a training set and prompts, thinking and not).
 */
import { tokenizers } from '@jax-js/loaders'

/** GPT-2's map from the printable characters in tokenizer.json back to bytes. */
function byteDecoder(): Map<string, number> {
  const bytes: number[] = []
  for (let i = 33; i <= 126; i++) bytes.push(i)
  for (let i = 161; i <= 172; i++) bytes.push(i)
  for (let i = 174; i <= 255; i++) bytes.push(i)
  const chars = [...bytes]
  let extra = 0
  for (let b = 0; b < 256; b++) if (!bytes.includes(b)) { bytes.push(b); chars.push(256 + extra++) }
  return new Map(chars.map((c, i) => [String.fromCodePoint(c), bytes[i]]))
}

export class QwenTokenizer {
  readonly #encoding: tokenizers.BpeEncoding
  readonly special: Record<string, number>

  constructor(data: any) {
    if (data?.model?.type !== 'BPE') throw new Error('not a BPE tokenizer')
    const decode = byteDecoder()
    const encoder = new Map<string, number>()
    for (const [piece, id] of Object.entries<number>(data.model.vocab)) {
      let hex = ''
      for (const ch of piece) {
        const b = decode.get(ch)
        if (b === undefined) throw new Error(`not a byte-level piece: ${piece}`)
        hex += b.toString(16).padStart(2, '0')
      }
      encoder.set(hex, id)
    }
    // Added tokens (<|im_start|>, <think>, ...) are matched as whole strings, never split.
    this.special = Object.fromEntries((data.added_tokens as { id: number; content: string }[]).map((t) => [t.content, t.id]))
    const split = data.pre_tokenizer.pretokenizers[0]
    // JavaScript has no inline (?i:...); it only covers the contractions, so the whole pattern takes the i flag.
    const pattern = String(split.pattern.Regex).replace(/^\(\?i:([^)]*)\)/, '(?:$1)')
    this.#encoding = new tokenizers.BpeEncoding(encoder, this.special, new RegExp(pattern, 'giu'))
  }

  encode(text: string): number[] {
    return this.#encoding.encodeWithSpecialTokens(text.normalize('NFC'))
  }

  decode(ids: number[]): string {
    return this.#encoding.decode(ids)
  }
}

export type Message = { role: 'system' | 'user' | 'assistant'; content: string }

/** Qwen3's chat template for a plain conversation. With thinking off, an empty thinking block comes first, as the
 *  template writes it; the person's answers are learned that way, so the model still thinks when asked to. */
export function chatText(messages: Message[], opts: { generationPrompt: boolean; thinking: boolean }): string {
  let text = ''
  const lastUser = messages.map((m) => m.role).lastIndexOf('user')
  messages.forEach((m, i) => {
    if (m.role === 'assistant' && i > lastUser) text += `<|im_start|>assistant\n<think>\n\n</think>\n\n${m.content.trim()}<|im_end|>\n`
    else text += `<|im_start|>${m.role}\n${m.content}<|im_end|>\n`
  })
  if (opts.generationPrompt) text += opts.thinking ? '<|im_start|>assistant\n' : '<|im_start|>assistant\n<think>\n\n</think>\n\n'
  return text
}

/** One training example: its tokens, and where the answer starts (the loss is on the answer and its <|im_end|>). */
export function trainingExample(tok: QwenTokenizer, messages: Message[]): { ids: number[]; start: number } {
  const prompt = chatText(messages.slice(0, -1), { generationPrompt: true, thinking: false })
  const full = chatText(messages, { generationPrompt: false, thinking: false }).replace(/\n$/, '')
  if (!full.startsWith(prompt)) throw new Error('the conversation must end with the answer')
  return { ids: tok.encode(full), start: tok.encode(prompt).length }
}
