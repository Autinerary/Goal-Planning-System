/**
 * A step of the plan in the person's own words (the step's page, "Put this step in your own words";
 * app/api/me/path/step).
 *
 * A plan keeps each step in up to three places (payload.path.milestones, each race's milestones, and path
 * planning's own result), and every page reads one of them, so an edit is made in all of them. The step as the
 * planner wrote it is kept in payload.stepEdits[id].original, so "Use the original" can put it back; and
 * payload.stepEdits is what Build my training set offers as "Steps you put in your own words"
 * (backend api/routes/training.py).
 */

export const MAX_STEP_NAME = 120
export const MAX_STEP_DESCRIPTION = 600

export type StepEdit = {
  name: string
  description: string
  goal?: string
  editedAt: string
  original: { name: string; description: string }
}

type Payload = Record<string, any>

/** Every copy of a step in a plan. */
export function stepCopies(payload: Payload, milestoneId: string): Record<string, any>[] {
  const lists: unknown[] = [payload?.path?.milestones]
  for (const race of Array.isArray(payload?.races) ? payload.races : []) lists.push(race?.milestones)
  for (const response of Array.isArray(payload?.agentResponses) ? payload.agentResponses : []) {
    if (response?.agentId === 'path_planning') lists.push(response?.result?.milestones)
  }
  return lists.flatMap((list) => (Array.isArray(list) ? list : [])).filter((m: any) => m && m.id === milestoneId)
}

/** A step's name and description as the person would save them, or why not. */
export function cleanStepText(name: unknown, description: unknown): { name: string; description: string } | { error: string } {
  const tidy = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
  const cleanName = tidy(name, MAX_STEP_NAME)
  if (cleanName.length < 2) return { error: 'Give the step a name.' }
  return { name: cleanName, description: tidy(description, MAX_STEP_DESCRIPTION) }
}

/** The plan with the step in the person's words everywhere it appears. The planner's version is kept from the first
 *  edit. Null when the plan has no such step. */
export function withStepEdit(payload: Payload, milestoneId: string, text: { name: string; description: string },
                             now = new Date()): Payload | null {
  const next: Payload = JSON.parse(JSON.stringify(payload || {}))
  const copies = stepCopies(next, milestoneId)
  if (!copies.length) return null
  const previous: StepEdit | undefined = next.stepEdits?.[milestoneId]
  const original = previous?.original ?? { name: String(copies[0].name || copies[0].title || ''), description: String(copies[0].description || '') }
  for (const copy of copies) {
    copy.name = text.name
    copy.description = text.description
  }
  next.stepEdits = {
    ...(next.stepEdits && typeof next.stepEdits === 'object' ? next.stepEdits : {}),
    [milestoneId]: { name: text.name, description: text.description, goal: copies[0].goal, editedAt: now.toISOString(), original },
  }
  return next
}

/** The plan with the step as the planner wrote it again. Null when it was never edited. */
export function withStepRestored(payload: Payload, milestoneId: string): Payload | null {
  const edit: StepEdit | undefined = payload?.stepEdits?.[milestoneId]
  if (!edit) return null
  const next: Payload = JSON.parse(JSON.stringify(payload))
  for (const copy of stepCopies(next, milestoneId)) {
    copy.name = edit.original.name
    copy.description = edit.original.description
  }
  delete next.stepEdits[milestoneId]
  return next
}
