'use client'

import { renderMarkdown } from '@/lib/community/markdown'

interface MarkdownProps {
  source: string
  className?: string
}

/**
 * Wraps the project's minimal-renderer output. Caller passes raw markdown,
 * we escape, parse, and inject. Output is constrained: no <script>, no
 * unsafe URLs, no raw HTML passthrough.
 */
export default function Markdown({ source, className }: MarkdownProps) {
  const html = renderMarkdown(source)
  return (
    <div
      className={`prose prose-sm sm:prose max-w-none community-markdown ${className ?? ''}`}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
