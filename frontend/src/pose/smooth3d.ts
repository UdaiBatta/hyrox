import type { Ball, Frame, World } from '../api/types.ts'
import { inFrame, isHandBallEstimate, LOW_VIS, type FrameBounds } from './skeleton.ts'

/** A joint in 3D (metres, y down, hip-centred), or null when it isn't available and is hidden. */
export type Joint = World | null
export type Clip = (Joint[] | null)[]
/** Ball in the same space as the skeleton: centre (metres, y down, hip-centred) and radius in metres. */
export type Ball3D = { p: World; r: number; held: boolean }
export interface Lifted {
  clip: Clip
  /** Per frame and joint: true where the position is reconstructed (bridged gap, mirrored or copied limb). */
  est: (boolean[] | null)[]
  /** Per frame: the floor's height in the same hip-centred coordinates (y down), from planted feet. */
  floor: (number | null)[]
  ball: (Ball3D | null)[]
  /** Per frame and joint: the reconstructed position back in video pixels, so the 2D overlay can draw the same
   *  estimate the 3D shows (dashed) instead of MediaPipe's guess for a hidden joint. */
  px: (([number, number] | null)[] | null)[]
}

/** Bones as joint <- parent, walked from the hips outwards (hips themselves are the root). */
const PARENT: [number, number][] = [
  [25, 23], [26, 24], [27, 25], [28, 26], [29, 27], [30, 28], [31, 27], [32, 28],
  [11, 23], [12, 24], [13, 11], [14, 12], [15, 13], [16, 14],
  [17, 15], [18, 16], [19, 15], [20, 16], [21, 15], [22, 16],
]
const PARENT_OF = new Map(PARENT)
const mirror = (j: number) => (j % 2 ? j + 1 : j - 1)
const dist2 = (a: World, b: World) => Math.hypot(a[0] - b[0], a[1] - b[1])
const dist3 = (a: World, b: World) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const pct = (xs: number[], q: number) => [...xs].sort((a, b) => a - b)[Math.floor(q * (xs.length - 1))] ?? 0
const FEET = [27, 28, 29, 30, 31, 32]

// Depth direction of bone (joint <- parent) in a squat, relative to "forward" (the way the athlete faces):
// knees ahead of hips, shoulders ahead of hips, ankles behind knees, toes ahead of and heels behind the ankles.
const FORWARD: Record<number, 1 | -1> = { 25: 1, 26: 1, 11: 1, 12: 1, 27: -1, 28: -1, 31: 1, 32: 1, 29: -1, 30: -1 }

const MAX_GAP_S = 0.2       // bridge a joint's gap only if it's this short and observed on both sides
const SIGMA_XY_S = 0.05     // image points are steady: light smoothing
const SIGMA_Z_S = 0.12      // the model's depth is the noisy part: smooth it harder (it only supplies a sign)
const SIGN_TRUST = 1        // cost (metres of depth jump) per metre of model depth evidence against a direction
const PLANTED_M_S = 0.3     // a foot point moving slower than this is on the floor
const FLOOR_WINDOW_S = 0.4  // shortcut: local floor contacts only, use camera tracking for footage that pans with feet cropped
const BALL_FLIGHT_S = 1.2
// Holding the ball (front/back views, arm joints hidden): the standard is "ball at the chest" during the squat.
const BALL_R_M = 0.175      // 14-inch wall ball
const CHEST_M = 0.12        // ball surface this far in front of the shoulder line
const HOLD_DROP_M = 0.18    // ball centre this far below the shoulders when held at the chest

type V3 = [number, number, number]
const add = (a: V3, b: V3, k = 1): V3 => [a[0] + k * b[0], a[1] + k * b[1], a[2] + k * b[2]]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const unit = (a: V3): V3 => { const n = Math.hypot(...a) || 1; return [a[0] / n, a[1] / n, a[2] / n] }

/** Two-bone inverse kinematics: the elbow between shoulder S and wrist W, given upper-arm and forearm lengths,
 *  bent towards `pole` (down and out for arms holding a ball). If W is out of reach the arm is straight. */
export function elbowIK(S: V3, W: V3, upper: number, fore: number, pole: V3): V3 {
  const toW = add(W, S, -1)
  const d = Math.min(Math.max(Math.hypot(...toW), Math.abs(upper - fore) + 1e-4), upper + fore - 1e-4)
  const dir = unit(toW)
  const x = (upper * upper - fore * fore + d * d) / (2 * d)
  const h = Math.sqrt(Math.max(0, upper * upper - x * x))
  const bend = unit(add(pole, dir, -dot(pole, dir)))
  return add(add(S, dir, x), bend, h)
}

/** Bridge short gaps in one joint's track. `ok` marks reliable observations; a run of unreliable frames no longer
 *  than `maxGap` with reliable frames on both sides is filled linearly and flagged estimated. Longer gaps and gaps
 *  running off either end of the clip stay unavailable (null). */
export function repairJoint(vals: (number[] | null)[], ok: boolean[], maxGap: number) {
  const v = vals.map((x, i) => (ok[i] && x ? x : null))
  const est = v.map(() => false)
  for (let i = 0; i < v.length;) {
    if (v[i]) { i++; continue }
    let k = i
    while (k < v.length && !v[k]) k++
    if (i > 0 && k < v.length && k - i <= maxGap) {
      const a = v[i - 1]!, b = v[k]!
      for (let t = i; t < k; t++) {
        const f = (t - i + 1) / (k - i + 1)
        v[t] = a.map((x, c) => x + f * (b[c] - x))
        est[t] = true
      }
    }
    i = k
  }
  return { v, est }
}

/** Zero-lag Gaussian smoothing over time; unavailable entries are neither used nor filled. The window is kept
 *  symmetric: near a gap (or the clip's end) it shrinks to the distance available on both sides, since a one-sided
 *  average leads or lags a moving joint (it pulled a visible C4a knee 8.7 px next to its gap). */
export function smoothSeries(v: (number[] | null)[], sigmaFrames: number): (number[] | null)[] {
  const r = Math.ceil(sigmaFrames * 3)
  const w = Array.from({ length: 2 * r + 1 }, (_, k) => Math.exp(-((k - r) ** 2) / (2 * sigmaFrames ** 2)))
  return v.map((x, i) => {
    if (!x) return null
    let rr = 0
    while (rr < r && v[i - rr - 1] && v[i + rr + 1]) rr++
    const acc = x.map(() => 0)
    let total = 0
    for (let k = -rr; k <= rr; k++) {
      const q = v[i + k]
      if (!q) continue
      q.forEach((c, d) => { acc[d] += c * w[k + r] })
      total += w[k + r]
    }
    return acc.map((c) => c / total)
  })
}

/** Image points and model depth per joint. Order matters: low-confidence observations (visibility < the overlay's
 *  LOW_VIS) are dropped, the reliable ones are smoothed among themselves, and only then are short gaps bridged
 *  between the smoothed ends (estimated). So a visible frame is moved by nothing but other visible frames: bridging
 *  first let the straight-line bridge leak into its neighbours (C4a knee, frames 24 and 28). */
export function trackImage(frames: Frame[], fps: number, bounds?: FrameBounds) {
  const maxGap = Math.max(1, Math.round(MAX_GAP_S * fps))
  const pts: Joint[][] = frames.map(() => new Array(33).fill(null))
  const wld: Joint[][] = frames.map(() => new Array(33).fill(null))
  const est: boolean[][] = frames.map(() => new Array(33).fill(false))
  for (let j = 0; j < 33; j++) {
    const ok = frames.map((f) => !!f.kp && !!f.world && f.kp[j][2] >= LOW_VIS && (!bounds || inFrame(f.kp[j], bounds)))
    const sa = smoothSeries(frames.map((f, i) => (ok[i] ? [f.kp![j][0], f.kp![j][1]] : null)), SIGMA_XY_S * fps)
    const sb = smoothSeries(frames.map((f, i) => (ok[i] ? [...f.world![j]] : null)), SIGMA_Z_S * fps)
    const a = repairJoint(sa, ok, maxGap)
    const b = repairJoint(sb, ok, maxGap)
    frames.forEach((f, i) => {
      if (bounds && f.kp && !inFrame(f.kp[j], bounds)) return
      if (a.v[i]) pts[i][j] = [a.v[i]![0], a.v[i]![1], 0]
      if (b.v[i]) wld[i][j] = b.v[i] as World
      est[i][j] = a.est[i]
    })
  }
  return { pts, wld, est }
}

/** Pick each frame's depth direction (+1 / -1) for a bone whose image length fits both, over the whole sequence
 *  (Viterbi). Flipping costs the depth jump it causes, |s m_t - s' m_{t-1}|, so a long bone can't reverse for a
 *  frame; a genuine change happens where the bone lies flat to the camera (m near 0, flipping is free) or when the
 *  model keeps insisting. Disagreeing with the model costs SIGN_TRUST x its evidence (its own depth difference). */
export function chooseSigns(m: number[], evidence: number[]): (1 | -1)[] {
  const S = [1, -1] as const
  const n = m.length
  if (!n) return []
  const mm = m.map((x) => (Number.isFinite(x) ? x : 0))
  const unary = (t: number, s: number) => (evidence[t] && Math.sign(evidence[t]) !== s ? SIGN_TRUST * Math.abs(evidence[t]) : 0)
  let cost = S.map((s) => unary(0, s))
  const back: number[][] = []
  for (let t = 1; t < n; t++) {
    const prev = cost
    const b: number[] = []
    cost = S.map((s, k) => {
      const opts = S.map((sp, kp) => prev[kp] + Math.abs(s * mm[t] - sp * mm[t - 1]))
      b[k] = opts[0] <= opts[1] ? 0 : 1
      return opts[b[k]] + unary(t, s)
    })
    back.push(b)
  }
  const out: (1 | -1)[] = new Array(n)
  let k = cost[0] <= cost[1] ? 0 : 1
  for (let t = n - 1; t >= 0; t--) {
    out[t] = S[k]
    if (t > 0) k = back[t - 1][k]
  }
  return out
}

/**
 * 3D skeleton for the viewer, agreeing with the video. MediaPipe's own 3D ("world") estimate comes from a separate
 * model head: its depth is noisy and its x/y drift from the 2D points the overlay draws. Instead:
 *   x, y  = the 2D image points, scaled to metres (gaps repaired per joint, see trackImage);
 *   depth = from bone length: a bone that looks shorter than its real length L points towards or away from the
 *           camera by sqrt(L^2 - l^2) (Taylor, CVIU 2000). Which way: movement priors for legs and torso, a
 *           sequence choice (chooseSigns) for the arms. Each limb keeps its own projected length.
 * Movement priors (what the video alone can't tell us):
 *  - side-on: a wall ball is a sagittal-plane movement, so depth is only the body's width; the far side copies the
 *    near side (estimated).
 *  - front / back: left-right from the video (a wide stance shows wide); in a
 *    squat knees go forward, ankles stay behind the knees, and the shoulders stay over the mid-foot (balance).
 *    "Forward" is towards the camera when filmed from the front (model's nose nearer than its ears).
 *  - unavailable joints stay hidden (front/back): mirroring across the projected hip line made oblique knees snap.
 * Floor: from planted feet (see floorTrack), not the lowest foot point per frame, so a noisy toe or a lifted foot
 * doesn't move the body. Viewer only: the rules judge the video's own keypoints.
 */
export function liftFromImage(frames: Frame[], fps: number, ball?: (Ball | null)[], view: 'side' | 'front' = 'front', bounds?: FrameBounds): Lifted {
  const T = trackImage(frames, fps, bounds)
  const img = T.pts, wld = T.wld
  const idx = frames.flatMap((f, i) => (f.kp && f.world ? [i] : []))
  const with2 = (c: Joint[][], js: number[]) => idx.filter((i) => js.every((j) => c[i][j] && !T.est[i][j]))

  // Metres per pixel: leg length as the model measures it vs as the image shows it (90th pct: legs straight).
  const legLength = (c: Joint[][], dist: typeof dist2) => [23, 24].flatMap((h) =>
    with2(c, [h, h + 2, h + 4]).map((i) => dist(c[i][h]!, c[i][h + 2]!) + dist(c[i][h + 2]!, c[i][h + 4]!)))
  const legPx = legLength(img, dist2)
  const legM = legLength(wld, dist3)
  const s = pct(legM, 0.9) / (pct(legPx, 0.9) || 1)
  if (!s) return { clip: frames.map(() => null), est: frames.map(() => null), floor: frames.map(() => null), ball: frames.map(() => null), px: frames.map(() => null) }

  const realLen = (j: number, p: number) => Math.max(
    pct(with2(img, [j, p]).map((i) => dist2(img[i][j]!, img[i][p]!) * s), 0.9),
    pct(with2(wld, [j, p]).map((i) => dist3(wld[i][j]!, wld[i][p]!)), 0.5))
  const raw = new Map(PARENT.map(([j, p]) => [j, realLen(j, p)]))
  // Arm never seen in the clip (both sides hidden throughout): standard proportions of the measured leg (Winter's
  // anthropometric tables: upper arm 0.186 H, forearm 0.146 H, thigh + shin 0.49 H).
  const ARM_OF_LEG: Record<number, number> = { 13: 0.38, 14: 0.38, 15: 0.3, 16: 0.3 }
  const L = new Map(PARENT.map(([j]) => [j, raw.get(j) || raw.get(mirror(j)) || (ARM_OF_LEG[j] ?? 0) * pct(legM, 0.9)]))
  const hipWidth = realLen(23, 24)
  const shoulderWidth = realLen(11, 12)
  const vis = (js: number[]) => idx.reduce((t, i) => t + js.reduce((u, j) => u + frames[i].kp![j][2], 0), 0)
  const nearLeft = vis([11, 13, 15, 23, 25, 27]) >= vis([12, 14, 16, 24, 26, 28])
  const face = with2(wld, [0, 7, 8])
  const noseAhead = face.reduce((t, i) => t + wld[i][0]![2] - (wld[i][7]![2] + wld[i][8]![2]) / 2, 0)
  const forward = noseAhead <= 0 ? -1 : 1           // z direction of "forward": -1 towards the camera, +1 away
  const mag = (len: number, l: number) => Math.sqrt(Math.max(0, len * len - l * l))

  const est = T.est
  const depth = new Map<number, (number[] | null)[]>()
  if (view !== 'side') {
    for (const [j, p] of [[23, 24], ...PARENT]) {
      const len = j === 23 ? hipWidth : L.get(j)!
      const m = img.map((pts) => pts[j] && pts[p] ? mag(len, dist2(pts[j]!, pts[p]!) * s) : NaN)
      const signs = FORWARD[j] ? null : chooseSigns(m, wld.map((w, i) =>
        w[j] && w[p] && !est[i][j] && !est[i][p] ? w[j]![2] - w[p]![2] : 0))
      depth.set(j, smoothSeries(m.map((d, i) =>
        Number.isFinite(d) ? [d * (signs?.[i] ?? FORWARD[j] * forward)] : null), SIGMA_Z_S * fps))
    }
  }

  // Where the ball is held, as a continuous track: the real held-ball sightings' offset from the shoulder midpoint
  // (image metres), smoothed and bridged up to 1 s; further from any sighting, this athlete's median hold; with no
  // sightings at all, the standard chest hold. Athletes differ (C4b holds it at face height). A per-frame switch
  // between sources made the prior flicker 0.6 m (C4a), and offsets from "observed" wrists were skewed by
  // confident-but-wrong wrists, so the ball sightings are the evidence.
  const hold: ([number, number] | null)[] = frames.map(() => null)
  let holdR = BALL_R_M
  if (view !== 'side' && ball) {
    const off = frames.map((f, i): number[] | null => {
      const b = ball[i], P = img[i]
      if (!b || b[3] !== 1 || !f.kp || !P[11] || !P[12] || isHandBallEstimate(b, f.kp)) return null
      return [(b[0] - (P[11]![0] + P[12]![0]) / 2) * s, (b[1] - (P[11]![1] + P[12]![1]) / 2) * s, b[2] * s]
    })
    const sightings = off.filter((o): o is number[] => o !== null)
    if (sightings.length >= Math.round(0.25 * fps)) {
      const med = [0, 1, 2].map((c) => pct(sightings.map((o) => o[c]), 0.5))
      holdR = med[2]
      const track = repairJoint(smoothSeries(off, SIGMA_Z_S * fps), off.map(Boolean), Math.round(fps)).v
      track.forEach((o, i) => { hold[i] = o ? [o[0], o[1]] : [med[0], med[1]] })
    }
  }

  // Pass 3: assemble in image metres, then the floor, then hip-centre.
  const abs: Clip = frames.map(() => null)
  const prior: Partial<Record<number, V3>>[] = frames.map(() => ({}))   // body-prior position per frame (IK / hold)
  const filled: Set<number>[] = frames.map(() => new Set())               // joints filled from the prior
  const inhFilled: Set<number>[] = frames.map(() => new Set())            // arm joints whose depth was inherited
  for (const i of idx) {
    const P = img[i], w = wld[i], e = est[i]
    const xy = (j: number): [number, number] => [P[j]![0] * s, P[j]![1] * s]
    const out: Joint[] = new Array(33).fill(null)
    if (view === 'side') {
      // Sagittal plane: both sides take the near side's image position; depth = half the body width (near side
      // towards the camera, negative z). The far side is a copy, so it's estimated.
      for (let j = 11; j <= 31; j += 2) {
        const near = nearLeft ? j : j + 1, far = nearLeft ? j + 1 : j
        if (!P[near]) continue
        const half = (j < 23 ? shoulderWidth : hipWidth) / 2
        out[near] = [...xy(near), -half]
        out[far] = [...xy(near), half]
        e[far] = true
      }
      for (let j = 0; j <= 10; j++) if (P[j]) out[j] = [...xy(j), 0]
    } else {
      if (!P[23] || !P[24]) continue                             // no hips, no skeleton this frame
      const hz = depth.get(23)?.[i]?.[0] ?? 0
      out[23] = [...xy(23), hz / 2]
      out[24] = [...xy(24), -hz / 2]
      for (const [j, p] of PARENT) {
        if (!P[j]) continue
        if (!out[p]) {                                            // parent hidden: keep the joint, inherit depth
          let q: number | undefined = p
          while (q !== undefined && !out[q]) q = PARENT_OF.get(q)
          out[j] = [...xy(j), q !== undefined ? out[q]![2] : 0]
          e[j] = true
          if (j >= 27) filled[i].add(j)                           // depth corrected later (fillGaps)
          else if (j >= 15) inhFilled[i].add(j)                   // wrist/hand seen, elbow hidden: same, for arms
          continue
        }
        if (j === 11 || j === 12) {
          // Balance: the shoulders sit above the mid-foot (hips go back, chest stays over the feet).
          const feet = [27, 28, 31, 32].filter((k) => out[k]).map((k) => out[k]![2])
          if (feet.length) {
            out[j] = [...xy(j), feet.reduce((x, y) => x + y) / feet.length]
            continue
          }
        }
        out[j] = [...xy(j), out[p]![2] + (depth.get(j)?.[i]?.[0] ?? 0)]
      }
      // Face: image position, depth relative to the shoulders as the model has it.
      const sh = [11, 12].filter((k) => out[k])
      const shZ = sh.length ? sh.reduce((t, k) => t + out[k]![2], 0) / sh.length : 0
      const shW = sh.filter((k) => w[k])
      const sz = shW.length ? shZ - shW.reduce((t, k) => t + w[k]![2], 0) / shW.length : 0
      for (let j = 0; j <= 10; j++) if (P[j]) out[j] = [...xy(j), w[j] ? w[j]![2] + sz : shZ]

      // Hidden arms while the ball is held: from behind, the back hides both arms through every squat (C4b: all
      // four arm joints under the visibility cutoff at every rep bottom), so the 3D lost its arms. The hands are on
      // the ball, following the continuous hold track (from real ball sightings), else the standard chest hold.
      // Depth: in front of the chest. Elbows by IK.
      // Only while the ball track says "held"; only hidden joints are filled, all estimated; an arm the camera sees
      // is kept, and in flight a hidden hand stays hidden (a chest-hold hand next to an overhead arm would be wrong).
      const S = { 13: out[11], 14: out[12] } as Record<number, Joint>
      const holding = ball?.[i]?.[3] === 1                      // ball track says "held" (not in flight)
      if (out[11] && out[12]) {               // prior on every frame (for the residual blend); filled only while held
        const lat = unit(add(out[11] as V3, out[12] as V3, -1))
        const shMid: V3 = [(out[11][0] + out[12][0]) / 2, (out[11][1] + out[12][1]) / 2, (out[11][2] + out[12][2]) / 2]
        const r = holdR
        const h = hold[i]
        const C: V3 = h
          ? [shMid[0] + h[0], shMid[1] + h[1], shMid[2] + forward * (CHEST_M + r)]
          : add(add(shMid, [0, HOLD_DROP_M, 0]), [0, 0, forward * (CHEST_M + r)])
        for (const [w2, e2, side] of [[15, 13, 1], [16, 14, -1]] as const) {
          prior[i][w2] = add(C, lat, side * 0.85 * r)                   // hands on the sides of the ball
          if (!out[w2] && holding) { out[w2] = prior[i][w2]!; e[w2] = true; filled[i].add(w2) }
          const pole = unit(add([0, 1, 0], lat, side * 0.6))
          prior[i][e2] = elbowIK(S[e2] as V3, (out[w2] ?? prior[i][w2]) as V3, L.get(e2)!, L.get(w2)!, pole)
          if (!out[e2] && out[w2]) { out[e2] = prior[i][e2]!; e[e2] = true; filled[i].add(e2) }
        }
      }
    }
    if (out[23] && out[24]) abs[i] = out
  }

  if (view !== 'side') {
    // Legs below a hidden knee: the ankle and foot are seen in 2D, but their depth hung off the hip and snapped by
    // ~0.4 m at the gap's edges. Prior = same 2D, the hip's depth; the residual blend carries the real depth offset
    // across the gap.
    for (const [i, out] of abs.entries()) {
      if (!out) continue
      for (const j of [27, 29, 31, 28, 30, 32]) {
        const hip = out[j % 2 ? 23 : 24]
        if (out[j] && hip) prior[i][j] = [out[j]![0], out[j]![1], hip[2]]
      }
    }
    fillGaps(abs, est, prior, filled, [27, 28, 29, 30, 31, 32], fps)
    // Hidden knee with hip and ankle known (rear-oblique: the far knee hides behind the near leg, C4b 255 frames):
    // two-bone IK bending forward and a little out, as a squatting knee does, then residual-blended. (Tried:
    // mirroring the other knee's seen bend. Cross-validated on observed knees it helped C4b, median 6.8 -> 4.1 cm,
    // but hurt C4a 3.5 -> 14.7 cm and C4c 2.9 -> 12.9 cm, so forward stays.)
    for (const [i, out] of abs.entries()) {
      if (!out?.[23] || !out[24]) continue
      const hipLat = unit(add(out[23] as V3, out[24] as V3, -1))
      for (const [k, h, a, side] of [[25, 23, 27, 1], [26, 24, 28, -1]] as const) {
        if (!out[a]) continue
        const pole = unit(add([0, 0, forward], hipLat, side * 0.25))
        prior[i][k] = elbowIK(out[h] as V3, out[a] as V3, L.get(k)!, L.get(a)!, pole)
        if (!out[k]) { out[k] = prior[i][k]!; est[i][k] = true; filled[i].add(k) }
      }
    }
  }
  if (view !== 'side') {
    // Wrists and hands seen in 2D under a hidden elbow: depth hung off the shoulder (C4c: an 18 cm jump the frame
    // the elbow dropped out). Same depth-only correction as the ankles, kept apart from the ball-hold priors.
    const inhPrior: Partial<Record<number, V3>>[] = abs.map((out) => {
      const p: Partial<Record<number, V3>> = {}
      for (let j = 15; j <= 22; j++) {
        const sh = out?.[j % 2 ? 11 : 12]
        if (out?.[j] && sh) p[j] = [out[j]![0], out[j]![1], sh[2]]
      }
      return p
    })
    fillGaps(abs, est, inhPrior, inhFilled, [15, 16, 17, 18, 19, 20, 21, 22], fps)
  }
  fillGaps(abs, est, prior, filled, [25, 26, 15, 16], fps)
  // Elbows last: their IK must reach the wrists as corrected above, or the blended elbow and wrist disagree.
  for (const [i, out] of abs.entries()) {
    if (!out?.[11] || !out[12]) continue
    const lat = unit(add(out[11] as V3, out[12] as V3, -1))
    for (const [w2, e2, sh, side] of [[15, 13, 11, 1], [16, 14, 12, -1]] as const) {
      const wr = out[w2] ?? prior[i][w2]
      if (!wr) continue
      prior[i][e2] = elbowIK(out[sh] as V3, wr as V3, L.get(e2)!, L.get(w2)!, unit(add([0, 1, 0], lat, side * 0.6)))
      if (filled[i].has(e2)) out[e2] = prior[i][e2]!
    }
  }
  fillGaps(abs, est, prior, filled, [13, 14], fps)
  const floorAbs = floorTrack(abs, est, fps)
  const ballZ = ball ? ballDepth(abs, est, ball, fps) : []
  const balls: (Ball3D | null)[] = frames.map(() => null)
  const floor: (number | null)[] = frames.map(() => null)
  const clip: Clip = abs.map((out, i) => {
    if (!out) return null
    const m: World = [(out[23]![0] + out[24]![0]) / 2, (out[23]![1] + out[24]![1]) / 2, 0]
    if (floorAbs[i] !== null) floor[i] = floorAbs[i] - m[1]
    const b = ball?.[i]
    const z = ballZ[i]
    if (b && z != null && !isHandBallEstimate(b, frames[i].kp!)) {
      balls[i] = { p: [b[0] * s - m[0], b[1] * s - m[1], z], r: b[2] * s, held: b[3] === 1 }
    }
    return out.map((p) => (p ? [p[0] - m[0], p[1] - m[1], p[2]] as World : null))
  })
  const px = abs.map((o) => (o ? o.map((p): [number, number] | null => (p ? [p[0] / s, p[1] / s] : null)) : null))
  return { clip, est: abs.map((o, i) => (o ? est[i] : null)), floor, ball: balls, px }
}

/** Use local contacts only: camera motion makes a floor from several seconds later invalid. */
export function floorTrack(abs: Clip, est: boolean[][], fps: number): (number | null)[] {
  const n = abs.length
  const still = PLANTED_M_S / fps
  const contact: (number | null)[] = abs.map((out, i) => {
    if (!out) return null
    let best: number | null = null
    for (const j of FEET) {
      const p = out[j], a = abs[i - 1]?.[j], b = abs[i + 1]?.[j]
      if (!p || !a || !b || est[i - 1][j] || est[i][j] || est[i + 1][j]) continue
      if (Math.max(dist2(a, p), dist2(p, b)) > still) continue
      best = best === null ? p[1] : Math.max(best, p[1])
    }
    return best
  })
  const window = Math.round(FLOOR_WINDOW_S * fps)
  return Array.from({ length: n }, (_, i) => {
    const near = contact.slice(Math.max(0, i - window), i + window + 1).filter((c): c is number => c !== null)
    return near.length ? pct(near, 0.5) : null
  })
}

function ballDepth(abs: Clip, est: boolean[][], ball: (Ball | null)[], fps: number) {
  const z: (number | null)[] = ball.map(() => null)
  for (let start = 0; start < z.length;) {
    if (!ball[start]) { start++; continue }
    let end = start + 1
    while (end < z.length && ball[end]) end++
    const observed = ball.slice(start, end).map((b, j) => {
      const i = start + j
      const pose = abs[i]
      if (b?.[3] !== 1 || !pose) return null
      const wrists = [15, 16].filter((k) => pose[k] && !est[i][k])
      return wrists.length ? [wrists.reduce((sum, k) => sum + pose[k]![2], 0) / wrists.length] : null
    })
    const smoothed = smoothSeries(observed, SIGMA_Z_S * fps)
    const supported = smoothed.map(Boolean)
    const held = repairJoint(smoothed, supported, Math.round(MAX_GAP_S * fps)).v
    const flight = repairJoint(smoothed, supported, Math.round(BALL_FLIGHT_S * fps)).v
    for (let i = start; i < end; i++) {
      z[i] = (ball[i]![3] === 1 ? held : flight)[i - start]?.[0] ?? null
    }
    start = end
  }
  return z
}

/** Residual blending for joints filled from a body prior (IK knees, held-ball arms). The prior's error is known on
 *  the observed frames next to a hidden stretch (observed - prior); it's interpolated across the stretch and added
 *  to the prior, so the filled joint meets the real one exactly at both ends and can't snap on reacquisition (plain
 *  IK knees were 12-33 cm off the observed knee in the worst 10% of frames). With one observed side the correction
 *  fades out over 0.5 s; with none, the prior is used as is. */
export function fillGaps(abs: Clip, est: boolean[][], prior: Partial<Record<number, V3>>[], filled: Set<number>[],
  joints: number[], fps: number) {
  const n = abs.length
  const fade = Math.max(1, Math.round(0.5 * fps))
  const scale = (v: V3, k: number): V3 => [v[0] * k, v[1] * k, v[2] * k]
  for (const j of joints) {
    const res = (i: number): V3 | null => {
      const o = abs[i]?.[j], p = prior[i]?.[j]
      return o && p && !est[i][j] ? add(o as V3, p, -1) : null
    }
    const near = (from: number, step: number) => {
      for (let t = from, k = 0; t >= 0 && t < n && k < 3; t += step, k++) { const r = res(t); if (r) return r }
      return null
    }
    for (let i = 0; i < n;) {
      if (!filled[i].has(j)) { i++; continue }
      let k = i
      while (k < n && filled[k].has(j)) k++
      const left = near(i - 1, -1), right = near(k, 1)
      for (let t = i; t < k; t++) {
        const r: V3 = left && right ? add(left, add(right, left, -1), (t - i + 1) / (k - i + 1))
          : left ? scale(left, Math.max(0, 1 - (t - i + 1) / fade))
            : right ? scale(right, Math.max(0, 1 - (k - t) / fade)) : [0, 0, 0]
        if (abs[t] && prior[t][j]) abs[t]![j] = add(prior[t][j]!, r)
      }
      i = k
    }
  }
}
