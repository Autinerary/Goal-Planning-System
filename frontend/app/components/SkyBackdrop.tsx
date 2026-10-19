'use client'

import { usePreferences } from '../context/usePreferences'
import { isDefaultSky, normalizeSky, skyLayers } from '@/lib/sky'

// Small stars, tiled; drawn only on a night or dusk sky.
const STARS = [
  'radial-gradient(1.2px 1.2px at 12% 18%, #fff 60%, transparent 61%)',
  'radial-gradient(1px 1px at 28% 62%, #fff 60%, transparent 61%)',
  'radial-gradient(1.6px 1.6px at 47% 33%, #fff 60%, transparent 61%)',
  'radial-gradient(1px 1px at 63% 77%, #fff 60%, transparent 61%)',
  'radial-gradient(1.4px 1.4px at 78% 12%, #fff 60%, transparent 61%)',
  'radial-gradient(1px 1px at 88% 52%, #fff 60%, transparent 61%)',
  'radial-gradient(1.2px 1.2px at 6% 84%, #fff 60%, transparent 61%)',
  'radial-gradient(1px 1px at 38% 92%, #fff 60%, transparent 61%)',
].join(', ')

/**
 * The adjustable sky (lib/sky.ts), behind everything. Nothing is drawn for
 * the usual sky: the page keeps its own background (globals.css). Night and
 * dusk keep their true colours under dark mode (keep-colors), so the sky is
 * dark and the text, turned light by dark mode, reads on it.
 */
export default function SkyBackdrop() {
  const { prefs } = usePreferences()
  const sky = normalizeSky(prefs.layout?.sky)
  if (isDefaultSky(sky)) return null
  const l = skyLayers(sky, Boolean(prefs.accessibility?.darkMode))
  const layer = 'absolute inset-0'
  return (
    <div aria-hidden="true" data-sky={l.light} className={`pointer-events-none fixed inset-0 -z-10 ${l.keepColours ? 'keep-colors' : ''}`}>
      <div className={layer} style={{ backgroundImage: 'var(--page-wash)' }} />
      <div className={`${layer} sky-clouds`} style={{ backgroundImage: 'var(--page-clouds)', opacity: l.cloudOpacity, filter: l.cloudFilter }} />
      {l.tint !== 'none' && <div className={layer} style={{ backgroundImage: l.tint }} />}
      {l.starsOpacity > 0 && <div className={layer} style={{ backgroundImage: STARS, backgroundSize: '320px 320px', opacity: l.starsOpacity }} />}
      <div className={layer} style={{ backgroundImage: l.veil }} />
    </div>
  )
}
