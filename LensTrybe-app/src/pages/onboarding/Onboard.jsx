import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Aurora from '../../components/Aurora'
import Logo from '../../components/Logo'
import Icon from '../../components/Icon'
import { useSpecular } from '../../lib/useSpecular'
import { useStore, TODAY } from '../../lib/store'
import { outside, waitlistTo } from '../../lib/region'
import '../../styles/public.css'
import '../../styles/pages.css'
import './onboard.css'

// The one step after Join: pick a plan, agree, and the workspace opens. Everything else (photo, bio,
// packages, availability) is the checklist inside, filled in whenever suits. A founding code from
// Join locks the plan to Expert: free for a year, then $49 a month for life, with the badge.
const PLANS = [['Basic', 'Free', 'Profile, enquiries, one skill', 'Free forever'], ['Pro', '$24.99', 'Quotes, invoices, contracts, job board', '3 months free'], ['Expert', '$74.99', 'Your own website, both skills, reply anywhere in Australia', '3 months free'], ['Elite', '$149.99', 'Custom domain, team of five, Elite spotlight', '3 months free']]

export default function Onboard() {
  const [p] = useSearchParams(); const nav = useNavigate(); useSpecular([]); const { patch, set } = useStore()
  const first = p.get('first') || '', last = p.get('last') || '', email = p.get('email') || '', disc0 = p.get('disc') || 'Photographer', code = (p.get('code') || p.get('founding') || '').toUpperCase()
  const founding = /^LT-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)
  const [plan, setPlan] = useState(founding ? 'Expert' : p.get('plan') || 'Pro'), [agree, setAgree] = useState(false), [err, setErr] = useState('')
  useEffect(() => { if (outside()) return nav(waitlistTo(), { replace: true }); if (!first || !email) nav('/join' + (code ? '?code=' + encodeURIComponent(code) : ''), { replace: true }) }, [first, email, code, nav])
  const name = (first + ' ' + last).trim()
  const go = () => {
    if (!agree) return setErr('Have a read of the terms first, then tick the box.')
    const disc = !['Expert', 'Elite'].includes(plan) && disc0 === 'Both' ? 'Photographer' : disc0
    patch('profile', { n: name, h: '', bio: '', kinds: [], from: '', city: '', ig: '', web: '', ph: '', disc, avatar: '', shots: [], film: '', strength: 0 })
    patch('brand', { name: '', tag: '' })
    patch('settings', { email, phone: '', biz: '', abn: '' })
    patch('plan', { name: plan, annual: false, founding: founding ? 1 : 0, since: TODAY, trialEnds: plan === 'Basic' ? '' : '2026-12-25' })
    patch('avail', { touched: 0, kinds: { Weddings: 0, 'Real estate': 0, Events: 0, Brand: 0, Headshots: 0, Family: 0 } })
    set('packages', []); set('channels', a => a.map(c => ({ ...c, on: 0, followers: 0, grow: 0 })))
    patch('setup', { hidden: 0, joined: TODAY })
    nav('/app/today?welcome=1')
  }
  return (
    <div className="pub pub-light ob">
      <Aurora />
      <header className="obh"><Link to="/"><Logo height={18} /></Link><div className="obs">{['You', 'Plan', 'Your workspace'].map((t, i) => <span key={t} className={i < 1 ? 'd' : i === 1 ? 'c' : ''}><i />{t}</span>)}</div></header>
      <main className="obw">
        <div className="obc lg">
          <p className="eb g">{founding ? 'Founding creative programme' : 'Last step, ' + first}</p><h1>{founding ? 'Your place is held.' : 'Pick a plan.'}</h1><p className="sub">{founding ? 'Expert free until 21 September 2027, then $49 a month for life, plus the badge. Three real client jobs in the first six months keeps it.' : 'Three months free on any paid plan: add a card, pay nothing until month four, cancel before then and pay nothing at all. Basic is free forever. Change it any time.'}</p>
          <div className="plans4">{PLANS.map(([n, pr, d, tag]) => <button key={n} type="button" className={plan === n ? 'on' : ''} disabled={founding && n !== 'Expert'} onClick={() => { setPlan(n); setErr('') }}><b>{n}</b><span>{pr}{pr !== 'Free' && <small style={{ display: 'inline', minHeight: 0, marginLeft: 3 }}>/mo</small>}</span><small>{d}</small><em>{founding && n === 'Expert' ? 'Founding: free for a year' : tag}</em></button>)}</div>
          {disc0 === 'Both' && !['Expert', 'Elite'].includes(plan) && <p className="fine">Photographer and videographer on one profile needs Expert or Elite. On {plan} you start as a photographer and can add film later.</p>}
          <label className="obagree"><input type="checkbox" checked={agree} onChange={e => { setAgree(e.target.checked); setErr('') }} /><span>I agree to the <Link to="/legal/terms" target="_blank">terms</Link> and <Link to="/legal/privacy" target="_blank">privacy policy</Link>{founding && <> and the <Link to="/legal/founding" target="_blank">founding creative agreement</Link></>}.</span></label>
          {err && <p className="oberr">{err}</p>}
          <div className="row"><button className="btn p lg" onClick={go}>Open my workspace <Icon name="arrow" size={14} /></button><Link className="btn g lg" to="/pricing">Compare plans</Link></div>
          <p className="fine">No card needed today. Your profile goes live the moment it has a photo, a line about you and one kind of work; the workspace walks you through it.</p>
        </div>
      </main>
    </div>
  )
}
