'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Hammer } from 'lucide-react'

/**
 * A friendly placeholder for features/links that aren't built yet (Liam: add an
 * "Under Construction" page so users don't think they clicked the wrong link).
 * Pass ?feature=<name> to name what's coming.
 */
function UnderConstructionContent() {
  const router = useRouter()
  const params = useSearchParams()
  const feature = params.get('feature')

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto w-20 h-20 rounded-2xl bg-amber-100 flex items-center justify-center mb-6">
          <Hammer className="w-10 h-10 text-amber-500" />
        </div>
        <div className="text-5xl mb-4">🚧</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          {feature ? `${feature} is under construction` : 'Under construction'}
        </h1>
        <p className="text-slate-600 mb-8">
          You’re in the right place — this part just isn’t ready yet. We’re building it and it’ll
          show up here soon. Thanks for your patience!
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border-2 border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> Go back
          </button>
          <Link
            href="/path"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold hover:shadow-lg transition-all"
          >
            Back to my Path
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function UnderConstructionPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-500">Loading…</div>}>
      <UnderConstructionContent />
    </Suspense>
  )
}
