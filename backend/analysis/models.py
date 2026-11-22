import uuid
from pathlib import Path

from django.conf import settings
from django.db import models


def _upload_path(video, filename):
    return f"videos/{video.id}/original{Path(filename).suffix.lower()}"


class Video(models.Model):
    class Status(models.TextChoices):
        UPLOADED = "uploaded"
        PROCESSING = "processing"
        DONE = "done"
        FAILED = "failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200, blank=True)
    original = models.FileField(upload_to=_upload_path)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.UPLOADED)
    fps = models.FloatField(null=True)
    n_frames = models.IntegerField(null=True)
    view = models.CharField(max_length=10, blank=True)
    error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def dir(self):
        """Pipeline output folder: normalized.mp4, frames.json.gz, analysis.json."""
        return Path(settings.MEDIA_ROOT) / "videos" / str(self.id)
