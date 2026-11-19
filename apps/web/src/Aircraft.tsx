import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import {
  BufferGeometry, CanvasTexture, DoubleSide, Float32BufferAttribute, LatheGeometry, SRGBColorSpace,
  Matrix4, Quaternion, Shape, Vector2, Vector3, type InstancedMesh,
} from 'three'
import { type Airframe } from './api'
import { aircraftReference, type AircraftVisual } from './catalog'

const generic: AircraftVisual = {
  body: 'single', wingStation: .44, finHeight: 1.43, engineStations: [.38], nacelle: .32,
  tip: 'winglet', cabin: 30, nose: .13,
}
const glider: AircraftVisual = {
  body: 'glider', wingStation: .42, finHeight: .85, engineStations: [], nacelle: 0,
  tip: 'plain', cabin: 0, nose: .13,
}
const visualFor = (frame: Airframe) =>
  aircraftReference(frame.profile)?.visual ?? (frame.profile === 'glider' ? glider : generic)

const tau = Math.PI * 2
const angle = Math.PI / 180
const axial = (t: number, length: number) => (t - .5) * length
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const smooth = (a: number, b: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function fuselagePoint(frame: Airframe, t: number, theta: number, lift = 0): [number, number, number] {
  const profile = visualFor(frame)
  const nose = profile.nose
  const approach = Math.min(1, t / nose)
  const front = Math.sqrt(1 - (1 - approach) ** 2)
  const rear = 1 - .96 * smooth(profile.body === 'glider' ? .33 : .69, 1, t)
  const radius = frame.width / 2 * front * rear
  const y = Math.sin(theta)
  const hump = profile.body === 'hump' ?
    frame.width * .32 * smooth(.025, .15, t) * (1 - smooth(.255, .45, t)) * Math.max(y, 0) ** 1.85 : 0
  const rise = frame.width * (.20 * smooth(.75, 1, t) - .18 * (1 - smooth(0, nose, t)))
  return [Math.cos(theta) * (radius + lift), (radius * (profile.body === 'glider' ? .85 : profile.body === 'double' ? 1.24 : 1.02) + lift) * y + rise + hump,
    axial(t, frame.length)]
}

function surface(rows: number, columns: number, point: (row: number, col: number) => number[], reverse = false) {
  const positions = [], index = [], uv = []
  for (let row = 0; row <= rows; row++) {
    for (let col = 0; col <= columns; col++) {
      positions.push(...point(row, col))
      uv.push(col / columns, row / rows)
    }
  }
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const a = row * (columns + 1) + col, b = a + columns + 1
      index.push(...(reverse ? [a, b, a + 1, a + 1, b, b + 1] : [a, a + 1, b, a + 1, b + 1, b]))
    }
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geo.setAttribute('uv', new Float32BufferAttribute(uv, 2))
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
  const aircraft = visualFor(frame)
  const mesh = useMemo(() => {
    const geometries = []
    for (let pane = 0; pane < 6; pane++) {
      const first = .36 + (Math.PI - .72) * pane / 6
      const last = first + (Math.PI - .72) / 6 - .028
      geometries.push(surface(5, 6, (row, col) => {
        const theta = lerp(first, last, col / 6)
        const side = Math.abs(Math.cos(theta))
        const from = .51 * aircraft.nose + .027 * side
        const to = glider ? .23 + .027 * side : from + (jumbo ? .02 : .027)
        return fuselagePoint(frame, lerp(from, to, row / 5), theta, .016)
      }))
    }
    return geometries
  }, [aircraft, frame, glider, jumbo])
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
  const doubleDeck = visualFor(frame).body === 'double'
  const doors = useMemo(() => frame.length > 48 ? [.15, .34, .53, .72, .81] : [.15, .48, .78], [frame.length])
  const ref = useRef<InstancedMesh>(null)
  const features = useMemo(() => {
    const windows = []
    for (const side of [-1, 1]) {
      const rows = doubleDeck ? [[count, .14, .86, -.39], [count - 4, .145, .84, .52]] :
        jumbo ? [[count, .145, .825, .21], [15, .123, .33, .86]] : [[count, .14, .81, .31]]
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
  }, [count, doors, doubleDeck, frame, jumbo])

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
        for (const level of doubleDeck ? [-.45, .47] : [0]) {
          const vertices = shape.map(([t, h]) => {
            const theta = level + h * (doubleDeck ? .61 : 1)
            return fuselagePoint(frame, door + t * halfWidth, side === 1 ? theta : Math.PI - theta, .014)
          })
          for (let i = 1; i < vertices.length; i++) points.push(...vertices[i - 1], ...vertices[i])
        }
      }
    }
    return new Float32BufferAttribute(points, 3)
  }, [doors, doubleDeck, frame])
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

function mainWing(frame: Airframe, profile: AircraftVisual): Station[] {
  const half = frame.span / 2
  const sections = [0, .28, .64, .86, .94, .98, 1]
  const taper = frame.taper
  const chords = [1.12, .78, lerp(taper, .78, .41), lerp(taper, .78, .14), taper, taper * .70, taper * .16]
  if (profile.tip === 'plain') chords[6] = taper * .64
  const integrated = sections.slice(1).reduce((sum, t, i) => sum + (t - sections[i]) * (chords[i] + chords[i + 1]) / 2, 0)
  const root = frame.area / (frame.span * integrated)
  const height = profile.tip === 'plain' || profile.tip === 'raked' ? 0 : frame.width *
    (profile.tip === 'blended' ? .48 : profile.tip === 'sharklet' ? .65 : profile.tip === 'fence' ? .25 : .6)
  return sections.map((fraction, i) => ({
    x: fraction * half, chord: root * chords[i],
    rise: Math.tan(frame.dihedral * angle) * fraction * half + height * smooth(.9, 1, fraction) +
      (frame.profile === 'b788' || frame.profile === 'b789' ? half * .064 * fraction ** 3 : 0),
    offset: Math.tan(frame.sweep * angle) * fraction * half + root *
      (profile.tip === 'raked' ? .23 : .09) * smooth(.84, 1, fraction),
  }))
}

// Tie engine and flap-fairing placement to the same interpolated wing geometry.
function wingStationAt(wing: Station[], fraction: number): Station {
  const x = fraction * wing.at(-1)!.x
  const next = wing.findIndex(station => station.x >= x)
  if (next <= 0) return wing[0]
  const from = wing[next - 1], to = wing[next]
  const t = (x - from.x) / (to.x - from.x)
  return { x, chord: lerp(from.chord, to.chord, t), rise: lerp(from.rise, to.rise, t),
    offset: lerp(from.offset, to.offset, t) }
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

function Engine({ radius, position, flat, chevrons }: {
  radius: number; position: [number, number, number]; flat: boolean; chevrons: boolean
}) {
  const shell = useMemo(() => {
    const shape = new LatheGeometry(radiusProfile.map(([r, z]) => new Vector2(r, z)), 72)
    shape.rotateX(Math.PI / 2)
    const positions = shape.attributes.position
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i), z = positions.getZ(i)
      if (flat && y < -.68) positions.setY(i, -.68 + .28 * (y + .68))
      if (chevrons && z >= .8) {
        const theta = Math.atan2(y, positions.getX(i))
        positions.setZ(i, z - .13 * (1 - Math.cos(12 * theta)) * smooth(.78, 1.05, z))
      }
    }
    shape.computeVertexNormals()
    return shape
  }, [chevrons, flat])
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
  const reference = aircraftReference(frame.profile)
  const profile = visualFor(frame)
  const twinProp = profile.body === 'turboprop'
  const splitTip = profile.tip === 'split' || profile.tip === 'fence'
  const dreamliner = frame.profile === 'b788' || frame.profile === 'b789'
  const wing = useMemo(() => mainWing(frame, profile), [frame, profile])
  const body = useMemo(() => surface(88, 64, (row, col) =>
    fuselagePoint(frame, row / 88, col * tau / 64)), [frame])
  const wide = frame.width
  const wingY = wide * (twinProp ? .39 : -.27)
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
  const lowerTip = useMemo(() => {
    const start = wing[4], end = wing.at(-1)!
    return [start, { ...end, chord: end.chord * 1.5,
      rise: start.rise - wide * (profile.tip === 'fence' ? .25 : .44) }]
  }, [profile.tip, wide, wing])
  return <group>
    <mesh><Geometry value={body} />
      <meshPhysicalMaterial color="#e6e7e5" roughness={.31} metalness={.2} clearcoat={.5} clearcoatRoughness={.27} />
    </mesh>
    <Cockpit frame={frame} />
    {reference && <Livery frame={frame} maker={reference.maker} variant={reference.variant} />}
    {profile.cabin > 0 && <Windows frame={frame} count={profile.cabin} />}
    <group position={[0, wingY, wingZ]}>
      <Wing stations={wing} seams />
      {splitTip && <Wing stations={lowerTip} thickness={.12} />}
      {reference && !twinProp && <WingFairings wing={wing} width={wide} />}
    </group>
    <group position={[0, wide * .36, axial(.835, frame.length)]} rotation={[0, 0, Math.PI / 2]}>
      <Wing stations={fin} color="#48525f" single />
    </group>
    <group position={[0, twinProp ? wide * .36 + finHeight * .93 : wide * .28,
      axial(twinProp ? .835 : .865, frame.length) + (twinProp ? root * .55 : 0)]}>
      <Wing stations={stab} seams />
    </group>
    {profile.engineStations.flatMap(fraction => [-1, 1].map(side => {
      const station = wingStationAt(wing, fraction)
      const x = station.x * side
      const y = wingY + station.rise
      const z = wingZ + station.offset
      const pylonHeight = nacelle * 1.05
      if (twinProp) return <Turboprop key={x} position={[x, y - nacelle * .4, z - nacelle * .55]} radius={nacelle} />
      return <group key={x}>
        <Pylon height={pylonHeight} radius={nacelle} position={[x, y, z - nacelle * .16]} />
        <Engine radius={nacelle} flat={frame.profile === 'b738'} chevrons={dreamliner}
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

function Livery({ frame, maker, variant }: { frame: Airframe; maker: string; variant: string }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1536
    canvas.height = 176
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#14283c'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = 'bold 116px system-ui'
    ctx.fillText(`${maker} ${variant}`.toUpperCase(), 768, 83, 1480)
    ctx.fillStyle = '#9b2331'
    ctx.fillRect(170, 151, 1196, 8)
    const map = new CanvasTexture(canvas)
    map.colorSpace = SRGBColorSpace
    map.anisotropy = 4
    return map
  }, [maker, variant])
  useEffect(() => () => texture.dispose(), [texture])
  const decks = visualFor(frame).body === 'double'
  const patches = useMemo(() => [-1, 1].map(side => {
    return surface(12, 56, (row, column) => {
      const u = column / 56
      const t = lerp(.16, .527, side === 1 ? 1 - u : u)
      const theta = lerp(decks ? -.22 : -.43, .095, row / 12)
      return fuselagePoint(frame, t, side === 1 ? theta : Math.PI - theta, Math.max(.048, frame.width * .011))
    })
  }), [decks, frame])
  return <>{patches.map((patch, i) => <mesh key={i}>
    <Geometry value={patch} />
    <meshBasicMaterial map={texture} alphaTest={.33} alphaToCoverage side={DoubleSide} polygonOffset
      polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
  </mesh>)}</>
}

function WingFairings({ wing, width }: { wing: Station[]; width: number }) {
  return <group>
    {[-1, 1].flatMap(side => [.23, .41, .59].map(fraction => {
      const { x, chord, rise, offset } = wingStationAt(wing, fraction)
      return <mesh key={x * side} scale={[width * .044, width * .065, chord * .32]}
        position={[x * side, rise - width * .035, offset + chord * .56]}>
        <sphereGeometry args={[1, 16, 10]} />
        <meshStandardMaterial color="#a2acb5" roughness={.41} metalness={.29} />
      </mesh>
    }))}
  </group>
}

function Turboprop({ position, radius }: { position: [number, number, number]; radius: number }) {
  return <group position={position}>
    <mesh scale={[radius * .73, radius * .70, radius * 2.12]}>
      <sphereGeometry args={[1, 24, 16]} />
      <meshPhysicalMaterial color="#b8bdc6" metalness={.42} roughness={.3} clearcoat={.4} />
    </mesh>
    <group position={[0, 0, -radius * 1.94]}>
      {Array.from({ length: 6 }, (_, i) => <group key={i} rotation={[0, 0, i * tau / 6]}>
        <mesh position={[.98, -.125, 0]} rotation={[0, -.14, -.15]} scale={[.982, .115, .044]}>
          <sphereGeometry args={[1, 16, 10]} /><meshStandardMaterial color="#202631" roughness={.43} />
        </mesh>
        <mesh position={[1.84, -.255, -.126]} scale={[.108, .063, .037]}>
          <sphereGeometry args={[1, 10, 8]} /><meshStandardMaterial color="#d6dbe0" roughness={.42} />
        </mesh>
      </group>)}
      <mesh scale={[radius * .36, radius * .36, radius * .57]}>
        <sphereGeometry args={[1, 20, 12]} /><meshStandardMaterial color="#bac5cf" metalness={.5} roughness={.24} />
      </mesh>
    </group>
  </group>
}
