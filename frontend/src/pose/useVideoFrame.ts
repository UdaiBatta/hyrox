import { useEffect, useState } from 'react'

/** Frame index of the frame currently on screen. The one clock for overlay, HUD, rep strip and 3D:
 *  requestVideoFrameCallback fires per presented frame (also after seeks while paused).
 *  Backend video is constant-fps, so frame = round(mediaTime * fps). */
export function useVideoFrame(video: HTMLVideoElement | null, fps: number, nFrames: number): number {
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    if (!video) return
    let id = 0
    const tick: VideoFrameRequestCallback = (_now, meta) => {
      setFrame(Math.min(nFrames - 1, Math.max(0, Math.round(meta.mediaTime * fps))))
      id = video.requestVideoFrameCallback(tick)
    }
    id = video.requestVideoFrameCallback(tick)
    return () => video.cancelVideoFrameCallback(id)
  }, [video, fps, nFrames])
  return frame
}
