"""Stage 1: validate an upload and normalise it.

Output video: rotation baked into the pixels (ffmpeg autorotates by default), constant fps
(phones record variable frame rate), long edge <= 1920, H.264, no audio. Every later stage
reads only this file, so the pose never comes out sideways and the overlay never drifts.
"""
import json
import subprocess


def probe(path):
    """ffprobe the first video stream. Raises ValueError if it isn't a readable video (trust boundary)."""
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height,avg_frame_rate,r_frame_rate,nb_frames",
         "-of", "json", str(path)],
        capture_output=True, text=True)
    if out.returncode:
        raise ValueError(f"not a readable video: {out.stderr.strip()[:200]}")
    streams = json.loads(out.stdout).get("streams")
    if not streams:
        raise ValueError("file has no video stream")
    return streams[0]


def _rate(r):
    num, den = (int(x) for x in (r or "0/0").split("/"))
    return num / den if den else 0.0


def normalize(src, dst, max_fps=60, max_edge=1920):
    s = probe(src)
    fps = min(round(_rate(s.get("avg_frame_rate")) or _rate(s.get("r_frame_rate"))), max_fps) or 30
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-i", str(src), "-map", "0:v:0", "-an",
         "-vf", f"scale='min(iw,{max_edge})':'min(ih,{max_edge})':force_original_aspect_ratio=decrease:force_divisible_by=2",
         "-fps_mode", "cfr", "-r", str(fps),
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
         "-movflags", "+faststart", str(dst)],
        check=True)
    out = probe(dst)
    return {"fps": fps, "width": out["width"], "height": out["height"], "n_frames": int(out.get("nb_frames", 0))}
