/**
 * Tidbits — minimal safe Markdown renderer.
 *
 * We deliberately avoid pulling in a library (per project policy "no new
 * external deps if avoidable"). This renderer covers the subset that
 * forum-style posts actually use:
 *
 *   - Headings (#, ##, ###)
 *   - Bold (**x**), italic (*x*, _x_)
 *   - Inline code (`x`) and fenced code (``` blocks)
 *   - Bullet lists (-, *) and numbered lists (1.)
 *   - Block quotes (>)
 *   - Links ([text](url)) — http(s)/mailto only
 *   - Hard line breaks
 *   - Images via the explicit image_urls field (we don't parse ![] inline)
 *
 * Everything else is escaped. We assume the input is untrusted user input,
 * so:
 *   1. Raw HTML is escaped before parsing (no <script>, no <img>, no <a
 *      onclick="…">).
 *   2. Link URLs are validated; only http, https, mailto are allowed.
 *   3. Fenced code blocks bypass inline parsing entirely.
 *
 * The output is plain HTML suitable for `dangerouslySetInnerHTML`.
 */

const SCHEME_RE = /^(https?:|mailto:)/i;

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!SCHEME_RE.test(trimmed)) return null;
  // Strip any control chars / quotes that survived escaping.
  return trimmed.replace(/["'<>\s]/g, '');
}

/**
 * Apply inline transforms (bold/italic/code/links) to a single escaped line.
 */
function renderInline(escaped: string): string {
  let out = escaped;
  // Inline code first — its content should not be reparsed.
  const codeSlots: string[] = [];
  out = out.replace(/`([^`]+)`/g, (_m, code) => {
    codeSlots.push(`<code>${code}</code>`);
    return `\u0000CODE${codeSlots.length - 1}\u0000`;
  });
  // Links — [text](url). URL is sanitized; otherwise treated as plain text.
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text, url) => {
    const safe = sanitizeUrl(url);
    if (!safe) return text;
    return `<a href="${safe}" target="_blank" rel="noopener noreferrer nofollow">${text}</a>`;
  });
  // Bold (** … **) — greedy-but-line-local.
  out = out.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  // Italic (* … * or _ … _). Avoid eating ** that we already consumed by
  // requiring a non-* on each side.
  out = out.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  out = out.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, '$1<em>$2</em>');
  // Restore code slots.
  out = out.replace(/\u0000CODE(\d+)\u0000/g, (_m, idx) => codeSlots[Number(idx)]);
  return out;
}

/**
 * Render a Markdown string to HTML. Caller is responsible for wrapping in
 * a container element. Output is safe to inject with dangerouslySetInnerHTML.
 */
export function renderMarkdown(input: string): string {
  if (!input) return '';
  // Escape ALL HTML first so user-provided <script> etc. is neutralised.
  const lines = escapeHtml(input).replace(/\r\n/g, '\n').split('\n');

  const out: string[] = [];
  let i = 0;

  // Stack of currently-open container types ('ul' | 'ol' | 'blockquote').
  const open: Array<'ul' | 'ol' | 'blockquote'> = [];

  const closeUntil = (kind: 'ul' | 'ol' | 'blockquote' | null) => {
    while (open.length > 0 && open[open.length - 1] !== kind) {
      const top = open.pop()!;
      out.push(`</${top}>`);
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block.
    if (/^```/.test(line)) {
      closeUntil(null);
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      // Skip the closing fence if present.
      if (i < lines.length) i++;
      out.push(`<pre><code>${codeLines.join('\n')}</code></pre>`);
      continue;
    }

    // Blank line — close any open container.
    if (/^\s*$/.test(line)) {
      closeUntil(null);
      i++;
      continue;
    }

    // Headings.
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      closeUntil(null);
      const level = heading[1].length;
      out.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    // Blockquote.
    if (/^>\s?/.test(line)) {
      if (open[open.length - 1] !== 'blockquote') {
        closeUntil(null);
        open.push('blockquote');
        out.push('<blockquote>');
      }
      out.push(`<p>${renderInline(line.replace(/^>\s?/, ''))}</p>`);
      i++;
      continue;
    }

    // Unordered list.
    if (/^[-*]\s+/.test(line)) {
      if (open[open.length - 1] !== 'ul') {
        closeUntil(null);
        open.push('ul');
        out.push('<ul>');
      }
      out.push(`<li>${renderInline(line.replace(/^[-*]\s+/, ''))}</li>`);
      i++;
      continue;
    }

    // Ordered list.
    if (/^\d+\.\s+/.test(line)) {
      if (open[open.length - 1] !== 'ol') {
        closeUntil(null);
        open.push('ol');
        out.push('<ol>');
      }
      out.push(`<li>${renderInline(line.replace(/^\d+\.\s+/, ''))}</li>`);
      i++;
      continue;
    }

    // Default: paragraph.
    closeUntil(null);
    out.push(`<p>${renderInline(line)}</p>`);
    i++;
  }
  closeUntil(null);
  return out.join('\n');
}

/**
 * Strip the markup down to a plain-text excerpt of at most `maxLen` chars.
 * Used by the feed page where we show a one-line preview.
 */
export function markdownExcerpt(input: string, maxLen = 220): string {
  if (!input) return '';
  const plain = input
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]+`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > maxLen ? plain.slice(0, maxLen - 1) + '…' : plain;
}
