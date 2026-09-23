import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'

const DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const fmtDate = d => d ? d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }) : ''
export const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

// A glass date picker. One month at a time, today and earlier greyed out, the chosen day lit in mint.
// `busy(date)` marks days that can't be chosen; `label` is what the closed control says when nothing is picked.
export default function DatePicker({ value, onChange, label = 'Any date', busy, dark = false }) {
  const [open, setOpen] = useState(false)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const [view, setView] = useState(() => { const d = value ? new Date(value) : new Date(today); d.setDate(1); return d })
  const box = useRef(null)
  useEffect(() => { if (!open) return; const off = e => { if (!box.current?.contains(e.target)) setOpen(false) }; const key = e => { if (e.key === 'Escape') setOpen(false) }; addEventListener('pointerdown', off); addEventListener('keydown', key); return () => { removeEventListener('pointerdown', off); removeEventListener('keydown', key) } }, [open])
  const first = new Date(view.getFullYear(), view.getMonth(), 1)
  const lead = (first.getDay() + 6) % 7
  const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate()
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => new Date(view.getFullYear(), view.getMonth(), i + 1))]
  const move = n => setView(v => new Date(v.getFullYear(), v.getMonth() + n, 1))
  const canBack = view > new Date(today.getFullYear(), today.getMonth(), 1)
  return (
    <div className={'dp' + (dark ? ' dark' : '') + (open ? ' open' : '')} ref={box}>
      <button type="button" className={'dpb' + (value ? ' on' : '')} onClick={() => setOpen(o => !o)} aria-haspopup="dialog" aria-expanded={open}>
        <Icon name="cal" size={14} /><span>{value ? 'Free ' + fmtDate(value) : label}</span>
        {value && <i onClick={e => { e.stopPropagation(); onChange(null) }} aria-label="Clear date"><Icon name="x" size={12} /></i>}
      </button>
      {open && (
        <div className="dpp lg" role="dialog" aria-label="Pick a date">
          <div className="dph"><button type="button" onClick={() => move(-1)} disabled={!canBack} aria-label="Previous month"><Icon name="back" size={14} /></button><b>{MONTHS[view.getMonth()]} {view.getFullYear()}</b><button type="button" onClick={() => move(1)} aria-label="Next month" className="fwd"><Icon name="back" size={14} /></button></div>
          <div className="dpg">{DOW.map(d => <span key={d} className="dow">{d}</span>)}
            {cells.map((d, i) => d ? <button key={i} type="button" disabled={d < today || (busy && busy(d))} className={(sameDay(d, value) ? 'on' : '') + (sameDay(d, today) ? ' today' : '') + (busy && busy(d) ? ' busy' : '')} onClick={() => { onChange(d); setOpen(false) }}>{d.getDate()}</button> : <span key={i} />)}
          </div>
          <div className="dpf"><button type="button" onClick={() => { onChange(null); setOpen(false) }}>Any date</button><span>Only creatives free that day will show</span></div>
        </div>
      )}
    </div>
  )
}
