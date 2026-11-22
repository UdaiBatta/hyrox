// Compares the app's reps and verdicts with hand labels.
// Run from the repo root:  node eval/evaluate.ts [eval/labels.csv]
// Labels: one row per rep a person saw (clip, t_bottom in s, verdict proper|not_proper, fault, note).
// A label matches the detected rep whose bottom is within MATCH_S of it.
import { readFileSync } from 'node:fs'

const MATCH_S = 0.5
type Verdict = 'proper' | 'not_proper' | 'uncertain'
interface Label { clip: string; t: number; verdict: Verdict; fault: string }
interface Rep { n: number; t_bottom: number; verdict: Verdict; failed: string[] }

const clips: Record<string, string> = JSON.parse(readFileSync('eval/clips.json', 'utf8'))
const labels: Label[] = readFileSync(process.argv[2] ?? 'eval/labels.csv', 'utf8').trim().split(/\r?\n/).slice(1)
  .map((line) => { const [clip, t, verdict, fault] = line.split(','); return { clip, t: Number(t), verdict: verdict as Verdict, fault } })

const confusion: Record<string, number> = {}
const bump = (k: string) => { confusion[k] = (confusion[k] ?? 0) + 1 }
let missed = 0, extra = 0, faultRight = 0, faultTotal = 0
const rows: string[] = []

for (const [clip, id] of Object.entries(clips)) {
  const reps: Rep[] = JSON.parse(readFileSync(`backend/media/videos/${id}/analysis.json`, 'utf8')).reps
  const mine = labels.filter((l) => l.clip === clip)
  const used = new Set<number>()
  const notes: string[] = []
  for (const l of mine) {
    const r = reps.find((x) => !used.has(x.n) && Math.abs(x.t_bottom - l.t) <= MATCH_S)
    if (!r) { missed++; notes.push(`missed ${l.t}s`); continue }
    used.add(r.n)
    bump(`${l.verdict}→${r.verdict}`)
    if (l.verdict === 'not_proper') { faultTotal++; if (r.failed.includes(l.fault)) faultRight++ }
    if (r.verdict !== 'uncertain' && r.verdict !== l.verdict) notes.push(`rep ${r.n} app ${r.verdict}, label ${l.verdict}`)
  }
  for (const r of reps) if (!used.has(r.n)) { extra++; notes.push(`extra rep ${r.n} at ${r.t_bottom}s`) }
  rows.push(`${clip.padEnd(5)} labels ${String(mine.length).padStart(2)}  app ${String(reps.length).padStart(2)}  ${notes.join('; ')}`)
}

const n = (k: string) => confusion[k] ?? 0
const decided = n('proper→proper') + n('proper→not_proper') + n('not_proper→proper') + n('not_proper→not_proper')
const agree = n('proper→proper') + n('not_proper→not_proper')
const matched = decided + n('proper→uncertain') + n('not_proper→uncertain')

console.log(rows.join('\n'))
console.log(`\nreps: ${labels.length} labelled, ${missed} missed by the app, ${extra} extra`)
console.log('\n                 app: good  no-rep  can\'t judge')
console.log(`label good          ${String(n('proper→proper')).padStart(4)}  ${String(n('proper→not_proper')).padStart(6)}  ${String(n('proper→uncertain')).padStart(11)}`)
console.log(`label no-rep        ${String(n('not_proper→proper')).padStart(4)}  ${String(n('not_proper→not_proper')).padStart(6)}  ${String(n('not_proper→uncertain')).padStart(11)}`)
console.log(`\nverdict agreement: ${agree}/${decided} decided reps (${(100 * agree / decided).toFixed(0)}%); ` +
  `the app decided ${decided}/${matched} matched reps`)
console.log(`no-reps caught with the right rule: ${faultRight}/${faultTotal}`)
