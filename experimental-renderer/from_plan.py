#!/usr/bin/env python3
"""Convert the existing planner's source-time decisions to a render timeline."""
import argparse
import json
from render import prepare
from take_review import review_words


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


def apply_pause_suggestions(clips, pauses):
    """Split clips around reviewed source-time pause suggestions."""
    normalized = sorted(pauses, key=lambda p: p['start'])
    result = []
    for clip in clips:
        cursor = clip['start']
        for pause in normalized:
            start, end = pause['start'], pause['end']
            if end <= cursor or start >= clip['end']:
                continue
            if start - cursor >= .08:
                result.append({'start': cursor, 'end': min(start, clip['end'])})
            cursor = min(clip['end'], max(cursor, end))
        if clip['end'] - cursor >= .08:
            result.append({'start': cursor, 'end': clip['end']})
    return result


def trim_word_intervals(words, pauses):
    """Narrow words spanning a long proposed silence. Heuristic; review required."""
    aligned = []
    changed = 0
    for item in words:
        word = dict(item)
        start, end = word.get('start'), word.get('end')
        if not isinstance(start, (int, float)) or not isinstance(end, (int, float)) or end - start < .8:
            aligned.append(word)
            continue
        segments = [(start, end)]
        for pause in pauses:
            next_segments = []
            for left, right in segments:
                if pause['end'] <= left or pause['start'] >= right:
                    next_segments.append((left, right))
                else:
                    if pause['start'] - left >= .08:
                        next_segments.append((left, min(right, pause['start'])))
                    if right - pause['end'] >= .08:
                        next_segments.append((max(left, pause['end']), right))
            segments = next_segments
        if segments:
            left, right = max(segments, key=lambda span: span[1]-span[0])
            if left > start or right < end:
                word['start'], word['end'] = round(left, 3), round(right, 3)
                changed += 1
        aligned.append(word)
    return aligned, changed


def convert(plan, words, source_duration, bridge_words=False, pauses=None):
    clips = plan.get('clips', [])
    clips, repaired = bridge_short_words(clips, words) if bridge_words else (clips, 0)
    aligned_count = 0
    if pauses:
        clips = apply_pause_suggestions(clips, pauses)
        words, aligned_count = trim_word_intervals(words, pauses)
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
    review = review_words(words)
    if review['timing_warnings']:
        warnings.append(f"{len(review['timing_warnings'])} transcript word timings need review before making precise cuts or captions.")
    if review['repeated_take_candidates']:
        warnings.append(f"Found {len(review['repeated_take_candidates'])} possible repeated takes; compare them before removing speech.")
    if repaired:
        warnings.append(f'Reconnected {repaired} short missing-word gaps; review the pacing and cuts.')
    if pauses:
        warnings.append('Applied experimental pause suggestions; listen for quiet speech being removed.')
        if aligned_count:
            warnings.append(f'Adjusted {aligned_count} stretched word timings heuristically; verify subtitles against the audio.')
    if kept < source_duration * .4:
        warnings.append(f'The plan keeps {kept:.1f} of {source_duration:.1f} seconds; review for missing context.')
    for start, end, _ in normalized:
        for word in words:
            ws, we = word.get('start'), word.get('end')
            if isinstance(ws, (float, int)) and isinstance(we, (float, int)) and (ws < start < we or ws < end < we):
                warnings.append(f'A cut at {start:.2f}–{end:.2f} seconds may split a spoken word.')
                break
    base['warnings'] = warnings
    base['take_review'] = review
    prepare(base)
    return base


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--plan', required=True)
    parser.add_argument('--words', required=True, help='JSON array of timestamped words, or {"words": [...]}')
    parser.add_argument('--duration', type=float, required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--bridge-short-words', action='store_true')
    parser.add_argument('--reviewed-pauses', help='JSON file of manually reviewed source-time pauses')
    args = parser.parse_args()
    with open(args.plan, encoding='utf-8') as f:
        plan = json.load(f)
    with open(args.words, encoding='utf-8') as f:
        words = json.load(f)
    if isinstance(words, dict):
        words = words.get('words', [])
    pauses = None
    if args.reviewed_pauses:
        with open(args.reviewed_pauses, encoding='utf-8') as f:
            pauses = json.load(f).get('pauses', [])
    result = convert(plan, words, args.duration, args.bridge_short_words, pauses)
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    for warning in result['warnings']:
        print('Warning:', warning)
    print('Timeline saved:', args.output)


if __name__ == '__main__':
    main()
