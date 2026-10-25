/**
 * What each page is for, and how to use it: the guide "How it works" opens
 * for the page someone is on (components/PageGuide.tsx).
 *
 * Riipen Labs, Group 23 (September 2026): "Update the tour button so it opens
 * guidance specific to the page the user is currently viewing, shifting the
 * messaging from labeling buttons to explaining the core purpose of each
 * screen"; the tour "focuses strictly on labeling individual UI buttons rather
 * than explaining page-level workflows or teaching users how to accomplish
 * core tasks". So each guide says what the page is for, how to do its main
 * job in a few steps, and how it connects to the rest. Each was checked
 * against the page it describes (12 October 2026); change both together.
 *
 * `tourPart` is the tour's part about the same page, if there is one
 * (components/InteractiveDemo.tsx, STEPS), so "Take the tour" starts there.
 * Plain data and one pure function; tested by lib/pageGuides.test.mjs.
 */

export interface PageGuide {
  /** The page's name, as people see it. */
  name: string
  /** What the page is for, in one or two sentences. */
  purpose: string
  /** How to do the main thing here. */
  steps: string[]
  /** How it connects to the rest of the app. */
  connects?: string
  tourPart?: number
}

const GUIDES: [RegExp, PageGuide][] = [
  [/^\/path\/?$/, {
    name: 'Your Path',
    purpose: 'Your home base. It shows the one thing to do next in your plan, and the places you use most.',
    steps: [
      'Open your next step to see what to do, and the tools that can help.',
      'Use Quick Links for the places you use most; “All places” lists everything.',
      'Display changes how the app looks. “Show more” adds more to this page, and “Simplify” takes it away again.',
      '“Getting started” has a few things to try first. After it, “Complete your profile” has optional questions that make suggestions fit you; they are in Your profile too.',
    ],
    connects: 'Each step you tick off in Races brings up the next one here.',
    tourPart: 1,
  }],
  [/^\/milestones\/[^/]+\/?$/, {
    name: 'A step of your plan',
    purpose: 'One step of your plan: what it is about, and the tools and services that can help with it.',
    steps: [
      'Look through the recommended tools. Open any that might help.',
      'Open the Calendar to see when this step’s tasks are planned.',
      'When the step is done, tick it off in Races, and the next one opens.',
    ],
    connects: 'Tools you keep go to Pit Stop. If you are stuck, the assistant and Tidbits can help.',
    tourPart: 2,
  }],
  [/^\/milestones\/?$/, {
    name: 'Milestone View',
    purpose: 'Your current step, the tools suggested for it, and ways to get help if you are stuck.',
    steps: [
      'Read the summary at the top: it names your current step.',
      'Open “Tools to Use” to see what can help, and rate how well a tool worked.',
      'Stuck? Make a Tidbit, ask a mentor, or ask the assistant.',
    ],
    connects: 'Your steps, one by one, are in Races.',
    tourPart: 2,
  }],
  [/^\/calendar\/?$/, {
    name: 'Your Calendar',
    purpose: 'Your week, at your energy. It spreads your plan’s tasks over the days, and fits each day to how much energy you have.',
    steps: [
      'Pick today’s energy: low, balanced or high. The day changes to fit it. Then, if you like, a Sunny Day or a Grey Day.',
      'Add your own task with “+ Add task”. If you don’t know how long it takes, choose “Not sure”.',
      'Choose Day, Week or Month, in List View or Time Blocks, and move back and forward through the dates.',
      'Analysis shows your daily, weekly and monthly patterns, and your best days.',
    ],
    connects: 'Ticks here count on your Path and in Life Stats. The local forecast is there if you turn it on.',
    tourPart: 3,
  }],
  [/^\/races\/?$/, {
    name: 'Races',
    purpose: 'Your goals, each set out as a race of small steps. It is your own race at your own pace, not a contest.',
    steps: [
      'Track View shows your steps as a trail; List View shows them as a checklist.',
      'Tick a step when it is done. Your Path then shows the next one.',
      'A new plan starts with one area of your life; the others open when you finish your first step.',
    ],
    connects: 'Each step has its own page, with tools that can help.',
  }],
  [/^\/tasks(\/|$)/, {
    name: 'Task View',
    purpose: 'Today’s small tasks, and a page for each one with tricks that help you do it.',
    steps: [
      'Tick a task when it is done, or open it: its tricks, the Motivation Wheel to spin once as you start, and “I’ve done it”.',
      '“Stop for now” leaves a note to future you; it comes back on a task’s page.',
      'Turn on Companion to have your spirit animal with you. Drag it to any corner, or keep it on top of your other windows.',
      // One-click sign-up (lib/signups.ts), while it is switched on.
      ...(process.env.NEXT_PUBLIC_ONE_CLICK_SIGNUP === 'on'
        ? ['“Sign me up” on a resource fills in that service’s own sign-up form for you; “Sign up for all” does all of this step’s services, once you say yes.']
        : []),
    ],
    connects: 'Tasks are planned across your week in the Calendar. When you finish one, you can keep the moment in your Memories.',
  }],
  [/^\/pit-stop(\/|$)/, {
    name: 'Pit Stop',
    purpose: 'The tools you kept for your steps, in one place.',
    steps: ['Find a tool you saved, and open it when you need it.', 'Add more from a step’s page, or from ResourceHub.'],
  }],
  [/^\/hare-world(\/|$)/, {
    name: 'Hare World',
    purpose: 'The people side of Autinerary: friends, mentors and role models, Collab Groups, Relationships and Hare World Social.',
    steps: [
      'Add a friend or a mentor by searching their name. Open their card to send a note of support, book a call or work on a goal together.',
      'Collab Groups: make one, or join one by its name or its code.',
      'Relationships: join to meet people on a similar path. A match is a friend request they can accept or not.',
      'Hare World Social: moments from finished tasks and milestones. Yours are in Memories.',
    ],
    connects: 'People you connect with can follow your progress, if you both agree. On each person’s card you choose what they see: Share, Restrict or Private.',
  }],
  [/^\/reflection(\/|$)/, {
    name: 'Journal',
    purpose: 'A place to write how things went, and to look back on what is working.',
    steps: [
      'Choose “New Entry” and answer the questions you want to.',
      '“All Entries” shows what you wrote before.',
      '“Quick Note to Self” keeps a thought for later. It is in your Memories, and comes back on a task’s page if you ask.',
    ],
    connects: 'What you write can help the app adjust your plan.',
  }],
  [/^\/recommend-choices\/?$/, {
    name: 'Suggestions for each step',
    purpose: 'Ideas for each step of your plan, written with AI from your goal, with real ratings from people who used them.',
    steps: ['Sort by highest rated or most reviewed.', 'Open a suggestion to see more. “Not yet rated” means nobody has rated it yet.'],
  }],
  [/^\/tools\/?$/, {
    name: 'Tools & Resources',
    purpose: 'Tools that can help with your steps, by norm.',
    steps: ['Search, or choose a norm to see the tools for it.', 'Open a tool in ResourceHub to read more or save it.'],
  }],
  [/^\/stats\/?$/, {
    name: 'Life Stats',
    purpose: 'How your plan is going, in numbers: commitment, streaks and steps done.',
    steps: ['Look back over your week. Numbers fill in as you tick steps off.'],
  }],
  [/^\/character\/?$/, {
    name: 'Character creator',
    purpose: 'A 3D character that looks like you, or how you would like to look. It is new, and on its own page while the team tries it; your 2D character is unchanged.',
    steps: ['Choose a part on the left (body, skin, face, hair and so on), then pick from its choices.', 'Turn the character by dragging it, or with the turn buttons; Pose, Attire and Environment are on the right.', 'Press Save character to keep it on your account.'],
    connects: 'Your 2D character, on Dream Self and the race track, stays as it is.',
  }],
  [/^\/ideal-self\/?$/, {
    name: 'Ideal Self',
    purpose: 'Your Dream Self: a picture of who you are working toward, and your character on the race track.',
    steps: ['Design your character, and describe your Dream Self, whenever you like. It is optional.', 'Add role models and mentors who inspire you.'],
  }],
  [/^\/family(\/|$)/, {
    name: 'Family',
    purpose: 'For a parent or legal guardian: add a child under 18, and support their account.',
    steps: ['Add a child, then review and approve what they can use.'],
  }],
  [/^\/path-market\/?$/, {
    name: 'Path Market',
    purpose: 'Plans other people made for goals like yours, to follow or borrow from.',
    steps: ['Pick a life category, then a path. Its goals become ideas for a new plan.'],
  }],
  [/^\/profile\/settings\/?$/, {
    name: 'Settings',
    purpose: 'Change who you are here for, emails and reminders, the language, and how much of the app you see.',
    steps: ['Find the section you want; each change saves as you make it.', 'Accessibility has text size, contrast, calm motion and spoken descriptions.'],
  }],
  [/^\/profile(\/|$)/, {
    name: 'Your profile',
    purpose: 'Your name, what friends see, and every optional question in one place.',
    steps: ['“Complete your profile” lists the optional questions; answer any of them, any time.'],
  }],
  [/^\/kits(\/|$)/, {
    name: 'Starter kits',
    purpose: 'Step-by-step guides for parents in Ontario, with places that can help.',
    steps: ['Open a kit and tick each step as you go. Your ticks stay on this device.', 'Each kit says where its facts come from, and when they were checked.'],
  }],
  [/^\/start\/?$/, {
    name: 'Starter resources',
    purpose: 'A few good places to start, for who you are here for and what you need today.',
    steps: ['Answer two quick questions, then open any of the resources.', 'Three more questions, optional, make the list fit you better.'],
  }],
  [/^\/help\/?$/, {
    name: 'What things are called',
    purpose: 'Every name in Autinerary, in plain words, and who to call if you need help now.',
    steps: ['Search this page, or pick a section from the list at the top.'],
  }],
  [/^\/assistant\/?$/, {
    name: 'Assistant',
    purpose: 'Ask a question about your plan or the app, in your own words.',
    steps: ['Type your question. It is labelled as AI, and it is not medical advice.'],
  }],
]

/** The guide for a page, or null when there is none yet. */
export function pageGuideFor(pathname: string): PageGuide | null {
  return GUIDES.find(([pattern]) => pattern.test(pathname))?.[1] ?? null
}

/** Pages with a guide, for the test. */
export const GUIDE_PATTERNS = GUIDES.map(([pattern]) => pattern)
