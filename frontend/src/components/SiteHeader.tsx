import { Scramble } from '@/components/Scramble.tsx'
import { Button } from '@/components/ui/button.tsx'
import { Link } from '@/router.tsx'

const NAV = [
  ['How it works', '/#how'], ['The rules', '/#rules'], ['Limits', '/#limits'], ['About', '/#about'], ['Sessions', '/sessions'],
] as const

export function SiteHeader({ path }: { path: string }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-8 px-6">
        <Link to="/" className="font-semibold tracking-tight">Wall Ball Form Check</Link>
        <nav className="hidden flex-1 justify-center gap-7 text-sm text-muted-foreground md:flex">
          {NAV.map(([label, to]) => (
            <Link key={to} to={to} aria-current={path.startsWith('/sessions') && to === '/sessions' ? 'page' : undefined}
              className="font-mono text-xs uppercase tracking-wider transition-colors hover:text-foreground aria-[current=page]:text-foreground">
              <Scramble text={label} />
            </Link>
          ))}
        </nav>
        <Button asChild className="ml-auto md:ml-0"><Link to="/sessions">Analyse a set</Link></Button>
      </div>
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t">
      <div className="mx-auto max-w-7xl px-6 py-6 text-sm text-muted-foreground">Prototype · not affiliated with HYROX</div>
    </footer>
  )
}
