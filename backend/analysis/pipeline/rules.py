"""Stages 6-7: one function per rule ID, then the rep verdict.

Every threshold comes from rules.yaml; nothing numeric about the movement standard is hardcoded here.
Each rule returns {status: pass|fail|not_assessable, low_confidence, value, threshold, reason}.
"""
import numpy as np


def _res(status, reason, value=None, threshold=None, low=False):
    return {"status": status, "low_confidence": bool(low),
            "value": None if value is None else round(float(value), 3),
            "threshold": threshold, "reason": reason}


def _na(reason):
    return _res("not_assessable", reason)


def _longest_run(mask):
    best = cur = 0
    for m in mask:
        cur = cur + 1 if m else 0
        best = max(best, cur)
    return best


def _stand_tall(B, a, b, fps, p):
    """Longest hold (s) with knees and hips extended in frames [a, b)."""
    ok = (B["knee_angle"][a:b] >= p["min_angle"]) & (B["hip_angle"][a:b] >= p["min_angle"])
    return _longest_run(ok) / fps


def wb01_drop(B, rep, ctx, p):
    """Front or behind: hip and knee line up with the camera, so hip-vs-knee can't be measured. Use how far the hip
    dropped instead: hip height above the ankles at the bottom / standing hip height. Perspective makes squats look
    deeper from behind, so this can only confirm a clearly deep rep; it never calls a no-rep."""
    h = B["ankle"][:, 1] - B["hip"][:, 1]
    stand = np.nanpercentile(h[max(0, rep["start"] - p["stand_window_frames"]):rep["end"] + 1], 95)
    lo, hi = max(0, rep["bottom"] - p["bottom_window_frames"]), rep["bottom"] + p["bottom_window_frames"] + 1
    drop = np.nanmin(h[lo:hi]) / stand
    if not np.isfinite(drop):
        return _na("hip or ankle not tracked at the bottom")
    if drop <= p["max_drop"] - p["borderline"]:
        return {**_res("pass", f"estimated from the front or behind: hip dropped to {drop:.2f} of standing height",
                       drop, p["max_drop"]), "cmp": "≤", "unit": "× standing"}
    return {**_na(f"not clearly deep from this angle (hip at {drop:.2f} of standing height); film side-on to judge"),
            "value": round(float(drop), 3), "threshold": p["max_drop"], "cmp": "≤", "unit": "× standing"}


def wb01_depth(B, rep, ctx, p):
    if ctx["view"] != "side":
        return wb01_drop(B, rep, ctx, p["front"])
    lo, hi = max(0, rep["bottom"] - p["bottom_window_frames"]), rep["bottom"] + p["bottom_window_frames"] + 1
    depth = np.nanmax((B["hip"][lo:hi, 1] - B["knee"][lo:hi, 1]) / ctx["L"])
    if not np.isfinite(depth):
        return _na("hip or knee not tracked at the bottom")
    vis = np.nanmean(np.r_[B["hip"][lo:hi, 2], B["knee"][lo:hi, 2]])
    # One-sided: the threshold already sits below every legal reference rep, so a pass is a pass. Only a rep that
    # misses by less than the borderline is too close to call (the benefit of the doubt instead of a no-rep).
    near_miss = p["min_depth_ratio"] - p["borderline"] < depth < p["min_depth_ratio"]
    low = near_miss or vis < p["min_visibility"]
    where = "below" if depth >= 0 else "above"
    return _res("pass" if depth >= p["min_depth_ratio"] else "fail",
                f"hip {abs(depth):.2f} L {where} knee at the bottom", depth, p["min_depth_ratio"], low)


def wb02_start(B, rep, ctx, p):
    if ctx["n"] != 1:
        return None                      # only the first rep has a "start position"
    held = _stand_tall(B, 0, rep["bottom"], ctx["fps"], p)
    if held >= p["min_hold_s"]:
        return _res("pass", f"stood tall for {held:.2f} s before rep 1", held, p["min_hold_s"])
    if rep["bottom"] / ctx["fps"] < p["min_hold_s"] * 2:
        return _na("clip starts too close to the first squat to see the start position")
    return _res("fail", f"never stood tall (knees and hips >= {p['min_angle']} deg) before rep 1", held, p["min_hold_s"])


def wb03_reset(B, rep, ctx, p):
    """Ball came from the floor (both wrists below the knees) -> must stand tall again before squatting."""
    lo = ctx["prev_release"]
    below = ((B["wrist_l"][lo:rep["bottom"], 1] > B["knee"][lo:rep["bottom"], 1]) &
             (B["wrist_r"][lo:rep["bottom"], 1] > B["knee"][lo:rep["bottom"], 1]))
    if not below.any():
        return None                      # ball was caught: rule doesn't apply
    pickup = lo + int(np.flatnonzero(below)[-1])
    held = _stand_tall(B, pickup, rep["bottom"], ctx["fps"], p)
    ok = held >= p["min_hold_s"]
    return _res("pass" if ok else "fail",
                f"picked ball up, then {'stood tall' if ok else 'squatted without standing tall'} ({held:.2f} s)",
                held, p["min_hold_s"])


def wb04_two_hands(B, rep, ctx, p):
    r = rep["release"]
    wl, wr, nose = B["wrist_l"][r], B["wrist_r"][r], B["nose"][r]
    # Evidence only: both wrists must be observed in the video at release. Cleaning bridges short no-pose gaps
    # (visibility included), and a bridged wrist must never count as a two-handed throw. NaN compares False.
    seen = B.get("seen")
    observed = seen is None or (seen[r, 15] >= p["min_visibility"] and seen[r, 16] >= p["min_visibility"])
    if not observed or min(wl[2], wr[2]) < p["min_visibility"]:
        return _na("a wrist is hidden at release")
    gap = np.hypot(*(wl[:2] - wr[:2])) / ctx["L"]
    both_up = wl[1] < nose[1] and wr[1] < nose[1]
    ok = both_up and gap <= p["max_wrist_gap"]
    reason = "both hands on the ball at release" if ok else (
        "one hand not above the head at release" if not both_up else f"hands {gap:.2f} L apart at release")
    return _res("pass" if ok else "fail", reason, gap, p["max_wrist_gap"])


def wb05_target(B, rep, ctx, p):
    """Height the ball reached, in metres, against the division's target height. Two independent rulers turn pixels
    into metres: the ball's own size (diameter known) and gravity (the flight's curvature is 9.81 m/s^2). The height is
    only trusted when they agree, so a bad track gives "can't judge", never a made-up height."""
    f = (ctx.get("ball") or {}).get(rep["release"])
    if not f or f.get("points", 0) < p["min_points"]:
        return _na("ball not followed for enough of this throw")
    # The ball's size measures; gravity checks it (its fit is noisier: blur near the hands, the bounce off the wall).
    ppm = f["r"] / (p["ball_diameter_m"] / 2)
    agree = (f["g_px"] / 9.81) / ppm
    if not (1 - p["ruler_tolerance"] < agree < 1 + p["ruler_tolerance"]):
        return _na(f"ball track unreliable: size and gravity disagree on the scale ({agree:.2f}x)")
    shaky = abs(agree - 1) > p["ruler_tolerance"] / 2
    floor_y = np.nanmax(B["ankle"][max(0, rep["release"] - 2):rep["release"] + 3, 1]) + p["ankle_height_m"] * ppm

    def top(y):                                                     # ball's top edge above the floor, metres
        return (floor_y - y) / ppm + p["ball_diameter_m"] / 2

    target = p["target_height_m"]
    if f["left_top"] and top(f["r"]) >= target:
        return _res("pass", f"ball left the top of the frame above {top(f['r']):.2f} m (target {target:.2f} m)",
                    top(f["r"]), target)
    if f["peak_y"] is None:
        return _na("no clear peak in the ball's flight")
    h = top(f["peak_y"])
    low = not f["peak_seen"] or abs(h - target) < p["borderline_m"] or shaky
    seen = "" if f["peak_seen"] else " (peak not in view, estimated from the flight curve)"
    ok = h >= target
    return _res("pass" if ok else "fail", f"ball peaked at {h:.2f} m, target {target:.2f} m{seen}", h, target, low)


RULES = {"WB-01": wb01_depth, "WB-02": wb02_start, "WB-03": wb03_reset, "WB-04": wb04_two_hands, "WB-05": wb05_target}


def verdict(results, cfg):
    """Any confident fail is a no-rep. "required" rules are the ones that must be judged to call a rep proper:
    if one of them can't be judged (or is borderline), the rep is uncertain."""
    if any(r["status"] == "fail" and not r["low_confidence"] for r in results.values()):
        return "not_proper"
    req = [(rid, r) for rid, r in results.items() if cfg[rid]["required"]]
    if any(r["status"] == "not_assessable" or r["low_confidence"] for _, r in req):
        return "uncertain"
    return "proper"


def judge(B, reps, view, fps, cfg, ball=None):
    out, prev_release = [], 0
    for n, rep in enumerate(reps, 1):
        L = np.nanmedian(B["leg"][rep["start"]:rep["end"] + 1])     # per-rep: athlete may drift
        ctx = {"n": n, "fps": fps, "L": L, "prev_release": prev_release, "view": view, "ball": ball}
        results = {}
        for rid, fn in RULES.items():
            p = cfg[rid]
            res = fn(B, rep, ctx, p["params"]) if view in p["views"] else _na(f"not assessable from this view ({'front or behind' if view == 'front' else view})")
            if res is not None:
                results[rid] = res
        v = verdict(results, cfg)
        unsure = [rid for rid, r in results.items() if cfg[rid]["required"] and (r["status"] == "not_assessable" or r["low_confidence"])]
        out.append({"n": n, **rep, "t_bottom": round(rep["bottom"] / fps, 3), "rules": results, "verdict": v,
                    # Confident fails only: a borderline miss makes the rep uncertain (required) or is ignored (optional).
                    "failed": [rid for rid, r in results.items() if r["status"] == "fail" and not r["low_confidence"]],
                    "unsure": unsure if v == "uncertain" else []})
        prev_release = rep["release"]
    return out
