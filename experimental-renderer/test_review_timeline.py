import unittest
from review_timeline import review


class TimelineReviewTests(unittest.TestCase):
    def test_repeat_warning_only_when_both_candidates_are_kept(self):
        words = [{'word': word, 'start': i * .3, 'end': i * .3 + .2}
                 for i, word in enumerate(['they', 'are', 'fighting', 'physics', 'they', 'are', 'fighting', 'physics'])]
        full = review({'clips': [{'start': 0, 'end': 3}], 'words': words}, 3)
        self.assertTrue(full['possible_repeated_takes'])
        partial = review({'clips': [{'start': 0, 'end': 1.1}], 'words': words}, 3)
        self.assertFalse(partial['possible_repeated_takes'])

    def test_transcript_follows_clip_order_and_reports_split_words(self):
        timeline = {'clips': [{'start': 5, 'end': 7}, {'start': 0, 'end': 2}],
                    'words': [{'word': 'first', 'start': 0, 'end': .5},
                              {'word': 'second', 'start': 5, 'end': 5.5},
                              {'word': 'broken', 'start': 1.8, 'end': 2.3}],
                    'graphics': []}
        result = review(timeline, 10)
        self.assertEqual(result['kept_transcript'], 'second first')
        self.assertEqual(result['edit_seconds'], 4)
        self.assertEqual(result['cut_warnings'][0]['word'], 'broken')


if __name__ == '__main__':
    unittest.main()
