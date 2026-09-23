import { useEffect, useState } from 'react'
import { Link, NavLink, useParams } from 'react-router-dom'
import Aurora from '../../components/Aurora'
import Icon from '../../components/Icon'
import DOCS from '../../data/legal.json'

const ORDER = [['terms', 'Terms and conditions'], ['privacy', 'Privacy policy'], ['cookies', 'Cookies policy'], ['refunds', 'Refund policy'], ['founding', 'Founding creative agreement']]
const SUMMARY = {
  terms: 'The agreement between you and LensTrybe. No commission, ever. You deal with each other directly, we provide the platform.',
  privacy: 'What we collect, why, and what we never do with it. We do not sell your data and we do not show advertising.',
  cookies: 'The small number of cookies the site uses to keep you logged in and understand what is working.',
  refunds: 'Cancel anytime and keep access to the end of the period. Annual plans refunded in full within 14 days.',
  founding: 'The terms of the Founding 100: Expert free for twelve months, then $49 a month locked for life.',
}

// Inline markdown: [text](href) and **bold**
function Inline({ text }) {
  const out = []; const re = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g; let last = 0, m, i = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    if (m[1]) { const h = m[2].replace(/^\/(terms|privacy|cookies|refunds|founding-agreement)$/, (_, d) => '/legal/' + (d === 'founding-agreement' ? 'founding' : d)); out.push(h.startsWith('/') ? <Link key={i++} to={h}>{m[1]}</Link> : <a key={i++} href={h} target={h.startsWith('http') ? '_blank' : undefined} rel="noreferrer">{m[1]}</a>) }
    else out.push(<strong key={i++}>{m[3]}</strong>)
    last = re.lastIndex
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}
function Body({ text }) {
  return String(text || '').trim().split(/\n\s*\n/).map((block, bi) => {
    const lines = block.split('\n')
    if (lines.every(l => l.trim().startsWith('• '))) return <ul key={bi}>{lines.map((l, li) => <li key={li}><Inline text={l.trim().slice(2)} /></li>)}</ul>
    if (block.startsWith('### ')) { const [h, ...rest] = lines; return <div key={bi}><h3>{h.slice(4)}</h3>{rest.length > 0 && <Body text={rest.join('\n')} />}</div> }
    return <p key={bi}><Inline text={block} /></p>
  })
}

// Legal: every policy in one reader. Glass rail of documents, contents on the left, the text itself in plain English.
export default function Legal() {
  const { doc } = useParams(); const key = DOCS[doc] ? doc : 'terms'; const d = DOCS[key]
  const [active, setActive] = useState(d.sections[0]?.id)
  useEffect(() => { setActive(d.sections[0]?.id); scrollTo(0, 0) }, [key])
  useEffect(() => {
    const els = d.sections.map(s => document.getElementById(s.id)).filter(Boolean)
    const io = new IntersectionObserver(es => { es.forEach(e => { if (e.isIntersecting) setActive(e.target.id) }) }, { rootMargin: '-25% 0px -65% 0px' })
    els.forEach(el => io.observe(el)); return () => io.disconnect()
  }, [key])
  return (
    <div className="lt legalpg">
      <Aurora />
      <section className="sec" style={{ paddingTop: 120, paddingBottom: 30 }}><div className="wrap">
        <div className="stephead rv"><div><p className="eb g">Legal · plain English</p><h2>{d.title.replace(/ and Conditions| Policy| Agreement/, m => m.toLowerCase())}, <em>readable.</em></h2></div></div>
        <p className="lead rv">{SUMMARY[key]} Last updated {d.updated}.</p>
        <nav className="docrail lg rv" aria-label="Policies">{ORDER.map(([k, l]) => <NavLink key={k} to={'/legal/' + k} className={({ isActive }) => isActive || (k === key) ? 'on' : ''}>{l}</NavLink>)}</nav>
      </div></section>
      <section className="sec" style={{ paddingTop: 0 }}><div className="wrap">
        <div className="legalgrid">
          <aside className="toc lg rv"><b>Contents</b>{d.sections.map((s, i) => <a key={s.id} href={'#' + s.id} className={active === s.id ? 'on' : ''}><i>{i + 1}</i>{s.title}</a>)}</aside>
          <article className="doc lg rv">
            <div className="intro"><Body text={d.intro} /></div>
            {d.sections.map((s, i) => <section key={s.id} id={s.id} className="dsec"><h2><span>{i + 1}</span>{s.title}</h2><Body text={s.body} /></section>)}
            <p className="fine">Questions about any of this: <a href="mailto:connect@lenstrybe.com">connect@lenstrybe.com</a>. Nothing here limits your rights under the Australian Consumer Law.</p>
          </article>
        </div>
      </div></section>
    </div>
  )
}
