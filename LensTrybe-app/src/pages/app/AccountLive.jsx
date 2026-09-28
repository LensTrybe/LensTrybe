import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useFlows } from '../../lib/flows'
import { useAuth } from '../../backend/AuthContext'
import { TIER_ORDER, TIER_META, planCardLines, planLabel } from '../../backend/tierFeatures'
import { payWithRevolut, getSavedCard, updateSavedCard } from '../../backend/revolut'
import { nice } from '../../lib/store'
import * as live from '../../lib/live'

// Live versions of Subscription, Referrals, Founding hub and Support. They work the way the live
// site does: the same tables, the same edge functions (change-subscription, cancel-revolut-subscription,
// update-payment-method, generate-referral-code, submit-support-ticket) and the same wording where
// money or commitments are involved.

const Head = ({ h, p, children }) => <div className="vh"><div><h1>{h}</h1><p>{p}</p></div><div className="acts">{children}</div></div>
const Tiles = ({ t }) => <div className="s12"><div className="kp">{t.map(([l, v, e, w]) => <div key={l} className="k lg"><small>{l}</small><b>{v}</b><em className={w}>{e}</em></div>)}</div></div>
const cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '')
const aud = (v, minor) => { const n = minor ? Number(v) / 100 : Number(v); try { return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n) } catch { return '$' + n.toFixed(2) } }
const longDate = iso => { if (!iso) return ''; try { return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) } catch { return '' } }
const RANK = { basic: 0, pro: 1, expert: 2, elite: 3 }
const LIVE_ST = ['active', 'trialing', 'past_due']
const BRAND = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', american_express: 'American Express' }
const brandName = b => BRAND[String(b || '').toLowerCase().replace(/\s+/g, '_')] || (b ? cap(String(b)) : 'Card')
const PLANS = TIER_ORDER.map((id, i) => ({ id, name: TIER_META[id].name, m: TIER_META[id].monthly, a: TIER_META[id].annual, lines: i ? ['Everything in ' + TIER_META[TIER_ORDER[i - 1]].name, ...planCardLines(id)] : planCardLines(id) }))

/* Subscription: the real plan, card and changes, through Revolut. */
export function SubscriptionLive() {
  const F = useFlows(); const { toast } = F; const { user, profile, tier: ctxTier } = useAuth()
  const [sub, setSub] = useState(undefined), [card, setCard] = useState(null), [billing, setBilling] = useState('monthly'), [busy, setBusy] = useState('')
  const load = async () => {
    if (!user?.id) return
    const row = await live.loadSubscription(user.id).catch(() => null)
    setSub(row)
    if (row && LIVE_ST.includes(row.status)) {
      if (row.billing) setBilling(row.billing)
      if (row.revolut_payment_method_id) setCard(row.card_last4 ? { brand: row.card_brand, last4: row.card_last4, expMonth: row.card_exp_month, expYear: row.card_exp_year } : await getSavedCard().catch(() => null))
    } else setCard(null)
  }
  useEffect(() => { load() }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (sub === undefined) return <section className="view"><Head h="Subscription" p="Loading your plan…" /></section>
  const access = String(profile?.subscription_tier || ctxTier || 'basic').toLowerCase().replace('vip', 'elite')
  const hasLive = !!(sub && LIVE_ST.includes(sub.status))
  const billed = (hasLive ? sub.tier : null) || 'basic', curBilling = sub?.billing || 'monthly'
  const founding = !!(sub?.founding_member || profile?.founding_member)
  const isComp = access !== 'basic' && access !== (hasLive ? billed : 'basic') && sub?.status !== 'canceled'
  const isAdmin = !!(profile && (profile.is_admin === true || profile.role === 'admin'))
  const adminSwitch = isAdmin && !hasLive
  const included = p => isComp && (p.id === 'basic' ? !hasLive : RANK[p.id] <= RANK[access] && !(p.id === billed && hasLive))
  const isCurrent = p => p.id === billed && billing === curBilling && hasLive
  const highlighted = p => (isComp || adminSwitch) ? p.id === access : isCurrent(p)
  const label = p => {
    if (adminSwitch) return p.id === access ? (isComp ? 'Complimentary' : 'Current plan') : 'Switch to ' + p.name
    if (isComp && p.id === access) return 'Complimentary'
    if (included(p)) return 'Included'
    if (isCurrent(p)) return sub?.pending_tier ? 'Keep this plan' : isComp ? 'Your billed plan' : 'Current plan'
    if (p.id === 'basic') return billed === 'basic' ? 'Current plan' : 'Cancel to Free'
    if (!hasLive) return 'Choose ' + p.name
    return RANK[p.id] > RANK[billed] || (p.id === billed && curBilling === 'monthly' && billing === 'annual') ? 'Upgrade to ' + p.name : 'Switch to ' + p.name
  }
  const disabled = p => adminSwitch ? p.id === access : included(p) || (isCurrent(p) && !sub?.pending_tier)
  const price = p => billing === 'annual' ? p.a : p.m
  const reload = () => setTimeout(() => window.location.reload(), 1300)
  const run = async (key, fn) => { if (busy) return; setBusy(key); try { await fn() } catch (e) { toast(e.message || 'Something went wrong.') } finally { setBusy('') } }
  const cancel = () => F.confirm({ title: 'Cancel your subscription', body: <>You'll keep <b>{planLabel(billed)}</b> access until <b>{longDate(sub?.current_period_end)}</b>, then move to the Trybe Free plan. We don't refund the remaining period, and you can resubscribe anytime. This doesn't affect your rights under the Australian Consumer Law.</>, cta: 'Cancel subscription', danger: true,
    onYes: () => run('cancel', async () => { const d = await live.cancelSubscription(); toast('Subscription cancelled. You keep access until ' + (d.accessUntil ? longDate(d.accessUntil) : 'the end of your billing period') + '.'); setTimeout(load, 800) }) })
  const choose = p => run(p.id, async () => {
    if (adminSwitch) { if (p.id === access) return; await live.adminSetTier(user.id, p.id); toast('Switched to ' + p.name + '. Admin test switch, no billing.'); reload(); return }
    if (p.id === 'basic') { if (billed !== 'basic') cancel(); return }
    if (isCurrent(p)) { if (sub?.pending_tier) { await live.planChange(p.id, billing, false); toast('Scheduled change cancelled. Staying on your current plan.'); await load() } return }
    if (!hasLive) { const r = await payWithRevolut({ user: { id: user.id, email: user.email }, tier: p.id, billing, fullName: profile?.business_name || user.email }); if (r === 'success') { toast('Subscription started!'); reload() } return }
    const pv = await live.planChange(p.id, billing, true)
    if (pv.change === 'none') return toast('You are already on this plan.')
    const up = pv.change === 'upgrade', each = aud(price(p)) + '/' + (billing === 'annual' ? 'yr' : 'mo')
    F.confirm({ title: (up ? 'Upgrade to ' : 'Downgrade to ') + p.name,
      body: up ? (pv.trialing ? <>You're on a free trial, so there's no charge now. Your plan changes to <b>{p.name} ({cap(billing)})</b> immediately, and you'll be charged {aud(price(p))} when your trial ends{pv.nextChargeDate ? ' on ' + longDate(pv.nextChargeDate) : ''}.</> : <>Your plan changes to <b>{p.name} ({cap(billing)})</b> immediately. You'll be charged <b>{aud(pv.chargeNow, true)}</b> today, prorated for the rest of your current period. From then it's {each}{pv.newPeriodEnd ? ', renewing ' + longDate(pv.newPeriodEnd) : ''}.</>)
        : (pv.trialing ? <>Your plan changes to <b>{p.name} ({cap(billing)})</b> immediately (free trial, no charge now). You'll be charged {aud(price(p))} when your trial ends.</> : <>You'll keep <b>{planLabel(billed)}</b> until <b>{longDate(pv.effectiveAt)}</b>, then move to <b>{p.name} ({cap(billing)})</b> at {each}. No refund for the current period.</>),
      cta: up ? (pv.trialing ? 'Confirm change' : 'Pay ' + aud(pv.chargeNow, true) + ' & upgrade') : 'Schedule downgrade',
      onYes: () => run('commit', async () => { const d = await live.planChange(p.id, billing, false); toast(d.change === 'upgrade' ? (d.chargeNow > 0 ? 'Upgraded. ' + aud(d.chargeNow, true) + ' charged today.' : 'Upgraded.') : 'Downgrade scheduled for the end of your billing period.'); reload() }) })
  })
  const updateCard = () => run('card', async () => {
    const r = await updateSavedCard(); if (r?.cancelled) return
    if (r?.card) setCard(r.card)
    toast(r?.paid ? 'Card updated and your payment went through. Thanks!' : r?.retried ? "Card saved, but the payment didn't go through. Please check with your bank or try another card." : sub?.status === 'past_due' ? "Card updated. We'll retry your payment shortly." : 'Card updated. Future payments will use this card.')
    await load()
  })
  const exp = card?.expMonth && card?.expYear ? (() => { const n = new Date(); const m = (Number(card.expYear) - n.getFullYear()) * 12 + (Number(card.expMonth) - (n.getMonth() + 1)); return m < 0 ? 'expired' : m <= 1 ? 'soon' : '' })() : ''
  const status = !hasLive ? (sub?.status === 'canceled' && sub.current_period_end ? 'Cancelled · access until ' + longDate(sub.current_period_end) : isComp ? 'Complimentary' : 'Free') : sub.status === 'trialing' ? 'Free trial until ' + longDate(sub.next_charge_date) : sub.status === 'past_due' ? 'Payment overdue' : sub.pending_tier ? planLabel(sub.pending_tier) + ' from ' + longDate(sub.pending_change_at || sub.current_period_end) : 'Renews ' + longDate(sub.current_period_end)
  return (
    <section className="view">
      <Head h="Subscription" p="Your plan and the card it's billed to. No commission, ever.">{hasLive && sub?.revolut_payment_method_id && <button className="btn g" disabled={!!busy} onClick={updateCard}><Icon name="card" size={15} />{busy === 'card' ? 'Opening…' : 'Update card'}</button>}</Head>
      <div className="grid">
        <Tiles t={[['Plan', planLabel(access), [isComp ? 'Complimentary' : hasLive && billed !== 'basic' ? cap(curBilling) : '', founding ? 'Founding' : ''].filter(Boolean).join(' · ') || 'no card needed', ''], ['Status', hasLive ? cap(sub.status === 'past_due' ? 'overdue' : sub.status) : isComp ? 'Complimentary' : 'Free', status, sub?.status === 'past_due' ? 'w' : 'n'], ['Card', card ? brandName(card.brand) + ' ···· ' + card.last4 : '—', card?.expMonth ? (exp === 'expired' ? 'Expired ' : 'Expires ') + String(card.expMonth).padStart(2, '0') + '/' + String(card.expYear).slice(-2) : hasLive ? 'loading' : 'none on file', exp ? 'w' : 'n'], ['Billed as', hasLive ? planLabel(billed) : '—', hasLive && isComp ? 'your access is higher, complimentary' : hasLive ? cap(curBilling) : 'no subscription', 'n']]} />
        {(adminSwitch || (isComp && !hasLive)) && <div className="s12"><div className="tlumi"><span className="lm" /><div>{adminSwitch ? 'Admin account: switch your own plan below to test each tier. No card or billing is involved.' : 'Your complimentary plan is managed by LensTrybe. Contact support if you would like to change it.'}</div></div></div>}
        {sub?.status === 'past_due' && <div className="s12"><div className="tlumi"><span className="lm" /><div><b>Your last payment didn't go through.</b> Update your card to keep your {planLabel(billed)} features.{sub.past_due_since ? " If it isn't paid by " + longDate(new Date(new Date(sub.past_due_since).getTime() + 7 * 86400000).toISOString()) + ', your account moves to the Trybe Free plan.' : ''} We'll also retry automatically each day.<div className="acts"><button className="y" disabled={!!busy} onClick={updateCard}>Update card</button></div></div></div></div>}
        {sub?.pending_tier && <div className="s12"><div className="tlumi"><span className="lm" /><div>Scheduled change: your plan moves to <b>{planLabel(sub.pending_tier)}{sub.pending_billing ? ' (' + cap(sub.pending_billing) + ')' : ''}</b> on <b>{longDate(sub.pending_change_at || sub.current_period_end)}</b>. You keep {planLabel(billed)} until then.<div className="acts"><button className="y" disabled={!!busy} onClick={() => choose(PLANS.find(p => p.id === billed))}>Keep my current plan</button></div></div></div></div>}
        <div className="card lg s12">
          <div className="h"><b>Plans</b><div className="tfilt" style={{ padding: 0 }}><button className={billing === 'monthly' ? 'on' : ''} onClick={() => setBilling('monthly')}>Monthly</button><button className={billing === 'annual' ? 'on' : ''} onClick={() => setBilling('annual')}>Annual · 2 months free</button></div></div>
          <div className="plans2">{PLANS.map(p => <div key={p.id} className={'plan2' + (highlighted(p) ? ' mine' : '')}>
            <b>{p.name}</b><span className="pp">{price(p) === 0 ? 'Free' : aud(price(p))}{price(p) > 0 && <small>/{billing === 'annual' ? 'yr' : 'mo'}</small>}</span>
            {billing === 'annual' && price(p) > 0 && <small className="note2">{aud(price(p) / 12)}/mo equivalent</small>}
            <ul className="note2" style={{ margin: '8px 0 12px', paddingLeft: 16, lineHeight: 1.6 }}>{p.lines.map((x, i) => <li key={i}>{x}</li>)}</ul>
            {highlighted(p) ? <span className="st ok">{isComp ? 'Current plan · Complimentary' : 'Current plan'}</span> : <button className={'btn sm ' + (disabled(p) ? 'g' : 'w')} disabled={disabled(p) || !!busy} onClick={() => choose(p)}>{busy === p.id ? 'Working…' : label(p)}</button>}
          </div>)}</div>
          <p className="tempty" style={{ textAlign: 'left', padding: '12px 2px 0', fontSize: 12, lineHeight: 1.6 }}>Prices are in AUD. Annual plans are paid upfront. <b>Upgrades</b> take effect immediately and you pay only the prorated difference for the rest of your current period. <b>Downgrades</b> and <b>cancellations</b> take effect at the end of your current billing period, and you keep full access until then. New subscribers start with a free trial, and you won't be charged if you cancel before it ends. Plans renew automatically until you cancel. Annual plans can be refunded in full if you ask within 14 days of your first annual payment. Otherwise we don't refund part periods, and this doesn't affect your rights under the Australian Consumer Law. <Link to="/legal/refunds">Refund policy</Link>.</p>
        </div>
        {hasLive && billed !== 'basic' && sub?.status !== 'canceled' && <div className="s12"><div className="card lg"><div className="h"><b>Cancel</b></div><p className="note2">Cancel anytime. You keep {planLabel(billed)} until {longDate(sub.current_period_end || sub.next_charge_date)}, then move to Trybe Free.</p><button className="lnk" style={{ marginTop: 8 }} disabled={!!busy} onClick={cancel}>Cancel {planLabel(billed)}</button></div></div>}
      </div>
    </section>
  )
}

/* Referrals: your code and link, and who joined with it. */
export function ReferralsLive() {
  const F = useFlows(); const { s, toast } = F; const { user, profile } = useAuth()
  const paid = s.plan.name !== 'Basic'
  const [d, setD] = useState(null)
  useEffect(() => { if (user?.id) live.loadReferrals(user.id, paid).then(setD).catch(() => setD({ code: '', count: 0, rows: [] })) }, [user?.id, paid])
  const link = d?.code ? 'https://lenstrybe.com/join/creative?ref=' + d.code : ''
  const copy = (t, what) => { try { navigator.clipboard?.writeText(t)?.catch(() => {}) } catch (_) { /* */ } toast(what + ' copied.') }
  const share = () => F.open({ title: 'Share your link', sub: 'Copy this and send it however you like.', cta: 'Copy message', fields: [{ k: 'msg', l: 'Message', type: 'textarea', rows: 4, value: "I run my photography business on LensTrybe. Join with my link and you get 10% off your first payment: " + link }], submit: v => { copy(v.msg, 'Message') } })
  const confirmed = (d?.rows || []).filter(r => r.st === 'confirmed' || r.ok)
  return (
    <section className="view">
      <Head h="Referrals" p="Invite other creatives. They get 10% off their first payment. You get 10% off your next billing cycle for every confirmed referral.">{d?.code && <><button className="btn g" onClick={() => copy(d.code, 'Code')}><Icon name="gift" size={15} />Copy code</button><button className="btn w" onClick={() => copy(link, 'Link')}><Icon name="globe" size={15} />Copy invite link</button></>}</Head>
      <div className="grid">
        <Tiles t={[['Confirmed', String(d ? d.count : '…'), 'successful referrals', ''], ['Signed up', String(d ? d.rows.length : '…'), d?.rows.length ? 'with your code' : 'nobody yet', 'n'], ['Your reward', '10% off', 'your next billing cycle, per confirmed referral', 'n'], ['Their reward', '10% off', 'their first payment', 'n']]} />
        <div className="card lg s8"><div className="h"><b>Who used your code</b></div>
          <div className="need">{(d?.rows || []).map(r => <div key={r.id} className="r"><span className="av" style={{ background: 'var(--bg-3)', display: 'grid', placeItems: 'center' }}><Icon name="user" size={14} /></span><div><b>{r.n}</b><small>Joined {nice(r.at)}{r.ok ? ' · confirmed ' + nice(r.ok) : ''}</small></div><div className="do"><span className={'st ' + (r.st === 'confirmed' || r.ok ? 'ok' : 'viewed')}>{r.st === 'confirmed' || r.ok ? 'Confirmed' : 'Not on a paid plan yet'}</span></div></div>)}{d && !d.rows.length && <div className="tempty">Nobody has used your code yet. A referral is confirmed when they start a paid plan.</div>}</div>
        </div>
        <div className="s4 side">
          <div className="card lg"><div className="h"><b>Your code</b></div>
            {!d ? <p className="note2">Loading…</p> : d.code ? <><div className="lnkrow" style={{ margin: '0 0 10px' }}><Icon name="star" size={14} /><span style={{ fontWeight: 700, letterSpacing: '.05em' }}>{d.code}</span><button onClick={() => copy(d.code, 'Code')}>Copy</button></div><div className="lnkrow" style={{ margin: '0 0 10px' }}><Icon name="globe" size={14} /><span>{link.replace('https://', '')}</span><button onClick={() => copy(link, 'Link')}>Copy</button></div><button className="btn g sm" onClick={share}>Write a message</button></>
              : <><p className="note2">Your referral code appears here once you're on a paid plan.</p><Link className="btn g sm" to="/app/subscription" style={{ marginTop: 10 }}>See plans</Link></>}
          </div>
          <div className="card lg"><div className="h"><b>How it works</b></div><div className="kv"><span>1</span><b>Share your code or link with another creative</b></div><div className="kv"><span>2</span><b>They join and start a paid plan</b></div><div className="kv"><span>3</span><b>You both get 10% off</b></div>{profile?.referred_by_code ? <p className="note2" style={{ marginTop: 8 }}>You joined with code {profile.referred_by_code}.</p> : null}</div>
          {confirmed.length > 0 && <div className="tlumi"><span className="lm" /><div>{confirmed.length === 1 ? confirmed[0].n + ' is on a paid plan' : confirmed.length + ' people you referred are on paid plans'}. Your discount comes off your next billing cycle.</div></div>}
        </div>
      </div>
    </section>
  )
}

/* Founding hub: the three responsibilities that keep the founding deal, and the feedback form. */
const FB_CATS = ['What is working well', 'What could be better', 'A feature idea', 'A bug or problem', 'Something else']
const thisMonth = iso => { if (!iso) return false; const d = new Date(iso), n = new Date(); return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() }
export function FoundingLive() {
  const F = useFlows(); const { toast } = F; const { user, profile } = useAuth()
  const isFounding = !!(profile && (profile.founding_member === true || profile.founding_member === 'true'))
  const deal = String(profile?.founding_deal_status || 'active')
  const [d, setD] = useState(null), [cat, setCat] = useState(FB_CATS[0]), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false)
  useEffect(() => { if (user?.id && isFounding) live.loadFounding(user.id).then(setD).catch(() => setD({ listing: false, jobs: 0, lastFeedback: null })) }, [user?.id, isFounding])
  if (!isFounding) return (
    <section className="view"><Head h="Founding hub" p="For LensTrybe's founding creatives." />
      <div className="grid"><div className="card lg s7"><div className="h"><b>Founding creatives only</b></div><p className="note2">This hub is for LensTrybe founding creatives. If you were invited and entered your code at sign-up, it will appear here.</p><div className="acts" style={{ marginTop: 12, display: 'flex', gap: 8 }}><Link className="btn g sm" to="/founding">About the founding programme</Link><Link className="btn g sm" to="/app">Back to Today</Link></div></div></div>
    </section>)
  const fbDone = thisMonth(d?.lastFeedback)
  const items = [
    { t: 'Complete your profile to 100%', d: 'A finished, client-ready listing within 7 days of joining.', done: !!d?.listing, st: d?.listing ? 'Complete' : 'In progress', to: d?.listing ? null : ['/app/profile', 'Finish your profile'] },
    { t: 'Run your first 3 real jobs through LensTrybe', d: 'Within your first 6 months. Send a quote, have the client accept it, then invoice and mark it paid.', done: (d?.jobs || 0) >= 3, st: Math.min(d?.jobs || 0, 3) + ' of 3 done', to: (d?.jobs || 0) >= 3 ? null : ['/app/quotes', 'Create a quote'] },
    { t: 'Share one piece of feedback a month', d: "It shapes what we build next. Use the form here. Miss a month and we'll just send a friendly reminder.", done: fbDone, st: fbDone ? 'Done this month' : 'Due this month', to: null },
  ]
  const chip = deal === 'reverted' ? ['grey', 'Reverted to standard plan'] : deal === 'at_risk' ? ['viewed', 'At risk, action needed'] : ['ok', 'Founding deal active']
  const send = async () => { if (busy) return; setBusy(true); try { await live.sendFoundingFeedback(user.id, cat, msg); setMsg(''); setD(x => ({ ...x, lastFeedback: new Date().toISOString() })); toast('Thanks. Your feedback has been sent, and your monthly feedback is ticked off.') } catch (e) { toast(e.message) } finally { setBusy(false) } }
  return (
    <section className="view">
      <Head h="Founding hub" p="Thanks for being one of the first. Here is what keeps your founding deal: 12 months free Trybe Complete, then $49/mo for life."><Link className="btn g" to="/legal/founding">Your agreement</Link></Head>
      <div className="grid">
        <Tiles t={[['Your deal', chip[1], deal === 'at_risk' ? 'sort it before your grace period ends' : deal === 'reverted' ? 'on the standard plan now' : '12 months free Trybe Complete, then $49/mo', deal === 'active' ? '' : 'w'], ['Founding since', profile?.founding_member_since ? nice(String(profile.founding_member_since).slice(0, 10), { year: 'numeric' }) : '—', 'the day you joined', 'n'], ['Responsibilities', d ? items.filter(x => x.done).length + ' of 3' : '…', 'done', 'n'], ['Feedback', fbDone ? 'Sent' : 'Due', 'this month', fbDone ? 'n' : 'w']]} />
        {deal === 'at_risk' && <div className="s12"><div className="tlumi"><span className="lm" /><div>You have a little outstanding on your founding responsibilities. Sort it before your grace period ends to keep your deal.</div></div></div>}
        <div className="card lg s7"><div className="h"><b>Your founding responsibilities</b><span className={'st ' + chip[0]}>{chip[1]}</span></div>
          <div className="need">{items.map(x => <div key={x.t} className="r" style={{ alignItems: 'flex-start' }}><span className="av" style={{ background: x.done ? 'var(--sig)' : 'var(--bg-3)', display: 'grid', placeItems: 'center', color: x.done ? '#04120a' : 'inherit' }}><Icon name={x.done ? 'check' : 'clock'} size={14} /></span><div><b>{x.t}</b><small style={{ whiteSpace: 'normal' }}>{x.d}</small>{x.to && <Link className="lnk" to={x.to[0]} style={{ display: 'inline-block', marginTop: 6 }}>{x.to[1]} →</Link>}</div><div className="do"><span className={'st ' + (x.done ? 'ok' : 'viewed')}>{d ? x.st : '…'}</span></div></div>)}</div>
        </div>
        <div className="s5 side">
          <div className="card lg"><div className="h"><b>Share your feedback</b></div><p className="note2">Tell us what is working, what is not, and what you would love to see. It goes straight to the team.</p>
            <label className="bf" style={{ marginTop: 10 }}><span>Topic</span><select value={cat} onChange={e => setCat(e.target.value)}>{FB_CATS.map(c => <option key={c}>{c}</option>)}</select></label>
            <label className="bf" style={{ marginTop: 10 }}><span>Your feedback</span><textarea className="ta" rows={5} value={msg} onChange={e => setMsg(e.target.value)} placeholder="What is on your mind?" /></label>
            <button className="btn w sm" style={{ marginTop: 12 }} disabled={busy} onClick={send}>{busy ? 'Sending…' : 'Send feedback'} <Icon name="arrow" size={13} /></button>
          </div>
          <div className="card lg"><div className="h"><b>Have a say</b></div><p className="note2">Founding creatives vote on what gets built next.</p><Link className="btn g sm" to="/upcoming" style={{ marginTop: 10 }}>Upcoming features <Icon name="arrow" size={13} /></Link></div>
        </div>
      </div>
    </section>
  )
}

/* Support: the live FAQs, the ticket form and your past tickets. */
const S_CATS = ['Account and login', 'Billing and subscription', 'Bookings and clients', 'Invoices, quotes and contracts', 'Technical issue or bug', 'Feedback or feature idea', 'Something else']
const FAQS = [
  ['How do I update my billing or change my plan?', 'Go to Subscription. You can move between Trybe Free, Trybe Essential, Trybe Complete and Trybe Studio at any time. Upgrades apply straight away; downgrades apply from your next billing date.'],
  ['A client cannot open my invoice, quote or portal link. What do I do?', 'Resend the document from the relevant page (Invoicing, Quotes or Deliver) so a fresh link is generated. If it still will not open, send us the client name and the link and we will look into it.'],
  ['I did not receive an email from LensTrybe.', 'Our emails come from noreply@mail.lenstrybe.com. Please check your spam or promotions folder and mark us as safe. If it is still missing after a few minutes, let us know below.'],
  ['How do payouts and commission work?', 'LensTrybe is no-commission. You keep everything you charge your clients. Your only cost is your monthly subscription.'],
  ['How quickly will I hear back?', 'We usually reply within one business day. Founding creatives are always first in the queue.'],
]
export function SupportLive() {
  const F = useFlows(); const { toast } = F; const { user, profile } = useAuth()
  const [q, setQ] = useState(''), [open, setOpen] = useState(0), [f, setF] = useState({ name: profile?.business_name || '', email: user?.email || '', category: '', subject: '', message: '' }), [busy, setBusy] = useState(false), [tickets, setTickets] = useState([])
  useEffect(() => { if (user?.id) live.loadTickets(user.id).then(setTickets).catch(() => {}) }, [user?.id])
  const u = k => e => setF(x => ({ ...x, [k]: e.target.value }))
  const send = async () => {
    if (!f.email.trim()) return toast('Add an email address so we can reply.')
    if (!f.message.trim()) return toast('Tell us a little about what you need help with.')
    if (busy) return; setBusy(true)
    try { const ref = await live.submitTicket({ ...f, uid: user?.id }); setF(x => ({ ...x, subject: '', message: '', category: '' })); toast('Sent · reference ' + ref + '. We usually reply within one business day.'); live.loadTickets(user.id).then(setTickets).catch(() => {}) } catch (e) { toast(e.message) } finally { setBusy(false) }
  }
  const shown = FAQS.filter(([a, b]) => !q || (a + b).toLowerCase().includes(q.toLowerCase()))
  return (
    <section className="view">
      <Head h="Help and support" p="Answers first. A person within a business day when you need one."><a className="btn g" href="mailto:connect@lenstrybe.com">connect@lenstrybe.com</a></Head>
      <div className="grid">
        <div className="s7 side">
          <div className="card lg">
            <label className="tsearch" style={{ margin: 0, height: 44 }}><Icon name="search" size={15} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search the common questions" aria-label="Search help" /></label>
            <div className="faq2">{shown.map(([a, b], i) => <div key={a} className={'fq2' + (open === i ? ' on' : '')}><button type="button" onClick={() => setOpen(open === i ? -1 : i)}><span>{a}</span><i>+</i></button><p>{b}</p></div>)}{q && !shown.length && <p className="tempty">Nothing on that yet. Send us a message and a person will answer.</p>}</div>
          </div>
          {tickets.length > 0 && <div className="card lg"><div className="h"><b>Your requests</b></div><div className="tl">{tickets.map(t => <div key={t.id} className="e"><span className="t" style={{ width: 'auto' }}><Icon name="chat" size={14} /></span><div><b>{t.subject || t.about}</b><small>{t.ref} · {nice(t.at)} · {t.msg.slice(0, 80)}</small></div><span className={'st ' + (/resolved|closed/i.test(t.st) ? 'ok' : 'viewed')}>{cap(t.st)}</span></div>)}</div></div>}
        </div>
        <div className="s5 side">
          <div className="card lg"><div className="h"><b>Message us</b></div>
            <div className="two" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><label className="bf"><span>Name</span><input value={f.name} onChange={u('name')} /></label><label className="bf"><span>Email</span><input type="email" value={f.email} onChange={u('email')} /></label></div>
            <label className="bf" style={{ marginTop: 10 }}><span>Topic</span><select value={f.category} onChange={u('category')}><option value="">Choose a topic (optional)</option>{S_CATS.map(x => <option key={x}>{x}</option>)}</select></label>
            <label className="bf" style={{ marginTop: 10 }}><span>Subject</span><input value={f.subject} onChange={u('subject')} placeholder="Optional" /></label>
            <label className="bf" style={{ marginTop: 10 }}><span>Message</span><textarea className="ta" rows={5} value={f.message} onChange={u('message')} placeholder="Say what happened. The more detail, the faster we can help." /></label>
            <button className="btn w sm" style={{ marginTop: 12 }} disabled={busy} onClick={send}>{busy ? 'Sending…' : 'Send'} <Icon name="arrow" size={13} /></button>
          </div>
        </div>
      </div>
    </section>
  )
}
