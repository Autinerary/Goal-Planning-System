import { CRISIS_LINES, NOT_A_CRISIS_SERVICE, OAP_URGENT, smsHref, type CrisisLine } from '@/lib/crisis'
import ReachOut from './ReachOut'

const linkClass = 'font-medium text-indigo-800 underline underline-offset-2'

/** A group's own lines (STEP 102; app/components/useGroupLines), such as its campus counselling. */
export type GroupLines = { name: string; lines: CrisisLine[] }

function Line({ line }: { line: CrisisLine }) {
  return (
    <li>
      <strong>{line.name}:</strong> {line.how.replace(/\.$/, '')}
      {line.sms && <>{' '}<a href={smsHref(line.sms, line.smsBody)} className={linkClass}>Text now</a></>}
      {line.sms && line.tel && ' or'}
      {line.tel && <>{' '}<a href={`tel:${line.tel}`} className={linkClass}>Call now</a></>}.
    </li>
  )
}

/**
 * "Help right now": the crisis lines, free and at any time (lib/crisis.ts), with a text link first where a line takes
 * texts (many autistic people find a call the hardest way to reach out). Shown when someone picks "Help right now" in
 * setup or Start here (Riipen Labs, Group 24: "Immediate Need: ... Crisis Support"), on the glossary's "Talk to someone
 * now", and under an answer or a journal entry when the safety check thinks they may be at risk (backend
 * core/moderation.py). `ontario` adds the Ontario Autism Program's urgent response services, for parents; `groups` adds
 * the person's groups' own lines; `reachOut` adds "Message someone you trust" (app/components/ReachOut).
 */
export default function CrisisLines({ ontario = false, heading = 'Help right now', headingLevel = 2, className = '', groups = [], reachOut = false }: {
  ontario?: boolean
  heading?: string
  headingLevel?: 2 | 3
  className?: string
  groups?: GroupLines[]
  reachOut?: boolean
}) {
  const H = headingLevel === 3 ? 'h3' : 'h2'
  const lines = [...CRISIS_LINES, ...(ontario ? [OAP_URGENT] : [])]
  return (
    <section aria-label={heading} className={`rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-left ${className}`}>
      <H className="text-lg font-bold text-slate-900">{heading}</H>
      <p className="mt-1 text-sm text-slate-800">If things are really hard right now, you don&apos;t have to work it out alone. These are free:</p>
      <ul className="mt-2 space-y-1.5 text-sm text-slate-900">
        {lines.map((l) => <Line key={l.name} line={l} />)}
      </ul>
      {groups.filter((g) => g.lines.length).map((g) => (
        <div key={g.name} className="mt-3">
          <p className="text-sm font-semibold text-slate-900">From {g.name}:</p>
          <ul className="mt-1 space-y-1.5 text-sm text-slate-900">
            {g.lines.map((l) => <Line key={l.name} line={l} />)}
          </ul>
        </div>
      ))}
      {reachOut && <ReachOut headingLevel={headingLevel === 3 ? 4 : 3} />}
      <p className="mt-2 text-xs text-slate-700">{NOT_A_CRISIS_SERVICE}</p>
    </section>
  )
}
