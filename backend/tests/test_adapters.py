"""Shared starter models (api/routes/adapters.py): the checks before anything is shared, who can see one, how they're
ranked for each person, which models came from which, and using one.

What must hold: nothing is shared unless the owner approved a scrubbed training set, their memory check passed and
their title and description name no one; shared with everyone, its tags must not narrow its owner down to a handful of
real people; shared with people, only the owner's connections; a private link only for whoever has it; the files are
an adapter and a settings file with nothing from the owner's computer; nothing public says who shared one; models are
ranked for you by your onboarding answers and by ratings from people like you; only the owner edits or takes one down;
nobody rates their own; reports go to the moderation queue; and it's all off unless SHARED_ADAPTERS=on.

Run from backend/:  python -m unittest tests.test_adapters -v
"""
import asyncio
import json
import os
import struct
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException

from api.routes import adapters
from core import scrubber

OWNER, OTHER, FRIEND, STRANGER = "owner-1", "other-1", "friend-1", "stranger-1"
CONSENT = "c0000000-0000-4000-8000-000000000001"
BASE = "mlx-community/Llama-3.2-3B-Instruct-bf16"
PARENT = "a0000000-0000-4000-8000-00000000000a"


def weights(header=None, metadata=None):
    header = header or {"model.layers.0.self_attn.q_proj.lora_a": {"dtype": "F32", "shape": [8, 8], "data_offsets": [0, 256]},
                        "model.layers.0.self_attn.q_proj.lora_b": {"dtype": "F32", "shape": [8, 8], "data_offsets": [256, 512]}}
    if metadata is not None:
        header = {"__metadata__": metadata, **header}
    raw = json.dumps(header).encode()
    return struct.pack("<Q", len(raw)) + raw + b"\0" * 512


def clean_config(adapter_id, built_on=None, model=BASE):
    config = {"fine_tune_type": "lora", "num_layers": 8, "lora_parameters": {"rank": 8, "scale": 20.0, "dropout": 0.05},
              "model": model, "shared_id": adapter_id}
    if built_on:
        config["built_on"] = built_on
    return config


class FakeQuery:
    def __init__(self, db, table):
        self.db, self.table, self.filters, self.op, self.row = db, table, [], "select", None

    def select(self, *_):
        return self

    def eq(self, k, v):
        self.filters.append(lambda r, k=k, v=v: r.get(k) == v)
        return self

    def in_(self, k, values):
        self.filters.append(lambda r, k=k, values=values: r.get(k) in values)
        return self

    def order(self, *_a, **_k):
        return self

    def limit(self, *_):
        return self

    def range(self, *_):
        return self

    def insert(self, row):
        self.op, self.row = "insert", row
        return self

    def upsert(self, row, on_conflict=""):
        self.op, self.row, self.keys = "upsert", row, on_conflict.split(",")
        return self

    def update(self, row):
        self.op, self.row = "update", row
        return self

    def delete(self):
        self.op = "delete"
        return self

    def execute(self):
        if self.table in self.db.missing:
            raise RuntimeError(f'relation "{self.table}" does not exist')
        rows = self.db.tables.setdefault(self.table, [])
        match = [r for r in rows if all(f(r) for f in self.filters)]
        if self.op == "insert":
            new = self.row if isinstance(self.row, list) else [self.row]
            for r in new:
                rows.append({"created_at": f"2026-10-31T12:00:{len(rows):02d}+00:00", **r})
            return SimpleNamespace(data=new)
        if self.op == "upsert":
            same = [r for r in rows if all(r.get(k) == self.row.get(k) for k in self.keys)]
            if same:
                same[0].update(self.row)
            else:
                rows.append(dict(self.row))
            return SimpleNamespace(data=[self.row])
        if self.op == "update":
            for r in match:
                r.update(self.row)
            return SimpleNamespace(data=match)
        if self.op == "delete":
            self.db.tables[self.table] = [r for r in rows if r not in match]
            return SimpleNamespace(data=match)
        return SimpleNamespace(data=[dict(r) for r in match])


class FakeBucket:
    def __init__(self, db):
        self.db = db

    def create_signed_upload_url(self, path):
        return {"signed_url": f"https://storage/upload/{path}?token=t", "token": "t", "path": path}

    def list(self, folder):
        return [{"name": name.split("/", 1)[1], "metadata": {"size": len(data)}}
                for name, data in self.db.files.items() if name.startswith(f"{folder}/")]

    def create_signed_url(self, path, expires, options=None):
        return {"signedURL": f"https://storage/sign/{path}?expires={expires}" + (f"&download={options['download']}" if options else "")}

    def remove(self, paths):
        for p in paths:
            self.db.files.pop(p, None)
        return []


def person(uid, norms=(), audience=None, goals=(), internal=False):
    """A person with their onboarding answers, as the tables hold them (the selects' aliases included)."""
    return ([{"user_id": uid, "barrier_type": n} for n in norms],
            {"id": uid, "internal_account": internal, "audience": audience, "display_name": uid.title()},
            {"user_id": uid, "is_active": True, "goals": list(goals), "chosen": {}})


class FakeDB:
    def __init__(self, missing=(), crowd=6):
        self.missing = set(missing)
        self.files = {}
        self.tables = {"training_set_consents": [{"id": CONSENT, "user_id": OWNER, "created_at": "2026-10-31T10:00:00+00:00",
                                                  "item_count": 24, "scrubber_version": "2026-10-31.1+patterns"}],
                       "user_barriers": [], "profiles": [], "user_paths": [],
                       "social_connections": [{"owner_id": OWNER, "target_user_id": FRIEND, "status": "connected"},
                                              {"owner_id": OWNER, "target_user_id": STRANGER, "status": "pending"}]}
        people = [person(OWNER, ["Autism spectrum disorder"], goals=["Get a job"]),
                  person(OTHER, ["autism", "ADHD"], goals=["Find an internship"]),
                  person(FRIEND, ["Dyslexia"], goals=["Graduate college"])]
        # A crowd of real people who are autistic and looking for work, and test accounts who'd swell it.
        people += [person(f"crowd-{i}", ["autism"], goals=["Get a job"]) for i in range(max(0, crowd - 2))]
        people += [person(f"test-{i}", ["autism", "Tourette"], goals=["Get a job"], internal=True) for i in range(10)]
        for barriers, profile, plan in people:
            self.tables["user_barriers"] += barriers
            self.tables["profiles"].append(profile)
            self.tables["user_paths"].append(plan)
        self.tables["profiles"][0]["display_name"] = "Priya Sharma"
        self.tables["profiles"][0]["username"] = "priya_s"
        self.storage = SimpleNamespace(from_=lambda bucket: FakeBucket(self))

    def add_people(self, prefix, count, norms=(), goals=()):
        for i in range(count):
            barriers, profile, plan = person(f"{prefix}-{i}", norms, goals=goals)
            self.tables["user_barriers"] += barriers
            self.tables["profiles"].append(profile)
            self.tables["user_paths"].append(plan)
        return self

    def table(self, name):
        return FakeQuery(self, name)

    def fetch(self, url):
        path = url.split("/sign/", 1)[1].split("?", 1)[0]
        return self.files[path]


def body(**changes):
    data = {"title": "Calm first steps", "description": "Small steps for starting a job search, in plain words.",
            "tags": ["autism", "work"], "baseModel": BASE, "consentId": CONSENT,
            "memoryCheck": {"model": "my-model", "probes": 20, "skipped": 4, "failed": 0, "maxCloseness": 0.31}}
    data.update(changes)
    return adapters.AdapterIn(**data)


def run(fn, db, *args, flag="on", **kwargs):
    with patch.dict(os.environ, {"SHARED_ADAPTERS": flag}), patch.object(adapters, "get_supabase", return_value=db), \
         patch.object(adapters, "_first_bytes", side_effect=db.fetch), patch.object(scrubber, "_ner", return_value=None):
        return asyncio.run(fn(*args, **kwargs))


def share(db, user=OWNER, **changes):
    """Check, create, upload the files the page makes, publish: the whole way, as the page does it."""
    made = run(adapters.create_adapter, db, body(**changes), user_id=user)
    db.files[f"{made['id']}/adapters.safetensors"] = weights()
    db.files[f"{made['id']}/adapter_config.json"] = json.dumps(clean_config(made["id"], made["builtOn"], changes.get("baseModel", BASE))).encode()
    return made, run(adapters.publish_adapter, db, made["id"], user_id=user)


class CheckTests(unittest.TestCase):
    def test_every_check_passes_for_a_clean_adapter(self):
        out = run(adapters.check_adapter, FakeDB(), body(), user_id=OWNER)
        self.assertTrue(out["passed"], out)
        self.assertEqual(set(out["checks"]), {"scrub_review", "memorization", "metadata", "crowd", "audience", "lineage"})
        self.assertTrue(out["checks"]["memorization"]["selfReported"])

    def test_no_scrub_review_no_sharing(self):
        out = run(adapters.check_adapter, FakeDB(), body(consentId="c0000000-0000-4000-8000-000000000999"), user_id=OWNER)
        self.assertFalse(out["checks"]["scrub_review"]["passed"])
        self.assertFalse(run(adapters.check_adapter, FakeDB(), body(), user_id=OTHER)["passed"])

    def test_a_model_that_says_training_answers_back_isnt_shared(self):
        for memory in ({"model": "m", "probes": 20, "failed": 3, "maxCloseness": 1.0},
                       {"model": "m", "probes": 20, "failed": 0, "maxCloseness": 0.5},
                       {"model": "m", "probes": 2, "failed": 0, "maxCloseness": 0.1},
                       {"model": "m", "probes": 30, "failed": 0, "maxCloseness": 0.1}):    # more than the 24 approved
            out = run(adapters.check_adapter, FakeDB(), body(memoryCheck=memory), user_id=OWNER)
            self.assertFalse(out["checks"]["memorization"]["passed"], memory)

    def test_personal_information_in_the_title_or_description_blocks_it(self):
        for title, description in (("Priya's planner", "Mine."), ("Calm steps", "From priya_s."),
                                   ("Calm steps", "Made with my friend Ama."), ("Calm steps", "Email me at sam@example.org"),
                                   ("Calm steps", "Made at Humber College, my school."), ("Calm steps", "Call 416-555-0199")):
            out = run(adapters.check_adapter, FakeDB(), body(title=title, description=description), user_id=OWNER)
            self.assertFalse(out["checks"]["metadata"]["passed"], (title, description))
        out = run(adapters.check_adapter, FakeDB(), body(description="For autistic adults with ADHD starting work."), user_id=OWNER)
        self.assertTrue(out["checks"]["metadata"]["passed"], out["checks"]["metadata"])

    def test_tags_and_base_models_from_the_lists_only(self):
        self.assertFalse(run(adapters.check_adapter, FakeDB(), body(tags=["my-school"]), user_id=OWNER)["passed"])
        self.assertFalse(run(adapters.check_adapter, FakeDB(), body(baseModel="meta-llama/Llama-3.1-70B"), user_id=OWNER)["passed"])
        self.assertTrue(run(adapters.check_adapter, FakeDB(), body(baseModel="Qwen/Qwen3-4B"), user_id=OWNER)["passed"])


class CrowdTests(unittest.TestCase):
    def test_tags_shared_by_enough_real_people_pass(self):
        # autism + work: the owner, another, and the crowd of four: six real people.
        self.assertTrue(run(adapters.check_adapter, FakeDB(crowd=6), body(), user_id=OWNER)["checks"]["crowd"]["passed"])

    def test_a_rare_combination_is_refused_and_test_accounts_dont_make_a_crowd(self):
        out = run(adapters.check_adapter, FakeDB(crowd=3), body(), user_id=OWNER)
        self.assertFalse(out["checks"]["crowd"]["passed"])
        self.assertNotRegex(out["checks"]["crowd"]["why"], r"\b[0-4]\b people", "it never says how many")
        # Ten test accounts are autistic with Tourette and looking for work; no real person here is.
        self.assertFalse(run(adapters.check_adapter, FakeDB(), body(tags=["autism", "tourette"]), user_id=OWNER)["checks"]["crowd"]["passed"])

    def test_only_sharing_with_everyone_needs_a_crowd(self):
        out = run(adapters.check_adapter, FakeDB(crowd=3), body(visibility="people", people=[FRIEND]), user_id=OWNER)
        self.assertTrue(out["checks"]["crowd"]["passed"])


class AudienceTests(unittest.TestCase):
    def test_only_the_owners_connections(self):
        db = FakeDB()
        self.assertTrue(run(adapters.check_adapter, db, body(visibility="people", people=[FRIEND]), user_id=OWNER)["passed"])
        for picked in ([STRANGER], [OTHER], []):     # a pending request, someone not connected, nobody
            out = run(adapters.check_adapter, db, body(visibility="people", people=picked), user_id=OWNER)
            self.assertFalse(out["checks"]["audience"]["passed"], picked)
        self.assertEqual(run(adapters.people, db, user_id=OWNER), {"people": [{"id": FRIEND, "name": "Friend-1"}]})


class FileTests(unittest.TestCase):
    def test_the_weights_must_be_a_lora_adapter_with_nothing_hidden(self):
        self.assertIsNone(adapters.weights_problem(weights()))
        self.assertIsNone(adapters.weights_problem(weights(metadata={"format": "mlx"})))
        raw = json.dumps({"__metadata__": None, "model.layers.0.mlp.up_proj.lora_a": {"dtype": "F32"}}).encode()
        self.assertIsNone(adapters.weights_problem(struct.pack("<Q", len(raw)) + raw), "as mlx writes it")
        self.assertIn("extra information", adapters.weights_problem(weights(metadata={"author": "Jordan Ellis"})))
        self.assertIn("not a whole model", adapters.weights_problem(weights(header={"model.layers.0.mlp.up_proj.weight": {"dtype": "F32"}})))
        self.assertIsNotNone(adapters.weights_problem(b"PK\x03\x04 a zip"))
        self.assertIsNotNone(adapters.weights_problem(b""))

    def test_the_settings_file_has_only_what_the_tools_need_and_its_own_ids(self):
        aid = "b0000000-0000-4000-8000-00000000000b"
        self.assertIsNone(adapters.config_problem(clean_config(aid), BASE, aid))
        self.assertIsNone(adapters.config_problem(clean_config(aid, PARENT), BASE, aid, PARENT))
        leaky = {**clean_config(aid), "data": "/Users/jordanellis/.autinerary-model/my-model/data"}
        self.assertIn("may only have", adapters.config_problem(leaky, BASE, aid))
        self.assertIn("different base model", adapters.config_problem({**clean_config(aid), "model": "other"}, BASE, aid))
        self.assertIn("isn't the one this page made", adapters.config_problem(clean_config("someone-else"), BASE, aid))
        self.assertIn("different model it was built on", adapters.config_problem(clean_config(aid, PARENT), BASE, aid, None))

    def test_publishing_checks_the_files_that_arrived(self):
        db = FakeDB()
        made = run(adapters.create_adapter, db, body(), user_id=OWNER)
        self.assertEqual([u["path"] for u in made["uploads"]], [f"{made['id']}/adapters.safetensors", f"{made['id']}/adapter_config.json"])
        self.assertNotIn(OWNER, json.dumps(made["uploads"]), "the owner's id is in no file's path")
        with self.assertRaises(HTTPException) as caught:
            run(adapters.publish_adapter, db, made["id"], user_id=OWNER)
        self.assertEqual(caught.exception.status_code, 422)
        db.files[f"{made['id']}/adapters.safetensors"] = weights()
        db.files[f"{made['id']}/adapter_config.json"] = json.dumps({**clean_config(made["id"]), "adapter_path": "/Users/jordan/x"}).encode()
        with self.assertRaises(HTTPException):
            run(adapters.publish_adapter, db, made["id"], user_id=OWNER)
        self.assertEqual(db.tables["shared_adapters"][0]["moderation_status"], "pending")
        db.files[f"{made['id']}/adapter_config.json"] = json.dumps(clean_config(made["id"])).encode()
        self.assertEqual(run(adapters.publish_adapter, db, made["id"], user_id=OWNER)["status"], "approved")


class ListTests(unittest.TestCase):
    def test_the_list_never_says_who_shared_one(self):
        db = FakeDB()
        made, _ = share(db)
        listed = run(adapters.list_adapters, db, caller=None)["adapters"]
        self.assertEqual([a["id"] for a in listed], [made["id"]])
        self.assertNotIn(OWNER, json.dumps(listed))
        self.assertNotIn(CONSENT, json.dumps(listed))
        self.assertEqual((listed[0]["ollamaBase"], listed[0]["family"]), ("llama3.2:3b", "llama3"))
        self.assertTrue(run(adapters.list_adapters, db, caller=OWNER)["adapters"][0]["mine"])

    def test_best_for_you_first_by_your_onboarding_answers(self):
        db = FakeDB().add_people("student", 5, goals=["Graduate college"])
        share(db, title="Reading help", tags=["dyslexia"], visibility="people", people=[FRIEND])  # not listed for everyone
        share(db, title="Study blocks", tags=["students"], description="Short study sessions.")
        share(db, title="Interview nerves", tags=["work"], description="Getting ready for interviews.")
        share(db, title="Calm first steps", tags=["autism", "work"])
        listed = run(adapters.list_adapters, db, caller=OTHER)       # autistic, with ADHD, looking for an internship
        self.assertTrue(listed["forYou"])
        self.assertEqual([a["title"] for a in listed["adapters"]], ["Calm first steps", "Interview nerves", "Study blocks"])
        self.assertEqual(listed["adapters"][0]["match"], {"score": 1.0, "shared": ["autism", "work"]})
        self.assertEqual(listed["adapters"][2]["match"]["score"], 0.0)

    def test_ratings_weighted_towards_people_like_you(self):
        db = FakeDB()
        made, _ = share(db)
        run(adapters.rate_adapter, db, made["id"], adapters.RatingIn(rating=5), user_id=OTHER)    # autistic, like the crowd
        run(adapters.rate_adapter, db, made["id"], adapters.RatingIn(rating=1), user_id=FRIEND)   # dyslexic, unlike them
        for_crowd = run(adapters.list_adapters, db, caller="crowd-0")["adapters"][0]
        self.assertEqual(for_crowd["rating"], {"average": 3.0, "count": 2})
        self.assertGreater(for_crowd["ratingForYou"], 3.0)
        self.assertLess(run(adapters.list_adapters, db, caller=FRIEND)["adapters"][0]["ratingForYou"], 3.0)

    def test_which_models_came_from_which(self):
        db = FakeDB()
        db.tables["training_set_consents"].append({"id": "c0000000-0000-4000-8000-000000000002", "user_id": OTHER,
                                                   "created_at": "2026-10-31T10:00:00+00:00", "item_count": 24,
                                                   "scrubber_version": "2026-10-31.1+patterns"})
        parent, _ = share(db, title="Calm first steps")
        child, _ = share(db, user=OTHER, title="Calm first steps for interns", builtOn=parent["id"],
                         consentId="c0000000-0000-4000-8000-000000000002", description="Built on another.")
        listed = {a["id"]: a for a in run(adapters.list_adapters, db, caller=None)["adapters"]}
        self.assertEqual(listed[child["id"]]["builtOn"], {"id": parent["id"], "title": "Calm first steps"})
        self.assertEqual(listed[parent["id"]]["builtOnCount"], 1)

    def test_a_model_built_on_one_that_isnt_shared_any_more_cant_name_it(self):
        out = run(adapters.check_adapter, FakeDB(), body(builtOn=PARENT), user_id=OWNER)
        self.assertFalse(out["checks"]["lineage"]["passed"])


class VisibilityTests(unittest.TestCase):
    def test_shared_with_people_is_seen_by_them_only(self):
        db = FakeDB()
        made, _ = share(db, visibility="people", people=[FRIEND])
        self.assertEqual(run(adapters.list_adapters, db, caller=None)["adapters"], [])
        self.assertEqual([a["id"] for a in run(adapters.list_adapters, db, caller=FRIEND)["sharedWithMe"]], [made["id"]])
        self.assertEqual(run(adapters.list_adapters, db, caller=OTHER)["sharedWithMe"], [])
        run(adapters.download_adapter, db, made["id"], caller=FRIEND)
        with self.assertRaises(HTTPException):
            run(adapters.download_adapter, db, made["id"], caller=OTHER)

    def test_a_private_link_works_for_whoever_has_it_and_is_never_listed(self):
        db = FakeDB()
        made, published = share(db, visibility="link")
        key = published["linkKey"]
        self.assertTrue(key and len(key) >= 24)
        self.assertEqual(run(adapters.list_adapters, db, caller=OTHER)["adapters"], [])
        self.assertEqual(run(adapters.by_link, db, key, caller=None)["adapter"]["id"], made["id"])
        self.assertEqual(len(run(adapters.download_adapter, db, made["id"], key=key, caller=None)["files"]), 2)
        for wrong in (None, "x" * 32):
            with self.assertRaises(HTTPException):
                run(adapters.download_adapter, db, made["id"], key=wrong, caller=OTHER)
        with self.assertRaises(HTTPException):
            run(adapters.by_link, db, "nope", caller=None)

    def test_the_owner_changes_who_can_see_it(self):
        db = FakeDB()
        made, _ = share(db)
        out = run(adapters.edit_adapter, db, made["id"], adapters.AdapterEdit(title="Calm first steps", visibility="link"), user_id=OWNER)
        self.assertTrue(out["linkKey"])
        self.assertEqual(run(adapters.list_adapters, db, caller=None)["adapters"], [])
        run(adapters.edit_adapter, db, made["id"], adapters.AdapterEdit(title="Calm first steps", visibility="people", people=[FRIEND]), user_id=OWNER)
        self.assertEqual(db.tables["shared_adapters"][0]["link_token"], None)
        self.assertEqual([a["user_id"] for a in db.tables["shared_adapter_access"]], [FRIEND])
        mine = run(adapters.my_adapters, db, user_id=OWNER)["adapters"][0]
        self.assertEqual((mine["visibility"], mine["people"]), ("people", [{"id": FRIEND, "name": "Friend-1"}]))
        with self.assertRaises(HTTPException):        # back to everyone with a rare combination
            run(adapters.edit_adapter, db, made["id"], adapters.AdapterEdit(title="Calm", tags=["autism", "tourette"], visibility="everyone"), user_id=OWNER)


class UsingTests(unittest.TestCase):
    def test_download_links_with_friendly_names(self):
        db = FakeDB()
        made, _ = share(db)
        out = run(adapters.download_adapter, db, made["id"], caller=None)
        self.assertEqual([f["name"] for f in out["files"]], ["calm-first-steps.safetensors", "calm-first-steps.adapter_config.json"])
        self.assertTrue(all("expires=600" in f["url"] for f in out["files"]))

    def test_ratings_but_not_your_own(self):
        db = FakeDB()
        made, _ = share(db)
        out = run(adapters.rate_adapter, db, made["id"], adapters.RatingIn(rating=4), user_id=OTHER)
        self.assertEqual(out["rating"], {"average": 4.0, "count": 1})
        run(adapters.rate_adapter, db, made["id"], adapters.RatingIn(rating=2), user_id=OTHER)
        self.assertEqual(run(adapters.list_adapters, db, caller=OTHER)["adapters"][0]["rating"], {"average": 2.0, "count": 1})
        with self.assertRaises(HTTPException) as caught:
            run(adapters.rate_adapter, db, made["id"], adapters.RatingIn(rating=5), user_id=OWNER)
        self.assertEqual(caught.exception.status_code, 403)

    def test_a_report_goes_to_the_moderation_queue(self):
        db = FakeDB()
        made, _ = share(db)
        run(adapters.report_adapter, db, made["id"], adapters.ReportIn(reason="It says a real name"), user_id=OTHER)
        self.assertEqual(db.tables["community_reports"], [{"reporter_id": OTHER, "target_type": "adapter",
                                                           "target_id": made["id"], "reason": "It says a real name"}])

    def test_only_the_owner_edits_or_takes_it_down_and_an_edit_is_checked(self):
        db = FakeDB()
        made, _ = share(db)
        with self.assertRaises(HTTPException):
            run(adapters.edit_adapter, db, made["id"], adapters.AdapterEdit(title="Taken over"), user_id=OTHER)
        with self.assertRaises(HTTPException) as caught:
            run(adapters.edit_adapter, db, made["id"], adapters.AdapterEdit(title="Calm", description="Ask Priya Sharma"), user_id=OWNER)
        self.assertEqual(caught.exception.status_code, 422)
        run(adapters.edit_adapter, db, made["id"], adapters.AdapterEdit(title="Calmer first steps", tags=["autism"]), user_id=OWNER)
        self.assertEqual(db.tables["shared_adapters"][0]["title"], "Calmer first steps")
        with self.assertRaises(HTTPException):
            run(adapters.delete_adapter, db, made["id"], user_id=OTHER)
        run(adapters.delete_adapter, db, made["id"], user_id=OWNER)
        self.assertEqual((db.tables["shared_adapters"], db.files), ([], {}))


class SwitchTests(unittest.TestCase):
    def test_off_unless_switched_on(self):
        self.assertEqual(run(adapters.list_adapters, FakeDB(), caller=None, flag=""),
                         {"enabled": False, "adapters": [], "sharedWithMe": [], "forYou": False})
        self.assertFalse(run(adapters.status, FakeDB(), flag="")["enabled"])
        with self.assertRaises(HTTPException) as caught:
            run(adapters.create_adapter, FakeDB(), body(), user_id=OWNER, flag="")
        self.assertEqual(caught.exception.status_code, 404)

    def test_without_step_96_nothing_is_half_made(self):
        db = FakeDB(missing=["shared_adapters"])
        with self.assertRaises(HTTPException) as caught:
            run(adapters.create_adapter, db, body(), user_id=OWNER)
        self.assertEqual(caught.exception.status_code, 503)


if __name__ == "__main__":
    unittest.main()
