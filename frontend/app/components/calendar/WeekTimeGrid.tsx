'use client'

import { useMemo, useRef, useState } from 'react'
import { format, isSameDay, isToday } from 'date-fns'
import {
  layoutDayColumn, minutesToTime, occurrencesInRange, toISODate, weekDays,
  type CalendarTask, type Occurrence,
} from '@/lib/calendarModel'

const PX_PER_MINUTE = 0.9
const SNAP_MINUTES = 15

interface WeekTimeGridProps {
  tasks: CalendarTask[]
  anchorDate: Date
  /** Hours shown. Outside this range events are still reachable via Day view. */
  startHour?: number
  endHour?: number
  onMove?: (taskId: string, newDateISO: string, newTime: string) => void
  onSelect?: (task: CalendarTask) => void
}

/**
 * Google-Calendar-style week grid: real dates across the top, hours down the
 * side, and every task drawn as a block positioned and sized by its actual
 * start time and duration.
 *
 * This is only possible now that tasks carry real dates and a numeric
 * duration — the old model had a weekday name and a display string like
 * "1 hr", which cannot place or size anything.
 *
 * Recurring tasks (the weekly template the agents generate) still appear on
 * every matching weekday, and are marked so it's clear they repeat rather
 * than being a one-off someone scheduled.
 */
export default function WeekTimeGrid({
  tasks,
  anchorDate,
  startHour = 6,
  endHour = 23,
  onMove,
  onSelect,
}: WeekTimeGridProps) {
  const days = useMemo(() => weekDays(anchorDate), [anchorDate])
  const gridStartMin = startHour * 60
  const gridEndMin = endHour * 60
  const gridHeight = (gridEndMin - gridStartMin) * PX_PER_MINUTE

  const occurrences = useMemo(
    () => occurrencesInRange(tasks, days[0], days[6]),
    [tasks, days]
  )

  const [drag, setDrag] = useState<{
    taskId: string
    dayIndex: number
    startMinutes: number
  } | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  // Where the pointer went down, and whether it has travelled far enough to
  // count as a drag. Without this a plain click fires onMove with the block's
  // CURRENT position — a pointless write that also silently converts a
  // recurring agent task into a dated one just by clicking it.
  const pressRef = useRef<{ x: number; y: number; moved: boolean; task: CalendarTask } | null>(null)

  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i)

  const beginDrag = (e: React.PointerEvent, occ: Occurrence, dayIndex: number) => {
    // Capture on the element receiving the events, or pointerup never fires
    // and the block is left stranded mid-drag.
    e.currentTarget.setPointerCapture(e.pointerId)
    pressRef.current = { x: e.clientX, y: e.clientY, moved: false, task: occ.task }
    if (onMove) {
      setDrag({ taskId: occ.task.id, dayIndex, startMinutes: occ.startMinutes })
    }
  }

  const moveDrag = (e: React.PointerEvent) => {
    const press = pressRef.current
    if (!press) return

    // 5px of slop, so a slightly shaky tap still opens the task rather than
    // nudging it a few minutes and saving.
    if (!press.moved && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 5) {
      press.moved = true
    }
    if (!press.moved || !drag || !bodyRef.current) return

    const rect = bodyRef.current.getBoundingClientRect()
    const colWidth = rect.width / 7

    const rawDay = Math.floor((e.clientX - rect.left) / colWidth)
    const dayIndex = Math.max(0, Math.min(6, rawDay))

    const rawMin = gridStartMin + (e.clientY - rect.top) / PX_PER_MINUTE
    const snapped = Math.round(rawMin / SNAP_MINUTES) * SNAP_MINUTES
    const startMinutes = Math.max(gridStartMin, Math.min(gridEndMin - SNAP_MINUTES, snapped))

    setDrag({ ...drag, dayIndex, startMinutes })
  }

  const endDrag = () => {
    const press = pressRef.current
    pressRef.current = null

    // A press that never travelled is a click: open the task. Only an actual
    // drag writes a new date/time.
    if (press && !press.moved) {
      setDrag(null)
      onSelect?.(press.task)
      return
    }
    if (drag) {
      onMove?.(drag.taskId, toISODate(days[drag.dayIndex]), minutesToTime(drag.startMinutes))
    }
    setDrag(null)
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      {/* Day headers — real dates, not just weekday names. */}
      <div className="grid border-b border-slate-200" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
        <div className="border-r border-slate-200" />
        {days.map((d) => (
          <div
            key={d.toISOString()}
            className={`px-2 py-2 text-center border-r border-slate-200 last:border-r-0 ${
              isToday(d) ? 'bg-cyan-50' : ''
            }`}
          >
            <div className="text-[11px] font-semibold text-slate-500 uppercase">{format(d, 'EEE')}</div>
            <div className={`text-lg font-bold ${isToday(d) ? 'text-cyan-700' : 'text-slate-800'}`}>
              {format(d, 'd')}
            </div>
          </div>
        ))}
      </div>

      <div className="relative overflow-y-auto" style={{ maxHeight: '60vh' }}>
        <div className="grid" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
          {/* Hour gutter */}
          <div className="border-r border-slate-200">
            {hours.map((h) => (
              <div
                key={h}
                className="text-[10px] text-slate-400 text-right pr-2 -translate-y-1.5"
                style={{ height: 60 * PX_PER_MINUTE }}
              >
                {format(new Date(2000, 0, 1, h), 'h a')}
              </div>
            ))}
          </div>

          {/* The 7 day columns, drawn as one surface so a drag can cross them */}
          <div
            ref={bodyRef}
            className="col-span-7 relative"
            style={{ height: gridHeight, touchAction: 'none' }}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            {/* Hour lines */}
            {hours.map((h, i) => (
              <div
                key={h}
                className="absolute left-0 right-0 border-t border-slate-100"
                style={{ top: i * 60 * PX_PER_MINUTE }}
              />
            ))}
            {/* Column separators */}
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 border-r border-slate-100"
                style={{ left: `${((i + 1) / 7) * 100}%` }}
              />
            ))}

            {days.map((day, dayIndex) => {
              const dayOccs = occurrences.filter((o) => isSameDay(o.date, day))
              const laid = layoutDayColumn(dayOccs)

              return laid.map((occ) => {
                const dragging = drag?.taskId === occ.task.id
                const effDay = dragging ? drag!.dayIndex : dayIndex
                const effStart = dragging ? drag!.startMinutes : occ.startMinutes

                const top = (effStart - gridStartMin) * PX_PER_MINUTE
                const height = Math.max(18, occ.durationMinutes * PX_PER_MINUTE)
                const colPct = 100 / 7
                const left = effDay * colPct + (occ.lane / occ.lanes) * colPct
                const width = colPct / occ.lanes

                return (
                  <button
                    key={`${occ.task.id}-${day.toISOString()}`}
                    type="button"
                    onPointerDown={(e) => beginDrag(e, occ, dayIndex)}
                    title={`${occ.task.name} · ${minutesToTime(effStart)}${occ.recurring ? ' · repeats weekly' : ''}${onSelect ? ' — click to open, drag to move' : ''}`}
                    className={`absolute text-left rounded-md px-1.5 py-1 overflow-hidden border transition-shadow ${
                      dragging ? 'shadow-lg z-20 opacity-90' : 'z-10 hover:shadow-md'
                    } ${
                      occ.task.completed
                        ? 'bg-slate-100 border-slate-300 text-slate-400 line-through'
                        : occ.task.priority === 'high' || occ.task.priority === 'essential'
                        ? 'bg-rose-100 border-rose-300 text-rose-900'
                        : occ.recurring
                        ? 'bg-violet-100 border-violet-300 text-violet-900'
                        : 'bg-cyan-100 border-cyan-300 text-cyan-900'
                    }`}
                    style={{
                      top, height,
                      left: `calc(${left}% + 2px)`,
                      width: `calc(${width}% - 4px)`,
                      cursor: onMove ? 'grab' : 'pointer',
                    }}
                  >
                    <span className="block text-[10px] font-bold leading-tight line-clamp-2">
                      {occ.task.name}
                    </span>
                    {height > 34 && (
                      <span className="block text-[9px] opacity-70">
                        {minutesToTime(effStart)}{occ.recurring ? ' · weekly' : ''}
                      </span>
                    )}
                  </button>
                )
              })
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
