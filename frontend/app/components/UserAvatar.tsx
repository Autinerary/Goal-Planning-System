'use client'

import { useMemo } from 'react'
import { buildAvatarSvg } from '@/lib/avatar'

interface UserAvatarProps {
  hairStyle?: string
  hairColor?: string
  skinColor?: string
  /** Glasses or other face accessory; 'none' for bare. */
  accessory?: string
  facialHair?: string
  clothing?: string
  size?: number
  className?: string
}

/**
 * One avatar for the whole app.
 *
 * Deliberately renders from a local npm package (DiceBear) rather than a
 * hosted avatar service: Ready Player Me was integrated here and shut down,
 * taking every avatar with it. Nothing about this component can go offline.
 */
export default function UserAvatar({
  hairStyle = '',
  hairColor,
  skinColor,
  accessory,
  facialHair,
  clothing,
  size = 96,
  className = '',
}: UserAvatarProps) {
  const svg = useMemo(
    () => buildAvatarSvg({ hairStyle, hairColor, skinColor, accessory, facialHair, clothing, size }),
    [hairStyle, hairColor, skinColor, accessory, facialHair, clothing, size]
  )

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
