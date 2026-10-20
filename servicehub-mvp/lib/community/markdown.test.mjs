// Run from servicehub-mvp/: node --experimental-strip-types lib/community/markdown.test.mjs
import assert from 'node:assert/strict'
import { renderMarkdown, extractHeadings } from './markdown.ts'

// An address with underscores stays whole (it used to get an <em> inside the href).
const url = 'https://www.researchgate.net/publication/274960728_Screening_Assessment_and_Diagnosis'
const html = renderMarkdown(`- Garcin (2015). [researchgate.net](${url})`)
assert.ok(html.includes(`href="${url}"`), html)
assert.ok(!html.includes('<em>'), html)
// Emphasis still works, in and around links.
assert.ok(renderMarkdown('Some **bold** and _italic_ words').includes('<strong>bold</strong> and <em>italic</em>'))
assert.ok(renderMarkdown('[**Read** it](https://example.org/a_b_c)').includes('<a href="https://example.org/a_b_c" target="_blank" rel="noopener noreferrer nofollow"><strong>Read</strong> it</a>'))
// Unsafe links stay text.
assert.ok(!renderMarkdown('[x](javascript:alert(1))').includes('<a '))
// Headings for Quick Links.
assert.deepEqual(extractHeadings('## One\n\ntext\n\n### Two').map((h) => [h.level, h.text]), [[2, 'One'], [3, 'Two']])
console.log('markdown: ok')
