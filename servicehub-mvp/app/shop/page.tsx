import Link from 'next/link'
import { Star, Plus, ShoppingBag, LayoutGrid, Check, Search } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { createClient } from '@/lib/supabase/server'
import { listProducts, type ProductSort } from '@/lib/shop/queries'
import { formatPrice, type Product } from '@/types/shop'
import { imageOrPlaceholder } from '@/lib/images/placeholder'
import { SHOP_GROUPS, SHOP_CATEGORIES, canonicalCategory, shopCategory, shopGroup } from '@/lib/shop/categories'
import { qualitiesForGroup, qualitiesOf, SHARED_CORE, isQuality, qualityLabel } from '@/lib/shop/qualities'
import { usersChoiceFor, type UsersChoice } from '@/lib/shop/usersChoice'
import CommunityChoiceBadge from '@/components/communityChoice/CommunityChoiceBadge'
import UsersChoiceBadge from '@/components/shop/UsersChoiceBadge'
import FilterPanel from '@/components/shop/FilterPanel'
import { CHECKOUT_ON } from '@/lib/shop/selling'

export const dynamic = 'force-dynamic'

const SORTS: { id: ProductSort; label: string }[] = [
  { id: 'category', label: 'By category' },
  { id: 'for_you', label: 'Matches what you like' },
  { id: 'rating', label: 'Highest rated' },
  { id: 'price_asc', label: 'Price: low to high' },
  { id: 'price_desc', label: 'Price: high to low' },
  { id: 'newest', label: 'Newest' },
  { id: 'name', label: 'Name' },
]

function ProductCard({ product, choice }: { product: Product; choice: UsersChoice[] }) {
  const img = product.image_urls?.[0]
  const qualities = qualitiesOf(product.category, product.qualities || [])
  const shown = [...qualities.filter((q) => q.core && q.id !== 'sold_in_canada'), ...qualities.filter((q) => !q.core)].slice(0, 3)
  const tags = product.tags || []
  return (
    <Link href={`/shop/${product.id}`} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition-all hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
      <div className="aspect-[4/3] overflow-hidden bg-gray-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageOrPlaceholder(img, product.name, shopCategory(product.category).label)}
          alt=""
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
          loading="lazy"
        />
      </div>
      <div className="flex flex-1 flex-col p-3">
        <div className="text-sm font-semibold text-gray-900 line-clamp-2">{product.name}</div>
        {product.brand && <div className="text-xs text-gray-700">{product.brand}</div>}
        <div className="mt-1 flex flex-wrap gap-1">
          {tags.includes('community_choice_year') && <CommunityChoiceBadge month="of the year" />}
          {tags.includes('community_choice') && !tags.includes('community_choice_year') && <CommunityChoiceBadge />}
          {choice.slice(0, 1).map((c) => (
            <UsersChoiceBadge key={c.userType} label={c.label} />
          ))}
        </div>
        {shown.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1" aria-label="What it's like">
            {shown.map((q) => (
              <li key={q.id} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-900">
                <Check className="h-3 w-3" aria-hidden="true" />
                {q.label}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="text-sm font-bold text-gray-900">{formatPrice(product.price, product.currency)}</span>
          {(product.rating_count ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-xs text-gray-700">
              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" aria-hidden="true" />
              {product.rating_avg?.toFixed(1)} ({product.rating_count})
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

/**
 * The shop (the team's planning note, products round, October 2026, Goals
 * 1, 3 and 4): products neurodivergent people and families recommend, each
 * checked on its maker's or seller's own pages, in 40 categories (11
 * groups), with the qualities people with norms need, filters for the core
 * ones, and sorting by category. Each says where to get it; once checkout
 * is on (Goal 9), some can be bought here from the vendor who sells them.
 */
export default async function ShopPage({
  searchParams,
}: {
  searchParams: { group?: string; category?: string; q?: string; qualities?: string; sort?: string }
}) {
  const category = searchParams.category ? canonicalCategory(searchParams.category) : undefined
  const group = category ? shopCategory(category).group : shopGroup(searchParams.group || '')?.id
  const selected = (searchParams.qualities || '').split(',').filter(isQuality)
  const sort = (SORTS.some((s) => s.id === searchParams.sort) ? searchParams.sort : 'category') as ProductSort
  const query = (searchParams.q || '').slice(0, 80)

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  // "Matches what you like": the person's own likes and avoids (their profile; v1.5).
  let likes: string[] = []
  let avoids: string[] = []
  if (user && sort === 'for_you') {
    const { data: prefs } = await supabase.from('sensory_preferences').select('likes, avoids').eq('user_id', user.id).maybeSingle()
    likes = prefs?.likes || []
    avoids = prefs?.avoids || []
  }
  const products = await listProducts({ group, category, qualities: selected, query, sort, likes, avoids })
  const choice = await usersChoiceFor('product', products.map((p) => p.id))

  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams()
    const next = { group, category, q: query || undefined, qualities: selected.join(',') || undefined, sort: sort === 'category' ? undefined : sort, ...patch }
    for (const [k, v] of Object.entries(next)) if (v) p.set(k, v)
    const s = p.toString()
    return s ? `/shop?${s}` : '/shop'
  }
  const toggle = (id: string) => {
    const next = selected.includes(id) ? selected.filter((q) => q !== id) : [...selected, id]
    return href({ qualities: next.join(',') || undefined })
  }
  const filterQualities = group ? qualitiesForGroup(group, true) : SHARED_CORE
  const groupInfo = group ? shopGroup(group) : null
  // Where you are, for the phone's folded button: "Sensory › Sound · 2 filters".
  const where = [category ? `${groupInfo?.label} › ${shopCategory(category).label}` : groupInfo?.label || 'All', selected.length ? `${selected.length} filter${selected.length === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ')

  // Grouped by category when sorted by category (Goal 4: "sort functionality based on category of item").
  const sections =
    sort === 'category'
      ? SHOP_CATEGORIES.map((c) => ({ id: c.id, label: c.label, items: products.filter((p) => canonicalCategory(p.category) === c.id) }))
          .concat([{ id: 'other', label: 'Other', items: products.filter((p) => shopCategory(p.category).group === 'other') }])
          .filter((s) => s.items.length > 0)
      : [{ id: 'all', label: '', items: products }]

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
              <ShoppingBag className="h-6 w-6 text-blue-700" aria-hidden="true" /> Shop
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-gray-800">
              Products neurodivergent people and families recommend, with what each one is like. We checked each on its
              maker&apos;s or seller&apos;s own pages.{' '}
              {CHECKOUT_ON
                ? 'Each says where to get it, and some you can buy here from the vendor who sells them.'
                : 'ResourceHub doesn’t sell them: each says where to get it.'}
            </p>
          </div>
          {user && (
            <Link href="/shop/new" className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800">
              <Plus className="h-4 w-4" aria-hidden="true" /> Suggest a product
            </Link>
          )}
        </div>

        <form action="/shop" method="get" role="search" className="mb-6 flex flex-wrap gap-2">
          {group && <input type="hidden" name="group" value={group} />}
          {category && <input type="hidden" name="category" value={category} />}
          {selected.length > 0 && <input type="hidden" name="qualities" value={selected.join(',')} />}
          <label className="sr-only" htmlFor="shop-q">
            Search the shop
          </label>
          <input id="shop-q" name="q" defaultValue={query} placeholder="Search products, brands…" className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-gray-900" />
          <label className="sr-only" htmlFor="shop-sort">
            Sort
          </label>
          <select id="shop-sort" name="sort" defaultValue={sort} className="rounded-lg border border-gray-300 px-3 py-2 text-gray-900">
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800">
            <Search className="h-4 w-4" aria-hidden="true" /> Search
          </button>
        </form>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[16rem_1fr]">
          <aside aria-label="Categories and qualities">
            <FilterPanel where={where}>
              <div className="space-y-6">
                <nav aria-label="Categories">
                  <h2 className="mb-2 text-sm font-semibold text-gray-900">Categories</h2>
                  <ul className="space-y-1">
                    <li>
                      <Link href={href({ group: undefined, category: undefined, qualities: undefined })} aria-current={!group ? 'page' : undefined} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${!group ? 'bg-blue-700 text-white' : 'text-gray-800 hover:bg-gray-100'}`}>
                        <LayoutGrid className="h-4 w-4 shrink-0" aria-hidden="true" /> All
                      </Link>
                    </li>
                    {SHOP_GROUPS.map((g) => {
                      const Icon = g.icon
                      const open = group === g.id
                      return (
                        <li key={g.id}>
                          <Link href={href({ group: g.id, category: undefined, qualities: undefined })} aria-current={open && !category ? 'page' : undefined} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${open && !category ? 'bg-blue-700 text-white' : open ? 'font-semibold text-gray-900' : 'text-gray-800 hover:bg-gray-100'}`}>
                            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /> {g.label}
                          </Link>
                          {open && (
                            <ul className="ml-6 mt-1 space-y-0.5">
                              {SHOP_CATEGORIES.filter((c) => c.group === g.id).map((c) => (
                                <li key={c.id}>
                                  <Link href={href({ group: g.id, category: c.id })} aria-current={category === c.id ? 'page' : undefined} className={`block rounded px-2 py-1 text-sm ${category === c.id ? 'bg-blue-700 text-white' : 'text-gray-800 hover:bg-gray-100'}`}>
                                    {c.label}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </nav>

                <section aria-labelledby="qualities-heading">
                  <h2 id="qualities-heading" className="mb-1 text-sm font-semibold text-gray-900">
                    {groupInfo ? `What matters for ${groupInfo.label.toLowerCase()}` : 'What matters'}
                  </h2>
                  <p className="mb-2 text-xs text-gray-700">Show only products that are all of these.</p>
                  <ul className="flex flex-wrap gap-1.5 lg:flex-col lg:items-start">
                    {filterQualities.map((q) => {
                      const on = selected.includes(q.id)
                      return (
                        <li key={q.id}>
                          {/* A link (it changes the page), so its state is in its words, not aria-pressed (buttons only). */}
                          <Link href={toggle(q.id)} title={q.help} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm ${on ? 'border-emerald-700 bg-emerald-50 font-semibold text-emerald-900' : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50'}`}>
                            {on && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                            {q.label}
                            {on && <span className="sr-only"> (on)</span>}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                  {selected.length > 0 && (
                    <Link href={href({ qualities: undefined })} className="mt-2 inline-block text-sm font-medium text-blue-800 underline underline-offset-2">
                      Clear ({selected.map(qualityLabel).join(', ')})
                    </Link>
                  )}
                </section>
              </div>
            </FilterPanel>
          </aside>

          <div>
            {groupInfo && <p className="mb-4 text-sm text-gray-800">{groupInfo.description}</p>}
            {sort === 'for_you' && !likes.length && !avoids.length && (
              <p className="mb-4 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">
                {user ? (
                  <>
                    Tell us what you like and avoid on{' '}
                    <Link href="/profile" className="font-medium underline underline-offset-2">
                      your profile
                    </Link>
                    , and this puts what matches you first.
                  </>
                ) : (
                  'Sign in, and say what you like and avoid on your profile, to see what matches you first.'
                )}
              </p>
            )}
            {products.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white px-4 py-16 text-center">
                <ShoppingBag className="mx-auto mb-3 h-10 w-10 text-gray-300" aria-hidden="true" />
                <p className="font-medium text-gray-800">{selected.length || query ? 'Nothing matches all of that yet.' : 'Nothing here yet.'}</p>
                <p className="mt-1 text-sm text-gray-700">
                  {user ? 'Know something that works? Suggest it, and we check it before it goes up.' : 'Sign in to suggest a product.'}
                </p>
                {user && (
                  <Link href="/shop/new" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800">
                    <Plus className="h-4 w-4" aria-hidden="true" /> Suggest a product
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-8">
                <p className="text-sm text-gray-700" aria-live="polite">
                  {products.length} product{products.length === 1 ? '' : 's'}
                </p>
                {sections.map((s) => (
                  <section key={s.id} aria-labelledby={s.label ? `cat-${s.id}` : undefined}>
                    {s.label && (
                      <h2 id={`cat-${s.id}`} className="mb-3 text-lg font-semibold text-gray-900">
                        {s.label} <span className="text-sm font-normal text-gray-700">({s.items.length})</span>
                      </h2>
                    )}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {s.items.map((p) => (
                        <ProductCard key={p.id} product={p} choice={choice.get(p.id) || []} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
