import { ArrowRight, Camera, ChevronRight, EyeOff, ListChecks, Target, Upload, Video } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from 'cn'
import { loadDemo } from '@/api/client.ts'
import { RULE_IDS, RULES } from '@/api/rules.ts'
import type { RuleId } from '@/api/types.ts'
import { Hud } from '@/components/Hud.tsx'
import { PoseVideo } from '@/components/PoseVideo.tsx'
import { Button } from '@/components/ui/button.tsx'
import { CloudShader } from '@/components/ui/cloud-shader.tsx'
import { Link } from '@/router.tsx'

type Demo = Awaited<ReturnType<typeof loadDemo>>

const STEPS = [
  { icon: Camera, title: 'Film side-on', text: 'Phone in portrait, lens at hip height, whole body and the target in frame.', visual: <FramingVisual /> },
  { icon: Upload, title: 'Upload', text: 'About a minute of processing per minute of video. You can leave the page while it runs.', visual: <ProcessingVisual /> },
  { icon: ListChecks, title: 'Review every rep', text: "The judge's call on every rep, each fault in slow motion, and a coaching summary.", visual: <RepsVisual /> },
]

const STATS = [
  ['33', 'body points tracked in every frame'],
  ['5', 'rules from the official rulebook'],
  ['1', 'file holds every threshold, each with its source'],
  ['0', 'black-box verdicts: every call is a rule you can read'],
] as const

// How each rule is measured. Keep in sync with backend/analysis/rules.yaml.
const MEASURE: Record<RuleId, string> = {
  'WB-01': 'visible hip and knee at the squat bottom · side-on',
  'WB-02': 'hips + knees ≥ 160° for 0.2 s before rep 1',
  'WB-03': 'wrists below knees → stand tall again first',
  'WB-04': 'both wrists above nose, ≤ 0.6 leg lengths apart',
  'WB-05': 'ball tracked; peak ≥ 3.00 m (men) / 2.70 m (women) · side-on',
}

const LIMITS = [
  { icon: Video, title: 'Front or back video', text: 'Depth needs the hip and knee seen from the side. From the front or behind only clearly deep reps can be confirmed; anything closer is "can\'t judge", never a no-rep.' },
  { icon: Target, title: 'Ball hitting the target', text: "The ball's height is measured side-on (its size and gravity as two rulers). Left-right aim isn't, and a throw the camera can't follow is \"can't judge\"." },
  { icon: EyeOff, title: 'Hidden limbs', text: 'If a wrist or knee is hidden at the moment that matters, the rep is marked "can\'t judge" instead of guessed.' },
]

// The movement standard, crawling like a scoreboard ticker (2025/26 rulebook, section 9.8).
const TICKER = ['Hips below knees', 'Start standing tall', 'Both hands on the ball', 'Target 3.00 m men · 2.70 m women',
  'Ball 6 kg men · 4 kg women', 'Missed target = no rep', 'No warnings: every no-rep is called']

const PIPELINE = [
  ['Your video', 'side-on clip', false], ['Body points', "Google's MediaPipe", false], ['Overlay', 'drawn frame by frame', true],
  ['Rep detection', 'from hip movement', true], ['Rules', 'from the rulebook', true], ['Verdict + summary', 'per rep, per set', true],
] as const

export function Landing() {
  const [demo, setDemo] = useState<Demo | null>(null)
  useEffect(() => { void loadDemo().then(setDemo) }, [])

  return (
    <main>
      {/* Hero: dark drifting clouds behind it, like haze under arena floodlights */}
      <CloudShader className="min-h-0 border-b" count={5} speed={0.8}
        cloudColor="#232b36" skyTopColor="#141a22" skyBottomColor="#0a0c0f">
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <h1 className="font-display text-5xl leading-[1.05] tracking-wide sm:text-6xl">KNOW WHICH<br />REPS COUNT.</h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Upload a side-on video of your wall balls. Every rep is judged against the published movement standard —
            with the reason for every no-rep.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" asChild><Link to="/sessions">Analyse a set <ArrowRight /></Link></Button>
            <Button size="lg" variant="secondary" asChild><a href="/sessions/mock?mock=1">See an example</a></Button>
          </div>
        </div>
        <figure className="mx-auto w-full max-w-md">
          <div className="aspect-[5/6] overflow-hidden rounded-xl border bg-card">
            {demo && (
              <PoseVideo demo src={demo.src} frames={demo.frames} reps={demo.analysis.reps} view={demo.analysis.view}>
                {(_f, s) => <Hud s={s} reps={demo.analysis.reps} fps={demo.frames.fps} />}
              </PoseVideo>
            )}
          </div>
          <figcaption className="mt-2 text-center text-xs text-muted-foreground">
            Live demo on a synthetic clip: our overlay, counter and judge's calls.
          </figcaption>
        </figure>
      </section>
      <Ticker />
      </CloudShader>

      {/* Numbers band */}
      <section aria-label="In numbers" className="border-b">
        <dl className="mx-auto grid max-w-7xl grid-cols-2 lg:grid-cols-4">
          {STATS.map(([n, label], i) => (
            <div key={label} className={cn('reveal px-6 py-8', i % 2 && 'border-l', i >= 2 && 'border-t lg:border-t-0', i === 2 && 'lg:border-l')}>
              <dt className="sr-only">{label}</dt>
              <dd className="font-display text-5xl text-foreground sm:text-6xl">{n}</dd>
              <dd className="mt-2 max-w-48 text-sm text-muted-foreground">{label}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* How it works */}
      <section id="how" className="grid-bg scroll-mt-20">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <SectionHead n="01" kicker="How it works" title="Film. Upload. Get judged." />
          <ol className="mt-12 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="reveal group relative overflow-hidden rounded-xl border bg-card/80 p-6 backdrop-blur transition-colors hover:border-primary/50">
                <span aria-hidden className="outline-num pointer-events-none absolute -top-4 right-3 font-display text-8xl">0{i + 1}</span>
                <s.icon className="size-5 text-primary" aria-hidden />
                <h3 className="mt-4 text-2xl font-extrabold uppercase font-stretch-condensed">{s.title}</h3>
                <p className="mt-2 text-muted-foreground">{s.text}</p>
                <div className="mt-6 rounded-lg border bg-background/60 p-4">{s.visual}</div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Rules */}
      <section id="rules" className="scroll-mt-20 border-y bg-card/40">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <SectionHead n="02" kicker="The rules" title="The judge's card."
            aside="Written from the 2025/26 rulebook, section 9.8. Every threshold lives in one file." />
          <div className="mt-12 grid gap-6 lg:grid-cols-[1fr_340px]">
            <ul className="divide-y overflow-hidden rounded-xl border bg-card">
              {RULE_IDS.map((id) => (
                <li key={id} className="reveal grid gap-x-6 gap-y-2 p-5 sm:grid-cols-[88px_1fr_auto] sm:items-center">
                  <span className="w-fit rounded-md bg-primary/10 px-2 py-1 font-mono text-xs font-medium text-primary">{id}</span>
                  <div>
                    <div className="text-lg font-extrabold uppercase font-stretch-condensed">{RULES[id].name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{MEASURE[id]}</div>
                  </div>
                  <span className="text-sm text-muted-foreground sm:text-right">{RULES[id].when}</span>
                </li>
              ))}
            </ul>
            <figure className="reveal rounded-xl border bg-card p-5">
              <DepthDiagram />
              <figcaption className="mt-3 text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">How depth is called.</span> The overlay draws a line through
                the knee; the hip has to drop through it. Measured in the athlete's own leg lengths, so height and
                camera distance cancel out.
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* Limits */}
      <section id="limits" className="mx-auto max-w-7xl scroll-mt-20 px-6 py-24">
        <SectionHead n="03" kicker="Limits" title="One camera can't judge everything." />
        <div className="reveal mt-12 overflow-hidden rounded-xl border border-uncertain/40 bg-card">
          <div aria-hidden className="stripes h-2 bg-uncertain" />
          <div className="grid md:grid-cols-3 md:divide-x">
            {LIMITS.map((l) => (
              <div key={l.title} className="border-t p-6 first:border-t-0 md:border-t-0">
                <div className="flex items-center justify-between">
                  <l.icon className="size-5 text-uncertain" aria-hidden />
                  <span className="rounded bg-uncertain px-2 py-0.5 font-display text-xs text-black">CAN'T JUDGE</span>
                </div>
                <h3 className="mt-4 text-xl font-extrabold uppercase font-stretch-condensed">{l.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{l.text}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t bg-background/40 px-6 py-4 text-sm">
            <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary">NEXT</span>
            <span className="text-muted-foreground">Wearable motion and muscle sensors fill these gaps: a thigh sensor measures depth from any angle.</span>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="grid-bg scroll-mt-20 border-t">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <SectionHead n="04" kicker="About" title="Built from scratch, not a template." />
          <p className="reveal mt-6 max-w-3xl text-lg text-muted-foreground">
            The overlay you see on the video is ours. An open-source pose model (Google's MediaPipe) finds 33 body points
            in each frame; everything after that is built here: the skeleton drawn frame by frame in sync with the video,
            the knee-line depth guide, rep detection from hip movement, the rule checks written from the rulebook, and the
            coaching summary. <span className="text-foreground">No AI model decides your verdicts. Every call comes from a
            rule you can read.</span>
          </p>
          <ol className="mt-12 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {PIPELINE.map(([title, sub, ours], i) => (
              <li key={title} className={cn('reveal relative rounded-xl border p-4',
                ours ? 'border-primary/40 bg-primary/5' : 'bg-background/80',
                i === PIPELINE.length - 1 && 'border-proper/50 bg-proper/5')}>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {String(i + 1).padStart(2, '0')} · {ours ? <span className="text-primary">built here</span> : 'input'}
                </div>
                <div className={cn('mt-2 font-extrabold uppercase font-stretch-condensed', i === PIPELINE.length - 1 && 'text-proper')}>{title}</div>
                <div className="mt-1 text-sm text-muted-foreground">{sub}</div>
                {i < PIPELINE.length - 1 && (
                  <ChevronRight aria-hidden className="absolute -right-3 top-1/2 z-10 hidden size-4 -translate-y-1/2 rounded-full bg-background text-muted-foreground lg:block" />
                )}
              </li>
            ))}
          </ol>
        </div>
      </section>
    </main>
  )
}

function SectionHead({ n, kicker, title, aside }: { n: string; kicker: string; title: string; aside?: string }) {
  return (
    <div className="reveal flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-primary">{n} — {kicker}</p>
        <h2 className="mt-3 text-4xl leading-[0.9] font-extrabold uppercase font-stretch-condensed sm:text-6xl">{title}</h2>
      </div>
      {aside && <p className="max-w-xs text-sm text-muted-foreground">{aside}</p>}
    </div>
  )
}

/** Side-on squat at the bottom: knee line dashed, hip ring below it. Same marks as the video overlay. */
function DepthDiagram() {
  return (
    <svg viewBox="0 0 300 220" role="img" aria-label="Side-on squat: the hip sits below the dashed line through the knee"
      className="w-full" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <line x1="10" y1="200" x2="290" y2="200" stroke="var(--border)" strokeWidth="2" />
      <line x1="30" y1="140" x2="270" y2="140" stroke="var(--proper)" strokeWidth="2" strokeDasharray="6 6" />
      <text x="270" y="132" textAnchor="end" fill="var(--proper)" fontSize="11" fontFamily="IBM Plex Mono">knee line</text>
      {/* facing right: ankle, knee forward over the toes, hip back and below the knee line, torso leaning in */}
      <g stroke="var(--foreground)" strokeWidth="5">
        <path d="M232 198 L176 198" />
        <path d="M176 198 L208 140" />
        <path d="M208 140 L122 154" />
        <path d="M122 154 L160 74" />
        <path d="M160 74 L186 104 L200 96" />
      </g>
      <circle cx="170" cy="46" r="15" stroke="var(--foreground)" strokeWidth="5" />
      <circle cx="210" cy="88" r="19" fill="var(--muted)" stroke="var(--muted-foreground)" strokeWidth="2" />
      <circle cx="122" cy="154" r="11" stroke="var(--proper)" strokeWidth="3" />
      <g fill="var(--foreground)"><circle cx="208" cy="140" r="5" /><circle cx="176" cy="198" r="5" /><circle cx="122" cy="154" r="5" /></g>
      
      <text x="122" y="184" textAnchor="middle" fill="var(--proper)" fontSize="11" fontFamily="IBM Plex Mono">hip below</text>
    </svg>
  )
}

/** Phone at hip height, 3.5–4 m from the athlete, side-on. */
function FramingVisual() {
  return (
    <svg viewBox="0 0 260 90" role="img" aria-label="Phone at hip height, 3.5 to 4 metres from the athlete, side-on" className="w-full"
      fill="none" strokeLinecap="round">
      <line x1="0" y1="80" x2="260" y2="80" stroke="var(--border)" strokeWidth="2" />
      <rect x="14" y="34" width="12" height="22" rx="2" stroke="var(--primary)" strokeWidth="2" />
      <line x1="26" y1="45" x2="200" y2="45" stroke="var(--primary)" strokeWidth="1.5" strokeDasharray="4 4" />
      <g stroke="var(--foreground)" strokeWidth="3">
        <circle cx="215" cy="14" r="6" /><path d="M215 20 L215 48 M215 48 L208 79 M215 48 L222 79 M215 28 L226 38" />
      </g>
      <path d="M20 70 L215 70" stroke="var(--muted-foreground)" strokeWidth="1" />
      <text x="118" y="66" textAnchor="middle" fill="var(--muted-foreground)" fontSize="10" fontFamily="IBM Plex Mono">3.5–4 m · lens at hip</text>
    </svg>
  )
}

function ProcessingVisual() {
  return (
    <div className="space-y-2 font-mono text-xs" aria-hidden>
      {['Tracking 33 points / frame', 'Finding reps', 'Judging each rep'].map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <span className={cn('size-1.5 rounded-full', i < 2 ? 'bg-proper' : 'animate-pulse bg-primary')} />
          <span className={i < 2 ? 'text-muted-foreground' : 'text-foreground'}>{s}</span>
        </div>
      ))}
      <div className="h-1 overflow-hidden rounded-full bg-secondary">
        <div className="h-full w-1/3 bg-primary motion-safe:animate-[slide_1.6s_ease-in-out_infinite]" />
      </div>
    </div>
  )
}

const STRIP = ['proper', 'proper', 'norep', 'proper', 'proper', 'uncertain', 'proper', 'proper'] as const

function RepsVisual() {
  return (
    <div aria-hidden>
      <div className="flex items-baseline justify-between">
        <span className="font-display text-2xl">07 <span className="text-muted-foreground">/ 08</span></span>
        <span className="rounded bg-norep px-1.5 py-0.5 font-display text-[10px] text-white">NO REP · DEPTH</span>
      </div>
      <div className="mt-3 flex gap-1">
        {STRIP.map((v, i) => (
          <span key={i} className={cn('h-6 flex-1 rounded-sm', v === 'proper' && 'bg-proper/80', v === 'norep' && 'bg-norep',
            v === 'uncertain' && 'stripes bg-uncertain')} />
        ))}
      </div>
    </div>
  )
}

function Ticker() {
  const line = TICKER.map((t) => <span key={t} className="flex items-center gap-6">{t}<span className="size-1.5 bg-norep" /></span>)
  return (
    <div className="border-t border-border/60 bg-background/60 py-3 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground backdrop-blur-sm">
      <p className="sr-only">{TICKER.join('. ')}</p>
      <div aria-hidden className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_8%,#000_92%,transparent)]">
        <div className="ticker flex w-max gap-6">
          <div className="flex gap-6">{line}</div>
          <div className="flex gap-6">{line}</div>
        </div>
      </div>
    </div>
  )
}
