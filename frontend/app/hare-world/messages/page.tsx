import type { Metadata } from 'next'
import { Suspense } from 'react'
import Messages from './Messages'

export const metadata: Metadata = { title: 'Messages · Hare World · Autinerary' }

/** Messages with your people (app/hare-world/messages/Messages.tsx). */
export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 p-8 text-center text-slate-700">Loading…</div>}>
      <Messages />
    </Suspense>
  )
}
