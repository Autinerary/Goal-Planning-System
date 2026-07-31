'use client'

import { useState } from 'react'
import { Minus, Plus, ShoppingCart } from 'lucide-react'
import { showToast } from '@/lib/toast'
import type { Product, SelectedVariation } from '@/types/shop'

/**
 * Variation + quantity selectors for a product. Add-to-cart itself is wired in
 * the cart/checkout phase; for now the button is honest that checkout is coming
 * rather than faking an order.
 */
export default function ProductPurchasePanel({ product }: { product: Product }) {
  const [selected, setSelected] = useState<SelectedVariation>(() => {
    const init: SelectedVariation = {}
    for (const v of product.variations) if (v.options[0]) init[v.name] = v.options[0]
    return init
  })
  const [qty, setQty] = useState(1)

  const outOfStock = product.stock != null && product.stock <= 0

  const addToCart = () => {
    // Phase 2 wires this to POST /api/shop/cart. Until then, be transparent
    // rather than fake an order.
    showToast.info('Cart & checkout are coming in the next update.')
  }

  return (
    <div className="space-y-4">
      {product.variations.map((v) => (
        <div key={v.name}>
          <div className="text-sm font-medium text-gray-900 mb-1.5">{v.name}</div>
          <div className="flex flex-wrap gap-2">
            {v.options.map((opt) => {
              const active = selected[v.name] === opt
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setSelected((s) => ({ ...s, [v.name]: opt }))}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    active
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-purple-400'
                  }`}
                  aria-pressed={active}
                >
                  {opt}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {/* Quantity */}
      <div>
        <div className="text-sm font-medium text-gray-900 mb-1.5">Quantity</div>
        <div className="inline-flex items-center rounded-lg border border-gray-300 overflow-hidden">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="p-2 hover:bg-gray-50"
            aria-label="Decrease quantity"
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="w-10 text-center text-sm font-medium">{qty}</span>
          <button
            type="button"
            onClick={() => setQty((q) => (product.stock != null ? Math.min(product.stock, q + 1) : q + 1))}
            className="p-2 hover:bg-gray-50"
            aria-label="Increase quantity"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={addToCart}
        disabled={outOfStock}
        className="w-full inline-flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-3 rounded-xl font-medium transition-colors"
      >
        <ShoppingCart className="w-4 h-4" aria-hidden="true" />
        {outOfStock ? 'Out of stock' : 'Add to cart'}
      </button>
    </div>
  )
}
