import { useEffect, useState } from 'react'
import { Activity, ArrowDownToLine, ExternalLink, FlaskConical } from 'lucide-react'
import { api, fmt, post, save, useData, type Dataset, type Model, type Run, type RunSummary, type Status } from './api'
import { Chart } from './Chart'
import { Message, Panel, Stat } from './components'

const origin = (dataset: Dataset) => dataset === 'demo' ? 'SYNTHETIC' : 'NASA C-MAPSS'
const names: Record<Model, string> = { median: 'Median', ridge: 'Ridge', forest: 'Random forest' }
type Props = { dataset: Dataset; setDataset: (value: Dataset) => void; status?: Status }
type Job = { id: string; state: 'running' | 'complete' | 'failed'; detail: string; result?: string }

function Picker({ dataset, setDataset }: Props) {
  return <label>Dataset<select aria-label="Dataset" value={dataset} onChange={e => setDataset(e.target.value as Dataset)}>
    <option value="demo">Synthetic illustrative fleet</option><option value="nasa">NASA C-MAPSS · FD001</option>
  </select></label>
}
function Missing({ status }: { status?: Status }) {
  return <div className="empty">{status ? status.detail ?? 'FD001 is missing.' : 'Checking local FD001 cache…'} <a className="inline" href="#sources">Open data acquisition</a></div>
}

type Fleet = { engines: { id: number; cycles: number }[] }
type History = { channels: string[]; rows: number[][]; endpoint_rul: number }
type Eda = { engines: number; cycles: number; channel_order: string[]; correlation: number[][];
  channels: { name: string; quantiles: number[]; std: number; between_engine_std: number; mean_first_to_last: number; stable: boolean }[] }

export function EngineLab(props: Props) {
  const { dataset, status } = props
  const [partition, setPartition] = useState<'train' | 'test'>('train')
  const [engine, setEngine] = useState<number>()
  const [channel, setChannel] = useState(23)
  const [runId, setRunId] = useState('')
  const [model, setModel] = useState<Model>('forest')
  const [estimate, setEstimate] = useState<{ rul: number; units: string }>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const query = `dataset=${dataset}&partition=${partition}`
  const ready = dataset === 'demo' || status?.available
  const list = useData<Fleet>(ready ? '/engines?' + query : null)
  const unit = list.data?.engines.find(e => e.id === engine) ?? list.data?.engines[0]
  const history = useData<History>(unit && ready ? `/engines/${unit.id}?${query}` : null)
  const eda = useData<Eda>(ready ? '/data/eda?dataset=' + dataset : null)
  const runs = useData<RunSummary[]>(ready ? '/ml/runs?dataset=' + dataset : null)
  const run = runs.data?.find(r => r.id === runId) ?? runs.data?.[0]
  return <>
    <Panel title="Fleet explorer" tag={origin(dataset)} icon={<Activity size={17} />}>
      <div className="controls">
        <div className="form-row">
          <Picker {...props} setDataset={value => { props.setDataset(value); setEngine(undefined); setEstimate(undefined) }} />
          <label>Partition<select aria-label="Partition" value={partition} onChange={e => { setPartition(e.target.value as 'train' | 'test'); setEstimate(undefined) }}><option value="train">Training trajectories</option><option value="test">Truncated test trajectories</option></select></label>
          <label>Engine<select aria-label="Engine" value={unit?.id ?? ''} disabled={!unit} onChange={e => { setEngine(+e.target.value); setEstimate(undefined) }}>
            {!unit && <option value="">Select engine</option>}
            {list.data?.engines.map(e => <option value={e.id} key={e.id}>Engine {e.id} · {e.cycles} cycles</option>)}
          </select></label>
          <label>Channel<select aria-label="Channel" value={channel} disabled={!history.data} onChange={e => setChannel(+e.target.value)}>
            {!history.data && <option value={channel}>Select channel</option>}
            {history.data?.channels.map((name, i) => <option key={name} value={i}>{name.replace('_', ' ')}</option>)}
          </select></label>
        </div>
        {!ready && <Missing status={status} />}
        <Message error message={list.error || history.error} />
        {ready && !history.data && !history.error && <div className="empty">Loading engine trajectory…</div>}
        {history.data && unit && <>
          <Chart series={[{ label: `Engine ${unit.id}`, values: history.data.rows.map(row => [row[0], row[channel + 1]]) }]}
            xLabel="Operating cycle" yLabel={history.data.channels[channel]} origin={origin(dataset)} exportable />
          <p className="muted">{dataset === 'demo' ? 'Illustrative synthetic channel values.' : 'Archived C-MAPSS simulator channel values.'} C-MAPSS engines and the aircraft in Studio are independent.</p>
        </>}
      </div>
    </Panel>
    {ready && <div className="split">
      <Panel title="Endpoint RUL prediction" tag="ML PREDICTION">
        <div className="controls">
          <Message error message={runs.error || error} />
          {!run && !runs.loading && <div className="empty">Train a model for this dataset in <a className="inline" href="#experiments">Experiments</a>.</div>}
          {run && unit && <div className="form-row">
            <label>Training run<select aria-label="Training run" value={run.id} onChange={e => { setRunId(e.target.value); setEstimate(undefined) }}>
              {runs.data?.map(r => <option value={r.id} key={r.id}>{r.id.slice(0, 12)} · seed {r.seed}</option>)}
            </select></label>
            <label>Estimator<select aria-label="Estimator" value={model} onChange={e => { setModel(e.target.value as Model); setEstimate(undefined) }}>
              {Object.entries(names).map(([key, name]) => <option value={key} key={key}>{name}</option>)}
            </select></label>
            <button className="primary" disabled={busy} onClick={async () => {
              setError(''); setEstimate(undefined); setBusy(true)
              try { setEstimate(await post('/ml/predict', { run_id: run.id, dataset, partition, model, engine: unit.id, cycle: unit.cycles })) }
              catch (e) { setError((e as Error).message) } finally { setBusy(false) }
            }}>{busy ? 'Estimating…' : 'Estimate endpoint'}</button>
          </div>}
          {estimate && <Stat label="Estimated remaining useful life" value={fmt(estimate.rul)} unit={estimate.units} note="ML PREDICTION · NO CALIBRATED INTERVAL" />}
          <p className="muted">The model uses the observed endpoint and trailing sensor means. Training trajectories can include engines seen by the model. Use Experiments for holdout performance.</p>
        </div>
      </Panel>
      <Panel className="paper" title="Fleet diagnostics" tag={origin(dataset)}>
        <div className="controls">
          <Message error message={eda.error} />
          {eda.data && <>
            <p className="muted">{eda.data.engines} engines · {fmt(eda.data.cycles, 0)} cycles · training partition</p>
            <div className="table-scroll"><table><caption>Channel summaries · {origin(dataset)}</caption>
              <thead><tr><th>Channel</th><th>Median</th><th>Spread σ</th><th>Between engines σ</th><th>Mean change</th></tr></thead>
              <tbody>{eda.data.channels.map(c => <tr key={c.name}><td>{c.name}{c.stable && ' · stable'}</td><td>{fmt(c.quantiles[2], 3)}</td>
                <td>{fmt(c.std, 3)}</td><td>{fmt(c.between_engine_std, 3)}</td><td>{fmt(c.mean_first_to_last, 3)}</td></tr>)}</tbody>
            </table></div>
            <button className="button" onClick={() => save('aeroforge-eda.json', JSON.stringify(eda.data, null, 2))}>Export EDA and correlations</button>
          </>}
        </div>
      </Panel>
    </div>}
  </>
}

export function ExperimentLab(props: Props) {
  const { dataset, status } = props
  const ready = dataset === 'demo' || status?.available
  const [seed, setSeed] = useState(42)
  const [final, setFinal] = useState(false)
  const [job, setJob] = useState<Job>()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState('')
  const [model, setModel] = useState<Model>('forest')
  const [partition, setPartition] = useState<'validation' | 'test'>('validation')
  const runs = useData<RunSummary[]>(ready ? '/ml/runs?dataset=' + dataset : null)
  const runId = runs.data?.find(r => r.id === selected)?.id ?? runs.data?.[0]?.id
  const detail = useData<Run>(runId ? '/ml/runs/' + runId : null)
  const runningId = job?.state === 'running' ? job.id : undefined
  useEffect(() => {
    if (!runningId) return
    let cancelled = false
    const timer = setInterval(async () => {
      try {
        const data = await api<Job>('/ml/jobs/' + runningId)
        if (cancelled) return
        setJob(data)
        if (data.result) { setSelected(data.result); runs.refresh() }
      } catch (e) {
        if (!cancelled) { setError((e as Error).message); setJob(undefined) }
      }
    }, 600)
    return () => { cancelled = true; clearInterval(timer) }
  }, [runningId])
  const run = detail.data
  const comparison = partition === 'test' && run?.test_ids.length ? 'test' : 'validation'
  const rows = run?.models[model][comparison]?.rows
  return <>
    <Panel title="Train and evaluate" icon={<FlaskConical size={17} />} tag={origin(dataset)}>
      <div className="controls">
        <div className="form-row">
          <Picker {...props} />
          <label>Random seed<input type="number" min="0" max="4294967294" value={seed} onChange={e => setSeed(+e.target.value)} /></label>
          <label className="check"><input type="checkbox" checked={final} onChange={e => setFinal(e.target.checked)} /> Include final test endpoints</label>
          <button className="primary" disabled={!ready || pending || !!runningId || !Number.isInteger(seed) || seed < 0 || seed > 4294967294}
            onClick={async () => {
              setPending(true); setError(''); setJob(undefined)
              try { setJob(await post('/ml/train', { dataset, seed, final })) }
              catch (e) { setError((e as Error).message) } finally { setPending(false) }
            }}>{pending || runningId ? 'Training…' : 'Run comparison'}</button>
        </div>
        {!ready && <Missing status={status} />}
        <Message message={error || runs.error || detail.error || job?.detail} error={!!error || !!runs.error || !!detail.error || job?.state === 'failed'} />
        <p className="muted">80/20 engine-level split with one truncated endpoint per validation engine. Model selection uses validation. Test scoring is an explicit final step.</p>
      </div>
    </Panel>
    {ready && <Panel title="Saved comparisons" tag={`${origin(dataset)} · ML OUTPUT`}>
      <div className="controls">
        {!run && <div className="empty">{runs.loading || detail.loading ? 'Loading saved runs…' : 'No comparison has been run for this dataset.'}</div>}
        {run && rows && <>
          <div className="form-row">
            <label>Experiment<select aria-label="Experiment" value={run.id} onChange={e => setSelected(e.target.value)}>
              {runs.data?.map(r => <option key={r.id} value={r.id}>{r.id.slice(0, 12)} · seed {r.seed}</option>)}
            </select></label>
            <label>Comparison split<select aria-label="Comparison split" value={comparison} onChange={e => setPartition(e.target.value as 'validation' | 'test')}>
              <option value="validation">Validation endpoints</option><option value="test" disabled={!run.test_ids.length}>Final test endpoints</option>
            </select></label>
            <label>Plot estimator<select aria-label="Plot estimator" value={model} onChange={e => setModel(e.target.value as Model)}>
              {Object.entries(names).map(([key, name]) => <option value={key} key={key}>{name}</option>)}
            </select></label>
            <button className="button" onClick={() => save(`aeroforge-${run.id}.json`, JSON.stringify(run, null, 2))}><ArrowDownToLine size={15} /> JSON</button>
            <button className="button" onClick={() => save(`aeroforge-${dataset}-${comparison}-${model}.csv`,
              'dataset,partition,model,engine,cycle,actual_rul_cycles,predicted_rul_cycles,error_cycles\n' +
              rows.map(r => [dataset, comparison, model, r.engine, r.cycle, r.actual, r.prediction, r.error].join(',')).join('\n'), 'text/csv')}>CSV</button>
          </div>
          <div className="table-scroll"><table><caption>{origin(dataset)} · {comparison} endpoint results</caption>
            <thead><tr><th>Estimator</th><th>MAE (cycles)</th><th>RMSE (cycles)</th><th>PHM score</th><th>Fit CPU (s)</th></tr></thead>
            <tbody>{(Object.entries(run.models) as [Model, Run['models'][Model]][]).map(([key, result]) => <tr key={key}>
              <td>{names[key]}</td><td>{fmt(result[comparison]!.metrics.mae, 2)}</td><td>{fmt(result[comparison]!.metrics.rmse, 2)}</td>
              <td>{fmt(result[comparison]!.metrics.phm_score, 2)}</td><td>{fmt(result.fit_cpu_s, 3)}</td>
            </tr>)}</tbody>
          </table></div>
          <div className="split">
            <Chart series={[{ label: 'Actual label', values: rows.map(r => [r.engine, r.actual]) },
              { label: 'ML prediction', values: rows.map(r => [r.engine, r.prediction]) }]}
              xLabel="Engine ID" yLabel="Endpoint RUL (cycles)" origin={origin(dataset)} exportable />
            <Chart series={[{ label: 'Prediction − actual', values: rows.map(r => [r.engine, r.error]) }]}
              xLabel="Engine ID" yLabel="Residual (cycles)" origin={origin(dataset) + ' · ML OUTPUT'} exportable />
          </div>
          <details><summary>Provenance, split and model explanation</summary>
            <p>SHA-256 <code>{run.sha256}</code> · seed {run.seed} · schema {run.schema} · model version {run.version}</p>
            <p>Train engines ({run.train_ids.length}): {run.train_ids.join(', ')}<br />
              Validation engines ({run.validation_ids.length}): {run.validation_ids.join(', ')}<br />
              Test engines ({run.test_ids.length}): {run.test_ids.join(', ') || 'Not scored'}. Test engine IDs belong to a separate fleet partition.</p>
            <p>Features: {run.features.join(', ')}. Predictions are nonnegative and RUL labels are uncapped. No validated prediction intervals.</p>
            {run.models[model].importance && <p>Largest random forest impurity importances: {Object.entries(run.models[model].importance!).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([key, value]) => `${key} (${fmt(value, 3)})`).join(', ')}. Correlated features can share importance.</p>}
          </details>
        </>}
      </div>
    </Panel>}
  </>
}

type Source = { name: string; detail: string; url: string }
export function Sources({ status, refresh }: { status?: Status; refresh: () => void }) {
  const links = useData<Source[]>('/sources')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  const run = async (path: string, file?: File) => {
    setBusy(true); setError(false); setMessage(file ? 'Validating archive…' : 'Downloading and validating FD001…')
    try {
      if (file && file.size > 32 * 1024 * 1024) throw new Error('Maximum ZIP upload size is 32 MiB.')
      const result = await api<{ sha256: string }>('/data/' + path, { method: 'POST', body: file,
        headers: file ? { 'Content-Type': 'application/zip' } : undefined })
      setMessage('FD001 validated and cached. SHA-256 ' + result.sha256); refresh()
    } catch (e) { setError(true); setMessage((e as Error).message) }
    finally { setBusy(false) }
  }
  return <>
    <Panel title="Local C-MAPSS acquisition" tag="NASA FD001">
      <div className="controls">
        <p className="muted">Download the archive linked by NASA PCoE, or import a locally obtained ZIP. AeroForge validates its FD001 members and stores the original archive with a SHA-256 manifest.</p>
        <div className="form-row">
          <button className="primary" disabled={busy} onClick={() => run('download-cmapss')}><ArrowDownToLine size={16} /> Download FD001</button>
          <label className="file-label">Import ZIP<input type="file" accept=".zip,application/zip" disabled={busy} onChange={e => {
            const file = e.target.files?.[0]; e.target.value = ''; if (file) void run('import-cmapss', file)
          }} /></label>
        </div>
        <Message message={message} error={error} />
        {status?.available && <div className="data-rows"><div><span>Train / test engines</span><strong>{status.train_engines} / {status.test_engines}</strong></div><div><span>Archive SHA-256</span><code>{status.sha256}</code></div></div>}
        {!status?.available && <Message message={status?.detail} />}
      </div>
    </Panel>
    <div className="split">
      <Panel className="paper" title="Primary sources">
        <div className="controls">
          <Message message={links.error} error />
          {links.loading && <p>Loading citations…</p>}
          {links.data?.map(link => <div className="source" key={link.url}>
            <a className="inline" href={link.url} target="_blank" rel="noreferrer">{link.name}<ExternalLink size={13} /></a>
            <p>{link.detail}</p>
          </div>)}
        </div>
      </Panel>
      <Panel className="paper" title="Model cards and use limits">
        <div className="controls prose">
          <h3>Analytic flight model</h3><p>Dry standard atmosphere, a parabolic drag polar and a longitudinal point mass. See Flight Physics for equations and bounds. This is a research approximation.</p>
          <h3>Engine prognostics</h3><p>Median, standardized ridge and random forest predict cycles from current and trailing observations. Scores use engine-wise holdouts. Synthetic trajectories and NASA simulator runs have separate experiments.</p>
          <h3>Reproducibility</h3><p>Each run records its source, SHA-256, seed, features and split IDs. Model cards are generated locally in <code>artifacts/&lt;run-id&gt;/model_card.md</code>.</p>
          <h3>External integrations</h3><p>OpenVSP, Aviary and ASRS are documented external resources. Their tools and adapters are unavailable in this release.</p>
        </div>
      </Panel>
    </div>
  </>
}
