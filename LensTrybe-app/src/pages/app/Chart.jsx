import { useEffect, useRef, useState } from 'react'
import { fmt } from '../../lib/format'
const PAID = [4200, 3900, 5100, 6400, 5800, 7200, 6900, 8300, 9840, 7600, 6100, 5400], Q = [5200, 4800, 6100, 7900, 7100, 8800, 8200, 9900, 11600, 9400, 7800, 6900]
const M0 = ['O', 'N', 'D', 'J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S'], MONTHS0 = ['Oct 2025', 'Nov 2025', 'Dec 2025', 'Jan 2026', 'Feb 2026', 'Mar 2026', 'Apr 2026', 'May 2026', 'Jun 2026', 'Jul 2026', 'Aug 2026', 'Sep 2026']
// twelve months ending in `end` (a 'YYYY-MM'), for the live workspace
export const monthsTo = end => { const [y, m] = end.split('-').map(Number); return Array.from({ length: 12 }, (_, i) => { const d = new Date(y, m - 1 - (11 - i), 1); return d.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' }) }) }
// Revenue, twelve months. Paid as a lit area in the signal colour, quoted as a quiet dashed line.
// Move over it and the month's figures follow the cursor.
export default function Chart({ id = 'c', paid = PAID, quoted = Q, months }) {
  const MONTHS = months || MONTHS0, M = months ? months.map(x => x[0]) : M0
  const top = Math.max(...paid, ...quoted, 0), max = months ? Math.max(1000, Math.ceil(top / 1000) * 1000 || 1000) : 12000
  const box = useRef(null); const [W, setW] = useState(600), [hov, setHov] = useState(null)
  useEffect(() => { const ro = new ResizeObserver(() => setW(box.current?.clientWidth || 600)); ro.observe(box.current); return () => ro.disconnect() }, [])
  const H = 150, pad = { l: 34, r: 8, t: 12, b: 20 }
  const x = i => pad.l + (W - pad.l - pad.r) * i / 11, y = v => pad.t + (H - pad.t - pad.b) * (1 - v / max)
  const line = a => a.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ')
  const move = e => { const r = e.currentTarget.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width * W; const i = Math.max(0, Math.min(11, Math.round((px - pad.l) / (W - pad.l - pad.r) * 11))); setHov(i) }
  const cur = hov ?? (months ? 11 : 8), i = cur, showTip = hov != null
  const tipLeft = Math.min(Math.max(x(i) / W * 100, 14), 86)
  return (
    <div className="chart" ref={box}>
      <div className="k"><span><i />Paid</span><span><i className="q" />Quoted</span></div>
      <div className="cw" onMouseMove={move} onMouseLeave={() => setHov(null)} onTouchMove={e => { const t = e.touches[0]; if (t) move({ currentTarget: e.currentTarget, clientX: t.clientX }) }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          <defs><linearGradient id={'g' + id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--sig)" stopOpacity=".38" /><stop offset="1" stopColor="var(--sig)" stopOpacity="0" /></linearGradient></defs>
          {[0, max / 2, max].map(v => <g key={v}><line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity=".1" /><text x={pad.l - 6} y={y(v) + 4} fontSize="10" fill="currentColor" fillOpacity=".5" textAnchor="end" fontFamily="Inter,sans-serif">{v ? '$' + (v >= 1000 ? (Math.round(v / 100) / 10) + 'k' : v) : '0'}</text></g>)}
          {M.map((t, j) => <text key={j} x={x(j)} y={H - 4} fontSize="10" fill="currentColor" fillOpacity={showTip && j === i ? .9 : .5} fontWeight={showTip && j === i ? 700 : 400} textAnchor="middle" fontFamily="Inter,sans-serif">{t}</text>)}
          <path d={`${line(paid)} L${x(11)} ${y(0)} L${x(0)} ${y(0)} Z`} fill={`url(#g${id})`} />
          <path d={line(quoted)} fill="none" stroke="currentColor" strokeOpacity=".35" strokeWidth="1.5" strokeDasharray="3 5" />
          <path d={line(paid)} fill="none" stroke="var(--sig)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 6px var(--sig-glow))' }} />
          {showTip && <line x1={x(i)} x2={x(i)} y1={pad.t} y2={H - pad.b} stroke="currentColor" strokeOpacity=".25" strokeDasharray="2 3" />}
          {showTip && <circle cx={x(i)} cy={y(quoted[i])} r="3.5" fill="var(--bg-2)" stroke="currentColor" strokeOpacity=".5" strokeWidth="1.5" />}
          <circle cx={x(i)} cy={y(paid[i])} r="4.5" fill="var(--sig)" stroke="var(--bg-2)" strokeWidth="2" style={{ transition: 'cx .15s, cy .15s' }} />
        </svg>
        {showTip && <div className="tip lg" style={{ left: tipLeft + '%', top: Math.max(0, y(paid[i]) / H * 100 - 6) + '%' }}><small>{MONTHS[i]}</small><b>{fmt(paid[i])}</b><span>paid · {fmt(quoted[i])} quoted</span></div>}
      </div>
    </div>
  )
}
