import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Aurora from '../../components/Aurora'
import Logo from '../../components/Logo'
import Icon from '../../components/Icon'
import { useSpecular } from '../../lib/useSpecular'
import { useStore, TODAY } from '../../lib/store'
import { outside, waitlistTo } from '../../lib/region'
import { createMyAccount, googleNames, signUpCreative } from '../../lib/auth'
import { useAuth } from '../../backend/AuthContext'
import { LIVE } from '../../lib/mode'
import '../../styles/public.css'
import '../../styles/pages.css'
import './onboard.css'
import { planLabel } from '../../backend/tierFeatures'
import { useFoundingTaken } from '../../lib/founding'

// The one step after Join: pick a plan, agree, and the account is made. Everything else (photo, bio,
// packages, availability) is the checklist inside, filled in whenever suits. A founding code from
// Join (already checked by the founding-code function) locks the plan to what the code grants.
//
// Live: the account is created here, with the chosen plan in the signUp metadata the way the live
// site does it, so the trigger sets the free period; a paid plan opens the card window (nothing
// charged until the free months end); then the check-email page, since confirmation is on.
// The details arrive in router state from Join (the password is never in a URL); a refresh loses
// them and goes back to Join with the non-secret fields restored.
const PLANS = [['Basic', 'Free', 'Profile, enquiries, one skill', 'Free forever'], ['Pro', '$24.99', 'Your own website, quotes and invoices', '3 months free'], ['Expert', '$74.99', 'Contracts, client portals, both skills, reply anywhere in Australia', '3 months free'], ['Elite', '$149.99', 'Custom domain, team of five, Trybe Studio spotlight', '3 months free']]

export default function Onboard() {
  const { state, search } = useLocation(); const nav = useNavigate(); useSpecular([]); const { patch, set } = useStore()
  // Google: already signed in with no account yet; the name and email come from the Google account
  const auth = useAuth(); const gUser = LIVE && auth.user && !auth.profile && !auth.clientAccount ? auth.user : null
  const google = LIVE && (new URLSearchParams(search).get('google') === '1' || !!gUser)
  const gn = googleNames(gUser); const [gDisc, setGDisc] = useState('Photographer')
  const j = google ? { first: gn.first, last: gn.last, email: gUser?.email || '', disc: gDisc, news: false } : (state || {})
  const first = j.first || '', last = j.last || '', email = j.email || '', disc0 = j.disc || 'Photographer', password = j.password || '', code = (j.code || '').toUpperCase()
  const founding = !!code
  // What the code gives, as the signup trigger will grant it: the first 100 to redeem get 12 months
  // and the badge, after that 6 months and no badge. A comped code (another tier) is neither.
  const taken = useFoundingTaken()
  const comp = founding && j.codeTier && j.codeTier.toLowerCase() !== 'expert'
  const freeMonths = taken != null && taken >= 100 ? 6 : 12
  const freeUntil = (() => { const d = new Date(); d.setMonth(d.getMonth() + freeMonths); return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) })()
  const foundingLine = comp ? planLabel(j.codeTier[0].toUpperCase() + j.codeTier.slice(1)) + ', on us. Your code sets it up as you join.' : 'Trybe Complete free for ' + freeMonths + ' months, until ' + freeUntil + ', then $49 a month for life' + (freeMonths === 12 ? ', plus the Founding Creative badge' : '') + '. Three real client jobs in the first six months keeps it.'
  const lock = founding ? (j.codeTier ? j.codeTier[0].toUpperCase() + j.codeTier.slice(1) : 'Expert') : ''
  const [plan, setPlan] = useState(lock || 'Pro'), [agree, setAgree] = useState(false), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  useEffect(() => {
    if (outside()) return nav(waitlistTo(), { replace: true })
    if (google) { if (!auth.loading && !auth.user) nav('/join', { replace: true }); else if (!auth.loading && auth.profile) nav('/app/today', { replace: true }); return }
    if (!first || !email || (LIVE && !password)) nav('/join', { replace: true })
  }, [first, email, password, nav, google, auth.loading, auth.user, auth.profile])
  const name = (first + ' ' + last).trim()
  const go = async () => {
    if (!agree) return setErr('Have a read of the terms first, then tick the box.')
    const disc = !['Expert', 'Elite'].includes(plan) && disc0 === 'Both' ? 'Photographer' : disc0
    if (LIVE && google) {
      if (busy || !gUser) return; setBusy(true)
      const made = await createMyAccount('creative', first, last, disc === 'Both' ? ['Photographer', 'Videographer'] : [disc], false)
      if (made.error) { setBusy(false); return setErr(made.error) }
      if (plan !== 'Basic') {
        const r = await signUpCreative({ google: true, userId: gUser.id, first, last, email, disc, tier: plan.toLowerCase(), billing: 'monthly' })
        if (r.error) { setBusy(false); return setErr(r.error + ' Your account is made on Trybe Free; you can pick a plan any time in Subscription.') }
      }
      return window.location.replace(window.location.origin + '/app/today?welcome=1')
    }
    if (LIVE) {
      if (busy) return; setBusy(true)
      const r = await signUpCreative({ first, last, email, password, disc, tier: plan.toLowerCase(), billing: 'monthly', code, news: j.news !== false })
      setBusy(false)
      if (r.error) { if (r.code === 'exists' && code) { try { sessionStorage.setItem('returnTo', '/app/founding?code=' + encodeURIComponent(code)) } catch { /* ignore */ } return setErr('There is already an account with that email. Log in and use your code from the Founding hub, so you keep your account.') } return setErr(r.error) }
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
          <p className="eb g">{founding ? 'Founding creative programme' : 'Last step, ' + first}</p><h1>{founding ? 'Your place is held.' : 'Pick a plan.'}</h1><p className="sub">{founding ? foundingLine : 'Three months free on any paid plan: add a card, pay nothing until month four, cancel before then and pay nothing at all. Trybe Free is free forever. Change it any time.'}</p>
          {google && <div className="obdisc" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '0 0 16px', alignItems: 'center' }}><span style={{ fontSize: 13, fontWeight: 600, marginRight: 4 }}>What you do</span>{['Photographer', 'Videographer', 'Both'].map(x => <button key={x} type="button" onClick={() => setGDisc(x)} className={'btn sm ' + (gDisc === x ? 'k' : 'g')}>{x}</button>)}</div>}
          <div className="plans4">{PLANS.map(([n, pr, d, tag]) => <button key={n} type="button" className={plan === n ? 'on' : ''} disabled={founding && n !== lock} onClick={() => { setPlan(n); setErr('') }}><b>{planLabel(n)}</b><span>{pr}{pr !== 'Free' && <small style={{ display: 'inline', minHeight: 0, marginLeft: 3 }}>/mo</small>}</span><small>{d}</small><em>{founding && n === lock ? 'Founding: free for a year' : tag}</em></button>)}</div>
          {disc0 === 'Both' && !['Expert', 'Elite'].includes(plan) && <p className="fine">Photographer and videographer on one profile needs Trybe Complete or Trybe Studio. On {planLabel(plan)} you start as a photographer and can add film later.</p>}
          <label className="obagree"><input type="checkbox" checked={agree} onChange={e => { setAgree(e.target.checked); setErr('') }} /><span>I agree to the <Link to="/legal/terms" target="_blank">terms</Link> and <Link to="/legal/privacy" target="_blank">privacy policy</Link>{founding && <> and the <Link to="/legal/founding" target="_blank">founding creative agreement</Link></>}.</span></label>
          {err && <p className="oberr">{err}</p>}
          <div className="row"><button className="btn p lg" onClick={go} disabled={busy} style={busy ? { opacity: .6 } : undefined}>{busy ? 'Setting up' : plan === 'Basic' || !LIVE ? 'Open my workspace' : 'Add a card and open my workspace'} <Icon name="arrow" size={14} /></button><Link className="btn g lg" to="/pricing">Compare plans</Link></div>
          <p className="fine">{plan === 'Basic' ? 'No card, ever, on Trybe Free.' : 'A card is saved now and nothing is charged until your free months end; cancel before then and pay nothing at all.'} Your profile goes live the moment it has a photo, a line about you and one kind of work; the workspace walks you through it.</p>
        </div>
      </main>
    </div>
  )
}
