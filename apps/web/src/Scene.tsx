import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { BufferGeometry, CanvasTexture, PMREMGenerator, Vector3 } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { Aircraft } from './Aircraft'
import { type Airframe, type Sample } from './api'

class GraphicsBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <div className="empty">WebGL is unavailable on this device.</div> : this.props.children }
}

const views = {
  Perspective: [1.06, .61, -1.38],
  Front: [0, .13, -1.88],
  Side: [1.82, .16, 0],
  Top: [0, 1.85, -.014],
} as const
type View = keyof typeof views

function Orbit({ view, revision }: { view: View; revision: number }) {
  const { camera, gl, invalidate, size } = useThree()
  const orbit = useRef<OrbitControls>(null)
  useEffect(() => {
    const canvas = gl.domElement
    const controls = new OrbitControls(camera, canvas)
    orbit.current = controls
    controls.minDistance = 19
    controls.maxDistance = 175
    controls.maxPolarAngle = Math.PI * .49
    canvas.tabIndex = 0
    canvas.setAttribute('aria-label', '3D viewport. Arrow keys pan the camera.')
    controls.listenToKeyEvents(canvas)
    controls.addEventListener('change', () => invalidate())
    return () => {
      orbit.current = null
      controls.stopListenToKeyEvents()
      controls.dispose()
    }
  }, [camera, gl, invalidate])
  const portraitFit = Math.max(1, 1.24 * size.height / Math.max(size.width, 1))
  useEffect(() => {
    if (!orbit.current) return
    const [x, y, z] = views[view]
    camera.position.set(x, y, z).multiplyScalar((view === 'Perspective' ? 27 : 32) * portraitFit)
    orbit.current.target.set(0, .6, 0)
    orbit.current.update()
    invalidate()
  }, [camera, invalidate, portraitFit, revision, view])
  return null
}

function StudioLighting() {
  const { gl, scene, invalidate } = useThree()
  useEffect(() => {
    const room = new RoomEnvironment()
    const generator = new PMREMGenerator(gl)
    const target = generator.fromScene(room, .08)
    scene.environment = target.texture
    scene.environmentIntensity = .72
    room.dispose()
    generator.dispose()
    invalidate()
    return () => { scene.environment = null; target.dispose() }
  }, [gl, scene, invalidate])
  return <>
    <hemisphereLight args={['#eff3fb', '#42424b', 1.05]} />
    <directionalLight color="#fff6ed" position={[-17, 22, -25]} intensity={2.1} />
    <directionalLight color="#c8d6ee" position={[9, 10, 17]} intensity={2.6} />
  </>
}

function Floor({ height }: { height: number }) {
  const shadow = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 128
    const ctx = canvas.getContext('2d')!
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
    gradient.addColorStop(0, 'rgba(0,0,0,.5)')
    gradient.addColorStop(.5, 'rgba(0,0,0,.29)')
    gradient.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 128, 128)
    return new CanvasTexture(canvas)
  }, [])
  useEffect(() => () => shadow.dispose(), [shadow])
  return <group position={[0, height, 0]}>
    <gridHelper args={[115, 23, '#373c43', '#282c31']} />
    <mesh position={[0, .018, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[45, 51]} />
      <meshBasicMaterial map={shadow} transparent depthWrite={false} />
    </mesh>
  </group>
}

function Trajectory({ airframe, samples, index }: { airframe: Airframe; samples: Sample[]; index: number }) {
  const vectors = useMemo(() => {
    const scale = 32 / Math.max(1, samples.at(-1)!.distance)
    return samples.map(s => new Vector3((s.distance * scale) - 16, 1 + (s.altitude - samples[0].altitude) * scale, 0))
  }, [samples])
  const geometry = useMemo(() =>
    new BufferGeometry().setFromPoints(vectors.slice(1).flatMap((point, i) => [vectors[i], point])), [vectors])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <>
    <lineSegments>
      <primitive object={geometry} attach="geometry" />
      <lineBasicMaterial color="#80bdff" />
    </lineSegments>
    <group position={vectors[index]} rotation={[0, 0, samples[index].angle]} scale={3.4 / Math.max(airframe.span, airframe.length)}>
      <group rotation={[0, -Math.PI / 2, 0]}><Aircraft config={airframe} /></group>
    </group>
  </>
}

export function Scene({ airframe, samples, index = 0, controls = false }: {
  airframe: Airframe; samples?: Sample[]; index?: number; controls?: boolean
}) {
  const [camera, setCamera] = useState<{ view: View; revision: number }>({ view: 'Perspective', revision: 0 })
  const scale = 42 / Math.max(airframe.span, airframe.length)
  return <div className="scene">
    <div className="scene-render" role="img" aria-label={samples ? 'Interactive 3D flight trajectory' : 'Interactive 3D aircraft geometry'}>
      <GraphicsBoundary>
        <Canvas frameloop="demand" dpr={[1, 1.6]} camera={{ fov: 40, near: .1, far: 260, position: [30, 16, -37] }}>
          <StudioLighting />
          <Floor height={samples ? -2.5 : -.9 * airframe.width * scale} />
          <Orbit {...camera} />
          {samples ? <Trajectory airframe={airframe} samples={samples} index={index} /> :
            <group scale={scale}><Aircraft config={airframe} /></group>}
        </Canvas>
      </GraphicsBoundary>
    </div>
    {controls && !samples && <div className="scene-views" role="group" aria-label="Camera view">
      {(Object.keys(views) as View[]).map(view => <button key={view} aria-pressed={camera.view === view}
        onClick={() => setCamera({ view, revision: camera.revision + 1 })}>{view}</button>)}
    </div>}
    <span className="scene-help">Drag to orbit · Scroll to zoom</span>
    {!samples && <span className="scene-dimensions">{airframe.span.toFixed(1)} m span · {airframe.area.toFixed(1)} m²</span>}
  </div>
}
