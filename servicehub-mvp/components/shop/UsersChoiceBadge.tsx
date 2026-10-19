import { Users } from 'lucide-react'

/**
 * Users' Choice (STEP 82): the item rated highest in its category by one
 * type of user. Shown beside Community's Choice, in a calmer colour, with
 * who chose it.
 */
export default function UsersChoiceBadge({ label, detail, size = 'sm' }: { label: string; detail?: string; size?: 'sm' | 'md' }) {
  return (
    <span
      title={detail}
      className={`inline-flex items-center gap-1 rounded-full bg-sky-50 font-semibold text-sky-900 ring-1 ring-sky-300 ${size === 'md' ? 'px-3 py-1 text-sm' : 'px-2.5 py-0.5 text-xs'}`}
    >
      <Users className={size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5'} aria-hidden="true" />
      Users&apos; Choice<span className="font-normal">· {label.replace(/^Top rated by /, '')}</span>
    </span>
  )
}
