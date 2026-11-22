import { RULES } from '@/api/rules.ts'
import type { Rep } from '@/api/types.ts'
import type { RepState } from '@/pose/repState.ts'
import { cn } from 'cn'
import { VERDICT } from './verdict.tsx'

/** Scoreboard (top-left) and the single judge's-call stamp (top-right), drawn over the video. */
export function Hud({ s, reps, fps }: { s: RepState; reps: Rep[]; fps: number }) {
  const last = s.count >= 2 ? (reps[s.count - 1].bottom - reps[s.count - 2].bottom) / fps : null
  const call = s.stamp ? s.lastCall : null
  const v = call && VERDICT[call.verdict]
  return (
    <>
      <div className="absolute left-3 top-3 rounded-lg bg-black/70 px-3 py-2 backdrop-blur-sm">
        <div className="font-display text-3xl leading-none tracking-wide">
          {String(s.count).padStart(2, '0')}
          <span className="text-muted-foreground"> / {String(reps.length).padStart(2, '0')}</span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{last ? `${last.toFixed(1)} s per rep` : 'reps'}</div>
      </div>
      {call && v && (
        <div role="status" className={cn('absolute right-3 top-3 rounded-lg px-3 py-2 text-background shadow-lg', v.bg,
          call.verdict === 'uncertain' && 'stripes')}>
          <div className="font-display text-2xl leading-none tracking-wide">{v.stamp}</div>
          {call.verdict === 'not_proper' && call.failed[0] && (
            <div className="mt-1 text-xs font-semibold">{RULES[call.failed[0]].name}</div>
          )}
          {call.verdict === 'uncertain' && <div className="mt-1 text-xs font-semibold">{unsureReason(call)}</div>}
        </div>
      )}
    </>
  )
}

/** Why a rep is "can't judge": hidden from the camera, or measured but too close to the line to call. */
function unsureReason(rep: Rep): string {
  const id = rep.unsure?.[0]
  const r = id && rep.rules[id]
  if (!id || !r) return "Camera couldn't see enough"
  return r.status === 'not_assessable' ? `Couldn't see: ${RULES[id].name}` : `Too close to call: ${RULES[id].name}`
}
