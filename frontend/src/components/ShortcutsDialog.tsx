import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx'

const KEYS = [
  ['Space', 'Play / pause'], ['← →', 'Step one frame'], ['J  K', 'Previous / next rep'],
  ['S', 'End-of-set summary'], ['3', 'Show / hide 3D view'], ['?', 'This list'],
] as const

export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Keyboard shortcuts</DialogTitle></DialogHeader>
        <dl className="divide-y">
          {KEYS.map(([k, what]) => (
            <div key={k} className="flex items-center justify-between py-2.5 text-sm">
              <dt>{what}</dt>
              <dd><kbd className="rounded border bg-secondary px-2 py-0.5 font-mono text-xs">{k}</kbd></dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  )
}
