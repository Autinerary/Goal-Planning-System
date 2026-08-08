import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Star } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import ProductPurchasePanel from '@/components/shop/ProductPurchasePanel'
import { getProduct, getProductReviews } from '@/lib/shop/queries'
import { formatPrice } from '@/types/shop'
import { imageOrPlaceholder } from '@/lib/images/placeholder'

export const dynamic = 'force-dynamic'

const SENSORY_LABELS: { key: string; label: string }[] = [
  { key: 'texture', label: 'Texture' },
  { key: 'sound', label: 'Sound' },
  { key: 'visual', label: 'Visual' },
  { key: 'material', label: 'Material' },
]

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const product = await getProduct(params.id)
  if (!product) notFound()
  const reviews = await getProductReviews(product.id)

  const sensory = SENSORY_LABELS.filter((s) => product.sensory_details?.[s.key])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Link href="/shop" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back to Shop
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Images */}
          <div>
            <div className="aspect-square rounded-2xl bg-white border border-gray-200 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageOrPlaceholder(product.image_urls[0], product.name, product.category)}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>
            {product.image_urls.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {product.image_urls.slice(1).map((u, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={u} alt="" className="w-16 h-16 rounded-lg object-cover border border-gray-200 flex-shrink-0" />
                ))}
              </div>
            )}
          </div>

          {/* Info + purchase panel */}
          <div>
            {product.seller && <div className="text-xs text-gray-500 mb-1">{product.seller}</div>}
            <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
            {(product.rating_count ?? 0) > 0 && (
              <div className="mt-1 flex items-center gap-1 text-sm text-gray-600">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" aria-hidden="true" />
                {product.rating_avg?.toFixed(1)} ({product.rating_count} ratings)
              </div>
            )}
            <div className="mt-3 flex items-center gap-3">
              <span className="text-2xl font-bold text-purple-700">{formatPrice(product.price, product.currency)}</span>
              {product.compare_at_price != null && product.compare_at_price > product.price && (
                <span className="text-base text-gray-400 line-through">
                  {formatPrice(product.compare_at_price, product.currency)}
                </span>
              )}
            </div>

            <div className="mt-5">
              <ProductPurchasePanel product={product} />
            </div>

            {product.description && (
              <div className="mt-6">
                <h2 className="text-sm font-semibold text-gray-900 mb-1">Product Description</h2>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{product.description}</p>
              </div>
            )}

            {sensory.length > 0 && (
              <div className="mt-6">
                <h2 className="text-sm font-semibold text-gray-900 mb-2">Sensory Details</h2>
                <dl className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                  {sensory.map((s) => (
                    <div key={s.key} className="flex items-center justify-between px-3 py-2 text-sm">
                      <dt className="text-gray-500">{s.label}</dt>
                      <dd className="text-gray-900 font-medium">{product.sensory_details[s.key]}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        </div>

        {/* Reviews */}
        <section className="mt-10">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Reviews</h2>
          {reviews.length === 0 ? (
            <p className="text-sm text-gray-500">No reviews yet.</p>
          ) : (
            <div className="space-y-3">
              {reviews.map((r) => (
                <div key={r.id} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-center gap-1 mb-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={`w-4 h-4 ${n <= r.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                  {r.comment && <p className="text-sm text-gray-700">{r.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  )
}
