import { ExternalLink } from 'lucide-react'
import data from '@/lib/pathResources.json'

interface Resource {
  title: string
  url: string
  what: string
  kind: string
  where?: string
}

const PATHS = data.paths as Record<string, Resource[]>

const CHECKED = new Date(`${data.checked}T12:00:00Z`).toLocaleDateString('en-CA', { month: 'long', year: 'numeric', timeZone: 'UTC' })

/** A Path Market category's checked resources, by its key ('med-sci'), or none. */
export const pathResources = (categoryKey: string | null | undefined): Resource[] => (categoryKey && PATHS[categoryKey]) || []

/**
 * Resources for a Path Market path (feedback, 31 August: "Consider adding
 * specific resources based on what is entered, e.g. medicine-specific
 * resources (application process, tuition, CASPer or MCAT prep) or
 * university (course scheduling, navigation)"). Official pages, each checked
 * on its own site (lib/pathResources.json, built from .qa-local/pathways);
 * the ones for one province or city say so.
 */
export default function PathResources({ categoryKey, heading = 'Resources for this path' }: { categoryKey: string | null | undefined; heading?: string }) {
  const list = pathResources(categoryKey)
  if (!list.length) return null
  return (
    <section aria-label={heading} data-path-resources={categoryKey} className="mt-4">
      <h3 className="text-sm font-semibold text-slate-900">{heading}</h3>
      <ul className="mt-2 space-y-2">
        {list.map((r) => (
          <li key={r.url} className="rounded-lg border border-slate-200 bg-white p-3">
            <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-1 text-sm font-semibold text-cyan-800 underline underline-offset-2">
              {r.title}
              <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
            {r.where && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{r.where}</span>}
            <p className="mt-1 text-sm text-slate-700">{r.what}</p>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-slate-600">Checked on each organization&apos;s own site, {CHECKED}. Dates and amounts change, so check the page before you rely on them.</p>
    </section>
  )
}
