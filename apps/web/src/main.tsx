import { useEffect, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { Activity, ArrowDownToLine, ArrowRight, Atom, Box, FlaskConical, Gauge,
  LayoutGrid, Library, Orbit, Plane, Radar, ShieldAlert } from 'lucide-react'
import { api, defaultFlight, dimensions, fallback, fmt, post, save, useData,
  type Airframe, type Dataset, type Flight, type Physics, type RunSummary, type Status } from './api'
import { Message, Panel, Range, Stat } from './components'
import { Scene } from './Scene'
import { PhysicsLab } from './PhysicsLab'
import { EngineLab, ExperimentLab, Sources } from './Research'
import '@fontsource-variable/public-sans'
import '@fontsource/barlow-condensed/latin-700.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import './style.css'

const tabs = [
  { id: 'overview', label: 'Mission Control', icon: LayoutGrid },
  { id: 'aircraft', label: 'Aircraft Studio', icon: Box },
  { id: 'physics', label: 'Flight Physics', icon: Gauge },
  { id: 'engines', label: 'Engine Health', icon: Activity },
  { id: 'experiments', label: 'Experiments', icon: FlaskConical },
  { id: 'sources', label: 'Research & Sources', icon: Library },
] as const
type Page = typeof tabs[number]['id']
const pageFromHash = (): Page => tabs.find(tab => '#' + tab.id === location.hash)?.id ?? 'overview'

function Header({ kicker, title, description, action }: {
  kicker: string; title: string; description: string; action?: ReactNode
}) {
  return <header className="page-head"><div><div className="kicker">{kicker}</div>
    <h1>{title}</h1><p>{description}</p></div>{action}</header>
}

function Overview({ frame, preset, physics, status }: {
  frame: Airframe; preset: string; physics?: Physics; status?: Status
}) {
  const runs = useData<RunSummary[]>('/ml/runs?dataset=demo')
  return <>
    <header className="command-hero">
      <div className="hero-copy">
        <div className="kicker">AEROSPACE RESEARCH WORKBENCH</div>
        <h1>Mission Control</h1>
        <p>Design. Simulate. Diagnose.</p>
        <a className="primary button" href="#aircraft">Open Aircraft Studio <ArrowRight size={17} /></a>
      </div>
      <div className="hero-preview">
        <Scene airframe={frame} />
        <div className="hero-config"><Orbit size={15} /><span>{preset}</span><small>·</small><small>SCHEMA V{frame.version}</small></div>
      </div>
    </header>
    <div className="stats">
      <Stat label="Wing span" value={fmt(frame.span)} unit="m" note="AIRFRAME GEOMETRY" />
      <Stat label="Aspect ratio" value={fmt(dimensions(frame).aspect_ratio, 2)} note="AIRFRAME GEOMETRY" />
      <Stat label="Lift-to-drag ratio" value={physics ? fmt(physics.ld, 2) : '—'} note="ANALYTIC MODEL" />
      <Stat label="Mach number" value={physics ? fmt(physics.mach, 3) : '—'} unit="M" note="ANALYTIC MODEL" />
    </div>
    <div className="overview-grid">
      <Panel title="Research modules" icon={<LayoutGrid size={17} />}>
        <div className="modules">
          <a href="#physics"><span className="module-icon"><Gauge size={19} /></span><div><strong>Flight Physics</strong><small>Forces, trim and flight segments</small></div><ArrowRight size={16} /></a>
          <a href="#engines"><span className="module-icon amber"><Activity size={19} /></span><div><strong>Engine Health</strong><small>Sensor history and RUL estimates</small></div><ArrowRight size={16} /></a>
          <a href="#experiments"><span className="module-icon purple"><FlaskConical size={19} /></span><div><strong>Experiments</strong><small>Engine-wise model comparisons</small></div><ArrowRight size={16} /></a>
        </div>
      </Panel>
      <Panel title="Data on this machine" icon={<Radar size={17} />} className="paper">
        <div className="data-rows"><div><span>Synthetic illustrative fleet</span><span className="tag">AVAILABLE</span></div>
          <div><span>NASA C-MAPSS FD001</span><span className={status?.available ? 'tag' : 'tag amber'}>{status ? status.available ? 'IMPORTED' : 'OPTIONAL' : 'CHECKING'}</span></div></div>
        <a className="inline" href="#sources">View provenance <ArrowRight size={14} /></a>
      </Panel>
    </div>
    <Panel title="Recent synthetic experiments" icon={<FlaskConical size={17} />} tag="ML OUTPUT">
      <Message message={runs.error} error />
      <div className="data-rows">{runs.loading ? <div>Loading local runs…</div> : runs.data?.length ?
        runs.data.slice(0, 3).map(run => <div key={run.id}><span className="mono">{run.id.slice(0, 12)}</span><span>Seed {run.seed}</span></div>) :
        <div>No synthetic experiments yet. <a className="inline" href="#experiments">Run a comparison <ArrowRight size={14} /></a></div>}</div>
    </Panel>
  </>
}

const sliders: { key: Exclude<keyof Airframe, 'version'>; label: string; min: number; max: number; step: number; unit?: string }[] = [
  { key: 'span', label: 'Wing span', min: 12, max: 42, step: .1, unit: 'm' },
  { key: 'area', label: 'Wing area', min: 25, max: 160, step: 1, unit: 'm²' },
  { key: 'taper', label: 'Taper ratio', min: .2, max: 1, step: .01 },
  { key: 'sweep', label: 'Quarter-chord sweep', min: 0, max: 40, step: 1, unit: '°' },
  { key: 'dihedral', label: 'Dihedral', min: 0, max: 12, step: .5, unit: '°' },
  { key: 'length', label: 'Fuselage length', min: 12, max: 46, step: .1, unit: 'm' },
  { key: 'width', label: 'Fuselage diameter', min: 1.3, max: 6, step: .1, unit: 'm' },
  { key: 'tail', label: 'Tail scale', min: .55, max: 1.45, step: .01 },
]

function Studio({ frame, preset, update }: { frame: Airframe; preset: string; update: (a: Airframe, name: string) => void }) {
  const presets = useData<Record<string, Airframe>>('/config/presets')
  const [selected, select] = useState(preset === 'Custom' || preset === 'Imported' ? 'Regional' : preset)
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const d = dimensions(frame)
  return <>
    <Header kicker="AIRFRAME GEOMETRY" title="Aircraft Studio"
      description="Shape a conceptual airframe and carry the wing geometry into Flight Physics."
      action={<button className="button" onClick={() => save('aeroforge-airframe-v1.json', JSON.stringify(frame, null, 2))}><ArrowDownToLine size={17} /> Export JSON</button>} />
    <div className="work-grid">
      <div className="stack">
        <Panel title={preset} tag="SCHEMA V1" className="viewport studio-viewport"><Scene airframe={frame} /></Panel>
        <div className="stats three">
          <Stat label="Aspect ratio" value={fmt(d.aspect_ratio, 2)} note="GEOMETRY OUTPUT" />
          <Stat label="Root chord" value={fmt(d.root_chord, 2)} unit="m" note="GEOMETRY OUTPUT" />
          <Stat label="Tip chord" value={fmt(d.tip_chord, 2)} unit="m" note="GEOMETRY OUTPUT" />
        </div>
      </div>
      <Panel title="Airframe configuration" icon={<Box size={17} />}>
        <div className="controls">
          <Message message={error || presets.error} error />
          <div className="form-row">
            <label>Preset<select aria-label="Preset" value={selected} disabled={!presets.data} onChange={e => {
              select(e.target.value); update(presets.data![e.target.value], e.target.value)
            }}>{Object.keys(presets.data ?? { Regional: fallback }).map(v => <option key={v}>{v}</option>)}</select></label>
            <button className="button" disabled={!presets.data} onClick={() => update(presets.data![selected], selected)}>Reset preset</button>
          </div>
          {sliders.map(({ key, label, ...options }) => <Range key={key} name={label} value={frame[key]} {...options}
            onChange={value => update({ ...frame, [key]: value }, 'Custom')} />)}
          <label className="file-label">{importing ? 'Validating configuration…' : 'Import airframe JSON'}
            <input disabled={importing} type="file" accept=".json,application/json" onChange={async e => {
              const file = e.target.files?.[0]; e.target.value = ''; if (!file) return
              setImporting(true); setError('')
              try {
                if (file.size > 32768) throw new Error('Airframe JSON must be under 32 KiB.')
                const value = JSON.parse(await file.text())
                if (value?.version !== 1) throw new Error('Expected airframe schema version 1.')
                const result = await post<{config: Airframe}>('/config/validate', value)
                update(result.config, 'Imported')
              } catch (e) { setError(String((e as Error).message)) } finally { setImporting(false) }
            }} />
          </label>
        </div>
      </Panel>
    </div>
  </>
}

function App() {
  const [page, setPage] = useState(pageFromHash)
  const [frame, setFrame] = useState(fallback)
  const [preset, setPreset] = useState('Regional')
  const [flight, setFlight] = useState(defaultFlight)
  const [physics, setPhysics] = useState<Physics>()
  const [physicsError, setPhysicsError] = useState('')
  const [dataset, setDataset] = useState<Dataset>('demo')
  const dataStatus = useData<Status>('/data/status')
  const health = useData<{ notice: string }>('/health')
  useEffect(() => {
    const change = () => { setPage(pageFromHash()); window.scrollTo(0, 0) }
    addEventListener('hashchange', change)
    return () => removeEventListener('hashchange', change)
  }, [])
  useEffect(() => {
    const c = new AbortController()
    const id = setTimeout(() => {
      api<Physics>('/physics/compute', { signal: c.signal, method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...flight, airframe: frame }) })
        .then(data => { setPhysics(data); setPhysicsError('') })
        .catch(e => { if (!c.signal.aborted) { setPhysics(undefined); setPhysicsError(e.message) } })
    }, 135)
    return () => { clearTimeout(id); c.abort() }
  }, [flight, frame])
  const header = (kicker: string, title: string, description: string) =>
    <Header kicker={kicker} title={title} description={description} />
  return <div className="layout">
    <a href="#main-content" className="skip" onClick={e => { e.preventDefault(); document.querySelector<HTMLElement>('main')?.focus() }}>Skip to content</a>
    <div className="global-nav">
      <a href="#overview" className="brand"><span className="brand-mark"><Plane size={23} /></span><span>Aero<span>Forge</span><small>RESEARCH WORKBENCH</small></span></a>
      <nav aria-label="Workspace">
        {tabs.map(({ id, label, icon: Icon }) => <a key={id} href={'#' + id} aria-current={page === id ? 'page' : undefined}>
          <Icon size={18} /><span>{label}</span></a>)}
      </nav>
    </div>
    <div className="workspace">
      <div className="toolbar"><div><Atom size={17} /><span>Workspace</span><b>/</b><strong>{tabs.find(t => t.id === page)?.label}</strong></div>
        <span className={health.data ? 'online' : 'offline'}><i />{health.data ? 'Local API online' : health.loading ? 'Connecting to local API' : 'Local API unavailable'}</span>
      </div>
      <main id="main-content" tabIndex={-1} data-page={page}>
        {page === 'overview' && <Overview frame={frame} preset={preset} physics={physics} status={dataStatus.data} />}
        {page === 'aircraft' && <Studio frame={frame} preset={preset} update={(a, n) => { setFrame(a); setPreset(n) }} />}
        {page === 'physics' && <>{header('FLIGHT DYNAMICS', 'Flight Physics', 'Calculate aerodynamic forces and integrate a climb or cruise segment.')}
          <PhysicsLab frame={frame} flight={flight} update={setFlight} physics={physics} error={physicsError} /></>}
        {page === 'engines' && <>{header('TURBOFAN PROGNOSTICS', 'Engine Health', 'Explore sensor trajectories and estimate remaining useful life in operating cycles.')}
          <EngineLab dataset={dataset} setDataset={setDataset} status={dataStatus.data} /></>}
        {page === 'experiments' && <>{header('REPRODUCIBLE BENCHMARKS', 'Experiments', 'Compare three RUL models on disjoint engines and export the results.')}
          <ExperimentLab dataset={dataset} setDataset={setDataset} status={dataStatus.data} /></>}
        {page === 'sources' && <>{header('METHODS & PROVENANCE', 'Research & Sources', 'Inspect data origins, model assumptions and local research integrations.')}
          <Sources status={dataStatus.data} refresh={dataStatus.refresh} /></>}
      </main>
      <footer className="research-footer"><ShieldAlert size={15} />{health.data?.notice ?? 'Research and education only — not for operational flight or maintenance decisions.'}</footer>
    </div>
  </div>
}

createRoot(document.getElementById('root')!).render(<App />)
