#!/usr/bin/env python3
"""Render a validated edit timeline to MP4. Local prototype, not a public API."""
import argparse
import json
import math
import os
import subprocess
import sys
import tempfile
from pathlib import Path


def num(value, name, low=0, high=7200):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < low - 1e-7 or value > high + 1e-7:
        raise ValueError(f'{name} must be between {low} and {high}')
    return min(high, max(low, float(value)))


def timestamp(seconds):
    centis = max(0, round(seconds * 100))
    hours, centis = divmod(centis, 360000)
    minutes, centis = divmod(centis, 6000)
    return f'{hours}:{minutes:02}:{centis // 100:02}.{centis % 100:02}'


def ass_escape(text):
    # Escape ASS control syntax; planner text must never become formatting code.
    return str(text).replace('\\', '／').replace('{', '(').replace('}', ')').replace('\n', ' ')[:160]


def prepare(plan):
    clips = plan.get('clips')
    if not isinstance(clips, list) or not 1 <= len(clips) <= 50:
        raise ValueError('clips must contain 1 to 50 selections')
    normalized = []
    offset = 0.0
    for item in clips:
        start = num(item.get('start'), 'clip start')
        end = num(item.get('end'), 'clip end')
        if end <= start or end - start < .08:
            raise ValueError('each clip must last at least 0.08 seconds')
        normalized.append((start, end, offset))
        offset += end - start
    words = plan.get('words', [])
    if not isinstance(words, list) or len(words) > 5000:
        raise ValueError('words must be an array of at most 5000 items')
    clean_words = []
    for item in words:
        start = num(item.get('start'), 'word start')
        end = num(item.get('end'), 'word end')
        text = str(item.get('word', '')).strip()
        if end > start and text:
            clean_words.append((start, end, text[:60]))
    # Keep the recognizer's word order. Timestamps can overlap or move backwards;
    # sorting by start time can silently swap words in the caption.
    graphics = plan.get('graphics', [])
    if not isinstance(graphics, list) or len(graphics) > 50:
        raise ValueError('graphics must be an array of at most 50 items')
    clean_graphics = []
    for graphic in graphics:
        start = num(graphic.get('start'), 'graphic start', high=offset)
        end = num(graphic.get('end'), 'graphic end', high=offset)
        text = str(graphic.get('text', '')).strip()
        style = graphic.get('style', 'headline')
        if style not in ('headline', 'fact'):
            raise ValueError('unsupported graphic style')
        if end > start and text:
            clean_graphics.append((start, end, text[:100], style, str(graphic.get('kicker', ''))[:40]))
    zooms = plan.get('zooms', [])
    if not isinstance(zooms, list) or len(zooms) > 50:
        raise ValueError('zooms must be an array of at most 50 items')
    clean_zooms = []
    for zoom in zooms:
        start = num(zoom.get('start'), 'zoom start', high=offset)
        end = num(zoom.get('end'), 'zoom end', high=offset)
        strength = num(zoom.get('scale', 1.12), 'zoom scale', low=1, high=1.4)
        if end <= start:
            raise ValueError('zoom end must follow start')
        clean_zooms.append((start, end, strength))
    visuals = plan.get('visuals', [])
    if not isinstance(visuals, list) or len(visuals) > 20:
        raise ValueError('visuals must be an array of at most 20 items')
    clean_visuals = []
    for visual in visuals:
        start = num(visual.get('start'), 'visual start', high=offset)
        end = num(visual.get('end'), 'visual end', high=offset)
        path = Path(str(visual.get('path', '')))
        if end <= start or not path.is_file() or path.suffix.lower() not in ('.jpg', '.jpeg', '.png', '.webp'):
            raise ValueError('visuals require a local image file and valid output times')
        clean_visuals.append((start, end, str(path)))
    return normalized, clean_words, clean_graphics, offset, clean_zooms, clean_visuals


def subtitles(clips, words, graphics):
    header = '''[Script Info]
ScriptType: v4.00+
PlayResX: 720
PlayResY: 1280
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Captions,Arial,50,&H00FFFFFF,&H00FFFFFF,&H20101010,&H20101010,-1,0,0,0,100,100,0,0,3,10,0,2,48,48,135,1
Style: Headline,Arial,54,&H00FFFFFF,&H00FFFFFF,&H00101010,&H00101010,-1,0,0,0,100,100,0,0,1,1,0,7,0,0,0,1
Style: Fact,Arial,66,&H00A12622,&H00FFFFFF,&H00A12622,&H00A12622,-1,0,0,0,100,100,0,0,1,0,0,5,60,60,0,1
Style: FactLabel,Arial,32,&H00393939,&H00FFFFFF,&H00393939,&H00393939,-1,0,0,0,100,100,3,0,1,0,0,5,60,60,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
'''
    events = []
    for start, end, text, style, kicker in graphics:
        # Cards are on output time; all content is escaped before becoming ASS.
        if style == 'fact':
            safe = ass_escape(text)
            events.append(f'Dialogue: 1,{timestamp(start)},{timestamp(end)},Fact,,0,0,0,,{{\\pos(360,540)\\fad(220,180)}}{safe}')
            if kicker:
                events.append(f'Dialogue: 1,{timestamp(start)},{timestamp(end)},FactLabel,,0,0,0,,{{\\pos(360,365)\\fad(220,180)}}{ass_escape(kicker).upper()}')
        else:
            events.append(f'Dialogue: 1,{timestamp(start)},{timestamp(end)},Headline,,0,0,0,,{{\\an7\\pos(70,145)\\fad(180,180)}}{ass_escape(text)}')
    for source_start, source_end, offset in clips:
        visible = []
        previous_start = offset
        for s, e, text in words:
            if s < source_start or e > source_end:
                continue
            start = max(previous_start, s - source_start + offset)
            end = min(source_end - source_start + offset, max(start + .01, e - source_start + offset))
            if end > start:
                visible.append((start, end, text))
                previous_start = start
        for i in range(0, len(visible), 3):
            group = visible[i:i+3]
            if not group:
                continue
            for j, (start, end, _) in enumerate(group):
                next_word = i + j + 1
                event_end = visible[next_word][0] if next_word < len(visible) else end
                if event_end <= start:
                    continue
                parts = []
                for k, (_, _, text) in enumerate(group):
                    color = '&H0029FAD9&' if k == j else '&H00FFFFFF&'
                    parts.append('{\\c'+color+'}'+ass_escape(text))
                events.append(f'Dialogue: 2,{timestamp(start)},{timestamp(event_end)},Captions,,0,0,0,,'+' '.join(parts))
    return header + '\n'.join(events) + '\n'


def render(source, output, plan, ffmpeg, music=None):
    clips, words, graphics, duration, zooms, visuals = prepare(plan)
    if not Path(source).is_file():
        raise ValueError('source video does not exist')
    if music and not Path(music).is_file():
        raise ValueError('music file does not exist')
    with tempfile.TemporaryDirectory(prefix='sahiledits-render-') as tmp:
        subfile = Path(tmp) / 'captions.ass'
        subfile.write_text(subtitles(clips, words, graphics), encoding='utf-8')
        count = len(clips)
        graph = []
        if count > 1:
            graph += [f'[0:v]split={count}'+''.join(f'[vs{i}]' for i in range(count)),
                      f'[0:a]asplit={count}'+''.join(f'[as{i}]' for i in range(count))]
        for i, (start, end, _) in enumerate(clips):
            vin = f'[vs{i}]' if count > 1 else '[0:v]'
            ain = f'[as{i}]' if count > 1 else '[0:a]'
            graph.append(f'{vin}trim=start={start}:end={end},setpts=PTS-STARTPTS,'
                         f'scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,'
                         f'setsar=1,fps=30[v{i}]')
            graph.append(f'{ain}atrim=start={start}:end={end},asetpts=PTS-STARTPTS,'
                         f'aresample=48000[a{i}]')
        graph.append(''.join(f'[v{i}][a{i}]' for i in range(count))+f'concat=n={count}:v=1:a=1[vcat][acat]')
        current = '[vcat]'
        if zooms:
            terms = [f"({strength-1})*max(0,min(1,min((on/30-{start})*4,({end}-on/30)*4)))"
                     for start, end, strength in zooms]
            expression = 'min(1.4,1+' + '+'.join(terms) + ')'
            graph.append(f"{current}zoompan=z='{expression}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=720x1280:fps=30[zoomed]")
            current = '[zoomed]'
        input_offset = 2 if music else 1
        for i, (start, end, _) in enumerate(visuals):
            layer, composed = f'[visual{i}]', f'[composed{i}]'
            graph.append(f'[{input_offset+i}:v]scale=720:560:force_original_aspect_ratio=decrease,'
                         f'pad=720:560:(ow-iw)/2:(oh-ih)/2:color=0xeeece5,setsar=1{layer}')
            graph.append(f"{current}{layer}overlay=x=0:y=0:enable='between(t,{start},{end})':shortest=0{composed}")
            current = composed
        for i, (start, end, _, style, _) in enumerate(graphics):
            label = f'[card{i}]'
            if style == 'fact':
                graph.append(f"{current}drawbox=x=0:y=0:w=720:h=1280:color=0xf3f1e7:t=fill:enable='between(t,{start},{end})',"
                             f"drawbox=x=46:y=270:w=628:h=540:color=0x313c92:t=fill:enable='between(t,{start},{end})',"
                             f"drawbox=x=56:y=280:w=608:h=520:color=0xf2c3d2:t=fill:enable='between(t,{start},{end})',"
                             f"drawbox=x=74:y=300:w=572:h=480:color=0xfff9ea:t=fill:enable='between(t,{start},{end})'{label}")
            else:
                graph.append(f"{current}drawbox=x=42:y=105:w=636:h=172:color=black@0.85:t=fill:enable='between(t,{start},{end})',"
                             f"drawbox=x=42:y=105:w=9:h=172:color=0xd9fa29:t=fill:enable='between(t,{start},{end})'{label}")
            current = label
        graph.append(f"{current}ass=filename='{subfile}'[outv]")
        if music:
            graph.append(f'[1:a]atrim=duration={duration},asetpts=PTS-STARTPTS,volume=0.12[bg]')
            graph.append('[acat][bg]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.95[outa]')
        command = [ffmpeg, '-hide_banner', '-loglevel', 'warning', '-y', '-protocol_whitelist', 'file,pipe', '-i', str(source)]
        if music:
            command += ['-stream_loop', '-1', '-protocol_whitelist', 'file,pipe', '-i', str(music)]
        for _, _, path in visuals:
            command += ['-loop', '1', '-framerate', '30', '-protocol_whitelist', 'file,pipe', '-i', path]
        command += ['-filter_complex', ';'.join(graph), '-map', '[outv]', '-map', '[outa]' if music else '[acat]',
                    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
                    '-c:a', 'aac', '-b:a', '160k', '-t', str(duration), '-movflags', '+faststart', str(output)]
        print(f'Rendering {len(clips)} clips, {len(words)} timed words and {len(graphics)} graphics ({duration:.1f}s)', flush=True)
        subprocess.run(command, check=True, timeout=300, env={'PATH': os.defpath, 'HOME': tmp})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--video', required=True)
    parser.add_argument('--timeline', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--ffmpeg', default=os.environ.get('FFMPEG', 'ffmpeg'))
    parser.add_argument('--music')
    args = parser.parse_args()
    try:
        with open(args.timeline, encoding='utf-8') as f:
            plan = json.load(f)
        render(args.video, args.output, plan, args.ffmpeg, args.music)
    except (ValueError, OSError, subprocess.CalledProcessError) as exc:
        print(f'Render failed: {exc}', file=sys.stderr)
        return 1
    print(f'Rendered: {args.output}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
