'use client'

import { useMemo, useState } from 'react'
import { buildAvatarSvg } from '@/lib/avatar'
import { portraitUrl } from '@/lib/readyPlayerMe'

interface UserAvatarProps {
  /** Ready Player Me .glb URL, when the user built a 3D character. */
  glbUrl?: string | null
  /** Vector-avatar fallback inputs (also used if the render service fails). */
  hairStyle?: string
  hairColor?: string
  skinColor?: string
  size?: number
  className?: string
}

/**
 * One avatar for the whole app.
 *
 * Prefers the Ready Player Me server-rendered portrait; falls back to the
 * DiceBear vector avatar when there is no 3D character OR when the render
 * request fails. RPM is a third party, so "their CDN is down" must not mean
 * "the user has no face".
 */
export default function UserAvatar({
  glbUrl,
  hairStyle = '',
  hairColor,
  skinColor,
  size = 96,
  className = '',
}: UserAvatarProps) {
  const [renderFailed, setRenderFailed] = useState(false)

  const png = useMemo(
    () => (renderFailed ? null : portraitUrl(glbUrl, { size: Math.max(size * 2, 256) })),
    [glbUrl, size, renderFailed]
  )

  const svg = useMemo(
    () => buildAvatarSvg({ hairStyle, hairColor, skinColor, size }),
    [hairStyle, hairColor, skinColor, size]
  )

  if (png) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={png}
        alt="Your character"
        width={size}
        height={size}
        onError={() => setRenderFailed(true)}
        className={`object-contain ${className}`}
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <div
      style={{ width: size, height: size }}
      role="img"
      aria-label="Your character"
      className={className}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
