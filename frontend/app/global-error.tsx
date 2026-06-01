'use client'

/**
 * Catches errors in the root layout, including ChunkLoadError (stale cache / timeout).
 * Shows a recovery message and retry instead of the default error overlay.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const isChunkError =
    error?.name === 'ChunkLoadError' ||
    (error?.message && (
      error.message.includes('ChunkLoadError') ||
      error.message.includes('Loading chunk') ||
      error.message.includes('timeout')
    ))

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#0f172a', color: '#e2e8f0', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 8 }}>
            {isChunkError ? 'App update or cache issue' : 'Something went wrong'}
          </h1>
          <p style={{ color: '#94a3b8', marginBottom: 24, lineHeight: 1.5 }}>
            {isChunkError
              ? 'The app failed to load a required file. This usually happens after a refresh or update. Use one of the options below.'
              : 'An unexpected error occurred.'}
          </p>
          {isChunkError && (
            <ul style={{ textAlign: 'left', color: '#94a3b8', marginBottom: 24, paddingLeft: 20, lineHeight: 1.8 }}>
              <li><strong>Hard refresh:</strong> Mac: Cmd+Shift+R · Windows: Ctrl+Shift+R</li>
              <li><strong>Or</strong> open <a href="/" style={{ color: '#38bdf8' }}>this site</a> in an <strong>Incognito / Private</strong> window</li>
            </ul>
          )}
          <button
            type="button"
            onClick={() => window.location.href = '/'}
            style={{
              padding: '12px 24px',
              fontSize: 16,
              fontWeight: 600,
              color: '#fff',
              background: '#0ea5e9',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            Reload app
          </button>
        </div>
      </body>
    </html>
  )
}
