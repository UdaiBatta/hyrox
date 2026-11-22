import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Ball, FramesData, Kp, Rep, View } from '../api/types.ts'
import { handleVideoKey, videoControls } from '../pose/controls.ts'
import { repStateAt, type RepState } from '../pose/repState.ts'
import { drawBall, drawDepthGuide, drawSkeleton, fitContain, inFrame, isHandBallEstimate, LM, LOW_VIS } from '../pose/skeleton.ts'
import type { Lifted } from '../pose/smooth3d.ts'
import { useVideoFrame } from '../pose/useVideoFrame.ts'
import { token, verdictToken } from '../pose/tokens.ts'

interface Props {
  src: string
  frames: FramesData
  reps: Rep[]
  view: View
  /** Ball track from the analysis (optional: older analyses don't have one). */
  ball?: (Ball | null)[]
  /** The 3D reconstruction (optional). Where a joint is hidden in the video and the reconstruction filled it, the
   *  overlay draws that estimate (dashed, faded) instead of MediaPipe's guess, so the 2D and 3D agree. */
  estimates?: Pick<Lifted, 'px' | 'est'>
  /** HUD rendered over the video (counter, judge's call...). Gets the current frame and rep state. */
  children?: (frame: number, state: RepState) => ReactNode
  /** For components outside the video (rep strip, 3D, charts) that follow the same clock. */
  onFrame?: (frame: number, state: RepState) => void
  /** The underlying <video>, for page-level controls (speed, replay, shortcuts). */
  onVideo?: (video: HTMLVideoElement | null) => void
  /** Muted looping autoplay without controls (landing-page demo). */
  demo?: boolean
  className?: string
}

/** Video + skeleton overlay drawn by us, frame-synced to the video. Fills its parent (object-fit: contain),
 *  so the layout decides the size. Keys while focused: Space play/pause, ←/→ one frame, J/K previous/next rep. */
export function PoseVideo({ src, frames, reps, view, ball, estimates, children, onFrame, onVideo, demo = false, className = '' }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [video, setVideo] = useState<HTMLVideoElement | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const frame = useVideoFrame(video, frames.fps, frames.n_frames)
  const state = repStateAt(reps, frame, frames.fps)

  useEffect(() => onVideo?.(video), [video, onVideo])

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => onFrame?.(frame, state), [frame])

  useEffect(() => {
    const c = canvas.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx || !size.w) return
    const dpr = window.devicePixelRatio || 1
    c.width = size.w * dpr
    c.height = size.h * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size.w, size.h)

    const kp = frames.frames[frame]?.kp
    const fit = fitContain(size.w, size.h, frames.width, frames.height)
    const lw = Math.max(2, (frames.height * fit.scale) / 220)
    if (!kp) {
      ctx.fillStyle = token('muted-foreground')
      ctx.font = '13px Archivo, system-ui, sans-serif'
      ctx.fillText('No body detected in this frame', fit.ox + 12, fit.oy + 24)
      return
    }
    ctx.save()
    ctx.beginPath()
    ctx.rect(fit.ox, fit.oy, frames.width * fit.scale, frames.height * fit.scale)
    ctx.clip()
    // Hidden joints: draw the reconstruction's estimate where there is one (still low visibility, so dashed/faded).
    const px = estimates?.px[frame], est = estimates?.est[frame]
    const shown = kp.map((k, j): Kp => (k[2] < LOW_VIS && est?.[j] && px?.[j] ? [px[j]![0], px[j]![1], k[2]] : k))
    drawSkeleton(ctx, shown, fit, token(state.tint ? verdictToken[state.tint] : 'foreground'), lw, frames)
    const b = ball?.[frame]
    if (b && !isHandBallEstimate(b, kp)) drawBall(ctx, b, fit, token('primary'), lw)

    // Depth guide during a rep; it takes the WB-01 colour once the bottom is reached (that's when a judge sees it).
    const rep = state.current
    if (view === 'side' && rep && [LM.lHip, LM.rHip, LM.lKnee, LM.rKnee].every((j) => inFrame(kp[j], frames))) {
      const wb01 = rep.rules['WB-01']
      const judged = frame >= rep.bottom && wb01
      const color = !judged ? token('muted-foreground')
        : wb01.low_confidence || wb01.status === 'not_assessable' ? token('uncertain')
          : token(wb01.status === 'pass' ? 'proper' : 'norep')
      drawDepthGuide(ctx, kp, fit, color, lw)
    }
    ctx.restore()
  }, [frame, size, frames, ball, estimates, view, state.tint, state.current])

  function onKey(e: React.KeyboardEvent) {
    if (video && handleVideoKey(e.key, videoControls(video, frames.fps, frames.n_frames, reps))) e.preventDefault()
  }

  return (
    <div ref={box} tabIndex={demo ? -1 : 0} onKeyDown={demo ? undefined : onKey}
      className={`relative h-full w-full overflow-hidden bg-black outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}>
      <video ref={setVideo} src={src} playsInline muted controls={!demo} autoPlay={demo} loop={demo}
        className="absolute inset-0 h-full w-full object-contain" />
      <canvas ref={canvas} className="pointer-events-none absolute inset-0 h-full w-full" />
      {children && <div className="pointer-events-none absolute inset-0">{children(frame, state)}</div>}
    </div>
  )
}
