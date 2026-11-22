// Self-check for the 3D lift. Run: npm test
import assert from 'node:assert/strict'
import type { Ball, Frame, Kp, World } from '../api/types.ts'
import { isHandBallEstimate } from './skeleton.ts'
import { chooseSigns, elbowIK, liftFromImage, repairJoint, smoothSeries, trackImage } from './smooth3d.ts'

const near = (a: number, b: number, msg: string, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${msg}: ${a} vs ${b}`)

// --- Smoothing and gap repair -------------------------------------------------------------------------------------
const flat = smoothSeries([[1, 2], null, [1, 2]], 2)
assert.deepEqual(flat, [[1, 2], null, [1, 2]], 'constant stays constant, gaps stay gaps')

{
  const v = [[0], [1], [2], [3], [4], [5], [6], [7], [8], [9]]
  const ok = v.map((_, i) => !(i >= 3 && i <= 5))                       // 3-frame gap
  const r = repairJoint(v, ok, 6)
  assert.deepEqual(r.v.slice(3, 6), [[3], [4], [5]], 'short gap: bridged linearly from both sides')
  assert.deepEqual(r.est.slice(2, 7), [false, true, true, true, false], 'and flagged estimated')
  const long = repairJoint(v, v.map((_, i) => !(i >= 1 && i <= 8)), 6)  // 8-frame gap > limit
  assert.ok(long.v.slice(1, 9).every((x) => x === null), 'long gap: left unavailable')
  const open = repairJoint(v, v.map((_, i) => i >= 4), 6)               // starts hidden: no left side
  assert.ok(open.v.slice(0, 4).every((x) => x === null), 'gap off the start of the clip: unavailable')
}

// A person whose left thigh (23 -> 25) swings from flat-to-camera towards the camera. Image: 100 px = 0.4 m.
// The world estimate agrees on length (0.4 m) and says the knee is nearer the camera (z smaller).
const frame = (i: number, thighPx: number): Frame => {
  const kp: Kp[] = Array.from({ length: 33 }, () => [500, 500, 1] as Kp)
  const world: World[] = Array.from({ length: 33 }, () => [0, 0, 0] as World)
  kp[23] = [500, 500, 1]; kp[24] = [500, 500, 1]                       // side-on: hips overlap in the image
  kp[25] = [500 + thighPx, 500, 1]; kp[26] = [500 + thighPx, 500, 1]
  kp[27] = [500 + thighPx, 600, 1]; kp[28] = [500 + thighPx, 600, 1]   // shin straight down, 100 px
  const x = thighPx * 0.004
  const z = -Math.sqrt(Math.max(0, 0.16 - x * x))                     // knee towards the camera when foreshortened
  world[23] = [0, 0, 0.1]; world[24] = [0, 0, -0.1]                    // hip width 0.2 m
  world[25] = [x, 0, 0.1 + z]; world[26] = [x, 0, -0.1 + z]
  world[27] = [x, 0.4, 0.1 + z]; world[28] = [x, 0.4, -0.1 + z]
  return { i, t: i / 30, kp, world }
}

// Low-confidence coordinates must not pull a visible joint: the knee is garbage (+300 px, visibility 0.2) for 3
// frames; the visible frames next to the gap stay on their raw point, the gap is bridged and flagged.
{
  const fs = Array.from({ length: 30 }, (_, i) => frame(i, 100))
  for (const i of [12, 13, 14]) fs[i].kp![25] = [900, 800, 0.2]
  const T = trackImage(fs, 30)
  for (const i of [9, 10, 11, 15, 16, 17]) near(T.pts[i][25]![0], 600, `visible frame ${i} not pulled by the gap`, 0.5)
  for (const i of [12, 13, 14]) {
    near(T.pts[i][25]![0], 600, `gap frame ${i} bridged`, 0.5)
    assert.ok(T.est[i][25], `gap frame ${i} is estimated`)
  }
}

const frames = [...Array.from({ length: 20 }, (_, i) => frame(i, 100)), ...Array.from({ length: 20 }, (_, i) => frame(20 + i, 60))]
const balls = frames.map((_, i): Ball | null => (i === 5 ? [501, 500, 50, 1] : null))
const { clip: out, ball } = liftFromImage(frames, 30, balls)
const f0 = out[5]!
const f1 = out[35]!
near(f0[25]![2] - f0[23]![2], 0, 'thigh flat to the camera: no depth')
near(f1[25]![0] - f1[23]![0], 0.24, 'x comes from the image (60 px at 0.004 m/px)')
near(f1[25]![2] - f1[23]![2], -0.32, 'foreshortened 60% -> depth 0.8 L, towards the camera (facing it)')
near(Math.abs(f0[23]![2] - f0[24]![2]), 0.2, 'side-on hips get their width back as depth')
near(ball[5]!.r, 0.2, 'ball radius in metres (50 px)')
near(ball[5]!.p[2], (f0[15]![2] + f0[16]![2]) / 2, 'held ball sits at the depth of the hands')
assert.equal(ball[6], null, 'no ball where none was found')

// Side-on squat bottom (C1 frame 304): the far (right) leg is hidden and MediaPipe's guess for it is wrong, and the
// torso looks shorter than standing. The far side copies the near one (estimated); the torso stays flat.
const side = (i: number, squat: boolean): Frame => {
  const f = frame(i, 100)
  f.kp![11] = [520, squat ? 330 : 300, 1]; f.kp![12] = [520, squat ? 330 : 300, 0.9]
  f.kp![26] = [560, 520, 0.4]; f.kp![28] = [560, 560, 0.4]
  return f
}
const sideRes = liftFromImage([...Array.from({ length: 10 }, (_, i) => side(i, false)), ...Array.from({ length: 10 }, (_, i) => side(10 + i, true))], 30, undefined, 'side')
const sq = sideRes.clip[15]!
near(sq[26]![0], sq[25]![0], 'far knee x mirrors the near knee')
near(sq[28]![1], sq[27]![1], 'far ankle height mirrors the near ankle')
near((sq[11]![2] + sq[12]![2]) / 2, (sq[23]![2] + sq[24]![2]) / 2, 'torso stays flat to the camera (no fake tip towards it)')
assert.ok(sq[26]![2] > sq[25]![2], 'far side is further from the camera')
assert.ok(sideRes.est[15]![26] && !sideRes.est[15]![25], 'the copied far side is estimated, the near side is not')

// Filmed from behind: a foreshortened thigh points away from the camera (knees forward) even if MediaPipe's depth
// says otherwise; a wide stance stays wide; shoulders over the mid-foot.
const back = (i: number): Frame => {
  const f = frame(i, i < 10 ? 100 : 60)
  f.world![0] = [0, -0.6, 0.15]; f.world![7] = [0.08, -0.6, 0]; f.world![8] = [-0.08, -0.6, 0]
  for (const j of [25, 26, 27, 28]) f.world![j] = [f.world![j][0], f.world![j][1], -Math.abs(f.world![j][2]) - 0.2]
  f.kp![26] = [500 + (i < 10 ? 100 : 60), 500, 1]
  f.kp![25] = [500 - 50, 500, 1]
  return f
}
const bq = liftFromImage(Array.from({ length: 20 }, (_, i) => back(i)), 30).clip[15]!
assert.ok(bq[26]![2] - bq[24]![2] > 0.1, 'from behind, a squatting thigh points away from the camera')
assert.ok(bq[26]![0] - bq[25]![0] > 0.3, 'a wide stance stays wide in 3D')
near((bq[11]![2] + bq[12]![2]) / 2, (bq[27]![2] + bq[28]![2] + bq[31]![2] + bq[32]![2]) / 4, 'shoulders over the mid-foot (balance)')

// Rear-oblique squat: reacquiring a knee must not switch from an estimated pose to an observed one in a frame.
// (Was: the knee stays hidden. Now it's filled from hip + ankle by IK with residual blending, which meets the
// observation at both ends of the gap, so the no-snap requirement is checked directly.)
{
  const f = Array.from({ length: 30 }, (_, i) => back(i))
  for (let i = 5; i < 15; i++) f[i].kp![26][2] = 0.1
  const r = liftFromImage(f, 30)
  const baseline = liftFromImage(Array.from({ length: 30 }, (_, i) => back(i)), 30).clip[15]!
  assert.ok(r.clip.slice(5, 15).every((p, k) => p?.[26] && r.est[5 + k]![26]), 'far knee is filled (estimated) across the gap')
  const step = (a: number, b: number) => Math.hypot(...[0, 1, 2].map((c) => r.clip[a]![26]![c] - r.clip[b]![26]![c]))
  assert.ok(step(4, 5) < 0.03 && step(14, 15) < 0.03, `no snap entering or leaving the gap: ${step(4, 5)}, ${step(14, 15)}`)
  assert.ok(r.clip[14]?.[25] && r.clip[14]?.[27], 'the observed leg stays available')
  assert.ok(r.clip[15]?.[26] && !r.est[15]?.[26], 'the recovered knee uses its own observation')
  near(r.clip[15]![25]![2] - r.clip[15]![23]![2],
    baseline[25]![2] - baseline[23]![2],
    'the other knee has independent depth')
}

// --- Depth direction over the sequence ------------------------------------------------------------------------------
{
  // False reversal: a 0.1 m forearm, the model says "forward" except for 3 frames. The bone must not flip.
  const m = Array(20).fill(0.1)
  const e = m.map((_, t) => (t >= 8 && t <= 10 ? -0.08 : 0.05))
  assert.ok(chooseSigns(m, e).every((s) => s === 1), 'a 3-frame model flip of a long bone is ignored')
  // Genuine change through flat-to-camera: depth shrinks to 0 at t=10 and the model switches there. Kept.
  const m2 = Array.from({ length: 21 }, (_, t) => Math.abs(t - 10) * 0.02)
  const e2 = m2.map((_, t) => (t < 10 ? 0.05 : -0.05))
  const s2 = chooseSigns(m2, e2)
  assert.ok(s2.slice(0, 9).every((s) => s === 1) && s2.slice(11).every((s) => s === -1), 'direction change through flat is kept')
  // Genuine sustained change of a long bone (model insists for 15 frames): kept too.
  const e3 = Array.from({ length: 30 }, (_, t) => (t < 15 ? 0.05 : -0.05))
  const s3 = chooseSigns(Array(30).fill(0.1), e3)
  assert.ok(s3.slice(0, 13).every((s) => s === 1) && s3.slice(17).every((s) => s === -1), 'a sustained change is kept')
}

// --- Grounding ------------------------------------------------------------------------------------------------------
{
  // Standing still, both feet planted (ankles y = 600, toes/heels 610). At frame 12 one toe detection jumps 60 px
  // down; frames 20-29 the right foot lifts. Neither may move the body: the hips' height above the floor stays.
  const stand = (i: number): Frame => {
    const f = frame(i, 100)
    for (const j of [29, 30, 31, 32]) f.kp![j] = [600, 610, 1]
    if (i === 12) f.kp![31] = [600, 670, 1]
    if (i >= 20) for (const j of [28, 30, 32]) f.kp![j] = [600, (j === 28 ? 600 : 610) - 3 * (i - 19), 1]
    return f
  }
  const r = liftFromImage(Array.from({ length: 30 }, (_, i) => stand(i)), 30)
  const hipH = (i: number) => {
    assert.notEqual(r.floor[i], null, 'a planted foot supplies the floor')
    return r.floor[i]! - (r.clip[i]![23]![1] + r.clip[i]![24]![1]) / 2
  }
  for (const i of [11, 12, 13, 22, 26, 29]) near(hipH(i), hipH(5), `frame ${i}: hips stay at the same height above the floor`, 0.005)
}

{
  const fs = Array.from({ length: 75 }, (_, i) => frame(i, 100))
  for (const f of fs.slice(0, 45)) {
    for (const j of [27, 28, 29, 30, 31, 32]) f.kp![j][1] = 811
    for (const j of [15, 16]) f.kp![j][2] = 0.1
  }
  assert.ok(isHandBallEstimate([500, 500, 50, 1], fs[65].kp!), 'a legacy hand midpoint is not a ball sighting')
  assert.ok(!isHandBallEstimate([500, 500, 50, 0], fs[65].kp!), 'a flight sighting is independent of the hand midpoint')
  const ball = fs.map((): Ball => [501, 500, 50, 1])
  ball[64] = [500, 500, 50, 1]
  const result = liftFromImage(fs, 30, ball, 'front', { width: 1000, height: 800 })
  assert.equal(result.clip[6]?.[27], null, 'out-of-frame feet are excluded even with a high score')
  assert.equal(result.floor[6], null, 'later foot contacts cannot supply a floor several seconds earlier')
  assert.equal(result.ball[6], null, 'the ball is hidden until supported by visible wrists')
  assert.equal(result.ball[64], null, 'a hand-only ball marker stays hidden even with visible wrists')
  assert.ok(result.floor[65] !== null && result.ball[65], 'supported floor and ball return')
}

// --- Hidden arms while holding the ball (C4b from behind: both arms under the visibility cutoff every squat) ---
{
  const E = elbowIK([0, 0, 0], [0.2, 0.3, 0.3], 0.3, 0.27, [0, 1, 0])
  near(Math.hypot(...E), 0.3, 'IK keeps the upper-arm length')
  near(Math.hypot(0.2 - E[0], 0.3 - E[1], 0.3 - E[2]), 0.27, 'and the forearm length')
  assert.ok(E[1] > 0, 'and bends towards the pole (down)')

  // Filmed from behind, shoulders and torso seen, arms hidden (visibility 0.1) for the whole clip; left arm seen
  // in the second clip. Real ball sighting at the chest in frame 5 only.
  const holding = (i: number, leftSeen: boolean): Frame => {
    const f = frame(i, 100)
    f.world![0] = [0, -0.6, 0.15]; f.world![7] = [0.08, -0.6, 0]; f.world![8] = [-0.08, -0.6, 0]
    f.kp![11] = [460, 300, 1]; f.kp![12] = [540, 300, 1]
    for (const j of [13, 14, 15, 16, 17, 18, 19, 20, 21, 22]) f.kp![j] = [500, 340, 0.1]
    if (leftSeen) { f.kp![13] = [430, 360, 1]; f.kp![15] = [420, 250, 1] }          // left arm overhead, seen
    return f
  }
  // Held throughout (frame 5 a real circle, the rest the hand midpoint as the tracker stores it); frame 9 in flight.
  const balls = Array.from({ length: 12 }, (_, i): Ball | null => (i === 5 ? [505, 345, 40, 1] : i === 9 ? [500, 100, 40, 0] : [500, 340, 40, 1]))
  const r = liftFromImage(Array.from({ length: 12 }, (_, i) => holding(i, false)), 30, balls)
  const h = r.clip[5]!
  for (const j of [13, 14, 15, 16]) assert.ok(h[j] && r.est[5]![j], `hidden arm joint ${j} is filled and estimated`)
  const shoulderZ = (h[11]![2] + h[12]![2]) / 2
  assert.ok(h[15]![2] > shoulderZ && h[16]![2] > shoulderZ, 'from behind, hands are in front of the chest (away from the camera)')
  assert.ok(h[15]![0] > h[16]![0] === h[11]![0] > h[12]![0], 'left hand on the left side of the ball')
  assert.ok(h[13]![1] > h[11]![1] && h[14]![1] > h[12]![1], 'elbows below the shoulders')
  assert.ok(r.px[5]![15], 'the estimate is available in video pixels for the 2D overlay')
  assert.ok(r.clip[2]![15] && r.est[2]![15], 'held without a ball sighting: standard chest hold')
  assert.equal(r.clip[9]![15], null, 'in flight a hidden hand stays hidden')
  const seen = liftFromImage(Array.from({ length: 12 }, (_, i) => holding(i, true)), 30, balls)
  assert.ok(!seen.est[5]![15] && !seen.est[5]![13], 'an arm the camera sees is kept as observed')
  near(seen.px[5]![15]![0], 420, 'at its observed position', 1)
}

// --- Hidden knee, hip and ankle seen (C4b right leg from behind) ---
{
  const legHidden = (i: number): Frame => {
    const f = frame(i, 100)
    f.world![0] = [0, -0.6, 0.15]; f.world![7] = [0.08, -0.6, 0]; f.world![8] = [-0.08, -0.6, 0]   // from behind
    f.kp![25] = [470, 520, 1]                                       // left knee seen: foreshortened (points forward)
    f.kp![26] = [530, 520, 0.2]                                                                    // right knee hidden
    f.kp![28] = [600, 560, 1]                                                                      // ankle seen, close
    return f
  }
  const r = liftFromImage(Array.from({ length: 10 }, (_, i) => legHidden(i)), 30)
  const q = r.clip[5]!
  assert.ok(q[26] && r.est[5]![26], 'hidden knee is filled from the hip and ankle, and estimated')
  const d = (a: World, b: World) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
  near(d(q[26]!, q[24]!), 0.4, 'thigh keeps its length', 0.02)
  assert.ok(q[26]![2] > q[24]![2], 'from behind, the knee bends forward (away from the camera)')
}

console.log('smooth3d: all checks passed')
