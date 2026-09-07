"""Offline integrity and resume tests for the operator-only archive preparer."""
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

source = Path(__file__).resolve().parents[2] / 'ops/local-ci/host/prepare-image-cache.py'
spec = importlib.util.spec_from_file_location('prepare_image_cache', source)
cache = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cache)


class Response(io.BytesIO):
    status = 206
    def __init__(self, data, content_range):
        super().__init__(data)
        self.headers = {'Content-Range': content_range}


class CacheTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.folder = Path(self.temp.name)
        self.data = b'abcdefgh'
        self.desc = {'digest': cache.digest(self.data), 'size': len(self.data)}
        self.partial = self.folder / (self.desc['digest'].split(':')[1] + '.part')
        self.token_patch = patch.object(cache, 'token_for', return_value='public-test-token')
        self.token_patch.start()
        self.addCleanup(self.token_patch.stop)
        self.sleep_patch = patch.object(cache.time, 'sleep')
        self.sleep_patch.start()
        self.addCleanup(self.sleep_patch.stop)

    def test_resume_and_verify_before_reuse(self):
        self.partial.write_bytes(b'abcd')
        with patch.object(cache.urllib.request, 'urlopen', return_value=Response(b'efgh', 'bytes 4-7/8')) as fetch:
            target = cache.download_blob('supabase/postgres', self.desc, self.folder)
            self.assertEqual(fetch.call_args.args[0].get_header('Range'), 'bytes=4-7')
            self.assertEqual(target.read_bytes(), self.data)
            cache.download_blob('supabase/postgres', self.desc, self.folder)
            self.assertEqual(fetch.call_count, 1)

    def test_corrupt_partial_is_never_promoted(self):
        self.partial.write_bytes(b'zzzz')
        with patch.object(cache.urllib.request, 'urlopen', return_value=Response(b'efgh', 'bytes 4-7/8')):
            with self.assertRaisesRegex(ValueError, 'blob digest mismatch'):
                cache.download_blob('supabase/postgres', self.desc, self.folder)
        self.assertEqual(list(self.folder.iterdir()), [])

    def test_wrong_range_never_appends(self):
        self.partial.write_bytes(b'abcd')
        with patch.object(cache.urllib.request, 'urlopen', side_effect=lambda *a, **k: Response(b'abcd', 'bytes 0-3/8')):
            with self.assertRaisesRegex(RuntimeError, 'blob download failed'):
                cache.download_blob('supabase/postgres', self.desc, self.folder)
        self.assertEqual(self.partial.read_bytes(), b'abcd')

    def test_incomplete_response_retries_same_range(self):
        self.partial.write_bytes(b'abcd')
        responses = [Response(b'ef', 'bytes 4-7/8'), Response(b'efgh', 'bytes 4-7/8')]
        with patch.object(cache.urllib.request, 'urlopen', side_effect=responses) as fetch:
            cache.download_blob('supabase/postgres', self.desc, self.folder)
            self.assertEqual([call.args[0].get_header('Range') for call in fetch.call_args_list], ['bytes=4-7', 'bytes=4-7'])

    def test_manifest_bytes_must_match_pinned_digest(self):
        image = {'tag': 'ghcr.io/supabase/postgres:17.6.1.134', 'digest': 'sha256:' + 'a' * 64, 'configDigest': 'sha256:' + 'b' * 64}
        with patch.object(cache.urllib.request, 'urlopen', return_value=io.BytesIO(b'{}')):
            with self.assertRaisesRegex(ValueError, 'manifest digest mismatch'):
                cache.image_manifest(image)

    def test_manifest_cannot_change_config_identity(self):
        raw = json.dumps({'config': {'digest': 'sha256:' + 'c' * 64}}).encode()
        image = {'tag': 'ghcr.io/supabase/postgres:17.6.1.134', 'digest': cache.digest(raw), 'configDigest': 'sha256:' + 'b' * 64}
        with patch.object(cache.urllib.request, 'urlopen', return_value=io.BytesIO(raw)):
            with self.assertRaisesRegex(ValueError, 'config digest mismatch'):
                cache.image_manifest(image)


if __name__ == '__main__':
    unittest.main()
