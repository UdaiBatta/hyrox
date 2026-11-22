// Self-check for the HUD timing logic. Run: npm test   (Node 24 runs TypeScript directly)
import assert from 'node:assert/strict'
import type { Rep } from '../api/types.ts'
import { repStateAt } from './repState.ts'

const rep = (n: number, start: number, bottom: number, release: number, end: number, verdict: Rep['verdict']): Rep =>
  ({ n, start, bottom, release, end, t_bottom: bottom / 30, rules: {}, verdict, failed: [] })
const reps = [rep(1, 10, 40, 60, 70, 'proper'), rep(2, 70, 100, 120, 130, 'not_proper')]
const at = (f: number) => repStateAt(reps, f, 30, 1)

assert.deepEqual([at(0).count, at(0).current, at(0).lastCall, at(0).tint], [0, null, null, null])
assert.equal(at(40).count, 0, 'squat bottom alone is not a rep yet')
assert.equal(at(60).count, 1, 'counter ticks at the throw')
assert.equal(at(59).lastCall, null, 'no call before the release frame')
assert.deepEqual([at(60).lastCall?.n, at(60).stamp, at(60).tint], [1, true, 'proper'], 'call appears at release')
assert.equal(at(90).stamp, false, 'stamp lasts callSeconds (30 frames)')
assert.equal(at(75).tint, null, 'skeleton tint clears when the next rep starts')
assert.equal(at(99).lastCall?.n, 1, 'last call held until next bottom')
assert.equal(at(100).lastCall, null, 'and cleared at the next bottom')
assert.deepEqual([at(500).count, at(500).lastCall?.verdict, at(500).tint], [2, 'not_proper', 'not_proper'])
console.log('repState: all checks passed')
