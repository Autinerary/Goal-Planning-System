// The colour families that carry the brand read CSS variables, so a colour
// theme can change them all at once (app/themes.css, built by
// scripts/themes/build-themes.mjs; the team's planning note, October 2026:
// "Earthy Green & Watery Blue", and an option in Settings to change them).
const THEMED = ['indigo', 'violet', 'purple', 'fuchsia', 'pink', 'blue', 'sky', 'cyan']
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
const themed = Object.fromEntries(
  THEMED.map((f) => [f, Object.fromEntries(SHADES.map((s) => [s, `rgb(var(--c-${f}-${s}) / <alpha-value>)`]))])
)

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ...themed,
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
        },
      },
    },
  },
  plugins: [],
}
