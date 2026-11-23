"""Stages 3-5: clean keypoints, classify the camera view, segment reps.

Coordinates are image pixels, y grows downward. "L" = leg length (hip->knee + knee->ankle).
"""
import numpy as np
from scipy.signal import find_peaks, savgol_filter

# MediaPipe Pose landmark indices
NOSE, L_SH, R_SH, L_WR, R_WR = 0, 11, 12, 15, 16
L_HIP, R_HIP, L_KNEE, R_KNEE, L_ANK, R_ANK = 23, 24, 25, 26, 27, 28
MAX_GAP_FRAMES = 5        # interpolate dropouts up to this long; longer gaps stay missing
SINGLE_SIDE_VIS = 0.3     # below this, a side is ignored and the other side used alone


def to_array(frames, n_frames):
    """frames list -> (N, 33, 3) array of x, y, visibility; NaN where no pose was found."""
    P = np.full((n_frames, 33, 3), np.nan)
    for f in frames:
        if f["kp"] is not None:
            P[f["i"]] = f["kp"]
    return P


def _runs(ok):
    """(start, end) pairs of consecutive True runs."""
    edges = np.flatnonzero(np.diff(np.r_[0, ok.astype(int), 0]))
    return zip(edges[::2], edges[1::2])


def _fill_gaps(x):
    ok = np.isfinite(x)
    if ok.sum() < 2:
        return x
    idx = np.arange(len(x))
    filled = np.interp(idx, idx[ok], x[ok])
    out = x.copy()
    for a, b in _runs(~ok):
        if 0 < a and b < len(x) and b - a <= MAX_GAP_FRAMES:   # interior short gaps only
            out[a:b] = filled[a:b]
    return out


def _smooth(x, window):
    out = x.copy()
    for a, b in _runs(np.isfinite(x)):
        if b - a >= window:
            out[a:b] = savgol_filter(x[a:b], window, 2)
    return out


def clean(P, fps, roll_deg, width, height, *, bridge=True):
    P = P.copy()
    if roll_deg:   # calibration: rotate points about the frame centre (positive = clockwise on screen)
        c, s = np.cos(np.radians(roll_deg)), np.sin(np.radians(roll_deg))
        x, y = P[..., 0] - width / 2, P[..., 1] - height / 2
        P[..., 0], P[..., 1] = c * x - s * y + width / 2, s * x + c * y + height / 2
    window = max(5, int(round(0.15 * fps)) | 1)   # ~0.15 s, odd
    for j in range(P.shape[1]):
        for k in range(3):
            if bridge:
                P[:, j, k] = _fill_gaps(P[:, j, k])
            if k < 2:
                P[:, j, k] = _smooth(P[:, j, k], window)
    return P


def evidence(raw, data, cfg, min_visibility):
    """Smooth continuous runs of visible samples. A guessed point cannot influence its neighbours."""
    x, y, vis = raw.transpose(2, 0, 1)
    usable = ((x >= 0) & (x < data["width"]) & (y >= 0) & (y < data["height"])
              & np.isfinite(vis) & (vis >= min_visibility))
    return clean(np.where(usable[..., None], raw, np.nan), data["fps"], cfg["camera_roll_deg"],
                 data["width"], data["height"], bridge=False)


def visible_side(P, *left_indices):
    """Use one complete anatomical chain per frame, selecting its weakest joint's higher visibility."""
    left = P[:, left_indices]
    right = P[:, [j + 1 for j in left_indices]]
    score_l = np.nan_to_num(left[:, :, 2], nan=-1).min(axis=1)
    score_r = np.nan_to_num(right[:, :, 2], nan=-1).min(axis=1)
    chain = np.where((score_r > score_l)[:, None, None], right, left)
    chain[np.maximum(score_l, score_r) < 0] = np.nan
    return chain.transpose(1, 0, 2)


def _mid(P, left, right):
    """Average left and right: side-on, MediaPipe flickers between near and far leg, and the
    average is immune to that swap. Falls back to one side when the other is barely visible."""
    a, b = P[:, left], P[:, right]
    m = (a + b) / 2
    only_a, only_b = b[:, 2] < SINGLE_SIDE_VIS, a[:, 2] < SINGLE_SIDE_VIS
    m[only_a & ~only_b] = a[only_a & ~only_b]
    m[only_b & ~only_a] = b[only_b & ~only_a]
    return m


def _dist(a, b):
    return np.linalg.norm(a[:, :2] - b[:, :2], axis=1)


def angle(a, b, c):
    """Angle at b (degrees) between b->a and b->c, per frame."""
    v1, v2 = a[:, :2] - b[:, :2], c[:, :2] - b[:, :2]
    cos = (v1 * v2).sum(1) / (np.linalg.norm(v1, axis=1) * np.linalg.norm(v2, axis=1))
    return np.degrees(np.arccos(np.clip(cos, -1, 1)))


def body(P):
    """Named per-frame series used by the rules."""
    B = {"P": P, "nose": P[:, NOSE], "wrist_l": P[:, L_WR], "wrist_r": P[:, R_WR],
         "shoulder": _mid(P, L_SH, R_SH), "hip": _mid(P, L_HIP, R_HIP),
         "knee": _mid(P, L_KNEE, R_KNEE), "ankle": _mid(P, L_ANK, R_ANK)}
    B["leg"] = _dist(B["hip"], B["knee"]) + _dist(B["knee"], B["ankle"])
    B["knee_angle"] = angle(B["hip"], B["knee"], B["ankle"])
    B["hip_angle"] = angle(B["shoulder"], B["hip"], B["knee"])
    key = [L_HIP, R_HIP, L_KNEE, R_KNEE, L_ANK, R_ANK, L_WR, R_WR]
    B["quality"] = np.nan_to_num(P[:, key, 2]).mean(1)
    return B


def view(B, side_max_ratio):
    """'side' or 'front' from shoulder width / torso length (front-on adult ~0.8, side-on ~0.1-0.3)."""
    P = B["P"]
    r = _dist(P[:, L_SH], P[:, R_SH]) / _dist(B["shoulder"], B["hip"])
    r = r[np.isfinite(r) & (B["quality"] > 0.5)]
    if not len(r):
        return "unknown"
    return "side" if np.median(r) < side_max_ratio else "front"


def segment(B, fps, cfg):
    """Reps = hip-height peaks (squat bottoms) followed by a throw (wrists above the nose).
    Bottoms with no throw (ball pick-up, resting dip) are returned separately as ignored dips."""
    n = len(B["hip"])
    L = np.nanmedian(B["leg"])
    s = B["hip"][:, 1] / L
    s = np.where(np.isfinite(s), s, np.nanmedian(s))           # find_peaks can't take NaN
    wrist_y = np.nanmean([B["wrist_l"][:, 1], B["wrist_r"][:, 1]], axis=0)
    wrist_y = np.where(np.isfinite(wrist_y), wrist_y, np.inf)
    bottoms, _ = find_peaks(s, prominence=cfg["min_prominence"], distance=max(1, int(cfg["min_rep_s"] * fps)))
    reps, dips = [], []
    for k, b in enumerate(bottoms):
        prev = bottoms[k - 1] if k else 0
        nxt = bottoms[k + 1] if k + 1 < len(bottoms) else n
        release = b + int(np.argmin(wrist_y[b:nxt]))
        if not wrist_y[release] < B["nose"][release, 1]:
            dips.append({"frame": int(b), "reason": "squat without a throw (ball pick-up or rest)"})
            continue
        reps.append({"start": int(prev + np.argmin(s[prev:b + 1])), "bottom": int(b),
                     "release": int(release), "end": int(b + np.argmin(s[b:nxt]))})
    # A clip that opens mid-rep shows a throw whose squat happened before the first frame: say so, don't count it.
    first = reps[0]["start"] if reps else n
    early = np.flatnonzero(wrist_y[:first] < B["nose"][:first, 1])
    if early.size:
        dips.append({"frame": int(early[0]), "reason": "throw at the start of the clip; its squat happened before the clip began"})
    return reps, dips
