#!/usr/bin/env python3
"""Find possible pauses using 16-bit mono WAV energy. Suggestions require review."""
import argparse
import array
import json
import math
import sys
import wave
from pathlib import Path


def find_pauses(path, words, window=.05):
    with wave.open(str(path), 'rb') as audio:
        if audio.getnchannels() != 1 or audio.getsampwidth() != 2:
            raise ValueError('Audio must be 16-bit mono PCM WAV')
        rate = audio.getframerate()
        chunk = max(1, round(rate * window))
        levels = []
        while True:
            data = audio.readframes(chunk)
            if not data:
                break
            samples = array.array('h')
            samples.frombytes(data)
            if sys.byteorder != 'little':
                samples.byteswap()
            rms = math.sqrt(sum(x*x for x in samples) / len(samples)) if samples else 0
            levels.append(20 * math.log10(max(rms, 1) / 32768))
    if not levels:
        return [], None
    ordered = sorted(levels)
    floor = ordered[int((len(ordered)-1)*.20)]
    loud = ordered[int((len(ordered)-1)*.90)]
    if loud - floor < 9:
        return [], None
    threshold = min(-25, max(-42, floor + 6))
    raw, begin = [], None
    for i, level in enumerate(levels + [0]):
        if level < threshold and begin is None:
            begin = i * window
        if level >= threshold and begin is not None:
            end = i * window
            if end - begin >= .8:
                raw.append((begin + .2, end - .2))
            begin = None
    result = []
    for start, end in raw:
        # Do not suggest cutting through a short, plausibly accurate word interval.
        conflict = any(isinstance(w.get('start'), (int, float)) and isinstance(w.get('end'), (int, float))
                       and w['end'] - w['start'] <= .8
                       and min(end, w['end']) - max(start, w['start']) > .03 for w in words)
        if not conflict and end - start >= .4:
            result.append({'start': round(start, 3), 'end': round(end, 3)})
    return result, round(threshold, 1)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--audio', required=True)
    parser.add_argument('--words', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    words = json.loads(Path(args.words).read_text(encoding='utf-8'))
    if isinstance(words, dict):
        words = words.get('words', [])
    pauses, threshold = find_pauses(args.audio, words)
    Path(args.output).write_text(json.dumps({'threshold_db': threshold, 'pauses': pauses}, indent=2), encoding='utf-8')
    print(f'{len(pauses)} possible pauses found. Review them before cutting; quiet speech can be mistaken for silence.')


if __name__ == '__main__':
    main()
