// Run from servicehub-mvp/: node --experimental-strip-types lib/community/tidbits.test.mjs
import assert from 'node:assert/strict'
import { LENGTHS, isLengthType, platformOf, shownAuthor, step83Missing, wordCount } from './tidbits.ts'

// The word limits, as STEP 83 keeps them in the database.
assert.equal(LENGTHS.tidbit.words, 500)
assert.equal(LENGTHS.tadbit.words, 1000)
assert.ok(isLengthType('tidbit') && isLengthType('tadbit') && !isLengthType('essay') && !isLengthType(null))

// Words are runs of characters between spaces, as the database counts them.
assert.equal(wordCount(''), 0)
assert.equal(wordCount('   '), 0)
assert.equal(wordCount('One idea, short and sweet.'), 5)
assert.equal(wordCount(' line one\n\nline   two '), 4)

// Where an outside article lives.
assert.deepEqual(platformOf('https://www.reddit.com/r/autism/comments/abc'), { name: 'Reddit', home: 'https://www.reddit.com/' })
assert.deepEqual(platformOf('https://someone.substack.com/p/post'), { name: 'Substack', home: 'https://someone.substack.com/' })
assert.equal(platformOf('https://example.org/a')?.name, 'example.org')
assert.equal(platformOf('not a link'), null)
assert.equal(platformOf(null), null)

// Who a post shows as.
const author = { user_id: 'u1', pseudonym: 'calm_otter', avatar_url: null, karma: 3, is_public: true, top_badges: [] }
const post = { author_id: 'u1', byline: null, is_anonymous: false }
assert.equal(shownAuthor({ ...post, byline: 'autinerary' }, author, null).pseudonym, 'Autinerary')
assert.equal(shownAuthor({ ...post, byline: 'autinerary' }, author, null).user_id, '')
assert.equal(shownAuthor(post, author, null).pseudonym, 'calm_otter')
const anon = { ...post, is_anonymous: true }
assert.deepEqual(
  [shownAuthor(anon, author, null).pseudonym, shownAuthor(anon, author, { user_id: 'u2' }).pseudonym, shownAuthor(anon, author, { user_id: 'u2' }).user_id],
  ['Anonymous', 'Anonymous', '']
)
assert.equal(shownAuthor(anon, author, { user_id: 'u1' }).pseudonym, 'calm_otter')   // its author
assert.equal(shownAuthor(anon, author, { user_id: 'u9', is_admin: true }).pseudonym, 'calm_otter')   // a moderator
assert.equal(shownAuthor(anon, author, { user_id: 'u1' }).anonymous, true)
assert.equal(shownAuthor(post, undefined, null).pseudonym, 'former_member')

// What means STEP 83 isn't in yet.
assert.ok(step83Missing({ code: '42703', message: 'column community_posts.kind does not exist' }))
assert.ok(step83Missing({ code: 'PGRST205', message: "Could not find the table 'public.community_groups'" }))
assert.ok(!step83Missing({ code: '23505', message: 'duplicate key value' }))
assert.ok(!step83Missing(null))

console.log('tidbits: ok')
