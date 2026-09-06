'use client'

import { useMemo } from 'react'
import { format, isSameDay, isSameMonth, isToday } from 'date-fns'
import { monthGridDays, occurrencesInRange, type CalendarTask } from '@/lib/calendarModel'

/**
 * Month overview on real dates.
 *
 * Deliberately shows at most three tasks per cell plus a "+N more" count
 * rather than shrinking text until a busy day is unreadable — the point of a
 * month view is scanning, and this app's users are the last people who should
 * be handed a wall of 4px type.
 */
export default function MonthGrid({
  tasks,
  month,
  onSelectDay,
  onSelectTask,
}: {
  tasks: CalendarTask[]
  month: Date
  onSelectDay?: (date: Date) => void
  onSelectTask?: (task: CalendarTask) => void
}) {
  const days = useMemo(() => monthGridDays(month), [month])
  const occurrences = useMemo(
    () => occurrencesInRange(tasks, days[0], days[days.length - 1]),
    [tasks, days]
  )

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="px-2 py-2 text-center text-[11px] font-bold text-slate-500 uppercase">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayOccs = occurrences.filter((o) => isSameDay(o.date, day))
          const inMonth = isSameMonth(day, month)
          const shown = dayOccs.slice(0, 3)
          const extra = dayOccs.length - shown.length

          return (
            // A div, not a button: the task chips inside are themselves
            // buttons, and nesting a button inside a button is invalid HTML —
            // which is why these chips could not be made clickable before.
            <div
              key={day.toISOString()}
              className={`text-left min-h-[92px] border-b border-r border-slate-100 p-1.5 align-top ${
                inMonth ? '' : 'bg-slate-50/60'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectDay?.(day)}
                title="Open this week"
                className={`inline-grid place-items-center w-6 h-6 rounded-full text-xs font-bold mb-1 transition-colors hover:ring-2 hover:ring-cyan-300 ${
                  isToday(day)
                    ? 'bg-cyan-600 text-white'
                    : inMonth
                    ? 'text-slate-700'
                    : 'text-slate-300'
                }`}
              >
                {format(day, 'd')}
              </button>

              <div className="space-y-0.5">
                {shown.map((occ) => (
                  <button
                    key={`${occ.task.id}-${day.toISOString()}`}
                    type="button"
                    onClick={() => onSelectTask?.(occ.task)}
                    title={`${occ.task.name} — open`}
                    className={`block w-full text-left text-[9px] leading-tight truncate rounded px-1 py-0.5 transition-opacity hover:opacity-80 ${
                      occ.task.completed
                        ? 'bg-slate-100 text-slate-400 line-through'
                        : occ.recurring
                        ? 'bg-violet-100 text-violet-800'
                        : 'bg-cyan-100 text-cyan-800'
                    }`}
                  >
                    {occ.task.name}
                  </button>
                ))}
                {extra > 0 && (
                  <button
                    type="button"
                    onClick={() => onSelectDay?.(day)}
                    className="text-[9px] text-slate-400 px-1 hover:text-slate-600"
                  >
                    +{extra} more
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
