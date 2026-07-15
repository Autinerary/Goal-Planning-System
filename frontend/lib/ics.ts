// iCalendar (.ics) import / export helpers.
//
// These let users move their schedule between the Goal-Planning calendar and
// external calendars (Google Calendar, Outlook, Apple Calendar, etc.), which all
// speak the RFC 5545 .ics format.

export interface IcsTask {
  day: string // weekday name, e.g. "Monday"
  time: string // "HH:MM" (24h) or "H:MM"
  name: string
  duration?: string // e.g. "30 min", "1 hr"
  priority?: string
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Minutes from a free-text duration like "30 min", "1 hr", "1 hr 30 min". Defaults to 30. */
function durationToMinutes(duration?: string): number {
  if (!duration) return 30
  const text = duration.toLowerCase()
  let minutes = 0
  const hr = text.match(/(\d+(?:\.\d+)?)\s*(?:hr|hour|h)/)
  const min = text.match(/(\d+)\s*(?:min|m)\b/)
  if (hr) minutes += Math.round(parseFloat(hr[1]) * 60)
  if (min) minutes += parseInt(min[1], 10)
  if (!hr && !min) {
    const bare = text.match(/(\d+)/)
    if (bare) minutes = parseInt(bare[1], 10)
  }
  return minutes || 30
}

/** Date for the given weekday within the current week (Monday-based), preserving H:MM. */
function dateForWeekday(dayName: string, time: string): Date {
  const now = new Date()
  const targetDow = WEEKDAYS.indexOf(dayName)
  const base = new Date(now)
  if (targetDow >= 0) {
    const currentDow = now.getDay()
    const diff = targetDow - currentDow
    base.setDate(now.getDate() + diff)
  }
  const [h, m] = (time || '09:00').split(':').map((n) => parseInt(n, 10))
  base.setHours(isNaN(h) ? 9 : h, isNaN(m) ? 0 : m, 0, 0)
  return base
}

/** RFC 5545 local-time stamp: YYYYMMDDTHHMMSS. */
function formatDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  )
}

/** Escape special chars per RFC 5545 (backslash, comma, semicolon, newline). */
function escapeText(text: string): string {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** Build a downloadable .ics document from calendar tasks. */
export function buildIcs(tasks: IcsTask[], calendarName = 'My Journey'): string {
  const now = new Date()
  const stamp = formatDate(now)
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Goal Planning System//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
  ]

  tasks.forEach((task, i) => {
    const start = dateForWeekday(task.day, task.time)
    const end = new Date(start.getTime() + durationToMinutes(task.duration) * 60000)
    const uid = `${stamp}-${i}-${Math.random().toString(36).slice(2, 8)}@goal-planning`
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${formatDate(start)}`,
      `DTEND:${formatDate(end)}`,
      `SUMMARY:${escapeText(task.name)}`,
    )
    if (task.priority) {
      lines.push(`DESCRIPTION:${escapeText(`Priority: ${task.priority}`)}`)
    }
    lines.push('END:VEVENT')
  })

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

/** Trigger a browser download of the given .ics content. */
export function downloadIcs(content: string, filename = 'my-journey.ics'): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Unescape RFC 5545 text values. */
function unescapeText(text: string): string {
  return text
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
}

/** Parse an .ics date value (basic or with TZ) into a JS Date, or null. */
function parseIcsDate(value: string): Date | null {
  // Strip any parameters already handled by caller; value like 20260715T140000Z or 20260715T140000
  const m = value.match(/(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?(\d{2})?(Z)?/)
  if (!m) return null
  const [, y, mo, d, h, mi, s, z] = m
  if (z) {
    return new Date(
      Date.UTC(+y, +mo - 1, +d, h ? +h : 0, mi ? +mi : 0, s ? +s : 0),
    )
  }
  return new Date(+y, +mo - 1, +d, h ? +h : 0, mi ? +mi : 0, s ? +s : 0)
}

/**
 * Parse an .ics document into calendar tasks. Unfolds wrapped lines, reads
 * SUMMARY/DTSTART/DTEND, and derives weekday + time from DTSTART.
 */
export function parseIcs(content: string): IcsTask[] {
  // Unfold: lines beginning with a space or tab continue the previous line.
  const unfolded = content.replace(/\r?\n[ \t]/g, '')
  const lines = unfolded.split(/\r?\n/)

  const tasks: IcsTask[] = []
  let inEvent = false
  let summary = ''
  let start: Date | null = null
  let end: Date | null = null

  for (const raw of lines) {
    const line = raw.trim()
    if (line === 'BEGIN:VEVENT') {
      inEvent = true
      summary = ''
      start = null
      end = null
      continue
    }
    if (line === 'END:VEVENT') {
      if (summary && start) {
        let duration = '30 min'
        if (end) {
          const mins = Math.max(5, Math.round((end.getTime() - start.getTime()) / 60000))
          duration = mins >= 60 && mins % 60 === 0 ? `${mins / 60} hr` : `${mins} min`
        }
        tasks.push({
          day: WEEKDAYS[start.getDay()],
          time: `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`,
          name: summary,
          duration,
        })
      }
      inEvent = false
      continue
    }
    if (!inEvent) continue

    const idx = line.indexOf(':')
    if (idx === -1) continue
    const rawKey = line.slice(0, idx)
    const value = line.slice(idx + 1)
    const key = rawKey.split(';')[0].toUpperCase()

    if (key === 'SUMMARY') summary = unescapeText(value)
    else if (key === 'DTSTART') start = parseIcsDate(value)
    else if (key === 'DTEND') end = parseIcsDate(value)
  }

  return tasks
}
