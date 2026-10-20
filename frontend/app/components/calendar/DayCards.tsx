'use client'

import { type ReactNode } from 'react'
import { format, isToday } from 'date-fns'
import { occurrencesInRange, minutesToTime, type CalendarTask } from '@/lib/calendarModel'
import { weekKey } from '@/lib/planTaskDone'
import { dateKey, themeLabel, type DayTheme } from '@/lib/dayTheme'
import type { DayForecast } from '@/lib/weather'

/**
 * The List View on real dates: one card for the Day, seven for the Week
 * (Odosa, October 2026: the Day, Week and Month toggle "all works as
 * expected"). Each date shows the plan's tasks for its weekday and anything
 * on that date, its weather if the forecast reaches it, and its theme.
 *
 * Plan tasks repeat every week and a tick counts for the week it was made
 * in (lib/planTaskDone.ts), so they can be ticked in this week, and earlier
 * or later weeks show what was done without changing it. Your own tasks tick
 * on any date.
 */

export interface TemplateDay {
  name: string
  theme?: string
  typeOfDay?: string
  motivation?: string
}

const WEATHER_ICON: Record<string, string> = { sunny: '☀️', grey: '☁️', rainy: '🌧️', snowy: '🌨️' }

/** 45 min, 1 hr, 1 hr 30 min. */
const lengthOf = (m: number) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} hr ${m % 60} min` : `${m / 60} hr`)

export default function DayCards({
  dates,
  tasks,
  templateDays,
  ownTaskIds,
  planDone,
  toggleTask,
  onOpen,
  renderIdentity,
  forecastFor,
  themes,
}: {
  dates: Date[]
  tasks: CalendarTask[]
  templateDays: TemplateDay[]
  /** Tasks people added themselves (their own completed flag). */
  ownTaskIds: Set<string>
  /** Plan tasks ticked: id -> the Monday of the week (lib/planTaskDone.ts). */
  planDone: Record<string, string> | undefined
  toggleTask: (id: string) => void
  onOpen: (task: CalendarTask) => void
  renderIdentity: (date: Date) => ReactNode
  forecastFor: (date: string) => DayForecast | null
  themes: Record<string, DayTheme>
}) {
  const thisWeek = weekKey(new Date())
  const single = dates.length === 1

  return (
    <div className={single ? '' : 'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3'} data-day-cards>
      {dates.map((date) => {
        const key = dateKey(date)
        const weekday = format(date, 'EEEE')
        const template = templateDays.find((d) => d.name === weekday)
        const occs = occurrencesInRange(tasks, date, date)
        const theme = themes[key] || null
        const weather = forecastFor(key)
        const week = weekKey(date)
        return (
          <article
            key={key}
            aria-labelledby={`day-${key}`}
            data-day={key}
            className={`rounded-xl border p-5 ${
              theme === 'sunny' ? 'border-amber-300 bg-amber-50/80' : theme === 'grey' ? 'border-slate-400 bg-slate-100/90' : 'border-slate-300 surface'
            } ${isToday(date) ? 'ring-2 ring-cyan-600 ring-offset-1' : ''}`}
          >
            <header className="mb-3 space-y-1.5 border-b border-slate-300 pb-3">
              <h3 id={`day-${key}`} className="flex flex-wrap items-baseline gap-x-2 text-xl font-bold text-slate-900">
                {weekday}
                <span className="text-base font-semibold text-slate-700">{format(date, 'd MMMM')}</span>
                {isToday(date) && <span className="rounded-full bg-cyan-700 px-2 py-0.5 text-xs font-semibold text-white">Today</span>}
              </h3>
              {(theme || weather) && (
                <p className="flex flex-wrap gap-2 text-xs">
                  {theme && (
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${theme === 'sunny' ? 'bg-amber-200 text-amber-950' : 'bg-slate-300 text-slate-900'}`} data-day-theme={theme}>
                      {theme === 'sunny' ? '☀️' : '☁️'} {themeLabel(theme)}
                    </span>
                  )}
                  {weather && (
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 font-medium text-sky-950" data-day-weather={weather.kind}>
                      <span aria-hidden="true">{WEATHER_ICON[weather.kind]}</span> {weather.label}
                      {weather.rainProbabilityPct >= 20 ? `, ${weather.rainProbabilityPct}% rain` : ''}
                    </span>
                  )}
                </p>
              )}
              {renderIdentity(date)}
              {template?.typeOfDay && <p className="text-sm italic text-purple-800">{template.typeOfDay}</p>}
              {template?.motivation && <p className="text-sm italic text-pink-800">&ldquo;{template.motivation}&rdquo;</p>}
            </header>

            {occs.length === 0 ? (
              <p className="text-sm text-slate-700">Nothing planned.</p>
            ) : (
              <ul className="space-y-2">
                {occs.map((occ) => {
                  const task = occ.task
                  const own = ownTaskIds.has(task.id)
                  // Your own tasks have their own flag; a plan task's tick is its week's.
                  const done = own ? Boolean(task.completed) : planDone?.[task.id] === week
                  const locked = !own && week !== thisWeek
                  return (
                    <li
                      key={`${task.id}-${key}`}
                      className={`flex items-center gap-3 rounded-lg border p-3 ${
                        task.priority === 'high' || task.priority === 'essential'
                          ? 'border-rose-300 bg-rose-50'
                          : occ.recurring
                          ? 'border-violet-200 bg-violet-50'
                          : 'border-cyan-300 bg-cyan-50'
                      } ${done ? 'opacity-70' : ''}`}
                    >
                      <input
                        type="checkbox"
                        className="h-5 w-5 shrink-0 cursor-pointer disabled:cursor-not-allowed"
                        aria-label={locked ? `Done: ${task.name} (ticked in its own week)` : `Done: ${task.name}`}
                        checked={done}
                        disabled={locked}
                        onChange={() => toggleTask(task.id)}
                      />
                      <button
                        type="button"
                        onClick={() => onOpen(task)}
                        className={`min-w-0 flex-1 text-left text-sm text-slate-900 hover:underline ${done ? 'line-through' : ''}`}
                      >
                        <span className="font-medium">{minutesToTime(occ.startMinutes)}</span> {task.name}
                        {task.source && <span className="ml-1 text-xs text-purple-800">(from {task.source})</span>}
                      </button>
                      {task.durationMinutes ? <span className="shrink-0 rounded bg-white/70 px-2 py-1 text-xs text-slate-700">{lengthOf(task.durationMinutes)}</span> : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </article>
        )
      })}
    </div>
  )
}
