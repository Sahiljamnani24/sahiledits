import math
import struct
import tempfile
import unittest
import wave
from pathlib import Path
from pause_suggestions import find_pauses


class PauseSuggestionTests(unittest.TestCase):
    def test_suggests_long_quiet_gap_but_preserves_short_word(self):
        rate = 8000
        data = []
        for i in range(rate * 4):
            second = i / rate
            amplitude = 12000 if second < 1 or second >= 3 else 200
            data.append(int(amplitude * math.sin(2 * math.pi * 440 * second)))
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'speech.wav'
            with wave.open(str(path), 'wb') as out:
                out.setnchannels(1)
                out.setsampwidth(2)
                out.setframerate(rate)
                out.writeframes(struct.pack('<' + 'h'*len(data), *data))
            pauses, threshold = find_pauses(path, [])
            self.assertEqual(len(pauses), 1)
            self.assertGreater(pauses[0]['end'] - pauses[0]['start'], 1)
            protected, _ = find_pauses(path, [{'start': 1.4, 'end': 1.8, 'word': 'quiet'}])
            self.assertEqual(protected, [])
            self.assertIsNotNone(threshold)


if __name__ == '__main__':
    unittest.main()
