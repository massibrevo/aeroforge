import { useEffect, useState } from 'react'
import { Play, Square } from 'lucide-react'
import { fmt, post, type Airframe, type Flight, type Physics, type Segment } from './api'
import { Chart } from './Chart'
import { Scene } from './Scene'
import { Message, Panel, Range, Stat } from './components'

const controls: { key: keyof Flight; name: string; min: number; max: number; step?: number; unit?: string }[] = [
  { key: 'mass', name: 'Mass', min: 2000, max: 100000, step: 100, unit: 'kg' },
  { key: 'altitude', name: 'Initial altitude', min: 0, max: 11000, step: 25, unit: 'm' },
  { key: 'speed', name: 'Initial airspeed', min: 25, max: 240, unit: 'm/s' },
  { key: 'cl', name: 'Imposed lift coefficient', min: 0, max: 1.5, step: .01 },
  { key: 'cd0', name: 'Zero-lift drag coefficient', min: .008, max: .15, step: .001 },
  { key: 'efficiency', name: 'Span efficiency', min: .45, max: 1, step: .01 },
  { key: 'throttle', name: 'Throttle fraction', min: 0, max: 1, step: .01 },
  { key: 'thrust', name: 'Sea-level thrust', min: 1000, max: 180000, step: 1000, unit: 'N' },
]

export function PhysicsLab({ frame, flight, physics, error, update }: {
  frame: Airframe; flight: Flight; physics?: Physics; error: string; update: (flight: Flight) => void
}) {
  const [profile, setProfile] = useState('climb')
  const [duration, setDuration] = useState(90)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const [result, setResult] = useState<Segment>()
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const sample = result?.samples[index]
  useEffect(() => {
    if (!playing || !result) return
    const timer = setInterval(() => setIndex(i => Math.min(i + 1, result.samples.length - 1)), 40)
    return () => clearInterval(timer)
  }, [playing, result])
  useEffect(() => {
    if (result && index === result.samples.length - 1) setPlaying(false)
  }, [result, index])

  return <>
    <Message message={error} error />
    <div className="stats">
      <Stat label="Lift" value={physics ? fmt(physics.lift / 1000) : '—'} unit="kN" note="ANALYTIC MODEL" />
      <Stat label="Drag" value={physics ? fmt(physics.drag / 1000) : '—'} unit="kN" note="ANALYTIC MODEL" />
      <Stat label="Dynamic pressure" value={physics ? fmt(physics.q) : '—'} unit="Pa" note="ANALYTIC MODEL" />
      <Stat label="Lift coefficient for trim" value={physics ? fmt(physics.cl_required, 3) : '—'} note="ANALYTIC MODEL" />
    </div>
    {physics?.warnings.map(warning => <Message key={warning} message={warning} error />)}
    <div className="work-grid">
      <div className="stack">
        <Panel title="Longitudinal segment" tag="PHYSICS SIMULATION">
          <div className="controls">
            <div className="form-row">
              <label>Mission profile<select aria-label="Mission profile" value={profile} onChange={e => setProfile(e.target.value)}><option value="climb">Climb · 3° target</option><option value="cruise">Cruise · level target</option></select></label>
              <label>Duration (s)<input type="number" min="10" max="240" value={duration} onChange={e => setDuration(+e.target.value)} /></label>
              <button className="primary" disabled={busy || duration < 10 || duration > 240 || !Number.isInteger(duration)}
                onClick={async () => {
                  setBusy(true); setFailure(''); setPlaying(false); setResult(undefined)
                  try {
                    const data = await post<Segment>('/physics/simulate', { ...flight, airframe: frame, profile, duration })
                    setIndex(0); setResult(data)
                  } catch (e) { setFailure((e as Error).message) } finally { setBusy(false) }
                }}><Play size={16} />{busy ? 'Integrating…' : 'Run simulation'}</button>
            </div>
            <Message error message={failure} />
            {!result && <div className="empty">Run a segment to plot the integrated trajectory.</div>}
          </div>
          {result && sample && <>
            <Scene airframe={frame} samples={result.samples} index={index} />
            <div className="controls">
              <Message message={`${result.profile.toUpperCase()} · ${result.reason} at ${fmt(result.samples.at(-1)!.t)} s`} />
              <div className="playhead">
                <button className="button" aria-label={playing ? 'Pause trajectory' : 'Play trajectory'}
                  onClick={() => { if (playing) setPlaying(false); else { if (index === result.samples.length - 1) setIndex(0); setPlaying(true) } }}>
                  {playing ? <Square size={16} /> : <Play size={16} />}
                </button>
                <input type="range" aria-label="Trajectory playhead" min="0" max={result.samples.length - 1} value={index}
                  onChange={e => { setPlaying(false); setIndex(+e.target.value) }} />
                <output>{fmt(sample.t)} s · {fmt(sample.altitude)} m · {fmt(sample.speed)} m/s</output>
              </div>
              <Chart series={[{ label: 'Altitude', values: result.samples.map(s => [s.t, s.altitude]) }]} xLabel="Time (s)" yLabel="Altitude (m)" cursor={sample.t} origin="PHYSICS SIMULATION" exportable />
              <Chart series={[{ label: 'Airspeed', values: result.samples.map(s => [s.t, s.speed]) }]} xLabel="Time (s)" yLabel="Airspeed (m/s)" cursor={sample.t} origin="PHYSICS SIMULATION" exportable />
            </div>
          </>}
        </Panel>
        <Panel title="Model and validity" tag="SI UNITS">
          <div className="controls prose">
            <p>q = ½ρV² · L = qSCL · D = qS[CD₀ + CL²/(πeAR)] · CL,trim = mg/(qS)</p>
            <p>The static calculation uses the imposed CL. During integration, bounded path-angle feedback chooses CL. Dry standard troposphere, still air, constant mass and density-scaled thrust. Limit: Mach 0.72, CL 1.5, altitude 0–11,000 m.</p>
            {physics && <p>Mach {fmt(physics.mach, 3)} · L/D {fmt(physics.ld, 2)} · ρ {fmt(physics.density, 3)} kg/m³ · excess power {fmt(physics.excess_power / 1000)} kW</p>}
          </div>
        </Panel>
      </div>
      <Panel title="Flight inputs" tag={`${frame.area} M² WING`}>
        <div className="controls">{controls.map(({ key, ...options }) => <Range key={key} {...options} value={flight[key]} onChange={value => update({ ...flight, [key]: value })} />)}
          <a className="inline" href="#aircraft">Edit wing area in Aircraft Studio</a>
        </div>
      </Panel>
    </div>
  </>
}
