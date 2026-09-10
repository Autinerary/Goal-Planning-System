"""Build the Vector / Darmond presentation deck.

Speaker notes carry the spoken script, so the slides stay sparse and the
presenter is not reading the wall. Every figure here is verified against the
live Supabase project or a measured agent run — see docs/vector-presentation.md
for provenance.

Run:  python scripts/build_deck.py     (from backend/)
"""
from __future__ import annotations

from pathlib import Path

from pptx import Presentation
from pptx.chart.data import CategoryChartData
from pptx.dml.color import RGBColor
from pptx.enum.chart import XL_CHART_TYPE, XL_LEGEND_POSITION
from pptx.enum.text import PP_ALIGN
from pptx.util import Emu, Inches, Pt

OUT = Path(__file__).resolve().parents[2] / "docs" / "autinerary-vector-deck.pptx"

TEAL = RGBColor(0x0F, 0x76, 0x6E)
DARK = RGBColor(0x0F, 0x17, 0x2A)
GREY = RGBColor(0x52, 0x52, 0x5B)
LIGHT = RGBColor(0xF0, 0xFD, 0xFA)
AMBER = RGBColor(0xB4, 0x53, 0x09)
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
        textbox(s, Inches(0.7), Inches(0.38), Inches(11), Inches(0.3),
                kicker.upper(), size=12, bold=True, color=TEAL)
    textbox(s, Inches(0.7), Inches(0.7), Inches(12), Inches(0.8),
            title, size=34, bold=True, color=DARK)
    return s


def table(slide, x, y, w, headers, rows, col_w=None, font=14, row_h=0.36):
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


def callout(slide, x, y, w, h, text, color=AMBER):
    box = slide.shapes.add_shape(1, x, y, w, h)
    box.fill.solid()
    box.fill.fore_color.rgb = RGBColor(0xFF, 0xFB, 0xEB)
    box.line.color.rgb = color
    box.line.width = Pt(1.25)
    tf = box.text_frame
    tf.word_wrap = True
    tf.margin_left = Inches(0.2)
    tf.margin_top = Inches(0.12)
    p = tf.paragraphs[0]
    p.text = text
    for r in p.runs:
        r.font.size = Pt(14)
        r.font.color.rgb = RGBColor(0x78, 0x35, 0x0F)
        r.font.name = "Helvetica Neue"
    return box


def build() -> None:
    prs = Presentation()
    prs.slide_width, prs.slide_height = W, H

    # ---------- 1. title ----------
    s = prs.slides.add_slide(prs.slide_layouts[6])
    bg = s.shapes.add_shape(1, Inches(0), Inches(0), W, H)
    bg.fill.solid()
    bg.fill.fore_color.rgb = TEAL
    bg.line.fill.background()
    textbox(s, Inches(1), Inches(2.4), Inches(11.3), Inches(1.2),
            "Autinerary", size=54, bold=True, color=WHITE)
    textbox(s, Inches(1), Inches(3.5), Inches(11.3), Inches(0.9),
            "Agentic life planning for people facing intersecting barriers",
            size=22, color=RGBColor(0xCC, 0xFB, 0xF1))
    textbox(s, Inches(1), Inches(5.6), Inches(11.3), Inches(0.5),
            "Vector / Darmond Program Review  ·  8 September 2026",
            size=15, color=RGBColor(0x99, 0xF6, 0xE4))
    note(s, "Opening. Keep it to one line: we build AI life-planning for "
            "neurodivergent people and people facing systemic barriers.")

    # ---------- 2. market ----------
    s = slide_base(prs, "Four segments, defined by relationship", "1 · Market & scope")
    textbox(s, Inches(0.7), Inches(1.6), Inches(12), Inches(0.5),
            "Focus groups pushed us to narrow scope:", size=17, color=GREY)
    for i, seg in enumerate(["Parent", "Sibling", "Diagnosed", "Non-diagnosed"]):
        card = s.shapes.add_shape(1, Inches(0.7 + i * 3.05), Inches(2.2),
                                  Inches(2.8), Inches(1.1))
        card.fill.solid()
        card.fill.fore_color.rgb = LIGHT
        card.line.color.rgb = TEAL
        tf = card.text_frame
        tf.paragraphs[0].text = seg
        tf.paragraphs[0].alignment = PP_ALIGN.CENTER
        for r in tf.paragraphs[0].runs:
            r.font.size = Pt(20)
            r.font.bold = True
            r.font.color.rgb = TEAL
    textbox(s, Inches(0.7), Inches(3.7), Inches(12), Inches(1.6),
            ["These are relationship segments, not diagnosis segments.",
             "Our own data shows why."],
            size=20, color=DARK)
    callout(s, Inches(0.7), Inches(4.8), Inches(11.9), Inches(1.5),
            "3 real users → 9 distinct co-occurring conditions between 2 of them.\n"
            "Nobody arrives with one clean label.")
    note(s, "We ran focus groups, and they pushed us to narrow scope to four "
            "segments: parents, siblings, diagnosed, and non-diagnosed.\n\n"
            "Our own data says the same thing. We have three real users. Between "
            "two of them: nine distinct conditions.\n\n"
            "Nobody arrives with one clean label. That is why we segment by "
            "relationship to the diagnosis, not by the diagnosis itself.")

    # ---------- 3. the nine conditions ----------
    s = slide_base(prs, "What two real users actually reported", "1 · Market & scope")
    table(s, Inches(0.7), Inches(1.7), Inches(11.9),
          ["Condition", "Category"],
          [["Anxiety (×2)", "Mental health"],
           ["Autism", "Neurodivergence"],
           ["AuDHD", "Neurodivergence"],
           ["Sensory Processing Disorder", "Neurodivergence"],
           ["Auditory Processing Disorder", "Neurodivergence"],
           ["PTSD", "Mental health"],
           ["Mood disorders", "Mental health"],
           ["First Generation", "Systemic"],
           ["Immigrant / Refugee", "Systemic"]],
          col_w=[7.4, 4.5], font=13, row_h=0.4)
    textbox(s, Inches(0.7), Inches(6.0), Inches(11.9), Inches(0.9),
            "Sample size is three. Reported as a qualitative observation, "
            "not a distribution.", size=14, color=GREY)
    note(s, "Point at the categories column: neurodivergence, mental health and "
            "systemic status in the same two people.\n\n"
            "Be first to say the sample is three. Saying it before they ask is "
            "the whole difference.")

    # ---------- 4. real vs synthetic ----------
    s = slide_base(prs, "What is real, and what is not", "2 · Seed data")
    table(s, Inches(0.7), Inches(1.7), Inches(11.9),
          ["Population", "Count", "Status"],
          [["Real signups", "3", "Real"],
           ["Synthetic accounts", "47", "Generated for load / correctness testing"],
           ["Orphaned barrier records", "218", "Legacy seed, no auth user"]],
          col_w=[3.6, 1.4, 6.9], font=15, row_h=0.45)
    callout(s, Inches(0.7), Inches(3.8), Inches(11.9), Inches(1.5),
            "The synthetic barrier spread is near-uniform (Dyslexia 10, ADHD 10, "
            "Autism 10, Chronic illness 10…).\nThat uniformity is an artefact of "
            "generation. We do not present it as market signal.")
    textbox(s, Inches(0.7), Inches(5.6), Inches(11.9), Inches(0.8),
            "Every figure in this deck is labelled real or synthetic.",
            size=17, bold=True, color=TEAL)
    note(s, "Being direct about what is real: three real signups, forty-seven "
            "synthetic accounts for load testing.\n\n"
            "The synthetic distribution is deliberately uniform — it is "
            "generated, so we do not present it as market signal.\n\n"
            "Volunteering this costs nothing and buys credibility for everything "
            "else on the slide.")

    # ---------- 5. resource catalogue ----------
    s = slide_base(prs, "132 resources — services and products", "2 · Seed data")
    textbox(s, Inches(0.7), Inches(1.55), Inches(11.9), Inches(0.4),
            "95 approved · 37 pending review", size=17, color=GREY)

    chart_data = CategoryChartData()
    chart_data.categories = ["School", "Park", "Therapist", "Store",
                             "Community Centre", "Recreation", "Doctor",
                             "Support Group", "Employment", "Housing"]
    chart_data.add_series("Resources", (24, 22, 21, 14, 13, 10, 9, 9, 5, 4))
    gf = s.shapes.add_chart(XL_CHART_TYPE.BAR_CLUSTERED, Inches(0.7),
                            Inches(2.0), Inches(7.4), Inches(4.3), chart_data)
    chart = gf.chart
    chart.has_legend = False
    plot = chart.plots[0]
    plot.series[0].format.fill.solid()
    plot.series[0].format.fill.fore_color.rgb = TEAL
    for ax in (chart.category_axis, chart.value_axis):
        ax.tick_labels.font.size = Pt(12)

    textbox(s, Inches(8.4), Inches(2.1), Inches(4.3), Inches(0.5),
            "Field completeness", size=17, bold=True, color=DARK)
    textbox(s, Inches(8.4), Inches(2.6), Inches(4.3), Inches(1.6),
            ["contact_info    99.2%", "location          99.2%",
             "image_url             0%", "price                  0%"],
            size=15, color=GREY, space_after=8)
    callout(s, Inches(8.4), Inches(4.3), Inches(4.3), Inches(2.0),
            "Known gap: Employment (5) and Housing (4) are thinnest — and they "
            "carry the core use case. Named here rather than discovered in "
            "questions.")
    note(s, "What is real is the resource catalogue. A hundred and thirty-two "
            "resources, ninety-five approved. Schools, parks, therapists, "
            "community centres — services and products.\n\n"
            "Ninety-nine percent have contact information and location.\n\n"
            "Name the Employment/Housing gap yourself. If they find it first it "
            "looks like an oversight; if you name it, it is a roadmap item.")

    # ---------- 6. demo metrics ----------
    s = slide_base(prs, "One full generation, measured", "3 · Demo vs data")
    metrics = [("16", "milestones"), ("23s", "wall clock"),
               ("14", "model calls"), ("$0.0027", "per run")]
    for i, (big, small) in enumerate(metrics):
        card = s.shapes.add_shape(1, Inches(0.7 + i * 3.05), Inches(1.7),
                                  Inches(2.8), Inches(1.5))
        card.fill.solid()
        card.fill.fore_color.rgb = LIGHT
        card.line.color.rgb = TEAL
        tf = card.text_frame
        tf.word_wrap = True
        tf.paragraphs[0].text = big
        tf.paragraphs[0].alignment = PP_ALIGN.CENTER
        for r in tf.paragraphs[0].runs:
            r.font.size = Pt(32)
            r.font.bold = True
            r.font.color.rgb = TEAL
        p2 = tf.add_paragraph()
        p2.text = small
        p2.alignment = PP_ALIGN.CENTER
        for r in p2.runs:
            r.font.size = Pt(14)
            r.font.color.rgb = GREY

    table(s, Inches(0.7), Inches(3.6), Inches(11.9),
          ["Agent", "Calls", "Tokens", "Cost"],
          [["Path planning", "10", "5,552", "$0.00146"],
           ["Tool recommendation", "3", "4,504", "$0.00118"],
           ["Calendar optimisation", "1", "102", "$0.00003"],
           ["Total", "14", "10,158", "$0.0027"]],
          col_w=[5.0, 1.8, 2.4, 2.7], font=14, row_h=0.42)
    note(s, "This is one full generation. Twenty-three seconds. Sixteen "
            "milestones across education, workplace, relationships and health. "
            "Fourteen model calls, ten thousand tokens — a third of a cent.\n\n"
            "Across the three stored paths, milestone counts range 16 to 48. We "
            "quote the measured run, not an average: n=3 is too thin to average.")

    # ---------- 7. confidence / provenance ----------
    s = slide_base(prs, "The agents report low confidence when it is low",
                   "3 · Demo vs data")
    cd = CategoryChartData()
    cd.categories = ["Path planning", "Tool recommendation",
                     "Calendar optimisation", "Pattern recognition"]
    cd.add_series("Confidence", (0.95, 0.76, 0.75, 0.20))
    gf = s.shapes.add_chart(XL_CHART_TYPE.COLUMN_CLUSTERED, Inches(0.7),
                            Inches(1.7), Inches(7.2), Inches(3.6), cd)
    ch = gf.chart
    ch.has_legend = False
    ch.plots[0].series[0].format.fill.solid()
    ch.plots[0].series[0].format.fill.fore_color.rgb = TEAL
    ch.value_axis.maximum_scale = 1.0
    for ax in (ch.category_axis, ch.value_axis):
        ax.tick_labels.font.size = Pt(11)

    textbox(s, Inches(8.2), Inches(1.8), Inches(4.5), Inches(2.6),
            ["Pattern recognition sits at 0.20.",
             "",
             "It matches a user against similar prior users. With a small "
             "corpus there is little to match against — and it says so."],
            size=16, color=DARK)
    callout(s, Inches(0.7), Inches(5.5), Inches(11.9), Inches(1.3),
            "Provenance rule: every agent figure is derived from real data or "
            "gated on sample size. No placeholder values — the pipeline was "
            "audited end to end.")
    note(s, "One thing worth pointing at: pattern recognition reports 0.2 "
            "confidence. That is honest — we do not yet have enough similar "
            "users to match against.\n\n"
            "Every number these agents produce is derived from real data or "
            "gated on sample size. Nothing is a placeholder.\n\n"
            "This is the slide that separates us from a demo that looks good and "
            "means nothing.")

    # ---------- 8. architecture ----------
    s = slide_base(prs, "Six agents, orchestrated as a state machine",
                   "3 · Architecture")
    agents = ["Pattern\nrecognition", "Path\nplanning", "Tool\nrecommendation",
              "Calendar\noptimisation", "Reflection\nanalysis", "Adaptation"]
    for i, a in enumerate(agents):
        col, row = i % 3, i // 3
        card = s.shapes.add_shape(1, Inches(0.7 + col * 4.05),
                                  Inches(1.8 + row * 1.5),
                                  Inches(3.8), Inches(1.2))
        card.fill.solid()
        card.fill.fore_color.rgb = LIGHT
        card.line.color.rgb = TEAL
        tf = card.text_frame
        tf.word_wrap = True
        tf.paragraphs[0].text = a
        tf.paragraphs[0].alignment = PP_ALIGN.CENTER
        for r in tf.paragraphs[0].runs:
            r.font.size = Pt(17)
            r.font.bold = True
            r.font.color.rgb = TEAL
    textbox(s, Inches(0.7), Inches(5.0), Inches(11.9), Inches(1.8),
            ["LangGraph state machine · FastAPI · Next.js 14 · Supabase + pgvector",
             "",
             "Model is selectable per agent (GPT-4o, GPT-4o mini, o4-mini; "
             "Anthropic / Google / Groq wired) with low / medium / high reasoning "
             "effort. Per-user spend limits enforced against a durable ledger."],
            size=15, color=GREY)
    note(s, "Six specialised agents wired into two LangGraph state machines — one "
            "for generation, one for adaptation.\n\n"
            "The model behind each agent is user-selectable, so a stronger model "
            "can run planning while a cheaper one runs scheduling.")

    # ---------- 9. roadmap ----------
    s = slide_base(prs, "Roadmap to program end", "4 · Roadmap")
    items = [
        ("1", "Recruit into the four segments",
         "Replace three real users with a real sample. The single biggest gap."),
        ("2", "Close catalogue gaps",
         "Employment (5) and Housing (4) carry the core use case."),
        ("3", "Populate price and image_url",
         "Both 0% across 132 resources today."),
        ("4", "Track pattern-recognition confidence",
         "0.20 today. It should climb as the corpus grows — our measurable "
         "learning signal, instrumented now."),
    ]
    for i, (n, head, sub) in enumerate(items):
        y = Inches(1.7 + i * 1.15)
        dot = s.shapes.add_shape(9, Inches(0.7), y, Inches(0.55), Inches(0.55))
        dot.fill.solid()
        dot.fill.fore_color.rgb = TEAL
        dot.line.fill.background()
        dot.text_frame.paragraphs[0].text = n
        dot.text_frame.paragraphs[0].alignment = PP_ALIGN.CENTER
        for r in dot.text_frame.paragraphs[0].runs:
            r.font.size = Pt(18)
            r.font.bold = True
            r.font.color.rgb = WHITE
        textbox(s, Inches(1.5), y - Inches(0.05), Inches(11), Inches(0.4),
                head, size=19, bold=True, color=DARK)
        textbox(s, Inches(1.5), y + Inches(0.35), Inches(11), Inches(0.4),
                sub, size=14, color=GREY)
    callout(s, Inches(0.7), Inches(6.35), Inches(11.9), Inches(0.85),
            "Infrastructure: Render and Supabase are both free tier — not "
            "production-safe. A bigger blocker to scale than LLM cost, which is "
            "negligible at $0.0027 per onboarding.")
    note(s, "By program end: recruit into those four segments and replace three "
            "users with a real sample.\n\n"
            "Close the catalogue gaps.\n\n"
            "And the measurable one: pattern-recognition confidence should climb "
            "from 0.2 as the corpus grows. That is our learning signal, and it is "
            "instrumented today.")

    # ---------- 10. close ----------
    s = prs.slides.add_slide(prs.slide_layouts[6])
    bg = s.shapes.add_shape(1, Inches(0), Inches(0), W, H)
    bg.fill.solid()
    bg.fill.fore_color.rgb = TEAL
    bg.line.fill.background()
    textbox(s, Inches(1), Inches(2.9), Inches(11.3), Inches(1.2),
            "The system runs. What we need is the sample.",
            size=40, bold=True, color=WHITE)
    textbox(s, Inches(1), Inches(4.3), Inches(11.3), Inches(0.6),
            "6 agents · 16 milestones · 23 seconds · $0.0027 per run",
            size=19, color=RGBColor(0xCC, 0xFB, 0xF1))
    note(s, "Close on this line and stop talking. Then take questions.\n\n"
            "If asked how many users: three real, forty-seven synthetic. Never "
            "answer fifty.")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    prs.save(OUT)
    print(f"wrote {OUT}  ({OUT.stat().st_size // 1024} KB, {len(prs.slides.__iter__.__self__._sldIdLst)} slides)")


if __name__ == "__main__":
    build()
