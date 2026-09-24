import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Still from '../../components/Still'
import Icon from '../../components/Icon'
import { useFlows } from '../../lib/flows'
import { addDays, TODAY } from '../../lib/store'

// Content ideas: posts drafted from work you've already delivered, reviews that just landed and gaps
// worth filling. Keep the good ones, they go to the calendar; pass on the rest and Lumi learns.
const KINDS = [['all', 'All'], ['gallery', 'From galleries'], ['review', 'From reviews'], ['gap', 'Fill a gap'], ['behind', 'Behind the scenes'], ['season', 'Seasonal']]
const CH = { ig: ['Instagram', '#E1306C'], fb: ['Facebook', '#4A9EFF'], tt: ['TikTok', '#f4f2f7'], li: ['LinkedIn', '#0A66C2'], gm: ['Google', '#34A853'] }

export default function ContentIdeas() {
  const F = useFlows(); const { s, toast } = F; const ideas = s.ideas
  const [k, setK] = useState('all'), [sel, setSel] = useState(ideas[0]?.id)
  const list = useMemo(() => ideas.filter(i => k === 'all' || i.k === k), [ideas, k])
  const i = ideas.find(x => x.id === sel) || list[0]
  const setIdea = (id, patch) => F.upd('ideas', id, patch)
  const nextSel = id => setSel((ideas.find(x => x.id !== id) || {}).id || null)
  const keep = id => { const x = ideas.find(y => y.id === id); F.add('posts', { d: x.bd || addDays(TODAY, 2), ch: x.ch, t: x.t, body: x.cap, st: 'draft', s: x.s, m: x.m, stats: '', time: '19:30' }, 'post'); F.del('ideas', id); nextSel(id); toast('Added to the calendar as a draft for ' + (x.best || 'this week') + '.') }
  const pass = id => { const x = ideas.find(y => y.id === id); F.add('passed', { from: 'Lumi', j: x.t, w: x.k, g: '' }, 'any'); F.del('ideas', id); nextSel(id); toast('Passed. Lumi will suggest fewer like it.') }
  const rewrite = () => { const takes = [i.cap, i.cap.split('. ')[0] + '.', i.cap + ' Link in bio.']; F.open({ title: 'Rewrite', sub: 'Three takes in your voice. Pick one or write it.', cta: 'Use this', fields: [{ k: 'cap', l: 'Caption', type: 'select', value: takes[0], options: takes.map((t, n) => [t, ['Yours', 'Shorter', 'With a nudge'][n] + ' · ' + t.slice(0, 60) + (t.length > 60 ? '…' : '')]) }, { k: 'edit', l: 'Or write it', type: 'textarea', rows: 4 }], submit: v => { setIdea(i.id, { cap: v.edit.trim() || v.cap }); toast('Caption updated.') } }) }
  const more = () => F.open({ title: 'More like this', sub: 'Tell Lumi what you want more of. She drafts three by tomorrow.', cta: 'Ask', fields: [{ k: 'kind', l: 'Kind', type: 'select', value: 'gallery', options: KINDS.slice(1) }, { k: 'note', l: 'Anything specific', type: 'textarea', rows: 3, placeholder: 'More real estate, fewer reels' }], submit: v => { F.add('ideas', { k: v.kind, t: 'Lumi is drafting · ' + KINDS.find(x => x[0] === v.kind)[1].toLowerCase(), why: v.note || 'Asked for on ' + TODAY + '. Ready tomorrow morning.', cap: '', ch: ['ig'], s: 31, m: 'cool', best: 'Tomorrow', bd: addDays(TODAY, 1) }, 'idea', false); toast('Asked. Three new ideas by tomorrow morning.') } })
  return (
    <section className="view">
      <div className="vh">
        <div><h1>Content ideas</h1><p>Drafted from work you've already done. Keep the good ones, they land on the calendar as drafts.</p></div>
        <div className="acts"><Link className="btn g" to="/app/content-calendar"><Icon name="cal" size={15} />Calendar</Link><button className="btn w" onClick={more}><span className="lm" style={{ width: 14, height: 14 }} />More like this</button></div>
      </div>
      <div className="grid">
        <div className="s12"><div className="kp">
          {[['Ideas waiting', ideas.length, 'refreshed this morning', ''], ['Kept this month', '11', '8 posted, 3 drafts', ''], ['Best day to post', 'Thursday', '7:30 pm, from your last 90 days', 'n'], ['Posts that brought enquiries', '3', 'all from galleries', 'n']].map(([l, v, e, w]) => <div key={l} className="k lg"><small>{l}</small><b>{v}</b><em className={w}>{e}</em></div>)}
        </div></div>

        <div className="card lg s8">
          <div className="h"><div className="tfilt" style={{ padding: 0 }}>{KINDS.map(([key, l]) => <button key={key} className={k === key ? 'on' : ''} onClick={() => setK(key)}>{l}<i>{ideas.filter(x => key === 'all' || x.k === key).length}</i></button>)}</div></div>
          <div className="ideas">
            {list.map(x => <div key={x.id} className={'idea' + (i?.id === x.id ? ' on' : '')} onClick={() => setSel(x.id)} role="button" tabIndex={0}>
              <span className="th"><Still seed={x.s} mood={x.m} /></span>
              <div className="tx"><b>{x.t}</b><small>{x.why}</small><span className="chs">{x.ch.map(c => <i key={c} style={{ background: CH[c][1] }} title={CH[c][0]} />)}<em>{x.best}</em></span></div>
              <div className="do"><button className="y" onClick={e => { e.stopPropagation(); keep(x.id) }}>Keep</button><button onClick={e => { e.stopPropagation(); pass(x.id) }}>Pass</button></div>
            </div>)}
            {!list.length && <div className="tempty">Nothing left here. Lumi adds more as work is delivered. <button className="lnk" onClick={more}>Ask for more</button></div>}
          </div>
        </div>

        {i ? <div className="s4 side">
          <div className="card lg gsel">
            <div className="cover"><Still seed={i.s + 40} mood={i.m} /><div className="in"><b>{i.t}</b><small>Best time · {i.best}</small></div></div>
            <div className="chpick">{Object.entries(CH).map(([c, [n, col]]) => <button key={c} type="button" className={i.ch.includes(c) ? 'on' : ''} style={{ '--c': col }} onClick={() => setIdea(i.id, { ch: i.ch.includes(c) ? i.ch.filter(y => y !== c) : [...i.ch, c] })}><i />{n}</button>)}</div>
            <textarea className="ta cap" rows={4} value={i.cap} onChange={e => setIdea(i.id, { cap: e.target.value })} aria-label="Caption" />
            <div className="ctas"><button className="btn w sm" onClick={() => keep(i.id)}>Keep, to calendar <Icon name="arrow" size={13} /></button><button className="btn g sm" onClick={rewrite}>Rewrite</button><button className="btn g sm" onClick={() => pass(i.id)}>Pass</button></div>
          </div>
          <div className="card lg"><div className="h"><b>Why this one</b><small className="lumi-by"><span className="lm" style={{ width: 12, height: 12 }} />Lumi</small></div><p className="note2">{i.why} Captions are in your voice from the last forty posts. Nothing goes out until you schedule it.</p></div>
        </div> : <div className="s4 side"><div className="card lg"><p className="tempty">Pick an idea.</p></div></div>}
      </div>
    </section>
  )
}
