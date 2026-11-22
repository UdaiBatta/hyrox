"""REST API for uploads and pipeline results (contracts: PRD section 7.1)."""
import json
import shutil
from pathlib import Path

from django.conf import settings
from django.http import FileResponse
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from . import jobs
from .models import Video
from .pipeline.ingest import probe

ALLOWED_EXT = {".mp4", ".mov", ".m4v"}


class VideoSerializer(serializers.ModelSerializer):
    file = serializers.FileField(source="original", write_only=True)
    summary = serializers.SerializerMethodField()

    class Meta:
        model = Video
        fields = ["id", "title", "file", "status", "fps", "n_frames", "view", "error", "created_at", "summary"]
        read_only_fields = ["status", "fps", "n_frames", "view", "error", "created_at"]

    def get_summary(self, v):
        """Verdict counts for the sessions list; null until the analysis exists."""
        path = v.dir / "analysis.json"
        if v.status != Video.Status.DONE or not path.exists():
            return None
        s = json.loads(path.read_text(encoding="utf-8"))["summary"]
        return {k: s[k] for k in ("total", "proper", "not_proper", "uncertain")}

    def validate_file(self, f):
        if Path(f.name).suffix.lower() not in ALLOWED_EXT:
            raise ValidationError(f"only {', '.join(sorted(ALLOWED_EXT))} files are accepted")
        if f.size > settings.MAX_UPLOAD_MB * 1024 * 1024:
            raise ValidationError(f"file is larger than {settings.MAX_UPLOAD_MB} MB")
        return f


class VideoViewSet(mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin,
                   viewsets.GenericViewSet):
    queryset = Video.objects.all()
    serializer_class = VideoSerializer

    def perform_create(self, serializer):
        v = serializer.save(title=serializer.validated_data.get("title") or
                            Path(serializer.validated_data["original"].name).stem)
        try:
            probe(v.original.path)          # trust boundary: must really be a video, not just named like one
        except ValueError as e:
            shutil.rmtree(v.dir, ignore_errors=True)
            v.delete()
            raise ValidationError({"file": [str(e)]})
        jobs.submit(v.id)

    def _result(self, name, content_type, **headers):
        v = self.get_object()
        if v.status != Video.Status.DONE:
            return Response({"detail": f"video is {v.status}", "error": v.error}, status=status.HTTP_409_CONFLICT)
        resp = FileResponse(open(v.dir / name, "rb"), content_type=content_type)
        for k, val in headers.items():
            resp[k.replace("_", "-")] = val
        return resp

    @action(detail=True)
    def video(self, request, pk=None):
        return self._result("normalized.mp4", "video/mp4")

    @action(detail=True)
    def frames(self, request, pk=None):
        # stored gzipped; the browser inflates it transparently
        return self._result("frames.json.gz", "application/json", Content_Encoding="gzip")

    @action(detail=True)
    def analysis(self, request, pk=None):
        return self._result("analysis.json", "application/json")
