// The shop's vocabulary is kept in two places (ResourceHub's
// servicehub-mvp/lib/shop/taxonomy.json and the app's
// frontend/lib/shop/taxonomy.json, for Resource Accounts). They must be the
// same: run in CI.   node scripts/qa/check-taxonomy.mjs
import { readFileSync } from 'fs'
const a = readFileSync(new URL('../../servicehub-mvp/lib/shop/taxonomy.json', import.meta.url), 'utf8')
const b = readFileSync(new URL('../../frontend/lib/shop/taxonomy.json', import.meta.url), 'utf8')
if (a !== b) {
  console.error('The two taxonomy.json files differ: copy servicehub-mvp/lib/shop/taxonomy.json to frontend/lib/shop/taxonomy.json.')
  process.exit(1)
}
const t = JSON.parse(a)
const groups = new Set(t.groups.map((g) => g.id))
const bad = [...t.categories.filter((c) => !groups.has(c.group)).map((c) => `category ${c.id}: no group ${c.group}`), ...t.qualities.flatMap((q) => q.groups.filter((g) => g !== '*' && !groups.has(g)).map((g) => `quality ${q.id}: no group ${g}`))]
if (t.categories.length > 40) bad.push(`${t.categories.length} categories: the planning note says up to 40`)
if (new Set(t.categories.map((c) => c.id)).size !== t.categories.length || new Set(t.qualities.map((q) => q.id)).size !== t.qualities.length) bad.push('duplicate ids')
if (bad.length) {
  console.error(bad.join('\n'))
  process.exit(1)
}
console.log(`taxonomy: ok (${t.groups.length} groups, ${t.categories.length} categories, ${t.qualities.length} qualities)`)
