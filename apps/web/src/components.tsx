import type { ReactNode } from 'react'

export function Panel({ title, icon, tag, children, className = '' }: {
  title: string; icon?: ReactNode; tag?: string; children: ReactNode; className?: string
}) {
  return <section className={`panel ${className}`}>
    <div className="panel-top"><h2>{icon}{title}</h2>{tag && <span className="tag">{tag}</span>}</div>
    {children}
  </section>
}

export function Message({ message, error = false }: { message?: string; error?: boolean }) {
  return message ? <div className={`message ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}>{message}</div> : null
}

export function Stat({ label, value, unit, note }: { label: string; value: string; unit?: string; note?: string }) {
  return <div className="stat"><span>{label}</span><strong>{value} <small>{unit}</small></strong>{note && <p>{note}</p>}</div>
}

export function Range({ name, value, min, max, step = 1, unit, onChange }: {
  name: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (value: number) => void
}) {
  return <label className="range"><span>{name}<output>{value} {unit}</output></span>
    <input aria-label={name} type="range" value={value} min={min} max={max} step={step} onChange={e => onChange(+e.target.value)} />
    <span className="bounds"><span>{min} {unit}</span><span>{max} {unit}</span></span>
  </label>
}
