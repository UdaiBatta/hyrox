import { useEffect, useRef, useState } from 'react'

const GLYPHS = 'ABCDEFGHJKLMNPRSTUVXYZ0123456789#'
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** A label that flickers through scoreboard glyphs and settles left to right (~0.3 s) when hovered or focused.
 *  The real label is laid out invisibly underneath so the width never changes; screen readers get the label once. */
export function Scramble({ text }: { text: string }) {
  const [shown, setShown] = useState(text)
  const timer = useRef(0)
  useEffect(() => () => clearInterval(timer.current), [])

  const run = () => {
    if (reduced()) return
    clearInterval(timer.current)
    let frame = 0
    const total = text.length + 4
    timer.current = window.setInterval(() => {
      frame++
      const settled = Math.floor((frame / total) * text.length)
      if (frame >= total) { clearInterval(timer.current); setShown(text); return }
      setShown([...text].map((c, i) => (i < settled || c === ' ' ? c : GLYPHS[Math.floor(Math.random() * GLYPHS.length)])).join(''))
    }, 32)
  }

  return (
    <span className="relative inline-block" onPointerEnter={run} onFocus={run}>
      <span className="invisible">{text}</span>
      <span aria-hidden className="absolute inset-0 whitespace-nowrap">{shown}</span>
      <span className="sr-only">{text}</span>
    </span>
  )
}
