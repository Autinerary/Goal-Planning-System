'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, X } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { showToast } from '@/lib/toast'
import { PRODUCT_CATEGORIES } from '@/types/shop'

export default function NewProductPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [category, setCategory] = useState<string>(PRODUCT_CATEGORIES[0])
  const [price, setPrice] = useState('')
  const [compareAt, setCompareAt] = useState('')
  const [description, setDescription] = useState('')
  const [seller, setSeller] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [sensory, setSensory] = useState({ texture: '', sound: '', visual: '', material: '' })
  const [variationsText, setVariationsText] = useState('') // "Size: S, M, L\nColor: Black, White"
  const [submitting, setSubmitting] = useState(false)

  const addImage = () => {
    const u = imageUrl.trim()
    if (/^https?:\/\//i.test(u) && !imageUrls.includes(u)) setImageUrls([...imageUrls, u])
    setImageUrl('')
  }

  const parseVariations = () =>
    variationsText
      .split('\n')
      .map((line) => {
        const [nameP, optsP] = line.split(':')
        if (!nameP || !optsP) return null
        return {
          name: nameP.trim(),
          options: optsP.split(',').map((o) => o.trim()).filter(Boolean),
        }
      })
      .filter((v): v is { name: string; options: string[] } => !!v && v.options.length > 0)

  const submit = async () => {
    if (submitting) return
    if (name.trim().length < 2 || !price) {
      showToast.error('Name and price are required.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/shop/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          category,
          price: Number(price),
          compare_at_price: compareAt ? Number(compareAt) : undefined,
          description: description.trim(),
          seller: seller.trim(),
          image_urls: imageUrls,
          sensory_details: sensory,
          variations: parseVariations(),
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || 'Failed to create product')
      showToast.success('Product added!')
      router.push(`/shop/${json.id}`)
    } catch (e: any) {
      showToast.error(e.message || 'Failed to create product')
    } finally {
      setSubmitting(false)
    }
  }

  const input = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/shop" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back to Shop
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Add a product</h1>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Name</label>
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Loop Experience Earplugs" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Category</label>
              <select className={input} value={category} onChange={(e) => setCategory(e.target.value)}>
                {PRODUCT_CATEGORIES.map((c) => (
                  <option key={c} value={c} className="capitalize">{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Seller (optional)</label>
              <input className={input} value={seller} onChange={(e) => setSeller(e.target.value)} placeholder="Brand / store" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Price</label>
              <input type="number" min="0" step="0.01" className={input} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="34.00" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Compare-at price (optional)</label>
              <input type="number" min="0" step="0.01" className={input} value={compareAt} onChange={(e) => setCompareAt(e.target.value)} placeholder="45.00" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Description</label>
            <textarea className={input} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          {/* Images */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Image URLs</label>
            <div className="flex gap-2">
              <input className={input} value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addImage())} />
              <button type="button" onClick={addImage} className="px-3 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"><Plus className="w-4 h-4" /></button>
            </div>
            {imageUrls.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {imageUrls.map((u) => (
                  <span key={u} className="inline-flex items-center gap-1 text-xs bg-gray-100 rounded-full pl-2 pr-1 py-1 max-w-[220px]">
                    <span className="truncate">{u}</span>
                    <button type="button" onClick={() => setImageUrls(imageUrls.filter((x) => x !== u))}><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Sensory details */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Sensory details (optional)</label>
            <div className="grid grid-cols-2 gap-3">
              {(['texture', 'sound', 'visual', 'material'] as const).map((k) => (
                <input key={k} className={input} value={sensory[k]} onChange={(e) => setSensory((s) => ({ ...s, [k]: e.target.value }))} placeholder={k[0].toUpperCase() + k.slice(1)} />
              ))}
            </div>
          </div>

          {/* Variations */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Variations (optional)</label>
            <textarea className={input} rows={2} value={variationsText} onChange={(e) => setVariationsText(e.target.value)} placeholder={'Size: S, M, L\nColor: Black, White'} />
            <p className="text-xs text-gray-500 mt-1">One per line, e.g. <code>Size: S, M, L</code></p>
          </div>

          <button
            onClick={submit}
            disabled={submitting}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-3 rounded-xl font-medium"
          >
            {submitting ? 'Adding…' : 'Add product'}
          </button>
        </div>
      </main>
      <Footer />
    </div>
  )
}
