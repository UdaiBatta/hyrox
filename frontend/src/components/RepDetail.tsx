import { ArrowLeft, ArrowRight, Rewind } from 'lucide-react'
import { RULE_IDS, RULES } from '@/api/rules.ts'
import type { Rep, RuleId, RuleResult } from '@/api/types.ts'
import { Button } from '@/components/ui/button.tsx'
import { StatusTag, VerdictTag } from './verdict.tsx'

function measured(id: RuleId, r: RuleResult): string {
  const { unit = RULES[id].unit, cmp = RULES[id].cmp } = r
  if (r.value === null || r.threshold === null) return '—'
  const fmt = (x: number) => `${x.toFixed(2).replace('-', '−')} ${unit}`.trim()
  return `${fmt(r.value)} · needs ${cmp} ${fmt(r.threshold)}`
}

/** Every rule for one rep: status, measured value vs threshold, and the reason in plain words. */
export function RepDetail({ rep, onPrev, onNext, onReplay }: { rep: Rep; onPrev: () => void; onNext: () => void; onReplay: () => void }) {
  return (
    <section aria-labelledby="rep-detail" className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <h2 id="rep-detail" className="flex items-center gap-3 text-lg font-semibold">
          Rep {rep.n} <VerdictTag verdict={rep.verdict} />
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onPrev}><ArrowLeft /> Previous <kbd className="text-muted-foreground">J</kbd></Button>
          <Button variant="outline" size="sm" onClick={onNext}>Next <kbd className="text-muted-foreground">K</kbd> <ArrowRight /></Button>
          <Button size="sm" onClick={onReplay}><Rewind /> Replay in slow motion</Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-muted-foreground">
            <tr>
              <th className="px-5 py-2 font-medium">Result</th>
              <th className="px-5 py-2 font-medium">Rule</th>
              <th className="px-5 py-2 font-medium">Measured vs needed</th>
              <th className="px-5 py-2 font-medium">Why</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {RULE_IDS.map((id) => {
              const r = rep.rules[id]
              if (!r) {
                return (
                  <tr key={id} className="text-muted-foreground">
                    <td className="px-5 py-3">—</td>
                    <td className="px-5 py-3">{RULES[id].name}</td>
                    <td className="px-5 py-3" colSpan={2}>Not checked on this rep (applies {RULES[id].when})</td>
                  </tr>
                )
              }
              // An optional rule that couldn't be seen doesn't affect the verdict: show it quietly, not as a gap.
              if (r.status === 'not_assessable' && !RULES[id].required) {
                return (
                  <tr key={id} className="text-muted-foreground">
                    <td className="px-5 py-3">—</td>
                    <td className="px-5 py-3">{RULES[id].name}</td>
                    <td className="px-5 py-3">Not seen from this angle</td>
                    <td className="px-5 py-3">{r.reason}. Doesn't affect the verdict.</td>
                  </tr>
                )
              }
              return (
                <tr key={id}>
                  <td className="px-5 py-3"><StatusTag status={r.low_confidence ? 'not_assessable' : r.status} /></td>
                  <td className="px-5 py-3 font-medium">{RULES[id].name}</td>
                  <td className="px-5 py-3 font-mono">{measured(id, r)}</td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {r.reason}
                    {r.low_confidence && <span className="ml-2 rounded border border-uncertain/50 px-1.5 py-0.5 text-xs text-uncertain">too close to call</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
