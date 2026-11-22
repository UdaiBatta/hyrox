import { Check, CircleHelp, X, type LucideIcon } from 'lucide-react'
import type { RuleStatus, Verdict } from '@/api/types.ts'
import { cn } from 'cn'

// Every verdict = icon + word + colour ("can't judge" also gets stripes), never colour alone.
export const VERDICT: Record<Verdict, { word: string; stamp: string; icon: LucideIcon; text: string; bg: string; border: string }> = {
  proper: { word: 'Proper', stamp: 'REP ✓', icon: Check, text: 'text-proper', bg: 'bg-proper', border: 'border-proper' },
  not_proper: { word: 'No rep', stamp: 'NO REP', icon: X, text: 'text-norep', bg: 'bg-norep', border: 'border-norep' },
  uncertain: { word: "Can't judge", stamp: "CAN'T JUDGE", icon: CircleHelp, text: 'text-uncertain', bg: 'bg-uncertain', border: 'border-uncertain' },
}

const STATUS_VERDICT: Record<RuleStatus, Verdict> = { pass: 'proper', fail: 'not_proper', not_assessable: 'uncertain' }
const STATUS_WORD: Record<RuleStatus, string> = { pass: 'Pass', fail: 'Fail', not_assessable: "Can't judge" }

export function VerdictTag({ verdict, className }: { verdict: Verdict; className?: string }) {
  const v = VERDICT[verdict]
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium', v.text, className)}>
      <v.icon className="size-4" aria-hidden /> {v.word}
    </span>
  )
}

export function StatusTag({ status }: { status: RuleStatus }) {
  const v = VERDICT[STATUS_VERDICT[status]]
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium', v.text)}>
      <v.icon className="size-4" aria-hidden /> {STATUS_WORD[status]}
    </span>
  )
}
