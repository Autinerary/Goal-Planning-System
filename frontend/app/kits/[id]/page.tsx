import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { STARTER_KITS, starterKit } from '@/lib/starterKits'
import KitView from '../KitView'

export function generateStaticParams() {
  return STARTER_KITS.map((kit) => ({ id: kit.id }))
}

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  const kit = starterKit(params.id)
  return kit ? { title: `${kit.title} · Autinerary`, description: kit.summary } : {}
}

/** /kits/assessment and /kits/school: one starter kit for parents (lib/starterKits.ts). */
export default function KitPage({ params }: { params: { id: string } }) {
  const kit = starterKit(params.id)
  if (!kit) notFound()
  return <KitView kit={kit} />
}
