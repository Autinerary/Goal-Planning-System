'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Map, Flag, Milestone, CalendarDays, CheckSquare, GitCompare } from 'lucide-react'
import { useDisclosure } from '@/lib/disclosure'

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
// /paths/compare is included so the bar (and the Compare toggle) show there too.
const FLOW_PREFIXES = ['/path', '/races', '/milestones', '/calendar', '/tasks', '/paths/compare']

export default function ViewTabs() {
  const pathname = usePathname()
  const { isSimple } = useDisclosure()
  if (!pathname) return null

  const onFlowRoute = FLOW_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))
  if (!onFlowRoute) return null

  const activeIndex = TABS.findIndex((t) => pathname === t.href || pathname.startsWith(t.href + '/'))
  const visibleTabs = TABS.filter(tab => !isSimple || ['/path', '/calendar', '/tasks'].includes(tab.href) || pathname === tab.href || pathname.startsWith(tab.href + '/'))

  return (
    <div className="border-b border-white/50 surface-veil">
      <div className="max-w-5xl mx-auto px-2 sm:px-4">
        <nav className="flex items-center gap-1 overflow-x-auto py-2 no-scrollbar" aria-label="Section navigation">
          {visibleTabs.map((tab, i) => {
            const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/')
            const isDone = activeIndex > -1 && TABS.indexOf(tab) < activeIndex
            return (
              <div key={tab.href} className="flex items-center flex-shrink-0">
                <Link
                  href={tab.href}
                  data-info={`Opens ${tab.label}: ${tab.href === '/path' ? 'your overall plan and next milestone' : tab.href === '/calendar' ? 'your scheduled activities' : tab.href === '/tasks' ? 'your individual actions' : 'a detailed view of your plan'}.`}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow'
                      : isDone
                        ? 'text-slate-700 hover:bg-white/70'
                        : 'text-slate-500 hover:bg-white/70'
                  }`}
                >
                  <tab.Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </Link>
                {i < visibleTabs.length - 1 && (
                  <span className="mx-0.5 text-slate-300 select-none" aria-hidden="true">›</span>
                )}
              </div>
            )
          })}

          {/* Compare — its own toggle, separated from the linear flow (Odosa) */}
          {(!isSimple || pathname.startsWith('/paths/compare')) && <>
          <span className="mx-1 h-4 w-px bg-slate-300 flex-shrink-0" aria-hidden="true" />
          <Link
            href="/paths/compare"
            aria-current={pathname.startsWith('/paths/compare') ? 'page' : undefined}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap flex-shrink-0 ${
              pathname.startsWith('/paths/compare')
                ? 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow'
                : 'text-slate-500 hover:bg-white/70'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>Compare</span>
          </Link>
          </>}
        </nav>
      </div>
    </div>
  )
}
