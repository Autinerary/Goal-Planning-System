"""The scrubber for training sets (core/scrubber.py): what it replaces, what it leaves alone, and that it's stable.

Most tests run on the patterns alone (use_ner=False), so they pass the same with or without spaCy installed. The
recogniser's own tests run only where spaCy and en_core_web_sm are installed.

Run from backend/:  python -m unittest tests.test_scrubber -v
"""
import unittest

from core import scrubber


def scrub(text, **kwargs):
    kwargs.setdefault("use_ner", False)
    return scrubber.scrub(text, **kwargs)


class ShapesTests(unittest.TestCase):
    def test_emails_links_and_handles(self):
        r = scrub("Email sam.lee+test@gmail.com, see https://example.com/me?x=1. Or @jordan_e on Instagram.")
        self.assertEqual(r.text, "Email [EMAIL], see [LINK]. Or [NAME] on Instagram.")
        self.assertEqual(r.found, {"email": 1, "link": 1, "name": 1})

    def test_phone_numbers(self):
        for phone in ["(416) 555-0199", "416-555-0199", "416.555.0199", "+1 416 555 0199", "4165550199",
                      "416-555-0199 ext 22", "+44 20 7946 0958"]:
            self.assertEqual(scrub(f"Call {phone} today.").text, "Call [PHONE] today.", phone)

    def test_id_numbers(self):
        self.assertEqual(scrub("My SIN is 123 456 789.").text, "My SIN is [ID_NUMBER].")
        self.assertEqual(scrub("Health card 1234-567-890-AB please").text, "Health card [ID_NUMBER] please")

    def test_street_addresses_and_postal_codes(self):
        cases = {
            "I live at 42 Wellesley Street East, Apt 3 now.": "I live at [ADDRESS] now.",
            "Meet at 100 Queen St W.": "Meet at [ADDRESS]",
            "It's at 5th Ave and Main.": "It's at 5th Ave and Main.",          # no number before it: not an address
            "my address is 12 maple crescent": "my address is [ADDRESS]",
            "Toronto M4Y 1G7 and m5v2t6": "Toronto [ADDRESS] and [ADDRESS]",
            "Send it to PO Box 123.": "Send it to [ADDRESS].",
            "Moved to 7 Elm Rd.": "Moved to [ADDRESS]",
        }
        for before, after in cases.items():
            self.assertEqual(scrub(before).text, after, before)

    def test_dates_of_birth_only(self):
        self.assertEqual(scrub("I was born on March 3, 1990.").text, "I was born on [DATE_OF_BIRTH].")
        self.assertEqual(scrub("My birthday is 12/04/2001").text, "My birthday is [DATE_OF_BIRTH]")
        self.assertEqual(scrub("DOB: 1990-03-03").text, "DOB: [DATE_OF_BIRTH]")
        self.assertEqual(scrub("born in 1988 in Lagos").text, "born in [DATE_OF_BIRTH] in Lagos")
        # Other dates aren't dates of birth.
        self.assertEqual(scrub("On March 3, 2026 I swam twice.").text, "On March 3, 2026 I swam twice.")


class HealthTests(unittest.TestCase):
    def test_diagnosis_terms(self):
        r = scrub("I'm autistic, with ADHD and generalized anxiety disorder; my son has Tourette's and dyslexia.")
        self.assertEqual(r.text, "I'm [DIAGNOSIS], with [DIAGNOSIS] and [DIAGNOSIS]; my son has [DIAGNOSIS] and [DIAGNOSIS].")
        self.assertEqual(r.found, {"diagnosis": 5})

    def test_diagnosed_with_catches_what_the_list_lacks(self):
        self.assertEqual(scrub("I was diagnosed with a rare connective tissue thing when I was 12.").text,
                         "I was diagnosed with a [DIAGNOSIS] when I was 12.")
        self.assertEqual(scrub("Dx: hypermobility, and it hurts").text, "Dx: [DIAGNOSIS], and it hurts")

    def test_acronyms_that_are_words_count_only_in_capitals(self):
        self.assertEqual(scrub("I have ADD and ODD.").text, "I have [DIAGNOSIS] and [DIAGNOSIS].")
        self.assertEqual(scrub("It was odd, so I'll add a step.").text, "It was odd, so I'll add a step.")

    def test_medicines(self):
        self.assertEqual(scrub("Took my Vyvanse late; sertraline helps.").text, "Took my [MEDICATION] late; [MEDICATION] helps.")


class PeopleTests(unittest.TestCase):
    def test_names_by_cue(self):
        cases = {
            "My therapist Dr. Okafor said hi.": "My therapist Dr. [NAME] said hi.",
            "my counsellor, Dana Whitfield, says hi": "my counsellor, [NAME], says hi",
            "My mom Linda drove me.": "My mom [NAME] drove me.",
            "My name is Jordan Ellis.": "My name is [NAME].",
            "Marcus said I did well. Nkechi is my sister.": "[NAME] said I did well. [NAME] is my sister.",
            "Aisha and I went to the library.": "[NAME] and I went to the library.",
        }
        for before, after in cases.items():
            self.assertEqual(scrub(before).text, after, before)

    def test_the_persons_own_name_from_their_profile(self):
        r = scrub("Jordan forgot again. Ellis family dinner. jordan_e posted.", known_names=["Jordan Ellis", "jordan_e"])
        self.assertEqual(r.text, "[NAME] forgot again. [NAME] family dinner. [NAME] posted.")
        # A display name that isn't a name (an email's start) adds nothing.
        self.assertEqual(scrub("Test the account.", known_names=["test.account+riipen"]).text, "Test the account.")

    def test_schools_and_employers(self):
        cases = {
            "I study at Seneca and work for Tim Hortons.": "I study at [SCHOOL] and work for [EMPLOYER].",
            "Classes at Humber College start Monday.": "Classes at [SCHOOL] start Monday.",
            "The University of Toronto is big.": "The [SCHOOL] is big.",
            "I graduated from Northview Heights Secondary School.": "I graduated from [SCHOOL].",
            "My co-op at Shopify ends soon; I volunteered at the Daily Bread Food Bank.":
                "My co-op at [EMPLOYER] ends soon; I volunteered at the [EMPLOYER].",
        }
        for before, after in cases.items():
            self.assertEqual(scrub(before).text, after, before)


class LeftAloneTests(unittest.TestCase):
    def test_ordinary_writing_is_unchanged(self):
        for text in [
            "I ran 5 km down the road and read 20 pages.",
            "I felt anxious but it was odd, so I will add a step.",
            "In 2024 I started swimming at 7 am on Mondays.",
            "He said it was fine. Mom called. Everyone came.",
            "Will you call me? Hope this helps. May was a hard month.",
            "Break it into two sittings: I got overwhelmed after an hour.",
            "I work at home on Fridays and study at night.",
        ]:
            self.assertEqual(scrub(text).text, text, text)
            self.assertEqual(scrub(text).found, {}, text)

    def test_placeholders_are_kept_and_scrubbing_twice_changes_nothing(self):
        text = ("Yesterday I talked with my friend Priya about my job at Loblaws. Call 416-555-0199. "
                "I was born on 3 March 1990 and I'm autistic. I live at 42 Wellesley St E.")
        once = scrub(text).text
        self.assertEqual(scrub(once).text, once)
        self.assertEqual(scrub(once).found, {})
        self.assertEqual(scrub("[NAME] went to the [SCHOOL] office.").text, "[NAME] went to the [SCHOOL] office.")

    def test_empty_and_long_text(self):
        self.assertEqual(scrub("").text, "")
        self.assertEqual(scrub("   ").found, {})
        self.assertLessEqual(len(scrub("a " * 20_000).text), scrubber.MAX_TEXT_CHARS)


@unittest.skipUnless(scrubber.uses_ner(), "spaCy and en_core_web_sm aren't installed")
class RecogniserTests(unittest.TestCase):
    def test_names_and_organisations_the_cues_miss(self):
        r = scrubber.scrub("Yesterday I talked with Priya Sharma about my shifts at Loblaws and classes at Humber College.")
        self.assertEqual(r.text, "Yesterday I talked with [NAME] about my shifts at [EMPLOYER] and classes at [SCHOOL].")

    def test_everyday_words_at_the_start_of_a_sentence_are_not_names(self):
        self.assertEqual(scrubber.scrub("Email me later. My SIN is private.").text, "Email me later. My SIN is private.")

    def test_the_version_says_what_found_names(self):
        self.assertTrue(scrubber.version().startswith(scrubber.SCRUBBER_VERSION + "+en_core_web_sm"))


class VersionTests(unittest.TestCase):
    def test_the_version_without_the_recogniser(self):
        import os
        from unittest import mock
        with mock.patch.dict(os.environ, {"SCRUBBER_NER": "off"}):
            self.assertEqual(scrubber.version(), f"{scrubber.SCRUBBER_VERSION}+patterns")
            self.assertFalse(scrubber.uses_ner())


if __name__ == "__main__":
    unittest.main()
