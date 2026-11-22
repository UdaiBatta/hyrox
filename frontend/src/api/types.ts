// Mirrors the backend JSON contracts (PRD section 7.1). Update when analysis.json changes.

export type Status = 'uploaded' | 'processing' | 'done' | 'failed'
export type View = 'side' | 'front' | 'unknown'

export interface Video {
  id: string
  title: string
  status: Status
  fps: number | null
  n_frames: number | null
  view: View | ''
  error: string
  created_at: string
  /** Verdict counts; null until the analysis exists. */
  summary: Pick<Summary, 'total' | 'proper' | 'not_proper' | 'uncertain'> | null
}

/** Image keypoint in pixels of the normalised video. */
export type Kp = [x: number, y: number, visibility: number]
/** World landmark in metres, hip-centred, y points DOWN. */
export type World = [x: number, y: number, z: number]

export interface Frame {
  i: number
  t: number
  kp: Kp[] | null // 33 MediaPipe landmarks, null when no pose was found
  world: World[] | null
}

export interface FramesData {
  fps: number
  width: number
  height: number
  n_frames: number
  frames: Frame[]
}

export type RuleId = 'WB-01' | 'WB-02' | 'WB-03' | 'WB-04' | 'WB-05'
export type RuleStatus = 'pass' | 'fail' | 'not_assessable'
export type Verdict = 'proper' | 'not_proper' | 'uncertain'

export interface RuleResult {
  status: RuleStatus
  low_confidence: boolean
  value: number | null
  threshold: number | null
  reason: string
  /** Set when a rule measured something other than its usual quantity (WB-01 from the front or behind). */
  cmp?: '≥' | '≤'
  unit?: string
}

export interface Rep {
  n: number
  start: number // frame indices
  bottom: number
  release: number
  end: number
  t_bottom: number
  rules: Partial<Record<RuleId, RuleResult>>
  verdict: Verdict
  failed: RuleId[]
  /** Required rules that made the rep uncertain (can't see it, or too close to call). */
  unsure?: RuleId[]
}

export interface Summary {
  total: number
  proper: number
  not_proper: number
  uncertain: number
  fault_counts: Partial<Record<RuleId, number>>
  most_common_fault: RuleId | null
  cycle_times: number[]
  tempo_thirds: (number | null)[]
  depth_thirds: (number | null)[]
  pauses: number
  rest_s: number
  takeaways: string[]
}

export interface Analysis {
  view: View
  fps: number
  n_frames: number
  reps: Rep[]
  ignored_dips: { frame: number; reason: string }[]
  summary: Summary
  warnings: string[]
  /** Ball per frame: centre and radius in pixels; state 1 = held, 0 = seen in flight, 2 = in flight placed by the
   *  gravity fit (y < 0: above the frame); null when unknown. */
  ball?: (Ball | null)[]
}

export type Ball = [x: number, y: number, r: number, state: 0 | 1 | 2]
