import type { Rep } from '../api/types.ts'

/** Playback actions shared by the video's own key handler, page shortcuts and buttons.
 *  Positions are read from the element, not React state: state lags until the seeked frame is painted,
 *  so quick repeated presses (K, K) would otherwise act on the old frame. */
export function videoControls(video: HTMLVideoElement, fps: number, nFrames: number, reps: Rep[]) {
  const now = () => Math.floor(video.currentTime * fps)
  const seek = (f: number) => {
    video.pause()
    video.currentTime = (Math.min(nFrames - 1, Math.max(0, f)) + 0.5) / fps
  }
  return {
    seek,
    toggle: () => (video.paused ? void video.play() : video.pause()),
    step: (d: 1 | -1) => seek(now() + d),
    nextRep: (d: 1 | -1) => {
      const t = now()
      const target = d > 0 ? reps.find((r) => r.bottom > t) : [...reps].reverse().find((r) => r.bottom < t)
      if (target) seek(target.bottom)
    },
    /** Replay one rep at 0.5x from just before it starts, pausing at its end. */
    replaySlow: (rep: Rep) => {
      seek(rep.start - Math.round(0.3 * fps))
      video.playbackRate = 0.5
      const stop = () => {
        if (video.currentTime * fps >= rep.end + 3) {
          video.pause()
          video.removeEventListener('timeupdate', stop)
        }
      }
      video.addEventListener('timeupdate', stop)
      void video.play()
    },
  }
}

/** Space, arrows, J/K. Returns true when the key was handled. */
export function handleVideoKey(key: string, c: ReturnType<typeof videoControls>): boolean {
  const map: Record<string, () => void> = {
    ' ': c.toggle, ArrowRight: () => c.step(1), ArrowLeft: () => c.step(-1),
    k: () => c.nextRep(1), j: () => c.nextRep(-1),
  }
  map[key]?.()
  return key in map
}
