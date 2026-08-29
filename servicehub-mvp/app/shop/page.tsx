import Link from 'next/link'
import { Star, Plus, ShoppingBag, LayoutGrid } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { createClient } from '@/lib/supabase/server'
import { listProducts, listProductCategories } from '@/lib/shop/queries'
import { formatPrice, type Product } from '@/types/shop'
import { imageOrPlaceholder } from '@/lib/images/placeholder'
import { SHOP_CATEGORIES, shopCategory } from '@/lib/shop/categories'

export const dynamic = 'force-dynamic'

function ProductCard({ product, preview = false }: { product: Product; preview?: boolean }) {
  const img = product.image_urls[0]
  // Preview products have no detail page, so render a plain card (no link).
  const Wrapper: any = preview ? 'div' : Link
  const wrapperProps = preview ? {} : { href: `/shop/${product.id}` }
  return (
    <Wrapper
      {...wrapperProps}
      className="group block rounded-2xl border border-gray-200 bg-white overflow-hidden hover:shadow-md transition-all"
    >
      <div className="aspect-square bg-gray-50 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageOrPlaceholder(img, product.name, product.category)}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          loading="lazy"
        />
      </div>
      <div className="p-3">
        <div className="text-sm font-medium text-gray-900 line-clamp-2">{product.name}</div>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-sm font-bold text-purple-700">{formatPrice(product.price, product.currency)}</span>
          {product.compare_at_price != null && product.compare_at_price > product.price && (
            <span className="text-xs text-gray-400 line-through">
              {formatPrice(product.compare_at_price, product.currency)}
            </span>
          )}
        </div>
        {(product.rating_count ?? 0) > 0 && (
          <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
            <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" aria-hidden="true" />
            {product.rating_avg?.toFixed(1)} ({product.rating_count})
          </div>
        )}
      </div>
    </Wrapper>
  )
}

/**
 * Sample products for ?preview=1 — a design preview so the grid can be judged
 * before real products exist. Rendered client-side only and NEVER written to
 * the database; the real catalog stays submission-only.
 */
function previewProducts(): Product[] {
  const now = new Date().toISOString()
  const base = {
    description: null, compare_at_price: null, currency: 'CAD', image_urls: [] as string[],
    variations: [], sensory_details: {}, stock: null, seller: null,
    status: 'active' as const, submitted_by: null, created_at: now, updated_at: now,
  }
  return [
    { ...base, id: 'preview-1', name: 'Loop Experience Earplugs', category: 'self-care', price: 34, compare_at_price: 45, rating_avg: 4.5, rating_count: 24 },
    { ...base, id: 'preview-2', name: 'Weighted Blanket', category: 'self-care', price: 89, rating_avg: 4.8, rating_count: 12 },
    { ...base, id: 'preview-3', name: 'Fidget Cube Set', category: 'toys', price: 18, compare_at_price: 25, rating_avg: 4.2, rating_count: 31 },
    { ...base, id: 'preview-4', name: 'Seamless Cotton Tee', category: 'clothing', price: 28, rating_avg: 4.6, rating_count: 8 },
    { ...base, id: 'preview-5', name: 'Unmasking Autism', category: 'books', price: 22, rating_avg: 4.9, rating_count: 57 },
    { ...base, id: 'preview-6', name: 'Visual Timer', category: 'supplies', price: 31, compare_at_price: 40, rating_avg: 4.4, rating_count: 19 },
    { ...base, id: 'preview-7', name: 'Chewable Pencil Toppers', category: 'supplies', price: 12, rating_avg: 4.1, rating_count: 15 },
    { ...base, id: 'preview-8', name: 'Sensory Art Kit', category: 'crafts', price: 45, rating_avg: 4.7, rating_count: 6 },
  ]
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: { category?: string; preview?: string }
}) {
  const category = searchParams.category
  const isPreview = searchParams.preview === '1'

  const [realProducts, realCategories] = await Promise.all([
    listProducts({ category }),
    listProductCategories(),
  ])

  const previewAll = isPreview ? previewProducts() : []
  const products = isPreview
    ? (category ? previewAll.filter((p) => p.category === category) : previewAll)
    : realProducts
  const categories = isPreview
    ? Array.from(new Set(previewAll.map((p) => p.category))).sort()
    : realCategories

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ShoppingBag className="w-6 h-6 text-purple-600" aria-hidden="true" /> Shop
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Sensory-friendly products — filter by category, open a product for details and reviews.
            </p>
          </div>
          {user && (
            <Link
              href="/shop/new"
              className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" aria-hidden="true" /> Add product
            </Link>
          )}
        </div>

        {/* Preview-mode banner — makes it unmistakable this is sample data */}
        {isPreview && (
          <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-sm text-amber-900">
              <strong>Design preview.</strong> These are sample products with generated images — nothing here is saved to the catalog.
            </p>
            <Link href="/shop" className="text-xs font-semibold text-amber-800 hover:underline whitespace-nowrap">
              Exit preview
            </Link>
          </div>
        )}

        {/* Category chips — icon on the left of each, matching the navbar
            (Odosa). Every known category shows even when nothing is filed under
            it yet, so "Apps & Programs" is discoverable before the first app is
            added; a category present in the data but not in our list still
            renders, with a neutral icon. */}
        {(() => {
          const known = SHOP_CATEGORIES.map((c) => c.id)
          const shown = [...known, ...categories.filter((c) => !known.includes(c))]
          return (
            <div className="flex flex-wrap gap-2 mb-6">
              <Link
                href={isPreview ? '/shop?preview=1' : '/shop'}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  !category ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                <LayoutGrid className="w-4 h-4 shrink-0" aria-hidden="true" />
                All
              </Link>
              {shown.map((c) => {
                const meta = shopCategory(c)
                const Icon = meta.icon
                return (
                  <Link
                    key={c}
                    href={`/shop?category=${encodeURIComponent(c)}${isPreview ? '&preview=1' : ''}`}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      category === c ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                    {meta.label}
                  </Link>
                )
              })}
            </div>
          )
        })()}

        {products.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-16 px-4 text-center">
            <ShoppingBag className="w-10 h-10 text-gray-300 mx-auto mb-3" aria-hidden="true" />
            <p className="text-gray-600 font-medium">No products yet.</p>
            <p className="text-sm text-gray-500 mt-1">
              {user ? 'Be the first to add one.' : 'Sign in to add the first product.'}
            </p>
            <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
              {user && (
                <Link
                  href="/shop/new"
                  className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" /> Add product
                </Link>
              )}
              <Link
                href="/shop?preview=1"
                className="inline-flex items-center gap-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium"
              >
                See a design preview
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} preview={isPreview} />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
