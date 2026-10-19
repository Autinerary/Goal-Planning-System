'use client'

import { useState } from 'react'

/** Start a return (the products round, Goal 9): the seller is told, and arranges it. */
export default function StartReturn({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  if (state === 'done') return <p className="mt-2 text-sm text-gray-900">Return started. The seller will tell you what to do.</p>
  return open ? (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        setState('busy')
        const res = await fetch('/api/shop/returns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ order_id: orderId, reason }) }).catch(() => null)
        setState(res?.ok ? 'done' : 'error')
      }}
      className="mt-2 space-y-2"
    >
      <label className="block text-sm font-medium text-gray-900">
        Why (optional)
        <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900" />
      </label>
      {state === 'error' && <p className="text-sm text-red-800">Could not start that.</p>}
      <button type="submit" disabled={state === 'busy'} className="rounded-lg border border-gray-400 px-3 py-1.5 text-sm font-semibold text-gray-900 hover:bg-gray-50">
        Start the return
      </button>
    </form>
  ) : (
    <button type="button" onClick={() => setOpen(true)} className="mt-2 text-sm font-medium text-blue-800 underline underline-offset-2">
      Start a return
    </button>
  )
}
