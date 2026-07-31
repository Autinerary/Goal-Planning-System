import Link from 'next/link'
import { Star, Plus, ShoppingBag } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { createClient } from '@/lib/supabase/server'
import { listProducts, listProductCategories } from '@/lib/shop/queries'
import { formatPrice, type Product } from '@/types/shop'

export const dynamic = 'force-dynamic'

function ProductCard({ product }: { product: Product }) {
  const img = product.image_urls[0]
  return (
    <Link
      href={`/shop/${product.id}`}
      className="group block rounded-2xl border border-gray-200 bg-white overflow-hidden hover:shadow-md transition-all"
    >
      <div className="aspect-square bg-gray-50 flex items-center justify-center overflow-hidden">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
        ) : (
          <ShoppingBag className="w-10 h-10 text-gray-300" aria-hidden="true" />
        )}
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
    </Link>
  )
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: { category?: string }
}) {
  const category = searchParams.category
  const [products, categories] = await Promise.all([
    listProducts({ category }),
    listProductCategories(),
  ])

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

        {/* Category chips */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            <Link
              href="/shop"
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                !category ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              All
            </Link>
            {categories.map((c) => (
              <Link
                key={c}
                href={`/shop?category=${encodeURIComponent(c)}`}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border capitalize transition-colors ${
                  category === c ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {c}
              </Link>
            ))}
          </div>
        )}

        {products.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-16 px-4 text-center">
            <ShoppingBag className="w-10 h-10 text-gray-300 mx-auto mb-3" aria-hidden="true" />
            <p className="text-gray-600 font-medium">No products yet.</p>
            <p className="text-sm text-gray-500 mt-1">
              {user ? 'Be the first to add one.' : 'Sign in to add the first product.'}
            </p>
            {user && (
              <Link
                href="/shop/new"
                className="inline-flex items-center gap-2 mt-4 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                <Plus className="w-4 h-4" aria-hidden="true" /> Add product
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
