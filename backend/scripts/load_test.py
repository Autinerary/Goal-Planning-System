"""Load test: many people using Autinerary at the same time.

Riipen Labs, Group 2 recommended "a program of testing" for "problems found
by a lot of customers using the platform at the same time". Two scenarios,
run separately so what each one costs is clear:

  browse    Signed-out visitors: the landing and sign-up pages, the API's
            /health, and ResourceHub search (by category, and by text, which
            embeds the query). Ramps through stages of concurrent visitors and
            stops early when a stage's error rate passes --max-error-rate, so a
            run cannot keep hammering a struggling production service.
            Writes nothing. Text search makes one embedding call per request
            (fractions of a cent in total).

  generate  N people finishing setup at the same moment: each is a new QA
            account (test.account+riipen-load-*@test.com, 18+), starting a
            path generation the way the app does (POST /api/onboarding/jobs,
            then polling every 3 s). Meanwhile /health is probed every 2 s to
            see whether everyone else's requests stay fast. Uses the AI model
            (gpt-4o-mini: cents per run) and leaves the N accounts and their
            paths in place.

Results per stage and endpoint: requests, errors, p50 / p95 / max latency and
requests per second. --report writes them as markdown.

Run (from backend/):
  python -m scripts.load_test browse
  python -m scripts.load_test browse --stages 5,10,25 --seconds 20
  python -m scripts.load_test generate --users 3
  python -m scripts.load_test browse --report ../docs/reports/load-test.md
"""
from __future__ import annotations

import argparse
import asyncio
import os
import random
import secrets
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

import httpx

APP = "https://goal-planning-app.vercel.app"
API = "https://goal-planning-app-mup2.onrender.com"
HUB = "https://servicehub-six.vercel.app"

BROWSE = [
    ("landing page", "app", "/"),
    ("sign-up page", "app", "/signup"),
    ("API /health", "api", "/health"),
    ("hub search (category)", "hub", "/api/search?categories=Support%20Group&pageSize=20"),
    ("hub search (text)", "hub", "/api/search?q=autism%20support%20group&pageSize=20"),
]

TIMEOUT = 30.0


@dataclass
class Hit:
    name: str
    ok: bool
    status: str  # HTTP status, or the exception name
    seconds: float


def percentile(values: List[float], p: float) -> float:
    if not values:
        return float("nan")
    ordered = sorted(values)
    k = (len(ordered) - 1) * p
    lo, hi = int(k), min(int(k) + 1, len(ordered) - 1)
    return ordered[lo] + (ordered[hi] - ordered[lo]) * (k - lo)


def summarize(hits: List[Hit], seconds: float) -> List[Dict]:
    """Per endpoint: count, errors, latency percentiles, throughput. Pure."""
    names = list(dict.fromkeys(h.name for h in hits))
    rows = []
    for name in names:
        mine = [h for h in hits if h.name == name]
        lat = [h.seconds for h in mine if h.ok]
        errors: Dict[str, int] = {}
        for h in mine:
            if not h.ok:
                errors[h.status] = errors.get(h.status, 0) + 1
        rows.append({
            "endpoint": name,
            "requests": len(mine),
            "errors": sum(errors.values()),
            "error_kinds": errors,
            "p50": percentile(lat, 0.50),
            "p95": percentile(lat, 0.95),
            "max": max(lat) if lat else float("nan"),
            "rps": len(mine) / seconds if seconds else 0.0,
        })
    return rows


def error_rate(hits: List[Hit]) -> float:
    return sum(not h.ok for h in hits) / len(hits) if hits else 0.0


async def fetch(client: httpx.AsyncClient, name: str, url: str) -> Hit:
    start = time.perf_counter()
    try:
        r = await client.get(url, timeout=TIMEOUT)
        # 4xx other than 429 would be a bug in this script, not load; count
        # them as errors all the same so they are seen.
        return Hit(name, r.status_code < 400, str(r.status_code), time.perf_counter() - start)
    except Exception as e:  # timeouts, resets
        return Hit(name, False, type(e).__name__, time.perf_counter() - start)


async def visitor(client: httpx.AsyncClient, i: int, targets: Dict[str, str], deadline: float,
                  think: float, hits: List[Hit]) -> None:
    # Visitors start at different points of the list, so endpoints are hit
    # evenly from the first second.
    order = BROWSE[i % len(BROWSE):] + BROWSE[: i % len(BROWSE)]
    while time.monotonic() < deadline:
        for name, base, path in order:
            if time.monotonic() >= deadline:
                return
            hits.append(await fetch(client, name, targets[base] + path))
            await asyncio.sleep(think * random.uniform(0.5, 1.5))


async def run_browse(targets: Dict[str, str], stages: List[int], seconds: int, think: float,
                     max_error_rate: float) -> List[Tuple[int, List[Dict], float]]:
    results = []
    for users in stages:
        hits: List[Hit] = []
        limits = httpx.Limits(max_connections=users * 2, max_keepalive_connections=users)
        async with httpx.AsyncClient(limits=limits, follow_redirects=True,
                                     headers={"User-Agent": "autinerary-load-test"}) as client:
            start = time.monotonic()
            await asyncio.gather(*(visitor(client, i, targets, start + seconds, think, hits) for i in range(users)))
            elapsed = time.monotonic() - start
        rate = error_rate(hits)
        results.append((users, summarize(hits, elapsed), rate))
        print_stage(f"{users} visitors at once, {elapsed:.0f}s", summarize(hits, elapsed))
        if rate > max_error_rate:
            print(f"  stopping: {rate:.0%} of requests failed (limit {max_error_rate:.0%})")
            break
    return results


# --- generate ---------------------------------------------------------------

def _supabase_env() -> Tuple[str, str]:
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL") or ""
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or ""
    if not url or not key:
        sys.exit("generate needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (backend/.env).")
    return url.rstrip("/"), key


async def make_account(client: httpx.AsyncClient, url: str, key: str, n: int) -> Tuple[str, str, str]:
    """A new 18+ QA account, signed in. Returns (user id, email, access token)."""
    email = f"test.account+riipen-load-{int(time.time())}-{n}@test.com"
    password = f"Qa{secrets.token_urlsafe(12)}9!"
    dob = "1990-01-01"
    admin = {"apikey": key, "Authorization": f"Bearer {key}"}
    r = await client.post(f"{url}/auth/v1/admin/users", headers=admin, json={
        "email": email, "password": password, "email_confirm": True,
        "app_metadata": {"date_of_birth": dob},
        "user_metadata": {"full_name": f"Load test {n}", "date_of_birth": dob},
    })
    r.raise_for_status()
    uid = r.json()["id"]
    r = await client.post(f"{url}/auth/v1/token?grant_type=password", headers={"apikey": key},
                          json={"email": email, "password": password})
    r.raise_for_status()
    return uid, email, r.json()["access_token"]


def onboarding_body(uid: str, email: str, n: int) -> Dict:
    goals = ["Find a job I enjoy", "Live more independently", "Make two new friends", "Go back to school"]
    return {
        "email": email,
        "userId": uid,
        "barrierTypes": ["Prefer not to share"],
        "motivationType": "intrinsic",
        "goals": [goals[n % len(goals)]],
        "dreams": [],
        "currentChallenges": [],
        "preferences": {"audience": "self", "lookingFor": ["plan"]},
    }


async def one_generation(client: httpx.AsyncClient, api: str, account: Tuple[str, str, str], n: int) -> Dict:
    uid, email, token = account
    start = time.perf_counter()
    try:
        r = await client.post(f"{api}/api/onboarding/jobs", json=onboarding_body(uid, email, n),
                              headers={"Authorization": f"Bearer {token}"}, timeout=30)
        accepted = time.perf_counter() - start
        if r.status_code != 202:
            return {"n": n, "ok": False, "accepted": accepted, "total": accepted,
                    "result": f"HTTP {r.status_code}: {r.text[:120]}"}
        job = r.json()["jobId"]
        deadline = time.monotonic() + 8 * 60  # the app's own ceiling
        while time.monotonic() < deadline:
            await asyncio.sleep(3)
            try:
                p = await client.get(f"{api}/api/onboarding/jobs/{job}", timeout=15)
                data = p.json()
            except Exception:
                continue  # a dropped poll is not a failed job, as in the app
            if data.get("status") == "succeeded":
                return {"n": n, "ok": True, "accepted": accepted, "total": time.perf_counter() - start, "result": "path ready"}
            if data.get("status") == "failed":
                return {"n": n, "ok": False, "accepted": accepted, "total": time.perf_counter() - start,
                        "result": f"failed: {data.get('error')}"}
        return {"n": n, "ok": False, "accepted": accepted, "total": time.perf_counter() - start, "result": "timed out (8 min)"}
    except Exception as e:
        return {"n": n, "ok": False, "accepted": 0.0, "total": time.perf_counter() - start, "result": type(e).__name__}


async def probe_health(client: httpx.AsyncClient, api: str, stop: asyncio.Event, hits: List[Hit]) -> None:
    while not stop.is_set():
        hits.append(await fetch(client, "API /health while generating", f"{api}/health"))
        try:
            await asyncio.wait_for(stop.wait(), timeout=2)
        except asyncio.TimeoutError:
            pass


async def run_generate(targets: Dict[str, str], users: int) -> Tuple[List[Dict], List[Dict], float]:
    url, key = _supabase_env()
    async with httpx.AsyncClient(timeout=TIMEOUT, headers={"User-Agent": "autinerary-load-test"}) as client:
        # Baseline before any load.
        base_hits = [await fetch(client, "API /health before", f"{targets['api']}/health") for _ in range(5)]
        accounts = [await make_account(client, url, key, n) for n in range(users)]
        print(f"  {users} QA accounts ready; starting {users} generations at once")
        stop = asyncio.Event()
        probe_hits: List[Hit] = []
        probe = asyncio.create_task(probe_health(client, targets["api"], stop, probe_hits))
        start = time.monotonic()
        gens = await asyncio.gather(*(one_generation(client, targets["api"], a, n) for n, a in enumerate(accounts)))
        elapsed = time.monotonic() - start
        stop.set()
        await probe
    return gens, summarize(base_hits + probe_hits, elapsed), elapsed


# --- output -----------------------------------------------------------------

def fmt(s: float) -> str:
    return "-" if s != s else f"{s:.2f}s"  # NaN when nothing succeeded


def stage_lines(rows: List[Dict]) -> List[str]:
    out = [f"  {'endpoint':<30} {'requests':>8} {'errors':>6} {'p50':>7} {'p95':>7} {'max':>7} {'req/s':>6}"]
    for r in rows:
        kinds = ", ".join(f"{k}x{v}" for k, v in r["error_kinds"].items())
        out.append(f"  {r['endpoint']:<30} {r['requests']:>8} {r['errors']:>6} {fmt(r['p50']):>7} {fmt(r['p95']):>7} "
                   f"{fmt(r['max']):>7} {r['rps']:>6.1f}" + (f"   ({kinds})" if kinds else ""))
    return out


def print_stage(title: str, rows: List[Dict]) -> None:
    print(f"\n== {title}")
    print("\n".join(stage_lines(rows)))


def markdown_table(rows: List[Dict]) -> List[str]:
    out = ["| Endpoint | Requests | Errors | p50 | p95 | Max | Req/s |", "|---|---:|---:|---:|---:|---:|---:|"]
    for r in rows:
        kinds = ", ".join(f"{k} x{v}" for k, v in r["error_kinds"].items())
        out.append(f"| {r['endpoint']} | {r['requests']} | {r['errors']}{f' ({kinds})' if kinds else ''} | "
                   f"{fmt(r['p50'])} | {fmt(r['p95'])} | {fmt(r['max'])} | {r['rps']:.1f} |")
    return out


def deployed_commit(api: str) -> str:
    try:
        return httpx.get(f"{api}/health", timeout=60).json().get("commit") or "unknown"
    except Exception:
        return "unknown"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("scenario", choices=["browse", "generate"])
    ap.add_argument("--app", default=APP)
    ap.add_argument("--api", default=API)
    ap.add_argument("--hub", default=HUB)
    ap.add_argument("--stages", default="5,10,25,50", help="browse: visitors at once, per stage")
    ap.add_argument("--seconds", type=int, default=20, help="browse: length of each stage")
    ap.add_argument("--think", type=float, default=1.0, help="browse: average pause between a visitor's requests")
    ap.add_argument("--max-error-rate", type=float, default=0.10, help="browse: stop after a stage above this")
    ap.add_argument("--users", type=int, default=3, help="generate: people finishing setup at once")
    ap.add_argument("--report", help="also write the results as markdown to this file")
    args = ap.parse_args()

    targets = {"app": args.app.rstrip("/"), "api": args.api.rstrip("/"), "hub": args.hub.rstrip("/")}
    when = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    commit = deployed_commit(targets["api"])  # also wakes the API if it was asleep
    print(f"Targets: app {targets['app']}  api {targets['api']} (commit {commit})  hub {targets['hub']}")
    md = [f"# Load test: {args.scenario}", "", f"Run {when}. API commit `{commit}`.", "",
          f"Targets: app {targets['app']}, API {targets['api']}, ResourceHub {targets['hub']}.", ""]

    if args.scenario == "browse":
        stages = [int(s) for s in args.stages.split(",") if s.strip()]
        results = asyncio.run(run_browse(targets, stages, args.seconds, args.think, args.max_error_rate))
        md.append(f"Each stage: that many signed-out visitors at once for {args.seconds}s, each pausing "
                  f"~{args.think:.1f}s between requests. Stops after a stage with more than "
                  f"{args.max_error_rate:.0%} errors.")
        for users, rows, rate in results:
            md += ["", f"## {users} visitors at once ({rate:.0%} errors)", ""] + markdown_table(rows)
    else:
        from dotenv import load_dotenv
        load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
        gens, rows, elapsed = asyncio.run(run_generate(targets, args.users))
        print(f"\n== {args.users} path generations at once ({elapsed:.0f}s)")
        for g in gens:
            print(f"  #{g['n'] + 1}: {g['result']:<40} accepted in {fmt(g['accepted'])}, total {fmt(g['total'])}")
        print_stage("API responsiveness", rows)
        ok = [g["total"] for g in gens if g["ok"]]
        md += [f"{args.users} new accounts finishing setup at the same moment, each starting a path generation "
               "and polling it as the app does.", "",
               f"Paths ready: {len(ok)} of {len(gens)}. Time to path: "
               + (f"median {fmt(percentile(ok, 0.5))}, slowest {fmt(max(ok))}." if ok else "none finished."), "",
               "| # | Result | Accepted in | Time to path |", "|---|---|---:|---:|"]
        md += [f"| {g['n'] + 1} | {g['result']} | {fmt(g['accepted'])} | {fmt(g['total'])} |" for g in gens]
        md += ["", "API responsiveness before and during the generations:", ""] + markdown_table(rows)

    if args.report:
        with open(args.report, "a" if os.path.exists(args.report) else "w") as f:
            f.write("\n".join(md) + "\n\n")
        print(f"\nWrote {args.report}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
