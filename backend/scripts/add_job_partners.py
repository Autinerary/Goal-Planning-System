"""Add the job partners the team named to ResourceHub.

The team's planning note (October 2026), "Unknowns / To Discuss": job
partners Auticon, Specialisterne and SpectrumWorks. Each was checked on
17 October 2026 against its own website, and its description follows what
the site says about itself:

- auticon Canada (auticon.com/ca-en): employs autistic adults as technology
  consultants; the contact details are the ones its Canadian page gives.
- Specialisterne Canada (ca.specialisterne.com; specialisterne.ca no longer
  resolves): a charity with a talent pool for neurodivergent job seekers.
- Spectrum Works (spectrumworks.ca): a career fair for autistic job seekers.
  Its page lists the 2025 fairs (online across Canada, in person in Ottawa and
  Toronto) and no 2026 date yet, so the description says to check the site.

None of the three gives a street address, so they are stored as national
organisations (no map point, no province): search lists them after places
near the person and before farther ones. Category "Employment", for adults.
Partnership is a separate question for the team (docs/planning-note-2026-10.md).

Each website is checked again before saving, and one that no longer loads is
skipped. Safe to re-run: records are matched on source_ref.

Run from backend/:
  python -m scripts.add_job_partners           # check only
  python -m scripts.add_job_partners --apply   # add or update them
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path

from scripts.add_support_organisations import loads

ADULTS = ["young_adults_18_30", "adults_30_45", "adults_45_65"]

PARTNERS = [
    # slug, name, website, email, phone, description
    ("auticon-canada", "auticon Canada", "https://auticon.com/ca-en/", "info@auticon.ca", "+1 888-286-4826",
     "A technology consulting company that employs autistic adults as consultants in data, quality assurance and "
     "testing, and software development, and helps employers build neuroinclusive teams. Open roles are on its "
     "careers page: https://auticon.com/ca-en/careers/"),
    ("specialisterne-canada", "Specialisterne Canada", "https://ca.specialisterne.com/", None, None,
     "A charity that connects autistic and neurodivergent job seekers with employers, and helps employers hire and "
     "manage inclusively. You can join its talent pool if you identify as neurodivergent (for example autism, ADHD, "
     "a learning disability, OCD or Tourette syndrome) and have found it hard to get or keep a job: "
     "https://ca.specialisterne.com/job-seekers/"),
    ("spectrum-works", "Spectrum Works career fair", "https://spectrumworks.ca/", None, None,
     "A career fair for autistic job seekers, employers who want to hire them, and the services that support them: "
     "online across Canada and in person in Ottawa and Toronto. The 2025 fairs were in September and October; "
     "check its website for the next one."),
]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="add or update the job partners")
    args = ap.parse_args()

    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    from database.supabase_client import get_supabase
    sb = get_supabase()
    if sb is None:
        print("Supabase not configured.")
        return 1

    now = datetime.now(timezone.utc).isoformat()
    rows = []
    for slug, name, website, email, phone, description in PARTNERS:
        if not loads(website):
            print(f"  skipped (site did not load): {name}")
            continue
        rows.append({
            "name": name,
            "description": description,
            "category": "Employment",
            "status": "approved",
            "location": {"lat": None, "lng": None, "city": None, "address": None, "province": None,
                         "postal_code": None, "country": "Canada"},
            "contact_info": {"email": email, "phone": phone, "website": website},
            "age_ranges": ADULTS,
            "source_type": "operator",
            "source_ref": f"operator:{slug}",
            "source_url": website,
            "source_attribution": f"From {name}'s website",
            "last_verified_at": now,
            "is_first_party": False,
        })
        print(f"  ok: {name}")
    if not args.apply:
        print(f"{len(rows)} of {len(PARTNERS)} ready. Check only; run with --apply to save.")
        return 0
    sb.table("resources").upsert(rows, on_conflict="source_ref").execute()
    print(f"Saved {len(rows)} job partners.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
