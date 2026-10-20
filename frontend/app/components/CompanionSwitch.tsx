'use client'

/**
 * Your companion (your spirit animal, on the Task tab and each task's page):
 * off unless you turn it on (the team's notes, October 2026: "Start this as
 * toggled off"). Saved with your account.
 */
export default function CompanionSwitch({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <div role="group" aria-label="Your companion" className="flex items-center gap-2">
      <span id="companion-label" className="text-sm font-medium text-slate-800">
        Companion
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby="companion-label"
        onClick={() => onChange(!on)}
        className={`relative h-7 w-12 rounded-full border transition-colors ${on ? 'border-indigo-700 bg-indigo-700' : 'border-slate-400 bg-slate-200'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-6' : 'left-0.5'}`} />
      </button>
    </div>
  )
}
