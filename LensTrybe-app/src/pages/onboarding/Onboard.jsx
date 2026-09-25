import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Aurora from '../../components/Aurora'
import Logo from '../../components/Logo'
import Icon from '../../components/Icon'
import { useSpecular } from '../../lib/useSpecular'
import { useStore, TODAY } from '../../lib/store'
import { outside, waitlistTo } from '../../lib/region'
import { signUpCreative } from '../../lib/auth'
import { LIVE } from '../../lib/mode'
import '../../styles/public.css'
import '../../styles/pages.css'
import './onboard.css'

// The one step after Join: pick a plan, agree, and the account is made. Everything else (photo, bio,
// packages, availability) is the checklist inside, filled in whenever suits. A founding code from
// Join (already checked by the founding-code function) locks the plan to what the code grants.
//
// Live: the account is created here, with the chosen plan in the signUp metadata the way the live
// site does it, so the trigger sets the free period; a paid plan opens the card window (nothing
// charged until the free months end); then the check-email page, since confirmation is on.
// The details arrive in router state from Join (the password is never in a URL); a refresh loses
// them and goes back to Join with the non-secret fields restored.
const PLANS = [['Basic', 'Free', 'Profile, enquiries, one skill', 'Free forever'], ['Pro', '$24.99', 'Quotes, invoices, contracts, job board', '3 months free'], ['Expert', '$74.99', 'Your own website, both skills, reply anywhere in Australia', '3 months free'], ['Elite', '$149.99', 'Custom domain, team of five, Elite spotlight', '3 months free']]

export default function Onboard() {
  const { state } = useLocation(); const nav = useNavigate(); useSpecular([]); const { patch, set } = useStore()
  const j = state || {}
  const first = j.first || '', last = j.last || '', email = j.email || '', disc0 = j.disc || 'Photographer', password = j.password || '', code = (j.code || '').toUpperCase()
  const founding = !!code
  const lock = founding ? (j.codeTier ? j.codeTier[0].toUpperCase() + j.codeTier.slice(1) : 'Expert') : ''
  const [plan, setPlan] = useState(lock || 'Pro'), [agree, setAgree] = useState(false), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  useEffect(() => { if (outside()) return nav(waitlistTo(), { replace: true }); if (!first || !email || (LIVE && !password)) nav('/join', { replace: true }) }, [first, email, password, nav])
  const name = (first + ' ' + last).trim()
  const go = async () => {
    if (!agree) return setErr('Have a read of the terms first, then tick the box.')
    const disc = !['Expert', 'Elite'].includes(plan) && disc0 === 'Both' ? 'Photographer' : disc0
    if (LIVE) {
      if (busy) return; setBusy(true)
      const r = await signUpCreative({ first, last, email, password, disc, tier: plan.toLowerCase(), billing: 'monthly', code, news: j.news !== false })
      setBusy(false)
      if (r.error) return setErr(r.error)
      try { sessionStorage.removeItem('lt_join') } catch { /* ignore */ }
      return nav(r.needsConfirm ? '/check-email' : '/app/today?welcome=1', { replace: true, state: { email, as: 'creative' } })
    }
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
          <div className="plans4">{PLANS.map(([n, pr, d, tag]) => <button key={n} type="button" className={plan === n ? 'on' : ''} disabled={founding && n !== lock} onClick={() => { setPlan(n); setErr('') }}><b>{n}</b><span>{pr}{pr !== 'Free' && <small style={{ display: 'inline', minHeight: 0, marginLeft: 3 }}>/mo</small>}</span><small>{d}</small><em>{founding && n === lock ? 'Founding: free for a year' : tag}</em></button>)}</div>
          {disc0 === 'Both' && !['Expert', 'Elite'].includes(plan) && <p className="fine">Photographer and videographer on one profile needs Expert or Elite. On {plan} you start as a photographer and can add film later.</p>}
          <label className="obagree"><input type="checkbox" checked={agree} onChange={e => { setAgree(e.target.checked); setErr('') }} /><span>I agree to the <Link to="/legal/terms" target="_blank">terms</Link> and <Link to="/legal/privacy" target="_blank">privacy policy</Link>{founding && <> and the <Link to="/legal/founding" target="_blank">founding creative agreement</Link></>}.</span></label>
          {err && <p className="oberr">{err}</p>}
          <div className="row"><button className="btn p lg" onClick={go} disabled={busy} style={busy ? { opacity: .6 } : undefined}>{busy ? 'Setting up' : plan === 'Basic' || !LIVE ? 'Open my workspace' : 'Add a card and open my workspace'} <Icon name="arrow" size={14} /></button><Link className="btn g lg" to="/pricing">Compare plans</Link></div>
          <p className="fine">{plan === 'Basic' ? 'No card, ever, on Basic.' : 'A card is saved now and nothing is charged until your free months end; cancel before then and pay nothing at all.'} Your profile goes live the moment it has a photo, a line about you and one kind of work; the workspace walks you through it.</p>
        </div>
      </main>
    </div>
  )
}
