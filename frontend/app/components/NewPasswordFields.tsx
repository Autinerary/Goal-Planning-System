'use client'

import { useState } from 'react'
import { Check, Eye, EyeOff } from 'lucide-react'
import { PASSWORD_RULES } from '@/lib/passwordRules'

/** New password, typed twice, with sign-up's rules shown as they are met. */
export default function NewPasswordFields({ password, confirm, onPassword, onConfirm, idPrefix }: {
  password: string
  confirm: string
  onPassword: (value: string) => void
  onConfirm: (value: string) => void
  idPrefix: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={`${idPrefix}-new`} className="block text-sm font-semibold text-slate-800 mb-1">New password</label>
        <div className="relative">
          <input
            id={`${idPrefix}-new`}
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            value={password}
            onChange={(e) => onPassword(e.target.value)}
            aria-describedby={`${idPrefix}-rules`}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-11 focus:border-purple-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            aria-label={show ? 'Hide passwords' : 'Show passwords'}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-600 hover:text-slate-900"
          >
            {show ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
        <ul id={`${idPrefix}-rules`} className="mt-2 space-y-1">
          {PASSWORD_RULES.map((rule) => {
            const met = rule.test(password)
            return (
              <li key={rule.label} className={`flex items-center gap-2 text-xs ${met ? 'text-emerald-800' : 'text-slate-600'}`}>
                <Check className={`h-3 w-3 ${met ? 'opacity-100' : 'opacity-30'}`} aria-hidden="true" />
                {rule.label}
                <span className="sr-only">{met ? ' (done)' : ' (not yet)'}</span>
              </li>
            )
          })}
        </ul>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-confirm`} className="block text-sm font-semibold text-slate-800 mb-1">Type it again</label>
        <input
          id={`${idPrefix}-confirm`}
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => onConfirm(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-purple-500 focus:outline-none"
        />
      </div>
    </div>
  )
}
