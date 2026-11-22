"""Background processing: one worker thread inside the Django process.

ponytail: in-process ThreadPoolExecutor, one job at a time, jobs lost on restart (a video left
in "processing" must be re-uploaded). Move to Celery + Redis if this ever serves more than one user.
"""
from concurrent.futures import ThreadPoolExecutor

from django.db import connection

from .models import Video
from .pipeline import run

_executor = ThreadPoolExecutor(max_workers=1)


def process(video_id):
    """Run the whole pipeline for one video and record the outcome on the row."""
    v = Video.objects.get(pk=video_id)
    v.status = Video.Status.PROCESSING
    v.save(update_fields=["status"])
    try:
        res = run(v.original.path, v.dir, log=lambda msg: None)
        v.fps, v.n_frames, v.view, v.status = res["fps"], res["n_frames"], res["view"], Video.Status.DONE
    except Exception as e:   # any pipeline failure is shown to the user, never swallowed
        v.status, v.error = Video.Status.FAILED, f"{type(e).__name__}: {e}"[:2000]
    v.save()


def _in_thread(video_id):
    try:
        process(video_id)
    finally:
        connection.close()   # worker threads must close their own DB connection


def submit(video_id):
    return _executor.submit(_in_thread, video_id)
