'use client'

import { HAIR_COLORS, SKIN_TONES } from '@/lib/avatar'
import UserAvatar from './UserAvatar'

export type Appearance = { hairStyle: string; hairColor: string; skinColor: string }

const styles = [
  { id: 'short_straight', label: 'Short & Straight' }, { id: 'short_curly', label: 'Short & Curly' },
  { id: 'long_straight', label: 'Long & Straight' }, { id: 'long_curly', label: 'Long & Curly' },
  { id: 'braids', label: 'Braids' }, { id: 'buzz', label: 'Buzz Cut' }, { id: 'none', label: 'No Hair / Bald' },
]

export default function AvatarEditor({ title, value, onChange }: { title: string; value: Appearance; onChange: (value: Appearance) => void }) {
  return (
    <fieldset className="space-y-3 border-t border-slate-200 pt-4">
      <legend className="font-medium text-slate-800">{title}</legend>
      <UserAvatar {...value} size={112} />
      <label className="block text-sm">Hair style
        <select value={value.hairStyle} onChange={event => onChange({ ...value, hairStyle: event.target.value })} className="ml-3 max-w-full rounded-lg border p-2">
          {styles.map(style => <option key={style.id} value={style.id}>{style.label}</option>)}
        </select>
      </label>
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