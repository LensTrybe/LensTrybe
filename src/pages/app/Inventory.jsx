import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useFlows } from '../../lib/flows'
import { TODAY as T0, nice, parse, addDays } from '../../lib/store'
import { fmt } from '../../lib/format'

// Inventory: every body, lens, light and drone with its serial, value and insurance, and a
// packing list for the next shoot so nothing gets left on the bench. All of it in the store.
const TODAY = parse(T0)

export default function Inventory() {
  const F = useFlows(); const { s, toast, upd } = F; const GEAR = s.gear, CATS = ['All', ...s.gearCats]
  const [c, setC] = useState('All'), [q, setQ] = useState(''), [sel, setSel] = useState(4)
  const list = useMemo(() => GEAR.filter(g => (c === 'All' || g.c === c) && (!q || (g.n + g.c + (g.sn || '') + (g.note || '')).toLowerCase().includes(q.toLowerCase()))), [GEAR, c, q])
  const g = GEAR.find(x => x.id === sel)
  const total = GEAR.reduce((t, x) => t + (x.v || 0), 0), insured = GEAR.filter(x => x.ins).reduce((t, x) => t + (x.v || 0), 0)
  const due = GEAR.filter(x => x.svc && (parse(x.svc) - TODAY) / 864e5 < 45)
  const inKit = GEAR.filter(x => x.kit), packedN = inKit.filter(x => x.packed).length
  const nextShoot = s.events.filter(e => (e.k === 'b' || e.k === 'p') && e.d >= T0).sort((a, b) => a.d < b.d ? -1 : 1)[0]
  const edit = () => F.open({ title: g.n, cta: 'Save', fields: [{ k: 'n', l: 'Item', required: true, value: g.n }, ...F.catFields(g.c), { k: 'v', l: 'Value', type: 'money', half: true, value: g.v }, { k: 'sn', l: 'Serial', half: true, value: g.sn || '' }, { k: 'svc', l: 'Next service', type: 'date', half: true, value: g.svc || '' }, { k: 'ins', l: 'Insured', type: 'toggle', value: !!g.ins }, { k: 'note', l: 'Note', type: 'textarea', rows: 3, value: g.note || '' }], alt: { l: 'Remove', on: () => { F.confirm({ title: 'Remove ' + g.n + '?', body: 'Sold, lost or retired. It comes off the insurance list too.', cta: 'Remove', danger: true, onYes: () => { F.del('gear', g.id); setSel(null); toast(g.n + ' removed.') } }); return false } }, submit: v => { const c = F.catOf(v); upd('gear', g.id, { n: v.n, c, v: v.v, sn: v.sn, svc: v.svc, note: v.note, ins: v.ins ? 1 : 0 }); toast('Saved.') } })
  const bookService = (x, when) => F.open({ title: 'Book a service · ' + x.n, sub: 'Blocks the day on your calendar so nothing is booked while it is away.', cta: 'Book it', fields: [{ k: 'd', l: 'Drop off', type: 'date', required: true, value: when || x.svc || addDays(T0, 7), min: T0 }, { k: 'who', l: 'Where', value: 'Camera Clinic, Maroochydore' }, { k: 'days', l: 'Days away', type: 'number', value: 3, min: 1, half: true }, { k: 'block', l: 'Block those days', type: 'toggle', value: false, hint: 'Only if you cannot shoot without it' }], submit: v => { upd('gear', x.id, { svc: '', note: ((x.note || '') + ' Service booked ' + nice(v.d) + (v.who ? ' at ' + v.who : '') + '.').trim() }); if (v.block) { for (let i = 0; i < (v.days || 1); i++) F.add('events', { d: addDays(v.d, i), k: 'x', n: 'Service · ' + x.n }, 'ev') } toast('Service booked for ' + nice(v.d) + (v.block ? '. Days blocked.' : '.')) } })
  const exportList = () => { const rows = GEAR.map(x => [x.n, x.c, x.sn || '', x.v || 0, x.ins ? 'Insured' : 'Not insured'].map(y => '"' + String(y).replace(/"/g, '""') + '"').join(',')).join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['item,category,serial,value,insurance\n' + rows], { type: 'text/csv' })); a.download = 'gear-' + T0 + '.csv'; a.click(); toast('Gear list exported with serials and values.') }
  return (
    <section className="view">
      <div className="vh">
        <div><h1>Inventory</h1><p>Bodies, lenses, lights and drones, with serials, insurance and what's packed for the next shoot.</p></div>
        <div className="acts"><button className="btn g" onClick={exportList}><Icon name="deliver" size={15} />Export for insurer</button><button className="btn w" onClick={F.newGear}><Icon name="plus" size={15} />Add gear</button></div>
      </div>
      <div className="grid">
        <div className="s12"><div className="kp">
          {[['Items', GEAR.length, 'across ' + s.gearCats.length + ' categories', 'n'], ['Replacement value', fmt(total), fmt(insured) + ' insured', ''], ['Not insured', GEAR.filter(x => !x.ins).length, 'worth ' + fmt(total - insured), GEAR.some(x => !x.ins) ? 'w' : ''], ['Service due', due.length, due.map(x => x.n.split(' ')[1] || x.n).join(', ') || 'nothing soon', due.length ? 'w' : '']].map(([l, v, e, w]) => <div key={l} className="k lg"><small>{l}</small><b>{v}</b><em className={w}>{e}</em></div>)}
        </div></div>

        <div className="card lg s8">
          <div className="h">
            <div className="tfilt" style={{ padding: 0 }}>{CATS.map(x => <button key={x} className={c === x ? 'on' : ''} onClick={() => setC(x)} onDoubleClick={() => x !== 'All' && F.editGearCat(x, n => setC(n))} title={x === 'All' ? '' : 'Double-click to rename or remove'}>{x}</button>)}<button className="addcat" onClick={() => F.editGearCat(null, n => setC(n))}><Icon name="plus" size={12} />Category</button>{c !== 'All' && <button className="addcat edit" onClick={() => F.editGearCat(c, n => setC(n === 'All' ? 'All' : n))}><Icon name="edit" size={12} />Edit {c}</button>}</div>
            <label className="tsearch" style={{ margin: 0, height: 34, width: 180 }}><Icon name="search" size={14} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Find" aria-label="Search gear" /></label>
          </div>
          <div className="ledger">
            {list.map(x => { const soon = x.svc && (parse(x.svc) - TODAY) / 864e5 < 45; return (
              <div key={x.id} className={'lr go' + (sel === x.id ? ' on' : '')} onClick={() => setSel(x.id)}>
                <span className="ic"><Icon name={x.c === 'Bodies' ? 'image' : x.c === 'Lenses' ? 'eye' : x.c === 'Lights' ? 'sun' : x.c === 'Drones' ? 'video' : x.c === 'Audio' ? 'mic' : 'box'} size={15} /></span>
                <div><b>{x.n}</b><small>{x.c}{x.sn ? ' · ' + x.sn : ''}</small></div>
                <span className={'st ' + (x.ins ? 'ok' : 'pink')}>{x.ins ? 'Insured' : 'Not insured'}</span>
                {soon ? <span className="st viewed">Service {nice(x.svc)}</span> : <span className="st grey">{x.svc ? 'Service ' + nice(x.svc) : 'No service due'}</span>}
                <span className="amt">{fmt(x.v || 0)}</span>
                <label className={'kt' + (x.kit ? ' on' : '')} onClick={e => e.stopPropagation()} title="In the kit for the next shoot"><input type="checkbox" checked={!!x.kit} onChange={() => upd('gear', x.id, { kit: x.kit ? 0 : 1 })} /><i><Icon name="check" size={11} /></i>Kit</label>
              </div>) })}
            {!list.length && <div className="tempty">Nothing in {c === 'All' ? 'your kit' : c} yet. <button className="lnk" onClick={F.newGear}>Add gear</button>{c !== 'All' && <> · <button className="lnk" onClick={() => F.editGearCat(c, n => setC(n))}>Rename or remove {c}</button></>}</div>}
          </div>
        </div>

        <div className="s4 side">
          {g && <div className="card lg">
            <div className="h"><b>{g.n}</b><span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><span className={'st ' + (g.ins ? 'ok' : 'pink')}>{g.ins ? 'Insured' : 'Not insured'}</span><button className="ic2" aria-label="Edit" title="Edit" onClick={edit}><Icon name="edit" size={14} /></button></span></div>
            <div className="kv"><span>Category</span><b>{g.c}</b></div>
            {g.sn && <div className="kv"><span>Serial</span><b>{g.sn}</b></div>}
            <div className="kv"><span>Replacement</span><b>{fmt(g.v || 0)}</b></div>
            {g.svc && <div className="kv"><span>Service</span><b>{nice(g.svc)}</b></div>}
            {g.note && <p className="note2" style={{ marginTop: 10 }}>{g.note}</p>}
            <div className="ctas" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
              {!g.ins && <button className="btn w sm" onClick={() => { upd('gear', g.id, { ins: 1 }); toast(g.n + ' added to the policy. Your insurer gets the updated list.') }}>Add to policy</button>}
              {g.svc && <button className="btn g sm" onClick={() => bookService(g)}>Book service</button>}
              <button className="btn g sm" onClick={() => F.newDoc('exp', { who: g.n, v: g.v, cat: 'Gear', date: T0 })}>Log expense</button>
              {s.listings.some(l => l.gearId === g.id && l.st === 'live') ? <button className="btn g sm" onClick={() => F.nav('/app/marketplace')}>Listed for sale</button> : <button className="btn g sm" onClick={() => F.postListing({ gearId: g.id, t: g.n, p: Math.round(g.v * 0.6), d: g.note || '', then: () => F.nav('/app/marketplace') })}>Sell it</button>}
            </div>
          </div>}
          <div className="card lg">
            <div className="h"><b>Pack for {nextShoot ? nextShoot.n.split(' · ')[0] + ' · ' + nice(nextShoot.d) : 'the next shoot'}</b><span className="st ok">{packedN} of {inKit.length}</span></div>
            <div className="chk">{inKit.map(x => <label key={x.id} className={x.packed ? 'on' : ''}><input type="checkbox" checked={!!x.packed} onChange={() => upd('gear', x.id, { packed: x.packed ? 0 : 1 })} /><i><Icon name="check" size={11} /></i><span>{x.n}</span></label>)}</div>
            <p className="tempty" style={{ textAlign: 'left', padding: '10px 0 0', fontSize: 12 }}>Tick Kit on any item to add it here. {packedN > 0 && <button className="lnk" onClick={() => GEAR.forEach(x => x.packed && upd('gear', x.id, { packed: 0 }))}>Unpack all</button>} <Link to="/app/bookings" className="lnk">Next shoot</Link></p>
          </div>
          {GEAR.find(x => x.id === 4)?.svc && <div className="tlumi"><span className="lm" /><div>The 70-200's focus ring note is from July. Service is due in a week and Harper's wedding is on the 7th. Want it booked in for the 30th so it's back in time?<div className="acts"><button className="y" onClick={() => bookService(GEAR.find(x => x.id === 4), '2026-09-30')}>Book it</button><button onClick={() => toast("I'll remind you Friday.")}>Later</button></div></div></div>}
        </div>
      </div>
    </section>
  )
}
