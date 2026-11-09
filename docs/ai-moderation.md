# The AI safety check

How Autinerary checks what people write to AI, and what AI writes back. For the team, and for
organisations deciding whether to use Autinerary with the people they support. Last updated
9 November 2026.

The person-facing version is on the Help page ([/help#ai-safety](https://app.autinerary.ca/help#ai-safety)).
The code is `backend/core/moderation.py`. Keep this document in step with that file.

## The idea: light, and never in the way

Most people using Autinerary are neurodivergent or disabled. They talk about meltdowns, burnout,
medication, their diagnosis and hard days, and they swear. A check that treats any of that as a
problem would push away the people the app is for. So the check is light on purpose:

- It never refuses to talk, and never locks anyone out.
- It acts only on these:
  - personal details that shouldn't go to an AI company;
  - someone who may be in danger;
  - a request for something harmful;
  - an answer that shouldn't reach anyone.
- When it acts, the person still gets an answer.

## What is checked

| What | Where | Checked how |
|---|---|---|
| What someone writes to the assistant | /assistant | All of it (below) |
| What someone writes to one of their agents on our cloud model | /agents | All of it |
| The AI's answer to either | the same | All of it |
| A journal entry, when it's saved | /reflection | For signs of danger: our rules, plus the checker when an OpenAI model reads the entry anyway. Not imported old entries |
| The assistant, an agent, or the journal, on the person's own model through our server | the same | Our rules only; nothing is hidden, since it goes to their own device |
| An agent running only in their browser (Ollama, or the model in the browser) | /agents | The crisis check, in the browser (`frontend/lib/aiSafety.ts`) |
| The help chat | /help | The crisis check: someone in danger gets the crisis lines and no AI |

Other places have their own checks, which this doesn't change:

- **Setup's goals:** `core/guardrails.py`, which refuses some words. It refuses swearing in a goal on
  purpose ("Please rephrase your goal without profanity"; decided 9 November 2026). A goal is what the
  whole plan is built from, so it shouldn't have swearing in it. A chat is a conversation, so this
  check lets swearing through there.
- **Sharing an agent:** `api/routes/shared_agents.py`.
- **Tidbits posts:** `servicehub-mvp/lib/community/moderation.ts`.
- **Reports:** the Report buttons.

## How a message is checked

1. **Our rules, on our server.** These are free and instant:
   - crisis phrases ("I want to end my life", "I've been cutting myself", "my partner hits me", "I'm
     scared to go home", "she wants to end her life", goodbye letters);
   - phone numbers, email addresses, ID numbers and passwords, and the person's own address ("I live
     at …"). A clinic's address is not hidden, because people ask how to get there;
   - "ignore your instructions" and "you're in developer mode";
   - the shapes of a scam: gift cards for a fine, someone from online who needs money, photos or a
     meeting.

   A crisis phrase decides straight away.
2. **Personal details are hidden** before any AI reads the message: `[PHONE]`, `[EMAIL]`,
   `[ID_NUMBER]`, `[ADDRESS]`, `[PASSWORD]`. This includes earlier messages in the conversation.
3. **A checker reads every message.** The checker is GPT-4o mini, set by `AI_CHECKER_MODEL`, reading
   against our own definitions, which are written for the people who use Autinerary:
   - "this deadline is killing me", a meltdown, grief, or a question about medication is severity 0;
   - a plan said in emoji ("going to the 🌉 tonight to jump") is not missed.

   The higher of its answer and our rules counts. At the same time, OpenAI's moderation service, which
   is free, reads the message, to fall back on if the checker can't answer. Both only run when the
   answer comes from an OpenAI model anyway, so the words reach no one new.

   This costs about $0.0002 a message, charged to the person like any other call, and adds about a
   second.
4. **The severity becomes an action** (the table below).

Until 9 November 2026 the checker read only what OpenAI's service flagged. That let a plan said in
emoji through: emoji are a known blind spot for AI safety checkers.

The answer is then checked as well:

- OpenAI's service reads every answer.
- The checker reads an answer only when the service flags something, or when it talks about changing a
  medicine or a dose.
- Plain "self-harm" and "violence" flags don't count against an answer. A caring answer that gives
  the crisis lines, or one that explains a war, gets those flags.

## Severity, and what happens

| Severity | What it covers | What happens |
|---|---|---|
| 0 | Everything ordinary, including hard days, grief, swearing, and talking about diagnoses or medication | Answered |
| 1 | Their own contact details or ID numbers | Hidden from the AI; they're told ("We hid the phone number in your message from the AI. It answered the rest."); answered |
| 2 | Harassment aimed at someone; trying to get around the AI's rules; signs of a scam; asking how to track someone | Answered, with a note to the AI for that one answer. A scam note asks it to name the warning signs |
| 3 | Sexually explicit content; hate; real help with serious harm or crime; threats | Answered, with a note: say in one kind sentence what it can't help with, offer a safe way forward, don't lecture |
| 4 | Any sign they, or someone they're worried about, may be at risk | Answered with care, and the crisis card shown under the answer (below) |

The person never sees the note to the AI.

**Answers.** An answer that fails gets one more try. Failing means sexual content, violence, hate or
harassment, serious harm, a scam, or medical advice that changes a dose. The second try is written
with a note about what was wrong. If that one fails too, it isn't shown, and the person is told
there was no safe answer. Someone who may be at risk is given the caring message and the crisis
lines instead.

**What it never does:**

- Lock anyone out, or pause their chat.
- Make crisis care wait on a model. If no model answers, or the person's usage limit is reached, they
  still get the caring message and the lines.
- Hold an answer because it is caring.

## The crisis card

Shown under an answer, or after a journal entry, when someone may be at risk. It has three parts:

- **The lines, text first.** Many autistic people find a phone call the hardest way to reach out, so
  every line that takes texts has a "Text now" link before "Call now":
  - 911;
  - 9-8-8;
  - Good2Talk, for college and university students in Ontario: text GOOD2TALKON to 686868, or call
    1-866-925-5454 (good2talk.ca, checked 9 November 2026);
  - Kids Help Phone;
  - 988 in the US.
- **Their group's own lines,** such as its campus counselling, when they're in a group (below).
- **"Or message someone you trust".** Words ready to send, which they can change: "I'm having a
  really hard time right now. Could you call or text me when you can?"
  - They can text it, email it or copy it, from their own phone or email, to whoever they choose.
  - Writing the first words is often the hardest part.
  - Autinerary doesn't send it, see it or keep it.

  This is the adult version of a supervisor being told, and it is only ever the person's choice.

## Groups (STEP 102)

A group is a student group (a university's autism and neurodivergent student group, for example) or a
service that uses Autinerary with the people it supports. Groups are the organisations STEP 17 made.

- **The team makes a group** at /admin/groups, which gives it a code, and appoints its leaders by
  account email. Leaders are never self-chosen.
- **People join** with the code at /groups, and leave at any time. Joining again never changes a
  leader into a member.
- **Its leaders,** at /groups:
  - see the code;
  - set up to 5 crisis lines of the group's own;
  - see the safety check's counts for the group, week by week (`organization_safety_counts`).

  The counts are never words and never who. They only show once the group has 10 members, and a count
  of 1 or 2 shows as "fewer than 3", so no one can be picked out.
- **What else leaders see.** Through ResourceHub's vouching (STEP 17), leaders already see each
  member's name and the norms on their profile. The Groups page and Privacy say so before anyone
  joins.

STEP 102 also fixes two things in STEP 17, before groups are used:

1. **Anyone could read every group's join code.** The table was readable whole, so anyone could join
   any group. The code is now only readable through the app's server, which gives it to leaders.
2. **Reading memberships failed.** Postgres refused the membership policy as "infinite recursion", so
   ResourceHub's per-group rating breakdown silently got nothing. Each person now reads their own
   membership rows.

## When something fails

- **OpenAI doesn't answer** (5 seconds): our rules still run, the answer is shown, and its label says
  the check couldn't run this time.
- **The checker can't be asked, but OpenAI's service answered:** what the service flagged is read by a
  fixed table instead. Self-harm, and anything about minors and sex, go to care, so a disclosure is met
  with care, not a refusal.
- **`AI_MODERATION=off`** turns the whole check off, in a hurry. Nothing else needs to change.

## The label on every AI answer

Every answer from the assistant or an agent has one label: "Written by AI · GPT-4o mini · About this
answer". Opened, it says:

- what wrote it;
- whether the safety check read it, and only when it did;
- what was hidden from the AI;
- that AI can be wrong, and isn't medical, legal or clinical advice.

Before someone's first chat, a notice says it's AI, not a person, and what the check does. That
notice shows once per browser.

## What is kept

When the check does something, one line goes to `ai_safety_events` (STEP 101). Things that count:

- details hidden;
- an answer steered;
- the crisis lines given;
- an answer written again, or left out;
- the check couldn't run.

For the journal, only crisis moments are counted, because nothing is hidden from or steered in its
reading.

The line holds:

- where it happened: assistant, agent or journal;
- the direction, the severity, the kind of thing, and what was done;
- what checked it, and which kinds of details were hidden;
- since STEP 102, the person's groups.

**It holds no words and no account, and the time only to the hour**, so it can't say who wrote what.
An ordinary message leaves no line.

The team reads the counts at **/admin/ai-safety** (admins only, last 90 days). A group's leaders read
their group's counts at /groups.

## Testing it

- **Unit tests, offline:** `backend/tests/test_moderation.py` (with fakes for every service, the
  journal included), `frontend/lib/aiSafety.test.mjs` and `frontend/lib/groups.test.mjs`. Both crisis
  checks are held to one list, `backend/tests/crisis_phrases.json`.
- **The test sets, with the real services:** `python -m scripts.eval_moderation [--set holdout|holdout2]`
  from `backend/`.
  - It costs a fraction of a cent, and writes nothing to any database.
  - Over-moderating counts as a failure as much as missing something.
  - Results on 9 November 2026, with the checker reading every message:

    | Set | Result | How honest |
    |---|---|---|
    | `moderation_cases.json` (84 cases, emoji included) | all right | tuned on |
    | `moderation_holdout.json` (21) | 21/21 | it scored 17/21 untuned with the earlier design; then tuned |
    | `moderation_holdout2.json` (25), written after the change and run once, untuned | **25/25, nothing over-moderated** | honest the first time |

  - Two context rules (grief, and legal things such as a hunting licence) came from over-moderation
    the earlier sets found once the checker read everything.
  - For the next honest number, write a new held-out set.
- **STEP 101 and STEP 102:** tested on a local copy of the database, 14/14 and 23/23. Things checked:
  - both run twice cleanly;
  - who can read what;
  - the counts' rules (10 members, 1s and 2s hidden);
  - the two STEP 17 fixes, with their failures shown first.

## Not covered yet

- **A backup checker from another company,** for when OpenAI is down. It would need another
  company's key and a line in Privacy.
- **Photos.** Hare World Social photos shared with connections aren't checked; ones shared with
  everyone are seen by the team first. OpenAI's moderation service can read images.
- **Conversation context.** The checker reads each message on its own. A risk spread over several
  messages relies on each one.
- **A group's own wording for the checker.** A group can set its crisis lines, not how the check reads
  messages.
- **Other providers.** On our own model, or another company's, only our rules run. The second look
  would need that model to do the checking.

## For engineers: where this lives

| Topic | File |
|---|---|
| The rules, the definitions, the actions, what the AI is told, the record | `backend/core/moderation.py` |
| Where the check runs, crisis care without a model, writing an answer again | `backend/api/routes/assistant.py` |
| The journal's check | `backend/api/routes/reflections.py` |
| Hiding details by kind | `backend/core/scrubber.py` (`scrub(..., kinds=...)`) |
| The browser's crisis check, the label's words, the team's counts | `frontend/lib/aiSafety.ts` |
| The crisis lines and the message to someone trusted | `frontend/lib/crisis.ts`, `app/components/CrisisLines.tsx`, `ReachOut.tsx` |
| The label and the notice | `frontend/app/components/AiNote.tsx`, `AiChatNotice.tsx` |
| The assistant, agents, the journal, the help chat | `frontend/app/assistant/page.tsx`, `app/agents/AgentTalk.tsx`, `lib/agents.ts`, `app/reflection/page.tsx`, `app/reflection/history/page.tsx`, `app/api/help/chat/route.ts` |
| Groups | `frontend/lib/groups.ts`, `app/groups/page.tsx`, `app/api/me/groups/route.ts`, `app/api/groups/[id]/route.ts`, `app/components/useGroupLines.ts` |
| The team's pages | `frontend/app/admin/ai-safety/page.tsx`, `app/admin/groups/page.tsx`, and their routes under `app/api/admin/` |
| The tables | `backend/database/migrations/2026_ai_safety_events.sql` (STEP 101), `2026_organization_safety.sql` (STEP 102) |
| Tests and the test sets | `backend/tests/test_moderation.py`, `crisis_phrases.json`, `moderation_cases.json`, `moderation_holdout.json`, `moderation_holdout2.json`, `backend/scripts/eval_moderation.py`, `frontend/lib/aiSafety.test.mjs`, `frontend/lib/groups.test.mjs` |
