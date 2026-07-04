'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Map, Flag, Milestone, CalendarDays, CheckSquare } from 'lucide-react'

/**
 * ViewTabs — the "Tabs flow" navigation across the five main screens.
 *
 * Lets the user jump straight to any section (Path → Races → Milestones →
 * Calendar → Task) instead of spamming the browser back button. Mounted once
 * in the root layout; it renders itself only on the flow routes.
 */

const TABS = [
  { href: '/path', label: 'Path', Icon: Map },
  { href: '/races', label: 'Races', Icon: Flag },
  { href: '/milestones', label: 'Milestones', Icon: Milestone },
  { href: '/calendar', label: 'Calendar', Icon: CalendarDays },
  { href: '/tasks', label: 'Task', Icon: CheckSquare },
] as const

// Routes where the flow bar should appear. /tasks/<id> also counts as "Task".
const FLOW_PREFIXES = ['/path', '/races', '/milestones', '/calendar', '/tasks']

export default function ViewTabs() {
  const pathname = usePathname()
  if (!pathname) return null

  const onFlowRoute = FLOW_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))
  if (!onFlowRoute) return null

  const activeIndex = TABS.findIndex((t) => pathname === t.href || pathname.startsWith(t.href + '/'))

  return (
    <div className="bg-white/50 backdrop-blur-md border-b border-white/50">
      <div className="max-w-5xl mx-auto px-2 sm:px-4">
        <nav className="flex items-center gap-1 overflow-x-auto py-2 no-scrollbar" aria-label="Section navigation">
          {TABS.map((tab, i) => {
            const isActive = i === activeIndex
            const isDone = activeIndex > -1 && i < activeIndex
            return (
              <div key={tab.href} className="flex items-center flex-shrink-0">
                <Link
                  href={tab.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white shadow'
                      : isDone
                        ? 'text-slate-700 hover:bg-white/70'
                        : 'text-slate-500 hover:bg-white/70'
                  }`}
                >
                  <tab.Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </Link>
                {i < TABS.length - 1 && (
                  <span className="mx-0.5 text-slate-300 select-none" aria-hidden="true">›</span>
                )}
              </div>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
