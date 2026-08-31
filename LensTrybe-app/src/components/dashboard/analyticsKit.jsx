// Analytics helpers + inline-SVG charts (no external libraries).
import { useState } from 'react'

export function currency(n) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(Number(n || 0))
}
export function currency2(n) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n || 0))
}

// Last n months ending with the current month.
export function monthBuckets(n) {
  const now = new Date()
  const out = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleDateString('en-AU', { month: 'short' }), date: d })
  }
  return out
}
export function monthKeyOf(v) {
  if (!v) return ''
  const d = new Date(v)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Percentage change of the last value vs the first half average (simple trend).
export function trendPct(series) {
  if (!series || series.length < 2) return null
  const half = Math.max(1, Math.floor(series.length / 2))
  const prev = series.slice(0, half).reduce((a, b) => a + b, 0) / half
  const recent = series.slice(half).reduce((a, b) => a + b, 0) / (series.length - half)
  if (!prev) return recent ? 100 : 0
  return Math.round(((recent - prev) / prev) * 100)
}

function niceTicks(min, max, count) {
  if (max === min) max = min + 1
  const range = max - min
  const step0 = range / count
  const mag = Math.pow(10, Math.floor(Math.log10(step0 || 1)))
  const norm = step0 / mag
  const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag
  const start = Math.floor(min / step) * step
  const end = Math.ceil(max / step) * step
  const out = []
  for (let v = start; v <= end + 1e-9; v += step) out.push(Math.round(v * 1000) / 1000)
  return out
}

// Compact responsive line + area, no axes (for the tile).
export function Sparkline({ data, color = '#a855f7', height = 58 }) {
  const d = data && data.length ? data : [0, 0]
  const W = 300, H = 100
  const max = Math.max(...d), min = Math.min(...d)
  const span = (max - min) || 1
  const xAt = (i) => (d.length <= 1 ? W / 2 : (i / (d.length - 1)) * W)
  const yAt = (v) => 6 + (H - 12) - ((v - min) / span) * (H - 12)
  const line = d.map((v, i) => `${i ? 'L' : 'M'}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(' ')
  const area = `${line} L${W},${H} L0,${H} Z`
  const gid = 'lt-spark-' + color.replace('#', '')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={height} preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.4" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

// Small dark tooltip drawn inside the SVG (theme-independent, always readable).
function svgTooltip({ x, y, lines, width: bw, plotW, padL, padR, chartW, anchorTop }) {
  const bh = 8 + lines.length * 15
  let bx = x - bw / 2
  bx = Math.max(padL, Math.min(bx, chartW - padR - bw))
  let by = anchorTop ? y + 12 : y - bh - 12
  if (by < 2) by = y + 12
  return (
    <g pointerEvents="none">
      <rect x={bx} y={by} width={bw} height={bh} rx="8" fill="rgba(10,10,16,0.94)" stroke="rgba(255,255,255,0.16)" />
      {lines.map((ln, i) => (
        <g key={i}>
          {ln.swatch ? <rect x={bx + 10} y={by + 8 + i * 15 + 1} width="9" height="9" rx="2.5" fill={ln.swatch} /> : null}
          <text x={ln.swatch ? bx + 24 : bx + 11} y={by + 8 + i * 15 + 9} fontSize="11" fontWeight={ln.bold ? 700 : 500} fill={ln.dim ? 'rgba(255,255,255,0.6)' : '#fff'} fontFamily="Inter, sans-serif">{ln.text}</text>
          {ln.right != null ? <text x={bx + bw - 11} y={by + 8 + i * 15 + 9} textAnchor="end" fontSize="11" fontWeight="700" fill="#fff" fontFamily="Inter, sans-serif">{ln.right}</text> : null}
        </g>
      ))}
    </g>
  )
}

// Full area chart with y grid + labels and x labels (for expanded view). Hover
// anywhere to see the real figure for that point.
export function AreaChart({ data, xLabels, color = '#a855f7', width = 680, height = 260, yFormat = (v) => String(v) }) {
  const [hover, setHover] = useState(null)
  const d = data && data.length ? data : [0]
  const padL = 52, padR = 10, padT = 12, padB = 26
  const plotW = width - padL - padR
  const plotH = height - padT - padB
  const rawMax = Math.max(...d, 1)
  const rawMin = Math.min(...d, 0)
  const ticks = niceTicks(rawMin, rawMax, 4)
  const yMin = ticks[0]
  const yMax = ticks[ticks.length - 1]
  const span = (yMax - yMin) || 1
  const xAt = (i) => padL + (d.length <= 1 ? plotW / 2 : (i / (d.length - 1)) * plotW)
  const yAt = (v) => padT + plotH - ((v - yMin) / span) * plotH
  const line = d.map((v, i) => `${i ? 'L' : 'M'}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(' ')
  const area = `${line} L${xAt(d.length - 1).toFixed(1)},${(padT + plotH).toFixed(1)} L${xAt(0).toFixed(1)},${(padT + plotH).toFixed(1)} Z`
  const gid = 'lt-area-' + color.replace('#', '')
  const labelEvery = xLabels && xLabels.length > 8 ? Math.ceil(xLabels.length / 8) : 1
  const band = (i) => {
    const left = i === 0 ? padL : (xAt(i - 1) + xAt(i)) / 2
    const right = i === d.length - 1 ? width - padR : (xAt(i) + xAt(i + 1)) / 2
    return { left, w: Math.max(1, right - left) }
  }
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ display: 'block', maxWidth: '100%' }} onMouseLeave={() => setHover(null)}>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.32" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      {ticks.map((tv, i) => {
        const y = yAt(tv)
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="var(--lt-chart-grid)" strokeWidth="1" />
            <text x={padL - 8} y={y + 3.5} textAnchor="end" fontSize="10.5" fill="var(--lt-chart-axis)" fontFamily="Inter, sans-serif">{yFormat(tv)}</text>
          </g>
        )
      })}
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {(xLabels || []).map((lb, i) => (i % labelEvery === 0 ? (
        <text key={i} x={xAt(i)} y={height - 8} textAnchor="middle" fontSize="10.5" fill="var(--lt-chart-axis)" fontFamily="Inter, sans-serif">{lb}</text>
      ) : null))}
      {hover != null ? (
        <g pointerEvents="none">
          <line x1={xAt(hover)} y1={padT} x2={xAt(hover)} y2={padT + plotH} stroke={color} strokeOpacity="0.4" strokeWidth="1" />
          <circle cx={xAt(hover)} cy={yAt(d[hover])} r="4.5" fill={color} stroke="#fff" strokeWidth="1.5" />
          {svgTooltip({ x: xAt(hover), y: yAt(d[hover]), chartW: width, padL, padR, plotW, anchorTop: yAt(d[hover]) < padT + 44,
            width: Math.max(70, ((xLabels && xLabels[hover] ? String(xLabels[hover]) + ' · ' : '') + yFormat(d[hover])).length * 6.4 + 20),
            lines: [{ text: (xLabels && xLabels[hover] ? String(xLabels[hover]) + ' · ' : '') + yFormat(d[hover]), bold: true }] })}
        </g>
      ) : null}
      {d.map((_, i) => { const b = band(i); return <rect key={i} x={b.left} y={padT} width={b.w} height={plotH} fill="transparent" style={{ cursor: 'crosshair' }} onMouseEnter={() => setHover(i)} onMouseMove={() => setHover(i)} /> })}
    </svg>
  )
}

// Palette for categorical series (specialty / discipline).
export const SERIES_COLORS = ['#a855f7', '#3b82f6', '#1DB954', '#f59e0b', '#FF2D78', '#38bdf8', '#f472b6', '#c084fc']

// Multi-series line chart with y grid + labels and x labels.
// series: [{ label, color, data:[], fill?:bool, dash?:bool }]
export function MultiLineChart({ series, xLabels, width = 900, height = 300, yFormat = (v) => String(v) }) {
  const [hover, setHover] = useState(null)
  const ss = series && series.length ? series : [{ label: '', color: '#a855f7', data: [0] }]
  const padL = 56, padR = 12, padT = 12, padB = 26
  const plotW = width - padL - padR
  const plotH = height - padT - padB
  const allVals = ss.flatMap((s) => (s.data && s.data.length ? s.data : [0]))
  const ticks = niceTicks(Math.min(...allVals, 0), Math.max(...allVals, 1), 4)
  const yMin = ticks[0], yMax = ticks[ticks.length - 1]
  const span = (yMax - yMin) || 1
  const n = Math.max(...ss.map((s) => s.data.length), 1)
  const xAt = (i) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW)
  const yAt = (v) => padT + plotH - ((v - yMin) / span) * plotH
  const band = (i) => {
    const left = i === 0 ? padL : (xAt(i - 1) + xAt(i)) / 2
    const right = i === n - 1 ? width - padR : (xAt(i) + xAt(i + 1)) / 2
    return { left, w: Math.max(1, right - left) }
  }
  const tipLines = hover != null ? [
    ...(xLabels && xLabels[hover] ? [{ text: String(xLabels[hover]), dim: true }] : []),
    ...ss.map((s) => ({ text: s.label || 'Value', swatch: s.color, right: yFormat(s.data[hover] ?? 0) })),
  ] : []
  const tipW = hover != null ? Math.max(120, ...tipLines.map((l) => (l.swatch ? 24 : 11) + (l.text.length * 6.2) + (l.right ? l.right.length * 6.6 + 16 : 0) + 12)) : 0
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ display: 'block', maxWidth: '100%' }} onMouseLeave={() => setHover(null)}>
      <defs>
        {ss.map((s, si) => (
          <linearGradient key={si} id={`lt-ml-${si}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={s.color} stopOpacity="0.28" /><stop offset="100%" stopColor={s.color} stopOpacity="0" /></linearGradient>
        ))}
      </defs>
      {ticks.map((tv, i) => {
        const y = yAt(tv)
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="var(--lt-chart-grid)" strokeWidth="1" />
            <text x={padL - 8} y={y + 3.5} textAnchor="end" fontSize="11" fill="var(--lt-chart-axis)" fontFamily="Inter, sans-serif">{yFormat(tv)}</text>
          </g>
        )
      })}
      {ss.map((s, si) => {
        const d = s.data && s.data.length ? s.data : [0]
        const line = d.map((v, i) => `${i ? 'L' : 'M'}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(' ')
        const area = `${line} L${xAt(d.length - 1).toFixed(1)},${(padT + plotH).toFixed(1)} L${xAt(0).toFixed(1)},${(padT + plotH).toFixed(1)} Z`
        return (
          <g key={si}>
            {s.fill ? <path d={area} fill={`url(#lt-ml-${si})`} /> : null}
            <path d={line} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dash ? '5 5' : undefined} opacity={s.dash ? 0.7 : 1} />
          </g>
        )
      })}
      {(xLabels || []).map((lb, i) => (
        <text key={i} x={xAt(i)} y={height - 8} textAnchor="middle" fontSize="11" fill="var(--lt-chart-axis)" fontFamily="Inter, sans-serif">{lb}</text>
      ))}
      {hover != null ? (
        <g pointerEvents="none">
          <line x1={xAt(hover)} y1={padT} x2={xAt(hover)} y2={padT + plotH} stroke="var(--lt-chart-axis)" strokeOpacity="0.5" strokeWidth="1" />
          {ss.map((s, si) => <circle key={si} cx={xAt(hover)} cy={yAt(s.data[hover] ?? 0)} r="4" fill={s.color} stroke="#fff" strokeWidth="1.5" />)}
          {svgTooltip({ x: xAt(hover), y: padT + 6, chartW: width, padL, padR, plotW, anchorTop: true, width: tipW, lines: tipLines })}
        </g>
      ) : null}
      {Array.from({ length: n }).map((_, i) => { const b = band(i); return <rect key={i} x={b.left} y={padT} width={b.w} height={plotH} fill="transparent" style={{ cursor: 'crosshair' }} onMouseEnter={() => setHover(i)} onMouseMove={() => setHover(i)} /> })}
    </svg>
  )
}

// Simple horizontal bar (for distributions).
export function BarRow({ label, value, max, color = '#a855f7' }) {
  const pct = max ? Math.round((value / max) * 100) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', fontFamily: 'Inter, sans-serif' }}>
      <span style={{ width: 44, flexShrink: 0, fontSize: 12.5, color: 'var(--lt-muted)' }}>{label}</span>
      <span style={{ flex: 1, height: 8, borderRadius: 999, background: 'var(--lt-chart-grid)', overflow: 'hidden' }}>
        <span style={{ display: 'block', height: '100%', width: `${pct}%`, borderRadius: 999, background: color }} />
      </span>
      <span style={{ width: 30, flexShrink: 0, textAlign: 'right', fontSize: 12.5, color: 'var(--lt-text)' }}>{value}</span>
    </div>
  )
}
