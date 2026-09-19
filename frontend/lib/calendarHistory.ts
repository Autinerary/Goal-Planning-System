'use client'

import { useEffect, useRef, useState } from 'react'

export interface EditableCalendarTask {
  id: string
  name: string
  day: string
  time: string
  duration: string
  priority: string
  from?: string
  scheduledDate?: string | null
  durationMinutes?: number | null
  scenario?: string | null
  completed?: boolean
  completedAt?: string | null
}

export async function syncCalendarChange(before: EditableCalendarTask[], after: EditableCalendarTask[], request: typeof fetch = fetch) {
  const previous = new Map(before.map(task => [task.id, task]))
  const next = new Map(after.map(task => [task.id, task]))
  const write = async (id: string, task?: EditableCalendarTask) => {
    const response = await request(task ? '/api/me/calendar' : `/api/me/calendar?client_id=${encodeURIComponent(id)}`, {
      method: task ? 'POST' : 'DELETE', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      ...(task ? { body: JSON.stringify({ client_id: task.id, name: task.name, day: task.day, time: task.time, duration: task.duration, priority: task.priority, source: task.from, scenario: task.scenario, scheduled_date: task.scheduledDate ?? null, duration_minutes: task.durationMinutes, completed: task.completed, completed_at: task.completedAt }) } : {}),
    })
    if (!response.ok) throw new Error('Calendar change could not be saved.')
  }
  const changed = [...new Set([...previous.keys(), ...next.keys()])].filter(id => JSON.stringify(previous.get(id)) !== JSON.stringify(next.get(id)))
  const applied: string[] = []
  try {
    for (const id of changed) { await write(id, next.get(id)); applied.push(id) }
  } catch (error) {
    const rollback = await Promise.allSettled(applied.reverse().map(id => write(id, previous.get(id))))
    if (rollback.some(result => result.status === 'rejected')) throw new Error('Some changes may have been saved. Reload the calendar before trying again.')
    throw error
  }
}

export function useCalendarHistory(userId?: string, authLoading = false) {
  const [tasks, setTasks] = useState<EditableCalendarTask[]>([])
  const [past, setPast] = useState<EditableCalendarTask[][]>([])
  const [future, setFuture] = useState<EditableCalendarTask[][]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const locked = useRef(false)
  const generation = useRef(0)
  const storageKey = `calendarAddedTasks:${userId || 'guest'}`
  useEffect(() => {
    const current = ++generation.current
    setReady(false)
    setTasks([])
    setPast([])
    setFuture([])
    setError('')
    locked.current = false
    setBusy(false)
    if (authLoading) return
    const load = async () => {
      try {
        let loaded: EditableCalendarTask[]
        if (userId) {
          const response = await fetch('/api/me/calendar', { cache: 'no-store', credentials: 'include' })
          if (!response.ok) throw new Error('Could not load your calendar. Reload before making changes.')
          const data = await response.json()
          if (!Array.isArray(data.tasks)) throw new Error('Calendar response was invalid. Reload before making changes.')
          loaded = data.tasks.map((task: any) => ({ id: task.client_id, name: task.name, day: task.day, time: task.time, duration: task.duration, priority: task.priority, from: task.source, scheduledDate: task.scheduled_date, durationMinutes: task.duration_minutes, scenario: task.scenario, completed: task.completed, completedAt: task.completed_at }))
        } else {
          const saved = JSON.parse(localStorage.getItem(storageKey) || '[]')
          loaded = Array.isArray(saved) ? saved : []
        }
        if (generation.current !== current) return
        setTasks(loaded)
        setReady(true)
      } catch (failure) {
        if (generation.current === current) setError(failure instanceof Error ? failure.message : 'Calendar could not be loaded.')
      }
    }
    void load()
    return () => { generation.current++ }
  }, [userId, authLoading, storageKey])
  const change = async (next: EditableCalendarTask[], direction: 'edit' | 'undo' | 'redo' = 'edit') => {
    if (!ready || authLoading || locked.current) {
      setError(locked.current ? 'A calendar change is still saving. Please try again when it finishes.' : 'Wait for your calendar to load before making changes.')
      return false
    }
    const current = generation.current
    locked.current = true
    setBusy(true)
    setError('')
    try {
      if (userId) await syncCalendarChange(tasks, next)
      if (generation.current !== current) return false
      if (direction === 'undo') { setPast(past.slice(0, -1)); setFuture([...future, tasks]) }
      else if (direction === 'redo') { setFuture(future.slice(0, -1)); setPast([...past, tasks].slice(-30)) }
      else { setPast([...past, tasks].slice(-30)); setFuture([]) }
      setTasks(next)
      try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch {}
      return true
    } catch (failure) { if (generation.current === current) setError(failure instanceof Error ? failure.message : 'Calendar change failed.'); return false }
    finally { if (generation.current === current) { locked.current = false; setBusy(false) } }
  }
  return { tasks, change, busy: busy || !ready, error, canUndo: past.length > 0, canRedo: future.length > 0,
    undo: () => past.length && change(past[past.length - 1], 'undo'), redo: () => future.length && change(future[future.length - 1], 'redo') }
}