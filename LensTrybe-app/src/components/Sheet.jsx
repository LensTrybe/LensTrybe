import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import Icon from './Icon'

// A slide-over form. Any page calls open({ title, fields, submit }) and gets a glass panel from the
// right with real inputs; submit gets the values. confirm({ title, body, cta, onYes }) is the same
// panel with no fields, for the "are you sure" moments. One at a time, Esc closes, focus is trapped
// to the first field on open.
//
// field: { k, l, type?: text|textarea|number|money|date|time|select|toggle|chips, value?, options?: [v] | [[v, label]],
//          required?, hint?, half?, placeholder?, min?, max?, step?, rows?, when?: values => bool }
const Ctx = createContext({ open: () => {}, confirm: () => {}, close: () => {} })

export function SheetProvider({ children }) {
  const [sh, setSh] = useState(null), [v, setV] = useState({}), [on, setOn] = useState(false), [err, setErr] = useState(null)
  const first = useRef()
  const close = useCallback(() => { setOn(false); setTimeout(() => setSh(null), 260) }, [])
  const open = useCallback(cfg => {
    const init = {}; (cfg.fields || []).forEach(f => { init[f.k] = f.value ?? (f.type === 'toggle' ? false : f.type === 'chips' ? [] : '') })
    setV(init); setErr(null); setSh(cfg); requestAnimationFrame(() => { setOn(true); setTimeout(() => first.current?.focus(), 80) })
  }, [])
  const confirm = useCallback(cfg => open({ ...cfg, fields: [], submit: cfg.onYes }), [open])
  useEffect(() => { if (!sh) return; const k = e => { if (e.key === 'Escape') close() }; addEventListener('keydown', k); return () => removeEventListener('keydown', k) }, [sh, close])
  const set = (k, x) => setV(o => { const f = (sh?.fields || []).find(y => y.k === k); const n = { ...o, [k]: x }; return f?.effect ? { ...n, ...(f.effect(x, n) || {}) } : n })
  const go = e => {
    e?.preventDefault?.()
    const miss = (sh.fields || []).filter(f => !f.when || f.when(v)).find(f => f.required && (v[f.k] === '' || v[f.k] == null || (Array.isArray(v[f.k]) && !v[f.k].length)))
    if (miss) { setErr(miss.k); first.current?.form?.querySelector(`[name="${miss.k}"]`)?.focus(); return }
    const out = {}; (sh.fields || []).forEach(f => { out[f.k] = ['number', 'money'].includes(f.type) ? Number(v[f.k] || 0) : v[f.k] })
    const r = sh.submit?.(out); if (r !== false) close()
  }
  const field = (f, i) => {
    const id = 'sf-' + f.k, val = v[f.k], bad = err === f.k, ref = i === 0 ? first : undefined
    const opts = (f.options || []).map(o => Array.isArray(o) ? o : [o, o])
    let inp
    if (f.type === 'textarea') inp = <textarea ref={ref} id={id} name={f.k} rows={f.rows || 4} value={val} placeholder={f.placeholder} onChange={e => set(f.k, e.target.value)} />
    else if (f.type === 'select') inp = <select ref={ref} id={id} name={f.k} value={val} onChange={e => set(f.k, e.target.value)}>{!f.value && <option value="">{f.placeholder || 'Choose'}</option>}{opts.map(([o, l]) => <option key={o} value={o}>{l}</option>)}</select>
    else if (f.type === 'toggle') return <label key={f.k} className="sf tog"><span><b>{f.l}</b>{f.hint && <small>{f.hint}</small>}</span><span className={'sw2' + (val ? ' on' : '')} role="switch" aria-checked={!!val} tabIndex={0} onClick={() => set(f.k, !val)} onKeyDown={e => e.key === ' ' && (e.preventDefault(), set(f.k, !val))}><i /></span></label>
    else if (f.type === 'chips') inp = <div className="chips2" style={{ marginTop: 6 }}>{opts.map(([o, l]) => <button type="button" key={o} className={'chip' + (val.includes(o) ? ' p' : '')} onClick={() => set(f.k, val.includes(o) ? val.filter(x => x !== o) : [...val, o])}>{l}</button>)}</div>
    else if (f.type === 'files') inp = <label className={'sfiles' + (val?.length ? ' has' : '')}>
      <input id={id} name={f.k} type="file" multiple accept={f.accept || 'image/*,video/*,.zip,.pdf'} hidden onChange={e => { const fs = [...(e.target.files || [])]; e.target.value = ''; if (!fs.length) return; const first = fs.find(x => x.type.startsWith('image/')); const done = cover => set(f.k, [...(val || []), ...fs.map((x, i) => ({ name: x.name, size: x.size, type: x.type, cover: x === first ? cover : undefined }))]); if (first && first.size < 6e6) { const rd = new FileReader(); rd.onload = () => done(rd.result); rd.readAsDataURL(first) } else done(undefined) }} />
      {val?.length ? <><span className="cov">{val.find(x => x.cover) ? <img src={val.find(x => x.cover).cover} alt="" /> : <Icon name="image" size={18} />}</span><span className="ft"><b>{val.length} {val.length === 1 ? 'file' : 'files'} · {(val.reduce((t, x) => t + x.size, 0) / 1e9).toFixed(2)} GB</b><small>{val.filter(x => x.type.startsWith('image/')).length} photos · {val.filter(x => x.type.startsWith('video/')).length} films · {val.filter(x => !x.type.startsWith('image/') && !x.type.startsWith('video/')).length} other · tap to add more</small></span><button type="button" className="lnk" onClick={e => { e.preventDefault(); set(f.k, []) }}>Clear</button></>
        : <><b>{f.cta || '+ Click to select files'}</b><small>{f.hint2 || 'Photos, videos, ZIPs or any file type. The first photo becomes the cover.'}</small></>}
    </label>
    else if (f.type === 'file') inp = <div className="sfile">
      <input id={id} name={f.k} type="file" accept={f.accept || 'image/*,.pdf'} hidden onChange={e => { const fl = e.target.files?.[0]; e.target.value = ''; if (!fl) return; if (fl.size > 2.5e6) { set(f.k, { name: fl.name, type: fl.type, size: fl.size, data: '' }); return } const rd = new FileReader(); rd.onload = () => set(f.k, { name: fl.name, type: fl.type, size: fl.size, data: rd.result }); rd.readAsDataURL(fl) }} />
      {val?.data && val.type?.startsWith('image/') && <img src={val.data} alt="" />}
      <div className="ft">{val ? <><b>{val.name}</b><small>{Math.round(val.size / 1024)} KB{val.data ? '' : ' · over 2.5 MB, details kept only'}</small></> : <small>{f.hint2 || 'A photo or a PDF'}</small>}</div>
      <label htmlFor={id} className="btn g sm">{val ? 'Change' : (f.cta || 'Attach')}</label>{val && <button type="button" className="lnk" onClick={() => set(f.k, '')}>Remove</button>}
    </div>
    else if (f.type === 'money') inp = <span className="money"><i>$</i><input ref={ref} id={id} name={f.k} type="number" inputMode="decimal" min={f.min ?? 0} step={f.step || 1} value={val} placeholder={f.placeholder || '0'} onChange={e => set(f.k, e.target.value)} /></span>
    else inp = <input ref={ref} id={id} name={f.k} type={f.type || 'text'} value={val} placeholder={f.placeholder} min={f.min} max={f.max} step={f.step} onChange={e => set(f.k, e.target.value)} />
    return <div key={f.k} className={'sf' + (f.half ? ' half' : '') + (bad ? ' bad' : '')}><label htmlFor={id}>{f.l}{f.required && <i>*</i>}</label>{inp}{f.hint && <small>{f.hint}</small>}{bad && <small className="e">Needed</small>}</div>
  }
  return (
    <Ctx.Provider value={{ open, confirm, close }}>
      {children}
      {sh && <div className={'sheetbk' + (on ? ' on' : '') + (sh.center ? ' center' : '')} onMouseDown={e => { if (e.target === e.currentTarget) close() }}>
        <form className={'sheet' + (on ? ' on' : '') + (sh.wide ? ' wide' : '') + (sh.center ? ' center' : '')} role="dialog" aria-modal="true" aria-labelledby="sheet-t" onSubmit={go}>
          <div className="sh-h"><div><h2 id="sheet-t">{sh.title}</h2>{sh.sub && <p>{sh.sub}</p>}</div><button type="button" className="x" aria-label="Close" onClick={close}><Icon name="x" size={16} /></button></div>
          <div className="sh-b">
            {sh.body && <div className="sh-body">{typeof sh.body === 'function' ? sh.body(v) : sh.body}</div>}
            {sh.lumi && <div className="tlumi"><span className="lm" /><div>{sh.lumi}</div></div>}
            {sh.fields?.length > 0 && <div className="sfs">{sh.fields.filter(f => !f.when || f.when(v)).map(field)}</div>}
          </div>
          <div className="sh-f">
            {sh.alt && <button type="button" className="btn g" onClick={() => { const r = sh.alt.on?.(v); if (r !== false) close() }}>{sh.alt.l}</button>}
            {sh.alt2 && <button type="button" className="btn g quiet" onClick={() => { const r = sh.alt2.on?.(v); if (r !== false) close() }}>{sh.alt2.l}</button>}
            <span style={{ flex: 1 }} />
            <button type="button" className="btn g" onClick={close}>{sh.cancel || 'Cancel'}</button>
            {!sh.noSubmit && <button type="submit" className={'btn ' + (sh.danger ? 'danger' : 'w')}>{sh.cta || 'Save'}</button>}
          </div>
        </form>
      </div>}
    </Ctx.Provider>
  )
}
export const useSheet = () => useContext(Ctx)
