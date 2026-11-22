import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent } from 'react'
import { MOCK } from './api/client.ts'

// ponytail: tiny pushState router for 3 routes; swap in react-router if routes grow nested or need loaders.

/** Keeps ?mock=1 across navigation so the whole app stays in mock mode. */
const withMock = (to: string) => (MOCK && !to.startsWith('#') && !to.includes('mock=') ? `${to}${to.includes('?') ? '&' : '?'}mock=1` : to)

export function navigate(to: string) {
  history.pushState(null, '', withMock(to))
  dispatchEvent(new PopStateEvent('popstate'))
  scrollTo(0, 0)
}

export function usePath(): string {
  const [path, setPath] = useState(location.pathname)
  useEffect(() => {
    const on = () => setPath(location.pathname)
    addEventListener('popstate', on)
    return () => removeEventListener('popstate', on)
  }, [])
  return path
}

export function Link({ to, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  const href = withMock(to)
  const go = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e)
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || to.includes('#')) return
    e.preventDefault()
    navigate(to)
  }
  return <a href={href} onClick={go} {...rest} />
}
