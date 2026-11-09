"""Optional real-video HTTP integration test, with mocked quota and media probe."""
import http.client
import json
import os
import threading
import unittest
from http.server import HTTPServer
from pathlib import Path
from unittest.mock import patch
import render as renderer
import server as service


class RealRenderHTTPTest(unittest.TestCase):
    @unittest.skipUnless(os.environ.get('SAHILEDITS_TEST_VIDEO') and os.environ.get('SAHILEDITS_FFMPEG'),
                         'Set SAHILEDITS_TEST_VIDEO and SAHILEDITS_FFMPEG to run the real-video test')
    def test_renders_uploaded_video(self):
        video = Path(os.environ['SAHILEDITS_TEST_VIDEO']).read_bytes()
        timeline = json.dumps({'clips': [{'start': 0, 'end': 2}, {'start': 3, 'end': 5}],
                               'graphics': [{'start': 0, 'end': 2, 'text': 'TEST'}]}).encode()
        body = (b'--abc\r\nContent-Disposition: form-data; name="video"; filename="a.mp4"\r\n'
                b'Content-Type: video/mp4\r\n\r\n' + video + b'\r\n'
                b'--abc\r\nContent-Disposition: form-data; name="timeline"\r\n\r\n' + timeline + b'\r\n--abc--\r\n')
        def real_render(src, dst, plan, _):
            renderer.render(src, dst, plan, os.environ['SAHILEDITS_FFMPEG'])
        server = HTTPServer(('127.0.0.1', 0), service.Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with patch('server.reserve', return_value=True), patch('server.probe', return_value=65.55), patch('server.render', side_effect=real_render):
                conn = http.client.HTTPConnection('127.0.0.1', server.server_port, timeout=90)
                conn.request('POST', '/render', body, {'Content-Type': 'multipart/form-data; boundary=abc'})
                response = conn.getresponse()
                result = response.read()
                self.assertEqual(response.status, 200, result[:1000])
                self.assertEqual(result[4:8], b'ftyp')
                self.assertGreater(len(result), 100000)
                conn.close()
        finally:
            server.shutdown()
            thread.join()
            server.server_close()


if __name__ == '__main__':
    unittest.main()
