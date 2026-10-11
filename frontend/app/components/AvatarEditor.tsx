'use client'

import { ACCESSORIES, CLOTHING, FACIAL_HAIR, HAIR_COLORS, HAIR_GROUPS, SKIN_TONES, hairChoiceId } from '@/lib/avatar'
import UserAvatar from './UserAvatar'

export type Appearance = { hairStyle: string; hairColor: string; skinColor: string; accessory?: string; facialHair?: string; clothing?: string }

// Hair used to be seven app styles here while setup offered all 34
// (Riipen Labs, Group 34: "add more diverse hair types"). Both now use
// HAIR_GROUPS. `full` adds what setup's Character step has: glasses, facial
// hair and clothes.
export default function AvatarEditor({ title, value, onChange, full = false, hint }: { title: string; value: Appearance; onChange: (value: Appearance) => void; full?: boolean; hint?: string }) {
  const extras = [
    { key: 'accessory', label: 'Glasses', options: ACCESSORIES },
    { key: 'facialHair', label: 'Facial hair', options: FACIAL_HAIR },
    { key: 'clothing', label: 'Clothes', options: CLOTHING },
  ] as const
  return (
    <fieldset className="space-y-3 border-t border-slate-200 pt-4">
      <legend className="font-medium text-slate-800">{title}</legend>
      {hint && <p className="text-sm text-slate-600">{hint}</p>}
      <UserAvatar {...value} size={112} />
      <label className="block text-sm">Hair style
        <select value={hairChoiceId(value.hairStyle)} onChange={event => onChange({ ...value, hairStyle: event.target.value })} className="ml-3 max-w-full rounded-lg border p-2">
          {HAIR_GROUPS.map(group => (
            <optgroup key={group.name} label={group.name}>
              {group.options.map(style => <option key={style.id} value={style.id}>{style.label}</option>)}
            </optgroup>
          ))}
        </select>
      </label>
      {full && extras.map(extra => (
        <label key={extra.key} className="block text-sm">{extra.label}
          <select value={value[extra.key] || extra.options[0].id} onChange={event => onChange({ ...value, [extra.key]: event.target.value })} className="ml-3 max-w-full rounded-lg border p-2">
            {extra.options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>
      ))}
      {([{ key: 'hairColor', label: 'Hair color', options: HAIR_COLORS }, { key: 'skinColor', label: 'Skin tone', options: SKIN_TONES }] as const).map(group => (
        <div key={group.key} role="group" aria-label={group.label}>
          <p className="mb-2 text-sm">{group.label}</p>
          <div className="flex flex-wrap gap-2">
            {group.options.map(color => <button key={color.id} type="button" aria-label={`${group.label}: ${color.label}`} title={color.label} aria-pressed={value[group.key] === color.id} onClick={() => onChange({ ...value, [group.key]: color.id })} style={{ backgroundColor: `#${color.id}` }} className={`h-9 w-9 rounded-full border-2 ${value[group.key] === color.id ? 'ring-2 ring-cyan-600 ring-offset-2' : 'border-slate-300'}`} />)}
          </div>
        </div>
      ))}
    </fieldset>
  )
}
