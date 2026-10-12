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

// What each tab is, for Help (data-info). Races and Milestones used to share
// "a detailed view of your plan" (Riipen Labs, Groups 34 and 36).
const TABS = [
  { href: '/path', label: 'Path', Icon: Map, info: 'your overall plan and your next step' },
  { href: '/races', label: 'Races', Icon: Flag, info: 'each goal as a race, made of small steps called milestones' },
  { href: '/milestones', label: 'Milestones', Icon: Milestone, info: 'every small step of your races, in one list' },
  { href: '/calendar', label: 'Calendar', Icon: CalendarDays, info: 'your week, with lighter or fuller days to choose from' },
  { href: '/tasks', label: 'Task', Icon: CheckSquare, info: "today's small things to do" },
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
        {/* "Your plan": these are the pages of your plan, apart from the app's
            menu above (Riipen Labs, Group 32: no clear difference between the
            primary menu and the secondary navigation). */}
        <nav className="flex items-center gap-1 overflow-x-auto py-2 no-scrollbar" aria-label="Your plan">
          <span className="mr-1 shrink-0 text-xs font-bold uppercase tracking-wide text-slate-700" aria-hidden="true">Your plan</span>
          {visibleTabs.map((tab, i) => {
            const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/')
            const isDone = activeIndex > -1 && TABS.indexOf(tab) < activeIndex
            return (
              <div key={tab.href} className="flex items-center flex-shrink-0">
                <Link
                  href={tab.href}
                  data-info={`Opens ${tab.label}: ${tab.info}.`}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow'
                      : isDone
                        ? 'text-slate-700 hover:bg-white/70'
                        : 'text-slate-700 hover:bg-white/70'
                  }`}
                >
                  <tab.Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </Link>
                {i < visibleTabs.length - 1 && (
                  <span className="mx-0.5 text-slate-600 select-none" aria-hidden="true">›</span>
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
                : 'text-slate-700 hover:bg-white/70'
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
