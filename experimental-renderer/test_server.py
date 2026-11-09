import unittest
import http.client
import json
import threading
from unittest.mock import patch
from http.server import HTTPServer
from pathlib import Path
from server import parse_form, validate_timeline
from server import Handler


class ServerValidationTests(unittest.TestCase):
    def test_parses_multipart_upload(self):
        body = (b'--abc\r\nContent-Disposition: form-data; name="video"; filename="a.mp4"\r\n'
                b'Content-Type: video/mp4\r\n\r\nvideo-bytes\r\n'
                b'--abc\r\nContent-Disposition: form-data; name="timeline"\r\n\r\n{}\r\n--abc--\r\n')
        parts = parse_form('multipart/form-data; boundary=abc', body)
        self.assertEqual(parts['video'], b'video-bytes')
        self.assertEqual(parts['timeline'], b'{}')

    def test_rejects_filesystem_paths_in_untrusted_timeline(self):
        with self.assertRaises(ValueError):
            validate_timeline({'clips': [{'start': 0, 'end': 2}],
                               'visuals': [{'path': '/etc/passwd', 'start': 0, 'end': 1}]}, 2)

    def test_rejects_clips_outside_the_uploaded_video(self):
        with self.assertRaises(ValueError):
            validate_timeline({'clips': [{'start': 0, 'end': 20}]}, 5)

    def test_rejects_non_object_input(self):
        with self.assertRaises(ValueError):
            validate_timeline({'clips': ['not an object']}, 5)
        with self.assertRaises(ValueError):
            validate_timeline({'clips': [{'start': 0, 'end': 5}], 'auto_graphics': 'yes'}, 5)

    def test_http_upload_and_response(self):
        body = (b'--abc\r\nContent-Disposition: form-data; name="video"; filename="a.mp4"\r\n'
                b'Content-Type: video/mp4\r\n\r\n\x00\x00\x00\x18ftypisomtest\r\n'
                b'--abc\r\nContent-Disposition: form-data; name="timeline"\r\n\r\n'
                + json.dumps({'clips': [{'start': 0, 'end': 2}]}).encode() + b'\r\n--abc--\r\n')
        def fake_render(source, output, plan, ffmpeg):
            Path(output).write_bytes(b'mp4-result')
        server = HTTPServer(('127.0.0.1', 0), Handler)
        worker = threading.Thread(target=server.serve_forever, daemon=True)
        worker.start()
        try:
            with patch('server.reserve', return_value=True), patch('server.probe', return_value=5), patch('server.render', side_effect=fake_render):
                client = http.client.HTTPConnection('127.0.0.1', server.server_port, timeout=5)
                client.request('POST', '/render', body, {'Content-Type': 'multipart/form-data; boundary=abc',
                                                          'Origin': 'https://sahiledits.com'})
                response = client.getresponse()
                self.assertEqual(response.status, 200)
                self.assertEqual(response.getheader('Access-Control-Allow-Origin'), 'https://sahiledits.com')
                self.assertEqual(response.read(), b'mp4-result')
                client.close()
        finally:
            server.shutdown()
            worker.join()
            server.server_close()


if __name__ == '__main__':
    unittest.main()
