import type { Rep, Verdict } from '../api/types.ts'

export interface RepState {
  /** Reps completed: the throw (release) ends the rep, as a judge counts it. */
  count: number
  /** Rep in progress (start..end), if any. */
  current: Rep | null
  /** Most recent judged rep (its release frame has passed), held until the next rep's bottom. */
  lastCall: Rep | null
  /** True for the first `callSeconds` after the release: show the big "REP / NO REP" stamp. */
  stamp: boolean
  /** Verdict colour for the skeleton: from the call until the next rep starts. */
  tint: Verdict | null
}

/** What the HUD should show at a given frame. Reps must be in order (as the API returns them). */
export function repStateAt(reps: Rep[], frame: number, fps: number, callSeconds = 1.2): RepState {
  let count = 0
  let current: Rep | null = null
  let lastIdx = -1
  reps.forEach((r, i) => {
    if (r.release <= frame) count++
    if (r.start <= frame && frame <= r.end) current = r
    if (r.release <= frame) lastIdx = i
  })
  const last = lastIdx >= 0 ? reps[lastIdx] : null
  const next = reps[lastIdx + 1]
  const held = last !== null && (!next || frame < next.bottom)
  return {
    count,
    current,
    lastCall: held ? last : null,
    stamp: held && frame - last.release < callSeconds * fps,
    tint: last && (!next || frame < next.start) ? last.verdict : null,
  }
}
