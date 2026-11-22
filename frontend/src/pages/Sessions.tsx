import { CircleAlert, LoaderCircle, Upload, VideoOff } from 'lucide-react'
import { useEffect, useRef, useState, type DragEvent } from 'react'
import { ApiError, api } from '@/api/client.ts'
import type { Status, Video } from '@/api/types.ts'
import { Badge } from '@/components/ui/badge.tsx'
import { Button } from '@/components/ui/button.tsx'
import { cn } from 'cn'
import { Link, navigate } from '@/router.tsx'

const STATUS: Record<Status, { label: string; className: string }> = {
  uploaded: { label: 'Uploaded', className: 'border-border text-muted-foreground' },
  processing: { label: 'Processing', className: 'border-primary/40 text-primary' },
  done: { label: 'Done', className: 'border-proper/40 text-proper' },
  failed: { label: 'Failed', className: 'border-norep/40 text-norep' },
}

const busy = (v: Video) => v.status === 'uploaded' || v.status === 'processing'

/** Turns a DRF 400 body ({"file": ["..."]}) into the server's own sentence. */
function uploadError(e: unknown): string {
  if (e instanceof ApiError) {
    try {
      const body = JSON.parse(e.message) as Record<string, string[]>
      return Object.values(body).flat()[0] ?? 'Upload failed.'
    } catch { /* not JSON */ }
    return e.status === 502 ? 'The analysis server isn\'t running.' : `Upload failed (${e.status}).`
  }
  return 'Upload failed. Check your connection and try again.'
}

export function Sessions() {
  const [videos, setVideos] = useState<Video[] | null>(null)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  // Poll while anything is still processing.
  useEffect(() => {
    let timer = 0
    const load = () => api.list()
      .then((list) => {
        setVideos(list)
        if (list.some(busy)) timer = window.setTimeout(load, 2000)
      })
      .catch((e: unknown) => setError(uploadError(e)))
    void load()
    return () => clearTimeout(timer)
  }, [])

  async function upload(file: File | undefined) {
    if (!file) return
    setError('')
    setUploading(true)
    try {
      const v = await api.upload(file)
      navigate(`/sessions/${v.id}`)
    } catch (e) {
      setError(uploadError(e))
    } finally {
      setUploading(false)
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    void upload(e.dataTransfer.files[0])
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex items-baseline gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Sessions</h1>
        {videos && <span className="text-muted-foreground">{videos.length} total</span>}
      </div>

      <button type="button" onClick={() => input.current?.click()} disabled={uploading}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={onDrop}
        className={cn('mt-8 flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-14 transition-colors',
          'hover:border-primary/60 focus-visible:border-primary focus-visible:outline-none',
          dragging ? 'border-primary bg-primary/5' : 'border-border')}>
        <span className="grid size-12 place-items-center rounded-full bg-secondary">
          {uploading ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : <Upload className="size-5" aria-hidden />}
        </span>
        <span className="text-lg font-medium">{uploading ? 'Uploading…' : 'Drop a wall-ball video or browse'}</span>
        <span className="text-sm text-muted-foreground">MP4 or MOV · up to 500 MB · side-on works best</span>
      </button>
      <input ref={input} type="file" accept="video/mp4,video/quicktime,.mp4,.mov,.m4v" hidden
        onChange={(e) => void upload(e.target.files?.[0])} />

      {error && (
        <div role="alert" className="mt-4 flex gap-3 rounded-xl border border-norep/40 bg-norep/5 p-4">
          <CircleAlert className="mt-0.5 size-5 shrink-0 text-norep" aria-hidden />
          <div>
            <p className="font-medium text-norep">{error}</p>
            <p className="text-sm text-muted-foreground">Upload an MP4 or MOV file under 500 MB.</p>
          </div>
        </div>
      )}

      <h2 className="mt-12 text-lg font-semibold">Recorded sets</h2>
      {videos?.length === 0 && (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border bg-card px-6 py-12 text-center text-muted-foreground">
          <VideoOff className="size-6" aria-hidden />
          No sessions yet. Upload a video above to review your wall balls.
        </div>
      )}
      <ul className="mt-4 space-y-3">
        {videos?.map((v) => (
          <li key={v.id} className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="truncate text-lg font-semibold">{v.title}</h3>
                  <Badge variant="outline" className={STATUS[v.status].className}>
                    {busy(v) && <span className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden />}
                    {STATUS[v.status].label}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {new Date(v.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
              <Button variant="outline" asChild><Link to={`/sessions/${v.id}`}>Open</Link></Button>
            </div>
            {v.status === 'failed' && <p className="mt-3 border-t pt-3 text-sm text-muted-foreground">{v.error}</p>}
            {v.summary && <VerdictBar s={v.summary} />}
          </li>
        ))}
      </ul>
    </main>
  )
}

function VerdictBar({ s }: { s: NonNullable<Video['summary']> }) {
  const parts = [
    { n: s.proper, label: 'proper', bar: 'bg-proper', text: 'text-proper' },
    { n: s.not_proper, label: 'no-rep', bar: 'bg-norep', text: 'text-norep' },
    { n: s.uncertain, label: "can't judge", bar: 'bg-uncertain stripes', text: 'text-uncertain' },
  ]
  return (
    <div className="mt-4">
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <span>{s.total} reps</span>
        <span className="flex gap-4">{parts.map((p) => <span key={p.label} className={p.text}>{p.n} {p.label}</span>)}</span>
      </div>
      {s.total > 0 && (
        <div className="mt-2 flex h-1.5 gap-0.5 overflow-hidden rounded-full" aria-hidden>
          {parts.map((p) => p.n > 0 && <div key={p.label} className={p.bar} style={{ flexGrow: p.n }} />)}
        </div>
      )}
    </div>
  )
}
