import { useId, useState } from 'react'
import { fmt, save } from './api'

export function Chart({ series, xLabel, yLabel, origin, cursor, exportable = false }: {
  series: { label: string; values: [number, number][] }[]; xLabel: string; yLabel: string;
  origin: string; cursor?: number; exportable?: boolean
}) {
  const id = useId()
  const [hover, setHover] = useState<number>()
  const points = series.flatMap(s => s.values)
  if (!points.length) return <div className="empty">No plotted values.</div>
  const width = 670, height = 230, left = 58, right = 17, top = 14, bottom = 40
  const xMin = Math.min(...points.map(p => p[0]))
  const xMax = Math.max(...points.map(p => p[0]))
  const yMin = Math.min(...points.map(p => p[1]))
  const yMax = Math.max(...points.map(p => p[1]))
  const xSpan = xMax - xMin || 1, ySpan = yMax - yMin || 1
  const x = (n: number) => left + (n - xMin) / xSpan * (width - left - right)
  const y = (n: number) => height - bottom - (n - yMin) / ySpan * (height - bottom - top)
  const colors = ['#80bdff', '#ff8b7f', '#f7bf75']
  const value = hover ?? cursor
  const ticks = [0, .25, .5, .75, 1]
  return <figure className="chart">
    <figcaption><strong>{yLabel}</strong><span className="tag">{origin}</span>
      {exportable && <button className="quiet" onClick={() => {
        const node = document.getElementById(id)!
        save('aeroforge-chart.svg', new XMLSerializer().serializeToString(node), 'image/svg+xml')
      }}>Export SVG</button>}</figcaption>
    <svg xmlns="http://www.w3.org/2000/svg" id={id} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${yLabel} by ${xLabel}, ${origin}`}
      onPointerMove={e => {
        const rect = e.currentTarget.getBoundingClientRect()
        const fraction = ((e.clientX - rect.left) / rect.width * width - left) / (width - left - right)
        setHover(xMin + Math.min(1, Math.max(0, fraction)) * xSpan)
      }} onPointerLeave={() => setHover(undefined)}>
      <rect width={width} height={height} fill="#111720" />
      {ticks.map(t => <g key={t} fill="#9eb2c6" fontSize="11" fontFamily="monospace">
        <path d={`M ${left} ${y(yMin + t * ySpan)} H ${width - right}`} stroke="#294054" />
        <text x={left - 8} y={y(yMin + t * ySpan) + 4} textAnchor="end">{fmt(yMin + t * ySpan, ySpan < 10 ? 2 : 0)}</text>
        <text x={x(xMin + t * xSpan)} y={height - 20} textAnchor="middle">{fmt(xMin + t * xSpan, 0)}</text>
      </g>)}
      {series.map((s, i) => <g key={s.label} fill={colors[i]}>
        <polyline points={s.values.map(([u, v]) => `${x(u)},${y(v)}`).join(' ')}
          fill="none" stroke={colors[i]} strokeWidth="2" strokeLinejoin="round" />
        {s.values.length <= 20 && s.values.map(([u, v], j) => <circle key={j} cx={x(u)} cy={y(v)} r="2.5" />)}
      </g>)}
      {value !== undefined && <line x1={x(value)} x2={x(value)} y1={top} y2={height - bottom} stroke="#d1deea" strokeDasharray="4 4" />}
      <text x={width / 2} y={height - 5} textAnchor="middle" fill="#a9bcd0" fontSize="11">{xLabel}</text>
    </svg>
    <div className="legend">{series.map((s, i) => <span key={s.label}><i style={{ background: colors[i] }} />{s.label}</span>)}
      {value !== undefined && <span>{xLabel} {fmt(value, 1)}</span>}</div>
  </figure>
}
