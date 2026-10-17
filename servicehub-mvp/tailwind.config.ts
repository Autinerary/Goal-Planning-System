import type { Config } from "tailwindcss";

// The colour families that carry the brand read CSS variables, so a colour
// theme can change them all at once (app/themes.css, built by
// scripts/themes/build-themes.mjs at the repo root; the same themes as the
// app's). Greens, ambers, reds and greys keep their meaning and are not themed.
const THEMED = ["indigo", "violet", "purple", "fuchsia", "pink", "blue", "sky", "cyan"];
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const themed = Object.fromEntries(
  THEMED.map((f) => [f, Object.fromEntries(SHADES.map((s) => [s, `rgb(var(--c-${f}-${s}) / <alpha-value>)`]))])
);

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    // Class names kept in lib/ too: the trending badges' gradients
    // (lib/filters/taxonomy.ts) were never built while lib/ was left out.
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ...themed,
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
    },
  },
  plugins: [],
};
export default config;
