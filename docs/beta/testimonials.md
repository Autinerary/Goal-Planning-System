# Sharing your story with Autinerary

Riipen Labs' Group 11 recommended "short stories from a parent, a sibling,
and a neurodivergent adult ... shared with consent". This is the consent
text to send, followed by how the team handles the stories. Until real
stories are collected and approved, Autinerary shows none. Never write
stand-ins or "composite" quotes.

---

## For the person sharing their story

Please read this before you agree. It takes about 3 minutes. Questions at
any time: aayush@autinerary.ca

### What we are asking

We would like to share a short story about your experience with Autinerary,
in your own words. It can be written, recorded as audio, or filmed, as you
prefer. It is up to you, and saying no changes nothing about how you can use
Autinerary.

### What we would share

- Your words, in the final version you approve. We may shorten them, but we will not change what they mean.
- Your name the way you choose: your first name, your initials, or no name.
- If you agree: who you are in the story (for example "a parent" or "a sibling"), and your province.
- Your voice or face only if you choose audio or video. You can keep your camera off.

### Where, and for how long

- On the Autinerary website and app, and on Autinerary's social media accounts, as you choose below.
- For up to two years, or until you ask us to stop, whichever comes first.

### What we will not do

- Share anything about your health, a diagnosis, or anyone else's, unless you wrote it yourself and approved that exact text.
- Show your story in paid ads aimed at people.
- Sell it, or use it to train AI.

### Other people in your story

If your story mentions your child or someone else, please leave out their
name and anything that would identify them, unless they have agreed (for an
adult) or you are their parent or guardian and are comfortable sharing it.
We never show photos or names of children.

### Honest stories

Say what really happened, good and bad. We will not ask you to say anything
you don't believe. If we give you anything in return, such as a gift card,
we will say so next to your story.

### Changing your mind

You can ask us to take your story down at any time, without giving a reason.
We remove it from our website, app and accounts within 14 days. We cannot
recall copies that other people have already shared or saved.

### Agreeing

Reply to our email with your answers:

1. I am 18 or older. **(yes / no)**
2. I want to share my story as: **text / audio / video**
3. Show my name as: **first name / initials / no name**
4. You may say who I am in the story (for example "a parent"): **(yes / no)**
5. You may show my province: **(yes / no)**
6. You may share it on: **the Autinerary website and app / Autinerary's social media accounts / both**
7. I have seen the final version and approve it: **(yes, on [date])**. We send it to you before anything is shared.

---

## For the team

- **Ask, don't pressure.** Ask people who said in a session or check-in that Autinerary helped them, and mention it once. Ask a parent, a sibling and a neurodivergent adult, as Group 11 suggested.
- **Keep the consent record:** the person's answers above, the approved final version, and the date. Store them with the tester code (P01, P02, ...) in the restricted spreadsheet from the beta kit, for as long as the story is used and a year after.
- **Raw recordings** stay in the restricted folder and are deleted once the final version is approved.
- **Captions and transcripts** on every audio or video story, following the rules in [../voice.md](../voice.md).
- **Putting a recording on the site:** publish the story's text first (it is shown on its own card in "In their words"). Then put the edited file and its captions in `frontend/public/media/stories/`, and add an entry under the story's id to `STORY_RECORDINGS` in `frontend/lib/media.ts`. Its card then offers "Watch" or "Listen". If the recording says the approved text word for word, the text on the card is its transcript; if not, give the entry its own transcript.
- **Before publishing:** the person approved this exact version; nothing in it identifies a child or anyone who did not agree; any gift is disclosed next to it.
- **When someone withdraws:** remove the story everywhere within 14 days, delete the files, keep only a note that consent was withdrawn and when.
