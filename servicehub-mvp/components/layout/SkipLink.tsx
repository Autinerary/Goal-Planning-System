/**
 * Skip to main content link for keyboard navigation
 * This component should be placed at the top of the body
 */
export default function SkipLink() {
  return (
    <a
      href="#main-content"
      className="skip-link focus:top-0"
      aria-label="Skip to main content"
    >
      Skip to main content
    </a>
  )
}