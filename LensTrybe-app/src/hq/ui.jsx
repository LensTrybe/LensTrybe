import { useCallback, useEffect, useState } from 'react'
import Icon from '../components/Icon'

// Small shared pieces for HQ pages.
export function useLoad(fn, deps = []) {
  const [data, setData] = useState(null), [err, setErr] = useState(''), [busy, setBusy] = useState(true)
  const load = useCallback(async () => { setBusy(true); setErr(''); try { setData(await fn()) } catch (e) { setErr(e.message) } setBusy(false) }, deps) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])
  return { data, setData, err, busy, load }
}

export function Head({ title, sub, children }) {
  return <div className="hq-head"><div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>{children && <div className="hq-acts">{children}</div>}</div>
}
export const Tile = ({ label, value, sub, tone }) => <div className={'hq-tile' + (tone ? ' ' + tone : '')}><small>{label}</small><b>{value}</b>{sub && <span>{sub}</span>}</div>
export const Pill = ({ tone = 'grey', children }) => <span className={'hq-pill ' + tone}>{children}</span>
export const Empty = ({ children }) => <div className="hq-empty">{children}</div>
export const Err = ({ children }) => children ? <div className="hq-errbox"><Icon name="x" size={14} />{children}</div> : null
export const Loading = () => <div className="hq-empty"><div className="hq-spin sm" />Loading</div>

let flashTimer
export function useFlash() {
  const [msg, setMsg] = useState(null)
  const flash = (text, tone = 'ok') => { setMsg({ text, tone }); clearTimeout(flashTimer); flashTimer = setTimeout(() => setMsg(null), 6000) }
  const node = msg ? <div className={'hq-flash ' + msg.tone} role="status">{msg.text}</div> : null
  return [flash, node]
}

// A small centred dialog for confirmations and forms.
export function Modal({ title, children, onClose, wide }) {
  useEffect(() => { const k = e => e.key === 'Escape' && onClose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k) }, [onClose])
  return (
    <div className="hq-modal" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className={'hq-dialog' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label={title}>
        <div className="hq-dh"><b>{title}</b><button className="hq-x" aria-label="Close" onClick={onClose}><Icon name="x" size={16} /></button></div>
        {children}
      </div>
    </div>
  )
}

export function Search({ value, onChange, placeholder }) {
  return <label className="hq-search"><Icon name="search" size={14} /><input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} /></label>
}
export function Seg({ value, onChange, options }) {
  return <div className="hq-seg">{options.map(([v, l]) => <button key={v} type="button" className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>)}</div>
}

export function csv(rows, name) {
  const esc = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
  const keys = Object.keys(rows[0] || {})
  const text = [keys.join(','), ...rows.map(r => keys.map(k => esc(r[k])).join(','))].join('\r\n')
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' })); a.download = name; a.click(); URL.revokeObjectURL(a.href)
}
