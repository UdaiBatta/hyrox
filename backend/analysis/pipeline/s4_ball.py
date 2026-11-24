"""Stage 6: where the wall ball is in each frame, using the body and gravity as references.

A generic object detector (MediaPipe EfficientDet, COCO "sports ball") found the medicine ball in 0-40% of frames
on our clips, and plain circle-finding latched onto weight plates in gyms. What we know instead:
  * size:   a wall ball is ~35 cm across, about 0.19 of the athlete's leg length (radius), measured per frame;
  * held:   between catch and release it's at the hands, so we only look right there (and fall back to the hands);
  * flight: it moves, it's the right size, and it falls under gravity. A Kalman filter with gravity in its motion
            model predicts where it should be next and how unsure that is; that sets the search window (no
            hand-tuned windows), weak sightings still count but are trusted less (the ByteTrack lesson), and when
            it isn't seen the window grows on its own. Sideways speed may change sharply (the bounce off the wall),
            vertical speed may not (gravity). A Rauch-Tung-Striebel pass then smooths each flight backwards, so the
            path has no lag and runs through the frames where the ball wasn't seen. A position is only shown
            where the smoothed uncertainty is under one ball radius; otherwise it's hidden, not guessed.
Static round things (plates, logos) don't move, and the athlete's own moving limbs are blanked out using the
skeleton before looking.

Output: track per frame [x, y, r, state] in pixels, state 1 = held, 0 = seen in flight, 2 = in flight, placed by
the filter (y < 0 means above the frame); None when unknown. Plus one summary per throw for WB-05, whose gravity
ruler comes from a parabola fit to the raw sightings only, so it stays independent of the filter's gravity.
"""
import cv2
import numpy as np

BALL_OVER_LEG = 0.19        # ball radius / leg length, both in pixels
HANDS = list(range(15, 23))
MIN_FLIGHT_S = 0.25         # can't count as caught sooner than this after release
MAX_FLIGHT_S = 1.2          # up ~1 m and back takes ~0.9 s; by then it's in the hands
LIMBS = [(11, 13), (13, 15), (12, 14), (14, 16), (11, 12), (11, 23), (12, 24), (23, 24),
         (23, 25), (25, 27), (24, 26), (26, 28)]

# Kalman filter in pixels and frames. State [x, y, vx, vy]; gravity enters as a known acceleration.
F = np.array([[1, 0, 1, 0], [0, 1, 0, 1], [0, 0, 1, 0], [0, 0, 0, 1]], float)
H = np.array([[1, 0, 0, 0], [0, 1, 0, 0]], float)
G = np.array([[0.5, 0], [0, 0.5], [1, 0], [0, 1]])     # how an acceleration kick moves the state in one frame
Q_ACCEL = (0.35, 0.08)      # unmodelled acceleration (x, y) in r/frame^2: big sideways (wall bounce), small vertical
MEAS_SIGMA = (0.15, 0.45)   # sighting noise in r: a full-size blob vs a partial / blurred one
GATE = 3.0                  # accept sightings within 3 sigma of the prediction
SHOW_SIGMA = 1.0            # draw the ball only where the smoothed position is known to within one radius
MAX_SPEED_M_S = 12.0        # cap on ball speed; elite wall-ball throws leave the hands at well under this


def _leg(kp):
    return np.mean([np.linalg.norm(kp[23, :2] - kp[25, :2]) + np.linalg.norm(kp[25, :2] - kp[27, :2]),
                    np.linalg.norm(kp[24, :2] - kp[26, :2]) + np.linalg.norm(kp[26, :2] - kp[28, :2])])


def _circle_at_hands(gray, hands, r):
    """A circle of the ball's size centred within ~0.6 r of the hands (held ball), else None."""
    x0, y0 = int(max(0, hands[0] - 2 * r)), int(max(0, hands[1] - 2 * r))
    roi = gray[y0:int(hands[1] + 2 * r), x0:int(hands[0] + 2 * r)]
    if roi.size == 0:
        return None
    c = cv2.HoughCircles(roi, cv2.HOUGH_GRADIENT, dp=1.2, minDist=r, param1=80, param2=22,
                         minRadius=int(0.75 * r), maxRadius=int(1.3 * r))
    if c is None:
        return None
    c = c[0] + [x0, y0, 0]
    best = c[np.argmin(np.hypot(c[:, 0] - hands[0], c[:, 1] - hands[1]))]
    return best if np.hypot(best[0] - hands[0], best[1] - hands[1]) < 0.6 * r else None


def _moving_blobs(motion, kp, r):
    """Moving blobs of roughly the ball's size, with the athlete blanked out: [(x, y, fullness 0..1)]."""
    m = motion.copy()
    for a, b in LIMBS:
        cv2.line(m, tuple(int(v) for v in kp[a, :2]), tuple(int(v) for v in kp[b, :2]), 0, int(0.6 * r))
    cv2.fillConvexPoly(m, kp[[11, 12, 24, 23], :2].astype(np.int32), 0)                 # torso
    cv2.circle(m, tuple(int(v) for v in kp[0, :2]), int(0.9 * r), 0, -1)              # head
    cv2.circle(m, tuple(int(v) for v in kp[HANDS, :2].mean(axis=0)), int(0.6 * r), 0, -1)   # hands
    n, _, stats, cents = cv2.connectedComponentsWithStats(m)
    area = np.pi * r * r
    out = []
    for k in range(1, n):
        w, h, a = stats[k, 2], stats[k, 3], stats[k, 4]
        if 0.25 * area < a < 2.5 * area and 0.33 < w / max(h, 1) < 3:   # fast = motion-blurred, so stretched
            out.append((cents[k][0], cents[k][1], min(1.0, a / area)))
    return out


class _Flight:
    """Kalman filter for one throw, in pixels; keeps what the backward smoother needs.

    Seeded from the first two real sightings (position + the velocity between them), as in classic ball trackers,
    not from a guess at the release frame: "release" is when the wrists peak, by which time the ball is already
    several radii up and moving fast, and a guessed start sent the filter off the top of the frame."""

    def __init__(self, t0, r, g, fps):
        self.t0, self.r, self.g = t0, r, g
        self.x, self.P, self.start, self.pre = None, None, None, []   # pre: sightings before the filter is seeded
        self.Q = G @ np.diag([(Q_ACCEL[0] * r) ** 2, (Q_ACCEL[1] * r) ** 2]) @ G.T
        self.u = np.array([0, 0.5 * g, 0, g])
        self.vmax = MAX_SPEED_M_S * g / 9.81 * fps                  # px/frame, using the same pixels-per-metre
        self.hist = []                                              # (x_pred, P_pred, x_filt, P_filt, seen)

    def step(self, i, candidates, hands):
        """One frame. Before seeding: the candidate nearest the column above the hands. After: predict, pick the
        sighting nearest the prediction inside the 3-sigma gate, update. Returns the sighting or None."""
        if self.x is None:
            best = min(candidates, key=lambda c: np.hypot(c[0] - hands[0], c[1] - hands[1] + 3 * self.r), default=None)
            if best is None or np.hypot(best[0] - hands[0], best[1] - hands[1] + 3 * self.r) > 10 * self.r:
                return None
            z = np.array(best[:2])
            if self.pre and i - self.pre[-1][0] <= 2:                 # two close sightings: seed position + velocity
                v = np.clip((z - self.pre[-1][1]) / (i - self.pre[-1][0]), -self.vmax, self.vmax)
                self.x = np.array([*z, *v])
                self.P = np.diag([0.3 * self.r, 0.3 * self.r, 0.5 * self.r, 0.5 * self.r]) ** 2
                self.start = i
                self.hist.append((self.x.copy(), self.P.copy(), self.x.copy(), self.P.copy(), True))
            self.pre.append((i, z))
            return z
        xp, Pp = F @ self.x + self.u, F @ self.P @ F.T + self.Q
        self.x, self.P = xp, Pp
        best, best_d = None, GATE
        for cx, cy, full in candidates:
            R = np.eye(2) * (np.interp(full, [0.25, 1], MEAS_SIGMA[::-1]) * self.r) ** 2
            S = H @ Pp @ H.T + R
            v = np.array([cx, cy]) - H @ xp
            d = float(np.sqrt(v @ np.linalg.solve(S, v)))
            if d < best_d:
                best, best_d = (v, S), d
        if best is not None:
            v, S = best
            K = Pp @ H.T @ np.linalg.inv(S)
            self.x, self.P = xp + K @ v, (np.eye(4) - K @ H) @ Pp
        self.x[2:] = np.clip(self.x[2:], -self.vmax, self.vmax)    # no human throw is faster than this
        self.hist.append((xp, Pp, self.x.copy(), self.P.copy(), best is not None))
        return None if best is None else H @ xp + best[0]            # the raw sighting (prediction + innovation)

    def close(self, z):
        """The catch is a sighting too: at that frame the ball is at the hands. One last predict + update with it
        (no gate), so the backward pass can bring the path down to the hands instead of fading out."""
        if self.x is None:
            return
        xp, Pp = F @ self.x + self.u, F @ self.P @ F.T + self.Q
        S = H @ Pp @ H.T + np.eye(2) * (0.5 * self.r) ** 2
        K = Pp @ H.T @ np.linalg.inv(S)
        self.x, self.P = xp + K @ (np.asarray(z) - H @ xp), (np.eye(4) - K @ H) @ Pp
        self.hist.append((xp, Pp, self.x.copy(), self.P.copy(), False))

    def smoothed(self):
        """Rauch-Tung-Striebel backward pass: {frame: (x, y, sigma, seen)} from the seed frame on."""
        xs = [h[2] for h in self.hist]
        Ps = [h[3] for h in self.hist]
        for k in range(len(self.hist) - 2, -1, -1):
            xp, Pp = self.hist[k + 1][0], self.hist[k + 1][1]
            C = self.hist[k][3] @ F.T @ np.linalg.inv(Pp)
            xs[k] = self.hist[k][2] + C @ (xs[k + 1] - xp)
            Ps[k] = self.hist[k][3] + C @ (Ps[k + 1] - Pp) @ C.T
        return {self.start + k: (x[0], x[1], float(np.sqrt(max(P[0, 0], P[1, 1]))), h[4])
                for k, (x, P, h) in enumerate(zip(xs, Ps, self.hist))}


def track(video, data, releases, log=print, ball_diameter_m=0.35):
    """`releases` = throw frames from rep detection: the ball leaves the hands there and is followed in flight until
    it comes back down to the hands, or the hands drop below the shoulders (caught, squatting again)."""
    cap = cv2.VideoCapture(str(video))
    fps = data["fps"]
    releases = set(releases)
    min_flight = int(MIN_FLIGHT_S * fps)                # right after release the ball is still next to the hands
    prev_gray, flight, done = None, None, []
    out, sizes, sightings = [], [], {}
    for i, f in enumerate(data["frames"]):
        ok, bgr = cap.read()
        if not ok:
            break
        gray = cv2.GaussianBlur(cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY), (5, 5), 1.5)
        res = None
        if f["kp"]:
            kp = np.array(f["kp"])
            r = BALL_OVER_LEG * _leg(kp)
            hands = kp[HANDS, :2].mean(axis=0)
            shoulders_y = kp[[11, 12], 1].mean()
            if i in releases:
                if flight:
                    done.append(flight)
                # gravity in pixels per frame^2 from the size ruler: 9.81 m/s^2 x (r px / ball radius m) / fps^2
                flight = _Flight(i, r, 9.81 * r / (ball_diameter_m / 2) / fps ** 2, fps)
            if flight and i - flight.t0 > MAX_FLIGHT_S * fps:
                done.append(flight)                                     # gave up
                flight = None
            if flight and i - flight.t0 > min_flight:
                # Caught = the predicted path has come back down to the hands (the athlete may lower empty hands to
                # wait, so hand height alone says nothing). Without a seeded filter, fall back to hands dropping.
                if flight.x is not None:
                    pred = F @ flight.x + flight.u
                    back = pred[3] > 0 and pred[1] >= hands[1] - r
                else:
                    back = hands[1] > shoulders_y
                if back:
                    flight.close(hands)
                    done.append(flight)
                    flight = None
            if flight and prev_gray is not None:
                motion = cv2.threshold(cv2.absdiff(gray, prev_gray), 18, 255, cv2.THRESH_BINARY)[1]
                motion = cv2.morphologyEx(motion, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
                motion[int(max(0, shoulders_y)):] = 0                    # in flight it's always above the shoulders
                seen = flight.step(i, _moving_blobs(motion, kp, r), hands)
                falling = flight.x is not None and flight.x[3] > 0
                if seen is not None and i - flight.t0 > min_flight and falling and np.hypot(*(seen - hands)) < 2 * r:
                    # back in the hands: the sighting stays in the filter (it's the catch); the frame shows as held
                    if flight.pre and flight.pre[-1][0] == i:
                        flight.pre.pop()
                    done.append(flight)
                    flight = None
                elif seen is not None:
                    sightings.setdefault(flight.t0, []).append((i, seen[0], seen[1], r))
            if not flight:
                c = _circle_at_hands(gray, hands, r)
                res = [c[0], c[1], r, 1] if c is not None else [hands[0], hands[1], r, 1]
                if c is not None:
                    sizes.append(c[2] / r)                              # measured radius vs the leg-length guess
            else:
                res = "flight"
        out.append(res)
        prev_gray = gray
        if i % 100 == 0:
            log(f"ball: frame {i}")
    cap.release()
    if flight:
        done.append(flight)

    # Flights: smoothed positions where the filter is sure, hidden elsewhere. Too few sightings = hidden entirely.
    for fl in done:
        enough = len(sightings.get(fl.t0, [])) >= 3
        for i, z in fl.pre:                                             # sightings before the filter was seeded
            if i < len(out) and out[i] == "flight" and enough:
                out[i] = [z[0], z[1], fl.r, 0]
        if fl.x is None:
            continue
        for i, (x, y, sigma, seen) in fl.smoothed().items():
            if i < len(out) and out[i] == "flight":
                out[i] = [x, y, fl.r, 0 if seen else 2] if enough and sigma < SHOW_SIGMA * fl.r else None
    out = [None if isinstance(b, str) else b for b in out]

    # The ball's real size in this clip: median of the circles actually measured at the hands (needs enough of them).
    k = float(np.clip(np.median(sizes), 0.75, 1.3)) if len(sizes) >= 10 else 1.0
    out = [None if b is None else [round(float(b[0]), 1), round(float(b[1]), 1), round(float(b[2] * k), 1), int(b[3])]
           for b in out]
    flights = [_summarise(out, t0, sightings.get(t0, []), fps, k) for t0 in sorted(releases)]
    return {"track": out, "flights": flights, "size_measured": len(sizes) >= 10}


def _summarise(out, t0, seen, fps, k, min_points=5):
    """Per throw, for WB-05. Gravity ruler: a parabola y = a t^2 + b t + c fitted to the raw sightings only (robustly,
    so a stray sighting can't bend it); peak: the highest point of the smoothed path."""
    if len(seen) < min_points:
        return {"release": t0, "points": len(seen)}
    i, x, y, r = (np.array(v, float) for v in zip(*seen))
    t, keep = i - t0, np.ones(len(i), bool)
    for _ in range(3):
        coef = np.polyfit(t[keep], y[keep], 2)
        res = np.abs(np.polyval(coef, t) - y)
        if not (res[keep] > 0.5 * np.median(r)).any():
            break
        keep &= res <= 0.5 * np.median(r)
        if keep.sum() < min_points:
            return {"release": t0, "points": int(keep.sum())}
    end = next((j for j in range(t0 + 1, len(out)) if out[j] and out[j][3] == 1), len(out))
    path = [(j, out[j]) for j in range(t0, end) if out[j] and out[j][3] != 1]
    rad = float(np.median(r)) * k
    j_peak, b_peak = min(path, key=lambda p: p[1][1]) if path else (None, None)
    seen_frames = set(i[keep].astype(int))
    return {"release": t0, "points": int(keep.sum()), "r": round(rad, 1),
            "peak_y": None if b_peak is None else b_peak[1], "peak_frame": j_peak,
            "peak_seen": j_peak is not None and any(abs(j_peak - s) <= 2 for s in seen_frames) and b_peak[1] >= 0,
            "min_seen_y": round(float(y[keep].min()), 1),
            "left_top": bool((y[keep] - r[keep] <= 2).any() or (b_peak is not None and b_peak[1] - rad < 0)),
            "g_px": round(float(2 * coef[0] * fps * fps), 1),
            "rms": round(float(np.sqrt(np.mean((np.polyval(coef, t[keep]) - y[keep]) ** 2))), 1)}
