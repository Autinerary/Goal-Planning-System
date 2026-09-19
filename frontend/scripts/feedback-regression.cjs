const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

function load(relative, mocks = {}, suffix = '') {
  const filename = path.resolve(__dirname, '..', relative)
  const source = fs.readFileSync(filename, 'utf8') + suffix
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)(name => mocks[name] || require(name), module, module.exports)
  return module.exports
}

const storage = new Map()
global.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) }
global.window = { localStorage, dispatchEvent() {} }
global.CustomEvent = class {}

test('simplified view does not expand with visit count', () => {
  storage.clear()
  const disclosure = load('lib/disclosure.ts')
  storage.set('autinerary_visit_days', JSON.stringify(['1', '2', '3', '4', '5', '6']))
  assert.equal(disclosure.getDisclosureLevel(), 'simple')
  disclosure.setDisclosureOverride('full')
  assert.equal(disclosure.getDisclosureLevel(), 'full')
  disclosure.setDisclosureOverride(null)
  assert.equal(disclosure.getDisclosureLevel(), 'simple')
})

test('Info Mode starts with normal actions and cycles in order', () => {
  storage.clear()
  const info = load('lib/infoMode.ts')
  assert.equal(info.getInfoMode(), 'action')
  assert.deepEqual(['action', 'info', 'infoAction'].map(info.nextInfoMode), ['info', 'infoAction', 'action'])
})

test('age confirmation rejects impossible dates and checks the eighteenth birthday', () => {
  const { computeAge } = load('lib/age.ts')
  const today = new Date('2026-09-18T12:00:00')
  assert.equal(computeAge('2008-09-18', today), 18)
  assert.equal(computeAge('2008-09-19', today), 17)
  assert.equal(computeAge('2000-02-31', today), null)
  assert.equal(computeAge('2027-01-01', today), null)
  assert.equal(computeAge('', today), null)
})

test('languages are alphabetized and new dictionaries translate navigation', () => {
  const i18n = load('lib/i18n.ts')
  const names = i18n.LANGUAGES.map(language => language.english)
  assert.deepEqual(names, [...names].sort((first, second) => first.localeCompare(second, 'en')))
  for (const language of ['de', 'it', 'pt']) {
    assert.equal(i18n.isTranslated(language), true)
    assert.notEqual(i18n.translatePhrase(language, 'Settings'), 'Settings')
  }
})

test('DOM translations preserve React updates and restore the current source', () => {
  const i18n = load('lib/i18n.ts')
  const translator = load('app/components/AppWideTranslator.tsx', {
    '@/lib/i18n': i18n,
    '../context/LanguageContext': {},
  }, '\nexport { translateTextNode, translateElementAttrs }')
  const element = { closest: () => null }
  const node = { nodeValue: 'Back', parentElement: element }
  translator.translateTextNode(node, 'es')
  assert.equal(node.nodeValue, 'Atrás')
  node.nodeValue = 'Next'
  translator.translateTextNode(node, 'es')
  assert.equal(node.nodeValue, 'Siguiente')
  translator.translateTextNode(node, 'en')
  assert.equal(node.nodeValue, 'Next')
  node.nodeValue = 'Choose Monday Spirit Animal'
  translator.translateTextNode(node, 'en')
  assert.equal(node.nodeValue, 'Choose Monday Spirit Animal')
  const attributes = new Map([['aria-label', 'Back']])
  Object.assign(element, { getAttribute: key => attributes.get(key), setAttribute: (key, value) => attributes.set(key, value) })
  translator.translateElementAttrs(element, 'es')
  attributes.set('aria-label', 'Next')
  translator.translateElementAttrs(element, 'es')
  assert.equal(attributes.get('aria-label'), 'Siguiente')
  translator.translateElementAttrs(element, 'en')
  assert.equal(attributes.get('aria-label'), 'Next')
})

test('welcome email verifies identity, onboarding, ownership and previous receipt', async () => {
  let user = null
  let hasPath = false
  let configured = true
  let sent = 0
  const query = { select() { return this }, eq() { return this }, async limit() { return { data: hasPath ? [{ path_id: 'fixture' }] : [], error: null } } }
  const route = load('app/api/me/welcome/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
    '@/lib/supabase/server': { createServerSupabase: () => ({ auth: { getUser: async () => ({ data: { user } }) } }) },
    '@/lib/supabase/admin': { createAdminClient: () => ({ from: () => query, auth: { admin: {
      getUserById: async () => ({ data: { user } }),
      updateUserById: async (id, patch) => { Object.assign(user, patch); return {} },
    } } }) },
    '@/lib/email': { emailEnabled: () => configured, sendEmail: async input => { assert.equal(input.to, 'fixture@example.invalid'); assert.equal(input.idempotencyKey, 'welcome-v1-fixture'); sent++; return { ok: true, id: 'fixture-delivery' } } },
  })
  assert.equal((await route.POST()).status, 401)
  user = { id: 'fixture', email: 'fixture@example.invalid', app_metadata: {}, user_metadata: { has_completed_onboarding: true } }
  assert.equal((await route.POST()).status, 409)
  hasPath = true
  configured = false
  assert.equal((await route.POST()).status, 503)
  configured = true
  assert.equal((await route.POST()).status, 200)
  assert.equal((await route.POST()).body.alreadySent, true)
  assert.equal(sent, 1)
})

test('recommendation proxy ranks free, cheaper paid, then unknown prices', async () => {
  const route = load('app/api/recommendations/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
  })
  const previousFetch = global.fetch
  global.fetch = async () => ({ ok: true, json: async () => ({ recommendations: [
    { id: 'unknown', score: 99 }, { id: 'paid', price: 40, score: 90 },
    { id: 'free', price: 0, score: 80 }, { id: 'cheap', price: 5, score: 85 },
    { id: 'invalid', price: -1, score: 20 },
  ] }) })
  try {
    const response = await route.POST({ json: async () => ({}) })
    assert.deepEqual(response.body.recommendations.map(resource => resource.id), ['free', 'cheap', 'paid', 'unknown', 'invalid'])
  } finally {
    global.fetch = previousFetch
  }
})

test('guardian creation requires consent and only unlocks after linking', async () => {
  let guardian = null
  let linkFails = false
  let approvalFails = false
  const created = []
  const approved = []
  const route = load('app/api/family/children/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
    '@/lib/age': load('lib/age.ts'),
    '@/lib/supabase/server': { createServerSupabase: () => ({ auth: { getUser: async () => ({ data: { user: guardian } }) } }) },
    '@/lib/supabase/admin': { createAdminClient: () => ({
      from: () => ({ insert: async () => ({ error: linkFails ? { message: 'fixture failure' } : null }), upsert: async () => ({}) }),
      auth: { admin: {
        createUser: async input => { created.push(input); return { data: { user: { id: 'child-fixture' } } } },
        updateUserById: async (id, input) => { approved.push(input); return { error: approvalFails ? { message: 'fixture failure' } : null } },
      } },
    }) },
  })
  const body = { name: 'Fixture', email: 'child@example.invalid', password: 'local-fixture-only', dateOfBirth: '2015-01-01', relationship: 'parent', reviewed: true, legalGuardianConsent: true }
  const request = patch => ({ json: async () => ({ ...body, ...patch }) })
  assert.equal((await route.POST(request())).status, 401)
  guardian = { id: 'adult-fixture', app_metadata: { date_of_birth: '1990-01-01' }, user_metadata: {} }
  assert.equal((await route.POST(request({ reviewed: false }))).status, 400)
  assert.equal((await route.POST(request({ legalGuardianConsent: false }))).status, 400)
  assert.equal((await route.POST(request({ relationship: 'friend' }))).status, 400)
  assert.equal(created.length, 0)
  linkFails = true
  assert.equal((await route.POST(request())).status, 500)
  assert.equal(created[0].ban_duration, '876000h')
  assert.equal(created[0].app_metadata.guardian_approval.state, 'pending')
  assert.equal(approved.length, 0)
  linkFails = false
  approvalFails = true
  assert.equal((await route.POST(request())).status, 503)
  approvalFails = false
  assert.equal((await route.POST(request())).status, 200)
  assert.equal(approved.at(-1).ban_duration, 'none')
  assert.equal(approved.at(-1).app_metadata.guardian_approval.approved_by, guardian.id)
})