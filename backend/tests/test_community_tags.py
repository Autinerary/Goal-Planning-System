"""Community tags (core/community_tags.py): a person's from their onboarding answers, matching them to a model's,
weighting ratings by people like them, and the crowd a model's tags would point to.

Run from backend/:  python -m unittest tests.test_community_tags -v
"""
import unittest

from core import community_tags as ct


class PersonTagsTests(unittest.TestCase):
    def test_every_spelling_of_a_norm_is_one_tag(self):
        # Real labels from production (31 October 2026: 92 spellings in user_barriers).
        self.assertEqual(ct.person_tags(["ADHD", "adhd", "Autism spectrum disorder", "autism"]), {"adhd", "autism"})
        self.assertEqual(ct.person_tags(["OCD", "Obsessive-compulsive and related conditions"]), {"ocd"})
        self.assertEqual(ct.person_tags(["Anxiety disorders", "Mood disorders", "Cluster B"]), {"anxiety", "depression", "mental-health"})
        self.assertEqual(ct.person_tags(["esl", "Immigrant / Refugee", "low_income", "Limited Income"]), {"newcomer", "low-income"})
        self.assertEqual(ct.person_tags(["Dyscalculia", "dyslexia", "Dyspraxia"]), {"learning-disability", "dyslexia", "dyspraxia"})
        self.assertEqual(ct.person_tags(["Ehlers-Danlos syndrome", "Autoimmune condition"]), {"chronic-illness"})

    def test_answers_that_name_nothing_add_nothing(self):
        self.assertEqual(ct.person_tags(["Prefer not to share", "No current barriers", ""]), set())

    def test_who_theyre_here_for_and_their_goals_areas(self):
        self.assertEqual(ct.person_tags([], audience="child", goal_areas=["career", "education", "health"]), {"caregivers", "work", "students"})
        self.assertEqual(ct.person_tags([], audience="self"), set())


class GoalAreaTests(unittest.TestCase):
    def test_the_persons_choice_then_the_goals_words(self):
        self.assertEqual(ct.goal_areas(["Get a job", "Graduate college", "Swim once a week"]), ["career", "education", "other"])
        self.assertEqual(ct.goal_areas(["Get a job"], {"Get a job": "health"}), ["health"])
        self.assertEqual(ct.person_tags([], goal_areas=ct.goal_areas(["Find an internship", "Learn a new language"])), {"work", "students"})


class MatchTests(unittest.TestCase):
    def test_how_much_of_a_models_community_you_are_part_of(self):
        person = {"autism", "adhd", "work"}
        self.assertEqual(ct.match(person, ["autism", "work"]), (1.0, ["autism", "work"]))
        self.assertEqual(ct.match(person, ["autism", "dyslexia", "students", "anxiety"]), (0.25, ["autism"]))
        self.assertEqual(ct.match(person, []), (0.0, []))
        self.assertEqual(ct.match(person, ["not-a-tag"]), (0.0, []))

    def test_ratings_weighted_towards_people_like_you(self):
        me = {"autism", "work"}
        like_me, unlike_me = {"autism", "work"}, {"dyslexia", "students"}
        # Five stars from someone like you outweigh one star from someone unlike you.
        self.assertGreater(ct.rating_for(me, [(like_me, 5), (unlike_me, 1)]), 4.0)
        self.assertLess(ct.rating_for(me, [(like_me, 1), (unlike_me, 5)]), 2.0)
        self.assertEqual(ct.rating_for(me, []), None)
        # With no one like you, it's the plain average.
        self.assertEqual(ct.rating_for(me, [(unlike_me, 4), ({"ocd"}, 2)]), 3.0)

    def test_the_crowd_a_models_tags_point_to(self):
        people = [{"autism", "work"}, {"autism", "work", "adhd"}, {"autism"}, {"tourette", "autism", "work"}]
        self.assertEqual(ct.crowd(["autism", "work"], people), 3)
        self.assertEqual(ct.crowd(["autism", "tourette", "work"], people), 1)
        self.assertEqual(ct.crowd([], people), 0)


if __name__ == "__main__":
    unittest.main()
