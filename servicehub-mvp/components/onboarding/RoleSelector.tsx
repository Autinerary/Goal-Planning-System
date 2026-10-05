'use client'

import { Briefcase, HeartHandshake, User, Users, type LucideIcon } from 'lucide-react'
import { SETUP_ROLES } from '@/lib/onboarding/setup'

// Line icons rather than emoji: calmer, and the same size on every device
// (Riipen Labs, Group 8, on reducing icon and emoji density).
const ICONS: Record<string, LucideIcon> = {
  self_advocate: User,
  parent: Users,
  caregiver: HeartHandshake,
  professional: Briefcase,
}

interface RoleSelectorProps {
  selectedRole: string | null
  onSelectRole: (roleId: string) => void
  /** Smaller cards, for the profile page. */
  compact?: boolean
}

export default function RoleSelector({ selectedRole, onSelectRole, compact = false }: RoleSelectorProps) {
  return (
    <div className={compact ? 'grid gap-2 sm:grid-cols-2' : 'space-y-3'} role="radiogroup" aria-label="Who are you here as?">
      {SETUP_ROLES.map((role) => {
        const isSelected = selectedRole === role.id
        const Icon = ICONS[role.id] || User

        return (
          <button
            key={role.id}
            type="button"
            onClick={() => onSelectRole(role.id)}
            className={`flex w-full items-start gap-3 rounded-xl border text-left transition-colors ${
              compact ? 'p-3' : 'p-4'
            } ${
              isSelected
                ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200'
                : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-gray-50'
            } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
            role="radio"
            aria-checked={isSelected}
          >
            <span
              className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${
                isSelected ? 'bg-white text-blue-700' : 'bg-blue-50 text-blue-600'
              }`}
              aria-hidden="true"
            >
              <Icon className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-gray-900">{role.label}</span>
              <span className="mt-0.5 block text-sm text-gray-600">{role.description}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
