import { ExternalLink } from 'lucide-react'
import { platformOf } from '@/lib/community/tidbits'

/**
 * For a rated commentary that isn't ours (the Tidbits round's planning note,
 * Goal 10: 'Add links to original commentaries for any rated commentaries
 * that aren't ours, as a field called "Read the article here" ... also "See
 * more from (original platform) here"'). The article's own address, from its
 * source link or its website.
 */
export default function OriginalArticle({
  resource,
}: {
  resource: { category: string; source_url?: string | null; contact_info?: { website?: string | null } | null }
}) {
  if (resource.category !== 'commentary') return null
  const url = resource.source_url || resource.contact_info?.website || null
  if (!url || !/^https?:\/\//.test(url)) return null
  const platform = platformOf(url)
  return (
    <p className="flex flex-wrap gap-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm">
      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-blue-800 underline underline-offset-2">
        Read the article here <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
      {platform && (
        <a href={platform.home} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-blue-800 underline underline-offset-2">
          See more from {platform.name} here <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      )}
    </p>
  )
}
