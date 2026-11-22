import { Grid, OrbitControls, Segment, Segments } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { createRef, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { World } from '@/api/types.ts'
import { BONES, JOINTS } from '@/pose/skeleton.ts'
import type { Ball3D, Lifted } from '@/pose/smooth3d.ts'
import { token } from '@/pose/tokens.ts'

type SegmentRef = { start: THREE.Vector3; end: THREE.Vector3; color: THREE.Color }
const SHADOW = '#05070a'
const BG = '#12151a'
const EST_FADE = 0.65       // estimated joints and bones: this much towards the background

/** Lifted points are metres, hip-centred, y down, z away from the camera. Each frame comes with the floor's height
 *  in the same coordinates (from planted feet), so the floor is y = 0 and the hips drop in a squat. Three.js is
 *  y up: flip y and z. Skeleton and ball go through this one transform on the same frame. */
const toThree = (p: World, floor: number): [number, number, number] => [p[0], floor - p[1], -p[2]]

/** MediaPipe numbers left-side points odd and right-side even (from 11 on). The athlete's right side is drawn
 *  darker so near and far limbs read apart when the view is rotated. */
const isRight = (j: number) => j >= 11 && j % 2 === 0

/** 3D skeleton, driven by the same frame clock as the video. Positions are updated imperatively (no React
 *  re-render of 60 meshes per frame). Default export for lazy loading. */
export default function Skeleton3D({ lifted, hasBall, view, frame }:
  { lifted: Lifted; hasBall: boolean; view: 'side' | 'front'; frame: number }) {
  // `lifted` is built once per clip by the page (shared with the 2D overlay). Display only: the rules use the video.
  const world = lifted.clip[frame] ?? null
  const est = lifted.est[frame] ?? null
  const floor = lifted.floor[frame] ?? null
  const b = lifted.ball[frame] ?? null
  const pts = useMemo(() => (world && floor !== null ? world.map((p) => (p ? toThree(p, floor) : null)) : null), [world, floor])
  const color = useMemo(() => token('foreground'), [])

  return (
    <div className="relative h-full w-full">
      <Canvas camera={{ position: view === 'side' ? [3.6, 1.6, 3.6] : [1.6, 1.6, 4.9], fov: 45 }} dpr={[1, 2]}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[2, 4, 3]} intensity={2} />
        <Figure pts={pts} est={est} color={color} />
        {b && floor !== null && <BallMesh b={b} floor={floor} />}
        <Grid position={[0, -0.001, 0]} infiniteGrid cellSize={0.25} sectionSize={1} cellColor="#262b34"
          sectionColor="#3a4250" fadeDistance={9} />
        <OrbitControls target={[0, 1.4, 0]} enablePan={false} minDistance={1.2} maxDistance={8} />
      </Canvas>
      {!pts && (
        <p className="pointer-events-none absolute inset-x-2 top-1/2 text-center text-sm text-muted-foreground">
          {world ? '3D paused · floor reference unavailable' : '3D pose unavailable in this frame'}
        </p>
      )}
      <p className="pointer-events-none absolute bottom-2 inset-x-0 text-center text-xs text-muted-foreground">
        Estimated 3D pose · drag to rotate · faded = filled joint{hasBall ? ' · blue = estimated ball' : ''}
      </p>
    </div>
  )
}

type P3 = [number, number, number]
const mid = (a: P3 | null, b: P3 | null): P3 | null => (a && b ? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2] : null)
// 3D view only: a neck from the shoulder midpoint (33) to the head centre (34, between the ears),
// so the figure has a head instead of a lone nose dot.
const LINKS: [number, number][] = [...BONES, [33, 34]]

function Figure({ pts: raw, est, color }: { pts: (P3 | null)[] | null; est: boolean[] | null; color: string }) {
  const bones = useMemo(() => LINKS.map(() => createRef<SegmentRef>()), [])
  const shadows = useMemo(() => LINKS.map(() => createRef<SegmentRef>()), [])
  const joints = useRef<THREE.InstancedMesh>(null)
  const head = useRef<THREE.Mesh>(null)
  const pts = useMemo(() => raw && [...raw, mid(raw[11], raw[12]), mid(raw[7], raw[8])], [raw])

  useLayoutEffect(() => {
    const bg = new THREE.Color(BG)
    const left = new THREE.Color(color)
    const right = left.clone().lerp(bg, 0.5)
    const tone = (r: boolean, faded: boolean) => (r ? right : left).clone().lerp(bg, faded ? EST_FADE : 0)
    const isEst = (j: number) => !!est?.[j] || (j === 33 && !!(est?.[11] || est?.[12])) || (j === 34 && !!(est?.[7] || est?.[8]))
    const zero = new THREE.Vector3()
    if (head.current) {
      const h = pts?.[34]
      head.current.visible = !!h
      if (h) head.current.position.set(...h)
    }
    LINKS.forEach(([a, b], k) => {
      const s = bones[k].current
      const sh = shadows[k].current
      if (!s || !sh) return
      const pa = pts?.[a], pb = pts?.[b]
      if (!pa || !pb) { s.start.copy(zero); s.end.copy(zero); sh.start.copy(zero); sh.end.copy(zero); return }  // hidden
      s.start.set(...pa); s.end.set(...pb)
      s.color.copy(tone(isRight(a) && isRight(b), isEst(a) || isEst(b)))
      // Shadow: the same bone flattened onto the floor, so you can see where the body is over the feet.
      sh.start.set(pa[0], 0.002, pa[2]); sh.end.set(pb[0], 0.002, pb[2])
    })
    const inst = joints.current
    if (inst) {
      const m = new THREE.Matrix4()
      JOINTS.forEach((j, k) => {
        const p = pts?.[j]
        m.makeScale(p ? 1 : 0, p ? 1 : 0, p ? 1 : 0)
        if (p) m.setPosition(...p)
        inst.setMatrixAt(k, m)
        inst.setColorAt(k, tone(isRight(j), isEst(j)))
      })
      inst.instanceMatrix.needsUpdate = true
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true
    }
  }, [pts, est, color, bones, shadows])

  return (
    <>
      <Segments limit={LINKS.length} lineWidth={4}>
        {LINKS.map((_, k) => <Segment key={k} ref={bones[k] as never} start={[0, 0, 0]} end={[0, 0, 0]} color={color} />)}
      </Segments>
      <Segments limit={LINKS.length} lineWidth={5}>
        {LINKS.map((_, k) => <Segment key={k} ref={shadows[k] as never} start={[0, 0, 0]} end={[0, 0, 0]} color={SHADOW} />)}
      </Segments>
      <instancedMesh ref={joints} args={[undefined, undefined, JOINTS.length]}>
        <sphereGeometry args={[0.028, 16, 16]} />
        <meshStandardMaterial roughness={0.5} />
      </instancedMesh>
      <mesh ref={head}>
        <sphereGeometry args={[0.085, 24, 24]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
    </>
  )
}

/** The wall ball (the only blue object; the legend says so): solid while held, see-through in flight (its depth
 *  then is an assumption), with a floor shadow. Same frame and transform as the skeleton. */
function BallMesh({ b, floor }: { b: Ball3D; floor: number }) {
  const [x, y, z] = toThree(b.p, floor)
  const blue = useMemo(() => token('primary'), [])
  return (
    <>
      <mesh position={[x, y, z]}>
        <sphereGeometry args={[b.r, 32, 32]} />
        <meshStandardMaterial color={blue} roughness={0.7} transparent opacity={b.held ? 0.95 : 0.55} />
      </mesh>
      <mesh position={[x, 0.003, z]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[b.r, 32]} />
        <meshBasicMaterial color={SHADOW} transparent opacity={0.8} />
      </mesh>
    </>
  )
}

