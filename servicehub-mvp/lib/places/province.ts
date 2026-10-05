/**
 * Canadian provinces and territories, so "BC" and "British Columbia" (or
 * "QC" and "Québec") count as the same place. Organisations that serve a
 * whole province have a province but no map point, and are ordered by it
 * (lib/supabase/queries.ts, compareNearFirst).
 */

const PROVINCES: Record<string, string[]> = {
  AB: ['alberta'],
  BC: ['british columbia', 'colombie-britannique'],
  MB: ['manitoba'],
  NB: ['new brunswick', 'nouveau-brunswick'],
  NL: ['newfoundland and labrador', 'newfoundland', 'labrador', 'terre-neuve-et-labrador'],
  NS: ['nova scotia', 'nouvelle-écosse'],
  NT: ['northwest territories', 'territoires du nord-ouest'],
  NU: ['nunavut'],
  ON: ['ontario'],
  PE: ['prince edward island', 'pei', 'île-du-prince-édouard'],
  QC: ['quebec', 'québec'],
  SK: ['saskatchewan'],
  YT: ['yukon', 'yukon territory'],
}

const BY_NAME = new Map<string, string>()
for (const [code, names] of Object.entries(PROVINCES)) {
  BY_NAME.set(code.toLowerCase(), code)
  for (const name of names) BY_NAME.set(name, code)
}

/** A comparable key: the two-letter code in Canada, else the name in lower case. */
export function provinceKey(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const v = value.trim().toLowerCase().replace(/\.$/, '')
  if (!v) return null
  return BY_NAME.get(v) || v
}
