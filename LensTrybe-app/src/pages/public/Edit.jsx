import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import Aurora from '../../components/Aurora'
import Still from '../../components/Still'
import Icon from '../../components/Icon'
import { mountLens } from '../../lib/lens'
import { useToast } from '../../components/Toast'
import { ISSUES } from '../../data/edit'
import { LIVE } from '../../lib/mode'
import { editConfirm, editSubscribe, loadEditIssues } from '../../lib/account'

// Demo shows the bundled issues; live shows what the edit_issues table has published.
function useIssues() {
  const [list, setList] = useState(LIVE ? null : ISSUES)
  useEffect(() => { if (!LIVE) return; let on = true; loadEditIssues().then(d => { if (on) setList(d) }).catch(() => { if (on) setList([]) }); return () => { on = false } }, [])
  return list
}

function Inline({ text }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
  return parts.map((p, i) => p.startsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : p.startsWith('*') ? <em key={i}>{p.slice(1, -1)}</em> : p)
}
function Body({ paras }) {
  return paras.map((p, i) => p.startsWith('### ') ? <h3 key={i}>{p.slice(4)}</h3> : p.startsWith('> ') ? <blockquote key={i}><Inline text={p.slice(2)} /></blockquote> : <p key={i}><Inline text={p} /></p>)
}

function Subscribe({ dark }) {
  const toast = useToast(); const [e, setE] = useState(''); const [busy, setBusy] = useState(false)
  const go = async ev => {
    ev.preventDefault(); if (!e.trim() || busy) return
    setBusy(true)
    try { await editSubscribe(e); toast("You're subscribed to The Trybe Edit."); setE('') }
    catch (err) { toast(err.message || 'Something went wrong. Try again.') }
    finally { setBusy(false) }
  }
  return (
    <form className={'subs' + (dark ? ' d' : '')} onSubmit={go}>
      <span className="lens" aria-hidden="true" /><input type="email" value={e} onChange={ev => setE(ev.target.value)} placeholder="you@studio.com.au" aria-label="Email" /><button type="submit" className="go">Subscribe<Icon name="arrow" size={14} /></button>
    </form>
  )
}

// The Trybe Edit front: the masthead over the lens, the latest issue, the archive, subscribe.
export function EditHome() {
  const cv = useRef(null)
  useEffect(() => { const l = mountLens(cv.current); l.layout({ cy: .5, r: .3 }); return () => l.destroy() }, [])
  const issues = useIssues(); const latest = issues?.[0]
  return (
    <>
      <section className="hiw edit dark darkhero">
        <canvas className="gl" ref={cv} aria-hidden="true" />
        <div className="in">
          <p className="eb">LensTrybe presents</p>
          <h1 className="mast"><span className="ln"><span>The Trybe <em>Edit.</em></span></span></h1>
          <p className="sub">A monthly read for professional visual creatives who are serious about building a business, not just a following. Written by the people building LensTrybe.</p>
          <Subscribe dark />
          <p className="tiny">A new issue on the 1st of every month. Unsubscribe any time.</p>
        </div>
      </section>
      <div className="lt">
        <Aurora />
        <section className="sec" style={{ paddingTop: 'clamp(40px,6vw,72px)' }}><div className="wrap">
          {!latest ? <div className="stephead rv"><div><p className="eb g">{issues ? 'Issue #1 · October 2026' : 'Loading'}</p><h2>The first issue lands <em>1 October.</em></h2><p className="lede">Then a new issue on the 1st of every month, right here.</p></div></div> : <>
          <div className="stephead rv"><div><p className="eb g">Latest issue · {latest.month}</p><h2>{latest.title.split(' ').slice(0, 3).join(' ')} <em>{latest.title.split(' ').slice(3).join(' ')}.</em></h2></div></div>
          <Link className="ecover lg rv" to={'/edit/' + latest.slug}>
            <div className="cimg"><Still seed={latest.seed} mood={latest.mood} /><span className="ctag">Issue #{latest.n}</span></div>
            <div className="cbody">
              <p className="dek">{latest.dek}</p>
              <div className="cmeta"><span>{latest.month}</span><span>{latest.read} read</span><span>{latest.sections.length} sections</span></div>
              <span className="btn k">Read the issue <Icon name="arrow" size={14} /></span>
            </div>
          </Link></>}
        </div></section>
        {latest && <section className="sec" style={{ paddingTop: 0 }}><div className="wrap">
          <div className="stephead rv"><div><p className="eb g">Every issue</p><h2>The <em>archive.</em></h2></div></div>
          <div className="agrid rv">
            {issues.map(i => <Link key={i.slug} className="acard lg" to={'/edit/' + i.slug}><div className="img"><Still seed={i.seed} mood={i.mood} /></div><div><small>Issue #{i.n} · {i.month}</small><b>{i.title}</b><span>{i.read} read</span></div></Link>)}
            <div className="acard lg soon"><div><small>Issue #{latest.n + 1} · the 1st of next month</small><b>A new issue on the 1st of every month.</b><span>Subscribe above so you don't miss it.</span></div></div>
          </div>
        </div></section>}
      </div>
    </>
  )
}

// One issue, read like a magazine.
export function EditIssue() {
  const { slug } = useParams(); const issues = useIssues(); const issue = issues?.find(i => i.slug === slug)
  const cv = useRef(null)
  useEffect(() => { if (!cv.current) return; const l = mountLens(cv.current); l.layout({ cy: .5, r: .3 }); scrollTo(0, 0); return () => l.destroy() }, [slug, !!issue])
  if (!issues) return <section className="hiw edit issue dark darkhero" style={{ minHeight: '60vh' }} />
  if (!issue) return <Navigate to="/edit" replace />
  return (
    <>
      <section className="hiw edit issue dark darkhero">
        <canvas className="gl" ref={cv} aria-hidden="true" />
        <div className="in">
          <p className="eb">The Trybe Edit · Issue #{issue.n} · {issue.month}</p>
          <h1><span className="ln"><span><Inline text={issue.title} /></span></span></h1>
          <p className="sub">{issue.dek}</p>
          <div className="imeta"><span>{issue.read} read</span><span>For creative professionals</span><Link to="/edit">All issues</Link></div>
        </div>
      </section>
      <div className="lt">
        <Aurora />
        <article className="sec ed" style={{ paddingTop: 'clamp(36px,5vw,60px)' }}><div className="wrap edwrap">
          {issue.sections.map(s => (
            <section key={s.k} className={'esec ' + s.k}>
              <p className="eb g">{s.label}</p>
              {s.h && <h2><Inline text={s.h} /></h2>}
              {s.k === 'note' ? <div className="enote lg"><Body paras={s.body} /><div className="esig"><b>{s.sig[0]}</b><span>{s.sig[1]}</span></div></div> : s.body && <Body paras={s.body} />}
              {s.plans && <div className="eplans">{s.plans.map(p => <div key={p.n} className={'eplan lg' + (p.hot ? ' hot' : '')}><div className="ph"><b>{p.n}</b><span className="pr">{p.p}</span></div><small>{p.s}</small><em>{p.who}</em><p>{p.d}</p><div className="tags">{p.tags.map(t => <span key={t}>{t}</span>)}</div></div>)}</div>}
              {s.after && <p className="after"><Inline text={s.after} /></p>}
              {s.teaser && <div className="teaser lg"><i className="star">★</i><h3>{s.teaser.h}</h3><p>{s.teaser.p}</p></div>}
              {s.tip && <div className="tipbox lg"><small>This month's tip</small><h3>{s.tip.h}</h3><p>{s.tip.p}</p></div>}
              {s.next && <div className="nextgrid">{s.next.map(([l, t]) => <div key={t} className="lg"><small>{l}</small><b>{t}</b></div>)}</div>}
            </section>
          ))}
          <div className="closer lg rv">
            <div><p className="eb g">Don't miss the next issue</p><h2>A new issue on the 1st. <em>Every month.</em></h2></div>
            <Subscribe />
          </div>
        </div></article>
      </div>
    </>
  )
}

// The link in the confirm email lands here: /edit/confirm?t=<token>
export function EditConfirm() {
  const [q] = useSearchParams(); const [st, setSt] = useState('busy'); const [msg, setMsg] = useState('')
  const once = useRef(false)
  useEffect(() => { if (once.current) return; once.current = true; editConfirm(q.get('t') || '').then(() => setSt('ok')).catch(e => { setMsg(e.message); setSt('bad') }) }, [])
  return (
    <section className="hiw edit dark darkhero" style={{ minHeight: '70vh' }}>
      <div className="in">
        <p className="eb">The Trybe Edit</p>
        <h1 className="mast"><span className="ln"><span>{st === 'ok' ? <>You're <em>subscribed.</em></> : st === 'bad' ? <>That link <em>didn't work.</em></> : 'Confirming…'}</span></span></h1>
        <p className="sub">{st === 'ok' ? 'A new issue of The Trybe Edit goes up on the 1st of every month.' : st === 'bad' ? (msg || 'Subscribe again and we will send a new link.') : ''}</p>
        {st !== 'busy' && <div className="ctas" style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 18 }}><Link className="btn" to="/edit">Read The Trybe Edit <Icon name="arrow" size={14} /></Link></div>}
      </div>
    </section>
  )
}
