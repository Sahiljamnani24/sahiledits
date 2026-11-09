"""Suggest numerical fact cards grounded in spoken words; do not verify factual claims."""
import re


def output_time(source_time, clips):
    offset = 0
    for clip in clips:
        if clip['start'] <= source_time < clip['end']:
            return offset + source_time - clip['start']
        offset += clip['end'] - clip['start']
    return None


def suggest_facts(timeline):
    words, clips = timeline.get('words', []), timeline['clips']
    total = sum(c['end']-c['start'] for c in clips)
    candidates = []
    for index, word in enumerate(words):
        raw = str(word.get('word', '')).strip().lower().rstrip('.,!')
        start = output_time(word.get('start', -1), clips)
        if start is None:
            continue
        card = None
        if re.fullmatch(r'\d+(?:\.\d+)?g', raw):
            card = raw.upper() + ' FORCE'
        elif re.fullmatch(r'\d{2,5}', raw):
            next_words = ' '.join(str(w.get('word', '')).lower().strip('.,!') for w in words[index+1:index+4])
            if re.match(r'degrees? celsius\b', next_words):
                card = raw + '°C'
            elif re.match(r'(kmph|km/h)\b', next_words):
                card = raw + ' KM/H'
        if card:
            left = min(max(0, start), total)
            right = min(total, left + 2.2)
            if right - left >= 1:
                candidates.append({'start': round(left, 2), 'end': round(right, 2),
                                   'text': card, 'kicker': 'FROM THE VIDEO', 'style': 'fact'})
    return candidates[:3]
