"""Add autism and ADHD organisations to ResourceHub.

Before this, only 4 places mentioned autism and none mentioned ADHD, so Start
here's "Autism organisations and services" found 4, and someone looking for
ADHD support found nothing (docs/start-here.md).

Each organisation below was checked on 4 October 2026: its own website loads
and is the organisation's (title and text), and its description follows what
the site says about itself. Left out: autismmanitoba.com (the domain now
belongs to an unrelated clinic), the Pacific Autism Family Network (its
address no longer resolves), Autism New Brunswick (its site refuses
automated checks, so it could not be verified), and CADDRA (an association
for clinicians rather than a public support organisation).

Places are stored with category "Support Group" and source_type "operator"
(the information comes from the organisation itself). No street address or
map position unless the site gives one. Each website is checked again
before saving, and one that no longer loads is skipped. Safe to re-run:
records are matched on source_ref.

Run from backend/:
  python -m scripts.add_support_organisations           # check only
  python -m scripts.add_support_organisations --apply   # add or update them
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ORGS = [
    # slug, name, website, province, city, address, description
    ("autism-canada", "Autism Canada", "https://www.autismcanada.org/", None, None, None,
     "National autism organisation that advocates alongside and supports people on the autism spectrum, their families, caregivers and allies, with resources and education."),
    ("autism-ontario", "Autism Ontario", "https://www.autismontario.com", "ON", None, None,
     "Ontario's leading source of information and referral on autism, and one of the largest voices representing the autism community."),
    ("autismbc", "AutismBC", "https://www.autismbc.ca", "BC", None, None,
     "A BC non-profit that supports, empowers and connects the autism community in British Columbia."),
    ("autism-society-alberta", "Autism Society Alberta", "https://autismalberta.ca/", "AB", None, None,
     "Connects autistic people and families with resources, support and community initiatives across Alberta."),
    ("autism-edmonton", "Autism Edmonton", "https://www.autismedmonton.org", "AB", "Edmonton", None,
     "Enhancing the lives of autistic people in Edmonton through knowledge, services and inclusive opportunities."),
    ("autism-resource-centre-regina", "Autism Resource Centre", "https://www.autismresourcecentre.com/", "SK", "Regina", None,
     "Programs and education in Regina that support autistic people to reach their potential and take part in their communities."),
    ("autism-services-saskatoon", "Autism Services of Saskatoon", "https://autismservices.ca/", "SK", "Saskatoon", None,
     "Education, recreation and support for autistic children, youth, adults and families in Saskatoon."),
    ("autism-nova-scotia", "Autism Nova Scotia", "https://www.autismnovascotia.ca/", "NS", None, None,
     "Resources, programs and services for autistic people and their families and caregivers across Nova Scotia."),
    ("autism-society-pei", "Autism Society of PEI", "https://autismsociety.pe.ca/", "PE", "Charlottetown", "161 St. Peters Road",
     "Support, resources and membership for autistic people and their families in Prince Edward Island."),
    ("federation-quebecoise-autisme", "Fédération québécoise de l'autisme", "https://www.autisme.qc.ca", "QC", None, None,
     "Quebec's federation of autism organisations and people, representing autistic people, their families and loved ones. In French."),
    ("autisme-montreal", "Autisme Montréal", "https://autisme-montreal.com", "QC", "Montréal", None,
     "Montréal organisation serving autistic people and their families. In French."),
    ("geneva-centre-for-autism", "Geneva Centre for Autism", "https://www.genevacentre.ca/", "ON", "Toronto", None,
     "Toronto autism organisation with programs, learning, and Canada's largest autism conference."),
    ("kerrys-place", "Kerry's Place Autism Services", "https://kerrysplace.org/", "ON", None, None,
     "Supports and services for autistic kids, youth and adults throughout Ontario."),
    ("sinneave-family-foundation", "The Sinneave Family Foundation", "https://sinneavefoundation.org", None, None, None,
     "Works across Canada to open up opportunities in education, employment and housing for autistic youth and adults."),
    ("a4a-ontario", "Autistics for Autistics Ontario (A4A)", "https://a4aontario.com", "ON", None, None,
     "A collective of autistic adults in Ontario: self-advocates working to change how autism funding and services work."),
    ("autism-yukon", "Autism Yukon", "https://autismyukon.org", "YT", None, None,
     "Advocacy, support and education for an inclusive community for autistic and other neurodivergent people in the Yukon."),
    ("caddac", "CADDAC: Centre for ADHD Awareness, Canada", "https://caddac.ca", None, None, None,
     "Canadian charity for ADHD awareness, with programs and events for people with ADHD and their families."),
    ("ldac", "Learning Disabilities Association of Canada", "https://www.ldac-acta.ca", None, None, None,
     "National association upholding the rights of people with learning disabilities and associated challenges to thrive."),
    ("adda", "ADDA: Attention Deficit Disorder Association", "https://add.org", None, None, None,
     "Resources and virtual peer support groups for adults with ADHD. Based in the United States."),
]

# Some sites refuse requests that do not look like a browser.
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"


def loads(url: str) -> bool:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=25) as r:
            return r.status < 400
    except Exception:
        return False


def geocode(address: str, city: str, province: str):
    """Map position for a street address (OpenStreetMap Nominatim), or None."""
    q = urllib.parse.urlencode({"q": f"{address}, {city}, {province}, Canada", "format": "json", "limit": 1})
    try:
        req = urllib.request.Request(f"https://nominatim.openstreetmap.org/search?{q}",
                                     headers={"User-Agent": "Autinerary-ResourceHub/1.0 (aayush@autinerary.ca)"})
        hits = json.load(urllib.request.urlopen(req, timeout=20))
        return (float(hits[0]["lat"]), float(hits[0]["lon"])) if hits else None
    except Exception:
        return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="add or update the organisations")
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
    for slug, name, website, province, city, address, description in ORGS:
        if not loads(website):
            print(f"  skipped (site did not load): {name}")
            continue
        point = geocode(address, city, province) if address else None
        rows.append({
            "name": name,
            "description": description,
            "category": "Support Group",
            "status": "approved",
            "location": {"lat": point[0] if point else None, "lng": point[1] if point else None,
                         "city": city, "address": address, "province": province, "postal_code": None},
            "contact_info": {"email": None, "phone": None, "website": website},
            "source_type": "operator",
            "source_ref": f"operator:{slug}",
            "source_url": website,
            "source_attribution": f"From {name}'s website",
            "last_verified_at": now,
            "is_first_party": False,
        })
        print(f"  ok: {name}" + (f" ({city}, {province})" if city else f" ({province})" if province else ""))
    if not args.apply:
        print(f"{len(rows)} of {len(ORGS)} ready. Check only; run with --apply to save.")
        return 0
    sb.table("resources").upsert(rows, on_conflict="source_ref").execute()
    print(f"Saved {len(rows)} organisations.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
