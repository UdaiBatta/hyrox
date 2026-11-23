"""Wall-ball form-check pipeline.

run()     stages 1-8 for one video; pose keypoints are cached in frames.json.gz.
analyze() stages 3-8: a pure function of cached keypoints + rules.yaml, cheap to re-run.
"""
import gzip
import json
from pathlib import Path

import numpy as np
import yaml

from . import rules, signals, summary

RULES_YAML = Path(__file__).resolve().parents[1] / "rules.yaml"


def load_config(path=RULES_YAML):
    return yaml.safe_load(Path(path).read_text(encoding="utf-8"))


def analyze(data, cfg, flights=None, track=None):
    """Optional flights measure height. The ball track can corroborate floor pickups."""
    fps = data["fps"]
    raw = signals.to_array(data["frames"], data["n_frames"])
    P = signals.clean(raw, fps, cfg["camera_roll_deg"], data["width"], data["height"])
    B = signals.body(P)
    B["observed"] = signals.evidence(raw, data, cfg, cfg["evidence_min_visibility"])
    min_depth_vis = max(cfg["evidence_min_visibility"], cfg["rules"]["WB-01"]["params"]["min_visibility"])
    hips_knees = signals.evidence(raw[:, signals.L_HIP:signals.R_KNEE + 1], data, cfg, min_depth_vis)
    B["depth_pair"] = signals.visible_side(hips_knees, 0, 2)
    # A cached held-ball point can also be the tracker's fallback (mean hand position rounded to 0.1 px).
    B["held_y"] = np.full(len(raw), np.nan)
    roll = np.radians(cfg["camera_roll_deg"])
    for i, point in enumerate(track or []):
        if point is None or point[3] != 1:
            continue
        x, y = point[:2]
        hands = raw[i, 15:23, :2].mean(axis=0)
        if (np.isfinite(hands).all() and not np.allclose(point[:2], hands, rtol=0, atol=0.050001)
                and 0 <= x < data["width"] and 0 <= y < data["height"]):
            B["held_y"][i] = (np.sin(roll) * (x - data["width"] / 2)
                              + np.cos(roll) * (y - data["height"] / 2) + data["height"] / 2)
    view = signals.view(B, cfg["view"]["side_max_ratio"])
    reps, dips = signals.segment(B, fps, cfg["segmentation"])
    reps = rules.judge(B, reps, view, fps, cfg["rules"], {f["release"]: f for f in flights or []})
    skipped = [f"Not counted at {d['frame'] / fps:.1f} s: {d['reason']}." for d in dips]
    return {"view": view, "fps": fps, "n_frames": data["n_frames"], "reps": reps, "ignored_dips": dips,
            "summary": summary.summarize(reps, fps, cfg), "warnings": summary.warnings(B, reps, view, cfg) + skipped}


def run(src, out_dir, log=print):
    """Delete out_dir to force re-tracking; otherwise only stages 3-8 re-run. Delete ball.json.gz to re-track the ball
    (needed if rep detection changes, since the ball tracker starts each flight at a release frame)."""
    from . import ball, ingest, pose   # heavy imports only when tracking is needed
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    norm, frames_path = out_dir / "normalized.mp4", out_dir / "frames.json.gz"
    if not norm.exists():
        log("ingest: normalising video")
        ingest.normalize(src, norm)
    if frames_path.exists():
        data = json.loads(gzip.decompress(frames_path.read_bytes()))
    else:
        data = pose.track(norm, log)
        frames_path.write_bytes(gzip.compress(json.dumps(data, separators=(",", ":")).encode()))
    cfg = load_config()
    result = analyze(data, cfg)
    # The ball tracker needs the throw frames (from rep detection) and WB-05 needs the ball, so: reps, ball, then the
    # rules again with the ball (analyze is cheap). Cached like the pose.
    ball_path = out_dir / "ball.json.gz"
    bt = json.loads(gzip.decompress(ball_path.read_bytes())) if ball_path.exists() else None
    if not isinstance(bt, dict):                       # missing, or the old list-only format
        log("ball: tracking")
        bt = ball.track(norm, data, [r["release"] for r in result["reps"]], log,
                        cfg["rules"]["WB-05"]["params"]["ball_diameter_m"])
        ball_path.write_bytes(gzip.compress(json.dumps(bt, separators=(",", ":")).encode()))
    result = analyze(data, cfg, bt["flights"], bt["track"])
    result["ball"] = bt["track"]
    (out_dir / "analysis.json").write_text(json.dumps(result, indent=1), encoding="utf-8")
    return result
