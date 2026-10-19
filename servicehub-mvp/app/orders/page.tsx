import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Package } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { createClient } from '@/lib/supabase/server'
import { formatPrice } from '@/types/shop'
import StartReturn from './StartReturn'

export const dynamic = 'force-dynamic'

const STATUS: Record<string, string> = { processing: 'Paid, waiting to ship', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled and refunded', returned: 'Returned' }

/** Your orders (the products round, Goal 9): what you bought through ResourceHub, its status, tracking, and starting a return. */
export default async function OrdersPage({ searchParams }: { searchParams: { done?: string } }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/orders')
  const { data: orders } = await supabase.from('orders').select('id, status, total, currency, created_at, tracking_url, seller:vendor_user_id').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)
  const ids = (orders || []).map((o: any) => o.id)
  const { data: items } = ids.length ? await supabase.from('order_items').select('order_id, name, quantity, price').in('order_id', ids) : { data: [] as any[] }
  const { data: returns } = ids.length ? await supabase.from('order_returns').select('order_id, status').in('order_id', ids) : { data: [] as any[] }
  const returned = new Set((returns || []).map((r: any) => r.order_id))
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Package className="h-6 w-6 text-blue-700" aria-hidden="true" /> Your orders
        </h1>
        {searchParams.done === '1' && <p role="status" className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-gray-900">Thank you! Your order is paid; it shows here in a moment, and the seller ships it.</p>}
        {(orders || []).length === 0 ? (
          <p className="mt-4 text-gray-800">
            No orders yet.{' '}
            <Link href="/shop" className="font-medium text-blue-800 underline underline-offset-2">
              The shop
            </Link>
          </p>
        ) : (
          <ul className="mt-6 space-y-4">
            {(orders || []).map((o: any) => (
              <li key={o.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="font-semibold text-gray-900">
                  {new Date(o.created_at).toLocaleDateString('en-CA', { day: 'numeric', month: 'long', year: 'numeric' })} · {formatPrice(Number(o.total), o.currency)} · {STATUS[o.status] || o.status}
                </p>
                <ul className="mt-1 text-sm text-gray-800">
                  {(items || [])
                    .filter((i: any) => i.order_id === o.id)
                    .map((i: any, n: number) => (
                      <li key={n}>
                        {i.quantity} × {i.name}
                      </li>
                    ))}
                </ul>
                {o.tracking_url && (
                  <a href={o.tracking_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sm font-medium text-blue-800 underline underline-offset-2">
                    Track it
                  </a>
                )}
                {(o.status === 'shipped' || o.status === 'delivered') && !returned.has(o.id) && <StartReturn orderId={o.id} />}
                {returned.has(o.id) && <p className="mt-1 text-sm text-gray-800">A return is started; the seller will tell you what to do.</p>}
              </li>
            ))}
          </ul>
        )}
      </main>
      <Footer />
    </div>
  )
}
