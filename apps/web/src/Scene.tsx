import { Component, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Vector3 } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { dimensions, type Airframe, type Sample } from './api'

class GraphicsBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <div className="empty">WebGL is unavailable on this device.</div> : this.props.children }
}

function Orbit() {
  const { camera, gl, invalidate } = useThree()
  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement)
    controls.minDistance = 9
    controls.maxDistance = 110
    controls.maxPolarAngle = Math.PI * .5
    controls.enablePan = true
    const canvas = gl.domElement
    canvas.tabIndex = 0
    canvas.setAttribute("aria-label", "3D viewport. Arrow keys pan the camera.")
    controls.listenToKeyEvents(canvas)
    controls.addEventListener('change', () => invalidate())
    controls.update()
    return () => { controls.stopListenToKeyEvents(); controls.dispose() }
  }, [camera, gl, invalidate])
  return null
}

function Surface({ span, root, tip, sweep, dihedral, color }: {
  span: number; root: number; tip: number; sweep: number; dihedral: number; color: string
}) {
  const geo = useMemo(() => {
    const vertices: number[] = []
    const width = span / 2
    const offset = Math.tan(sweep * Math.PI / 180) * width
    const rise = Math.tan(dihedral * Math.PI / 180) * width
    for (const side of [-1, 1]) {
      const x = width * side
      vertices.push(0, 0, -root / 4, x, rise, offset - tip / 4, x, rise, offset + 3 * tip / 4,
        0, 0, -root / 4, x, rise, offset + 3 * tip / 4, 0, 0, 3 * root / 4)
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3))
    geometry.computeVertexNormals()
    return geometry
  }, [span, root, tip, sweep, dihedral])
  useEffect(() => () => geo.dispose(), [geo])
  return <mesh geometry={geo}><meshStandardMaterial color={color} metalness={.25} roughness={.5} side={DoubleSide} /></mesh>
}

function Airplane({ config }: { config: Airframe }) {
  const { root_chord: root, tip_chord: tip } = dimensions(config)
  const { length, width, tail } = config
  return <group rotation={[0, -.18, 0]}>
    <mesh rotation={[Math.PI / 2, 0, 0]} scale={[width / 2, length / 2, width / 2]}>
      <sphereGeometry args={[1, 48, 24]} />
      <meshStandardMaterial color="#a4bcd4" metalness={.44} roughness={.28} />
    </mesh>
    <mesh position={[0, width * .31, -length * .405]} scale={[width * .36, width * .17, length * .056]}>
      <sphereGeometry args={[1, 24, 16]} /><meshStandardMaterial color="#102e44" metalness={.55} roughness={.2} />
    </mesh>
    <Surface span={config.span} root={root} tip={tip} sweep={config.sweep} dihedral={config.dihedral} color="#9cb6d2" />
    <group position={[0, width * .23, length * .36]}>
      <Surface span={config.span * .37 * tail} root={root * .56 * tail} tip={tip * .67 * tail}
        sweep={30} dihedral={4} color="#819fbf" />
      <group rotation={[0, 0, Math.PI / 2]}>
        <Surface span={width * 2.4 * tail} root={root * .52 * tail} tip={tip * .5 * tail}
          sweep={26} dihedral={0} color="#829bb8" />
      </group>
    </group>
    {[-1, 1].map(sign => <group key={sign} position={[sign * config.span * .21, -width * .34, root * .02]}
      rotation={[Math.PI / 2, 0, 0]}>
      <mesh><cylinderGeometry args={[width * .27, width * .25, width * 1.05, 32]} />
        <meshStandardMaterial color="#7c9ebc" metalness={.5} roughness={.3} /></mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -width * .53, 0]}>
        <circleGeometry args={[width * .2, 28]} /><meshBasicMaterial color="#102538" side={DoubleSide} />
      </mesh>
    </group>)}
  </group>
}

function Trajectory({ airframe, samples, index }: { airframe: Airframe; samples: Sample[]; index: number }) {
  const vectors = useMemo(() => {
    const scale = 32 / Math.max(1, samples.at(-1)!.distance)
    return samples.map(s => new Vector3((s.distance * scale) - 16, 1 + (s.altitude - samples[0].altitude) * scale, 0))
  }, [samples])
  const ref = useRef<BufferGeometry>(null)
  useEffect(() => { ref.current?.setFromPoints(vectors.slice(1).flatMap((point, i) => [vectors[i], point])) }, [vectors])
  return <>
    <lineSegments>
      <bufferGeometry ref={ref} />
      <lineBasicMaterial color="#52e6f5" />
    </lineSegments>
    <group position={vectors[index]} rotation={[0, -Math.PI / 2 + .18, samples[index].angle]} scale={.105}>
      <Airplane config={airframe} />
    </group>
  </>
}

export function Scene({ airframe, samples, index = 0 }: { airframe: Airframe; samples?: Sample[]; index?: number }) {
  return <div className="scene" role="img" aria-label={samples ? "Interactive 3D flight trajectory" : "Interactive 3D aircraft geometry"}>
    <GraphicsBoundary>
      <Canvas frameloop="demand" dpr={[1, 1.6]} camera={{ position: [26, 18, -27], fov: 42 }}>
        <ambientLight intensity={1.35} />
        <directionalLight color="#d7edff" position={[-12, 22, -10]} intensity={2.6} />
        <directionalLight color="#40c1ff" position={[18, 6, 12]} intensity={1.25} />
        <gridHelper args={[110, 44, '#1f4d64', '#163045']} position={[0, -2, 0]} />
        <axesHelper args={[5]} position={[-19, -1.96, 14]} />
        <Orbit />
        {samples ? <Trajectory airframe={airframe} samples={samples} index={index} /> : <Airplane config={airframe} />}
      </Canvas>
    </GraphicsBoundary>
    <span className="scene-caption">X / SPAN · Y / UP · Z / AXIAL</span>
    <span className="scene-help">Drag to orbit · Scroll to zoom</span>
    {!samples && <span className="scene-dimensions">{airframe.span.toFixed(1)} m span · {airframe.area.toFixed(1)} m²</span>}
  </div>
}
