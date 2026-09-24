import { EyeOff } from 'lucide-react'

/**
 * Shown when a tab holds saved/rated rows whose resource we are not allowed
 * to read.
 *
 * `saved_resources` and `ratings` are readable whenever they are yours, but
 * `resources` is only readable while it is approved (or you submitted it).
 * The two disagree the moment something you already saved goes back under
 * review or is taken down, and the join returns null.
 *
 * Those rows are dropped server-side, because there is genuinely nothing to
 * render for a resource we cannot read. Dropping them without saying so would
 * mean a wishlist quietly losing an item -- which is exactly the kind of thing
 * that makes a person stop trusting their own saved list. So we say it plainly,
 * and we say it is temporary, because it usually is: nothing has been deleted
 * and the item comes back on its own if the resource is approved again.
 */
export default function UnavailableNotice({ count }: { count: number }) {
  if (!count || count < 1) return null

  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <EyeOff className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <p>
        {count === 1 ? '1 item is' : `${count} items are`} hidden right now because{' '}
        {count === 1 ? 'it is' : 'they are'} under review or no longer listed. Nothing has been
        removed from your list — {count === 1 ? 'it' : 'they'} will reappear if{' '}
        {count === 1 ? 'it becomes' : 'they become'} available again.
      </p>
    </div>
  )
}
