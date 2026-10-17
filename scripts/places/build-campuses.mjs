#!/usr/bin/env node
// Ontario's public colleges and universities, each with its campuses' map
// points, for ResourceHub's campus pages (the team's planning note, October
// 2026: "services near universities and colleges, as a partnership
// package"). The institutions are the province's list; the campuses and
// points come from OpenStreetMap (© OpenStreetMap contributors, ODbL), read
// from the Ontario import's campus data (scripts/import-ontario-services.mjs
// --only campus). Writes servicehub-mvp/lib/campus/campuses.json.
//
//   node scripts/places/build-campuses.mjs
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

// name, kind, the words that name it in OpenStreetMap
const INSTITUTIONS = [
  ['Algoma University', 'university', /algoma university/i],
  ['Brock University', 'university', /brock university/i],
  ['Carleton University', 'university', /carleton university/i],
  ['Lakehead University', 'university', /lakehead university/i],
  ['Laurentian University', 'university', /laurentian university|université laurentienne/i],
  ['McMaster University', 'university', /mcmaster university/i],
  ['Nipissing University', 'university', /nipissing university/i],
  ['NOSM University', 'university', /nosm|northern ontario school of medicine/i],
  ['OCAD University', 'university', /ocad/i],
  ['Ontario Tech University', 'university', /ontario tech|university of ontario institute of technology/i],
  ["Queen's University", 'university', /queen'?s university/i],
  ['Toronto Metropolitan University', 'university', /toronto metropolitan university|ryerson university/i],
  ['Trent University', 'university', /trent university/i],
  ['Université de Hearst', 'university', /université de hearst|universite de hearst/i],
  ["Université de l'Ontario français", 'university', /ontario français|ontario francais/i],
  ['University of Guelph', 'university', /university of guelph(?!-humber)/i],
  ['University of Ottawa', 'university', /university of ottawa|université d'ottawa/i],
  ['University of Toronto', 'university', /university of toronto/i],
  ['University of Waterloo', 'university', /university of waterloo/i],
  ['University of Windsor', 'university', /university of windsor/i],
  ['Western University', 'university', /western university|university of western ontario/i],
  ['Wilfrid Laurier University', 'university', /wilfrid laurier/i],
  ['York University', 'university', /york university|université york/i],
  ['Algonquin College', 'college', /algonquin college/i],
  ['Cambrian College', 'college', /cambrian college/i],
  ['Canadore College', 'college', /canadore/i],
  ['Centennial College', 'college', /centennial college/i],
  ['Collège Boréal', 'college', /boréal|boreal/i],
  ['Conestoga College', 'college', /conestoga/i],
  ['Confederation College', 'college', /confederation college/i],
  ['Durham College', 'college', /durham college/i],
  ['Fanshawe College', 'college', /fanshawe/i],
  ['Fleming College', 'college', /fleming college|sir sandford fleming/i],
  ['George Brown College', 'college', /george brown/i],
  ['Georgian College', 'college', /georgian college/i],
  ['Humber College', 'college', /humber (college|polytechnic|institute)/i],
  ['La Cité', 'college', /la cité|la cite collégiale|collège la cité/i],
  ['Lambton College', 'college', /lambton college/i],
  ['Loyalist College', 'college', /loyalist college/i],
  ['Mohawk College', 'college', /mohawk college/i],
  ['Niagara College', 'college', /niagara college/i],
  ['Northern College', 'college', /northern college/i],
  ['Sault College', 'college', /sault college/i],
  ['Seneca Polytechnic', 'college', /seneca/i],
  ['Sheridan College', 'college', /sheridan college|sheridan institute/i],
  ['St. Clair College', 'college', /st\.? clair college/i],
  ['St. Lawrence College', 'college', /st\.? lawrence college/i],
]

const km = (a, b) => {
  const r = (d) => (d * Math.PI) / 180
  const x = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const elements = JSON.parse(readFileSync(join(tmpdir(), 'autinerary-ontario-import', 'campus.json'), 'utf8'))

// An institution mapped as one relation over several campuses has its centre
// between them (the University of Waterloo's fell in a field west of
// Kitchener). Its outlines, each a campus, from OpenStreetMap, kept on disk.
const UA = 'Autinerary-ResourceHub/1.0 (+https://autinerary.ca; accessibility service directory)'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function outlines(relId) {
  const file = join(tmpdir(), 'autinerary-ontario-import', `rel-${relId}.json`)
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'))
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ data: `[out:json][timeout:60]; rel(${relId}); way(r); out center tags;` }),
      })
      const json = res.ok ? await res.json() : null
      if (json && !(json.remark && /error/i.test(json.remark))) {
        const parts = (json.elements || []).filter((w) => w.center).map((w) => ({ lat: w.center.lat, lng: w.center.lon, name: w.tags?.name || null }))
        writeFileSync(file, JSON.stringify(parts))
        return parts
      }
    } catch {}
    await sleep(attempt * 15000)
  }
  return null
}
// Ontario's towns (scripts/places/build-gazetteer.mjs).
const TOWNS = JSON.parse(readFileSync(join(ROOT, 'servicehub-mvp/lib/search/places.json'), 'utf8'))
  .places.filter(([, province, , , , kind]) => province === 'ON' && kind === 'town')
  .map(([name, , lat, lng]) => ({ name, lat, lng }))
const nearestTown = (c) => {
  let best = null
  for (const t of TOWNS) { const d = km(t, c); if (d < 30 && (!best || d < best.d)) best = { name: t.name, d } }
  return best?.name || null
}
const out = []
for (const [name, kind, pattern] of INSTITUTIONS) {
  const found = []
  for (const el of elements.filter((e) => pattern.test(e.tags?.name || '') && (e.lat ?? e.center?.lat))) {
    const base = { name: el.tags.name.trim(), city: el.tags['addr:city'] || null, type: el.type }
    const parts = el.type === 'relation' ? await outlines(el.id) : null
    if (parts && parts.length) {
      // Each outline a campus, named by itself or by the institution.
      for (const part of parts) found.push({ ...base, name: part.name && pattern.test(part.name) ? part.name : base.name, lat: part.lat, lng: part.lng, type: 'way' })
    } else {
      found.push({ ...base, lat: el.lat ?? el.center.lat, lng: el.lon ?? el.center.lon })
    }
  }
  // The whole campus before a building on it: the institution's own name,
  // then "campus" names, then other names, and a faculty, school or building
  // last; outlines before points; then one per 2 km.
  const part = /faculty|school of|building|hall\b|residence|library|centre for|center for|institute|lab\b/i
  const rank = (c) =>
    (c.name.toLowerCase() === name.toLowerCase() ? 0 : /campus/i.test(c.name) ? 1 : part.test(c.name) ? 3 : 2) * 10 + (c.type === 'node' ? 1 : 0)
  found.sort((a, b) => rank(a) - rank(b))
  const campuses = []
  for (const c of found) {
    if (campuses.some((k) => km(k, c) < 2)) continue
    // Without a town in the address, the nearest town on the map, so two
    // campuses with one name can be told apart ("near Brampton").
    const town = c.city ? null : nearestTown(c)
    campuses.push({ name: c.name, city: c.city, near: town, lat: Math.round(c.lat * 1e5) / 1e5, lng: Math.round(c.lng * 1e5) / 1e5 })
    if (campuses.length === 6) break
  }
  out.push({ slug: slug(name), name, kind, campuses })
  console.log(`${name.padEnd(34)} ${campuses.length} ${campuses.length ? '' : '(none mapped)'}`)
}
mkdirSync(join(ROOT, 'servicehub-mvp/lib/campus'), { recursive: true })
writeFileSync(
  join(ROOT, 'servicehub-mvp/lib/campus/campuses.json'),
  JSON.stringify({ attribution: '© OpenStreetMap contributors (ODbL), built by scripts/places/build-campuses.mjs', built: new Date().toISOString().slice(0, 10), institutions: out }, null, 1) + '\n'
)
console.log('wrote', out.length, 'institutions,', out.reduce((n, i) => n + i.campuses.length, 0), 'campuses')
