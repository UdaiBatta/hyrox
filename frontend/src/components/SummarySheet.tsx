import { Play, TriangleAlert } from 'lucide-react'
import { RULES } from '@/api/rules.ts'
import type { Analysis } from '@/api/types.ts'
import { Button } from '@/components/ui/button.tsx'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet.tsx'
import { cn } from 'cn'
import { VERDICT } from './verdict.tsx'

const THIRDS = ['First third', 'Middle third', 'Last third']

/** End-of-set summary: only numbers the backend computed, nothing invented. */
export function SummarySheet({ analysis, title, open, onOpenChange, onWatchNoReps }: {
  analysis: Analysis; title: string; open: boolean; onOpenChange: (o: boolean) => void; onWatchNoReps: () => void
}) {
  const s = analysis.summary
  const tempoMax = Math.max(...s.tempo_thirds.map((t) => t ?? 0), 0.1)
  const depthThreshold = analysis.reps.find((r) => r.rules['WB-01']?.threshold != null && !r.rules['WB-01']?.cmp)?.rules['WB-01']?.threshold ?? null
  const tiles = [
    { label: 'Total reps', n: s.total, className: '' },
    { label: VERDICT.proper.word, n: s.proper, className: 'text-proper' },
    { label: VERDICT.not_proper.word, n: s.not_proper, className: 'text-norep' },
    { label: VERDICT.uncertain.word, n: s.uncertain, className: 'text-uncertain' },
  ]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="text-2xl">End-of-set summary</SheetTitle>
          <SheetDescription>{title} · {s.total} reps</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-6">
          <div className="grid grid-cols-4 gap-2">
            {tiles.map((t, i) => (
              <div key={t.label} className={cn('rounded-lg border bg-card p-3', i === 3 && t.n > 0 && 'bg-uncertain/10')}>
                <div className="text-xs text-muted-foreground">{t.label}</div>
                <div className={cn('mt-1 font-display text-4xl leading-none', t.className)}>{t.n}</div>
              </div>
            ))}
          </div>

          {s.most_common_fault && (
            <div className="rounded-lg border bg-card p-4">
              <div className="text-sm text-muted-foreground">Most common fault</div>
              <div className="mt-1 text-lg font-semibold">
                {RULES[s.most_common_fault].name}, {s.fault_counts[s.most_common_fault]} of {s.total} reps
              </div>
            </div>
          )}

          <div className="rounded-lg border bg-card p-4">
            <div className="text-sm font-semibold">Tempo by thirds</div>
            <ul className="mt-3 space-y-2">
              {s.tempo_thirds.map((t, i) => (
                <li key={THIRDS[i]} className="grid grid-cols-[7rem_1fr_6rem] items-center gap-3 text-sm">
                  <span className="text-muted-foreground">{THIRDS[i]}</span>
                  <span className="h-2 rounded-full bg-secondary">
                    {t !== null && <span className="block h-2 rounded-full bg-primary" style={{ width: `${(t / tempoMax) * 100}%` }} />}
                  </span>
                  <span className="text-right font-mono">{t === null ? '—' : `${t.toFixed(1)} s/rep`}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-semibold">Depth by thirds</span>
              {depthThreshold !== null && <span className="text-muted-foreground">needs ≥ {depthThreshold.toFixed(2).replace('-', '−')} L</span>}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {s.depth_thirds.map((d, i) => {
                const ok = d !== null && depthThreshold !== null && d >= depthThreshold
                return (
                  <div key={THIRDS[i]} className="rounded-md bg-secondary p-3">
                    <div className="text-xs text-muted-foreground">{THIRDS[i]}</div>
                    <div className={cn('mt-1 font-mono text-lg', d === null ? '' : ok ? 'text-proper' : 'text-norep')}>
                      {d === null ? '—' : `${d.toFixed(2).replace('-', '−')} L`}
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Average hip height relative to the knee at the bottom. Higher is deeper.</p>
          </div>

          <div className="flex items-center justify-between rounded-lg border bg-card p-4 text-sm">
            <span className="font-semibold">Rest</span>
            <span>{s.pauses === 0 ? 'No breaks' : `${s.pauses} break${s.pauses > 1 ? 's' : ''}, ${Math.round(s.rest_s)} s`}</span>
          </div>

          {s.takeaways.length > 0 && (
            <div className="space-y-3">
              <div className="text-sm font-semibold">Coach's takeaways</div>
              {s.takeaways.map((t) => <p key={t} className="text-lg leading-relaxed">{t}</p>)}
            </div>
          )}

          {analysis.warnings.length > 0 && (
            <ul className="space-y-1 rounded-lg border border-uncertain/40 p-4 text-sm text-muted-foreground">
              {analysis.warnings.map((w) => (
                <li key={w} className="flex gap-2"><TriangleAlert className="mt-0.5 size-4 shrink-0 text-uncertain" aria-hidden />{w}</li>
              ))}
            </ul>
          )}

          <div className="flex gap-2 pt-2">
            {s.not_proper > 0 && <Button onClick={onWatchNoReps}><Play /> Watch the no-reps</Button>}
            <Button variant="outline" onClick={() => onOpenChange(false)}>Back to the video</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
