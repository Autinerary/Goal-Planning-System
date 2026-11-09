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
| The assistant or an agent on the person's own model, through our server | the same | Our rules only; nothing is hidden, since it goes to their own device |
| An agent running only in their browser (Ollama, or the model in the browser) | /agents | The crisis check, in the browser (`frontend/lib/aiSafety.ts`) |
| The help chat | /help | The crisis check: someone in danger gets the crisis lines and no AI |

Other places have their own checks, which this doesn't change:

- **Setup's goals:** `core/guardrails.py`, which refuses some words.
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
3. **OpenAI's moderation service** reads the message, with the details already hidden. It's free.
   This only happens when the answer comes from an OpenAI model anyway, so the words reach no one
   new.
4. **A second look, only for what the service flags.** A checker model (GPT-4o mini, set by
   `AI_CHECKER_MODEL`) reads the message against our own definitions. The definitions are written for
   the people who use Autinerary: "this deadline is killing me", a meltdown, or a question about
   medication is severity 0. The higher of its answer and our rules counts.
5. **The severity becomes an action** (the table below).

The answer is then checked the same way. Two points about answers:

- Plain "self-harm" and "violence" flags don't count against an answer. A caring answer that gives
  the crisis lines, or one that explains a war, gets those flags.
- An answer that tells someone to start, stop or change a medicine or a dose always gets the second
  look.

## Severity, and what happens

| Severity | What it covers | What happens |
|---|---|---|
| 0 | Everything ordinary, including hard days, swearing, and talking about diagnoses or medication | Answered |
| 1 | Their own contact details or ID numbers | Hidden from the AI; they're told ("We hid the phone number in your message from the AI. It answered the rest."); answered |
| 2 | Harassment aimed at someone; trying to get around the AI's rules; signs of a scam; asking how to track someone | Answered, with a note to the AI for that one answer. A scam note asks it to name the warning signs |
| 3 | Sexually explicit content; hate; real help with serious harm or crime; threats | Answered, with a note: say in one kind sentence what it can't help with, offer a safe way forward, don't lecture |
| 4 | Any sign they, or someone they're worried about, may be at risk | Answered with care, and the crisis lines (9-8-8, 911, Kids Help Phone) shown under the answer |

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

## When something fails

- **OpenAI's service doesn't answer** (5 seconds): our rules still run, the answer is shown, and its
  label says the check couldn't run this time.
- **The checker can't be asked:** what the service flagged is read by a fixed table instead. Self-harm,
  and anything about minors and sex, go to care, so a disclosure is met with care, not a refusal.
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

The line holds where it happened (assistant or agent), the direction, the severity, the kind of
thing, what was done, what checked it, and which kinds of details were hidden. **It holds no words
and no account, and the time only to the hour**, so it can't say who wrote what. An ordinary message
leaves no line.

The team reads the counts at **/admin/ai-safety** (admins only, last 90 days).

## Testing it

- **Unit tests, offline:** `backend/tests/test_moderation.py` (with fakes for every service) and
  `frontend/lib/aiSafety.test.mjs`. Both crisis checks are held to one list,
  `backend/tests/crisis_phrases.json`.
- **The test set, with the real services:** `python -m scripts.eval_moderation` from `backend/`.
  - It costs a fraction of a cent: OpenAI's moderation service is free, and the checker reads only
    what the service flags.
  - Over-moderating counts as a failure as much as missing something.
  - It writes nothing to any database.
  - Results on 9 November 2026:
    - `moderation_cases.json`: 76/76, after tuning on it.
    - `moderation_holdout.json`, written afterwards and run once, untuned: 17/21, with **nothing
      over-moderated**. It missed a fake doctor's note, a romance scam, goodbye letters, and an
      insulting answer. The last three were then fixed. The doctor's note is left on purpose: the AI
      itself declines it, and rules for every case like it would start to catch ordinary messages.
  - For the next honest number, write a new held-out set.
- **STEP 101:** tested on a local copy of the database. It runs twice cleanly. The team can read the
  lines; nobody else can read or write them. The checks refuse words in a column.

## Not covered yet

- **The journal.** An entry is read by AI for its notes, without this check. A crisis phrase there
  doesn't show the lines yet.
- **Organisations.** There's no view or settings per organisation (a university group, a service) yet:
  no counts for one group, no wording of its own, no local crisis line. The table can't be split by
  group, because it keeps no accounts. A group view would need the group recorded with each line,
  never the person.
- **Setup.** Setup still refuses swearing in a goal ("Please rephrase your goal without profanity").
  That is stricter than this check.
- **Other providers.** On our own model, or another company's, only our rules run. The second look
  would need that model to do the checking.

## For engineers: where this lives

| Topic | File |
|---|---|
| The rules, the definitions, the actions, what the AI is told, the record | `backend/core/moderation.py` |
| Where the check runs, crisis care without a model, writing an answer again | `backend/api/routes/assistant.py` |
| Hiding details by kind | `backend/core/scrubber.py` (`scrub(..., kinds=...)`) |
| The browser's crisis check, the label's words, the team's counts | `frontend/lib/aiSafety.ts` |
| The label and the notice | `frontend/app/components/AiNote.tsx`, `AiChatNotice.tsx` |
| The assistant, agents, the help chat | `frontend/app/assistant/page.tsx`, `app/agents/AgentTalk.tsx`, `lib/agents.ts`, `app/api/help/chat/route.ts` |
| The team's page | `frontend/app/admin/ai-safety/page.tsx`, `app/api/admin/ai-safety/route.ts` |
| The table | `backend/database/migrations/2026_ai_safety_events.sql` (STEP 101) |
| Tests and the test sets | `backend/tests/test_moderation.py`, `crisis_phrases.json`, `moderation_cases.json`, `moderation_holdout.json`, `backend/scripts/eval_moderation.py`, `frontend/lib/aiSafety.test.mjs` |
