#!/usr/bin/env python3
"""Convert the existing planner's source-time decisions to a render timeline."""
import argparse
import json
from render import prepare


def bridge_short_words(clips, words):
    """Conservatively reconnect a few omitted function words; still requires review."""
    safe = {'the', 'a', 'an', 'of', 'to', 'them', 'their', 'thats', 'its', 'is'}
    result, repairs = [], 0
    for original in clips:
        clip = dict(original)
        if result:
            previous = result[-1]
            gap_start, gap_end = previous['end'], clip['start']
            if 0 <= gap_end - gap_start <= 4:
                missing = [w for w in words if w.get('start', -1) >= gap_start - .001
                           and w.get('end', -1) <= gap_end + .001
                           and w.get('end', -1) > gap_start + .001]
                normalized = [''.join(c for c in str(w.get('word', '')).lower() if c.isalpha()) for w in missing]
                if 1 <= len(missing) <= 2 and all(w in safe for w in normalized):
                    previous['end'] = clip['end']
                    repairs += 1
                    continue
                if abs(gap_end - gap_start) < .001:
                    previous['end'] = clip['end']
                    continue
        result.append(clip)
    return result, repairs


def convert(plan, words, source_duration, bridge_words=False):
    clips = plan.get('clips', [])
    clips, repaired = bridge_short_words(clips, words) if bridge_words else (clips, 0)
    base = {'clips': clips, 'words': words, 'graphics': [], 'zooms': []}
    normalized, _, _, kept, _, _ = prepare(base)
    if any(end > source_duration for _, end, _ in normalized):
        raise ValueError('a selected clip is beyond the end of the video')
    for zoom in plan.get('zooms', []):
        for start, end, offset in normalized:
            left = max(start, zoom.get('start', 0))
            right = min(end, zoom.get('end', 0))
            if right > left:
                base['zooms'].append({'start': offset + left - start,
                                      'end': offset + right - start, 'scale': 1.12})
    hook = str(plan.get('hook', '')).strip()
    if hook:
        base['graphics'].append({'start': 0, 'end': min(3.5, kept), 'text': hook[:100]})
    warnings = []
    if repaired:
        warnings.append(f'Reconnected {repaired} short missing-word gaps; review the pacing and cuts.')
    if kept < source_duration * .4:
        warnings.append(f'The plan keeps {kept:.1f} of {source_duration:.1f} seconds; review for missing context.')
    for start, end, _ in normalized:
        for word in words:
            ws, we = word.get('start'), word.get('end')
            if isinstance(ws, (float, int)) and isinstance(we, (float, int)) and (ws < start < we or ws < end < we):
                warnings.append(f'A cut at {start:.2f}–{end:.2f} seconds may split a spoken word.')
                break
    base['warnings'] = warnings
    prepare(base)
    return base


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--plan', required=True)
    parser.add_argument('--words', required=True, help='JSON array of timestamped words, or {"words": [...]}')
    parser.add_argument('--duration', type=float, required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--bridge-short-words', action='store_true')
    args = parser.parse_args()
    with open(args.plan, encoding='utf-8') as f:
        plan = json.load(f)
    with open(args.words, encoding='utf-8') as f:
        words = json.load(f)
    if isinstance(words, dict):
        words = words.get('words', [])
    result = convert(plan, words, args.duration, args.bridge_short_words)
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    for warning in result['warnings']:
        print('Warning:', warning)
    print('Timeline saved:', args.output)


if __name__ == '__main__':
    main()
