import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { goHubHref } from '@/lib/serviceHub'
import { CONTACT_EMAIL } from '@/lib/contact'

export const metadata: Metadata = {
  title: 'What things are called · Autinerary',
  description: 'What Autinerary’s own words mean, in plain language, and how the website, the app and ResourceHub fit together.',
}

/*
 * What things are called (Riipen Labs, Group 34: "publish short explanations
 * for Tidbits, Pit Stop, mentors, races, and messaging"; Group 36: "terms
 * such as 'Races', 'Norms', and 'Path Model' may be unfamiliar", and "a
 * visual roadmap connecting its platforms"). Every line describes what the
 * app does today; check it against the code when a feature changes. Public,
 * so it can be read before signing up.
 */

type Term = { id?: string; term: string; body: ReactNode; href?: string; linkText?: string }

const linkClass = 'font-medium text-indigo-800 underline underline-offset-2'

function Terms({ items }: { items: Term[] }) {
  return (
    <dl className="mt-4 divide-y divide-slate-100">
      {items.map((t) => (
        <div key={t.term} id={t.id} className="scroll-mt-20 py-4">
          <dt className="font-semibold text-slate-900">{t.term}</dt>
          <dd className="mt-1 leading-relaxed text-slate-800">
            {t.body}
            {t.href && (
              <>
                {' '}
                <Link href={t.href} className={linkClass}>{t.linkText || `Open ${t.term}`}</Link>
              </>
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function Section({ id, title, intro, children }: { id: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="mt-12 scroll-mt-20">
      <h2 id={`${id}-heading`} className="text-2xl font-bold text-slate-900">{title}</h2>
      {intro && <p className="mt-2 text-slate-700">{intro}</p>}
      {children}
    </section>
  )
}

const PLACES = [
  {
    name: 'autinerary.ca',
    what: 'The website',
    body: 'About Autinerary and its mission, and things to read about autism, such as diagnosis and services.',
    when: 'Go here to learn.',
    account: 'No account needed.',
  },
  {
    name: 'The app',
    what: 'app.autinerary.ca, where you are now',
    body: 'Your plan: a goal broken into small steps, a calendar, a journal, and your people.',
    when: 'Go here to plan.',
    account: 'Free account.',
  },
  {
    name: 'ResourceHub',
    what: 'Services, places and things',
    body: 'Services, places, products and books, rated by people with similar norms, and Tidbits, where people ask and answer questions.',
    when: 'Go here to find help near you, or to ask.',
    account: 'You can look around without an account. Saving, rating and asking use the same account as the app.',
  },
]

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <article className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <p className="text-sm font-semibold text-indigo-800">Autinerary</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900">What things are called</h1>
        <p className="mt-4 leading-relaxed text-slate-800">
          Autinerary uses some names of its own. This page says what each one means, in plain words. You can also tap{' '}
          <strong>Help</strong> at the top of any page, then tap a button, to see what that button does before it does it.
        </p>

        <nav aria-label="On this page" className="mt-6 rounded-xl bg-slate-50 p-4 text-sm">
          <p className="font-semibold text-slate-900">On this page</p>
          <ul className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {[
              ['places', 'Three places, one account'],
              ['plan', 'Your plan'],
              ['progress', 'How you’re doing'],
              ['you', 'About you'],
              ['hare-world', 'People: Hare World'],
              ['pit-stop', 'Tools and resources'],
              ['help-on-pages', 'Help on every page'],
              ['ai', 'Where AI is used'],
              ['not-yet', 'Not working yet'],
              ['talk-now', 'Talk to someone now'],
            ].map(([id, label]) => (
              <li key={id}><a href={`#${id}`} className={linkClass}>{label}</a></li>
            ))}
          </ul>
        </nav>

        <Section id="places" title="Three places, one account" intro="Autinerary is three places that work together. You don’t need all three.">
          <ol className="mt-5 grid gap-3 md:grid-cols-3 md:gap-0" aria-label="The website, the app and ResourceHub">
            {PLACES.map((place, i) => (
              <li key={place.name} className="relative flex md:items-stretch">
                <div className="flex w-full flex-col rounded-xl border-2 border-indigo-200 bg-indigo-50/60 p-4 md:mx-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-indigo-800">{i + 1}. {place.what}</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{place.name}</p>
                  <p className="mt-2 flex-1 text-sm text-slate-800">{place.body}</p>
                  <p className="mt-3 text-sm font-semibold text-slate-900">{place.when}</p>
                  <p className="mt-1 text-xs text-slate-700">{place.account}</p>
                </div>
                {i < PLACES.length - 1 && (
                  <span aria-hidden="true" className="absolute -bottom-3 left-1/2 z-10 -translate-x-1/2 text-xl text-indigo-700 md:-right-3 md:bottom-auto md:left-auto md:top-1/2 md:-translate-y-1/2 md:translate-x-0">
                    <span className="md:hidden">↓</span><span className="hidden md:inline">→</span>
                  </span>
                )}
              </li>
            ))}
          </ol>
          <p className="mt-5 text-slate-800">
            The app and ResourceHub share one account, so you sign up once. Links from the app to ResourceHub keep you
            signed in. Each milestone in your plan suggests tools, and ResourceHub is where you find services for it.
          </p>
          <p className="mt-2 text-slate-800">
            Not sure where to start? To plan a goal, use the app. To find a service near you or ask a question, try{' '}
            <a href={goHubHref('/')} className={linkClass}>ResourceHub</a>. To read first, visit{' '}
            <a href="https://www.autinerary.ca" className={linkClass}>autinerary.ca</a>.
          </p>
        </Section>

        <Section id="plan" title="Your plan">
          <Terms items={[
            { term: 'Path', body: 'Your home page in the app. It shows your next step, a check-in when one is due, and Quick Links to everything else.', href: '/path', linkText: 'Open your Path' },
            { id: 'races', term: 'Races', body: 'Your goals, each set out as a race made of milestones, so a big goal becomes small steps. It is your own race, at your own pace: not a contest with anyone.', href: '/races', linkText: 'Open Races' },
            { id: 'dream-land', term: 'Dream Land', body: 'The look of the Races page: a world with a race track and your Dream Self in a car. It is the same page as Races, not a separate place.' },
            { id: 'milestones', term: 'Milestones', body: 'The steps of a race. Each one comes with tools and resources suggested for it. Tick it off when it is done. Steps in the next area unlock when you finish the area you are in.', href: '/milestones', linkText: 'Open your milestone' },
            { term: 'Tasks', body: 'Today’s small things to do, from your plan. They repeat each week, so a tick counts for the week you made it. Ticks show in the Calendar too, and you add tasks of your own there.', href: '/tasks', linkText: 'Open Tasks' },
            { id: 'calendar', term: 'Calendar, and Low, Balanced and High energy', body: 'Your week, with your plan’s tasks spread across it. Low Energy, Balanced and High Energy are three versions of the same week, from lighter to fuller, worked out by fixed rules from your plan. Pick the one that fits how you feel today; the calendar remembers it for the day. You can add your own tasks, and save the week to another calendar app.', href: '/calendar', linkText: 'Open the Calendar' },
            { id: 'journal', term: 'Journal', body: 'A place to write how things are going, and to look back at what you wrote. How your entries read counts towards Mentality in Life Stats. After an entry you may see a short note about it, written by AI.', href: '/reflection', linkText: 'Open the Journal' },
            { id: 'path-model', term: 'Path model and Path Market', body: 'A path model is a ready-made starting point for a plan in one area of life, such as school or work, shared by someone with experience. Path Market lists them. Starting one offers goal ideas for you to choose from; nothing is chosen for you. You can share your own.', href: '/path-market', linkText: 'Open Path Market' },
          ]} />
        </Section>

        <Section id="progress" title="How you’re doing">
          <Terms items={[
            {
              id: 'life-stats',
              term: 'Life Stats',
              body: (
                <>
                  Five scores out of 10, from what you do in Autinerary, over the last 7 days unless it says otherwise. <strong>Mentality</strong>: how your
                  journal entries read, plus milestones you finished. <strong>Happiness</strong>: your mood check-ins, or your
                  journal when you haven’t checked in. <strong>Focus</strong>: how much of what you planned you did.{' '}
                  <strong>Activity</strong>: how many days you did something here. It counts what you do in the app, not how
                  you feel, so a quiet day only means a quiet day. <strong>Commitment</strong>: how many of the last four
                  weeks you came back.
                </>
              ),
              href: '/stats',
              linkText: 'See your Life Stats',
            },
            { id: 'streaks', term: 'Streaks and freezes', body: 'A streak is the number of days in a row you opened Autinerary or finished a task, counted in the browser you use. It shows from two days. A freeze covers one missed day so your streak doesn’t reset: you start with two, and earn one for every 7 days in a row, up to five.' },
            { id: 'check-ins', term: 'Check-ins and the mood calendar', body: '“How are you today?”: pick how you feel from 1 to 10, and add a note if you like. It is on the Life Stats page, and with Life Stats on your Path once you choose Show more. Your answers make up Happiness and the mood calendar on the Life Stats page, which only you can see. Now and then Autinerary also asks one question, such as whether it has been useful, or, by email if you haven’t been back for a while, what got in the way. You can turn those emails off in Settings, under Emails.', href: '/stats', linkText: 'Open Life Stats' },
            { term: 'Reels', body: 'A short slideshow of your progress: milestones done, streaks and stats. It builds itself as you go.' },
          ]} />
        </Section>

        <Section id="you" title="About you">
          <Terms items={[
            { id: 'norms', term: 'Norms', body: 'The systemic realities you navigate: for example a condition or difference such as autism or ADHD, your identity or circumstances, such as being an immigrant or English being an additional language, or money and access, such as limited transport. Autinerary talks about norms, not deficits. Sharing them is optional. They shape the tools and services suggested to you.' },
            { id: 'simple-view', term: 'Simple view and Show more', body: 'The Path starts in Simple view, with one thing at a time. “Show more” adds the rest, such as Life Stats and your people; “Simplify” goes back. It never changes by itself.' },
            { id: 'character', term: 'Your character', body: 'A cartoon of you, made in setup or on the Ideal Self page. It stands on your race track at the step you are on.', href: '/ideal-self', linkText: 'Change your character' },
            { id: 'dream-self', term: 'Dream Self and Alternate Persona', body: 'Your Dream Self is the person you are growing into: your dream, and how you picture yourself. It drives the car in Dream Land. On the Ideal Self page you can write your Dream Self’s goals for each part of life, and turn any of them into a plan. An Alternate Persona is an optional alter-ego for your Dream Self: a confident version of you that you can step into, with its own name and look.', href: '/ideal-self', linkText: 'Open Ideal Self' },
            { id: 'spirit-animals', term: 'Spirit animals', body: 'Friendly animal guides shown on your Path. You can have one for every day, one for busy days and one for lighter days, or one for each day of the week. Choose them in Settings.' },
            { term: 'Your profile', body: 'Your name, how friends see you (with a username, pronouns, a few words about you and a photo, if you like), who can find you, your email address and password. You can also take a break there, or delete your account.', href: '/profile', linkText: 'Open your profile' },
            { id: 'about-me', term: 'About me', body: 'A page about you, in your own words: what you are good at, what helps, what is hard and what you want people to know. Only you can see it. Turn on Share with the assistant and the assistant reads it with each question.', href: '/about-me', linkText: 'Open About me' },
            { id: 'pause', term: 'Pausing your account', body: 'A break with nothing lost. While your account is paused we send you no reminders, check-ins, weekly picks or notifications, and nobody can find you in search. Resume from your Path or Your profile.', href: '/profile#pause', linkText: 'Pause or resume' },
          ]} />
        </Section>

        <Section id="hare-world" title="People: Hare World" intro="Hare World is where your people are: friends, mentors and role models, and groups. It is separate from Pit Stop, which holds your tools.">
          <Terms items={[
            { term: 'Friends, mentors and role models', body: 'A friend supports you. A mentor guides you. A role model is someone you look up to. If someone adds you as their mentor or role model, they appear with your friends, marked “Chose you as a mentor” or “Chose you as a role model”.', href: '/hare-world', linkText: 'Open Hare World' },
            { id: 'discoverable', term: 'Discoverable', body: 'Off unless you turn it on, in Your profile. When it is on, other signed-in people can find you by searching your name, your username or your whole email address, and send you a request. Your email address is never shown to them.' },
            { id: 'cards', term: 'A person’s card', body: 'Choose someone in Hare World to open their card: how you are connected and since when, a few words about them, and notes that only you can see.' },
            { id: 'messages', term: 'Messages and notes of support', body: 'Message anyone you are connected to, in Hare World, then Messages. A note of support is a short, kind message; it also shows on their Path. You can unsend what you sent, and report a message you got: the team sees a copy. Only connected people can message each other.', href: '/hare-world/messages', linkText: 'Open Messages' },
            { id: 'with-your-people', term: 'Updates, memes, calls, tasks and goals together', body: 'In Hare World, under With your people. Updates show the steps your people finished; it isn’t a contest. Memes are an emoji or a few words for your connections. A call is booked for a time, with a link to a private video room (Jitsi Meet) or your own link. Someone who chose you as their mentor can be sent small tasks, which they accept, decline or tick off. And you can invite someone to work on one of your goals together.', href: '/hare-world#updates', linkText: 'Open Hare World' },
            { id: 'blocking', term: 'Blocking', body: 'Choose Block on a person’s card or on their request. It removes your connection and any requests, both ways; neither of you can find or see the other, and they aren’t told. To undo it, open Blocked people at the bottom of Hare World.' },
            { id: 'requests', term: 'Requests, and what accepting shares', body: 'When someone with an account adds you, you get a request in Hare World, and a notification if you turned them on. You can accept or decline. If you accept, you can each see the other’s path, calendar and race progress. Either of you can remove the other at any time; it ends the connection for both of you, and they aren’t told. You can also add someone by name only, as a note for yourself: they aren’t told and see nothing.' },
            { id: 'role-model-galleria', term: 'Role Model Galleria', body: 'People to look up to, suggested by the community and reviewed before they appear. You can suggest someone.', href: '/hare-world/role-models', linkText: 'Open the Galleria' },
            { id: 'groups', term: 'Collab groups', body: 'Groups you make or join, such as for family, school or work. Anyone can join a public group; a private one needs its code. For now a group shows its members and rules; there is no group chat yet.' },
            { term: 'Relationships and matching', body: 'Suggestions of new people based on shared dreams and interests. Not ready yet: for now, find people with search in Hare World.' },
            { term: 'Family', body: 'For a parent or guardian: add children under 18, each with an account you manage, and follow their journey. Its button is at the top of the app once you choose Show more on your Path.', href: '/family', linkText: 'Open Family' },
          ]} />
        </Section>

        <Section id="pit-stop" title="Tools and resources">
          <Terms items={[
            { term: 'Pit Stop', body: 'Your tools: the apps, products and supports your plan suggested for your milestones, on shelves you can search. Your people are in Hare World.', href: '/pit-stop', linkText: 'Open Pit Stop' },
            { term: 'ResourceHub', body: 'Services, places, products and books, rated by people with similar norms. It is a separate site with the same account; links from the app keep you signed in. Ratings and written reviews are public on each listing.', href: goHubHref('/'), linkText: 'Open ResourceHub' },
            { id: 'tidbits', term: 'Tidbits', body: 'Questions and answers from people with similar experiences, in ResourceHub. You post under a pseudonym, not your real name. People vote answers up or down, the person who asked can accept one, and helpful points add up the votes, plus 15 for each accepted answer. It is a place to learn from each other, not a contest. You can delete your own posts and answers, and report anything that breaks the rules.', href: goHubHref('/community'), linkText: 'Open Tidbits' },
            { id: 'starter-resources', term: 'Starter resources', body: 'A few real listings from ResourceHub, picked from your answers without AI, so there is something useful from the start.', href: '/start', linkText: 'Open Start here' },
          ]} />
        </Section>

        <Section id="help-on-pages" title="Help on every page">
          <Terms items={[
            { term: 'Help', body: 'At the top of every page. Turn it on, then tap any button: you see what it does first, and tap again to use it.' },
            { term: 'How it works', body: 'A one-minute tour of each part of the app. It starts once by itself, and you can replay it any time from the top of the app.' },
            { term: 'Back', body: 'Most pages have a Back button at the top left. The bar of tabs above Path, Calendar and Tasks moves between them.' },
            { term: 'Settings', body: 'How the app looks, language, reminders and emails, spirit animals, and backing up your data.', href: '/profile/settings', linkText: 'Open Settings' },
          ]} />
        </Section>

        <Section id="ai" title="Where AI is used">
          <div className="mt-4 space-y-3 leading-relaxed text-slate-800">
            <p>
              AI writes your plan from your goal: the steps, the tools suggested for each one, and short notes on why. If you
              ask for it, the goal helper in setup, labelled “AI helper”, turns your own words into goal ideas. AI also makes
              Dream Self pictures, if you make one, and the short note you may see after a journal entry.
            </p>
            <p>
              Some things are not AI. Starter resources are real ResourceHub listings, chosen without AI. Your low, balanced
              and high-energy days are worked out by fixed rules, and the crisis lines are written by our team. Nothing
              Autinerary suggests is medical or clinical advice.
            </p>
            <p>
              AI gets only what it needs, such as your goals and any norms you chose to share. We don’t sell your information,
              show ads, or use it to train AI. <Link href="/privacy" className={linkClass}>Read Privacy</Link>
            </p>
          </div>
        </Section>

        <Section id="not-yet" title="Not working yet" intro="These are planned, but they don’t work yet, so the app doesn’t offer them:">
          <ul className="mt-3 list-disc space-y-1.5 pl-6 text-slate-800">
            <li>Match suggestions in Relationships</li>
            <li>Chat inside collab groups</li>
          </ul>
        </Section>

        {/* The same lines the goal helper shows (backend/core/goal_helper.py,
            CRISIS). Linked from "Stuck?" on the Path. */}
        <section id="talk-now" aria-labelledby="talk-now-heading" className="mt-12 scroll-mt-20 rounded-xl border-2 border-amber-300 bg-amber-50 p-5">
          <h2 id="talk-now-heading" className="text-2xl font-bold text-slate-900">Talk to someone now</h2>
          <p className="mt-2 text-slate-800">
            If things are really hard right now, you don&apos;t have to work it out alone. These are free, at any time:
          </p>
          <ul className="mt-3 space-y-2 text-slate-900">
            <li><strong>9-8-8 Suicide Crisis Helpline (Canada):</strong> call or text <a href="tel:988" className={linkClass}>9-8-8</a>, any time.</li>
            <li><strong>988 Suicide &amp; Crisis Lifeline (US):</strong> call or text <a href="tel:988" className={linkClass}>988</a>, any time.</li>
            <li><strong>Emergency services:</strong> call <a href="tel:911" className={linkClass}>911</a> if you or someone else is in danger now.</li>
          </ul>
          <p className="mt-3 text-sm text-slate-700">Autinerary isn&apos;t a crisis service, and nothing in it is medical advice.</p>
        </section>

        <p className="mt-12 text-sm text-slate-700">
          Something here unclear, or a word missing? Email{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className={linkClass}>{CONTACT_EMAIL}</a>.{' '}
          <Link href="/path" className={linkClass}>Back to your Path</Link>
        </p>
      </article>
    </div>
  )
}
