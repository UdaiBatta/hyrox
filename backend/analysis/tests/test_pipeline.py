"""Self-check on synthetic side-on keypoints: 5 wall-ball reps, rep 3 shallow.
Run from backend/:  python -m unittest
"""
import unittest

import numpy as np

from analysis.pipeline import analyze, load_config

FPS = 30


def _pose(u, throwing):
    """33 landmarks (x, y, vis) for a side-on squat at depth u (0 standing .. 1 full depth)."""
    a, b, lean = np.radians(30 * u), np.radians(105 * u), np.radians(40 * u)
    ankle = np.array([500.0, 1000.0])
    knee = ankle + 200 * np.array([np.sin(a), -np.cos(a)])
    hip = knee + 200 * np.array([-np.sin(b), -np.cos(b)])
    shoulder = hip + 300 * np.array([np.sin(lean), -np.cos(lean)])
    nose = shoulder + [20, -60]
    wrist = nose + [30, -150] if throwing else shoulder + [60, 60]
    kp = {0: nose, 11: shoulder - [5, 0], 12: shoulder + [5, 0], 15: wrist, 16: wrist,
          23: hip, 24: hip, 25: knee, 26: knee, 27: ankle, 28: ankle}
    return [[*kp.get(j, hip), 0.99] for j in range(33)]


def synthetic(depths):
    frames = [_pose(0, False)] * int(0.5 * FPS)                      # stand tall before rep 1
    for umax in depths:
        for i in range(2 * FPS):                                      # 2 s per rep, bottom at 1 s
            tau = i / FPS
            frames.append(_pose(umax * np.sin(np.pi * tau / 2) ** 2, 1.5 < tau < 1.9))
    frames += [_pose(0, False)] * int(0.5 * FPS)
    return {"fps": FPS, "width": 1000, "height": 1200, "n_frames": len(frames),
            "frames": [{"i": i, "kp": kp} for i, kp in enumerate(frames)]}


class PipelineTest(unittest.TestCase):
    def test_hidden_hips_cannot_pass_depth_and_one_visible_side_still_works(self):
        cfg = load_config()
        for hidden, expected in [([24], "pass"), ([23, 24], "not_assessable")]:
            data = synthetic([1, 1])
            for f in data["frames"][39:52]:
                for joint in hidden:
                    f["kp"][joint][2] = 0.01
            rep = analyze(data, cfg)["reps"][0]
            self.assertEqual(rep["rules"]["WB-01"]["status"], expected)

    def test_missing_start_is_uncertain(self):
        data = synthetic([1])
        for f in data["frames"][:45]:
            for j in (11, 12):
                f["kp"][j][2] = 0.01
        rep = analyze(data, load_config())["reps"][0]
        self.assertEqual(rep["rules"]["WB-02"]["status"], "not_assessable")

    def test_visible_ascent_cannot_replace_a_hidden_bottom(self):
        data = synthetic([1, 1])
        cfg = load_config()
        bottom = analyze(data, cfg)["reps"][0]["bottom"]
        for j in (25, 26):
            data["frames"][bottom]["kp"][j][2] = 0.1
        self.assertEqual(analyze(data, cfg)["reps"][0]["rules"]["WB-01"]["status"], "not_assessable")

    def test_estimated_ball_cannot_confirm_a_pickup_with_a_hidden_wrist(self):
        data = synthetic([1])
        track = [None] * data["n_frames"]
        for frame in data["frames"][32:39]:
            kp = frame["kp"]
            for j in range(15, 23):
                kp[j] = [kp[25][0], kp[25][1] + 50, 0.9 if j % 2 else 0.01]
            track[frame["i"]] = [round(kp[15][0], 1), round(kp[15][1], 1), 40, 1]
        cfg = load_config()
        def reset():
            return analyze(data, cfg, track=track)["reps"][0]["rules"]["WB-03"]["status"]
        self.assertEqual(reset(), "not_assessable")
        for point in track[32:39]:
            point[0] += 5  # circle measured next to the observed wrist
        self.assertEqual(reset(), "fail")

    def test_cropped_ankles_cannot_confirm_rear_depth(self):
        data = synthetic([1, 1])
        for f in data["frames"]:
            f["kp"][11][0] = 350
            f["kp"][12][0] = 650
            if 39 <= f["i"] <= 51:
                for ankle in (27, 28):
                    f["kp"][ankle][1] = data["height"]
        res = analyze(data, load_config())
        self.assertEqual(res["view"], "front")
        self.assertEqual(res["reps"][0]["rules"]["WB-01"]["status"], "not_assessable")

    def test_camera_cut_mid_clip_judges_each_rep_from_its_own_view(self):
        """Edited videos cut between side-on and behind; side-on depth maths on a rear-view rep is meaningless."""
        import copy
        data = synthetic([1, 1, 1, 1])
        start_rep3 = int(0.5 * FPS) + 2 * 2 * FPS
        for f in data["frames"][start_rep3:]:
            f["kp"] = copy.deepcopy(f["kp"])
            f["kp"][11][0], f["kp"][12][0] = 350, 650                 # shoulders now wide: filmed from behind
        res = analyze(data, load_config())
        self.assertEqual([r["view"] for r in res["reps"]], ["side", "side", "front", "front"])
        for r in res["reps"][2:]:
            self.assertNotIn("knee at the bottom", r["rules"]["WB-01"]["reason"])
        self.assertTrue(any(w.startswith("2 of 4 reps were filmed from the front or behind") for w in res["warnings"]))

    def test_counts_reps_and_flags_the_shallow_one(self):
        res = analyze(synthetic([1, 1, 0.5, 1, 1]), load_config())
        self.assertEqual(res["view"], "side")
        self.assertEqual(len(res["reps"]), 5)
        self.assertEqual([r["n"] for r in res["reps"] if "WB-01" in r["failed"]], [3])
        self.assertEqual([r["verdict"] for r in res["reps"]],
                         ["proper", "proper", "not_proper", "proper", "proper"])
        self.assertEqual(res["summary"]["most_common_fault"], "WB-01")


if __name__ == "__main__":
    unittest.main()


class SummaryTest(unittest.TestCase):
    """Takeaways that the short web clips never trigger: depth creeping up, breaks vs a slow steady pace."""
    def _reps(self, depths, gaps_s):
        from analysis.pipeline import summary
        t, reps = 0.0, []
        for n, (d, g) in enumerate(zip(depths, gaps_s), 1):
            t += g
            reps.append({"n": n, "bottom": round(t * FPS), "verdict": "proper", "failed": [],
                         "rules": {"WB-01": {"status": "pass", "value": d, "low_confidence": False}}})
        return summary.summarize(reps, FPS, load_config())

    def test_depth_creep_and_a_break(self):
        s = self._reps([0.10] * 4 + [0.06] * 4 + [0.02] * 4, [2] * 6 + [8] + [2] * 5)
        text = " ".join(s["takeaways"])
        self.assertIn("shallower across the set", text)
        self.assertEqual((s["pauses"], s["rest_s"]), (1, 6.0))      # 8 s gap = 6 s lost against a 2 s rhythm

    def test_slow_steady_set_is_not_a_break(self):
        s = self._reps([0.1] * 5, [3.4] * 5)
        self.assertEqual(s["pauses"], 0)


class FrontViewDepthTest(unittest.TestCase):
    def test_hip_drop_can_pass_but_never_fails(self):
        from analysis.pipeline import rules
        p = load_config()["rules"]["WB-01"]["params"]
        rep = {"start": 0, "bottom": 10, "release": 15, "end": 20}
        ctx = {"view": "front", "L": 400.0}

        def run(bottom_h):
            h = np.full(21, 400.0)
            h[10] = bottom_h
            observed = np.full((21, 33, 3), np.nan)
            observed[:, 27] = [0, 1000, 1]
            observed[:, 23] = np.c_[np.zeros(21), 1000 - h, np.ones(21)]
            B = {"observed": observed}
            return rules.wb01_depth(B, rep, ctx, p)["status"]

        self.assertEqual(run(80), "pass")                # 0.20 of standing: clearly deep
        self.assertEqual(run(160), "not_assessable")     # 0.40: not clearly deep -> can't judge, not a no-rep
