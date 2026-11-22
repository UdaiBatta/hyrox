import type { Ball, FramesData, Kp } from '../api/types.ts'

// MediaPipe Pose landmark indices used for drawing and guides.
export const LM = {
  nose: 0, lShoulder: 11, rShoulder: 12, lWrist: 15, rWrist: 16,
  lHip: 23, rHip: 24, lKnee: 25, rKnee: 26, lAnkle: 27, rAnkle: 28,
} as const

/** Body connections (face mesh points 1-10 left out on purpose: they add clutter, not information). */
export const BONES: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [15, 17], [15, 19], [15, 21], [17, 19], [16, 18], [16, 20], [16, 22], [18, 20],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [24, 26], [25, 27], [26, 28],
  [27, 29], [29, 31], [27, 31], [28, 30], [30, 32], [28, 32],
]
export const JOINTS = [0, ...Array.from({ length: 22 }, (_, i) => i + 11)]

/** Joints below this visibility are drawn faded and dashed: uncertainty made visible. */
export const LOW_VIS = 0.5

export type FrameBounds = Pick<FramesData, 'width' | 'height'>

export const inFrame = ([x, y]: Kp, { width, height }: FrameBounds) =>
  x >= 0 && x < width && y >= 0 && y < height

export function isHandBallEstimate(ball: Ball, kp: Kp[]) {
  if (ball[3] !== 1) return false
  // shortcut: cached held-ball points lack provenance, add it when changing the ball track format
  const hands = kp.slice(15, 23)
  return [0, 1].every((axis) =>
    Math.abs(ball[axis] - hands.reduce((sum, p) => sum + p[axis], 0) / hands.length) <= 0.050001)
}

/** Where a w x h video lands inside a cw x ch box with object-fit: contain. */
export interface Fit { scale: number; ox: number; oy: number }
export function fitContain(cw: number, ch: number, w: number, h: number): Fit {
  const scale = Math.min(cw / w, ch / h)
  return { scale, ox: (cw - w * scale) / 2, oy: (ch - h * scale) / 2 }
}

const px = (fit: Fit, p: Kp): [number, number] => [fit.ox + p[0] * fit.scale, fit.oy + p[1] * fit.scale]

export function drawSkeleton(ctx: CanvasRenderingContext2D, kp: Kp[], fit: Fit, color: string, lineWidth: number, bounds: FrameBounds) {
  ctx.lineCap = 'round'
  ctx.strokeStyle = color
  ctx.fillStyle = color
  for (const [a, b] of BONES) {
    if (!inFrame(kp[a], bounds) || !inFrame(kp[b], bounds)) continue
    const low = Math.min(kp[a][2], kp[b][2]) < LOW_VIS
    ctx.globalAlpha = low ? 0.35 : 0.95
    ctx.setLineDash(low ? [lineWidth * 1.5, lineWidth * 1.5] : [])
    ctx.lineWidth = lineWidth
    ctx.beginPath()
    ctx.moveTo(...px(fit, kp[a]))
    ctx.lineTo(...px(fit, kp[b]))
    ctx.stroke()
  }
  ctx.setLineDash([])
  for (const j of JOINTS) {
    if (!inFrame(kp[j], bounds)) continue
    ctx.globalAlpha = kp[j][2] < LOW_VIS ? 0.35 : 1
    ctx.beginPath()
    ctx.arc(...px(fit, kp[j]), lineWidth * (j === LM.nose ? 1.6 : 1.1), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

const mid = (a: Kp, b: Kp): Kp => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.min(a[2], b[2])]

/** Judge's view of squat depth: a dashed line at knee height and a marker on the hip.
 *  Hip below the line = deep enough. Uses the same left/right average as the backend rule. */
/** The ball: a ring in the brand colour. Solid when held, dashed when seen in flight, dotted where the gravity fit
 *  places it (not seen in that frame). Above the frame: an arrow on the top edge instead. */
export function drawBall(ctx: CanvasRenderingContext2D, b: Ball, fit: Fit, color: string, lineWidth: number) {
  const [x, y] = px(fit, [b[0], b[1], 1])
  const r = b[2] * fit.scale
  const top = fit.oy
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = lineWidth
  ctx.font = `600 ${Math.max(10, lineWidth * 5)}px "IBM Plex Mono", ui-monospace, monospace`
  ctx.textAlign = 'center'
  if (y + r < top) {
    const s = lineWidth * 4
    ctx.beginPath()
    ctx.moveTo(x, top + 4)
    ctx.lineTo(x - s, top + 4 + s * 1.4)
    ctx.lineTo(x + s, top + 4 + s * 1.4)
    ctx.closePath()
    ctx.fill()
    ctx.fillText('BALL ABOVE FRAME', x, top + 4 + s * 1.4 + lineWidth * 6)
    ctx.textAlign = 'start'
    return
  }
  ctx.setLineDash(b[3] === 1 ? [] : b[3] === 0 ? [lineWidth * 2, lineWidth * 1.5] : [lineWidth * 0.5, lineWidth * 1.5])
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])
  const label = b[3] === 1 ? 'BALL' : b[3] === 0 ? 'BALL · IN FLIGHT' : 'BALL · ESTIMATED'
  ctx.fillText(label, x, Math.max(top + lineWidth * 6, y - r - lineWidth * 2))
  ctx.textAlign = 'start'
}

export function drawDepthGuide(ctx: CanvasRenderingContext2D, kp: Kp[], fit: Fit, color: string, lineWidth: number) {
  const hip = px(fit, mid(kp[LM.lHip], kp[LM.rHip]))
  const knee = px(fit, mid(kp[LM.lKnee], kp[LM.rKnee]))
  const reach = 120 * fit.scale + lineWidth * 20
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = Math.max(1, lineWidth * 0.6)
  ctx.setLineDash([lineWidth * 2, lineWidth * 1.5])
  ctx.beginPath()
  ctx.moveTo(Math.min(hip[0], knee[0]) - reach, knee[1])
  ctx.lineTo(Math.max(hip[0], knee[0]) + reach, knee[1])
  ctx.stroke()
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.arc(hip[0], hip[1], lineWidth * 2.2, 0, Math.PI * 2)
  ctx.lineWidth = lineWidth
  ctx.stroke()
}
