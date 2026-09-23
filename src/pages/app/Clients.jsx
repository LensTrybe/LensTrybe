import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useFlows } from '../../lib/flows'
import { STAGES } from '../../data/workspace'
import { nice } from '../../lib/store'
import { fmt } from '../../lib/format'

// Everyone who has booked, enquired or been quoted, with the jobs and money behind each name.
// People and the pipeline both come from the store: add a client here, they are in every sheet.
const PEOPLE = [
  { id: 'harper', n: 'Harper Ellis', co: 'Harper and Leo', t: 'Wedding · Maleny', kind: 'Wedding', j: 1, v: 3200, l: '2026-11-07', tags: ['Wedding', 'Referral: Ana'], g: 'linear-gradient(135deg,#2c3a5e,#7fa8e8)', em: 'harper.ellis@gmail.com', ph: '0412 884 210', notes: 'Wants sunset portraits at 5:40. Mum is the emotional one, keep tissues. Sam is second shooter.', jobs: [['Wedding, full day', '7 Nov 2026', 3200, 'Booked']] },
  { id: 'coastline', n: 'Coastline Realty', co: 'Dean Marsh', t: 'Agency · Noosa Heads', kind: 'Real estate', j: 5, v: 6420, l: '2026-09-22', tags: ['Real estate', 'Monthly'], g: 'linear-gradient(135deg,#1c452f,#7fd0aa)', em: 'dean@coastlinerealty.com.au', ph: '07 5447 1200', notes: 'Three to four listings a month. Likes twilight exteriors. Pays within a week when invoiced from the thread.', jobs: [['3 listings', '22 Sep 2026', 1026, 'Today'], ['3 listings', '14 Nov 2026', 1026, 'Pencilled'], ['4 listings', '28 Aug 2026', 1520, 'Paid'], ['2 listings', '19 Jul 2026', 720, 'Paid'], ['4 listings', '12 Jun 2026', 1520, 'Paid']] },
  { id: 'blackwood', n: 'Blackwood Events', co: 'Priya Nair', t: 'Events · Brisbane', kind: 'Event', j: 2, v: 5100, l: '2026-11-28', tags: ['Conference', 'Pays late'], g: 'linear-gradient(135deg,#472657,#c6a5e5)', em: 'priya@blackwoodevents.com', ph: '0433 019 664', notes: 'Two day conference every November. Chased twice last year, paid on day 9. Lumi chases from day 3 now.', jobs: [['Conference, 2 days', '28 Nov 2026', 3600, 'Deposit paid'], ['Awards night', '14 Nov 2025', 1500, 'Paid']] },
  { id: 'ana', n: 'Ana and Tom', co: 'Ana Ferreira', t: 'Wedding · Sunshine Beach', kind: 'Wedding', j: 2, v: 3540, l: '2026-09-12', tags: ['Wedding', 'Album'], g: 'linear-gradient(135deg,#3d2450,#d996ba)', em: 'ana.ferreira@outlook.com', ph: '0401 553 778', notes: 'Referred Harper. Album selection call today at 2:30. Would love a first anniversary session.', jobs: [['Album', '12 Sep 2026', 640, 'Paid'], ['Wedding, full day', '8 Aug 2026', 2900, 'Delivered']] },
  { id: 'ruby', n: 'Ruby and Sol', co: 'Ruby Tan', t: 'Enquiry · Mar 2027', kind: 'Wedding', j: 0, v: 0, l: '2026-09-22', tags: ['Wedding', 'New'], g: 'linear-gradient(135deg,#283047,#9ac4c5)', em: 'rubytan@me.com', ph: '', notes: 'Found you on LensTrybe. Loves the Maleny work. 13 March 2027, probably.', jobs: [] },
  { id: 'northshore', n: 'Northshore Café', co: 'Leo Brandt', t: 'Hospitality · Noosa', kind: 'Brand', j: 0, v: 0, l: '2026-09-18', tags: ['Brand', 'Menu'], g: 'linear-gradient(135deg,#f6ccb0,#efab82)', em: 'hello@northshorecafe.com.au', ph: '07 5449 8811', notes: 'New menu launches October. Quote sent 18 Sep, valid nine days.', jobs: [] },
  { id: 'jess', n: 'Jess and Kai', co: 'Jess Morgan', t: 'Elopement · Sunshine Beach', kind: 'Wedding', j: 1, v: 1400, l: '2026-11-21', tags: ['Elopement'], g: 'linear-gradient(135deg,#3d2450,#d996ba)', em: 'jessmorgan@gmail.com', ph: '0422 907 315', notes: 'Just the two of them plus a celebrant. Deposit due 24 Oct.', jobs: [['Elopement', '21 Nov 2026', 1400, 'Signed']] },
  { id: 'marcus', n: 'Marcus P.', co: 'Marcus Petrou', t: 'Headshots · Brisbane', kind: 'Headshots', j: 1, v: 380, l: '2026-09-09', tags: ['Headshots', 'Review posted'], g: 'linear-gradient(135deg,#1c452f,#7fd0aa)', em: 'm.petrou@gmail.com', ph: '', notes: 'LinkedIn headshots. Left a five star review. Works at a firm of forty, could refer.', jobs: [['Headshots', '9 Sep 2026', 380, 'Paid']] },
]
const KINDS = ['All', 'Wedding', 'Real estate', 'Event', 'Brand', 'Headshots']
const COLS = [['Enquiry', [0]], ['Quoted', [1]], ['Booked', [2, 3, 4, 5]], ['Delivered', [6, 7]]]

export default function Clients({ kind = 'clients' }) {
  const F = useFlows(); const { s, nav, toast } = F; const PEOPLE = s.people, THREADS = s.threads
  const [q, setQ] = useState(''), [k, setK] = useState('All'), [sel, setSel] = useState(() => { try { const x = sessionStorage.getItem('lt-client'); sessionStorage.removeItem('lt-client'); return x } catch { return null } }), [view, setView] = useState(kind === 'crm' ? 'pipeline' : 'people')
  useEffect(() => { setView(kind === 'crm' ? 'pipeline' : 'people') }, [kind])
  const [drag, setDrag] = useState(null), [over, setOver] = useState(null)
  const COLSTAGE = { Enquiry: 0, Quoted: 1, Booked: 2, Delivered: 6 }
  const dropTo = (id, name, stages) => { const t = THREADS.find(x => x.id === id); if (!t || stages.includes(t.stage)) return; F.upd('threads', id, { stage: COLSTAGE[name] }); const pj = s.projects.find(x => x.t === id); if (pj) { const map = { Enquiry: 'enq', Quoted: 'quote', Booked: 'booked', Delivered: 'deliv' }; if (s.stages.find(x => x.id === map[name])) F.upd('projects', pj.id, { stage: map[name], k: name === 'Delivered' ? 'done' : 'live' }) } toast(t.n + ' moved to ' + name + '.') }
  const list = useMemo(() => PEOPLE.filter(p => (k === 'All' || p.kind === k) && (!q || (p.n + p.co + p.t + p.tags.join(' ')).toLowerCase().includes(q.toLowerCase()))), [PEOPLE, q, k])
  const c = PEOPLE.find(p => p.id === sel)
  const life = PEOPLE.reduce((t, p) => t + p.v, 0), repeat = PEOPLE.filter(p => p.j > 1).length, fresh = PEOPLE.filter(p => p.created && Date.now() - p.created < 30 * 864e5).length
  const editClient = () => F.open({ title: c.n, cta: 'Save', fields: [{ k: 'n', l: 'Name', required: true, value: c.n }, { k: 'co', l: 'Contact', half: true, value: c.co }, { k: 'kind', l: 'Kind', half: true, type: 'select', value: c.kind, options: KINDS.slice(1).concat(['Elopement', 'Family', 'Other']) }, { k: 'em', l: 'Email', half: true, type: 'email', value: c.em }, { k: 'ph', l: 'Phone', half: true, type: 'tel', value: c.ph }, { k: 't', l: 'One line', value: c.t }, ...F.socialFields(c.social || {})], alt: { l: 'Remove client', on: () => { F.confirm({ title: 'Remove ' + c.n + '?', body: 'The thread and ledger stay. Only the contact card goes.', cta: 'Remove', danger: true, onYes: () => { F.del('people', c.id); setSel(null); toast(c.n + ' removed.') } }); return false } }, submit: v => { const { n, co, kind, em, ph, t } = v; F.upd('people', c.id, { n, co, kind, em, ph, t, social: F.socialOf(v) }); if (THREADS.find(t => t.id === c.id)) F.upd('threads', c.id, { n }); toast('Saved.') } })
  const addTag = () => F.open({ title: 'Tag ' + c.n, cta: 'Add tag', fields: [{ k: 'tag', l: 'Tag', required: true, placeholder: 'Referral: Ana' }], submit: v => { F.upd('people', c.id, p => ({ tags: [...p.tags, v.tag] })); toast('Tagged.') } })
  const addNote = () => F.open({ title: 'Note on ' + c.n, cta: 'Save', fields: [{ k: 'notes', l: 'Notes', type: 'textarea', rows: 6, value: c.notes }], submit: v => { F.upd('people', c.id, { notes: v.notes }); toast('Saved.') } })
  const importCsv = () => F.open({ title: 'Import contacts', sub: 'Paste names and emails, one per line. Name, email, phone.', cta: 'Import', fields: [{ k: 'csv', l: 'Contacts', type: 'textarea', rows: 8, required: true, placeholder: 'Harper Ellis, harper@gmail.com, 0412 000 000' }, { k: 'kind', l: 'Tag them as', type: 'select', value: 'Wedding', options: KINDS.slice(1) }], submit: v => { let n = 0; v.csv.split('\n').map(l => l.split(',').map(x => x.trim())).filter(l => l[0]).forEach(([name, em, ph]) => { F.ensure({ client: '__new', newName: name, newEmail: em, newPhone: ph }, v.kind + ' · imported', 'TBC', v.kind); n++ }); toast(n + ' contact' + (n === 1 ? '' : 's') + ' imported.') } })
  return (
    <section className="view">
      <div className="vh">
        <div><h1>{kind === 'crm' ? 'CRM' : 'Contacts'}</h1><p>{kind === 'crm' ? 'Every job by stage, and every person behind it. Drag a card to move it, or let the thread do it.' : 'Everyone who has booked, enquired or been quoted. Lumi keeps the notes.'}</p></div>
        <div className="acts"><button className="btn g" onClick={importCsv}><Icon name="deliver" size={15} />Import</button><button className="btn w" onClick={() => F.newClient(r => setSel(r.pid))}><Icon name="plus" size={15} />Add client</button></div>
      </div>
      <div className="grid">
        <div className="s12"><div className="kp">
          {[['Clients', PEOPLE.length, (2 + fresh) + ' new this month', ''], ['Came back', repeat + ' of ' + PEOPLE.filter(p => p.j).length, 'booked more than once', ''], ['Lifetime value', fmt(life), 'across ' + PEOPLE.reduce((t, p) => t + p.j, 0) + ' jobs', 'n'], ['From referrals', String(PEOPLE.filter(p => p.tags.some(t => t.startsWith('Referral'))).length + 2), 'Ana sent Harper', '']].map(([l, v, e, w]) => <div key={l} className="k lg"><small>{l}</small><b>{v}</b><em className={w}>{e}</em></div>)}
        </div></div>

        <div className={'card lg ' + (c ? 's8' : 's12')}>
          <div className="h">
            <div className="tfilt" style={{ padding: 0 }}>
              <button className={view === 'people' ? 'on' : ''} onClick={() => setView('people')}>People</button><button className={view === 'pipeline' ? 'on' : ''} onClick={() => setView('pipeline')}>Pipeline</button>
              <span className="vsep" />
              {view === 'people' && KINDS.map(x => <button key={x} className={k === x ? 'on' : ''} onClick={() => setK(x)}>{x}</button>)}
            </div>
            <label className="tsearch" style={{ margin: 0, height: 34, width: 200 }}><Icon name="search" size={14} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Find" aria-label="Search clients" /></label>
          </div>
          {view === 'people' ? (
            <div className={'cls' + (c ? ' narrow' : '')}>
              {list.map(p => (
                <button key={p.id} type="button" className={'cl lg' + (sel === p.id ? ' on' : '')} onClick={() => setSel(sel === p.id ? null : p.id)}>
                  <div className="top2"><span className="av" style={{ background: p.g }} /><div><b>{p.n}</b><small>{p.t}</small></div></div>
                  <div className="nums"><div>Jobs<b>{p.j}</b></div><div>Lifetime<b>{p.v ? fmt(p.v) : '—'}</b></div><div>Last<b style={{ fontSize: 12 }}>{nice(p.l)}</b></div></div>
                  <div className="tags">{p.tags.map(t => <span key={t}>{t}</span>)}</div>
                </button>
              ))}
              {!list.length && <div className="tempty">Nobody matches. <button className="lnk" onClick={() => F.newClient(r => setSel(r.pid))}>Add a client</button></div>}
            </div>
          ) : (
            <div className="pipe">
              {COLS.map(([name, stages]) => { const cards = THREADS.filter(t => stages.includes(t.stage)); return (
                <div key={name} className={'pcol' + (over === name ? ' over' : '')} onDragOver={e => { if (drag) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (over !== name) setOver(name) } }} onDragLeave={() => over === name && setOver(null)} onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain') || drag; setOver(null); setDrag(null); if (id) dropTo(id, name, stages) }}>
                  <div className="pch"><b>{name}</b><span>{cards.length} · {fmt(cards.reduce((t, x) => t + x.v, 0))}</span></div>
                  {cards.map(t => <button key={t.id} type="button" className={'pcard' + (t.need ? ' need' : '') + (drag === t.id ? ' lift' : '')} draggable onDragStart={e => { e.dataTransfer.setData('text/plain', t.id); e.dataTransfer.effectAllowed = 'move'; setDrag(t.id) }} onDragEnd={() => { setDrag(null); setOver(null) }} onClick={() => nav('/app/thread/' + t.id)}><span className="av" style={{ background: t.g }} /><div><b>{t.n}</b><small>{t.j}</small><em>{t.next}</em></div><span className="pv">{fmt(t.v)}</span><i className="stg">{STAGES[t.stage]}</i></button>)}
                  {!cards.length && <div className="tempty" style={{ padding: 14, fontSize: 12 }}>{over === name ? 'Drop it here' : 'Empty'}</div>}
                </div>) })}
            </div>
          )}
        </div>

        {c && <div className="s4 side">
          <div className="card lg who">
            <div className="h"><b style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span className="av" style={{ background: c.g }} />{c.n}</b><span style={{ display: 'flex', gap: 4 }}><button className="ic2" aria-label="Edit" title="Edit" onClick={editClient}><Icon name="edit" size={14} /></button><button className="ic2" aria-label="Close" onClick={() => setSel(null)}><Icon name="x" size={14} /></button></span></div>
            <p className="sub">{c.co !== c.n && <>{c.co} · </>}{c.t}</p>
            <div className="kv"><span>Email</span><b>{c.em ? <a className="lnk" href={'mailto:' + c.em}>{c.em}</a> : <button className="lnk" onClick={editClient}>Add</button>}</b></div>
            <div className="kv"><span>Phone</span><b>{c.ph ? <a className="lnk" href={'tel:' + c.ph.replace(/\s/g, '')}>{c.ph}</a> : <button className="lnk" onClick={editClient}>Add</button>}</b></div>
            <div className="kv"><span>Lifetime</span><b>{c.v ? fmt(c.v) : 'Nothing yet'}</b></div>
            <div className="social">{F.SOCIAL.filter(([k]) => c.social?.[k]).map(([k, l]) => { const v = c.social[k]; const href = k === 'ig' ? 'https://instagram.com/' + v.replace('@', '') : k === 'tt' ? 'https://tiktok.com/@' + v.replace('@', '') : /^https?:/.test(v) ? v : 'https://' + v; return <a key={k} className="soc" href={href} target="_blank" rel="noopener" title={l}><Icon name={k === 'web' ? 'globe' : k === 'li' ? 'briefcase' : k === 'tt' ? 'video' : 'image'} size={13} />{k === 'web' ? v.replace(/^https?:\/\//, '') : v.startsWith('@') || k === 'fb' || k === 'li' ? v.replace(/^https?:\/\/(www\.)?/, '') : '@' + v}</a> })}<button className="soc add" onClick={editClient}><Icon name="plus" size={12} />{c.social && Object.keys(c.social).length ? 'Social' : 'Add social'}</button></div>
            <div className="tags" style={{ marginTop: 10 }}>{c.tags.map(t => <span key={t} title="Remove" style={{ cursor: 'pointer' }} onClick={() => F.upd('people', c.id, p => ({ tags: p.tags.filter(x => x !== t) }))}>{t}</span>)}<button className="tag-add" onClick={addTag}>+</button></div>
            <div className="ctas" style={{ marginTop: 14 }}>
              {THREADS.find(t => t.id === c.id) ? <Link className="btn w sm" to={'/app/thread/' + c.id}>Open thread <Icon name="arrow" size={13} /></Link> : <button className="btn w sm" onClick={() => { F.ensure({ client: c.id }); nav('/app/thread/' + c.id) }}>New thread</button>}
              <button className="btn g sm" onClick={() => F.newDoc('q', { client: c.id, d: c.jobs[0]?.[0] || '', v: c.jobs[0]?.[2] || '' })}>Quote</button>
              <button className="btn g sm" onClick={() => F.newBooking('', { client: c.id })}>Book</button>
            </div>
          </div>
          <div className="card lg"><div className="h"><b>Jobs</b><button className="lnk" onClick={() => F.newBooking('', { client: c.id })}>Add</button></div>
            {c.jobs.length ? <div className="tl">{c.jobs.map(([n, d, v, st]) => <div key={n + d} className="e"><span className="t" style={{ width: 'auto' }}>{d.split(' ').slice(0, 2).join(' ')}</span><div><b>{n}</b><small>{st}</small></div><span className="amt2">{fmt(v)}</span></div>)}</div> : <p className="tempty" style={{ padding: '8px 0', textAlign: 'left' }}>No jobs yet. {THREADS.find(t => t.id === c.id) ? 'The enquiry is in the thread.' : ''}</p>}
          </div>
          <div className="card lg"><div className="h"><b>Notes</b><small className="lumi-by"><span className="lm" style={{ width: 12, height: 12 }} />Lumi keeps these</small></div><p className="note2">{c.notes || 'Nothing yet.'}</p><button className="lnk" style={{ marginTop: 10 }} onClick={addNote}>{c.notes ? 'Edit' : 'Add a note'}</button></div>
        </div>}
      </div>
    </section>
  )
}
