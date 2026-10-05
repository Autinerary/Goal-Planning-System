"""Give ResourceHub's "Support Group" places the category they really have.

All 712 approved "Support Group" places were imported from OpenStreetMap,
where every one is a social facility: mostly care homes, seniors'
residences, shelters and food banks, and only a handful of real support
organisations. So "Support Group" misled anyone who filtered on it, and
Start here had to leave the category out (docs/start-here.md).

Each place keeps its OpenStreetMap reference, so its own OSM tags
(social_facility, social_facility:for) decide the new category, with the
name deciding when OSM does not say. Places whose names show a support
organisation (autism, mental health, parent and family resource centres,
mutual aid) stay "Support Group".

Nothing is lost: every change is written to a CSV first (old and new
category, and the OSM tags used), and --revert puts the old categories back
from it.

Run from backend/:
  python -m scripts.resort_support_groups              # dry run: writes the CSV
  python -m scripts.resort_support_groups --apply      # updates the categories
  python -m scripts.resort_support_groups --revert     # restores from the CSV
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path
from typing import Dict, List, Optional

CSV_PATH = Path(__file__).resolve().parents[2] / "docs" / "data" / "support-group-resort.csv"
OVERPASS = "https://overpass-api.de/api/interpreter"

GENUINE = re.compile(
    r"autism|autisme|adhd|asperger|neurodivers|down syndrome|cerebral palsy|brain injury|learning disab|\bdeaf|\bblind"
    r"|mental health|santé mentale|parent|caregiver|peer|support group|self-help|entraide|family resource|family support"
    r"|crisis|distress|alzheimer|epilep|disabilit|handicap|cnib|march of dimes|cmha", re.I)
CHILD = re.compile(r"child ?care|day ?care|daycare|garderie|\bcpe\b|nursery|preschool", re.I)
JOBS = re.compile(r"employment|emploi|\bjobs?\b|career", re.I)
FOOD = re.compile(r"food|kitchen|cuisine|pantry|\bmeals?\b|supper|soup|banque alimentaire|dépannage alimentaire|harvest", re.I)
SHELTER = re.compile(r"shelter|hostel|refuge|warming|respite space|drop-in|hébergement d'urgence", re.I)
SENIOR = re.compile(
    r"retirement|seniors?\b|senior living|aîné|\bchsld\b|centre d'hébergement|long[- ]term care|nursing home|manor|lodge"
    r"|villa\b|résidence pour|extendicare|chartwell|revera|sienna senior|amica\b", re.I)
SPECIFIC = {"nursing_home", "assisted_living", "food_bank", "soup_kitchen", "shelter", "little_free_pantry"}


def classify(name: str, osm: Dict[str, str]) -> str:
    """The category for one place, from its OSM tags and its name. Pure."""
    facility = osm.get("social_facility")
    for_whom = osm.get("social_facility:for") or ""
    if GENUINE.search(name) and facility not in SPECIFIC:
        return "Support Group"
    if facility in ("nursing_home", "assisted_living") or "senior" in for_whom:
        return "Senior Care"
    if facility == "group_home":
        return "Supported Housing"
    if facility == "shelter" or (facility is None and "homeless" in for_whom):
        return "Shelter"
    if facility in ("food_bank", "soup_kitchen", "little_free_pantry"):
        return "Food Support"
    if facility == "employment_services":
        return "Employment"
    # Untyped or general facilities: the name says what they are.
    if CHILD.search(name) or (facility == "day_care" and re.search(r"child|juvenile", for_whom)):
        return "Child Care"
    if JOBS.search(name):
        return "Employment"
    if FOOD.search(name):
        return "Food Support"
    if SHELTER.search(name):
        return "Shelter"
    if SENIOR.search(name):
        return "Senior Care"
    return "Social Services"


def osm_tags(refs: List[str]) -> Dict[str, Dict[str, str]]:
    """Tags for osm:node/<id> and osm:way/<id> references, in one Overpass query."""
    ids = defaultdict(list)
    for ref in refs:
        kind, _, osm_id = ref.partition("/")
        ids[kind.split(":")[1]].append(osm_id)
    parts = "".join(f"{kind}(id:{','.join(v)});" for kind, v in ids.items() if v)
    body = urllib.parse.urlencode({"data": f"[out:json][timeout:180];({parts});out tags;"}).encode()
    req = urllib.request.Request(OVERPASS, data=body, headers={"User-Agent": "Autinerary-ResourceHub/1.0 (aayush@autinerary.ca)"})
    data = json.load(urllib.request.urlopen(req, timeout=240))
    return {f"osm:{e['type']}/{e['id']}": e.get("tags", {}) for e in data["elements"]}


def fetch_support_groups(sb) -> List[dict]:
    rows, start = [], 0
    while True:
        batch = (sb.table("resources").select("id, name, category, source_ref")
                 .eq("category", "Support Group").eq("status", "approved")
                 .order("id").range(start, start + 999).execute().data or [])
        rows.extend(batch)
        if len(batch) < 1000:
            return rows
        start += 1000


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="update the categories listed in the CSV")
    ap.add_argument("--revert", action="store_true", help="put the old categories back from the CSV")
    args = ap.parse_args()

    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    from database.supabase_client import get_supabase
    sb = get_supabase()
    if sb is None:
        print("Supabase not configured.")
        return 1

    if args.apply or args.revert:
        rows = list(csv.DictReader(CSV_PATH.open()))
        column = "new_category" if args.apply else "old_category"
        groups: Dict[str, List[str]] = defaultdict(list)
        for r in rows:
            if r["new_category"] != r["old_category"]:
                groups[r[column]].append(r["id"])
        for category, ids in groups.items():
            for i in range(0, len(ids), 200):
                sb.table("resources").update({"category": category}).in_("id", ids[i:i + 200]).execute()
            print(f"  {category:<18} {len(ids)}")
        print("Applied." if args.apply else "Reverted.")
        return 0

    places = fetch_support_groups(sb)
    tags = osm_tags([p["source_ref"] for p in places if (p.get("source_ref") or "").startswith("osm:")])
    CSV_PATH.parent.mkdir(parents=True, exist_ok=True)
    with CSV_PATH.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["id", "name", "source_ref", "osm_social_facility", "osm_for", "old_category", "new_category"])
        for p in places:
            t = tags.get(p["source_ref"] or "", {})
            w.writerow([p["id"], p["name"], p["source_ref"], t.get("social_facility", ""), t.get("social_facility:for", ""),
                        p["category"], classify(p["name"] or "", t)])
    counts = Counter(r["new_category"] for r in csv.DictReader(CSV_PATH.open()))
    print(f"{len(places)} places, written to {CSV_PATH}:")
    for category, n in counts.most_common():
        print(f"  {category:<18} {n}")
    print("Dry run. Check the CSV, then run with --apply.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
