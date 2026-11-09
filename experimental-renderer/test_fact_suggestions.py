import unittest
from fact_suggestions import suggest_facts


class FactSuggestionTests(unittest.TestCase):
    def test_only_uses_facts_in_kept_video(self):
        timeline = {'clips': [{'start': 5, 'end': 15}], 'words': [
            {'start': 1, 'end': 1.2, 'word': '300'}, {'start': 1.2, 'end': 1.4, 'word': 'kmph'},
            {'start': 6, 'end': 6.2, 'word': '5g'},
            {'start': 10, 'end': 10.2, 'word': '1000'},
            {'start': 10.2, 'end': 10.5, 'word': 'degree'},
            {'start': 10.5, 'end': 10.8, 'word': 'celsius'}]}
        facts = suggest_facts(timeline)
        self.assertEqual([f['text'] for f in facts], ['5G FORCE', '1000°C'])
        self.assertEqual([f['kicker'] for f in facts], ['G-FORCE', 'TEMPERATURE'])
        self.assertEqual(facts[0]['start'], 1)


if __name__ == '__main__':
    unittest.main()
