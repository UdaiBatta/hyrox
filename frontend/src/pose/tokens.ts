import type { Verdict } from '../api/types.ts'

/** Canvas and WebGL can't read CSS variables, so design tokens are resolved from :root when drawing. */
export const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim()

export const verdictToken: Record<Verdict, string> = { proper: 'proper', not_proper: 'norep', uncertain: 'uncertain' }
