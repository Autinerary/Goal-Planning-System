import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { CONTACT_EMAIL } from '@/lib/contact'
import { PROOF_EMAIL, TERMS_UPDATED } from '@/lib/legal'

const HUB = (process.env.NEXT_PUBLIC_SERVICE_HUB_URL || 'http://localhost:3001').replace(/\/$/, '')

export const metadata: Metadata = {
  title: 'Terms and Conditions · Autinerary',
  description: 'The rules for using Autinerary and ResourceHub: what they are and are not, your account, ratings, Community’s Choice, what you post, and our responsibilities.',
}

/**
 * The Terms and Conditions (the team's planning note, October 2026, Goal 2:
 * "OUR APP NEEDS AN APPROPRIATE TERMS & CONDITIONS"). One set for the app
 * and ResourceHub, which share one account; written plainly, like the
 * privacy page. Its version is lib/legal.ts's TERMS_VERSION.
 */

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-10">
      <h2 id={id} className="text-xl font-bold text-slate-900">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-slate-800 leading-relaxed">{children}</div>
    </section>
  )
}

function List({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-6">{children}</ul>
}

const mail = (address: string) => (
  <a href={`mailto:${address}`} className="font-medium text-indigo-800 underline underline-offset-2">
    {address}
  </a>
)

const link = (href: string, text: string) => (
  <Link href={href} className="font-medium text-indigo-800 underline underline-offset-2">
    {text}
  </Link>
)

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <article className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <p className="text-sm font-semibold text-indigo-800">Autinerary</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">Terms and Conditions</h1>
        <p className="mt-2 text-sm text-slate-700">Last updated {TERMS_UPDATED}. Autinerary is in beta.</p>
        <p className="mt-6 leading-relaxed text-slate-800">
          These are the rules for using Autinerary and ResourceHub, which share one account. They are an agreement between you
          and Autinerary Corp. (“we”). By making an account, or by using Autinerary, you agree to them. Our{' '}
          {link('/privacy', 'privacy page')} explains what we collect and why.
        </p>

        <Section id="short" title="The short version">
          <List>
            <li>Autinerary helps you plan and find services. It is not medical, legal or financial advice, and not a crisis service.</li>
            <li>Services listed in ResourceHub are run by other people. Check what matters with them; anything you agree is between you and them.</li>
            <li>Rate only what you have used, honestly. Don’t fake ratings, votes or reviews.</li>
            <li>Be kind to other people here, and don’t share anyone’s private information.</li>
            <li>What you post is yours; you let us show it in Autinerary.</li>
            <li>Autinerary is free during the beta. We will tell you before anything you use costs money.</li>
            <li>When paid plans start: a free first month with no card, then monthly or yearly, and you can cancel any time.</li>
          </List>
        </Section>

        <Section id="who" title="Who can use Autinerary">
          <List>
            <li>You must be 18 or older to make your own account.</li>
            <li>
              A parent or legal guardian can add someone under 18 from their own Family page. The parent or guardian manages
              that account and is responsible for how it is used.
            </li>
            <li>One account is for one person. Keep your password to yourself, and tell us if you think someone else is using your account.</li>
            <li>Give true information when you sign up, such as your date of birth.</li>
          </List>
        </Section>

        <Section id="what" title="What Autinerary is, and is not">
          <List>
            <li>
              Autinerary helps you set goals, plan steps, keep a calendar, and find services, products and people that may help.
              It does not diagnose anything, and nothing in it is medical, legal or financial advice. For that, ask a professional.
            </li>
            <li>
              It isn’t a crisis service. If you or someone else is in danger, call 911. In Canada you can call or text 9-8-8 at
              any time.
            </li>
            <li>
              Some features use AI to write plans and suggestions, and to understand a search typed as a sentence. AI can be
              wrong or out of date, so check anything important, and the decisions you make are yours. We label what AI wrote.
            </li>
            <li>Autinerary is in beta: features change, and some may stop or go wrong. We will try to tell you before something you rely on changes.</li>
          </List>
        </Section>

        <Section id="directory" title="Services in ResourceHub">
          <List>
            <li>
              Listings come from many places: OpenStreetMap (© OpenStreetMap contributors, under the Open Database License),
              services’ own websites, research we did, and people who use ResourceHub. Details such as hours, phone numbers,
              prices, and whether something is free can change or be wrong.
            </li>
            <li>“Free” or “Paid” is sometimes what that kind of place usually is; a service’s page says when.</li>
            <li>
              Services are run by other people and organisations, not by us. Listing a service does not mean we recommend it,
              checked it, or are responsible for what it does. Check with the service before you rely on it.
            </li>
            <li>
              Some services need a diagnosis first. Make sure you have one: Autinerary does not diagnose directly (yet).
            </li>
            <li>
              Some maps in ResourceHub are Google Maps. Using them is subject to the{' '}
              <a href="https://maps.google.com/help/terms_maps/" className="font-medium text-indigo-800 underline underline-offset-2">
                Google Maps/Google Earth Additional Terms of Service
              </a>{' '}
              and{' '}
              <a href="https://policies.google.com/privacy" className="font-medium text-indigo-800 underline underline-offset-2">
                Google’s Privacy Policy
              </a>
              . Other maps, and the 3D view, use OpenStreetMap’s data.
            </li>
          </List>
        </Section>

        <Section id="listings" title="Managing a listing (Resource Accounts)">
          <List>
            <li>
              If you run a service or sell a product listed in ResourceHub, you can make a Resource Account and claim its
              listing. We check by sending a code to the email the listing publishes, or the team checks another way.
            </li>
            <li>Claim only listings you are allowed to manage, and keep what you change true. Every change is kept, with what it was before, and the team can undo it.</li>
            <li>Ratings and comments come from people who used the service. You can’t change or remove them.</li>
            <li>
              A vendor can add products they sell, and a provider can add services they offer; the team checks each first. A vendor
              can offer discounts (for example for Autism Acceptance Month or back to school), and must honour the prices,
              discounts and codes they give.
            </li>
            <li>
              A vendor who sells through ResourceHub is the seller: they ship what they sell, handle returns and refunds as the law
              asks, and are responsible for the taxes on their sales. ResourceHub keeps a fee from each sale.
            </li>
            <li>
              You can ask for a promotion. A promotion is labelled “Sponsored”, appears only beside searches it matches, and
              only after the team approves it and turns sponsored listings on. We don’t show sponsored listings yet; before
              we do, we will update these terms and the privacy page.
            </li>
          </List>
        </Section>

        <Section id="team" title="Your team, meetings and agreements">
          <List>
            <li>
              Build a Team keeps track of the services you are considering or working with. Scheduling a meeting puts it in your
              calendar and keeps its details with your team. Nothing is sent to the service: you contact them yourself, for
              example with the email Autinerary drafts for you.
            </li>
            <li>A “free first visit” is the service’s own offer. Confirm it with them before you go.</li>
            <li>
              Any agreement you make with a service, about care, a place, a price or anything else, is between you and the
              service. Autinerary Corp. is not a party to it, does not write contracts for you, and does not give legal advice.
            </li>
            <li>If we add ways to send requests or sign forms through Autinerary, we will explain how they work, and who is responsible for what, before you use them.</li>
          </List>
        </Section>

        <Section id="ratings" title="Ratings, comments and how ratings are kept honest">
          <List>
            <li>
              Ratings come from people who have used a service. You can rate one when it is in your team, when you recommended
              it, or when you used it before you joined and send us proof at {mail(PROOF_EMAIL)} with the code you are given. We
              use the proof only to check, and delete it once we have.
            </li>
            <li>
              Rate only from your own experience, honestly and fairly. Don’t rate a business you own, work for or are paid by,
              or a competitor; don’t offer or accept anything for a rating; and don’t rate for someone else.
            </li>
            <li>Anyone signed in may comment on a service at any time. Comments follow the same rules as everything else you post.</li>
            <li>
              Each month we look at every service with at least five ratings. A service rated under 4 out of 5 gets a warning. At
              3.5 or under, it has two months to improve; if it is still 3.5 or under, it is hidden from search. Nothing is
              deleted, and it comes back as soon as new ratings bring it above 3.5. We may tell a service about its ratings at the
              email address it publishes.
            </li>
            <li>A rating is what people experienced, not a finding by Autinerary about a service.</li>
            <li>We may remove ratings, comments or votes that break these rules, and close accounts that fake them.</li>
          </List>
        </Section>

        <Section id="community-choice" title="Community’s Choice">
          <List>
            <li>Every month, anyone signed in can nominate services, shop items and articles, up to ten of each.</li>
            <li>
              In the month’s last week, our newsletter carries a vote among the most nominated. Each person, or newsletter
              subscriber, has one vote of each kind a month. The winners get the Community’s Choice badge.
            </li>
            <li>We may leave out nominations or votes that look automated, bought or organised to game the result.</li>
          </List>
        </Section>

        <Section id="posts" title="What you post">
          <List>
            <li>
              Ratings, comments, Tidbits posts and answers, messages, photos, stories and services you recommend are yours. You
              let us store and show them in Autinerary and ResourceHub, fit them to the page, and keep them while they are up,
              and in backups for a short time after you remove them.
            </li>
            <li>
              You are responsible for what you post. Post only what you have the right to share, and never anyone else’s private
              information. The{' '}
              <a href={`${HUB}/community/guidelines`} className="font-medium text-indigo-800 underline underline-offset-2">
                Tidbits guidelines
              </a>{' '}
              apply to posts and comments.
            </li>
            <li>You can remove your own comments and posts. We may remove anything that breaks these terms or the law.</li>
          </List>
        </Section>

        <Section id="conduct" title="What not to do">
          <List>
            <li>Break the law, or help someone else to.</li>
            <li>Harass, threaten, bully or demean anyone, or post hateful or sexual content.</li>
            <li>Pretend to be someone else, or misrepresent who you are connected to.</li>
            <li>Send spam or advertising, or collect other people’s information.</li>
            <li>Copy ResourceHub’s listings in bulk with scripts, or access Autinerary by automated means without our permission.</li>
            <li>Try to get into other accounts, test or break our security, or upload anything harmful.</li>
            <li>Use the AI features to make anything harmful, or to fake ratings, reviews or votes.</li>
          </List>
          <p>
            When you connect with people in Autinerary, you can report a message, and we may read reported messages to act on
            them.
          </p>
        </Section>

        <Section id="shop" title="The shop">
          <List>
            <li>
              ResourceHub’s shop lists products people find useful, what each is like, and where to get them. We check each one on
              its maker’s or seller’s own pages, but details can change or be wrong: check with the seller before you buy.
            </li>
            <li>Most products are bought from the seller, on the seller’s terms. Prices and discounts shown are the seller’s.</li>
            <li id="buying">
              <strong>Buying through ResourceHub</strong> (not on yet; we will tell you before it starts). For some products, a
              vendor may let you buy in ResourceHub. The vendor is the seller: you pay them, through Stripe, on their own account;
              they ship it and handle returns and refunds, under their terms and the law. We pass the vendor your name, email and
              shipping address so they can deliver. ResourceHub takes a fee from the vendor, not from you. If something goes wrong,
              tell the vendor first, then us.
            </li>
          </List>
        </Section>

        <Section id="emails" title="Emails and money">
          <List>
            <li>We send the emails your account needs, such as sign-in emails, notice of changes to these terms, and emails about a paid plan you choose. Newsletters and reminders come only if you choose them, and each says how to stop.</li>
            <li>Autinerary is free during the beta. If we ever charge for something you use, we will tell you first, and you will choose whether to pay (see Paid plans).</li>
          </List>
        </Section>

        <Section id="paid-plans" title="Paid plans">
          <p>
            Autinerary is free during the beta. When paid plans start, we will tell you first. This part applies to anyone who
            chooses a plan, and {link('/pricing', 'How Autinerary is paid for')} shows the prices.
          </p>
          <List>
            <li>
              <strong>The free month.</strong> Everyone gets a free first month of the app. It needs no card, and nothing is
              charged. When it ends, everything you added is kept, and you can choose a plan or free access.
            </li>
            <li>
              <strong>Plans.</strong> Monthly or yearly, at the prices on the pricing page, in Canadian dollars, plus GST or HST
              where it applies. There are no other fees. You pay by card through Stripe, which handles the payment; we never see
              your card number.
            </li>
            <li>
              <strong>When you pay.</strong> If you choose a plan during your free month, your first payment is when the month
              ends, and we email you a few days before. Otherwise, it is the day you choose. A plan renews each month or year
              until you cancel. We email you 60 to 75 days before a yearly plan renews.
            </li>
            <li>
              <strong>Cancelling.</strong> Cancel any time in Billing, with “Cancel my plan”. Your plan runs to the end of the
              time you have paid for, and you are not charged again. Unless the law gives you a refund, cancelling doesn’t
              refund time already paid for. If you were charged by mistake, tell us within 30 days and we will refund it.
            </li>
            <li>
              <strong>Changes.</strong> We will email you at least 30 days before a change to your price or plan, and you can
              cancel before it applies. A yearly plan’s price doesn’t change until it renews.
            </li>
            <li>
              <strong>Payments that don’t go through.</strong> We email you, and the payment is tried again over the next days.
              If it still doesn’t go through, your plan ends.
            </li>
            <li>
              <strong>Free access.</strong> Free access through a school, workplace, government or partner lasts as long as its
              code or agreement says, and a code is only for the people it was given to. Free access for explaining your
              situation is our decision, and we may ask you to renew it.
            </li>
            <li>When you choose a plan, we email you a copy of what you agreed to. Deleting your account cancels your plan.</li>
          </List>
        </Section>

        <Section id="ours" title="Our part">
          <List>
            <li>
              The app, its design and its writing belong to Autinerary Corp., apart from open-source parts and data under open
              licences, such as OpenStreetMap’s. You may use Autinerary for your own planning, and share what it gives you with
              the people helping you.
            </li>
            <li>We work to keep Autinerary running, safe and accurate, but we cannot promise it always will be, or that everything in it is right.</li>
          </List>
        </Section>

        <Section id="ending" title="Ending">
          <p>
            You can delete your account at any time in Settings. We may pause or close an account that breaks these terms or the
            law, or puts other people at risk. Where we can, we will tell you why, and you can ask us to look again.
          </p>
        </Section>

        <Section id="limits" title="Limits on responsibility">
          <List>
            <li>
              Autinerary is provided as it is. To the extent the law allows, we are not responsible for what services, sellers or
              other people do, for decisions you make using Autinerary, or for indirect losses.
            </li>
            <li>
              To the extent the law allows, our total responsibility to you for anything to do with Autinerary is limited to the
              greater of what you paid us in the 12 months before the claim (nothing, during the beta) and 100 Canadian dollars.
            </li>
            <li>
              If you break these terms on purpose, or break the law using Autinerary, and someone makes a claim against us
              because of it, you are responsible for that, to the extent the law allows.
            </li>
            <li>
              Nothing in these terms takes away rights you have by law, for example under Ontario’s Consumer Protection Act, 2002.
              If the law where you live does not allow a part of these terms, that part does not apply to you, and the rest still
              does.
            </li>
          </List>
        </Section>

        <Section id="law" title="The law, and disagreements">
          <p>
            These terms are under the laws of Ontario and of Canada. If something goes wrong, please tell us first, and we will
            try to sort it out within 30 days. Otherwise, the courts of Ontario decide, unless the law where you live lets you
            go to your own courts.
          </p>
        </Section>

        <Section id="changes" title="Changes to these terms">
          <p>
            We will update the date at the top, and tell you by email or in the app before a significant change. If you keep
            using Autinerary after a change takes effect, the new terms apply. If you don’t agree, you can delete your account.
          </p>
        </Section>

        <Section id="contact" title="Contact">
          <p>Questions about these terms: {mail(CONTACT_EMAIL)} (Autinerary Corp.). Proof that you used a service: {mail(PROOF_EMAIL)}.</p>
        </Section>

        <p className="mt-10 text-sm">
          <Link href="/" className="font-medium text-indigo-800 underline underline-offset-2">
            Back to Autinerary
          </Link>
        </p>
      </article>
    </div>
  )
}
