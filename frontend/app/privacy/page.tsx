import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Privacy · Autinerary',
  description: 'What Autinerary collects, why, who else handles it, and what you can do about it.',
}

// Where privacy questions and requests go. Change it here if the team sets up
// a shared address (for example privacy@autinerary.ca).
const CONTACT = 'aayush@autinerary.ca'
const UPDATED = '4 October 2026'

const PROVIDERS: { name: string; does: string; gets: string }[] = [
  { name: 'Supabase', does: 'Database, sign-in and file storage', gets: 'Everything saved in your account, stored in the United States (Ohio)' },
  { name: 'Vercel', does: 'Hosts the Autinerary and ResourceHub websites', gets: 'Your requests to the websites' },
  { name: 'Render', does: 'Runs our planning service', gets: 'What is needed to create and adapt your plan' },
  {
    name: 'OpenAI',
    does: 'Writes plans and suggestions, and creates Dream Self pictures',
    gets: 'The parts of your profile needed for that, such as your goals, norms you have shared and your preferences. OpenAI’s terms for this kind of use say it does not train its models on this data',
  },
  { name: 'Resend', does: 'Sends our emails', gets: 'Your email address and the email itself' },
  {
    name: 'Your browser’s notification service (for example Google, Apple or Mozilla)',
    does: 'Delivers notifications, if you turn them on for a device',
    gets: 'An address for your device and the notification, which is encrypted so the service cannot read it',
  },
  { name: 'Google', does: 'Sign in with Google, and our feedback form (Google Forms)', gets: 'Only what you share through them, if you use them' },
  { name: 'OpenStreetMap (Nominatim)', does: 'Finds the map position of the city you enter', gets: 'The place name, not who you are' },
  { name: 'Open-Meteo', does: 'Weather forecasts, if you turn weather on', gets: 'Your approximate location' },
]

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-10">
      <h2 id={id} className="text-xl font-bold text-slate-900">{title}</h2>
      <div className="mt-3 space-y-3 text-slate-800 leading-relaxed">{children}</div>
    </section>
  )
}

function Sub({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-5">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <div className="mt-1.5 space-y-2">{children}</div>
    </div>
  )
}

function List({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-6">{children}</ul>
}

const mail = (
  <a href={`mailto:${CONTACT}`} className="font-medium text-indigo-800 underline underline-offset-2">
    {CONTACT}
  </a>
)

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <article className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <p className="text-sm font-semibold text-indigo-800">Autinerary</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900">Privacy</h1>
        <p className="mt-2 text-sm text-slate-700">Last updated {UPDATED}. Autinerary is in beta.</p>
        <p className="mt-6 leading-relaxed text-slate-800">
          This page explains what Autinerary collects, why, who else handles it, and what you can do about it. It covers
          the Autinerary app and ResourceHub, which share one account.
        </p>

        <Section id="short" title="The short version">
          <List>
            <li>We collect what you tell us, to build your plan and find services that fit, and a little about how the app is used, to fix what is confusing.</li>
            <li>Some of it can be sensitive, like conditions or norms you share. That is always optional, and only used to personalize Autinerary for you.</li>
            <li>We don’t sell your information, we don’t show ads, and we don’t use your information to train AI models.</li>
            <li>Your information is stored in the United States.</li>
            <li>You can ask to see, correct or delete your information at any time.</li>
          </List>
        </Section>

        <Section id="collect" title="What we collect">
          <Sub title="When you make an account">
            <List>
              <li>Your name, email address and password. Passwords are stored scrambled (hashed) by our sign-in provider, and nobody at Autinerary can see them.</li>
              <li>Your date of birth, to check that you are 18 or older.</li>
              <li>If you sign in with Google: the name, email address and profile picture Google shares with us. We never see your Google password.</li>
            </List>
          </Sub>
          <Sub title="When you set up and use your plan">
            <List>
              <li>Who you are here for, what you are looking for, and your goals, dreams and challenges.</li>
              <li>Your motivation style, character and Dream Self choices, spirit animals, and display and accessibility settings.</li>
              <li>Your plan and progress: milestones, races, calendar tasks, Life Stats check-ins and reflections.</li>
            </List>
          </Sub>
          <Sub title="Information about yourself that you choose to share">
            <List>
              <li>Norms or conditions, for example autism or ADHD.</li>
              <li>If you fill it in, a more detailed profile about things like diagnoses, therapies, sensory needs and accommodations.</li>
            </List>
            <p>This is sensitive, so it is always optional. You can skip it, change it or remove it. We use it only to personalize your plan and recommendations.</p>
          </Sub>
          <Sub title="Location">
            <List>
              <li>The city, province and country you enter. We look up its approximate map position to show services near you.</li>
              <li>If you turn on weather, your browser shares your location so we can get a forecast. You can turn this off at any time.</li>
            </List>
          </Sub>
          <Sub title="In ResourceHub">
            <List>
              <li>Ratings and reviews, questions and answers in Tidbits, resources you save or suggest, photos you upload, and your community profile.</li>
              <li>Ratings, reviews, Tidbits posts and your community profile can be seen by other people using Autinerary.</li>
            </List>
          </Sub>
          <Sub title="Connecting with people">
            <List>
              <li>The people you connect with, and messages you send them.</li>
            </List>
          </Sub>
          <Sub title="Feedback and check-ins">
            <List>
              <li>Your answers to our questions in the app: after setup, and the occasional check-in.</li>
              <li>If you opt in to check-in emails or notifications: the last day you opened the app, so we only check in with people who have been away.</li>
              <li>Our feedback form is a Google Form, so your answers to it are stored by Google.</li>
            </List>
          </Sub>
          <Sub title="How the app is used">
            <List>
              <li>
                When you view the home page, open the sign-up form, create an account, reach each setup step, finish setup,
                and open the app (at most once a day). With each: a random ID kept in your browser, the website that sent
                you, and the campaign link you used, if any.
              </li>
              <li>
                In &ldquo;Start here&rdquo;: the answers you choose (who you are here for and what you need), which starter
                resources you open, whether you said they were useful, and when you save the path. Your answers are also
                kept in your browser, so setup can start with them, and saved to your account when you save the path.
              </li>
              <li>We don’t record anything you type in these, and your browser sends none of them if it has Do Not Track or Global Privacy Control turned on.</li>
              <li>How much AI processing your account uses, to keep use fair.</li>
            </List>
          </Sub>
          <Sub title="On your device">
            <p>
              Your browser keeps your settings, unfinished setup answers and similar conveniences, plus the cookies that keep
              you signed in. Clearing your browser’s data for this site removes them.
            </p>
          </Sub>
        </Section>

        <Section id="use" title="How we use it">
          <List>
            <li>To build and adapt your plan, and to suggest services, tools and people that fit your goals, norms and location.</li>
            <li>
              To find patterns among people with similar goals and norms, so suggestions get better. For this we turn parts of
              profiles into numerical summaries (called embeddings), stored in our database.
            </li>
            <li>
              To send email: a welcome email when you finish setup, daily reminders if you turn them on, and a check-in if you
              opt in. Each reminder and check-in email tells you how to turn them off.
            </li>
            <li>
              To send notifications, only to devices you turn them on for: one when you turn them on, and a check-in if you
              haven’t opened Autinerary for two weeks. Turn them off in Settings, or in your browser.
            </li>
            <li>To find out where people get stuck and fix it. These reports show totals only, and leave out any group smaller than five people.</li>
            <li>To keep Autinerary safe: moderating community posts, preventing abuse, and limiting very heavy use.</li>
          </List>
          <p>We don’t sell, rent or trade your information, and we don’t show ads. We don’t use your information to train AI models.</p>
        </Section>

        <Section id="others" title="Who else handles it">
          <p>These companies run parts of Autinerary for us. Each gets only what it needs for its part.</p>
          <ul className="mt-2 divide-y divide-slate-200 border-y border-slate-200">
            {PROVIDERS.map((p) => (
              <li key={p.name} className="py-3">
                <p className="font-semibold text-slate-900">{p.name}</p>
                <p>{p.does}.</p>
                <p>
                  <span className="font-medium text-slate-900">Receives:</span> {p.gets}.
                </p>
              </li>
            ))}
          </ul>
          <p>If a parent or legal guardian manages your account, they can see it. We may also share information when the law requires it, or to protect someone’s safety.</p>
        </Section>

        <Section id="where" title="Where it is stored">
          <p>
            Our database is in the United States (Ohio). Some of the companies above may process information in other
            countries. Information kept outside Canada can be accessed by courts and authorities there, under their laws.
          </p>
        </Section>

        <Section id="keep" title="How long we keep it">
          <List>
            <li>While your account is open.</li>
            <li>
              If you ask us to delete your account, we delete it and the information linked to it within 30 days, except
              anything the law requires us to keep. Totals already in our reports, which do not identify anyone, stay.
            </li>
          </List>
        </Section>

        <Section id="choices" title="Your choices and rights">
          <List>
            <li>Skip any optional question, and change your answers later in Settings.</li>
            <li>In Settings you can download a copy of your plan and progress, or erase them.</li>
            <li>Turn emails off from any reminder or check-in email, or in Settings. Turn notifications off in Settings, or in your browser.</li>
            <li>To see, correct or delete anything else, or to close your account, email {mail}. We will reply within 30 days.</li>
            <li>You can withdraw your consent for optional information at any time.</li>
            <li>
              If you are not happy with how we handled something, please tell us first. You can also contact the Office of the
              Privacy Commissioner of Canada, or the privacy commissioner in your province.
            </li>
          </List>
        </Section>

        <Section id="children" title="People under 18">
          <p>
            You must be 18 or older to make your own account. A parent or legal guardian can add someone under 18 from their
            own Family page, and manages that account. If we learn that someone under 18 made an account themselves, we will
            close it.
          </p>
        </Section>

        <Section id="security" title="Keeping it safe">
          <List>
            <li>Connections to Autinerary are encrypted.</li>
            <li>Our database only lets each person read their own private information, and only team members who run the service can access it.</li>
            <li>No system is perfectly secure. If a breach puts you at risk, we will tell you, and the Privacy Commissioner, as the law requires.</li>
          </List>
        </Section>

        <Section id="changes" title="Changes">
          <p>
            Autinerary is in beta, and this page will change as it does. We will update the date at the top, and tell you by
            email or in the app before any significant change.
          </p>
        </Section>

        <Section id="contact" title="Contact">
          <p>Questions or requests about your information: {mail} (Autinerary Corp.).</p>
        </Section>

        <p className="mt-10 text-sm">
          <Link href="/" className="font-medium text-indigo-800 underline underline-offset-2">Back to Autinerary</Link>
        </p>
      </article>
    </div>
  )
}
