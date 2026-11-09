import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
from render import prepare, subtitles, render
from from_plan import convert, apply_pause_suggestions, trim_word_intervals


class TimelineTests(unittest.TestCase):
    def test_cleanup_and_grade_are_optional_and_audio_is_mixed_after_cleanup(self):
        with TemporaryDirectory() as tmp:
            source = Path(tmp) / 'source.mp4'
            music = Path(tmp) / 'music.wav'
            source.touch()
            music.touch()
            base = {'clips': [{'start': 0, 'end': 2}]}
            with patch('render.subprocess.run') as run:
                render(source, Path(tmp) / 'out.mp4', base, 'ffmpeg')
                cmd = run.call_args.args[0]
                graph = cmd[cmd.index('-filter_complex') + 1]
                self.assertNotIn('afftdn=', graph)
                self.assertNotIn('[graded]', graph)
                render(source, Path(tmp) / 'out.mp4',
                       {**base, 'audio_cleanup': True, 'color_grade': True}, 'ffmpeg', music)
                cmd = run.call_args.args[0]
                graph = cmd[cmd.index('-filter_complex') + 1]
                self.assertIn('afftdn=', graph)
                self.assertIn('eq=brightness=', graph)
                self.assertIn('[cleaned][bg]amix=', graph)

    def test_clips_map_words_to_new_timeline_in_requested_order(self):
        plan = {'clips': [{'start': 10, 'end': 12}, {'start': 0, 'end': 2}],
                'words': [{'start': 10.2, 'end': 10.5, 'word': 'second'},
                          {'start': 0.2, 'end': 0.5, 'word': 'first'},
                          {'start': 8, 'end': 9, 'word': 'discarded'}]}
        clips, words, graphics, duration, _, _ = prepare(plan)
        result = subtitles(clips, words, graphics)
        self.assertEqual(duration, 4)
        self.assertIn('0:00:00.20,0:00:00.50,Captions', result)
        self.assertIn('0:00:02.20,0:00:02.50,Captions', result)
        self.assertNotIn('discarded', result)

    def test_rejects_bad_timing(self):
        with self.assertRaises(ValueError):
            prepare({'clips': [{'start': 2, 'end': 1}]})
        with self.assertRaises(ValueError):
            prepare({'clips': [{'start': 0, 'end': float('nan')}]})

    def test_text_is_not_interpreted_as_ass_markup(self):
        clips, words, graphics, _, _, _ = prepare({'clips': [{'start': 0, 'end': 3}],
                                             'graphics': [{'start': 0, 'end': 2, 'text': '{\\bad} hi'}]})
        result = subtitles(clips, words, graphics)
        self.assertNotIn('{\\bad} hi', result)
        self.assertIn('(／bad) hi', result)

    def test_graphics_have_timed_motion(self):
        plan = {'clips': [{'start': 0, 'end': 3}], 'graphics': [
            {'start': 0, 'end': 1, 'text': 'Headline'},
            {'start': 1, 'end': 3, 'style': 'fact', 'text': '5G', 'kicker': 'force'},
        ]}
        clips, words, graphics, _, _, _ = prepare(plan)
        script = subtitles(clips, words, graphics)
        self.assertIn('\\move(35,145,70,145,0,220)', script)
        self.assertIn('\\move(360,585,360,540,0,260)', script)

    def test_overlapping_timestamps_keep_transcript_word_order(self):
        clips, words, graphics, _, _, _ = prepare({'clips': [{'start': 0, 'end': 3}],
            'words': [{'start': 1.0, 'end': 1.2, 'word': 'brake'},
                      {'start': .9, 'end': 1.4, 'word': 'can'}]})
        text = subtitles(clips, words, graphics)
        self.assertLess(text.index('brake'), text.index('can'))

    def test_rejects_non_image_visuals(self):
        with self.assertRaises(ValueError):
            prepare({'clips': [{'start': 0, 'end': 3}],
                     'visuals': [{'start': 0, 'end': 1, 'path': '/etc/passwd'}]})

    def test_planner_zoom_is_mapped_to_each_reordered_clip(self):
        result = convert({'clips': [{'start': 10, 'end': 12}, {'start': 0, 'end': 3}],
                          'zooms': [{'start': 10.5, 'end': 11.5}], 'hook': 'Hello'}, [], 12)
        self.assertEqual(result['zooms'], [{'start': .5, 'end': 1.5, 'scale': 1.12}])
        self.assertEqual(result['graphics'][0]['text'], 'Hello')

    def test_warns_when_cut_intersects_word(self):
        result = convert({'clips': [{'start': 1, 'end': 3}]},
                         [{'start': .8, 'end': 1.2, 'word': 'cut'}], 10)
        self.assertEqual(len(result['warnings']), 2)

    def test_reconnects_omitted_short_word_only_when_requested(self):
        plan = {'clips': [{'start': 0, 'end': 1}, {'start': 2, 'end': 3}]}
        words = [{'start': 1, 'end': 2, 'word': 'the'}]
        result = convert(plan, words, 3, bridge_words=True)
        self.assertEqual(result['clips'], [{'start': 0, 'end': 3}])
        self.assertIn('Reconnected', result['warnings'][0])
        other = convert(plan, [{'start': 1, 'end': 2, 'word': 'mistake'}], 3, bridge_words=True)
        self.assertEqual(len(other['clips']), 2)

    def test_pause_suggestions_apply_within_reordered_clips(self):
        clips = [{'start': 10, 'end': 15}, {'start': 0, 'end': 5}]
        pauses = [{'start': 1, 'end': 2}, {'start': 12, 'end': 13}]
        self.assertEqual(apply_pause_suggestions(clips, pauses), [
            {'start': 10, 'end': 12}, {'start': 13, 'end': 15},
            {'start': 0, 'end': 1}, {'start': 2, 'end': 5}])

    def test_word_spanning_long_silence_is_shortened(self):
        words = [{'start': 1, 'end': 4, 'word': 'that'}, {'start': 4, 'end': 4.3, 'word': 'works'}]
        aligned, count = trim_word_intervals(words, [{'start': 1.5, 'end': 3.2}])
        self.assertEqual(count, 1)
        self.assertEqual((aligned[0]['start'], aligned[0]['end']), (3.2, 4))
        self.assertEqual(aligned[1], words[1])


if __name__ == '__main__':
    unittest.main()
