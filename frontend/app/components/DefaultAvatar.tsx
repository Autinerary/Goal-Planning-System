import { User } from 'lucide-react'

/**
 * Who stands in for someone who has not designed a character (Riipen Labs,
 * Group 29: "ensuring default avatar settings exist if skipped"). A plain
 * silhouette, not a drawn person: a default face would stand in for someone
 * it may not look like. Designing one is on the "Complete your profile" card
 * and the Ideal Self page.
 */
export default function DefaultAvatar({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      role="img"
      aria-label="Default character"
      title="Default character: design yours on the Ideal Self page"
      className={`keep-colors inline-grid shrink-0 place-items-center rounded-full border-2 border-slate-300 bg-slate-100 text-slate-500 ${className}`}
      style={{ width: size, height: size }}
    >
      <User style={{ width: Math.round(size * 0.6), height: Math.round(size * 0.6) }} aria-hidden="true" />
    </span>
  )
}
