import Link from 'next/link'
import {
  ArrowRight,
  Flag,
  CalendarDays,
  Wrench,
  PenLine,
  UserPlus,
  ListChecks,
  Rocket,
  ChevronDown,
  HeartHandshake,
  Sparkles,
} from 'lucide-react'

/**
 * Landing page: what a visitor needs before deciding to make an account.
 *
 * Rebuilt from Riipen Labs' onboarding review (Team 1, Sept 2026). Their
 * findings for this page: text over the sky photo was hard to read (measured:
 * 45 of 50 text elements below WCAG AA, most at about 1.1:1, white on
 * near-white), it did not say what Autinerary offers before asking for an
 * account, and there was no single obvious first step. Recommendations: one
 * clear primary call to action, fewer secondary visual elements, simple
 * guidance on what users can do and how the features connect, and introduce
 * information gradually rather than all at once.
 *
 * So: dark text on solid panels, one button label used everywhere ("Create
 * your free account"), sign-in demoted to a text link, no animated clouds,
 * and the longer details folded into expandable sections.
 *
 * Every statement here describes something the app actually does. The old
 * page claimed "thousands of journeys" (there are about a hundred real
 * users) and "5 minutes" (never measured); both are gone.
 */

const PRIMARY_CTA =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-700 px-7 py-4 text-lg font-semibold text-white shadow-md transition-colors hover:bg-indigo-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300'

const WHAT_YOU_GET = [
  {
    icon: Flag,
    title: 'Your goals, broken into steps',
    body: 'Each goal becomes a “race” with small milestones you tick off, so you can see progress instead of holding it in your head.',
  },
  {
    icon: CalendarDays,
    title: 'A schedule that fits your energy',
    body: 'Your calendar has low, balanced and high-energy versions of the day, so a hard day still has a plan.',
  },
  {
    icon: Wrench,
    title: 'Tools and services for each step',
    body: 'Milestones come with tools and supports, and ResourceHub lets you find services rated by people with similar norms.',
  },
  {
    icon: PenLine,
    title: 'A journal to look back on',
    body: 'Write how things went and notice what is working. Streak freezes mean one missed day does not undo the weeks before it.',
  },
]

const STEPS = [
  {
    icon: UserPlus,
    title: 'Create your account',
    body: 'Your name, email, a password and your date of birth. Autinerary is for adults 18 and over for now.',
  },
  {
    icon: ListChecks,
    title: 'Answer a short setup',
    body: 'Three things are required: confirm you are 18+, tell us your norms (or choose “Prefer not to share”), and add at least one goal. Everything else can be skipped.',
  },
  {
    icon: Rocket,
    title: 'Get your path and start',
    body: 'Your plan is built in about a minute. Then you start with your first milestone, and a short tour shows you around.',
  },
]

const CONNECTIONS = [
  { label: 'Your answers', detail: 'norms, goals, what motivates you' },
  { label: 'Your path', detail: 'goals become races with milestones' },
  { label: 'Tools & ResourceHub', detail: 'supports for each milestone' },
  { label: 'Your calendar', detail: 'next steps scheduled around your energy' },
  { label: 'Your journal', detail: 'look back, adjust your goals' },
]

const NORM_EXAMPLES = [
  'Autism', 'ADHD', 'OCD', 'Bipolar', 'Anxiety', 'Learning differences',
  'Chronic illness', 'Physical disability', 'First-generation',
  'Visible minority', 'LGBTQ+', 'English as an additional language',
]

export default function HomePage() {
  return (
    <div className="min-h-screen text-slate-900">
      {/* Top bar: brand, beta status, and sign-in as a quiet link so it does
          not compete with the one primary action. */}
      <header className="relative z-10 bg-white/95 border-b border-slate-200">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">Autinerary</span>
            <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900">
              Beta
            </span>
          </div>
          <Link href="/login" className="text-sm font-medium text-indigo-800 underline-offset-4 hover:underline">
            Sign in
          </Link>
        </div>
      </header>

      {/* Hero. The sky stays as the backdrop, but the words sit on a solid
          panel so they are readable whatever the photo does behind them. */}
      <section
        className="relative px-4 py-10 md:py-16"
        style={{
          backgroundImage:
            "url('/cloud-bg.png'), linear-gradient(135deg, #b8d4f0 0%, #c9b8e8 30%, #e8c4d8 55%, #f0c8d0 75%, #d0d8f0 100%)",
          backgroundSize: 'cover, cover',
          backgroundPosition: 'center, center',
        }}
      >
        <div className="mx-auto max-w-3xl rounded-2xl bg-white/95 p-6 shadow-lg md:p-10">
          <h1 className="text-3xl font-bold leading-tight md:text-5xl">
            A life plan built around how you work
          </h1>
          <p className="mt-4 text-lg text-slate-700 md:text-xl">
            Autinerary turns your goals into small, clear steps, schedules them around your energy,
            and points you to tools and services rated by people with similar norms. Made for
            neurodivergent adults and the people who support them.
          </p>

          <div className="mt-8 flex flex-col items-start gap-3">
            <Link href="/signup" className={PRIMARY_CTA}>
              Create your free account
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Link>
            <p className="text-sm text-slate-700">
              Free to start · No credit card required · For adults 18+
            </p>
          </div>
        </div>
      </section>

      {/* What you get */}
      <section className="bg-white px-4 py-12 md:py-16" aria-labelledby="what-heading">
        <div className="mx-auto max-w-5xl">
          <h2 id="what-heading" className="text-2xl font-bold md:text-3xl">What you get</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {WHAT_YOU_GET.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex gap-4 rounded-xl border border-slate-200 bg-slate-50 p-5">
                <Icon className="mt-0.5 h-6 w-6 shrink-0 text-indigo-700" aria-hidden="true" />
                <div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-1 text-slate-700">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works: the clear first step, and what happens after it. */}
      <section className="border-t border-slate-200 bg-slate-50 px-4 py-12 md:py-16" aria-labelledby="how-heading">
        <div className="mx-auto max-w-5xl">
          <h2 id="how-heading" className="text-2xl font-bold md:text-3xl">How it works</h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <li key={title} className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-700 text-sm font-bold text-white" aria-hidden="true">
                    {i + 1}
                  </span>
                  <Icon className="h-5 w-5 text-indigo-700" aria-hidden="true" />
                </div>
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-1 text-slate-700">{body}</p>
              </li>
            ))}
          </ol>

          {/* How the pieces connect. A plain ordered list, so it reads in
              order for screen readers and stacks cleanly on a phone. */}
          <h3 className="mt-10 text-xl font-bold">How the pieces connect</h3>
          <ol className="mt-4 flex flex-col gap-2 md:flex-row md:items-stretch md:gap-0">
            {CONNECTIONS.map((c, i) => (
              <li key={c.label} className="flex items-center md:flex-1">
                <div className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3">
                  <p className="font-semibold">{c.label}</p>
                  <p className="text-sm text-slate-700">{c.detail}</p>
                </div>
                {i < CONNECTIONS.length - 1 && (
                  <ArrowRight className="mx-2 hidden h-5 w-5 shrink-0 text-slate-500 md:block" aria-hidden="true" />
                )}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Who it's for: two short paths, one per kind of visitor. */}
      <section className="border-t border-slate-200 bg-white px-4 py-12 md:py-16" aria-labelledby="who-heading">
        <div className="mx-auto max-w-5xl">
          <h2 id="who-heading" className="text-2xl font-bold md:text-3xl">Who it&apos;s for</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-700" aria-hidden="true" />
                <h3 className="font-semibold">If you&apos;re planning for yourself</h3>
              </div>
              <p className="mt-2 text-slate-700">
                Tell us the norms you navigate and the goals you have. Your plan, schedule and tool
                suggestions are built from those answers, not from generic advice.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center gap-2">
                <HeartHandshake className="h-5 w-5 text-indigo-700" aria-hidden="true" />
                <h3 className="font-semibold">If you support someone</h3>
              </div>
              <p className="mt-2 text-slate-700">
                Parents, caregivers, partners and educators can sign up too, and say how they are
                connected to each norm. Accounts for people under 18 are not available yet.
              </p>
            </div>
          </div>

          <p className="mt-6 text-slate-700">Some of the norms people plan around:</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {NORM_EXAMPLES.map((n) => (
              <li key={n} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-800">
                {n}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Details people asked for, folded away until wanted so the page does
          not front-load everything (the review's main risk to avoid). */}
      <section className="border-t border-slate-200 bg-slate-50 px-4 py-12 md:py-16" aria-labelledby="details-heading">
        <div className="mx-auto max-w-3xl">
          <h2 id="details-heading" className="text-2xl font-bold md:text-3xl">Before you sign up</h2>
          <div className="mt-6 space-y-3">
            <details className="group rounded-xl border border-slate-200 bg-white p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
                What will setup ask me?
                <ChevronDown className="h-5 w-5 text-slate-600 transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="mt-3 space-y-2 text-slate-700">
                <p>
                  <span className="font-semibold text-slate-900">Required:</span> confirming you are 18 or older,
                  the norms you navigate (you can choose “Prefer not to share”), and at least one goal.
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Optional:</span> your location (to find services
                  near you), what motivates you, your character and spirit animals, and how the app looks.
                  Each optional step has a “Skip for now” button.
                </p>
              </div>
            </details>
            <details className="group rounded-xl border border-slate-200 bg-white p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
                What happens after setup?
                <ChevronDown className="h-5 w-5 text-slate-600 transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="mt-3 text-slate-700">
                Your path is generated in about a minute. You land on a summary that shows your first
                milestone and what to do next, with an optional one-minute tour of each screen. You can
                replay the tour anytime from “How it works”.
              </p>
            </details>
            <details className="group rounded-xl border border-slate-200 bg-white p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
                What does “beta” mean?
                <ChevronDown className="h-5 w-5 text-slate-600 transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="mt-3 text-slate-700">
                Autinerary is still being built and tested with early users, so some things will change and
                some features are not finished. After setup we ask two quick questions about how it went, and
                your answers decide what we fix next.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* Final call to action: same label as the top, one decision. */}
      <section className="border-t border-slate-200 bg-white px-4 py-12 text-center md:py-16">
        <h2 className="text-2xl font-bold md:text-3xl">Ready to build your path?</h2>
        <div className="mt-6 flex flex-col items-center gap-3">
          <Link href="/signup" className={PRIMARY_CTA}>
            Create your free account
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Link>
          <p className="text-sm text-slate-700">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-indigo-800 underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-slate-50 px-4 py-6">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 text-sm text-slate-700 sm:flex-row">
          <span className="font-semibold text-slate-900">Autinerary</span>
          <span>© 2026 Autinerary Corp. All rights reserved.</span>
        </div>
      </footer>
    </div>
  )
}
