#!/usr/bin/env python3
"""Create an honest transcript-based checklist; this cannot rate editing taste."""
import argparse
import json
from pathlib import Path
from take_review import review_words


def review(timeline, source_duration):
    clips = timeline.get('clips', [])
    words = timeline.get('words', [])
    kept_duration = sum(c['end']-c['start'] for c in clips)
    selected_words = []
    for clip in clips:
        selected_words.extend(str(w.get('word', '')).strip() for w in words
                              if w.get('start', -1) >= clip['start'] and w.get('end', -1) <= clip['end'])
    cut_warnings = []
    for clip in clips:
        for edge in (clip['start'], clip['end']):
            for word in words:
                if word.get('start', -1) + .02 < edge < word.get('end', -1) - .02:
                    cut_warnings.append({'at': round(edge, 3), 'word': word.get('word', '')})
    repeated = []
    for pair in review_words(words)['repeated_take_candidates']:
        # Report only when both full candidate phrases are retained. This is
        # evidence for review, not proof that either take should be deleted.
        retained = lambda start, end: any(c['start'] <= start and end <= c['end'] for c in clips)
        if retained(pair['first_start'], pair['first_end']) and retained(pair['second_start'], pair['second_end']):
            repeated.append(pair)
    return {'source_seconds': round(source_duration, 2), 'edit_seconds': round(kept_duration, 2),
            'kept_transcript': ' '.join(selected_words), 'cut_warnings': cut_warnings,
            'possible_repeated_takes': repeated,
            'graphics_count': len(timeline.get('graphics', [])),
            'important': 'Transcript timing may be wrong. Listen to every cut and compare visuals with the reference.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--timeline', required=True)
    parser.add_argument('--source-duration', required=True, type=float)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    result = review(json.loads(Path(args.timeline).read_text()), args.source_duration)
    Path(args.output).write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding='utf-8')
    print(f"{result['source_seconds']}s source → {result['edit_seconds']}s edit; "
          f"{len(result['cut_warnings'])} possible word-boundary problems; "
          f"{result['graphics_count']} graphic(s).")
    print(result['important'])


if __name__ == '__main__':
    main()
