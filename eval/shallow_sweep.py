"""Does WB-01 catch shallow squats on real footage? Our web clips have none, so make them: take each real side-on
rep and raise the hips and everything above them so the rep reaches only `k` of its real depth (knees and feet stay
where they were). Then run the unchanged pipeline and see when reps stop being found and when they become no-reps.

This is a controlled test on real tracking noise, not a substitute for filmed shallow reps.
Run from backend/:  .venv\\Scripts\\python ..\\eval\\shallow_sweep.py
"""
import copy
import gzip
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path.cwd()))
from analysis.pipeline import analyze, load_config  # noqa: E402

CLIPS = json.loads((Path(__file__).parent / "clips.json").read_text())
UPPER = range(0, 25)                     # MediaPipe 0-24: head, arms, torso, hips
KS = [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4]


def hip_y(kp):
    return (kp[23][1] + kp[24][1]) / 2


def shallow(data, reps, k):
    """Each rep reaches k of its real hip drop (measured from the standing frame at the rep's start)."""
    d = copy.deepcopy(data)
    by_i = {f["i"]: f for f in d["frames"] if f["kp"]}
    for r in reps:
        if r["start"] not in by_i:
            continue
        stand = hip_y(by_i[r["start"]]["kp"])
        for i in range(r["start"], r["end"] + 1):
            f = by_i.get(i)
            if f:
                lift = (1 - k) * max(hip_y(f["kp"]) - stand, 0)
                for j in UPPER:
                    f["kp"][j][1] -= lift
    return d


def thigh_deg(B, frame):
    """Thigh angle below horizontal at a frame, from MediaPipe joint centres (negative = hip above knee)."""
    h, kn = B["hip"][frame], B["knee"][frame]
    return float(np.degrees(np.arcsin(np.clip((h[1] - kn[1]) / np.hypot(*(h[:2] - kn[:2])), -1, 1))))


def main():
    cfg = load_config()
    thr = cfg["rules"]["WB-01"]["params"]["min_depth_ratio"]
    print(f"WB-01 threshold: hip-vs-knee >= {thr} L\n")
    print(f"{'clip':<5} {'k':>4}  found  no-rep(WB-01)  can't judge  pass   median depth (L)")
    for name, vid in CLIPS.items():
        folder = Path("media/videos") / vid
        data = json.loads(gzip.decompress((folder / "frames.json.gz").read_bytes()))
        base = analyze(data, cfg)
        if base["view"] != "side":
            continue
        reps = base["reps"]
        for k in KS:
            res = analyze(shallow(data, reps, k), cfg)
            got = {r["bottom"]: r for r in res["reps"]}
            found = [min(got.values(), key=lambda g: abs(g["bottom"] - r["bottom"])) for r in reps if got
                     and min(abs(b - r["bottom"]) for b in got) <= 0.4 * data["fps"]]
            w = [f["rules"]["WB-01"] for f in found]
            fail = sum(x["status"] == "fail" and not x["low_confidence"] for x in w)
            unsure = sum(x["low_confidence"] or x["status"] == "not_assessable" for x in w)
            depth = np.median([x["value"] for x in w if x["value"] is not None]) if w else float("nan")
            print(f"{name:<5} {k:>4.1f}  {len(found):>2}/{len(reps):<2}  {fail:>8}       {unsure:>6}     "
                  f"{len(found) - fail - unsure:>3}   {depth:+.2f}")
        from analysis.pipeline import signals
        P = signals.clean(signals.to_array(data["frames"], data["n_frames"]), data["fps"], cfg["camera_roll_deg"],
                          data["width"], data["height"])
        angles = [thigh_deg(signals.body(P), r["bottom"]) for r in reps]
        print(f"      real reps: thigh {min(angles):+.0f} to {max(angles):+.0f} deg vs horizontal by joint centres "
              f"(+ = hip below knee)\n")


if __name__ == "__main__":
    main()
