"""Regenerates the frontend mock session (open the app with ?mock=1) from synthetic side-on squats.
7 reps: 4 proper, rep 3 and rep 7 too shallow (not proper), rep 6 with the far wrist hidden (uncertain).
Run from backend/:  python -m analysis.tests.make_mock
"""
import json
import subprocess
from pathlib import Path

from analysis.pipeline import analyze, load_config
from analysis.tests.test_pipeline import FPS, synthetic

OUT = Path(__file__).resolve().parents[3] / "frontend" / "public" / "mock"

data = synthetic([1, 1, 0.5, 1, 1, 1, 0.8])
start6 = int(0.5 * FPS) + 5 * 2 * FPS
PX_PER_M = 470                                     # synthetic leg (400 px) ~ 0.85 m
for f in data["frames"]:
    if start6 <= f["i"] < start6 + 2 * FPS:
        f["kp"][15][2] = 0.3                       # left wrist barely visible during rep 6
    hx, hy = f["kp"][23][0], f["kp"][23][1]
    # World landmarks like MediaPipe's: metres, hip-centred, y down; left side +z, right side -z.
    f["t"] = round(f["i"] / FPS, 4)
    f["world"] = [[round((x - hx) / PX_PER_M, 4), round((y - hy) / PX_PER_M, 4),
                   (0.1 if j % 2 else -0.1) if j >= 11 else 0.0] for j, (x, y, _) in enumerate(f["kp"])]
    f["kp"] = [[round(x, 1), round(y, 1), v] for x, y, v in f["kp"]]

res = analyze(data, load_config())
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "frames.json").write_text(json.dumps(data, separators=(",", ":")))
(OUT / "analysis.json").write_text(json.dumps(res, indent=1))
subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi",
                "-i", f"color=c=0x1a1d22:size={data['width']}x{data['height']}:rate={FPS}:duration={data['n_frames'] / FPS}",
                "-vf", "drawgrid=w=100:h=100:t=1:c=0x2a2f38", "-c:v", "libx264", "-pix_fmt", "yuv420p",
                str(OUT / "clip.mp4")], check=True)
print("verdicts:", [r["verdict"] for r in res["reps"]])
