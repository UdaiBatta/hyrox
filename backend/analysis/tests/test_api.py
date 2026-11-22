"""API flow on a generated 1 s test video (no person in it): upload -> process -> results.
Run from backend/:  python manage.py test
"""
import gzip
import json
import shutil
import subprocess
import tempfile
from pathlib import Path
from unittest import mock

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from analysis import jobs

TMP = Path(tempfile.mkdtemp())


@override_settings(MEDIA_ROOT=TMP / "media")
class ApiTest(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TMP, ignore_errors=True)

    def test_upload_process_and_fetch_results(self):
        clip = TMP / "clip.mp4"
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "testsrc=size=640x360:rate=30",
                        "-t", "1", "-pix_fmt", "yuv420p", str(clip)], check=True)
        api = APIClient()

        bad = api.post("/api/videos/", {"file": SimpleUploadedFile("fake.mp4", b"not a video")}, format="multipart")
        self.assertEqual(bad.status_code, 400)

        with mock.patch.object(jobs, "submit", side_effect=jobs.process):   # run synchronously in the test
            up = api.post("/api/videos/", {"file": SimpleUploadedFile("clip.mp4", clip.read_bytes())},
                          format="multipart")
        self.assertEqual(up.status_code, 201, up.content)
        vid = up.json()["id"]

        v = api.get(f"/api/videos/{vid}/").json()
        self.assertEqual((v["status"], v["title"], v["n_frames"]), ("done", "clip", 30), v)
        self.assertEqual(v["summary"], {"total": 0, "proper": 0, "not_proper": 0, "uncertain": 0})

        a = json.loads(b"".join(api.get(f"/api/videos/{vid}/analysis/").streaming_content))
        self.assertEqual(a["reps"], [])
        self.assertIn("No reps detected.", a["warnings"])

        f = api.get(f"/api/videos/{vid}/frames/")
        self.assertEqual(f["Content-Encoding"], "gzip")
        self.assertEqual(json.loads(gzip.decompress(b"".join(f.streaming_content)))["n_frames"], 30)

        self.assertEqual(api.get(f"/api/videos/{vid}/video/")["Content-Type"], "video/mp4")
        self.assertEqual(len(api.get("/api/videos/").json()), 1)
