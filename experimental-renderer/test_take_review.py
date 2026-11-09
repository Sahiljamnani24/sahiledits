import unittest
from take_review import review_words


class TakeReviewTest(unittest.TestCase):
    def test_flags_stretched_words_without_changing_them(self):
        result = review_words([{'word': 'hello', 'start': 0, 'end': 2.3}])
        self.assertEqual(result['timing_warnings'][0]['type'], 'stretched_word_time')
        self.assertEqual(result['timing_warnings'][0]['end'], 2.3)

    def test_suggests_repeated_phrase_without_deleting_it(self):
        text = 'we are going now we are going now'.split()
        words = [{'word': w, 'start': i*.4, 'end': i*.4+.25} for i,w in enumerate(text)]
        matches = review_words(words)['repeated_take_candidates']
        self.assertTrue(any('we are going now' in m['first_text'] and 'we are going now' in m['second_text'] for m in matches))

    def test_does_not_flag_single_repeated_word_as_take(self):
        words = [{'word': 'um', 'start': i, 'end': i+.2} for i in range(8)]
        self.assertEqual(review_words(words)['repeated_take_candidates'], [])


if __name__ == '__main__':
    unittest.main()
