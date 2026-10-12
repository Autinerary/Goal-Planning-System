'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { recordPage } from '@/lib/navTrail'

/** Records each page visited in this tab, for Back buttons (lib/navTrail.ts). */
export default function NavTrail() {
  const pathname = usePathname()
  useEffect(() => { if (pathname) recordPage(pathname) }, [pathname])
  return null
}
