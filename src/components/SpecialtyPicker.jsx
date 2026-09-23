import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import { SPECIALTIES } from '../lib/specialties'

// A glass dropdown of specialties, grouped by discipline, with a search box and multi-select.
export default function SpecialtyPicker({ value, onChange, disc = 'all', dark = false, label = 'Any specialty' }) {
  const [open, setOpen] = useState(false), [q, setQ] = useState('')
  const box = useRef(null)
  useEffect(() => { if (!open) return; const off = e => { if (!box.current?.contains(e.target)) setOpen(false) }; const key = e => { if (e.key === 'Escape') setOpen(false) }; addEventListener('pointerdown', off); addEventListener('keydown', key); return () => { removeEventListener('pointerdown', off); removeEventListener('keydown', key) } }, [open])
  const groups = Object.entries(SPECIALTIES).filter(([g]) => disc === 'all' || (disc === 'photo' ? g === 'Photographer' : g === 'Videographer'))
  const toggle = n => { const s = new Set(value); s.has(n) ? s.delete(n) : s.add(n); onChange(s) }
  const list = [...value]
  const text = list.length === 0 ? label : list.length === 1 ? list[0] : list[0] + ' + ' + (list.length - 1)
  return (
    <div className={'dp sp' + (dark ? ' dark' : '') + (open ? ' open' : '')} ref={box}>
      <button type="button" className={'dpb' + (list.length ? ' on' : '')} onClick={() => setOpen(o => !o)} aria-haspopup="listbox" aria-expanded={open}>
        <Icon name="grid" size={14} /><span>{text}</span>
        {list.length ? <i onClick={e => { e.stopPropagation(); onChange(new Set()) }} aria-label="Clear specialties"><Icon name="x" size={12} /></i> : <em className="chev"><Icon name="back" size={12} /></em>}
      </button>
      {open && (
        <div className="dpp spp lg" role="listbox" aria-label="Specialties" aria-multiselectable="true">
          <div className="sps"><Icon name="search" size={14} /><input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search specialties" aria-label="Search specialties" /></div>
          <div className="spl">
            {groups.map(([g, items]) => { const vis = items.filter(n => n.toLowerCase().includes(q.trim().toLowerCase())); if (!vis.length) return null; return (
              <div key={g} className="spg"><b>{g}</b>
                {vis.map(n => <button key={g + n} type="button" role="option" aria-selected={value.has(n)} className={value.has(n) ? 'on' : ''} onClick={() => toggle(n)}><span>{n}</span><i><Icon name="check" size={12} /></i></button>)}
              </div>) })}
            {!groups.some(([, items]) => items.some(n => n.toLowerCase().includes(q.trim().toLowerCase()))) && <p className="spn">Nothing called "{q}". Try a broader word.</p>}
          </div>
          <div className="dpf"><button type="button" onClick={() => { onChange(new Set()); setOpen(false) }}>Clear</button><button type="button" className="ok" onClick={() => setOpen(false)}>Done{list.length ? ' · ' + list.length : ''}</button></div>
        </div>
      )}
    </div>
  )
}
