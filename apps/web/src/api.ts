import { useEffect, useState } from 'react'

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch('/api' + path, init)
  const data = await response.json()
  if (!response.ok) {
    const detail = data.detail
    throw new Error(typeof detail === 'string' ? detail :
      Array.isArray(detail) ? detail.map(x => `${x.loc.at(-1)}: ${x.msg}`).join(' · ') :
        'The local API could not complete the request.')
  }
  return data as T
}

export function post<T>(path: string, body: unknown) {
  return api<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body) })
}

export function useData<T>(path: string | null) {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean; path?: string | null }>({ loading: !!path })
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setState({ loading: !!path, path })
    if (path) api<T>(path, { signal: controller.signal })
      .then(data => setState({ data, loading: false, path }))
      .catch(error => { if (!controller.signal.aborted) setState({ error: error.message, loading: false, path }) })
    return () => controller.abort()
  }, [path, revision])
  return { ...(state.path === path ? state : { loading: !!path }), refresh: () => setRevision(n => n + 1) }
}

export function save(filename: string, value: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([value], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export type Airframe = {
  version: 1; span: number; area: number; taper: number; sweep: number;
  dihedral: number; length: number; width: number; tail: number
}
export const fallback: Airframe = { version: 1, span: 28, area: 78, taper: .36,
  sweep: 22, dihedral: 5, length: 25, width: 2.8, tail: 1 }
export type Dimensions = { aspect_ratio: number; root_chord: number; tip_chord: number }
export const dimensions = (a: Airframe): Dimensions => {
  const root = 2 * a.area / (a.span * (1 + a.taper))
  return { aspect_ratio: a.span ** 2 / a.area, root_chord: root, tip_chord: root * a.taper }
}
export type Flight = { mass: number; altitude: number; speed: number; cl: number;
  cd0: number; efficiency: number; throttle: number; thrust: number }
export const defaultFlight: Flight = { mass: 17500, altitude: 1800, speed: 112, cl: .45,
  cd0: .025, efficiency: .82, throttle: .48, thrust: 38000 }
export type Physics = Dimensions & { q: number; lift: number; drag: number; mach: number; cd: number;
  cl_required: number; ld: number; thrust: number; warnings: string[];
  density: number; temperature: number; pressure: number; excess_power: number }
export type Sample = { t: number; distance: number; altitude: number; speed: number; angle: number }
export type Segment = { samples: Sample[]; profile: string; reason: string }
export type Dataset = 'demo' | 'nasa'
export type Status = { available: boolean; detail?: string; sha256?: string; source?: string;
  train_engines?: number; test_engines?: number }
export type RunSummary = { id: string; seed: number; source: string; sha256: string }
export type Row = { engine: number; cycle: number; actual: number; prediction: number; error: number }
export type Evaluation = { metrics: { mae: number; rmse: number; phm_score: number }; rows: Row[] }
export type Model = 'median' | 'ridge' | 'forest'
export type Run = RunSummary & { dataset: Dataset; schema: string; version: string; features: string[];
  train_ids: number[]; validation_ids: number[]; test_ids: number[];
  models: Record<Model, { fit_cpu_s: number; parameters: object; validation: Evaluation;
    test?: Evaluation; importance?: Record<string, number> }> }
export const fmt = (value: number, fraction = 1) => new Intl.NumberFormat('en-US', {
  minimumFractionDigits: fraction, maximumFractionDigits: fraction,
}).format(value)
