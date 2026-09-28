import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useSheet } from '../../components/Sheet'
import { useStore } from '../../lib/store'
import { tierHas, lowestTierWith, normalizeSubscriptionTier, planLabel, getFeatures, FEATURE_CATALOG, TIER_ORDER, TIER_META } from '../../backend/tierFeatures'
import { ABOUT } from './nav'

// Every page is open on every plan (Michael, 28 Sep: "look around, prompt on use"). A page the
// plan doesn't cover gets a lock in the sidebar and a slim banner, and the upgrade pop-up opens
// the moment someone tries to create, edit or send anything on it. Looking, scrolling, tabs and
// filters stay free. The database still refuses the save itself (guard_tier_feature), so this is
// the friendly front of a rule that is enforced underneath.
//
// page key -> [feature in TIER_FEATURES, what it's called, is/are]
export const PAGE_GATES = {
  quotes: ['quotes', 'Quotes', 'are'],
  invoicing: ['invoicing', 'Invoicing', 'is'],
  contracts: ['contracts', 'Contracts', 'are'],
  clients: ['crmRecords', 'CRM & Contacts', 'is'],
  crm: ['crmRecords', 'CRM & Contacts', 'is'],
  'brand-kit': ['brandKit', 'The brand kit', 'is'],
  deliver: ['deliverGb', 'Deliver', 'is'],
  insights: ['insights', 'Insights', 'are'],
  team: ['teamSeats', 'Team', 'is'],
  lumi: ['lumiPerMonth', 'Lumi', 'is'],
}
// Where the sidebar's one-line description would oversell for the plan being offered.
const BLURB = {
  deliver: 'Send finished galleries and files to clients with your branding, and see when they download them.',
}
// The document editors belong to their list page.
export function gateKeyFor(pathname) {
  const m = String(pathname || '').match(/^\/app\/([^/]+)/)
  const k = m ? m[1] : ''
  return { quote: 'quotes', invoice: 'invoicing', contract: 'contracts' }[k] || k
}

// What counts as "using" a page: anything that creates, edits, sends or uploads.
const ACT = 'button.btn, a.btn, label.btn, .pbtn, .act2, [data-act], input, textarea, select, [contenteditable="true"], .sw2, label.sfiles'
const FIELD = 'input, textarea, select, [contenteditable="true"]'

// What the pop-up leads with: the business tools a plan adds, not photo counts.
const PITCH = ['contracts', 'quotes', 'invoicing', 'clientPortals', 'crmRecords', 'bookingsPerMonth', 'website', 'deliverGb', 'brandKit', 'insights', 'lumiPerMonth', 'jobBoard', 'teamSeats', 'customDomain', 'eliteSpotlight']
function pitchLines(need, skip) {
  const i = TIER_ORDER.indexOf(need), mine = getFeatures(need), below = getFeatures(TIER_ORDER[i - 1] || 'basic')
  return PITCH.filter(id => id !== skip && mine[id] !== below[id] && (id !== 'lumiPerMonth' || !below[id]))
    .map(id => FEATURE_CATALOG.find(c => c.id === id)?.say(mine[id], need)).filter(Boolean).slice(0, 5)
}

export function usePlanGate() {
  const { s } = useStore(); const { open } = useSheet(); const nav = useNavigate()
  const tier = normalizeSubscriptionTier(s.plan?.name)
  const gate = useCallback(k => {
    const g = PAGE_GATES[k]
    if (!g || tierHas(tier, g[0])) return null
    const need = lowestTierWith(g[0]) || 'expert'
    return { key: k, feature: g[0], name: g[1], verb: g[2], need, plan: planLabel(need) }
  }, [tier])
  const ask = useCallback(k => {
    const g = gate(k); if (!g) return
    const m = TIER_META[g.need] || {}
    const lines = pitchLines(g.need, g.feature)
    open({
      title: g.name + ' ' + g.verb + ' on ' + g.plan,
      sub: m.monthly ? '$' + m.monthly.toFixed(2) + ' a month, first three months free. No commission, ever.' : '',
      center: true,
      body: <div className="gatepop">
        {(BLURB[k] || ABOUT[k]) && <p>{BLURB[k] || ABOUT[k]}</p>}
        {lines.length > 0 && <><small>{g.plan} also gives you</small><ul>{lines.map(l => <li key={l}><Icon name="check" size={14} />{l}</li>)}</ul></>}
      </div>,
      cancel: 'Keep looking',
      cta: 'See plans',
      submit: () => { nav('/app/subscription') },
    })
  }, [gate, open, nav])
  return { tier, gate, ask }
}

// Wraps a page (or the Lumi dock). Unlocked: renders the children untouched.
export function Gate({ k, bar = true, children }) {
  const { gate, ask } = usePlanGate()
  const g = gate(k)
  if (!g) return children
  const stop = e => {
    const t = e.target.closest?.(ACT)
    if (!t || t.closest('[data-free]') || (t.matches('input') && ['search', 'hidden'].includes(t.type))) return false
    e.preventDefault(); e.stopPropagation()
    if (t.matches(FIELD)) t.blur()
    ask(k); return true
  }
  return (
    <div style={{ display: 'contents' }} onClickCapture={stop} onFocusCapture={e => { if (e.target.matches?.(FIELD)) stop(e) }}>
      {bar && <div className="gatebar" data-free>
        <Icon name="lock" size={15} />
        <div><b>{g.name} {g.verb} on {g.plan}</b><span>Have a look around. When you want to use {g.verb === 'are' || g.name === 'Insights' ? 'them' : 'it'}, upgrade your plan.</span></div>
        <button type="button" className="btn w sm" onClick={() => ask(k)}>See plans</button>
      </div>}
      {children}
    </div>
  )
}
