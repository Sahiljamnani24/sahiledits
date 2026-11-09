"""Suggest repeated takes and flag unreliable word timings for human review.

This module does not remove speech automatically: transcription timings can be
wrong, and repetition can be deliberate. All positions are in source seconds.
"""
import re
from difflib import SequenceMatcher


def _normal(word):
    value = re.sub(r"[^a-z0-9]+", "", str(word).lower())
    return {'upto': 'up', 'f1': 'formula', 'formula1': 'formula'}.get(value, value)


def review_words(words, max_gap=1.3):
    warnings, usable = [], []
    for item in words:
        start, end, text = item.get('start'), item.get('end'), item.get('word')
        if not isinstance(start, (int, float)) or not isinstance(end, (int, float)) or not isinstance(text, str):
            continue
        if end <= start:
            warnings.append({'type': 'invalid_word_time', 'word': text, 'start': start, 'end': end})
            continue
        if end - start > max_gap:
            warnings.append({'type': 'stretched_word_time', 'word': text, 'start': start, 'end': end})
        token = _normal(text)
        if token:
            usable.append({'token': token, 'word': text, 'start': start, 'end': end})

    # Compare nearby 3–8 word phrases, prefer the most complete match and report
    # only evidence, not a deletion; repeated words within a phrase are skipped.
    candidates = []
    for i, left in enumerate(usable):
        for j in range(i + 3, min(len(usable), i + 28)):
            right = usable[j]
            if right['start'] - left['start'] > 30:
                break
            for size in range(min(8, j-i, len(usable)-j), 2, -1):
                a, b = usable[i:i+size], usable[j:j+size]
                if len(set(w['token'] for w in a)) < 2:
                    continue
                score = SequenceMatcher(None, [w['token'] for w in a], [w['token'] for w in b]).ratio()
                if score >= .8:
                    candidates.append({'first_start': a[0]['start'], 'first_end': a[-1]['end'],
                        'second_start': b[0]['start'], 'second_end': b[-1]['end'],
                        'first_text': ' '.join(w['word'].strip() for w in a),
                        'second_text': ' '.join(w['word'].strip() for w in b),
                        'similarity': round(score, 2), 'words': size})
                    break
    # Group overlapping matches to avoid flooding the editor with duplicates.
    candidates.sort(key=lambda c: (-c['words'], -c['similarity'], c['first_start']))
    result = []
    for c in candidates:
        if any(c['first_start'] < r['first_end'] and r['first_start'] < c['first_end']
               and c['second_start'] < r['second_end'] and r['second_start'] < c['second_end'] for r in result):
            continue
        result.append(c)
    result.sort(key=lambda c: c['first_start'])
    return {'timing_warnings': warnings, 'repeated_take_candidates': result[:12]}
