import unittest
from tempfile import TemporaryDirectory
from unittest.mock import patch

from app import LEVELS, NOTES, NOTE_RANGES, QUESTION_COUNT, build_notes, choose_note, init_db, levels_data, practice_weight


class PracticeLogicTest(unittest.TestCase):
    def test_note_catalog_covers_first_to_third_position_range(self):
        note_ids = [note["id"] for note in NOTES]
        self.assertEqual(len(note_ids), 20)
        self.assertEqual(len(note_ids), len(set(note_ids)))
        self.assertEqual(note_ids[0], "G3")
        self.assertEqual(note_ids[-1], "E6")

    def test_note_range_builder_keeps_future_ranges_configurable(self):
        notes = build_notes(NOTE_RANGES["first_to_third"])
        self.assertEqual(notes, NOTES)

    def test_levels_include_position_and_review_challenges(self):
        self.assertEqual(len(LEVELS), 10)
        self.assertEqual(sum(level["kind"] == "position" for level in LEVELS), 7)
        self.assertEqual(sum(level["kind"] == "review" for level in LEVELS), 2)
        self.assertEqual(LEVELS[-1]["kind"], "total")
        self.assertTrue(all(QUESTION_COUNT == 20 for _ in LEVELS))

    def test_level_data_exposes_each_range_label(self):
        with TemporaryDirectory() as directory:
            with patch("app.DATABASE_PATH", f"{directory}/test.db"):
                init_db()
                data = levels_data()
                self.assertEqual(data[0]["range_label"], "G3–B5")
                self.assertEqual(data[-1]["range_label"], "G3–B6")

    def test_mistakes_increase_practice_weight(self):
        self.assertGreater(practice_weight(4, 3), practice_weight(4, 0))
        self.assertGreater(practice_weight(0, 0), practice_weight(4, 0))

    def test_choose_note_reads_empty_database(self):
        with TemporaryDirectory() as directory:
            with patch("app.DATABASE_PATH", f"{directory}/test.db"):
                init_db()
                self.assertIn(choose_note(), NOTES)


if __name__ == "__main__":
    unittest.main()
