import { useEffect, useState } from 'react'
import { NavLink, Routes, Route, useNavigate, useLocation, Link } from 'react-router-dom'
import Logo from '../../components/Logo'
import Aurora from '../../components/Aurora'
import Icon from '../../components/Icon'
import { SheetProvider, useSheet } from '../../components/Sheet'
import { useStore, nice } from '../../lib/store'
import { useSpecular } from '../../lib/useSpecular'
import { signOut } from '../../lib/auth'
import { useAuth } from '../../backend/AuthContext'
import { LIVE } from '../../lib/mode'
import Today from './Today'
import Threads from './Threads'
import Thread from './Thread'
import Bookings from './Bookings'
import Money from './Money'
import Deliver from './Deliver'
import Clients from './Clients'
import Lumi from './Lumi'
import Dock from './Dock'
import CommandBar from './CommandBar'
import Soon from './Soon'
import Projects from './Projects'
import ProjectDetail from './ProjectDetail'
import DocEditor from './DocEditor'
import ContractEditor from './ContractEditor'
import Channels from './Channels'
import Reviews from './Reviews'
import Marketplace from './Marketplace'
import Performance from './Performance'
import Notes from './Notes'
import Inventory from './Inventory'
import Meetings from './Meetings'
import Tax from './Tax'
import BrandKit from './BrandKit'
import Website from './Website'
import ContentCalendar from './ContentCalendar'
import ContentIdeas from './ContentIdeas'
import Insights from './Insights'
import Collaborate from './Collaborate'
import Team from './Team'
import Availability from './Availability'
import Jobs from './Jobs'
import { EditProfile, ViewProfile, Subscription, Referrals, Founding, Settings, Support } from './Account'
import { TOP, GROUPS } from './nav'
import '../../styles/workspace.css'

const BUILT = { today: Today, threads: Threads, bookings: Bookings, projects: Projects, notes: Notes, inventory: Inventory, meetings: Meetings, tax: Tax, 'brand-kit': BrandKit, website: Website, 'content-calendar': ContentCalendar, 'content-ideas': ContentIdeas, performance: Performance, channels: Channels, reviews: Reviews, marketplace: Marketplace, collaborate: Collaborate, team: Team, insights: Insights, availability: Availability, jobs: Jobs, money: Money, invoicing: () => <Money kind="invoicing" />, quotes: () => <Money kind="quotes" />, contracts: () => <Money kind="contracts" />, expenses: () => <Money kind="expenses" />, deliver: Deliver, clients: Clients, crm: () => <Clients kind="crm" />, profile: EditProfile, 'view-profile': ViewProfile, subscription: Subscription, referrals: Referrals, founding: Founding, settings: Settings, support: Support, lumi: Lumi }
const TABS = [['today', 'Today', 'today'], ['threads', 'Threads', 'chat'], ['bookings', 'Calendar', 'cal'], ['money', 'Money', 'money'], ['clients', 'Clients', 'user']]
// The bell: what happened since you last looked, each one a link to the thing.
function Bell() {
  const { s } = useStore(); const { open, close } = useSheet(); const nav = useNavigate()
  const items = [
    ...s.galleries.flatMap(g => g.log.filter(l => l[0].startsWith('Today') || l[0] === 'Just now').map(l => ({ w: l[0], t: l[1], to: '/app/deliver' }))),
    ...s.threads.filter(t => t.need).map(t => ({ w: 'Today', t: t.n + ' · ' + t.next, to: '/app/thread/' + t.id })),
    ...s.ledger.filter(r => r.st === 'ok' && r.date >= '2026-09-21').map(r => ({ w: nice(r.date), t: r.who + ' paid ' + r.id, to: '/app/thread/' + (r.t || '') })),
  ].slice(0, 8)
  const go = to => { close(); nav(to) }
  return <button className="ic lg" aria-label="Notifications" onClick={() => open({ title: 'What happened', sub: items.length + ' since you last looked', cta: 'Done', cancel: 'Close', body: <div className="tl">{items.map((x, i) => <div key={i} className="e" onClick={() => go(x.to)} style={{ cursor: 'pointer' }}><span className="t" style={{ width: 'auto' }}>{x.w}</span><div><b>{x.t}</b></div></div>)}{!items.length && <p className="tempty">Quiet. Nothing new.</p>}</div>, submit: () => {} })}><Icon name="bell" />{items.length > 0 && <i />}</button>
}
const read = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v === '1' } catch { return d } }

// The creative's workspace. Dark glass by default, light on tap. Lumi sits in a dock on the right
// and can be put away: the workspace does everything on its own, Lumi just does it faster.
export default function Shell() {
  const [dark, setDark] = useState(() => read('lt-dark', true))
  const [dock, setDock] = useState(() => read('lt-dock', typeof innerWidth === 'undefined' || innerWidth > 1600)), [dockM, setDockM] = useState(false)
  const nav = useNavigate(); const { pathname } = useLocation()
  useEffect(() => { try { localStorage.setItem('lt-dark', dark ? '1' : '0') } catch {} }, [dark])
  useEffect(() => { try { localStorage.setItem('lt-dock', dock ? '1' : '0') } catch {} }, [dock])
  useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = '' } }, [])
  useEffect(() => { setDockM(false) }, [pathname])
  useEffect(() => { const a = e => setDark(e.detail.dark), b = e => setDock(e.detail.dock); addEventListener('lt-theme', a); addEventListener('lt-dock', b); return () => { removeEventListener('lt-theme', a); removeEventListener('lt-dock', b) } }, [])
  useSpecular([pathname, dock])
  const toggle = () => { if (innerWidth <= 1180) setDockM(d => !d); else setDock(d => !d) }
  const { s } = useStore(); const need = s.threads.filter(t => t.need).length
  const active = k => pathname === '/app/' + k || (k === 'today' && pathname === '/app') || (k === 'threads' && pathname.startsWith('/app/thread/')) || (k === 'projects' && pathname.startsWith('/app/project/')) || (k === 'invoicing' && pathname.startsWith('/app/invoice/')) || (k === 'quotes' && pathname.startsWith('/app/quote/')) || (k === 'contracts' && pathname.startsWith('/app/contract/'))
  const here = GROUPS.find(g => g[2].some(i => active(i[0])))?.[0] || null
  const [open, setOpen] = useState(here)
  useEffect(() => { if (here) setOpen(here) }, [here])
  const item = ([k, l, ic]) => <NavLink key={k} to={'/app/' + k} className={'nl' + (active(k) ? ' on' : '')}><Icon name={ic} />{l}{k === 'threads' && need > 0 && <span className="n">{need}</span>}</NavLink>
  const group = ([g, ic, items]) => (
    <div key={g} className={'gp' + (open === g ? ' open' : '') + (here === g ? ' here' : '')}>
      <button type="button" className="gh" onClick={() => setOpen(o => o === g ? null : g)} aria-expanded={open === g}><Icon name={ic} />{g}<Icon name="chev" className="cv" size={13} /></button>
      <div className="sub"><div>{items.map(item)}</div></div>
    </div>
  )
  return (
    <div className={'ws' + (dark ? ' dark' : '')}><SheetProvider>
      <Aurora />
      <div className={'shell' + (dock ? '' : ' nodock') + (dockM ? ' dockopen' : '')}>
        <aside className="rail lg" aria-label="Workspace navigation">
          <div className="lg-h"><Link to="/"><Logo white={dark} height={18} /></Link></div>
          {TOP.map(item)}
          <div className="sep" />
          {GROUPS.map(group)}
          <div className="sep" />
          <NavLink to="/app/lumi" className={'nl' + (active('lumi') ? ' on' : '')}><Icon name="spark" />Lumi{!dock && <span className="dot" aria-hidden="true" />}</NavLink>
          <div className="me lg"><span className="av" style={s.profile.avatar && s.profile.avatar !== 'seed' ? { backgroundImage: 'url(' + s.profile.avatar + ')', backgroundSize: 'cover' } : undefined} /><div><b>{s.profile.n}</b><small>{s.plan.name}{s.plan.founding ? ' · Founding' : ''}</small></div><button className="tg" onClick={() => setDark(d => !d)} aria-label="Switch theme"><Icon name={dark ? 'sun' : 'moon'} size={15} /></button><button className="tg" onClick={async () => { await signOut(); nav('/login', { replace: true }) }} aria-label="Log out" title="Log out"><Icon name="out" size={15} /></button></div>
        </aside>
        <header className="top">
          <CommandBar />
          <Bell />
          <button className={'ic lg hm' + (dock ? ' on' : '')} aria-label={dock ? 'Put Lumi away' : 'Show Lumi'} aria-pressed={dock} onClick={toggle}><span className="lm" /></button>
        </header>
        <main className="main lg" id="wsmain">
          <Routes>
            <Route index element={<Today />} />
            <Route path="thread/:id" element={<Thread />} />
            <Route path="project/:id" element={<ProjectDetail />} />
            <Route path="invoice/new" element={<DocEditor kind="inv" />} />
            <Route path="invoice/:id" element={<DocEditor kind="inv" />} />
            <Route path="quote/new" element={<DocEditor kind="q" />} />
            <Route path="quote/:id" element={<DocEditor kind="q" />} />
            <Route path="contract/new" element={<ContractEditor />} />
            <Route path="contract/:id" element={<ContractEditor />} />
            {[...TOP, ...GROUPS.flatMap(g => g[2]), ['lumi']].map(([k]) => { const C = BUILT[k]; return <Route key={k} path={k} element={C ? <C /> : <Soon id={k} />} /> })}
          </Routes>
        </main>
        <Dock onClose={() => { setDock(false); setDockM(false) }} />
      </div>
      <button className="dockbtn" aria-label="Lumi" onClick={() => setDockM(d => !d)}><span className="lm" /></button>
      <nav className="tabbar lg" aria-label="Sections">{TABS.map(([k, l, ic]) => <button key={k} className={active(k) ? 'on' : ''} onClick={() => nav('/app/' + k)}><Icon name={ic} />{l}</button>)}</nav>
    </SheetProvider></div>
  )
}
