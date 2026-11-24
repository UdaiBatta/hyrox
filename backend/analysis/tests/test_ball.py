"""Self-checks for the ball tracker and WB-05 on synthetic data."""
import tempfile
import unittest
from pathlib import Path

import cv2
import numpy as np

from analysis.pipeline import load_config, s4_ball as ball, s5_rules as rules

R = 38                      # ball radius px = 0.19 x leg (200 px)
HANDS = (300, 200)
FPS = 30
A = 1.5                     # gravity in this clip: y'' = 2A px/frame^2


def _ball_at(i):
    """Held until frame 5, then thrown: y = 200 - 30 t + A t^2 (peak at t = 10, y = 50)."""
    t = i - 4
    return HANDS if i < 5 else (HANDS[0], round(HANDS[1] - 30 * t + A * t * t))


def _kp():
    kp = [[300, 230, 1]] * 33                                   # head
    for j, p in {11: (300, 250), 12: (300, 250), 13: (300, 225), 14: (300, 225), 23: (300, 400), 24: (300, 400),
                 25: (300, 500), 26: (300, 500), 27: (300, 600), 28: (300, 600)}.items():
        kp[j] = [*p, 1]
    for j in range(15, 23):
        kp[j] = [*HANDS, 1]
    return kp


class BallTrackTest(unittest.TestCase):
    def test_held_then_followed_in_flight_with_gravity_fill(self):
        hidden = {12, 13}                                         # dropout near the peak
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "clip.mp4"
            out = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"), FPS, (600, 700))
            for i in range(20):
                frame = np.full((700, 600, 3), 255, np.uint8)
                if i not in hidden:
                    cv2.circle(frame, _ball_at(i), R, (30, 30, 30), -1)
                out.write(frame)
            out.release()
            data = {"fps": FPS, "frames": [{"kp": _kp()} for _ in range(20)]}
            bt = ball.track(path, data, releases=[5], log=lambda *_: None)
        track, flight = bt["track"], bt["flights"][0]

        self.assertTrue(all(track[i][3] == 1 for i in range(5)), "held before the throw")
        for i in range(8, 17):
            self.assertIsNotNone(track[i], f"frame {i}: no ball")
            x, y, _, state = track[i]
            self.assertIn(state, (0, 2), f"frame {i}: in flight")
            self.assertLess(np.hypot(x - _ball_at(i)[0], y - _ball_at(i)[1]), 0.6 * R, f"frame {i}: wrong place")
        # Frame differencing still "sees" where the ball just vanished from, so not every hidden frame needs the fit.
        self.assertTrue(any(track[i][3] == 2 for i in hidden), "gravity fit fills the dropout")
        self.assertAlmostEqual(flight["g_px"], 2 * A * FPS * FPS, delta=0.2 * 2 * A * FPS * FPS)
        self.assertAlmostEqual(flight["peak_y"], 50, delta=0.4 * R)


class TargetHeightTest(unittest.TestCase):
    """WB-05 from a flight summary: 200 px/m by both rulers, ankles at y = 1000."""
    p = load_config()["rules"]["WB-05"]["params"]
    observed = np.full((40, 33, 3), np.nan)
    observed[:, 27] = [300, 1000, 1]
    B = {"observed": observed}
    rep = {"release": 20}

    def judge(self, peak_y, g_ratio=1.0, peak_seen=True):
        ppm = 200
        f = {"release": 20, "points": 12, "r": ppm * self.p["ball_diameter_m"] / 2, "g_px": 9.81 * ppm * g_ratio,
             "peak_y": peak_y, "peak_seen": peak_seen, "left_top": False}
        return rules.wb05_target(self.B, self.rep, {"ball": {20: f}}, self.p)

    def test_height_against_target(self):
        # floor = 1000 + 0.08 m; ball top = (floor - y)/200 + 0.175 m
        self.assertEqual(self.judge(peak_y=1016 - (3.2 - 0.175) * 200)["status"], "pass")        # 3.2 m
        r = self.judge(peak_y=1016 - (2.5 - 0.175) * 200)                                       # 2.5 m
        self.assertEqual((r["status"], r["low_confidence"]), ("fail", False))
        self.assertTrue(self.judge(peak_y=1016 - (2.95 - 0.175) * 200)["low_confidence"], "5 cm short: too close")
        self.assertEqual(self.judge(peak_y=600, g_ratio=0.5)["status"], "not_assessable", "rulers disagree")

    def test_hidden_floor_reference(self):
        self.B = {"observed": np.full_like(self.observed, np.nan)}
        self.assertEqual(self.judge(peak_y=600)["status"], "not_assessable")


class TwoHandsEvidenceTest(unittest.TestCase):
    """WB-04 must only use wrists observed at release: a bridged (estimated) wrist is never evidence."""
    p = load_config()["rules"]["WB-04"]["params"]

    def judge(self, hidden=None):
        observed = np.full((5, 33, 3), np.nan)
        observed[:, [15, 16, 0]] = [[100, 50, .9], [130, 50, .9], [115, 80, .9]]
        if hidden is not None:
            observed[2, hidden] = np.nan
        B = {"observed": observed}
        return rules.wb04_two_hands(B, {"release": 2}, {"L": 100.0}, self.p)["status"]

    def test_bridged_wrist_is_not_evidence(self):
        self.assertEqual(self.judge(), "pass")
        self.assertEqual(self.judge(15), "not_assessable")
        self.assertEqual(self.judge(0), "not_assessable")
