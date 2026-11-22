import { ArrowLeft, BarChart3, Box, CircleAlert, Keyboard, TriangleAlert, X } from 'lucide-react'
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '@/api/client.ts'
import type { Analysis, FramesData, Rep, Video } from '@/api/types.ts'
import { Hud } from '@/components/Hud.tsx'
import { PoseVideo } from '@/components/PoseVideo.tsx'
import { RepDetail } from '@/components/RepDetail.tsx'
import { RepStrip } from '@/components/RepStrip.tsx'
import { ShortcutsDialog } from '@/components/ShortcutsDialog.tsx'
import { SummarySheet } from '@/components/SummarySheet.tsx'
import { Badge } from '@/components/ui/badge.tsx'
import { Button } from '@/components/ui/button.tsx'
import { cn } from 'cn'
import { handleVideoKey, videoControls } from '@/pose/controls.ts'
import type { RepState } from '@/pose/repState.ts'
import { liftFromImage } from '@/pose/smooth3d.ts'
import { Link } from '@/router.tsx'

const Skeleton3D = lazy(() => import('@/components/Skeleton3D.tsx'))

/** Polls the video's status, then shows processing, failed, or the analysis. */
export function Session({ id }: { id: string }) {
  const [video, setVideo] = useState<Video | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let timer = 0
    const load = () => api.get(id)
      .then((v) => {
        setVideo(v)
        if (v.status === 'uploaded' || v.status === 'processing') timer = window.setTimeout(load, 1000)
      })
      .catch(() => setError("This session doesn't exist, or the analysis server isn't running."))
    void load()
    return () => clearTimeout(timer)
  }, [id])

  if (error) return <StateCard tone="error" title="Couldn't open this session" text={error} />
  if (!video) return null
  if (video.status === 'failed') return <StateCard tone="error" title="We couldn't analyse this video" text={video.error} />
  if (video.status !== 'done') {
    return <StateCard tone="busy" title="Tracking your reps" text="About a minute per minute of video. You can leave this page; it keeps going." />
  }
  return <AnalysisLoader video={video} />
}

function StateCard({ tone, title, text }: { tone: 'busy' | 'error'; title: string; text: string }) {
  return (
    <main className="mx-auto grid min-h-[60vh] max-w-xl place-items-center px-6">
      <div className="w-full rounded-xl border bg-card p-8 text-center">
        {tone === 'error' && <CircleAlert className="mx-auto size-8 text-norep" aria-hidden />}
        <h1 className="mt-3 text-2xl font-semibold">{title}</h1>
        {tone === 'busy'
          ? <>
              <p className="mt-2 text-muted-foreground">{text}</p>
              <div className="mt-6 h-1 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-label="Processing">
                <div className="h-full w-1/3 animate-[slide_1.4s_ease-in-out_infinite] rounded-full bg-primary" />
              </div>
            </>
          : <p className="mt-4 rounded-lg bg-secondary p-4 text-left font-mono text-sm">{text}</p>}
        <div className="mt-6 flex justify-center gap-2">
          {tone === 'error' && <Button asChild><Link to="/sessions">Try another clip</Link></Button>}
          <Button variant="outline" asChild><Link to="/sessions">Back to sessions</Link></Button>
        </div>
      </div>
    </main>
  )
}

interface Loaded { src: string; frames: FramesData; analysis: Analysis }

function AnalysisLoader({ video }: { video: Video }) {
  const [data, setData] = useState<Loaded | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let src = ''
    Promise.all([api.videoUrl(video.id), api.frames(video.id), api.analysis(video.id)])
      .then(([s, frames, analysis]) => { src = s; setData({ src: s, frames, analysis }) })
      .catch(() => setError('The results could not be loaded.'))
    return () => { if (src.startsWith('blob:')) URL.revokeObjectURL(src) }
  }, [video.id])
  if (error) return <StateCard tone="error" title="Couldn't load the results" text={error} />
  if (!data) return <p className="p-10 text-center text-muted-foreground">Loading video and results…</p>
  return <AnalysisView video={video} {...data} />
}

const SPEEDS = [1, 0.5, 0.25]

function AnalysisView({ video, src, frames, analysis }: { video: Video } & Loaded) {
  const { reps } = analysis
  const view3d = analysis.view === 'side' ? 'side' : 'front'
  // One reconstruction for both views, so the overlay's dashed (estimated) joints match the 3D. Display only.
  const lifted = useMemo(() => liftFromImage(frames.frames, frames.fps, analysis.ball, view3d, frames),
    [frames, analysis.ball, view3d])
  const [el, setEl] = useState<HTMLVideoElement | null>(null)
  const [frame, setFrame] = useState(0)
  const [selected, setSelected] = useState<number | null>(reps[0]?.n ?? null)
  const [summary, setSummary] = useState(false)
  const [shortcuts, setShortcuts] = useState(false)
  const [show3d, setShow3d] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [hideWarnings, setHideWarnings] = useState(false)

  const ctl = el && videoControls(el, frames.fps, frames.n_frames, reps)
  const rep = reps.find((r) => r.n === selected) ?? null

  const onFrame = useCallback((f: number, s: RepState) => {
    setFrame(f)
    if (s.current) setSelected(s.current.n)   // detail follows playback
  }, [])

  // Open the summary when the clip ends; keep playback speed in sync.
  useEffect(() => {
    if (!el) return
    const end = () => setSummary(true)
    el.addEventListener('ended', end)
    return () => el.removeEventListener('ended', end)
  }, [el])
  useEffect(() => { if (el) el.playbackRate = speed }, [el, speed])

  // Page-wide shortcuts. The video's own handler runs first when it has focus and marks the event handled.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement).closest('input, textarea, [role=dialog]')) return
      const page: Record<string, () => void> = { s: () => setSummary(true), '?': () => setShortcuts(true), '3': () => setShow3d((v) => !v) }
      if (page[e.key]) { e.preventDefault(); page[e.key]() } else if (ctl && handleVideoKey(e.key, ctl)) e.preventDefault()
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [ctl])

  const pick = (r: Rep) => { setSelected(r.n); ctl?.seek(r.bottom) }
  const step = (d: 1 | -1) => {
    const i = reps.findIndex((r) => r.n === selected) + d
    if (reps[i]) pick(reps[i])
  }
  const watchNoReps = () => {
    const first = reps.find((r) => r.verdict === 'not_proper')
    setSummary(false)
    if (first && ctl) { setSelected(first.n); setSpeed(0.5); ctl.replaySlow(first) }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-4 px-6 py-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" asChild aria-label="Back to sessions"><Link to="/sessions"><ArrowLeft /></Link></Button>
        <h1 className="text-2xl font-semibold tracking-tight">{video.title}</h1>
        <Badge variant="outline">{analysis.view === 'side' ? 'Side view' : 'Front / back view'}</Badge>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShow3d((v) => !v)} aria-pressed={show3d}><Box /> 3D</Button>
          <Button variant="outline" size="sm" onClick={() => setShortcuts(true)} aria-label="Keyboard shortcuts"><Keyboard /></Button>
          <Button size="sm" onClick={() => setSummary(true)}><BarChart3 /> Summary</Button>
        </div>
      </div>

      {!hideWarnings && analysis.warnings.length > 0 && (
        <div role="note" className="flex gap-3 rounded-xl border border-uncertain/40 bg-uncertain/5 p-4 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-uncertain" aria-hidden />
          <ul className="flex-1 space-y-1">{analysis.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          <button type="button" onClick={() => setHideWarnings(true)} aria-label="Dismiss" className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>
      )}

      <div className={cn('grid gap-4', show3d && 'lg:grid-cols-[1.8fr_1fr]')}>
        <div className="space-y-2">
          <div className="h-[min(70vh,640px)] overflow-hidden rounded-xl border">
            <PoseVideo src={src} frames={frames} reps={reps} view={analysis.view} ball={analysis.ball} estimates={lifted} onFrame={onFrame} onVideo={setEl}>
              {(_f, s) => <Hud s={s} reps={reps} fps={frames.fps} />}
            </PoseVideo>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span className="font-mono">Frame {frame} / {frames.n_frames - 1}</span>
            <div className="flex items-center gap-1" role="group" aria-label="Playback speed">
              {SPEEDS.map((x) => (
                <Button key={x} size="sm" variant={speed === x ? 'secondary' : 'ghost'} onClick={() => setSpeed(x)} aria-pressed={speed === x}>{x}×</Button>
              ))}
            </div>
          </div>
        </div>
        {show3d && (
          <div className="h-[min(70vh,640px)] overflow-hidden rounded-xl border bg-card">
            <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading 3D view…</p>}>
              <Skeleton3D lifted={lifted} hasBall={!!analysis.ball} view={view3d} frame={frame} />
            </Suspense>
          </div>
        )}
      </div>

      {reps.length > 0
        ? <RepStrip reps={reps} current={selected} onPick={pick} />
        : <p className="rounded-xl border bg-card p-6 text-muted-foreground">No reps were detected in this clip.</p>}
      {rep && <RepDetail rep={rep} onPrev={() => step(-1)} onNext={() => step(1)} onReplay={() => ctl?.replaySlow(rep)} />}

      <SummarySheet analysis={analysis} title={video.title} open={summary} onOpenChange={setSummary} onWatchNoReps={watchNoReps} />
      <ShortcutsDialog open={shortcuts} onOpenChange={setShortcuts} />
    </main>
  )
}
