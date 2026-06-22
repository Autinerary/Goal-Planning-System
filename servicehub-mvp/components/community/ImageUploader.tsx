'use client'

import { useRef, useState } from 'react'
import { Image as ImageIcon, X } from 'lucide-react'

interface ImageUploaderProps {
  urls: string[]
  onChange: (urls: string[]) => void
  max?: number
  disabled?: boolean
}

/**
 * Drag-drop or click-to-add uploader. POSTs to /api/community/upload
 * one file at a time and pushes the returned public URL into state.
 *
 * Single-purpose: this is the only image entry point in the community
 * surface, so we don't need a generic abstraction.
 */
export default function ImageUploader({ urls, onChange, max = 6, disabled }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remaining = max - urls.length

  const uploadOne = async (file: File): Promise<string | null> => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch('/api/community/upload', { method: 'POST', body: form })
    if (!res.ok) {
      const j = await res.json().catch(() => null)
      throw new Error(j?.error || `Upload failed (${res.status})`)
    }
    const j = await res.json()
    return j.url ?? null
  }

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setError(null)
    setBusy(true)
    try {
      const next: string[] = [...urls]
      for (const f of Array.from(files).slice(0, remaining)) {
        const url = await uploadOne(f)
        if (url) next.push(url)
      }
      onChange(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2" data-testid="image-uploader">
      <div className="flex flex-wrap gap-2 items-center">
        {urls.map((u, i) => (
          <div key={u} className="relative group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={u}
              alt={`upload ${i + 1}`}
              className="w-20 h-20 object-cover rounded-lg border border-gray-200"
            />
            <button
              type="button"
              aria-label="Remove image"
              onClick={() => onChange(urls.filter((_, idx) => idx !== i))}
              className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-1 shadow opacity-90 hover:opacity-100"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        {remaining > 0 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy || disabled}
            className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600 flex flex-col items-center justify-center disabled:opacity-50"
          >
            <ImageIcon className="w-5 h-5" />
            <span className="text-xs mt-1">{busy ? 'Uploading…' : 'Add'}</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
      <p className="text-xs text-gray-500">Up to {max} images, 750 KB each.</p>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  )
}
