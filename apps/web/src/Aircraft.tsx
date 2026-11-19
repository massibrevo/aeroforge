import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import {
  BufferGeometry, DoubleSide, Float32BufferAttribute, LatheGeometry,
  Matrix4, Quaternion, Shape, Vector2, Vector3, type InstancedMesh,
} from 'three'
import { type Airframe, type AirframeProfile } from './api'

type Profile = {
  wingStation: number
  finHeight: number
  engineStations: number[]
  nacelle: number
  tip: 'plain' | 'winglet' | 'sharklet' | 'raked' | 'blended'
  cabin: number
}
const profiles: Record<AirframeProfile, Profile> = {
  generic: { wingStation: .44, finHeight: 1.43, engineStations: [.38], nacelle: .32, tip: 'winglet', cabin: 30 },
  glider: { wingStation: .42, finHeight: .85, engineStations: [], nacelle: 0, tip: 'plain', cabin: 0 },
  b738: { wingStation: .45, finHeight: 1.62, engineStations: [.37], nacelle: .33, tip: 'winglet', cabin: 42 },
  b748: { wingStation: .43, finHeight: 1.72, engineStations: [.36, .66], nacelle: .29, tip: 'raked', cabin: 57 },
  a20n: { wingStation: .46, finHeight: 1.56, engineStations: [.39], nacelle: .37, tip: 'sharklet', cabin: 38 },
  a359: { wingStation: .44, finHeight: 1.63, engineStations: [.40], nacelle: .37, tip: 'blended', cabin: 53 },
}

const tau = Math.PI * 2
const angle = Math.PI / 180
const axial = (t: number, length: number) => (t - .5) * length
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const smooth = (a: number, b: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function fuselagePoint(frame: Airframe, t: number, theta: number, lift = 0): [number, number, number] {
  const glider = frame.profile === 'glider'
  const nose = glider ? .13 : frame.profile === 'b748' ? .095 : .13
  const approach = Math.min(1, t / nose)
  const front = Math.sqrt(1 - (1 - approach) ** 2)
  const rear = 1 - .96 * smooth(glider ? .33 : .69, 1, t)
  const radius = frame.width / 2 * front * rear
  const y = Math.sin(theta)
  const hump = frame.profile === 'b748' ?
    frame.width * .32 * smooth(.025, .15, t) * (1 - smooth(.255, .45, t)) * Math.max(y, 0) ** 1.85 : 0
  const rise = frame.width * (.20 * smooth(.75, 1, t) - .18 * (1 - smooth(0, nose, t)))
  return [Math.cos(theta) * (radius + lift), (radius * (glider ? .85 : 1.02) + lift) * y + rise + hump,
    axial(t, frame.length)]
}

function surface(rows: number, columns: number, point: (row: number, col: number) => number[], reverse = false) {
  const positions = [], index = []
  for (let row = 0; row <= rows; row++) {
    for (let col = 0; col <= columns; col++) positions.push(...point(row, col))
  }
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const a = row * (columns + 1) + col, b = a + columns + 1
      index.push(...(reverse ? [a, b, a + 1, a + 1, b, b + 1] : [a, a + 1, b, a + 1, b + 1, b]))
    }
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geo.setIndex(index)
  geo.computeVertexNormals()
  return geo
}

function Geometry({ value }: { value: BufferGeometry }) {
  useEffect(() => () => value.dispose(), [value])
  return <primitive object={value} attach="geometry" />
}

function Cockpit({ frame }: { frame: Airframe }) {
  const glider = frame.profile === 'glider'
  const jumbo = frame.profile === 'b748'
  const mesh = useMemo(() => {
    const geometries = []
    for (let pane = 0; pane < 6; pane++) {
      const first = .36 + (Math.PI - .72) * pane / 6
      const last = first + (Math.PI - .72) / 6 - .028
      geometries.push(surface(5, 6, (row, col) => {
        const theta = lerp(first, last, col / 6)
        const side = Math.abs(Math.cos(theta))
        const from = .068 + .027 * side
        const to = (glider ? .23 : jumbo ? .088 : .095) + .027 * side
        return fuselagePoint(frame, lerp(from, to, row / 5), theta, .016)
      }))
    }
    return geometries
  }, [frame, glider, jumbo])
  return <group>{mesh.map((geometry, index) => <mesh key={index}>
    <Geometry value={geometry} />
    <meshPhysicalMaterial color="#10202d" metalness={.2} roughness={.15} clearcoat={.75} side={DoubleSide} />
  </mesh>)}</group>
}

const roundedWindow = (() => {
  const s = new Shape()
  s.moveTo(-.32, -.5)
  s.lineTo(.32, -.5)
  s.quadraticCurveTo(.5, -.5, .5, -.30)
  s.lineTo(.5, .30)
  s.quadraticCurveTo(.5, .5, .32, .5)
  s.lineTo(-.32, .5)
  s.quadraticCurveTo(-.5, .5, -.5, .30)
  s.lineTo(-.5, -.30)
  s.quadraticCurveTo(-.5, -.5, -.32, -.5)
  return s
})()

function Windows({ frame, count }: { frame: Airframe; count: number }) {
  const jumbo = frame.profile === 'b748'
  const doors = useMemo(() => frame.length > 48 ? [.15, .34, .53, .72, .81] : [.15, .48, .78], [frame.length])
  const ref = useRef<InstancedMesh>(null)
  const features = useMemo(() => {
    const windows = []
    for (const side of [-1, 1]) {
      const rows = jumbo ? [[count, .145, .825, .21], [15, .123, .33, .86]] : [[count, .14, .81, .31]]
      for (const [n, start, end, height] of rows) {
        for (let i = 0; i < n; i++) {
          const t = lerp(start, end, i / (n - 1))
          if (height < .5 && doors.some(d => Math.abs(d - t) < .012)) continue
          const theta = side === 1 ? height : Math.PI - height
          windows.push({ position: fuselagePoint(frame, t, theta, .021), yaw: side * Math.PI / 2,
            bank: side * height })
        }
      }
    }
    return windows
  }, [count, doors, frame, jumbo])

  useLayoutEffect(() => {
    if (!ref.current) return
    const matrix = new Matrix4(), rotation = new Quaternion(), roll = new Quaternion()
    const scale = new Vector3(frame.width * .072, frame.width * .101, 1)
    for (const [i, item] of features.entries()) {
      rotation.setFromAxisAngle(new Vector3(0, 0, 1), item.bank)
      roll.setFromAxisAngle(new Vector3(0, 1, 0), item.yaw)
      matrix.compose(new Vector3(...item.position), rotation.multiply(roll), scale)
      ref.current.setMatrixAt(i, matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true
    ref.current.computeBoundingSphere()
  }, [features, frame.width])

  const seams = useMemo(() => {
    const points = []
    for (const side of [-1, 1]) {
      for (const door of doors) {
        const halfWidth = frame.width * .095 / frame.length
        const shape = [[-1, -.32], [-1, .46], [-.7, .52], [.7, .52], [1, .46],
          [1, -.32], [.72, -.38], [-.72, -.38], [-1, -.32]]
        const vertices = shape.map(([t, h]) =>
          fuselagePoint(frame, door + t * halfWidth, side === 1 ? h : Math.PI - h, .011))
        for (let i = 1; i < vertices.length; i++) points.push(...vertices[i - 1], ...vertices[i])
      }
    }
    return new Float32BufferAttribute(points, 3)
  }, [doors, frame])
  return <>
    <instancedMesh ref={ref} args={[undefined, undefined, features.length]} key={features.length}>
      <shapeGeometry args={[roundedWindow, 3]} />
      <meshStandardMaterial color="#192936" roughness={.18} metalness={.22} side={DoubleSide} />
    </instancedMesh>
    <lineSegments><bufferGeometry><primitive object={seams} attach="attributes-position" /></bufferGeometry>
      <lineBasicMaterial color="#3d4c58" transparent opacity={.72} /></lineSegments>
  </>
}

type Station = { x: number; chord: number; rise: number; offset: number }
const sectionCount = 40
function airfoil(station: Station, phase: number, side: number, thickness: number) {
  const c = (1 - Math.cos(phase)) / 2
  const camber = .06 * c * (1 - c)
  const shape = 5 * thickness * (.2969 * Math.sqrt(c) - .126 * c - .3516 * c ** 2 +
    .2843 * c ** 3 - .1036 * c ** 4)
  return [station.x * side, station.rise + station.chord * (camber + Math.sign(Math.sin(phase)) * shape),
    station.offset + station.chord * (c - .25)]
}

function Wing({ stations, single = false, thickness = .11, color = '#b6bdc5', seams = false }: {
  stations: Station[]; single?: boolean; thickness?: number; color?: string; seams?: boolean
}) {
  const parts = useMemo(() => (single ? [1] : [-1, 1]).map(side => ({
    geometry: surface(stations.length - 1, sectionCount,
      (row, col) => airfoil(stations[row], col * tau / sectionCount, side, thickness), side < 0),
    lines: new Float32BufferAttribute(stations.slice(1).flatMap((to, i) => {
      const from = stations[i]
      const phase = Math.acos(1 - 2 * .74)
      return [airfoil(from, phase, side, thickness), airfoil(to, phase, side, thickness)]
        .flatMap(([x, y, z]) => [x, y + .021, z])
    }), 3),
  })), [single, stations, thickness])
  return <>{parts.map(({ geometry, lines }, index) => <group key={index}>
    <mesh>
      <Geometry value={geometry} />
      <meshPhysicalMaterial color={color} metalness={.33} roughness={.37} clearcoat={.35} side={DoubleSide} />
    </mesh>
    {seams && <lineSegments><bufferGeometry><primitive object={lines} attach="attributes-position" /></bufferGeometry>
      <lineBasicMaterial color="#546270" transparent opacity={.72} /></lineSegments>}
  </group>)}</>
}

function mainWing(frame: Airframe, profile: Profile): Station[] {
  const half = frame.span / 2
  const sections = [0, .28, .64, .86, .94, .98, 1]
  const taper = frame.taper
  const chords = [1.12, .78, lerp(taper, .78, .41), lerp(taper, .78, .14), taper, taper * .70, taper * .16]
  if (profile.tip === 'plain') chords[6] = taper * .64
  const integrated = sections.slice(1).reduce((sum, t, i) => sum + (t - sections[i]) * (chords[i] + chords[i + 1]) / 2, 0)
  const root = frame.area / (frame.span * integrated)
  const height = profile.tip === 'plain' || profile.tip === 'raked' ? 0 : frame.width *
    (profile.tip === 'blended' ? .48 : profile.tip === 'sharklet' ? .65 : .6)
  return sections.map((fraction, i) => ({
    x: fraction * half, chord: root * chords[i],
    rise: Math.tan(frame.dihedral * angle) * fraction * half + height * smooth(.9, 1, fraction),
    offset: Math.tan(frame.sweep * angle) * fraction * half + root *
      (profile.tip === 'raked' ? .23 : .09) * smooth(.84, 1, fraction),
  }))
}

function Pylon({ height, radius, position }: { height: number; radius: number; position: [number, number, number] }) {
  const stations = useMemo(() => [
    { x: 0, chord: radius * 1.85, rise: 0, offset: radius * .24 },
    { x: height, chord: radius * 1.42, rise: 0, offset: -radius * .43 },
  ], [height, radius])
  return <group position={position} rotation={[0, 0, -Math.PI / 2]}>
    <Wing stations={stations} single thickness={.19} color="#979fa5" />
  </group>
}

const radiusProfile = [[.81, -1.03], [.91, -1.23], [1.01, -1.21], [1.11, -.96], [1.12, -.4],
  [1.04, .32], [.87, .83], [.65, 1.05], [.55, 1.04], [.64, .72], [.78, -.62], [.81, -1.03]]

function Engine({ radius, position, flat }: { radius: number; position: [number, number, number]; flat: boolean }) {
  const shell = useMemo(() => {
    const shape = new LatheGeometry(radiusProfile.map(([r, z]) => new Vector2(r, z)), 44)
    shape.rotateX(Math.PI / 2)
    if (flat) {
      const p = shape.attributes.position
      for (let i = 0; i < p.count; i++) if (p.getY(i) < -.68) p.setY(i, -.68 + .28 * (p.getY(i) + .68))
      shape.computeVertexNormals()
    }
    return shape
  }, [flat])
  return <group position={position} scale={radius}>
    <mesh><Geometry value={shell} />
      <meshPhysicalMaterial color="#adb5bf" metalness={.55} roughness={.27} clearcoat={.42} side={DoubleSide} />
    </mesh>
    <mesh position={[0, 0, -.87]} rotation={[0, Math.PI, 0]} scale={[.78, flat ? .82 : 1, 1]}>
      <circleGeometry args={[1, 40]} /><meshStandardMaterial color="#0d131b" roughness={.86} />
    </mesh>
    <group position={[0, 0, -.98]} scale={[1, flat ? .82 : 1, 1]}>
      {Array.from({ length: 18 }, (_, i) => <group key={i} rotation={[0, 0, i * tau / 18]}>
        <mesh position={[.43, 0, 0]} rotation={[.5, .12, .23]}>
          <boxGeometry args={[.54, .052, .026]} /><meshStandardMaterial color="#536171" metalness={.56} roughness={.44} />
        </mesh>
      </group>)}
      <mesh scale={[.235, .235, .18]}><sphereGeometry args={[1, 18, 12]} />
        <meshStandardMaterial color="#242c35" metalness={.38} roughness={.29} /></mesh>
    </group>
  </group>
}

export function Aircraft({ config: frame }: { config: Airframe }) {
  const profile = profiles[frame.profile ?? 'generic']
  const wing = useMemo(() => mainWing(frame, profile), [frame, profile])
  const body = useMemo(() => surface(88, 64, (row, col) =>
    fuselagePoint(frame, row / 88, col * tau / 64)), [frame])
  const wide = frame.width
  const wingY = -wide * .27
  const wingZ = axial(profile.wingStation, frame.length)
  const root = wing[0].chord
  const stab = useMemo(() => [
    { x: 0, chord: root * .47, rise: 0, offset: 0 },
    { x: frame.span * .18 * frame.tail * .96, chord: root * .15, rise: wide * .12, offset: root * .43 },
    { x: frame.span * .18 * frame.tail, chord: root * .085, rise: wide * .17, offset: root * .47 },
  ], [frame.span, frame.tail, root, wide])
  const finHeight = profile.finHeight * wide * frame.tail
  const fin = useMemo(() => [
    { x: 0, chord: root * .64, rise: 0, offset: 0 },
    { x: finHeight * .32, chord: root * .42, rise: 0, offset: root * .23 },
    { x: finHeight * .94, chord: root * .17, rise: 0, offset: root * .55 },
    { x: finHeight, chord: root * .105, rise: 0, offset: root * .59 },
  ], [finHeight, root])
  const nacelle = wide * profile.nacelle
  return <group>
    <mesh><Geometry value={body} />
      <meshPhysicalMaterial color="#e6e7e5" roughness={.31} metalness={.2} clearcoat={.5} clearcoatRoughness={.27} />
    </mesh>
    <Cockpit frame={frame} />
    {profile.cabin > 0 && <Windows frame={frame} count={profile.cabin} />}
    <group position={[0, wingY, wingZ]}><Wing stations={wing} seams /></group>
    <group position={[0, wide * .36, axial(.835, frame.length)]} rotation={[0, 0, Math.PI / 2]}>
      <Wing stations={fin} color="#48525f" single />
    </group>
    <group position={[0, wide * .28, axial(.865, frame.length)]}>
      <Wing stations={stab} seams />
    </group>
    {profile.engineStations.flatMap(fraction => [-1, 1].map(side => {
      const x = fraction * frame.span / 2 * side
      const y = wingY + Math.tan(frame.dihedral * angle) * Math.abs(x)
      const z = wingZ + Math.tan(frame.sweep * angle) * Math.abs(x)
      const pylonHeight = nacelle * 1.05
      return <group key={x}>
        <Pylon height={pylonHeight} radius={nacelle} position={[x, y, z - nacelle * .16]} />
        <Engine radius={nacelle} flat={frame.profile === 'b738'}
          position={[x, y - pylonHeight - nacelle * .62, z - nacelle * .70]} />
      </group>
    }))}
    {[-1, 1].map(side => {
      const tip = wing.at(-1)!
      return <mesh key={side} position={[side * tip.x, wingY + tip.rise, wingZ + tip.offset]}>
        <sphereGeometry args={[Math.max(.034, wide * .017), 10, 8]} />
        <meshStandardMaterial color={side === 1 ? '#61f5bd' : '#ff514c'}
          emissive={side === 1 ? '#157c49' : '#a52020'} emissiveIntensity={.48} />
      </mesh>
    })}
  </group>
}
