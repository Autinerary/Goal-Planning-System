import Link from 'next/link'
import {
  ArrowDown,
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
  MessagesSquare,
  Layers,
  ShieldCheck,
} from 'lucide-react'
import Image from 'next/image'
import FunnelPing from './components/FunnelPing'
import MediaPlayer from './components/MediaPlayer'
import ListenSection from './components/ListenSection'
import StoriesSection from './components/StoriesSection'
import NewsletterPrompt from './components/NewsletterPrompt'
import { EXPLAINER } from '@/lib/media'
import { gaEnabled } from '@/lib/analytics'
import StartHere from './components/StartHere'

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
 *
 * Riipen Labs, Group 4 then recommended a guided "Start Here" before the full
 * ecosystem, and specific action words ("Find starter resources", "Explore
 * services", "Learn what to expect") instead of broad ones. So the hero's one
 * primary button now leads into Start Here, which ends in "Save this path"
 * (the free account); creating an account straight away stays one click
 * away, as the secondary button.
 *
 * Riipen Labs, Group 11 asked for value and trust before the account: what
 * makes Autinerary different ("Why Autinerary"), a preview of what the app
 * looks like inside, and "what you'll share / what you get / how we protect
 * it", with honest answers explained and "prefer not to say" always there.
 * The screenshots are of the real app with a sample plan; retake them when
 * those screens change (docs/first-visit-to-return.md says how). For "proof
 * of impact" they suggested beta results as they are measured, alongside
 * research on need: "So far in the beta" waits for measured results, and the
 * research is one sourced line under "Who it's for".
 */

const PRIMARY_CTA =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-700 px-7 py-4 text-lg font-semibold text-white shadow-md transition-colors hover:bg-indigo-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300'
const SECONDARY_CTA =
  'inline-flex items-center justify-center gap-2 rounded-xl border-2 border-indigo-700 bg-white px-6 py-3.5 text-lg font-semibold text-indigo-800 transition-colors hover:bg-indigo-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300'
const SERVICE_HUB_URL = (process.env.NEXT_PUBLIC_SERVICE_HUB_URL || 'http://localhost:3001').replace(/\/$/, '')

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
  {
    icon: MessagesSquare,
    title: 'Advice from people like you',
    body: 'Tidbits has questions and answers from people with similar experiences, so you can learn from lived experience, not only from experts.',
  },
  {
    icon: Layers,
    title: 'Built for more than one norm',
    body: 'Plan around everything you navigate at once, like ADHD and being a newcomer. Positive and non-clinical: we talk about norms, not deficits.',
  },
]

// Real screens with a sample plan (Riipen Labs, Group 11: "a short visual
// tour on the homepage ... so visitors see the result before they start").
const PREVIEW = [
  {
    src: '/preview/path.jpg',
    alt: 'The Path on a phone. "Your next step" is "Choose a language to learn", the first of 16 small steps, with an "Open this step" button.',
    caption: 'Your Path: the next step, one at a time.',
  },
  {
    src: '/preview/step.jpg',
    alt: 'A step on a phone: "Choose a language to learn", with a short explanation, its progress, and the next steps to take.',
    caption: 'A step: what to do, in small parts.',
  },
  {
    src: '/preview/calendar.jpg',
    alt: 'The calendar on a phone with Low Energy chosen: a schedule for hard days with only critical tasks. Balanced and High Energy are the other choices.',
    caption: 'The calendar: a lighter plan for low-energy days.',
  },
  {
    src: '/preview/resourcehub.jpg',
    alt: 'ResourceHub on a phone: "Find resources rated by people like you, for people like you", a search box, and categories such as Therapists, Schools and Doctors.',
    caption: 'ResourceHub: services rated by people like you.',
  },
]

// What you share, what you get for it, and how it is protected (Group 11).
// Each statement is on the privacy page.
const EXCHANGE = [
  {
    icon: ListChecks,
    title: 'What you share',
    body: 'Required: that you are 18 or older, who you are here for, and one goal. Everything else is optional, and \u201cPrefer not to share\u201d is always an answer.',
  },
  {
    icon: Sparkles,
    title: 'What you get for it',
    body: 'A plan and starter resources built from your answers. Honest answers give better matches, like services rated by people with similar norms.',
  },
  {
    icon: ShieldCheck,
    title: 'How it is protected',
    body: 'We don\u2019t sell your information, show ads, or use it to train AI. Sensitive answers are optional, and you can change or remove them, or ask us to delete everything.',
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
    body: 'Two short questions: who you are here for, and one goal. Then your path is ready, with starter resources for what you need. Everything else is optional and can wait.',
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

// Results from Autinerary's own beta, for "So far in the beta" (Group 11:
// "share results from Autinerary's own beta as they are measured (for example,
// the share of users who saved a resource in their first week)"). Add one only
// once the trial has measured it, from the report (python -m
// scripts.onboarding_funnel, in backend/), never as an estimate: the figure,
// what it counts, how many people it is from, and the month. The section shows
// only when there is at least one.
const BETA_RESULTS: { figure: string; what: string; people: number; measured: string }[] = []

// Research on need (Group 11: "alongside credible research on need"). Canadian,
// like the people Autinerary serves, and about more than one norm at once.
const NEED_SOURCE =
  'https://www.canada.ca/en/public-health/services/publications/diseases-conditions/autism-spectrum-disorder-canadian-health-survey-children-youth-2019.html'

const NORM_EXAMPLES = [
  'Autism', 'ADHD', 'OCD', 'Bipolar', 'Anxiety', 'Learning differences',
  'Chronic illness', 'Physical disability', 'First-generation',
  'Visible minority', 'LGBTQ+', 'English as an additional language',
]

export default function HomePage() {
  return (
    <div className="min-h-screen text-slate-900">
      <FunnelPing event="landing_view" />
      <NewsletterPrompt />
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
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <a href="#start" className={PRIMARY_CTA}>
                Find starter resources
                <ArrowDown className="h-5 w-5" aria-hidden="true" />
              </a>
              <Link href="/signup" className={SECONDARY_CTA}>
                Create your free account
              </Link>
            </div>
            <p className="text-sm text-slate-700">
              Free during the beta · No credit card · For adults 18+
            </p>
            <p className="text-sm">
              <a href={`${SERVICE_HUB_URL}/search`} className="font-medium text-indigo-800 underline underline-offset-2 hover:text-indigo-950">
                Explore services
              </a>
              <span aria-hidden="true" className="text-slate-500"> · </span>
              <a href="#how" className="font-medium text-indigo-800 underline underline-offset-2 hover:text-indigo-950">
                Learn what to expect
              </a>
            </p>
          </div>
        </div>
      </section>

      <StartHere />

      {/* Why Autinerary: what you get, and what makes it different (Group
          11: "most neurodivergent apps focus on one job"). */}
      <section className="border-t border-slate-200 bg-white px-4 py-12 md:py-16" aria-labelledby="what-heading">
        <div className="mx-auto max-w-5xl">
          <h2 id="what-heading" className="text-2xl font-bold md:text-3xl">Why Autinerary</h2>
          <p className="mt-2 max-w-3xl text-lg text-slate-700">
            Planning, services and advice from people with similar experiences, in one place and built around the norms
            you navigate. Many apps do one of these. Autinerary connects them.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

      {/* A look inside, before any account. */}
      <section className="border-t border-slate-200 bg-slate-50 px-4 py-12 md:py-16" aria-labelledby="inside-heading">
        <div className="mx-auto max-w-5xl">
          <h2 id="inside-heading" className="text-2xl font-bold md:text-3xl">A look inside</h2>
          <p className="mt-2 text-slate-700">
            A short tour, then four screens from the app, with a sample plan for the goal &ldquo;Learn a new language&rdquo;.
          </p>
          {/* The explainer video (Group 11: "a 60-90 second captioned video"). */}
          <div className="mt-6 max-w-3xl">
            <MediaPlayer item={EXPLAINER} />
          </div>
          <ul className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            {PREVIEW.map((shot) => (
              <li key={shot.src}>
                <figure>
                  <Image
                    src={shot.src}
                    alt={shot.alt}
                    width={600}
                    height={1000}
                    sizes="(min-width: 768px) 240px, 45vw"
                    className="h-auto w-full rounded-xl border border-slate-300 bg-white shadow-sm"
                  />
                  <figcaption className="mt-2 text-sm text-slate-700">{shot.caption}</figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <ListenSection />

      {/* How it works: the clear first step, and what happens after it. */}
      <section id="how" className="scroll-mt-4 border-t border-slate-200 bg-slate-50 px-4 py-12 md:py-16" aria-labelledby="how-heading">
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
                Parents, caregivers, siblings, partners, educators, employers and allies can sign up too.
                Setup starts by asking who you are here for, so the questions fit. Accounts for people under 18
                are not available yet.
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
          <p className="mt-4 max-w-3xl text-sm text-slate-700">
            Many people navigate more than one. In Canada, 1 in 50 children and youth have an autism diagnosis, and more
            than two-thirds of them also have another long-term condition, most often ADHD, a learning disability or
            anxiety (
            <a href={NEED_SOURCE} className="font-medium text-indigo-800 underline underline-offset-2 hover:text-indigo-950">
              Public Health Agency of Canada, 2022
            </a>
            ).
          </p>
        </div>
      </section>

      <StoriesSection />

      {BETA_RESULTS.length > 0 && (
        <section className="border-t border-slate-200 bg-white px-4 py-12 md:py-16" aria-labelledby="beta-heading">
          <div className="mx-auto max-w-5xl">
            <h2 id="beta-heading" className="text-2xl font-bold md:text-3xl">So far in the beta</h2>
            <ul className="mt-6 grid gap-4 md:grid-cols-3">
              {BETA_RESULTS.map((r) => (
                <li key={r.what} className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-3xl font-bold text-indigo-800">{r.figure}</p>
                  <p className="mt-1 text-slate-800">{r.what}</p>
                  <p className="mt-2 text-sm text-slate-700">From {r.people} people, measured in {r.measured}.</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Details people asked for, folded away until wanted so the page does
          not front-load everything (the review's main risk to avoid). */}
      <section className="border-t border-slate-200 bg-slate-50 px-4 py-12 md:py-16" aria-labelledby="details-heading">
        <div className="mx-auto max-w-4xl">
          <h2 id="details-heading" className="text-2xl font-bold md:text-3xl">Before you sign up</h2>
          <ul className="mt-6 grid gap-4 md:grid-cols-3">
            {EXCHANGE.map(({ icon: Icon, title, body }) => (
              <li key={title} className="rounded-xl border border-slate-200 bg-white p-5">
                <Icon className="h-6 w-6 text-indigo-700" aria-hidden="true" />
                <h3 className="mt-2 font-semibold">{title}</h3>
                <p className="mt-1 text-slate-700">{body}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-slate-700">
            <Link href="/privacy" className="font-medium text-indigo-800 underline underline-offset-2 hover:text-indigo-950">
              Read what we collect and why
            </Link>
          </p>
          <div className="mt-6 space-y-3">
            <details className="group rounded-xl border border-slate-200 bg-white p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
                What will setup ask me?
                <ChevronDown className="h-5 w-5 text-slate-600 transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="mt-3 space-y-2 text-slate-700">
                <p>
                  <span className="font-semibold text-slate-900">Required:</span> confirming you are 18 or older,
                  who you are here for, and one goal. You can create your path as soon as those are done.
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Optional:</span> the norms you navigate (or
                  &ldquo;Prefer not to share&rdquo;), what you are looking for, your location (to find services near
                  you), what motivates you, your character and spirit animals, and how the app looks. You can add
                  any of these later.
                </p>
              </div>
            </details>
            <details className="group rounded-xl border border-slate-200 bg-white p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
                What happens after setup?
                <ChevronDown className="h-5 w-5 text-slate-600 transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="mt-3 text-slate-700">
                Your path is generated in about a minute. You land on a summary that starts with what you said
                you were looking for (a plan, services, or advice from others), with starter resources picked from
                your answers, and shows your first milestone, with an optional one-minute tour of each screen. You can
                replay the tour anytime from “How it works”. Optional questions, like your location or sensory needs,
                come back gently over your first two weeks.
              </p>
            </details>
            {/* Riipen Labs' cohort report: "explain where AI is used, what user
                benefit it provides, what controls exist and where
                human-reviewed or source-based information matters", without
                letting technology language eclipse what people get. Each
                claim matches docs/ai-agents-beta.md and the privacy page. */}
            <details className="group rounded-xl border border-slate-200 bg-white p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
                Where does Autinerary use AI?
                <ChevronDown className="h-5 w-5 text-slate-600 transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="mt-3 space-y-2 text-slate-700">
                <p>
                  AI writes your plan from your goal: the steps, the tools suggested for each one, and short notes on why.
                  If you ask for it, the goal helper in setup, labelled &ldquo;AI helper&rdquo;, turns your own words into
                  goal ideas. AI also makes Dream Self pictures, if you make one.
                </p>
                <p>
                  Some things are not AI. Start here&apos;s starter resources are real listings from ResourceHub, chosen
                  without AI. Your low, balanced and high-energy days are worked out by fixed rules, and the crisis lines
                  are written by our team. Nothing Autinerary suggests is medical or clinical advice.
                </p>
                <p>
                  AI gets only what it needs, such as your goals and any norms you chose to share. You can change or remove
                  those answers. We don&apos;t use your information to train AI, and OpenAI&apos;s terms say it doesn&apos;t
                  either.
                </p>
              </div>
            </details>
            <details className="group rounded-xl border border-slate-200 bg-white p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
                What does Autinerary count?
                <ChevronDown className="h-5 w-5 text-slate-600 transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="mt-3 text-slate-700">
                To find where setup is confusing, we count page visits, sign-ups, which setup step people reach,
                and return visits, plus which link someone first arrived from (for example TikTok or Facebook).
                In &ldquo;Start here&rdquo; we count the answers chosen, which starter resources are opened, and
                whether people found them useful. Once you have an account, we count which parts of the app you
                open. These counts never include anything you type. There are no advertising trackers on this site, and if
                your browser sends Do Not Track or Global Privacy Control, you are not counted.
                {gaEnabled() && ' If you allow it when asked, Google Analytics gets the same counts; it is off until you say yes.'}
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
            {/* Riipen Labs, Group 5 found "confusion between free vs. paid
                features". The line, decided 4 October 2026, is in
                docs/free-and-paid.md; keep the two in step. */}
            <details className="group rounded-xl border border-slate-200 bg-white p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
                Is Autinerary free?
                <ChevronDown className="h-5 w-5 text-slate-600 transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="mt-3 text-slate-700">
                Yes. Everything in Autinerary is free during the beta, and no credit card is needed. After the beta,
                the core stays free: making and following your plan, Start here, ResourceHub, Tidbits, check-ins,
                and a parent supervising their child&apos;s account. Paid extras may come later, mainly for
                organisations such as schools and employers, and we will tell you before anything you use changes.
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
          <Link href="/privacy" className="font-medium text-slate-800 underline underline-offset-2 hover:text-slate-900">Privacy</Link>
          <span>© 2026 Autinerary Corp. All rights reserved.</span>
        </div>
      </footer>
    </div>
  )
}
