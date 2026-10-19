import { ChefHat, Cloud, UserRound } from 'lucide-react'

/**
 * A Tidbits picture: the person's photo or first letter, wearing a chef's hat
 * (the Tidbits round's planning note: "Give each profile from the Onboarding
 * a Chef Hat"). The team's posts show the cloud from Autinerary's logo; an
 * anonymous Tidbit shows no one.
 */
export default function ChefAvatar({
  author,
  size = 'md',
}: {
  author: { pseudonym: string; avatar_url: string | null; team?: boolean; anonymous?: boolean }
  size?: 'sm' | 'md' | 'lg'
}) {
  const dims = { sm: 'h-7 w-7 text-xs', md: 'h-9 w-9 text-sm', lg: 'h-16 w-16 text-2xl' }[size]
  const hat = { sm: 'h-4 w-4 -top-2', md: 'h-5 w-5 -top-2.5', lg: 'h-7 w-7 -top-4' }[size]
  const colour = author.team ? 'bg-blue-700 text-white' : author.anonymous ? 'bg-gray-200 text-gray-700' : 'bg-amber-100 text-amber-900'
  return (
    <span className="relative inline-flex shrink-0" aria-hidden="true">
      <span className={`inline-flex ${dims} items-center justify-center overflow-hidden rounded-full font-semibold ${colour}`}>
        {author.team ? (
          <Cloud className="h-1/2 w-1/2" />
        ) : author.anonymous ? (
          <UserRound className="h-1/2 w-1/2" />
        ) : author.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={author.avatar_url} alt="" className="h-full w-full object-cover" />
        ) : (
          (author.pseudonym || '?').charAt(0).toUpperCase()
        )}
      </span>
      {!author.anonymous && <ChefHat className={`absolute left-1/2 ${hat} -translate-x-1/2 rounded-full bg-white p-px text-gray-800`} />}
    </span>
  )
}
