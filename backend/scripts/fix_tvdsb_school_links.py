"""Point ResourceHub's Thames Valley schools at their current websites.

The functional check (docs/reports/functional-check-2026-10-04.md) found one
school's website "not found". All 76 Thames Valley District School Board
schools imported from OpenStreetMap had the same problem except one: the
board moved from www.tvdsb.ca/<School>.cfm (and sites.tvdsb.ca) to
www.tvdsb.ca/<school>, so 75 links were dead.

The board's own school list (https://www.tvdsb.ca/schools/school-list/)
gives each school's address. Records are matched to it by school name, and a
new link is used only if it loads. A school that is not on the list any more
(renamed or closed) has its dead link removed. Every change goes to a CSV first (old and
new link), and --revert puts the old links back from it.

Run from backend/ (needs Chrome and `npm i --no-save puppeteer-core` in the
repository root to read the board's list, which is drawn by JavaScript):
  python -m scripts.fix_tvdsb_school_links              # dry run: writes the CSV
  python -m scripts.fix_tvdsb_school_links --apply      # updates the links
  python -m scripts.fix_tvdsb_school_links --revert     # restores from the CSV
"""
from __future__ import annotations

import argparse
import csv
import difflib
import json
import re
import subprocess
import sys
import unicodedata
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CSV_PATH = ROOT / "docs" / "data" / "tvdsb-school-links.csv"
LIST_URL = "https://www.tvdsb.ca/schools/school-list/"
NO_LINK = "(removed)"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"

READ_LIST = r"""
const puppeteer = (await import('puppeteer-core')).default
const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const p = await b.newPage()
await p.goto(process.argv.at(-1), { waitUntil: 'networkidle2', timeout: 60000 })
const links = await p.evaluate(() => [...document.querySelectorAll('a')].map((a) => ({ text: a.textContent.trim().replace(/\s+/g, ' '), href: a.href })))
console.log(JSON.stringify(links))
await b.close()
"""


def norm(name: str) -> str:
    """Comparable school name: no accents, punctuation or case."""
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\bst\b\.?", "saint", s)
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


GENERIC = {"public", "school", "secondary", "elementary", "collegiate", "institute", "french", "immersion",
           "arts", "for", "the", "of", "ps", "ss"}


def distinctive(name: str) -> frozenset:
    """The words that tell schools apart, so "Kensal Park Public School"
    matches "Kensal Park French Immersion Public School"."""
    return frozenset(w for w in norm(name).split() if w not in GENERIC)


def board_schools() -> dict:
    out = subprocess.run(["node", "--input-type=module", "-e", READ_LIST, LIST_URL], cwd=ROOT,
                         capture_output=True, text=True, timeout=180)
    if out.returncode != 0:
        raise RuntimeError(out.stderr[-400:])
    links = json.loads(out.stdout)
    return {norm(l["text"]): l["href"] for l in links
            if re.match(r"https://www\.tvdsb\.ca/[a-z0-9-]+/?$", l["href"]) and re.search(r"school|collegiate|institute", l["text"], re.I)}


def loads(url: str) -> bool:
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=25) as r:
            return r.status < 400
    except Exception:
        return False


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="update the links listed in the CSV")
    ap.add_argument("--revert", action="store_true", help="put the old links back from the CSV")
    args = ap.parse_args()

    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    from database.supabase_client import get_supabase
    sb = get_supabase()
    if sb is None:
        print("Supabase not configured.")
        return 1

    if args.apply or args.revert:
        rows = [r for r in csv.DictReader(CSV_PATH.open()) if r["new_website"]]
        for r in rows:
            current = sb.table("resources").select("contact_info").eq("id", r["id"]).single().execute().data
            info = dict(current.get("contact_info") or {})
            new = None if r["new_website"] == NO_LINK else r["new_website"]
            info["website"] = new if args.apply else r["old_website"]
            sb.table("resources").update({"contact_info": info}).eq("id", r["id"]).execute()
        print(("Updated" if args.apply else "Reverted") + f" {len(rows)} links.")
        return 0

    schools = board_schools()
    records = (sb.table("resources").select("id, name, contact_info")
               .ilike("contact_info->>website", "%tvdsb.ca%").execute().data or [])
    CSV_PATH.parent.mkdir(parents=True, exist_ok=True)
    fixed = unmatched = 0
    with CSV_PATH.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["id", "name", "old_website", "new_website", "note"])
        for r in records:
            old = (r.get("contact_info") or {}).get("website") or ""
            if loads(old):
                w.writerow([r["id"], r["name"], old, "", "still works"])
                continue
            key = norm(r["name"])
            href = schools.get(key)
            if not href:
                close = difflib.get_close_matches(key, list(schools), n=1, cutoff=0.88)
                href = schools[close[0]] if close else None
            if not href:
                same = [h for k, h in schools.items() if distinctive(k) == distinctive(r["name"])]
                href = same[0] if len(same) == 1 else None
            if href and loads(href):
                w.writerow([r["id"], r["name"], old, href, ""])
                fixed += 1
            else:
                # Not on the board's list (renamed or closed): a dead link is
                # worse than none, so it is removed. The CSV keeps the old one.
                w.writerow([r["id"], r["name"], old, NO_LINK, "not on the board's list"])
                unmatched += 1
    print(f"{len(records)} schools: {fixed} new links, {unmatched} not on the board's list (link removed). Written to {CSV_PATH}.")
    print("Dry run. Check the CSV, then run with --apply.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
