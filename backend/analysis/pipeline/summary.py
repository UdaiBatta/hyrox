"""Stage 8: end-of-set summary. Takeaways are deterministic templates, no LLM."""
from collections import Counter
from statistics import mean

import numpy as np


def _thirds(xs):
    k = len(xs)
    return [xs[i * k // 3:(i + 1) * k // 3] for i in range(3)]


def _avg(xs):
    xs = [x for x in xs if x is not None]
    return round(mean(xs), 2) if xs else None


def _mmss(sec):
    return f"{int(sec // 60)}:{int(round(sec % 60)):02d}"


def summarize(reps, fps, cfg):
    s, rules = cfg["summary"], cfg["rules"]
    n = len(reps)
    verdicts = Counter(r["verdict"] for r in reps)
    faults = Counter(f for r in reps for f in r["failed"])
    bottoms = [r["bottom"] for r in reps]
    cycles = [round((b - a) / fps, 2) for a, b in zip(bottoms, bottoms[1:])]
    # A break is relative to the athlete's own rhythm: a steady 3.3 s/rep set is slow, not broken.
    rhythm = float(np.median(cycles)) if cycles else None
    is_break = [c > max(s["pause_s"], s["pause_ratio"] * rhythm) for c in cycles]
    work = [None if b else c for c, b in zip(cycles, is_break)]
    rests = [c - rhythm for c, b in zip(cycles, is_break) if b]
    tempo = [_avg(t) for t in _thirds(work)]
    side = lambda r: r["rules"].get("WB-01", {})                    # noqa: E731
    depth = [_avg([side(r).get("value") for r in t if "cmp" not in side(r)]) for t in _thirds(reps)]  # side-on L only
    shallow = [sum("WB-01" in r["failed"] for r in t) for t in _thirds(reps)]
    passed = [(r["n"], side(r)["value"]) for r in reps
              if side(r).get("status") == "pass" and "cmp" not in side(r) and side(r).get("value") is not None]
    thr = rules["WB-01"]["params"]["min_depth_ratio"]

    takeaways = []
    if faults:
        rid, k = faults.most_common(1)[0]
        takeaways.append(f"{k} of {n} reps failed {rid} ({rules[rid]['name']}). {rules[rid]['tip']}")
    if shallow[2] >= 2 and shallow[2] >= s["fade_ratio"] * shallow[0]:
        takeaways.append(f"Depth faded as you tired: {shallow[0]} shallow reps in the first third vs {shallow[2]} in the last. "
                         f"Every no-rep has to be redone (about {rhythm or 2:.1f} s), so a slightly slower, full-depth rep is faster overall.")
    elif None not in (depth[0], depth[2]) and depth[0] - depth[2] >= s["depth_creep_L"]:
        takeaways.append(f"Your squats got shallower across the set (by {100 * (depth[0] - depth[2]):.0f}% of leg length, "
                         f"first third vs last) before any rep failed. That is the first sign of fatigue: hold the depth.")
    if len(passed) >= 3:
        rn, v = min(passed, key=lambda x: x[1])
        margin = v - thr
        if margin < s["close_call_L"]:
            takeaways.append(f"Rep {rn} was your shallowest and only just made depth ({100 * margin:.0f}% of leg length to spare). "
                             f"A judge could call that one. Sit a little deeper on every rep.")
        # No "plenty to spare" message: the margin is against a threshold whose offset varies by athlete (README,
        # "shallow-rep test"), so it isn't safe to tell anyone they can go shallower. Consistency is athlete-relative.
        elif max(x[1] for x in passed) - v >= s["depth_spread_L"]:
            deep = max(passed, key=lambda x: x[1])[0]
            takeaways.append(f"Your depth varied by {100 * (max(x[1] for x in passed) - v):.0f}% of leg length between "
                             f"reps (deepest rep {deep}, shallowest rep {rn}). Aim to hit the same depth every rep.")
    if tempo[0] and tempo[2] and tempo[2] >= s["slowdown_ratio"] * tempo[0]:
        takeaways.append(f"Your pace slowed from {tempo[0]:.1f} to {tempo[2]:.1f} s/rep across the set. "
                         f"Pick a pace you can hold from the first rep.")
    if rests:
        takeaways.append(f"You broke the set {len(rests)} time(s), losing {sum(rests):.0f} s against your own rhythm. "
                         f"Short planned breaks (e.g. every 10 reps) usually beat long unplanned ones.")
    if rhythm:
        reps_n = s["station_reps"]
        per_rep = (sum(cycles)) / len(cycles)              # includes this set's breaks
        extra = f", or {_mmss(reps_n * per_rep)} with breaks at this set's rate" if rests else ""
        takeaways.append(f"At {rhythm:.1f} s/rep the {reps_n}-rep wall-ball station takes {_mmss(reps_n * rhythm)} unbroken{extra}.")
    if n and verdicts["uncertain"] >= n / 2:
        takeaways.insert(0, f"{verdicts['uncertain']} of {n} reps couldn't be judged with confidence. Re-film side-on, full body in frame.")
    if n and verdicts["proper"] == n:
        takeaways.insert(0, f"All {n} reps met the standard.")

    return {"total": n, "proper": verdicts["proper"], "not_proper": verdicts["not_proper"],
            "uncertain": verdicts["uncertain"], "fault_counts": dict(faults),
            "most_common_fault": faults.most_common(1)[0][0] if faults else None,
            "cycle_times": cycles, "tempo_thirds": tempo, "depth_thirds": depth,
            "pauses": len(rests), "rest_s": round(sum(rests), 1), "takeaways": takeaways[:3]}


def warnings(B, reps, view, cfg):
    out = []
    if view != "side":
        out.append("Filmed from the front or behind: hip and knee line up with the camera, so squat depth (WB-01) is "
                   "estimated from how far the hip drops. It can confirm clearly deep reps but can't call a no-rep. "
                   "Film side-on to judge depth properly.")
    weak = float(np.mean(B["quality"] < 0.5))
    if weak > 0.1:
        out.append(f"Tracking was weak on {weak:.0%} of frames (body parts hidden or out of frame).")
    if not reps:
        out.append("No reps detected.")
    for rid, rule in cfg["rules"].items():
        na = [r["rules"][rid]["reason"] for r in reps if r["rules"].get(rid, {}).get("status") == "not_assessable"]
        if na:
            out.append(f"{rid} {rule['name']}: not assessable on {len(na)}/{len(reps)} reps ({na[0]}).")
    return out
