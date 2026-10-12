import { CRISIS_LINES, NOT_A_CRISIS_SERVICE, OAP_URGENT } from '@/lib/crisis'

const linkClass = 'font-medium text-indigo-800 underline underline-offset-2'

/**
 * "Help right now": the crisis lines, free and at any time (lib/crisis.ts).
 * Shown when someone picks "Help right now" in setup or Start here (Riipen
 * Labs, Group 24: "Immediate Need: ... Crisis Support"), and on the glossary's
 * "Talk to someone now". `ontario` adds the Ontario Autism Program's urgent
 * response services, for parents.
 */
export default function CrisisLines({ ontario = false, heading = 'Help right now', headingLevel = 2, className = '' }: {
  ontario?: boolean
  heading?: string
  headingLevel?: 2 | 3
  className?: string
}) {
  const H = headingLevel === 3 ? 'h3' : 'h2'
  const lines = [...CRISIS_LINES, ...(ontario ? [OAP_URGENT] : [])]
  return (
    <section aria-label={heading} className={`rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-left ${className}`}>
      <H className="text-lg font-bold text-slate-900">{heading}</H>
      <p className="mt-1 text-sm text-slate-800">If things are really hard right now, you don&apos;t have to work it out alone. These are free:</p>
      <ul className="mt-2 space-y-1.5 text-sm text-slate-900">
        {lines.map((l) => (
          <li key={l.name}>
            <strong>{l.name}:</strong> {l.how.replace(/\.$/, '')}{' '}
            <a href={`tel:${l.tel}`} className={linkClass}>Call now</a>.
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-slate-700">{NOT_A_CRISIS_SERVICE}</p>
    </section>
  )
}
