"""Build the Vector agent-evaluation deck (per-agent ground truth, label
distributions, confidence formulas) for the follow-up review requested by
Malikeh on 2026-09-16, revised 2026-09-17 after Odosa's slide-by-slide
feedback and a correction to the underlying user-count query (see
docs/vector-evaluation-presentation.md, section 0, for the retraction).

Speaker notes carry the spoken script; slides stay sparse. Every figure is
either a direct query result from backend/scripts/vector_evaluation_pull.py
and vector_evaluation_pull_servicehub.py (both re-run 2026-09-17 after fixing
a pagination bug), or a formula read verbatim out of the named agent file.

CONFIDENTIAL — internal only, not for external distribution.

Run:  python scripts/build_deck_evaluation.py     (from backend/)
"""
from __future__ import annotations

from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches, Pt

OUT = Path(__file__).resolve().parents[2] / "docs" / "autinerary-vector-evaluation-deck.pptx"

TEAL = RGBColor(0x0F, 0x76, 0x6E)
DARK = RGBColor(0x0F, 0x17, 0x2A)
GREY = RGBColor(0x52, 0x52, 0x5B)
LIGHT = RGBColor(0xF0, 0xFD, 0xFA)
AMBER = RGBColor(0xB4, 0x53, 0x09)
RED = RGBColor(0x9F, 0x1D, 0x1D)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)

W, H = Inches(13.333), Inches(7.5)


def textbox(slide, x, y, w, h, text, size=18, bold=False, color=DARK,
            align=PP_ALIGN.LEFT, space_after=6):
    box = slide.shapes.add_textbox(x, y, w, h)
    tf = box.text_frame
    tf.word_wrap = True
    lines = text.split("\n") if isinstance(text, str) else text
    for i, line in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.text = line
        p.alignment = align
        p.space_after = Pt(space_after)
        for run in p.runs:
            run.font.size = Pt(size)
            run.font.bold = bold
            run.font.color.rgb = color
            run.font.name = "Helvetica Neue"
    return box


def slide_base(prs, title, kicker=None):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    bar = s.shapes.add_shape(1, Inches(0), Inches(0), W, Inches(0.12))
    bar.fill.solid()
    bar.fill.fore_color.rgb = TEAL
    bar.line.fill.background()
    if kicker:
        textbox(s, Inches(0.6), Inches(0.32), Inches(11.5), Inches(0.3),
                kicker.upper(), size=12, bold=True, color=TEAL)
    textbox(s, Inches(0.6), Inches(0.62), Inches(12.2), Inches(0.8),
            title, size=28, bold=True, color=DARK)
    return s


def table(slide, x, y, w, headers, rows, col_w=None, font=13, row_h=0.36):
    shape = slide.shapes.add_table(len(rows) + 1, len(headers), x, y, w,
                                   Inches(row_h * (len(rows) + 1)))
    t = shape.table
    if col_w:
        for i, cw in enumerate(col_w):
            t.columns[i].width = Inches(cw)
    for i, htxt in enumerate(headers):
        c = t.cell(0, i)
        c.text = htxt
        for p in c.text_frame.paragraphs:
            for r in p.runs:
                r.font.size = Pt(font)
                r.font.bold = True
                r.font.color.rgb = WHITE
        c.fill.solid()
        c.fill.fore_color.rgb = TEAL
    for ri, row in enumerate(rows, start=1):
        for ci, val in enumerate(row):
            c = t.cell(ri, ci)
            c.text = str(val)
            for p in c.text_frame.paragraphs:
                for r in p.runs:
                    r.font.size = Pt(font)
                    r.font.color.rgb = DARK
            c.fill.solid()
            c.fill.fore_color.rgb = WHITE if ri % 2 else LIGHT
    return t


def note(slide, text):
    slide.notes_slide.notes_text_frame.text = text.strip()


def callout(slide, x, y, w, h, text, color=AMBER, bg=None):
    box = slide.shapes.add_shape(1, x, y, w, h)
    box.fill.solid()
    box.fill.fore_color.rgb = bg or RGBColor(0xFF, 0xFB, 0xEB)
    box.line.color.rgb = color
    box.line.width = Pt(1.25)
    tf = box.text_frame
    tf.word_wrap = True
    tf.margin_left = Inches(0.2)
    tf.margin_top = Inches(0.1)
    lines = text.split("\n") if isinstance(text, str) else text
    for i, line in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.text = line
        for r in p.runs:
            r.font.size = Pt(13)
            r.font.color.rgb = RGBColor(0x78, 0x35, 0x0F) if color == AMBER else color
            r.font.name = "Helvetica Neue"
    return box


def code_box(slide, x, y, w, h, text, size=12):
    box = slide.shapes.add_shape(1, x, y, w, h)
    box.fill.solid()
    box.fill.fore_color.rgb = RGBColor(0x0F, 0x17, 0x2A)
    box.line.fill.background()
    tf = box.text_frame
    tf.word_wrap = True
    tf.margin_left = Inches(0.15)
    tf.margin_top = Inches(0.08)
    lines = text.split("\n") if isinstance(text, str) else text
    for i, line in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.text = line
        for r in p.runs:
            r.font.size = Pt(size)
            r.font.name = "Menlo"
            r.font.color.rgb = RGBColor(0x5E, 0xEA, 0xD4)
    return box


def agent_slide(prs, kicker, name, desc, ground_truth, formula, provenance,
                 dist_rows, dist_headers, gap, note_text, extra=None, col_w=None):
    """Standard per-agent layout: description, ground truth + formula (left),
    real data + gap (right), optional extra callout spanning the bottom."""
    s = slide_base(prs, name, kicker)
    textbox(s, Inches(0.6), Inches(1.4), Inches(12.2), Inches(0.55), desc,
            size=14, color=GREY)
    textbox(s, Inches(0.6), Inches(1.95), Inches(6.0), Inches(0.3),
            "Ground truth", size=13, bold=True, color=TEAL)
    textbox(s, Inches(0.6), Inches(2.25), Inches(6.0), Inches(1.15),
            ground_truth, size=12, color=DARK)
    textbox(s, Inches(0.6), Inches(3.5), Inches(6.0), Inches(0.3),
            "Formula", size=13, bold=True, color=TEAL)
    code_box(s, Inches(0.6), Inches(3.8), Inches(6.0), Inches(0.75), formula, size=11)
    textbox(s, Inches(0.6), Inches(4.65), Inches(6.0), Inches(1.0),
            provenance, size=11, color=GREY)

    right_y = Inches(1.95)
    if dist_rows:
        table(s, Inches(6.9), right_y, Inches(5.8), dist_headers,
              dist_rows, col_w=col_w, font=12, row_h=0.34)
        right_y = right_y + Inches(0.34 * (len(dist_rows) + 1)) + Inches(0.15)
    if gap:
        callout(s, Inches(6.9), right_y, Inches(5.8), Inches(1.3), gap,
                color=RED, bg=RGBColor(0xFE, 0xF2, 0xF2))
        right_y = right_y + Inches(1.3) + Inches(0.15)
    if extra:
        callout(s, Inches(6.9), right_y, Inches(5.8), Inches(7.2) - right_y,
                extra, bg=LIGHT, color=TEAL)

    note(s, note_text)
    return s


def build() -> None:
    prs = Presentation()
    prs.slide_width, prs.slide_height = W, H

    # ---------- 1. title ----------
    s = prs.slides.add_slide(prs.slide_layouts[6])
    bg = s.shapes.add_shape(1, Inches(0), Inches(0), W, H)
    bg.fill.solid()
    bg.fill.fore_color.rgb = TEAL
    bg.line.fill.background()
    textbox(s, Inches(1), Inches(2.1), Inches(11.3), Inches(1.2),
            "Agent Evaluation & Data Gap Analysis", size=42, bold=True, color=WHITE)
    textbox(s, Inches(1), Inches(3.15), Inches(11.3), Inches(0.9),
            "Ground truths, label distributions, and confidence formulas for all six agents",
            size=20, color=RGBColor(0xCC, 0xFB, 0xF1))
    textbox(s, Inches(1), Inches(5.6), Inches(11.3), Inches(0.5),
            "Vector / Darmond Follow-Up  ·  September 2026  ·  Internal / Confidential",
            size=14, color=RGBColor(0x99, 0xF6, 0xE4))
    note(s, "Last time we showed data volume without evaluation depth. This "
            "revision also corrects a counting bug from this morning's draft "
            "and folds in Odosa's review \u2014 both are called out explicitly, "
            "not quietly fixed.")

    # ---------- 2. housekeeping ----------
    s = slide_base(prs, "Real user numbers, corrected", "Housekeeping")
    table(s, Inches(0.6), Inches(1.5), Inches(12.1),
          ["", "Morning draft (wrong)", "Corrected"],
          [["Total accounts", "50", "339"],
           ["Real signups", "41", "70"],
           ["Team / QA / dev test", "9", "19"],
           ["Synthetic seed accounts", "0", "250"]],
          col_w=[3.7, 4.2, 4.2], font=14, row_h=0.42)
    callout(s, Inches(0.6), Inches(3.5), Inches(12.1), Inches(1.1),
            "This morning's script only ever read the 50 most-recently-created "
            "accounts. The synthetic seed cohort (250 users, all created in one "
            "batch on July 12) was never gone \u2014 it was outside the window the "
            "broken query could see.")
    callout(s, Inches(0.6), Inches(4.75), Inches(12.1), Inches(0.85),
            "The recent cluster of real signups (~60 in Sept 8-17) is "
            "Riipen-sourced \u2014 confirmed, not an open question.", bg=LIGHT, color=TEAL)
    callout(s, Inches(0.6), Inches(5.75), Inches(12.1), Inches(1.35),
            "RETRACTED: this morning's deck said 88 completed-milestone rows and "
            "515/519 ratings pointed at nonexistent accounts. That was the same "
            "counting bug, not a real problem \u2014 every one of those rows matches "
            "a real account once the full list is read. Retracted, not softened.",
            color=RED, bg=RGBColor(0xFE, 0xF2, 0xF2))
    note(s, "Before anything else: two corrections to what went out this "
            "morning.\n\n"
            "One, the user counts were wrong because of a bug in our own query "
            "\u2014 it only ever looked at the fifty most recent accounts. The real "
            "total is 339, not 50. Seventy of those are real organic signups, "
            "not forty-one. And the two hundred fifty synthetic seed accounts "
            "we said were gone were never gone \u2014 they were just outside the "
            "window the broken query could see.\n\n"
            "Two \u2014 and this is the one to really sit with \u2014 the data integrity "
            "problem we flagged this morning, the eighty-eight completed "
            "milestones and the ratings that supposedly pointed at deleted "
            "accounts, was the same bug. It was not a real problem. We are "
            "retracting that finding outright, not softening it. Every one of "
            "those rows belongs to a real, currently-existing account.\n\n"
            "We're leading with this because the whole point of this deck is "
            "not presenting a number we can't explain \u2014 and that includes our "
            "own mistakes.")

    # ---------- 3. framework ----------
    s = slide_base(prs, "Six agents, one honesty rule", "Framework")
    table(s, Inches(0.6), Inches(1.5), Inches(12.1),
          ["Agent", "Job"],
          [["Path Planning", "Builds the milestone plan for a user's goals"],
           ["Pattern Recognition", "Finds similar users, surfaces what worked for them"],
           ["Tool Recommendation", "Matches resources to a milestone's barriers"],
           ["Calendar Optimization", "Places tasks into a barrier-aware weekly schedule"],
           ["Reflection Analysis", "Reads sentiment/patterns from journal entries"],
           ["Adaptation", "Adjusts the plan when reflection or completion signals change"]],
          col_w=[3.4, 8.7], font=13, row_h=0.4)
    callout(s, Inches(0.6), Inches(4.9), Inches(12.1), Inches(1.0),
            "Confidence is always derived from something measured this run, "
            "never a flat constant. Zero signal -> 0.0, not a default.", bg=LIGHT, color=TEAL)
    callout(s, Inches(0.6), Inches(6.0), Inches(12.1), Inches(1.0),
            "On the numbers INSIDE each formula: these are engineering-chosen "
            "weights (a floor + a scaling curve), not statistically fitted "
            "parameters. Each slide says which is which.", color=AMBER)
    note(s, "Six agents, same rule: confidence is derived from real signal in "
            "that run, never a flat constant, and zero signal is reported as "
            "zero.\n\n"
            "One addition this time: for every formula, we're now explicit "
            "about where the actual numbers inside it come from. Most of them "
            "are engineering judgment calls \u2014 a floor here, a scaling weight "
            "there \u2014 not something fitted to real outcome data, because we "
            "don't have enough labelled outcomes to fit them yet. Saying that "
            "plainly is better than letting a formula look more precise than "
            "it is.")

    # ---------- 4. Path Planning ----------
    agent_slide(
        prs, "Agent 1 of 6", "Path Planning Agent",
        "Given goals + barriers, builds a path of milestones. Each milestone "
        "is tagged nameSource: 'generated' (LLM wrote it for this user) or "
        "'template' (fallback list shared by everyone in that life area).",
        "No external gold-standard path exists. Real signal: how much of "
        "this plan was actually written for this user, per nameSource.",
        "confidence = 0.35 + 0.6 * (generated / total_milestones)",
        "0.35 and 0.6 are CHOSEN, not fitted: 0.35 is a floor (a templated "
        "plan is still usable), 0.6 is the range up to a 0.95 ceiling. Not "
        "yet validated against real outcomes.",
        [["Real paths", "48"],
         ["Milestones/path (mean)", "30.9"],
         ["Milestones/path (range)", "16 - 144"]],
        ["Metric", "Value"],
        "Gap: the generated-vs-template split isn't logged in queryable form "
        "yet -- it's in the payload, not extracted.",
        "Odosa: should this extend to milestone- and path-level user "
        "ratings, like Tool Recommendation already has? Tool Recommendation "
        "has tool_outcomes (reflection-derived reward per tool+barrier). "
        "Path Planning's path_planning_outcomes is whole-profile only -- "
        "NOTHING rates one milestone against the barrier it targeted, or "
        "rolls that up into a path-level score (e.g. 7/14 milestones useful "
        "= half a path's value). Real, buildable gap, same pattern as "
        "tool_outcomes.",
        "nameSource is a recorded fact, not a guess \u2014 was this milestone's "
        "name written by the LLM for this user, or pulled from the shared "
        "template list. The 0.35 and 0.6 in the formula are choices we made, "
        "not numbers we measured \u2014 point that out plainly if asked. And on "
        "Odosa's extension idea: Tool Recommendation already does something "
        "close to what she's describing. Path Planning doesn't yet. That's a "
        "real, scoped gap, not a research problem.",
        col_w=[3.5, 2.3],
    )

    # ---------- 5. Pattern Recognition ----------
    agent_slide(
        prs, "Agent 2 of 6", "Pattern Recognition Agent \u2014 the 0.2 question",
        "Embeds ONE user's profile, searches for similar users via a Remote "
        "Procedure Call (RPC) \u2014 a stored database function \u2014 called "
        "find_similar_pattern_users. Per-user retrieval, not population-wide.",
        "This is NOT a group-pattern-mining agent \u2014 it never looks at the "
        "whole population, only one query at a time. (The agent that does "
        "mine group patterns is on slide 10.)",
        "confidence = min(similar_users_returned / 10, 1.0)",
        "10 requested and the RPC's 0.7 match threshold are both CHOSEN, not "
        "derived. The RPC's own similarity score is NOT used \u2014 measured "
        "directly, it sits near 1.0 for every result regardless of quality.",
        [["Real users embedded", "36 (corrected from 16)"],
         ["Requested per query", "10"],
         ["A real query found", "2 comparable"]],
        ["Metric", "Value"],
        "36, not 16 -- \"just need more users\" is a weaker complete answer "
        "now. Could also mean these 2 matches were the only close ones among "
        "36 -- worth separately investigating match threshold vs. genuine "
        "profile diversity.",
        "Odosa: should users confirm whether the returned group actually "
        "looks similar to them? Yes -- nothing like that exists today. Only "
        "indirect signal via reflections. Would need new instrumentation, "
        "same outcome-table pattern as tool_outcomes / adaptation_outcomes.",
        "First: no bare acronyms \u2014 RPC is Remote Procedure Call, spelled out "
        "on the slide. Second, and this is a real scope correction: this "
        "agent only ever looks at one person at a time. It does not mine "
        "patterns across the population \u2014 that's a different agent, on "
        "ResourceHub's side, slide ten. On the 0.2 number itself: the real "
        "embedded pool is thirty-six people, not sixteen like we said this "
        "morning. That changes the story slightly \u2014 it's not purely 'too few "
        "users,' it might also mean these two were genuinely the closest "
        "matches in a pool of thirty-six.",
        col_w=[3.5, 2.3],
    )

    # ---------- 6. Tool Recommendation ----------
    agent_slide(
        prs, "Agent 3 of 6", "Tool Recommendation Agent",
        "Matches tools/resources to a milestone's barriers.",
        "Community ratings on the resource, PLUS a learned reward from "
        "tool_outcomes (reflection-derived, per tool+barrier) already folded "
        "into ranking.",
        "evidence = 0.6 + 0.4*(rated/total)\nconfidence = mean_relevance * evidence",
        "0.6 / 0.4 are CHOSEN: a floor so relevance counts even with zero "
        "reviews, plus weight for real community evidence. Not fitted.",
        [["Approved resources", "95"],
         ["Employment (category)", "5"],
         ["Housing (category)", "4"]],
        ["Category", "Count"],
        "Gap: review-coverage across the 95 approved resources not yet "
        "queried -- direct ceiling on this agent's confidence.",
        "Odosa: does this (or any agent) consider PEOPLE \u2014 mentors, role "
        "models, friends, rivals? NO. The connections table exists in the "
        "schema and is fully modelled \u2014 no agent in either system reads it. "
        "Real, clean gap. Whether to build a combined \"Tool & People "
        "Recommendation Agent\" or just wire connections into this one's "
        "scoring is a real design choice, not something to default into.",
        "Correction from this morning: this formula isn't rating-only, it "
        "already blends in a learned reward from past reflections. On "
        "people: this is a real gap across the whole product, not just this "
        "agent. We store role models, mentors, friends and rivals. Nothing "
        "reads that table for a recommendation, in either Autinerary or "
        "ResourceHub.",
        col_w=[3.7, 2.1],
    )

    # ---------- 7. Calendar Optimization ----------
    agent_slide(
        prs, "Agent 4 of 6", "Calendar Optimization Agent",
        "Places a week's tasks into a barrier-aware daily schedule.",
        "In plain terms: graded on producing a SENSIBLE week, not on "
        "clearing the whole backlog. A real run placed 30 of 80 backlogged "
        "tasks in one week \u2014 correct, not a failure: 80 tasks across 16 "
        "milestones is genuinely several weeks of real work, and cramming it "
        "all in would be actively bad for the user.",
        "fill = days_with_work / total_days\nconfidence = fill * (1.0 if "
        "preferred_buckets else 0.75)",
        "1.0 / 0.75 are CHOSEN: full credit when we know the user's "
        "preferred time-of-day, a lower cap when we're working with less "
        "information. Not fitted against real satisfaction data.",
        [], [],
        "Gap: real per-user weekly fill rate hasn't been pulled across the "
        "actual user base yet.",
        "Odosa asked us to make the ground truth here more legible, so in "
        "plain terms: this agent is not judged on whether it emptied your "
        "whole to-do list. It's judged on whether the WEEK it built makes "
        "sense -- a reasonable amount each day, nothing crammed, nothing "
        "empty for no reason. A schedule that forced eighty tasks into seven "
        "days would look more complete and would actually be worse for the "
        "person using it.",
    )

    # ---------- 8. Reflection Analysis ----------
    agent_slide(
        prs, "Agent 5 of 6", "Reflection Analysis Agent",
        "Sentiment + pattern extraction from a journal/reflection entry.",
        "Length and pattern-density of what was actually written. A "
        "one-word entry can't score as high as a paragraph \u2014 a hard floor.",
        "depth = min(words/60,1.0)\nsignal = min(patterns/3,1.0)\n"
        "confidence = 0.3 + 0.5*depth + 0.2*signal   (0.0 if empty)",
        "60 words, 3 patterns, and the 0.3/0.5/0.2 split are all CHOSEN "
        "judgment calls, untested against real data on whether they're the "
        "right cutoffs.",
        [], [],
        "Gap: entry-length distribution across real reflections hasn't been "
        "pulled for this pass.",
        "Every number in this formula is a judgment call, not a measurement "
        "-- sixty words as 'a real reflection,' three patterns as 'plenty of "
        "signal,' and the weighting between the two. None of it has been "
        "tested against whether it actually predicts anything real yet.",
    )

    # ---------- 9. Adaptation ----------
    agent_slide(
        prs, "Agent 6 of 6", "Adaptation Agent",
        "Adjusts milestones/tasks/accommodations based on reflection and "
        "completion signals.",
        "Today: whether the agent found something to adapt at all. Zero "
        "adaptations is a real, different answer from low confidence.",
        "confidence = min(0.4 + 0.15 * adaptations_fired, 1.0)   (0.0 if none)",
        "0.4 / 0.15 CHOSEN: a floor once anything changed, plus credit per "
        "adaptation, capping near 4 adaptations.",
        [["adaptation_outcomes rows", "0"]],
        ["Metric", "Value"],
        "Correction: we said no events log existed. WRONG \u2014 a table "
        "(adaptation_outcomes) already exists with a next_reflection_reward "
        "slot for exactly this. It has zero rows because nothing writes to "
        "it yet \u2014 smaller gap than \"build from scratch.\"",
        "Odosa: this is weak \u2014 firing more adaptations isn't evidence they "
        "worked. Correct, and sharper than our own framing. Her fix: "
        "explicit yes/no when suggested, re-ask after a week if it helped, "
        "score both. Maps directly onto the unused adaptation_outcomes "
        "table \u2014 needs (1) writes turned on, (2) an explicit prompt added "
        "alongside the passive reflection signal.",
        "Two things here. First, a correction: we told you this morning "
        "there was no log at all for this agent. That was wrong \u2014 the table "
        "exists, it's just never been written to. Second, Odosa's critique "
        "is the sharper point: right now this agent gets MORE confident the "
        "more things it changes, regardless of whether any of them actually "
        "helped. Her fix \u2014 ask, then re-ask a week later \u2014 is a real upgrade, "
        "and it fits directly into infrastructure that's already sitting "
        "there unused.",
        col_w=[3.5],
    )

    # ---------- 10. ResourceHub overview ----------
    s = slide_base(prs, "ResourceHub has its own agent system", "Four more agents")
    textbox(s, Inches(0.6), Inches(1.4), Inches(12.2), Inches(0.7),
            "Everything so far is Autinerary's path-planning orchestrator. "
            "ResourceHub (servicehub-mvp) runs a SEPARATE set of four agents, "
            "same Supabase project, own LLM client, own orchestrator.",
            size=14, color=GREY)
    table(s, Inches(0.6), Inches(2.3), Inches(12.2),
          ["Agent", "Job"],
          [["Recommendation Agent", "Matches people to resources (collaborative filtering + LLM explanation)"],
           ["Pattern Agent", "Discovers patterns across the whole user population, unprompted"],
           ["Validation Agent", "Approves / rejects / flags submitted content and ratings"],
           ["Synthesis Engine", "Combines the three above into one ranked, explained result"]],
          col_w=[3.4, 8.7], font=14, row_h=0.5)
    callout(s, Inches(0.6), Inches(4.85), Inches(12.2), Inches(1.5),
            "Finding common to Recommendation + Validation: ResourceHub's 519 "
            "ratings ALL belong to team/test/synthetic seed personas "
            "(autism_parent@test.com, etc) -- 0 from a real organic user yet. "
            "Both agents ultimately wait on the same gap: real people rating "
            "real resources.", bg=LIGHT, color=TEAL)
    note(s, "Presenting six agents without these four would be presenting "
            "half the product. ResourceHub has its own recommendation, "
            "pattern, validation and synthesis agents, running on the same "
            "database but otherwise fully separate.\n\n"
            "The finding here is calmer than what we said this morning: those "
            "five hundred nineteen ratings aren't orphaned or broken. They "
            "all belong to our own test personas \u2014 that's seed data working "
            "exactly as intended. The real gap is just that zero of them are "
            "from an actual person using the product.")

    # ---------- 11. Recommendation Agent (ResourceHub) ----------
    agent_slide(
        prs, "ResourceHub \u00b7 Agent 1 of 4", "Recommendation Agent",
        "Collaborative filtering against similar users' ratings, LLM "
        "explanation layer, cross-session memory. Cold-start fallback ranks "
        "approved resources directly when no neighbours are found.",
        "Similar users' ratings on a resource. Cold-start avoids 'no results.'",
        "confidence = min(similarUsers/50,1.0)*50 + (avgScore/100)*50",
        "50/50 split and the /50 denominator are CHOSEN: equal weight to "
        "'enough comparable people' and 'how good the match looks,' since "
        "either alone can mislead. Not derived from data.",
        [["Approved resources", "95"],
         ["Have >=1 rating", "72 (76%)"],
         ["...from a real user", "0 (all seed)"]],
        ["Metric", "Value"],
        "The 'similar users' half of this formula has no real signal yet -- "
        "all 519 ratings are seed/test data (slide 10).",
        "Same people/mentors question as Tool Recommendation: no, this "
        "agent doesn't read the connections table either.",
        "Seventy-six percent of approved resources have a rating, which "
        "sounds solid until you ask whose \u2014 and per the last slide, none of "
        "them are from a real user yet.",
        col_w=[3.7, 2.2],
    )

    # ---------- 12. Pattern Agent (ResourceHub) ----------
    s = slide_base(prs, "Pattern Agent", "ResourceHub \u00b7 Agent 2 of 4 \u2014 group patterns?")
    textbox(s, Inches(0.6), Inches(1.4), Inches(12.2), Inches(0.6),
            "The direct answer to today's question: is there an agent that "
            "finds patterns BETWEEN groups and WITHIN groups, unsupervised?",
            size=14, bold=True, color=TEAL)
    textbox(s, Inches(0.6), Inches(2.05), Inches(12.2), Inches(0.4),
            "Short answer: partially, and only here. Autinerary's Pattern "
            "Recognition Agent (slide 5) is per-user only.", size=13, color=DARK)
    table(s, Inches(0.6), Inches(2.6), Inches(6.0),
          ["This agent DOES", ""],
          [["Within-group co-occurrence", "e.g. Autism+ADHD cluster together"],
           ["Resource affinity", "population-level collaborative filtering"],
           ["Unexpected preferences", "which barrier types over-index on a resource"]],
          col_w=[2.6, 3.4], font=11, row_h=0.5)
    table(s, Inches(6.9), Inches(2.6), Inches(5.8),
          ["This agent does NOT do", ""],
          [["Between-named-group compare", "e.g. Autism community vs. an ethnic community"],
           ["Subtype-level compare", "e.g. Autism Level 1 vs. Level 3 -- see note"]],
          col_w=[2.6, 3.2], font=11, row_h=0.65)
    callout(s, Inches(6.9), Inches(4.75), Inches(5.8), Inches(1.6),
            "Subtype data (Level 1/2/3, etc.) is deliberately stripped before "
            "any agent sees it, by design. Enabling that comparison means "
            "relaxing a privacy boundary on purpose -- a considered decision, "
            "not a small code change.", color=RED, bg=RGBColor(0xFE, 0xF2, 0xF2))
    callout(s, Inches(0.6), Inches(4.75), Inches(6.0), Inches(1.6),
            "Real data: 48 real users have barrier data; 25 have >=2 distinct "
            "types -- below the default 5-user minimum for most combinations "
            "to surface. Same fix as Autinerary's Pattern Recognition: more "
            "real users.", bg=LIGHT, color=TEAL)
    note(s, "This slide directly answers the question raised for today: is "
            "there an agent that finds overarching patterns, between groups "
            "and within groups, unsupervised, rather than one person at a "
            "time?\n\n"
            "Partially, and only here, on the ResourceHub side. This agent "
            "does look at the whole population: which conditions cluster "
            "together, which resources tend to get liked by the same people, "
            "which barrier types over-index on a given resource. All "
            "unsupervised, all population-level.\n\n"
            "What it does not do, and this matters: it doesn't compare named "
            "groups against each other \u2014 Autism community versus an ethnic "
            "community, for instance \u2014 and it cannot compare diagnosis "
            "subtypes, Level 1 against Level 3, because that subtype detail "
            "is deliberately stripped out before any agent ever sees it. "
            "That's a real privacy boundary we built on purpose. Turning it "
            "on for this would be a considered decision, not a small change, "
            "and it should be made explicitly rather than as a side effect.")

    # ---------- 13. Validation Agent ----------
    agent_slide(
        prs, "ResourceHub \u00b7 Agent 3 of 4", "Validation Agent",
        "Four independent checks (Content Quality, Spam, User Trust, "
        "Behavioral) -> approve / reject / flag for review.",
        "The four check scores themselves. Wide 'flag for review' middle "
        "band is deliberate -- uncertain cases go to a person on purpose.",
        "confidence = mean(4 check scores)\napprove: trust>70 & quality>80 & "
        "spam<30\nreject: trust<30 OR quality<40 OR spam>=70",
        "70/80/30 and 30/40/70 are CHOSEN cutoffs, not fitted. Trust score: "
        "baseline 50, capped +/- adjustments for age, contributions, votes, "
        "violations -- all chosen caps, not fitted weights.",
        [["moderation_queue rows", "0"]],
        ["Metric", "Value"],
        "The approve/reject/flag logic runs, but nothing has been logged to "
        "evaluate it against real decisions yet -- zero ground truth so far.",
        "We can show you the formula and the thresholds. We cannot yet show "
        "you how often this agent was right, because the table that would "
        "let us check has zero rows in it.",
        col_w=[3.0],
    )

    # ---------- 14. Synthesis Engine (own slide per Odosa) ----------
    s = slide_base(prs, "Synthesis Engine", "ResourceHub \u00b7 Agent 4 of 4")
    textbox(s, Inches(0.6), Inches(1.5), Inches(12.2), Inches(0.8),
            "Combines Recommendation + Pattern + Validation into one ranked, "
            "explained result. Filters out anything Validation rejected, "
            "generates explanations, bandit-refines the synthesis strategy "
            "against learned reward when enough signal exists.",
            size=15, color=DARK)
    callout(s, Inches(0.6), Inches(2.7), Inches(12.2), Inches(1.6),
            "Ground truth: none independently. Synthesis Engine's correctness "
            "is entirely a function of the three agents it combines -- there "
            "is no separate metric to evaluate it on its own.", bg=LIGHT, color=TEAL)
    callout(s, Inches(0.6), Inches(4.5), Inches(12.2), Inches(1.6),
            "If any of Recommendation, Pattern, or Validation's real-data gaps "
            "above aren't closed, Synthesis can't be meaningfully evaluated "
            "either -- it inherits every upstream gap.", color=AMBER)
    note(s, "This gets its own slide because it's a genuinely different kind "
            "of thing to evaluate. It doesn't have its own ground truth \u2014 "
            "it's only as good as the three agents feeding it. Every gap we "
            "just walked through upstream is also a gap here.")

    # ---------- 15. gap summary ----------
    s = slide_base(prs, "What this tells us to prioritize", "Gap analysis")
    table(s, Inches(0.6), Inches(1.45), Inches(12.2),
          ["Agent", "Status", "What would move it"],
          [["Pattern Recognition (Autinerary)", "Pool bigger than thought (36)", "More real users with embeddings"],
           ["Tool Recommendation", "Formula solid, query missing", "Review-coverage across 95 resources"],
           ["Path Planning", "No milestone-level validation yet", "Extract nameSource; design rating loop"],
           ["Calendar Optimization", "Formula solid, query missing", "Real per-user weekly fill rate"],
           ["Reflection Analysis", "Formula solid, query missing", "Entry-length distribution"],
           ["Adaptation", "Infra exists, unused (0 rows)", "Wire up writes + explicit yes/no loop"],
           ["Recommendation (ResourceHub)", "Ratings are all seed data", "Get real users rating real resources"],
           ["Pattern (ResourceHub)", "Explained, expected", "More users with >=2 barrier types (25)"],
           ["Validation (ResourceHub)", "No decision log yet", "Start logging to moderation_queue"]],
          col_w=[3.2, 3.2, 5.7], font=11, row_h=0.42)
    callout(s, Inches(0.6), Inches(6.15), Inches(12.2), Inches(1.0),
            "Most rows are queries against data we already have, or "
            "infrastructure that already exists and needs wiring up -- not "
            "new experiments. Both Pattern agents share the same root fix.",
            bg=LIGHT, color=TEAL)
    note(s, "Pulling all nine agents together: most already compute an "
            "honest confidence score from real signal, or have the "
            "infrastructure sitting there ready to. The gap is mostly "
            "queries we haven't run and wiring we haven't turned on, not new "
            "research.")

    # ---------- 16. close ----------
    s = slide_base(prs, "What we need from this group", "Close")
    callout(s, Inches(0.6), Inches(1.8), Inches(12.2), Inches(2.0),
            "October beta timing: hold ResourceHub's public launch to "
            "waitlist + feature demo only, OR move fast on data-compliance "
            "work, before going fully public for Autism Awareness Month.\n"
            "Sharper for ResourceHub specifically -- a community rating "
            "system scoring things like 'autism-friendliness' sits closer to "
            "the medical-device-classification line than the planning "
            "agents do.", color=AMBER)
    textbox(s, Inches(0.6), Inches(4.2), Inches(12.2), Inches(1.2),
            "Everything in this deck is reproducible: backend/scripts/"
            "vector_evaluation_pull.py + vector_evaluation_pull_servicehub.py, "
            "plus every agent source file cited.",
            size=13, color=GREY)
    note(s, "One thing we need a steer on: October timing. We can go out as "
            "a waitlist and feature demo for Autism Awareness Month without "
            "waiting on full compliance, or we hold the public launch until "
            "the data-compliance work is done. This is sharper for "
            "ResourceHub than for Autinerary's planning agents \u2014 a rating "
            "system that scores something like autism-friendliness is closer "
            "to the line Malikeh flagged around medical device "
            "classification. That's a call this group needs to make with us.")

    prs.save(OUT)
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    build()
