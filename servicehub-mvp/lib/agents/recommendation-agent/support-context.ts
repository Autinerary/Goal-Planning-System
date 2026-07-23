export interface FunctionalSupportContext {
  conditionSupportNotes?: string[]
  therapyTypes?: string
  sensoryNeeds?: string
  strategiesWorked?: string
  strategiesNotWorked?: string
  schoolAccommodations?: string
  workplaceAccommodations?: string
  biggestChallenge?: string
  biggestChallengeResponse?: string
  recentChallenge?: string
  recentChallengeResponse?: string
}

/**
 * Convert structured support needs into bounded recommendation context.
 * Diagnosis status, subtype, and medication history are intentionally not
 * accepted by this function, keeping the agent boundary non-clinical.
 */
export function summarizeSupportContext(
  context: FunctionalSupportContext | null | undefined
): string | undefined {
  if (!context) return undefined
  const values = [
    ...(Array.isArray(context.conditionSupportNotes) ? context.conditionSupportNotes : []),
    context.therapyTypes,
    context.sensoryNeeds,
    context.strategiesWorked,
    context.strategiesNotWorked,
    context.schoolAccommodations,
    context.workplaceAccommodations,
    context.biggestChallenge,
    context.biggestChallengeResponse,
    context.recentChallenge,
    context.recentChallengeResponse,
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim())

  return values.length > 0 ? values.join(' | ').slice(0, 5000) : undefined
}

/** Extract only functional support fields from the private stored profile. */
export function summarizeStoredDiagnosticProfile(profile: unknown): string | undefined {
  if (!profile || typeof profile !== 'object') return undefined
  const value = profile as {
    conditions?: Array<{ notes?: unknown }>
    supportContext?: Record<string, unknown>
  }
  const support = value.supportContext || {}

  return summarizeSupportContext({
    conditionSupportNotes: Array.isArray(value.conditions)
      ? value.conditions
          .map((condition) => condition?.notes)
          .filter((note): note is string => typeof note === 'string')
      : [],
    therapyTypes: typeof support.therapyTypes === 'string' ? support.therapyTypes : '',
    sensoryNeeds: typeof support.sensoryNeeds === 'string' ? support.sensoryNeeds : '',
    strategiesWorked: typeof support.strategiesWorked === 'string' ? support.strategiesWorked : '',
    strategiesNotWorked: typeof support.strategiesNotWorked === 'string' ? support.strategiesNotWorked : '',
    schoolAccommodations: typeof support.schoolAccommodations === 'string' ? support.schoolAccommodations : '',
    workplaceAccommodations: typeof support.workplaceAccommodations === 'string' ? support.workplaceAccommodations : '',
    biggestChallenge: typeof support.biggestChallenge === 'string' ? support.biggestChallenge : '',
    biggestChallengeResponse: typeof support.biggestChallengeResponse === 'string' ? support.biggestChallengeResponse : '',
    recentChallenge: typeof support.recentChallenge === 'string' ? support.recentChallenge : '',
    recentChallengeResponse: typeof support.recentChallengeResponse === 'string' ? support.recentChallengeResponse : '',
  })
}
