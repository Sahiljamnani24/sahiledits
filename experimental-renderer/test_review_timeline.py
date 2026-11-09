import unittest
from review_timeline import review


class TimelineReviewTests(unittest.TestCase):
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
