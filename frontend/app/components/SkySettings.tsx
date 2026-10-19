'use client'

import { usePreferences } from '../context/usePreferences'
import { SKY_LIGHTS, needsDark, normalizeSky, type SkyLight, type SkyPrefs } from '@/lib/sky'

/**
 * The sky behind the app (lib/sky.ts): night to bright, clouds or none, cloud
 * colour from blue-pink to white and grey, and stars at night. Night and dusk
 * turn on dark mode so text stays readable; back to day turns it off again
 * if the sky turned it on.
 */
export default function SkySettings({ idPrefix = 'sky' }: { idPrefix?: string }) {
  const { prefs, updateLayout, update } = usePreferences()
  const sky = normalizeSky(prefs.layout?.sky)
  const a11y = prefs.accessibility
  const save = (change: Partial<SkyPrefs>) => updateLayout({ sky: { ...sky, ...change } })

  const chooseLight = (light: SkyLight) => {
    if (needsDark(light) && !a11y.darkMode) {
      update({ accessibility: { ...a11y, darkMode: true } })
      save({ light, darkBySky: true })
    } else if (!needsDark(light) && sky.darkBySky && a11y.darkMode) {
      update({ accessibility: { ...a11y, darkMode: false } })
      save({ light, darkBySky: false })
    } else save({ light })
  }

  return (
    <div className="space-y-3">
      <fieldset>
        <legend className="text-sm font-medium text-slate-800">Sky</legend>
        <div className="mt-1 grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Sky">
          {SKY_LIGHTS.map((l) => (
            <label key={l.id} className={`cursor-pointer rounded-lg border-2 px-1 py-1.5 text-center text-xs font-medium ${sky.light === l.id ? 'border-cyan-600 bg-cyan-50 text-cyan-950' : 'border-slate-200 text-slate-800'}`}>
              <input type="radio" name={`${idPrefix}-light`} value={l.id} checked={sky.light === l.id} onChange={() => chooseLight(l.id)} className="sr-only" />
              {l.label}
            </label>
          ))}
        </div>
        {needsDark(sky.light) && <p className="mt-1 text-xs text-slate-700">Night and dusk turn on dark mode, so the words stay light on a dark sky.</p>}
      </fieldset>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-800">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={sky.clouds} onChange={(e) => save({ clouds: e.target.checked })} className="h-4 w-4" />
          Clouds
        </label>
        {sky.light === 'night' && (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={sky.stars} onChange={(e) => save({ stars: e.target.checked })} className="h-4 w-4" />
            Stars
          </label>
        )}
      </div>
      {sky.clouds && (
        <label className="block text-sm text-slate-800" htmlFor={`${idPrefix}-colour`}>
          Cloud colour: {sky.cloudColour === 0 ? 'white and grey' : sky.cloudColour === 100 ? 'blue and pink' : `${sky.cloudColour}% colour`}
          <input id={`${idPrefix}-colour`} type="range" min={0} max={100} step={25} value={sky.cloudColour} onChange={(e) => save({ cloudColour: Number(e.target.value) })} className="mt-1 block w-full" aria-valuetext={sky.cloudColour === 0 ? 'White and grey' : `${sky.cloudColour}% colour`} />
        </label>
      )}
    </div>
  )
}
