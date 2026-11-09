'use client'

import Link from 'next/link'
import { aboutAnswer, type AnswerSource, type Safety } from '@/lib/aiSafety'

/**
 * The label under every AI answer in a chat (the assistant, My agents): that AI wrote it, with which model, and,
 * opened, "About this answer": whether the safety check read it (only when it did), what was hidden from the AI, and
 * that AI can be wrong and isn't medical, legal or clinical advice (lib/aiSafety.ts, aboutAnswer). One label, the same
 * everywhere, instead of a different sentence on each page.
 */
export default function AiNote({ source, safety, className = '' }: { source: AnswerSource; safety: Safety | null; className?: string }) {
  const who = source.onDevice ? 'your own model' : source.model
  return (
    <details className={`mt-1 text-xs text-slate-600 ${className}`}>
      <summary className="cursor-pointer select-none rounded py-1 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600">
        Written by AI{who ? ` · ${who}` : ''} · <span className="underline underline-offset-2">About this answer</span>
      </summary>
      <div className="mt-1 max-w-prose space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-700">
        {aboutAnswer(source, safety).map((line) => <p key={line}>{line}</p>)}
        <p>
          <Link href="/help#ai-safety" className="font-medium text-indigo-800 underline underline-offset-2">How the safety check works</Link>
        </p>
      </div>
    </details>
  )
}
