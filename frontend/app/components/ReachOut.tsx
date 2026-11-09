'use client'

import { useId, useState } from 'react'
import { REACH_OUT_MESSAGE, reachOutMailHref, reachOutSmsHref } from '@/lib/crisis'

const buttonClass = 'rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-amber-100'

/**
 * "Message someone you trust", in the crisis card (app/components/CrisisLines): words to start with, which the person
 * can change, then send from their own phone or email to whoever they choose. Writing the first words is often the
 * hardest part (9 November 2026: the adult version of a supervisor being told, and only ever their choice).
 * Autinerary doesn't send it, see it or keep it.
 */
export default function ReachOut({ headingLevel = 3 }: { headingLevel?: 3 | 4 }) {
  const H = headingLevel === 4 ? 'h4' : 'h3'
  const id = useId()
  const [message, setMessage] = useState(REACH_OUT_MESSAGE)
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }
  return (
    <div className="mt-3 border-t border-amber-200 pt-3">
      <H className="text-sm font-semibold text-slate-900">Or message someone you trust</H>
      <p className="mt-1 text-sm text-slate-800">The first words are often the hardest. Here are some you can send, or change:</p>
      <label htmlFor={id} className="sr-only">A message to someone you trust</label>
      <textarea id={id} value={message} onChange={(e) => { setMessage(e.target.value); setCopied(false) }} rows={2} maxLength={500}
        className="mt-2 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-slate-900" />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <a href={reachOutSmsHref(message)} className={buttonClass}>Text it</a>
        <a href={reachOutMailHref(message)} className={buttonClass}>Email it</a>
        <button type="button" onClick={copy} className={buttonClass}>Copy it</button>
        <span role="status" className="text-sm text-slate-800">{copied ? 'Copied.' : ''}</span>
      </div>
      <p className="mt-1 text-xs text-slate-700">It goes from your phone or email, to whoever you choose. Autinerary doesn’t send it or keep it.</p>
    </div>
  )
}
