/**
 * Starter kits for parents: two short, step-by-step guides with the places in
 * ResourceHub that can help, for anyone who arrives with an urgent, specific
 * need and no time for questions.
 *
 * Riipen Labs, Group 24 (September 2026), on caregivers of autistic children:
 * "Instantly serve ... starter packages when users skip profiling: Package A:
 * 'Ontario Autism Assessment & Pediatrician Navigator', Package B: 'School IEP &
 * Special Education Rights Checklist'", and "Surface 2 pre-curated 'Caregiver
 * Starter Kits' on the main dashboard". They also asked for credibility:
 * NN/G's "authorship and disclaimer frameworks" and a "Clinically Reviewed"
 * stamp from a volunteer clinical advisory board.
 *
 * Every fact below comes from the Government of Ontario page cited with it,
 * read on the date in `checked`; nothing is from memory. Each kit says who
 * wrote it, from what, when it was checked, and that it is not medical or
 * legal advice. `review` stays empty until a real clinician or advocate has
 * read the kit: only then does the page show "Reviewed by ...". Never fill it
 * in for anyone who has not. To recheck a kit, read its sources again, fix any
 * step that changed, and update `checked`.
 *
 * Used by app/kits (the pages), Start here (lib/startHere.ts), Quick Links
 * (lib/places.ts) and setup's "Skip to resources". Plain data, no imports
 * apart from types.
 */

export interface KitStep {
  title: string
  body: string
  /** A link that helps with this step, if there is one. */
  link?: { label: string; href: string }
}

/** A ResourceHub search anyone can open, as in Start here. */
export interface KitPlace {
  id: string
  label: string
  detail: string
  params: Record<string, string>
}

export interface KitSource {
  title: string
  publisher: string
  href: string
  /** The page's own "last updated" date, as it showed it. */
  updated: string
}

export interface StarterKit {
  id: 'assessment' | 'school'
  title: string
  /** Who it is for, in a few words. */
  forWhom: string
  summary: string
  steps: KitStep[]
  places: KitPlace[]
  /** Tidbits, ResourceHub's questions and answers: what to ask there. */
  ask: string
  sources: KitSource[]
  /** When the team last read every source against the steps (YYYY-MM-DD). */
  checked: string
  /** A real review, once there is one (Group 24's "Clinically Reviewed"). */
  review?: { by: string; role: string; on: string }
}

const SUPPORT_ORGS: KitPlace = {
  id: 'autism', label: 'Autism, ADHD and support organisations',
  detail: 'They know what help there is near you, and some run groups for parents.',
  params: { categories: 'Support Group' },
}

export const STARTER_KITS: StarterKit[] = [
  {
    id: 'assessment',
    title: 'Getting an autism assessment in Ontario',
    forWhom: 'Parents of a child or teen in Ontario',
    summary: 'From what you notice, to a written diagnosis, to the Ontario Autism Program: one step at a time.',
    steps: [
      {
        title: 'Write down what you notice',
        body: 'A few examples, with when and where they happened. A note on your phone is enough. It helps the doctor see what you see.',
      },
      {
        title: 'Talk to your child’s doctor',
        body: 'Your family doctor, pediatrician or nurse practitioner. Ask whether they can assess your child, or who they can refer you to.',
      },
      {
        title: 'Know who can diagnose',
        body: 'In Ontario: family physicians, pediatricians, developmental pediatricians, psychiatrists, psychologists, psychological associates and nurse practitioners. Ontario also has five diagnostic hubs, which assess and connect families with services in their community.',
        link: { label: 'The hubs and how to reach them', href: 'https://www.ontario.ca/page/autism-assessment-diagnosis' },
      },
      {
        title: 'Check the written diagnosis',
        body: 'It needs your child’s full name and date of birth, the date of the assessment, a statement that your child meets the criteria for autism spectrum disorder, and the professional’s name and credentials. You need it to register for the Ontario Autism Program.',
      },
      {
        title: 'Register with the Ontario Autism Program',
        body: 'For children and youth under 18 who live in Ontario. Register through AccessOAP, online or at 1-833-425-2445.',
        link: { label: 'AccessOAP', href: 'https://accessoap.ca' },
      },
      {
        title: 'Ask what your family can get',
        body: 'Once registered: foundational family services for every family, caregiver-mediated early years programs for children 12 to 48 months old, core clinical services, an entry to school program for kindergarten or grade 1, and urgent response services when a child has an immediate need.',
        link: { label: 'The Ontario Autism Program', href: 'https://www.ontario.ca/page/ontario-autism-program' },
      },
      {
        title: 'While you wait',
        body: 'If there is a wait, autism and ADHD organisations can tell you what is near you, and other parents in Tidbits can share what helped them.',
      },
    ],
    places: [
      SUPPORT_ORGS,
      { id: 'doctors', label: 'Doctors and health centres', detail: 'Clinics, family doctors and community health centres.', params: { categories: 'Doctor' } },
      { id: 'therapists', label: 'Therapists and counsellors', detail: 'Psychologists, counsellors and other therapists.', params: { categories: 'Therapist' } },
    ],
    ask: 'How long did your assessment take, and what helped while you waited?',
    sources: [
      { title: 'Autism assessment and diagnosis', publisher: 'Government of Ontario', href: 'https://www.ontario.ca/page/autism-assessment-diagnosis', updated: '10 March 2026' },
      { title: 'Ontario Autism Program', publisher: 'Government of Ontario', href: 'https://www.ontario.ca/page/ontario-autism-program', updated: '16 April 2026' },
    ],
    checked: '2026-10-12',
  },
  {
    id: 'school',
    title: 'Support at school and an IEP in Ontario',
    forWhom: 'Parents of a student in an Ontario school',
    summary: 'What an IEP and an IPRC are, how to ask for them, and what the school has to do.',
    steps: [
      {
        title: 'Start with the teacher',
        body: 'Share what you see at home, and ask what the school sees and what support it can give now. Keep short notes, with dates.',
      },
      {
        title: 'Ask about an IEP',
        body: 'An Individual Education Plan is a written plan of the special education program and services for your child. A school board can also make one for a student who gets special education support without being identified by an IPRC.',
      },
      {
        title: 'Ask for an IPRC in writing, if you want one',
        body: 'An Identification, Placement and Review Committee decides whether your child is identified as exceptional, and their placement. Write to the principal to ask for a meeting. Within 15 days the principal must acknowledge it, tell you in writing roughly when the committee will meet, and give you the board’s parents’ guide to special education.',
        link: { label: 'How the IPRC works', href: 'https://www.ontario.ca/page/identifying-students-special-education-needs' },
      },
      {
        title: 'Go to the meeting',
        body: 'You can attend, and so can your child if they are 16 or older. You can bring someone to support you, and share reports from doctors or therapists.',
      },
      {
        title: 'If you disagree',
        body: 'You can ask for a follow-up meeting within 15 days of the decision. You can also appeal, in writing to the school board’s secretary, within 30 days of the decision (or 15 days after a follow-up meeting’s decision).',
      },
      {
        title: 'The IEP itself',
        body: 'Once your child is placed in a special education program, the IEP must be done within 30 school days. The principal must consult you, and your child if they are 16 or older, and send you a copy. Every IEP includes a transition plan.',
        link: { label: 'What the rules say', href: 'https://www.ontario.ca/document/special-education-ontario-policy-and-resource-guide-kindergarten-grade-12/requirements' },
      },
      {
        title: 'Keep a folder',
        body: 'Copies of reports, the IEP, letters, and your notes from meetings, with dates. It makes the next meeting easier.',
      },
    ],
    places: [
      SUPPORT_ORGS,
      { id: 'schools', label: 'Schools and daycares', detail: 'Schools and daycares listed in ResourceHub.', params: { categories: 'School' } },
      { id: 'afterschool', label: 'After-school activities', detail: 'Sports, dance, swimming and other activities for after school.', params: { lifeAreas: 'afterschool' } },
    ],
    ask: 'What helped most in your child’s IEP or IPRC meeting?',
    sources: [
      { title: 'Identifying students with special education needs', publisher: 'Government of Ontario', href: 'https://www.ontario.ca/page/identifying-students-special-education-needs', updated: '23 May 2025' },
      { title: 'Special education in Ontario: requirements under Regulation 181/98', publisher: 'Government of Ontario', href: 'https://www.ontario.ca/document/special-education-ontario-policy-and-resource-guide-kindergarten-grade-12/requirements', updated: '14 May 2026' },
    ],
    checked: '2026-10-12',
  },
]

export const KIT_IDS = STARTER_KITS.map((k) => k.id)

export function starterKit(id: string | null | undefined): StarterKit | undefined {
  return STARTER_KITS.find((k) => k.id === id)
}

/** Who the kits are offered to first: people here for a child or another family member, or who support people at school or work. */
export const KIT_AUDIENCES = new Set(['child', 'family', 'work'])

/** "12 October 2026" for a YYYY-MM-DD date, in Toronto's calendar. */
export function kitDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${d} ${months[m - 1]} ${y}`
}

/** The steps someone has ticked, kept in this browser (no account needed). */
export const KIT_PROGRESS_KEY = 'autinerary_kit_progress'
