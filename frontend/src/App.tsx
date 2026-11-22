import { SiteFooter, SiteHeader } from '@/components/SiteHeader.tsx'
import { TooltipProvider } from '@/components/ui/tooltip.tsx'
import { Landing } from '@/pages/Landing.tsx'
import { Session } from '@/pages/Session.tsx'
import { Sessions } from '@/pages/Sessions.tsx'
import { Link, usePath } from '@/router.tsx'

export default function App() {
  const path = usePath()
  const session = path.match(/^\/sessions\/([^/]+)\/?$/)
  const page = path === '/' ? <Landing />
    : path.replace(/\/$/, '') === '/sessions' ? <Sessions />
      : session ? <Session key={session[1]} id={session[1]} />
        : <main className="mx-auto max-w-7xl px-6 py-20">Page not found. <Link to="/" className="text-primary">Go home</Link></main>
  return (
    <TooltipProvider delayDuration={200}>
      <SiteHeader path={path} />
      {page}
      <SiteFooter />
    </TooltipProvider>
  )
}
