#!/usr/bin/env python3
"""Bounded Cloud Run adapter for the experimental renderer."""
import json
import os
import subprocess
import tempfile
import urllib.error
import urllib.request
from email import policy
from email.parser import BytesParser
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from render import prepare, render

MAX_REQUEST = 25 * 1024 * 1024
ALLOWED_ORIGINS = {'https://sahiledits.com', 'https://www.sahiledits.com'}


def reserve():
    # Only for an IAM-private Cloud Run test service. Never enable on a public service.
    if os.environ.get('PRIVATE_RENDER_TEST') == '1':
        return True
    url, token = os.environ.get('SUPABASE_URL'), os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    if not url or not token:
        raise RuntimeError('Usage limit is not configured')
    request = urllib.request.Request(url + '/rest/v1/rpc/reserve_sahil_ai_call', data=b'{}',
        headers={'apikey': token, 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'}, method='POST')
    with urllib.request.urlopen(request, timeout=10) as response:
        return json.loads(response.read(128)) is True


def probe(path):
    result = subprocess.run(['ffprobe', '-v', 'error', '-protocol_whitelist', 'file,pipe', '-show_entries', 'format=duration:stream=codec_type,width,height',
                             '-of', 'json', str(path)], capture_output=True, text=True, timeout=15, check=True,
                             env={'PATH': os.defpath, 'HOME': '/tmp'})
    info = json.loads(result.stdout)
    duration = float(info.get('format', {}).get('duration', 0))
    streams = info.get('streams', [])
    video = next((x for x in streams if x.get('codec_type') == 'video'), {})
    if not 0 < duration <= 120.5 or not any(x.get('codec_type') == 'audio' for x in streams):
        raise ValueError('Video must have sound and be no longer than two minutes')
    if not (0 < video.get('width', 0) <= 4096 and 0 < video.get('height', 0) <= 4096):
        raise ValueError('Video dimensions are unsupported')
    return duration


def parse_form(content_type, data):
    message = BytesParser(policy=policy.default).parsebytes(
        b'MIME-Version: 1.0\r\nContent-Type: ' + content_type.encode('ascii') + b'\r\n\r\n' + data)
    if not message.is_multipart():
        raise ValueError('Expected a multipart upload')
    parts = {}
    for part in message.iter_parts():
        name = part.get_param('name', header='content-disposition')
        if name not in ('video', 'timeline') or name in parts:
            raise ValueError('Unexpected upload field')
        parts[name] = part.get_payload(decode=True)
    if set(parts) != {'video', 'timeline'} or len(parts['timeline']) > 200_000:
        raise ValueError('Video and timeline are required')
    return parts


def validate_timeline(plan, duration):
    # Uploaded timelines cannot ask the renderer to read local images or files.
    if not isinstance(plan, dict) or set(plan) - {'clips', 'words', 'graphics', 'zooms', 'warnings'}:
        raise ValueError('Unsupported timeline field')
    clips, _, _, output_duration, _, _ = prepare(plan)
    if output_duration > 120 or any(end > duration + .1 for _, end, _ in clips):
        raise ValueError('Timeline exceeds the video limits')


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def headers_common(self, status, content_type):
        self.send_response(status)
        origin = self.headers.get('Origin')
        if origin in ALLOWED_ORIGINS:
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Vary', 'Origin')
        self.send_header('Content-Type', content_type)
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')

    def fail(self, status, message):
        body = json.dumps({'error': message}).encode()
        self.headers_common(status, 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.headers_common(204, 'text/plain')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        if self.path != '/health':
            return self.fail(404, 'Not found')
        body = b'{"status":"ok"}'
        self.headers_common(200, 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path != '/render':
            return self.fail(404, 'Not found')
        try:
            self.connection.settimeout(30)
            length = int(self.headers.get('Content-Length', '0'))
            if length <= 0 or length > MAX_REQUEST:
                return self.fail(413, 'This render test accepts uploads up to 25 MB')
            if not self.headers.get('Content-Type', '').startswith('multipart/form-data;'):
                return self.fail(400, 'Expected a video upload')
            if not reserve():
                return self.fail(429, 'The shared daily test limit has been reached')
            body = self.rfile.read(length)
            parts = parse_form(self.headers['Content-Type'], body)
            video = parts['video']
            # Reject playlists and containers which can reference arbitrary local files.
            if not (len(video) > 12 and (video[4:8] == b'ftyp' or video[:4] == b'\x1a\x45\xdf\xa3')):
                raise ValueError('Choose an MP4, MOV or WebM video')
            plan = json.loads(parts['timeline'])
            with tempfile.TemporaryDirectory(prefix='sahiledits-job-') as tmp:
                source, output = Path(tmp)/'input.video', Path(tmp)/'output.mp4'
                source.write_bytes(video)
                duration = probe(source)
                validate_timeline(plan, duration)
                render(source, output, plan, 'ffmpeg')
                size = output.stat().st_size
                self.headers_common(200, 'video/mp4')
                self.send_header('Content-Length', str(size))
                self.send_header('Content-Disposition', 'attachment; filename="sahiledits.mp4"')
                self.end_headers()
                with output.open('rb') as f:
                    while True:
                        chunk = f.read(1024 * 1024)
                        if not chunk:
                            break
                        self.wfile.write(chunk)
        except (ValueError, UnicodeError, json.JSONDecodeError) as exc:
            self.fail(400, str(exc))
        except (urllib.error.URLError, TimeoutError):
            self.fail(503, 'Usage limit could not be checked')
        except (subprocess.SubprocessError, OSError, RuntimeError):
            self.fail(500, 'The video could not be rendered')


if __name__ == '__main__':
    HTTPServer(('0.0.0.0', int(os.environ.get('PORT', '8080'))), Handler).serve_forever()
