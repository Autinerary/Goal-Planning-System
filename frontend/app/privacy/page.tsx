import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { gaEnabled } from '@/lib/analytics'
import { CONTACT_EMAIL } from '@/lib/contact'
import { USERWAY_ACCOUNT } from '../components/UserWay'

export const metadata: Metadata = {
  title: 'Privacy · Autinerary',
  description: 'What Autinerary collects, why, who else handles it, and what you can do about it.',
}

// Where privacy questions and requests go (lib/contact.ts).
const CONTACT = CONTACT_EMAIL
const UPDATED = '18 October 2026'

const PROVIDERS: { name: string; does: string; gets: string }[] = [
  { name: 'Supabase', does: 'Database, sign-in and file storage', gets: 'Everything saved in your account, stored in the United States (Ohio)' },
  { name: 'Vercel', does: 'Hosts the Autinerary and ResourceHub websites', gets: 'Your requests to the websites' },
  { name: 'Render', does: 'Runs our planning service', gets: 'What is needed to create and adapt your plan' },
  {
    name: 'OpenAI',
    does: 'Writes plans and suggestions, and creates Dream Self pictures',
    gets: 'The parts of your profile needed for that, such as your goals, norms you have shared and your preferences; what you type into the goal helper during setup, if you use it; what you ask the assistant, with a summary of your path, and your About me if you choose to share it; what you ask the help chat on the Help page (not saved by Autinerary); a sentence you type into ResourceHub’s search and send with Enter, to work out what you are looking for; a photo or a list you choose to import into your calendar or plan, to read the dates, tasks or steps in it for you to check. OpenAI’s terms for this kind of use say it does not train its models on this data',
  },
  { name: 'Resend', does: 'Sends our emails', gets: 'Your email address and the email itself' },
  {
    name: 'Stripe',
    does: 'Takes payments for paid plans, if you choose one, and for anything you buy from a vendor through ResourceHub (on the vendor’s own Stripe account)',
    gets: 'Your email address, your card (we never see its number), your billing or shipping address when needed, and what you are paying for. Stripe keeps payment records as tax law requires, even after you delete your account',
  },
  { name: 'Jitsi Meet (8x8)', does: 'Video rooms for calls booked in Hare World, and for a meeting with a team member when you choose “Make a free video link”, if you join one', gets: 'What any video call needs: your video, sound and the name you type when you join. Not used if you paste your own link' },
  {
    name: 'Twilio',
    does: 'Sends reminder texts, and the code that confirms your number, if you choose reminders by text',
    gets: 'Your mobile number and the text',
  },
  {
    name: 'Your browser’s notification service (for example Google, Apple or Mozilla)',
    does: 'Delivers notifications, if you turn them on for a device',
    gets: 'An address for your device and the notification, which is encrypted so the service cannot read it',
  },
  {
    name: 'Google',
    does: gaEnabled()
      ? 'Sign in with Google, our feedback form (Google Forms), maps of places in ResourceHub, and Google Analytics if you allow it'
      : 'Sign in with Google, our feedback form (Google Forms), and maps of places in ResourceHub',
    gets: gaEnabled()
      ? 'Only what you share through them, if you use them. A map gets the place it shows and your network address. Google Analytics gets which pages you open and the same counts described under "How the app is used", never anything you type'
      : 'Only what you share through them, if you use them. A map gets the place it shows and your network address',
  },
  { name: 'OpenStreetMap', does: 'Finds the map position of the city you enter, and shows the map on a ResourceHub listing', gets: 'The place name or the map area, and your network address; not who you are' },
  { name: 'OpenFreeMap (through Cloudflare)', does: 'The 3D view of a place in ResourceHub, if you open it', gets: 'Your network address and the pieces of map for that area' },
  { name: 'Open-Meteo', does: 'Weather forecasts, if you turn weather on', gets: 'Your approximate location' },
  ...(USERWAY_ACCOUNT
    ? [{ name: 'UserWay', does: 'The accessibility menu (the round button), if you open it', gets: 'Your requests for it, the page you are on, and the settings you choose in it, under UserWay’s own privacy policy' }]
    : []),
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
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">Privacy</h1>
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
              <li>
                If you use the goal helper during setup: what you type is sent to OpenAI to suggest goals, and is not saved.
                We only count that the helper was used.
              </li>
              <li>
                If you add them, on your Path or in Settings: what motivates you and your life stage, your character and
                Dream Self choices, spirit animals, and display and accessibility settings.
              </li>
              <li>Your plan and progress: milestones, races, calendar tasks, Life Stats check-ins and reflections.</li>
              <li>
                If you turn on daily reminders: the time you chose, your time zone, and how to reach you. For texts, your mobile
                number, which you confirm with a code we text to it.
              </li>
            </List>
          </Sub>
          <Sub title="Information about yourself that you choose to share">
            <List>
              <li>Norms or conditions, for example autism or ADHD.</li>
              <li>If you fill it in, a more detailed profile about things like diagnoses, therapies, sensory needs and accommodations.</li>
              <li>
                If you write it, your About me: what you are good at, what helps, what is hard, and what you want people to know.
                Only you can see it. It goes to the assistant (and so to OpenAI) only if you turn on “Share with the assistant”.
              </li>
              <li>If you write them, your Dream Self’s goals.</li>
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
              <li>
                Services you add to your team and sign on, and the first meeting you schedule with one: how (video, phone or in
                person), when, and the link or the place. The details stay with your team, which only you can see. The time and
                “Video call with” the service go in your Autinerary calendar, which people you connect with can see. Nothing is
                sent to the service: if you email them, it is from your own email app.
              </li>
              <li>Comments you post on a service, which everyone using ResourceHub can see, with your display name.</li>
              <li>
                Your Community’s Choice nominations and votes. They are counted; nobody sees who nominated or voted for what.
              </li>
              <li>
                If you used a service before joining and want to rate it: that you said so, its code, and whether we confirmed
                it. The proof you email us is used only to check, and we delete the email once we have.
              </li>
              <li>When you accepted the Terms and Conditions, and which version.</li>
              <li>
                If you search in a sentence and press Enter, the sentence is sent to OpenAI to pick the kind of place, the town
                and who it is for. It is not saved, and nothing else about you is sent with it.
              </li>
            </List>
          </Sub>
          <Sub title="If you choose a paid plan, or free access">
            <List>
              <li>Your plan, whether it is paid up, and its dates, from Stripe. Never your card number.</li>
              <li>When your free month started and ends.</li>
              <li>The emails we sent about your plan (a copy of your agreement, reminders) and when, as a record that they went out.</li>
              <li>For free access: the code you used, or your school, or your town and what you wrote about your situation. Only the team reads it.</li>
              <li>If you tell us why you didn’t continue or cancelled, your answer. Only the team reads it.</li>
            </List>
          </Sub>
          <Sub title="If you sign the #FundAutinerary petition">
            <List>
              <li>
                Your name, email address, province, who you are asking (and which school, workplace or city), your comment, and a
                scrambled form of your network address, used only to stop floods.
              </li>
              <li>
                The number of signatures is public. Your first name and province are shown only if you choose. We may tell the
                people you asked how many signed, and show them names only of people who chose to show theirs.
              </li>
              <li>We email you about the campaign only if you tick that box.</li>
            </List>
          </Sub>
          <Sub title="If you buy through ResourceHub’s shop">
            <List>
              <li>Your order: what you bought, from which vendor, its price, and its status. You and the vendor can see it.</li>
              <li>Your name, email and shipping address, which the vendor receives to deliver it, and any return you start.</li>
              <li>Your cart, which only you can see.</li>
            </List>
          </Sub>
          <Sub title="What you like and avoid in products">
            <List>
              <li>If you choose to say what you like and avoid (crunchy, tagless, quiet...): only you can see your answers.</li>
              <li>
                They sort the shop for you, and group people with similar answers and norms into taste profiles. A taste profile is
                described only when ten or more people are in it, and nobody is ever shown who is in one.
              </li>
            </List>
          </Sub>
          <Sub title="If you manage a listing (Resource Accounts)">
            <List>
              <li>Your organization, role and contact details, the listings you claim and how they were checked, your changes (kept with what they were before), and promotions you ask for.</li>
              <li>The code to check a claim is sent to the email the listing publishes, and only a scrambled form of it is kept.</li>
              <li>Owners see counts about their listing, such as saves, teams and ratings. Never who.</li>
            </List>
          </Sub>
          <Sub title="If you share your story">
            <List>
              <li>Your story, how you want your name and details shown, and where it may be shared.</li>
              <li>Nothing is shown until you approve the final version, and you can withdraw it at any time. A published story can be seen by anyone.</li>
            </List>
          </Sub>
          <Sub title="If you ask for emails without an account">
            <List>
              <li>
                Your email address, what you asked for (a Start here list, or the weekly email), when you confirmed it, and a
                scrambled form of your network address, used only to stop floods of sign-ups.
              </li>
              <li>Nothing is sent until you confirm from the first email, and every email has a link to stop them.</li>
              <li>
                In a month’s last week, the weekly email has a link to vote for Community’s Choice that works without signing
                in. Your vote is kept with a code for your subscription, not your address.
              </li>
            </List>
          </Sub>
          <Sub title="Connecting with people">
            <List>
              <li>
                The people you connect with, and what you share with them: messages and notes of support, memes, calls you
                book (the time, a note, and the link to the video room), tasks between you and a mentor, and goals you work on
                together. Only the two of you can see these. Your connections can also see when you finish a step on your
                path, in Updates.
              </li>
              <li>
                If you report a message you were sent, a copy of it and your reason, which the team reads to keep Hare World
                safe.
              </li>
              <li>
                Other members see only your public profile: your display name, picture and dream, and your username,
                pronouns, bio and photo if you add them. They see it only if you are discoverable, you are connected, or
                one of you sent the other a request. Never your email address, date of birth or settings.
              </li>
              <li>A profile photo is stored at a web address that is hard to guess. Anyone who has that address can open it.</li>
              <li>
                The people you block, which only you can see. Blocking someone removes your connection and any requests, both
                ways; neither of you can find or see the other, and they aren’t told.
              </li>
              <li>Your notes about people in Hare World, which only you can see.</li>
            </List>
          </Sub>
          <Sub title="Feedback and check-ins">
            <List>
              <li>Your answers to our questions in the app: after setup, and the occasional check-in.</li>
              <li>What you send with &ldquo;Tell us how it&rsquo;s going&rdquo; in the glossary: whether the app is useful to you so far, and what you write. Only the Autinerary team reads it.</li>
              <li>If you opt in to check-in emails or notifications: the last day you opened the app, so we only check in with people who have been away.</li>
              <li>Our feedback form is a Google Form, so your answers to it are stored by Google.</li>
            </List>
          </Sub>
          <Sub title="How the app is used">
            <List>
              <li>
                When you view the home page, open the sign-up form, create an account, reach each setup step, finish setup,
                and open the app (at most once a day), and which parts of the app you open, such as the calendar or the
                journal (each at most once a day). With each: a random ID kept in your browser, the website that sent
                you, the campaign link you used, if any, and whether it was a phone, a tablet or a computer (from the
                screen size and whether it is a touch screen, nothing else).
              </li>
              <li>
                Which of the optional questions on your Path&apos;s &ldquo;Complete your profile&rdquo; you have answered (not
                the answers), and in the app tour, which of its small tasks you tried or skipped.
              </li>
              <li>
                In &ldquo;Start here&rdquo;: the answers you choose (who you are here for and what you need), which starter
                resources you open, whether you said they were useful, and when you save the path. Your answers are also
                kept in your browser, so setup can start with them, and saved to your account when you save the path.
              </li>
              <li>We don’t record anything you type in these, and your browser sends none of them if it has Do Not Track or Global Privacy Control turned on.</li>
              {gaEnabled() && (
                <li>
                  If you allow it when asked, Google Analytics gets the same counts, to show us which pages are used. It is
                  off until you say yes, it is not used for ads, and you can change your answer in Settings.
                </li>
              )}
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
              To send email: a welcome email when you finish setup, up to three reminders to finish setup if you ask for them (each one lets you wait longer or stop), daily
              reminders at the time you choose if you turn them on, a weekly email with the resources you saved in
              ResourceHub and new picks for you if you turn it on, and a check-in if you opt in. Without an account: a
              Start here list or the weekly email, if you ask and confirm. Each of these emails tells you how to turn them
              off.
            </li>
            <li>
              To send notifications, only to devices you turn them on for: one when you turn them on, and a check-in if you
              haven’t opened Autinerary for two weeks. Turn them off in Settings, or in your browser.
            </li>
            <li>To find out where people get stuck and fix it. These reports show totals only, and leave out any group smaller than five people.</li>
            <li>To keep Autinerary safe: moderating community posts, preventing abuse, and limiting very heavy use.</li>
            <li>
              To keep ratings honest: each month, a service’s ratings decide whether it is warned, on probation or hidden, as the{' '}
              <Link href="/terms#ratings" className="font-medium text-indigo-800 underline underline-offset-2">Terms</Link> say. The
              ratings are counted, not who gave them.
            </li>
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
              When you delete your account on Your profile, we delete it and the information linked to it straight away.
              Copies in our database host’s backups are gone within 30 days; photos are deleted at once and are never in
              backups. Resources you suggested for ResourceHub stay, without your name.
            </li>
            <li>
              If you ask us by email to delete your account, we delete it and the information linked to it within 30 days.
            </li>
            <li>Either way, we keep anything the law requires us to keep. Totals already in our reports, which do not identify anyone, stay.</li>
            <li>
              The companies that host Autinerary keep short-term logs of the requests made to it, which include your IP
              address, to keep it working and secure. They delete them on their own schedule, within 90 days at most.
            </li>
          </List>
        </Section>

        <Section id="choices" title="Your choices and rights">
          <List>
            <li>Skip any optional question, and change your answers later in Settings.</li>
            <li>In Settings you can download a copy of your plan and progress, or erase them.</li>
            <li>Turn emails off from any reminder or check-in email, or in Settings. Stop texts by replying STOP, or in Settings. Turn notifications off in Settings, or in your browser.</li>
            <li>
              On Your profile you can pause your account (we send you nothing and nobody can find you in search until you
              resume), or delete it.
            </li>
            <li>To see, correct or delete anything else, or if you can’t delete your account yourself, email {mail}. We will reply within 30 days.</li>
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
