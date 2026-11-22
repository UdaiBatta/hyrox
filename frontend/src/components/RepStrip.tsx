import type { Rep } from '@/api/types.ts'
import { RULES } from '@/api/rules.ts'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.tsx'
import { cn } from 'cn'
import { VERDICT } from './verdict.tsx'

/** One block per rep, coloured by verdict; click jumps to that rep's squat bottom. */
export function RepStrip({ reps, current, onPick }: { reps: Rep[]; current: number | null; onPick: (r: Rep) => void }) {
  return (
    <ol className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.max(reps.length, 1)}, minmax(0, 1fr))` }}>
      {reps.map((r) => {
        const v = VERDICT[r.verdict]
        const why = r.verdict === 'not_proper' ? ` · ${RULES[r.failed[0]].name}` : ''
        return (
          <li key={r.n}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" onClick={() => onPick(r)} aria-current={current === r.n ? 'step' : undefined}
                  aria-label={`Rep ${r.n}: ${v.word}${why}`}
                  className={cn('flex h-14 w-full flex-col items-center justify-center rounded-md border bg-card transition-colors hover:bg-accent',
                    'aria-[current=step]:border-primary aria-[current=step]:ring-1 aria-[current=step]:ring-primary')}>
                  <span className="font-mono text-sm">{String(r.n).padStart(2, '0')}</span>
                  <span className={cn('mt-1 h-1 w-6 rounded-full', v.bg, r.verdict === 'uncertain' && 'stripes')} aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent>Rep {r.n} · {v.word}{why}</TooltipContent>
            </Tooltip>
          </li>
        )
      })}
    </ol>
  )
}
