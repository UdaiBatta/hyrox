import type { RuleId } from './types.ts'

// Rule names aren't in the API; keep in sync with backend/analysis/rules.yaml.
// `cmp` is how the measured value must compare to the threshold to pass; `when` says when the rule applies.
// `required: false` rules can only add a no-rep; if they can't be seen, the verdict doesn't change.
export const RULES: Record<RuleId, { name: string; test: string; unit: 'L' | 's' | 'm' | ''; cmp: '≥' | '≤'; when: string; required: boolean }> = {
  'WB-01': { name: 'Squat depth', test: 'Hips below knees', unit: 'L', cmp: '≥', when: 'every rep', required: true },
  'WB-02': { name: 'Start standing tall', test: 'Hips and knees locked out before rep 1', unit: 's', cmp: '≥', when: 'only before rep 1', required: true },
  'WB-03': { name: 'Reset after pick-up', test: 'Stand up fully after picking the ball up', unit: 's', cmp: '≥', when: 'only after a pick-up', required: true },
  'WB-04': { name: 'Two-handed throw', test: 'Both hands on the ball at release', unit: 'L', cmp: '≤', when: 'every rep', required: false },
  'WB-05': { name: 'Ball reaches the target', test: 'Ball peaks at the target height', unit: 'm', cmp: '≥', when: 'every rep, side-on', required: false },
}

export const RULE_IDS = Object.keys(RULES) as RuleId[]
