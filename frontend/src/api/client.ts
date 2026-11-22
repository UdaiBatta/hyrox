import type { Analysis, FramesData, Video } from './types.ts'

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`/api/${path}`, init)
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null)
    throw new ApiError(res.status, body ? JSON.stringify(body) : res.statusText)
  }
  return res
}

const json = <T>(path: string): Promise<T> => request(path).then((r) => r.json() as Promise<T>)

/** ?mock=1 serves the synthetic session in public/mock/ (regenerate: backend/analysis/tests/make_mock.py),
 *  so the UI can be reviewed without Django running. */
export const MOCK = new URLSearchParams(location.search).has('mock')
const MOCK_VIDEO: Video = {
  id: 'mock', title: 'Example set (synthetic)', status: 'done', fps: 30, n_frames: 450,
  view: 'side', error: '', created_at: '2026-11-21T00:00:00Z',
  summary: { total: 7, proper: 4, not_proper: 2, uncertain: 1 },
}
const mockJson = <T>(file: string): Promise<T> => fetch(`/mock/${file}`).then((r) => r.json() as Promise<T>)

/** The synthetic example session, available in any mode (landing-page demo). */
export const loadDemo = () =>
  Promise.all([mockJson<FramesData>('frames.json'), mockJson<Analysis>('analysis.json')])
    .then(([frames, analysis]) => ({ src: '/mock/clip.mp4', frames, analysis }))
const mockApi = {
  list: async () => [MOCK_VIDEO],
  get: async (_id: string) => MOCK_VIDEO,
  frames: (_id: string) => mockJson<FramesData>('frames.json'),
  analysis: (_id: string) => mockJson<Analysis>('analysis.json'),
  upload: async (_file: File, _title?: string) => MOCK_VIDEO,
  videoUrl: async (_id: string) => '/mock/clip.mp4',
}

const realApi = {
  list: () => json<Video[]>('videos/'),
  get: (id: string) => json<Video>(`videos/${id}/`),
  frames: (id: string) => json<FramesData>(`videos/${id}/frames/`),
  analysis: (id: string) => json<Analysis>(`videos/${id}/analysis/`),

  upload(file: File, title?: string): Promise<Video> {
    const body = new FormData()
    body.append('file', file)
    if (title) body.append('title', title)
    return request('videos/', { method: 'POST', body }).then((r) => r.json() as Promise<Video>)
  },

  /** Object URL for the normalised video. Fetched as a blob because Django's dev server
   *  doesn't answer Range requests, which <video> needs for seeking. Revoke it when done. */
  async videoUrl(id: string): Promise<string> {
    const blob = await request(`videos/${id}/video/`).then((r) => r.blob())
    return URL.createObjectURL(blob)
  },
}

export const api: typeof realApi = MOCK ? mockApi : realApi

/** A 409 from a result endpoint means "still processing", not a failure. */
export const isNotReady = (e: unknown): boolean => e instanceof ApiError && e.status === 409
