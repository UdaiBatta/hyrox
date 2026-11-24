"""Stage 7: one function per rule ID, then the rep verdict.

Every threshold comes from rules.yaml; nothing numeric about the movement standard is hardcoded here.
Each rule returns {status: pass|fail|not_assessable, low_confidence, value, threshold, reason}.
"""
import numpy as np

from . import s3_signals as signals


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
    angle = B["extension"][a:b]
    ok = angle >= p["min_angle"]
    held = _longest_run(ok) / fps
    if held < p["min_hold_s"] <= _longest_run(ok | ~np.isfinite(angle)) / fps:
        return None
    return held


def wb01_drop(B, rep, ctx, p):
    """Front or behind: hip and knee line up with the camera, so hip-vs-knee can't be measured. Use how far the hip
    dropped instead: hip height above the ankles at the bottom / standing hip height. Perspective makes squats look
    deeper from behind, so this can only confirm a clearly deep rep; it never calls a no-rep."""
    lo, hi = max(0, rep["bottom"] - p["bottom_window_frames"]), rep["bottom"] + p["bottom_window_frames"] + 1
    ratios = []
    for hip, ankle in [(signals.L_HIP, signals.L_ANK), (signals.R_HIP, signals.R_ANK)]:
        h = B["observed"][:, ankle, 1] - B["observed"][:, hip, 1]
        standing = h[max(0, rep["start"] - p["stand_window_frames"]):rep["end"] + 1]
        standing = standing[standing > 0]
        bottom = h[lo:hi]
        bottom = bottom[bottom > 0]
        if h[rep["bottom"]] > 0 and standing.size and bottom.size:
            ratios.append(bottom.min() / np.percentile(standing, 95))
    if not ratios:
        return _na("hip or ankle not tracked at the bottom")
    drop = min(ratios)
    if drop <= p["max_drop"] - p["borderline"]:
        return {**_res("pass", f"estimated from the front or behind: hip dropped to {drop:.2f} of standing height",
                       drop, p["max_drop"]), "cmp": "≤", "unit": "× standing"}
    return {**_na(f"not clearly deep from this angle (hip at {drop:.2f} of standing height); film side-on to judge"),
            "value": round(float(drop), 3), "threshold": p["max_drop"], "cmp": "≤", "unit": "× standing"}


def wb01_depth(B, rep, ctx, p):
    if ctx["view"] != "side":
        return wb01_drop(B, rep, ctx, p["front"])
    lo, hi = max(0, rep["bottom"] - p["bottom_window_frames"]), rep["bottom"] + p["bottom_window_frames"] + 1
    hip, knee = B["depth_pair"][:, lo:hi]
    seen = np.isfinite(hip[:, 1])
    if not seen[rep["bottom"] - lo] or not np.isfinite(ctx["L"]):
        return _na("no reliable hip and knee at the bottom or no observed leg length")
    depth = np.max(hip[seen, 1] - knee[seen, 1]) / ctx["L"]
    if depth < p["min_depth_ratio"] and not seen.all():
        return _na("part of the squat bottom is hidden and could contain the deepest point")
    # A near miss gets the benefit of the doubt.
    low = p["min_depth_ratio"] - p["borderline"] < depth < p["min_depth_ratio"]
    where = "below" if depth >= 0 else "above"
    return _res("pass" if depth >= p["min_depth_ratio"] else "fail",
                f"hip {abs(depth):.2f} L {where} knee at the bottom", depth, p["min_depth_ratio"], low)


def wb02_start(B, rep, ctx, p):
    if ctx["n"] != 1:
        return None                      # only the first rep has a "start position"
    held = _stand_tall(B, 0, rep["bottom"], ctx["fps"], p)
    if held is None:
        return _na("the start position is hidden long enough to conceal a standing hold")
    if held >= p["min_hold_s"]:
        return _res("pass", f"stood tall for {held:.2f} s before rep 1", held, p["min_hold_s"])
    if (rep["bottom"] / ctx["fps"] < p["min_hold_s"] * 2 or not np.isfinite(B["extension"][0])
            or B["extension"][0] >= p["min_angle"]):
        return _na("clip starts too close to the first squat to see the start position")
    return _res("fail", f"never stood tall (knees and hips >= {p['min_angle']} deg) before rep 1", held, p["min_hold_s"])


def wb03_reset(B, rep, ctx, p):
    """A low pair of wrists, or a low wrist and detected held ball, establishes the pickup."""
    lo = ctx["prev_release"]
    below = ((B["wrist_l"][lo:rep["bottom"], 1] > B["knee"][lo:rep["bottom"], 1]) &
             (B["wrist_r"][lo:rep["bottom"], 1] > B["knee"][lo:rep["bottom"], 1]))
    obs = B["observed"][lo:rep["bottom"]]
    knee, = signals.visible_side(obs, signals.L_KNEE)
    hands = obs[:, [signals.L_WR, signals.R_WR], 1]
    low_hands = hands > knee[:, 1, None]
    ball_low = B["held_y"][lo:rep["bottom"]] > knee[:, 1]
    confirmed = low_hands.all(axis=1) | (low_hands.any(axis=1) & ball_low)
    if not confirmed.any():
        one_low_other_hidden = low_hands.any(axis=1) & ~np.isfinite(hands).all(axis=1)
        if below.any() or one_low_other_hidden.any() or not np.isfinite(hands).any():
            return _na("the hands or ball are hidden during a possible floor pickup")
        return None
    pickup = lo + int(np.flatnonzero(confirmed)[-1])
    held = _stand_tall(B, pickup, rep["bottom"], ctx["fps"], p)
    if held is None:
        return _na("the standing position after the pickup is hidden")
    ok = held >= p["min_hold_s"]
    return _res("pass" if ok else "fail",
                f"picked ball up, then {'stood tall' if ok else 'squatted without standing tall'} ({held:.2f} s)",
                held, p["min_hold_s"])


def wb04_two_hands(B, rep, ctx, p):
    r = rep["release"]
    wl, wr, nose = B["observed"][r, [signals.L_WR, signals.R_WR, signals.NOSE]]
    if not np.all(np.array([wl[2], wr[2], nose[2]]) >= p["min_visibility"]) or not np.isfinite(ctx["L"]):
        return _na("release needs both wrists, the nose and a reliable leg length")
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
    ankle, = signals.visible_side(B["observed"][max(0, rep["release"] - 2):rep["release"] + 3], signals.L_ANK)
    if not np.isfinite(ankle[:, 1]).any():
        return _na("no visible ankle near release to locate the floor")
    floor_y = np.nanmax(ankle[:, 1]) + p["ankle_height_m"] * ppm

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
    hip, knee, ankle = signals.visible_side(B["observed"], signals.L_HIP, signals.L_KNEE, signals.L_ANK)
    leg = signals._dist(hip, knee) + signals._dist(knee, ankle)
    shoulder, hip, knee, ankle = signals.visible_side(B["observed"], signals.L_SH, signals.L_HIP,
                                                      signals.L_KNEE, signals.L_ANK)
    B["extension"] = np.minimum(signals.angle(shoulder, hip, knee), signals.angle(hip, knee, ankle))
    for n, rep in enumerate(reps, 1):
        lengths = leg[rep["start"]:rep["end"] + 1]
        lengths = lengths[lengths > 0]
        L = np.median(lengths) if lengths.size else np.nan
        rv = rep.get("view", view)
        ctx = {"n": n, "fps": fps, "L": L, "prev_release": prev_release, "view": rv, "ball": ball}
        results = {}
        for rid, fn in RULES.items():
            p = cfg[rid]
            res = fn(B, rep, ctx, p["params"]) if rv in p["views"] else _na(f"not assessable from this view ({'front or behind' if rv == 'front' else rv})")
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
