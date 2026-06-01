'use client'

interface Role {
  id: string
  label: string
  description: string
  icon: string
}

const roles: Role[] = [
  {
    id: 'self_advocate',
    label: 'Self-Advocate',
    description: 'Person with lived experience',
    icon: '👤',
  },
  {
    id: 'parent',
    label: 'Parent/Family',
    description: 'Parent or family member',
    icon: '👨‍👩‍👧‍👦',
  },
  {
    id: 'caregiver',
    label: 'Caregiver',
    description: 'Professional or family caregiver',
    icon: '🤝',
  },
  {
    id: 'professional',
    label: 'Professional',
    description: 'Therapist, educator, researcher',
    icon: '💼',
  },
]

interface RoleSelectorProps {
  selectedRole: string | null
  onSelectRole: (roleId: string) => void
}

export default function RoleSelector({ selectedRole, onSelectRole }: RoleSelectorProps) {
  return (
    <div className="space-y-4" role="radiogroup" aria-label="Select your role">
      {roles.map((role) => {
        const isSelected = selectedRole === role.id

        return (
          <button
            key={role.id}
            type="button"
            onClick={() => onSelectRole(role.id)}
            className={`w-full p-6 text-left border-2 rounded-lg transition-all ${
              isSelected
                ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-100'
                : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
            } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
            role="radio"
            aria-checked={isSelected}
            aria-label={`${role.label}: ${role.description}`}
          >
            <div className="flex items-start">
              <span className="text-3xl mr-4" aria-hidden="true">
                {role.icon}
              </span>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">{role.label}</h3>
                  {isSelected && (
                    <svg
                      className="w-6 h-6 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  )}
                </div>
                <p className="mt-1 text-sm text-gray-600">{role.description}</p>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
