import type { Metadata } from 'next'
import CharacterCreator from './CharacterCreator'

// The 3D character creator, on its own page while the team tries it; the 2D
// character (Dream Self, the race track) is unchanged.
export const metadata: Metadata = {
  title: 'Character creator | Autinerary',
  description: 'Make a 3D character that looks like you.',
}

export default function CharacterPage() {
  return (
    <div className="lg:px-4 lg:py-3">
      <CharacterCreator />
    </div>
  )
}
