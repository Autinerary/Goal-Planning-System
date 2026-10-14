'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import { TERMS, type TermId } from '@/lib/terms'

/**
 * A word the app uses, with its meaning one tap away, beside it (lib/terms.ts;
 * Riipen Labs, Groups 16, 17 and 19: "path", "milestone" and "norms" were
 * never explained where they appear). The word is a button: tapping it opens
 * the meaning under it, tapping again closes it. `ask` shows the question
 * ("What is a path?") instead of the word, for a line of its own.
 */
export default function Define({ term, children, ask = false, className = '' }: { term: TermId; children?: React.ReactNode; ask?: boolean; className?: string }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const t = TERMS[term]
  return (
    <span className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        className={ask
          ? 'font-medium text-indigo-800 underline underline-offset-2 hover:text-indigo-950'
          : 'font-medium text-inherit underline decoration-dotted decoration-2 underline-offset-4 hover:text-indigo-900'}
      >
        {ask ? t.question : (children ?? t.word)}
      </button>
      {open && (
        <span id={id} role="note" className="mt-1 mb-1 block rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-normal text-slate-800">
          {t.short}{' '}
          <Link href={t.glossary} className="font-medium text-indigo-800 underline underline-offset-2">More in What things are called</Link>
        </span>
      )}
    </span>
  )
}
