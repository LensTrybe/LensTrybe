import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Still from '../../components/Still'
import Icon from '../../components/Icon'
import { useFlows } from '../../lib/flows'
import { LIVE } from '../../lib/mode'
import { useAuth } from '../../backend/AuthContext'
import { imageUrl } from '../../backend/imageUrl'
import * as live from '../../lib/live'
import { TODAY, nice, daysBetween } from '../../lib/store'
import { fmt } from '../../lib/format'

// Marketplace: gear bought, sold and swapped between creatives on LensTrybe. Browse what others have
// listed, keep your own listings and the conversations on them, save things to come back to.
// No fee and no cut; the two creatives deal directly.
const SORT = [['new', 'Newest'], ['lo', 'Price, low to high'], ['hi', 'Price, high to low'], ['near', 'Nearest']]
const Stars = ({ r }) => <span className="stars2" style={{ fontSize: 11 }}>{[1, 2, 3, 4, 5].map(i => <i key={i} className={i <= Math.round(r) ? 'on' : ''}>★</i>)}</span>
const Photo = ({ l, big }) => l.photos?.[0]?.cover ? <img src={l.photos[0].cover} alt="" /> : <Still seed={l.s + (big ? 40 : 0)} mood={l.m} />

export default function Marketplace() { return LIVE ? <MarketLive /> : <MarketDemo /> }
function MarketDemo() {
  const F = useFlows(); const { s, toast } = F; const L = s.listings, SAVED = s.savedListings || [], O = s.offers || []
  const [tab, setTab] = useState('browse'), [q, setQ] = useState(''), [cat, setCat] = useState('all'), [cond, setCond] = useState('all'), [swap, setSwap] = useState(false), [sort, setSort] = useState('new'), [sel, setSel] = useState(null)
  const cats = useMemo(() => [...new Set([...F.MCATS.filter(c => c !== 'Other'), ...L.map(l => l.cat)])], [L]) // eslint-disable-line
  const mine = L.filter(l => l.seller.id === 'me'), saved = L.filter(l => SAVED.includes(l.id))
  const pool = tab === 'browse' ? L.filter(l => l.st === 'live' && l.seller.id !== 'me') : tab === 'mine' ? mine : saved
  const list = useMemo(() => pool.filter(l => (cat === 'all' || l.cat === cat) && (cond === 'all' || l.cond === cond) && (!swap || l.swap) && (!q || (l.t + ' ' + l.d + ' ' + l.cat + ' ' + l.loc + ' ' + l.seller.n).toLowerCase().includes(q.toLowerCase()))).sort((a, b) => sort === 'lo' ? a.p - b.p : sort === 'hi' ? b.p - a.p : sort === 'near' ? (a.loc.includes('Noosa') || a.loc.includes('Sunshine') ? -1 : 1) - (b.loc.includes('Noosa') || b.loc.includes('Sunshine') ? -1 : 1) : (a.posted < b.posted ? 1 : -1)), [pool, cat, cond, swap, q, sort])
  const l = L.find(x => x.id === sel)
  const isMine = l?.seller.id === 'me'
  const thread = l ? O.filter(o => o.l === l.id) : []
  const soldVal = mine.filter(l => l.st === 'sold').reduce((t, l) => t + l.p, 0)
  const unread = O.filter(o => !o.mine && mine.some(l => l.id === o.l)).length
  const open = id => { setSel(id); const x = L.find(y => y.id === id); if (x && x.seller.id !== 'me') F.upd('listings', id, y => ({ views: (y.views || 0) + 1 })) }
  return (
    <section className="view mkt">
      <div className="vh">
        <div><h1>Marketplace</h1><p>Buy, sell and swap gear with other creatives. No fee, no cut, you deal directly.</p></div>
        <div className="acts"><button className="btn g" onClick={() => F.sellFromKit(id => { setTab('mine'); setSel(id) })}><Icon name="box" size={15} />Sell from my kit</button><button className="btn w" onClick={() => F.postListing({ then: id => { setTab('mine'); setSel(id) } })}><Icon name="plus" size={15} />Post listing</button></div>
      </div>
      <div className="grid">
        <div className="s12"><div className="kp">
          {[['Live listings', String(L.filter(l => l.st === 'live').length), 'from ' + new Set(L.filter(l => l.st === 'live').map(l => l.seller.id)).size + ' creatives, all Queensland', ''], ['Your listings', String(mine.filter(l => l.st === 'live').length), mine.filter(l => l.st === 'live').reduce((t, l) => t + l.views, 0) + ' views · ' + mine.filter(l => l.st === 'live').reduce((t, l) => t + l.saves, 0) + ' saves', ''], ['Messages', String(unread), unread ? 'on ' + [...new Set(O.filter(o => !o.mine).map(o => o.l))].length + ' of your listings' : 'nothing waiting', unread ? 'w' : 'n'], ['Sold', fmt(soldVal), mine.filter(l => l.st === 'sold').length + (mine.filter(l => l.st === 'sold').length === 1 ? ' item' : ' items') + ' this year', 'n']].map(([lb, v, e, w]) => <div key={lb} className="k lg"><small>{lb}</small><b>{v}</b><em className={w}>{e}</em></div>)}
        </div></div>

        <div className={'card lg ' + (l ? 's8' : 's12')}>
          <div className="h">
            <div className="tfilt" style={{ padding: 0 }}>{[['browse', 'Browse', L.filter(x => x.st === 'live' && x.seller.id !== 'me').length], ['mine', 'My listings', mine.length], ['saved', 'Saved', saved.length]].map(([k, lb, n]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); setSel(null) }}>{lb}<i>{n}</i></button>)}</div>
            <label className="tsearch" style={{ margin: 0, height: 34, width: 240 }}><Icon name="search" size={14} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search listings" aria-label="Search listings" /></label>
          </div>
          <div className="mfilt">
            <select value={cat} onChange={e => setCat(e.target.value)} aria-label="Category"><option value="all">All categories</option>{cats.map(c => <option key={c}>{c}</option>)}</select>
            <select value={cond} onChange={e => setCond(e.target.value)} aria-label="Condition"><option value="all">Any condition</option>{F.MCOND.map(c => <option key={c}>{c}</option>)}</select>
            <select value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort">{SORT.map(([k, lb]) => <option key={k} value={k}>{lb}</option>)}</select>
            <button type="button" className={'chip' + (swap ? ' p' : '')} onClick={() => setSwap(!swap)}><Icon name="chev" size={11} style={{ transform: 'rotate(90deg)' }} />Open to swaps</button>
          </div>
          <div className={'mgrid' + (l ? ' narrow' : '')}>
            {list.map(x => <button key={x.id} type="button" className={'ml' + (sel === x.id ? ' on' : '') + (x.st === 'sold' ? ' sold' : '')} onClick={() => open(x.id)}>
              <span className="ph"><Photo l={x} />{x.swap ? <em className="tag">Swap</em> : null}{x.st === 'sold' && <em className="tag sold">Sold</em>}<i className={'sv' + (SAVED.includes(x.id) ? ' on' : '')} onClick={e => { e.stopPropagation(); F.saveListing(x.id) }} role="button" aria-label="Save"><Icon name="star" size={13} /></i></span>
              <b>{x.t}</b>
              <span className="pr">{fmt(x.p)}<small>{x.cond}</small></span>
              <small className="mt">{x.loc.split(',')[0]} · {x.seller.id === 'me' ? 'You' : x.seller.n.split(' ')[0]} · {daysBetween(x.posted, TODAY) === 0 ? 'today' : daysBetween(x.posted, TODAY) + ' d ago'}</small>
            </button>)}
            {!list.length && <div className="tempty" style={{ gridColumn: '1/-1' }}>{tab === 'mine' ? <>Nothing listed yet. <button className="lnk" onClick={() => F.postListing({ then: id => setSel(id) })}>Post your first listing</button></> : tab === 'saved' ? 'Nothing saved. Tap the star on a listing to keep it here.' : 'No listings match. Try another category or clear the search.'}</div>}
          </div>
        </div>

        {l && <div className="s4 side">
          <div className="card lg mdet">
            <div className="mph"><Photo l={l} big />{l.photos?.length > 1 && <div className="thumbs">{l.photos.slice(0, 5).map((p, i) => <span key={i}>{p.cover ? <img src={p.cover} alt="" /> : <Still seed={l.s + i} mood={l.m} />}</span>)}</div>}<button className="ic2 x" aria-label="Close" onClick={() => setSel(null)}><Icon name="x" size={14} /></button></div>
            <div className="mtop"><div><b>{l.t}</b><small>{l.cat} · {l.cond} · {l.loc}</small></div><span className="mpr">{fmt(l.p)}</span></div>
            <div className="mtags">{l.swap ? <span className="st ok">Open to swaps</span> : null}{l.st === 'sold' && <span className="st grey">Sold {l.sold ? nice(l.sold) : ''}{l.soldTo ? ' · ' + l.soldTo : ''}</span>}<span className="st grey">Posted {nice(l.posted)}</span>{isMine && <span className="st grey">{l.views} views · {l.saves} saves</span>}</div>
            <p className="mdesc">{l.d || 'No description.'}</p>
            {!isMine && <div className="seller"><span className="av" style={{ background: 'linear-gradient(135deg,#472657,#c6a5e5)' }} /><div><b>{l.seller.n}</b><small>{l.seller.c} · <Stars r={l.seller.r} /> {l.seller.r} · {l.seller.rv} reviews</small></div><Link className="lnk" to={'/creatives/' + l.seller.id}>Profile</Link></div>}
            <div className="ctas">
              {isMine ? (l.st === 'sold' ? <><button className="btn w sm" onClick={() => F.relist(l.id)}>Relist</button><button className="btn g sm" onClick={() => F.removeListing(l.id)}>Delete</button></>
                : <><button className="btn w sm" onClick={() => F.markSold(l.id)}>Mark sold</button><button className="btn g sm" onClick={() => F.editListing(l.id)}>Edit</button><button className="btn g sm" onClick={() => F.removeListing(l.id)}>Delete</button></>)
                : <><button className="btn w sm" onClick={() => F.contactSeller(l.id)}>Contact seller</button><button className="btn g sm" onClick={() => F.makeOffer(l.id)}>Make an offer</button>{l.swap ? <button className="btn g sm" onClick={() => F.proposeSwap(l.id)}>Propose a swap</button> : null}<button className={'btn g sm' + (SAVED.includes(l.id) ? ' on' : '')} onClick={() => F.saveListing(l.id)}>{SAVED.includes(l.id) ? 'Saved' : 'Save'}</button></>}
            </div>
          </div>
          {thread.length > 0 && <div className="card lg"><div className="h"><b>{isMine ? 'Messages on this listing' : 'Your messages'}</b><small className="lumi-by">{thread.length}</small></div>
            <div className="mthread">{thread.map(o => <div key={o.id} className={'om' + (o.mine ? ' me' : '')}><small>{o.from.split(' ')[0]} · {nice(o.at)}</small>{o.kind === 'offer' && <b>Offer · {fmt(o.p)}{o.accepted ? ' · accepted' : ''}</b>}{o.kind === 'swap' && <b>Swap · {o.gear.join(', ')}{o.p ? ' + ' + fmt(o.p) : ''}{o.accepted ? ' · accepted' : ''}</b>}{o.text && <p>{o.text}</p>}{isMine && !o.mine && (o.kind === 'offer' || o.kind === 'swap') && !o.accepted && <button className="act2" onClick={() => F.acceptOffer(o.id)}>Accept</button>}</div>)}</div>
            {isMine && <button className="btn g sm" style={{ marginTop: 10 }} onClick={() => F.replyOffer(l.id, [...thread].reverse().find(o => !o.mine)?.from || 'buyer')}>Reply</button>}
          </div>}
          <div className="tlumi"><span className="lm" /><div>{isMine && l.st === 'live' && thread.some(o => !o.mine) ? [...thread].reverse().find(o => !o.mine).from.split(' ')[0] + ' is asking about this. Listings answered within a day sell twice as often.' : isMine && l.st === 'live' ? l.views + ' views and ' + l.saves + ' saves so far. ' + (l.p > 500 ? 'Similar ' + l.cat.toLowerCase() + ' listings went for about ' + fmt(Math.round(l.p * 0.92)) + '.' : 'Priced about right for the condition.') : !isMine && l.swap && s.gear.length ? l.seller.n.split(' ')[0] + ' is open to swaps. Your ' + s.gear.slice().sort((a, b) => Math.abs(a.v - l.p) - Math.abs(b.v - l.p))[0].n + ' is in the same bracket if you want to offer it instead of cash.' : !isMine ? 'Verified creative, ' + l.seller.rv + ' client reviews. Meet somewhere public and test it before paying; LensTrybe never holds the money.' : 'Sold. Relist it any time if the deal falls through.'}{!isMine && l.swap && s.gear.length ? <div className="acts"><button className="y" onClick={() => F.proposeSwap(l.id)}>Propose a swap</button></div> : null}</div></div>
        </div>}
      </div>
    </section>
  )
}

// Live: real listings between creatives. Browse / My listings / Saved / My messages. Plan limits as
// on the live site (Basic browse only, Pro 5 live listings, Expert 15, Elite no limit); the database
// enforces them. Contact, offers and swaps are messages in one thread per buyer and listing.
const LSORT = [['new', 'Newest'], ['lo', 'Price, low to high'], ['hi', 'Price, high to low']]
const LIMIT = { Basic: 0, Pro: 5, Expert: 15, Elite: Infinity }
const KIT_CAT = { Bodies: 'Camera bodies', Lenses: 'Lenses', Lights: 'Lighting', Drones: 'Drones', Audio: 'Audio', Support: 'Bags and tripods', Cards: 'Miscellaneous' }
const LPhoto = ({ l, w = 480 }) => l.photos[0] ? <img src={imageUrl(l.photos[0], w)} alt="" loading="lazy" /> : <Still seed={(l.t.charCodeAt(0) || 3) % 24} mood="golden" />
const ago = iso => { if (!iso) return ''; const d = daysBetween(live.dayOfIso(iso) || String(iso).slice(0, 10), TODAY); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d + ' d ago' }
function MarketLive() {
  const F = useFlows(); const { s, toast } = F; const { profile: P, user } = useAuth()
  const plan = s.plan.name, limit = LIMIT[plan] ?? 0
  const [d, setD] = useState(null), [tab, setTab] = useState('browse'), [q, setQ] = useState(''), [cat, setCat] = useState('all'), [cond, setCond] = useState('all'), [swap, setSwap] = useState(false), [sort, setSort] = useState('new'), [sel, setSel] = useState(null), [busy, setBusy] = useState('')
  const [params, setParams] = useSearchParams()
  const load = () => live.loadMarket(P.id).then(setD).catch(e => { setD(x => x || { browse: [], mine: [], saved: [], savedIds: [], buying: [], selling: [] }); toast(e.message) })
  useEffect(() => { if (P?.id) load() }, [P?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const me = { id: P?.id, name: s.profile.n || P?.business_name || 'A creative', email: user?.email || P?.business_email || '' }
  const savedIds = d?.savedIds || []
  const all = useMemo(() => { const m = new Map(); [...(d?.browse || []), ...(d?.saved || []), ...(d?.mine || [])].forEach(l => m.set(l.id, l)); return m }, [d])
  const cats = useMemo(() => [...new Set([...F.MCATS.filter(c => c !== 'Other'), ...[...all.values()].map(l => l.cat)])], [all]) // eslint-disable-line react-hooks/exhaustive-deps
  const pool = tab === 'browse' ? d?.browse || [] : tab === 'mine' ? d?.mine || [] : tab === 'saved' ? d?.saved || [] : []
  const list = useMemo(() => pool.filter(l => (cat === 'all' || l.cat === cat) && (cond === 'all' || l.cond === cond) && (!swap || l.swap) && (!q || (l.t + ' ' + l.d + ' ' + l.cat + ' ' + l.loc + ' ' + l.seller.n).toLowerCase().includes(q.toLowerCase()))).sort((a, b) => sort === 'lo' ? a.p - b.p : sort === 'hi' ? b.p - a.p : a.posted < b.posted ? 1 : -1), [pool, cat, cond, swap, q, sort])
  // from Inventory's "Sell it": open the listing prefilled once the page has loaded
  useEffect(() => { const gid = params.get('sell'); if (!d || !gid) return; setParams({}, { replace: true }); post(true, gid) }, [d]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return <section className="view mkt"><div className="vh"><div><h1>Marketplace</h1><p>Loading listings…</p></div></div></section>
  const l = tab !== 'messages' ? all.get(sel) : null
  const conv = tab === 'messages' ? (d.buying.find(t => t.id === sel) || d.buying[0]) : null
  const liveMine = d.mine.filter(x => x.st === 'live'), sold = d.mine.filter(x => x.st === 'sold')
  const unread = d.selling.reduce((t, x) => t + x.unread, 0)
  const run = async (key, fn) => { if (busy) return; setBusy(key); try { await fn() } catch (e) { toast(e.message) } finally { setBusy('') } }
  const gatePost = () => { if (limit === 0) { F.confirm({ title: 'Selling is on Pro and above', body: 'Browsing, saving and messaging sellers is free on every plan. Pro lists 5 items at a time, Expert 15, Elite as many as you like.', cta: 'See plans', onYes: () => F.nav('/app/subscription') }); return false } if (liveMine.length >= limit) { toast('You have ' + liveMine.length + ' live listings, the most ' + plan + ' allows. Mark one sold or delete one first.'); return false } return true }
  const fromGear = g => ({ t: g.n, cat: KIT_CAT[g.c] || (F.MCATS.includes(g.c) ? g.c : 'Other'), p: g.v ? Math.round(g.v * 0.6) : '', d: g.note || '' })
  const fields = (x = {}, kit) => [
    ...(kit && s.gear.length ? [{ k: 'gear', l: 'From your kit', type: 'select', value: x.gear || '', placeholder: 'Pick an item from Inventory', options: s.gear.map(g => [String(g.id), g.n + (g.c ? ' · ' + g.c : '')]), effect: (gid, v) => { const g = s.gear.find(y => String(y.id) === gid); if (!g) return {}; return { t: g.n, cat: KIT_CAT[g.c] || (F.MCATS.includes(g.c) ? g.c : 'Other'), p: g.v ? Math.round(g.v * 0.6) : v.p, d: v.d || g.note || '' } } }] : []),
    { k: 't', l: 'Title', required: true, placeholder: 'e.g. Sony A7 III body', value: x.t || '' },
    { k: 'cat', l: 'Category', type: 'select', half: true, value: x.cat && !F.MCATS.includes(x.cat) ? '__new' : x.cat || 'Camera bodies', options: [...F.MCATS, ['__new', 'Other, name it…']] }, { k: 'cond', l: 'Condition', type: 'select', half: true, value: x.cond || 'Good', options: F.MCOND },
    { k: 'newCat', l: 'Category name', required: true, placeholder: 'Printers', value: x.cat && !F.MCATS.includes(x.cat) ? x.cat : '', when: v => v.cat === '__new' },
    { k: 'p', l: 'Price (AUD)', type: 'money', required: true, half: true, value: x.p ?? '', step: 1 }, { k: 'loc', l: 'Location', half: true, placeholder: 'Brisbane, QLD', value: x.loc ?? [P?.city, P?.state].filter(Boolean).join(', ') },
    { k: 'd', l: 'Description', type: 'textarea', rows: 3, placeholder: 'Shutter count, what comes with it, any marks', value: x.d || '' },
    { k: 'photos', l: 'Photos', type: 'files', accept: 'image/jpeg,image/png,image/webp', cta: '+ Add photos', hint2: 'Up to 5, JPG, PNG or WebP. The first one is the cover.', value: (x.photos || []).map(u => ({ name: 'photo', size: 0, type: 'image/jpeg', cover: u, url: u })) },
    { k: 'swap', l: 'Open to swaps', type: 'toggle', value: !!x.swap, hint: 'Other creatives can offer gear instead of cash' },
  ]
  const recOf = v => ({ ...v, cat: v.cat === '__new' ? (v.newCat || 'Other').trim() : v.cat })
  const post = (kit, gid) => { if (!gatePost()) return; if (kit && !s.gear.length) return toast('Nothing in your Inventory yet. Add gear there first.'); const g0 = gid && s.gear.find(y => String(y.id) === String(gid)); F.open({ title: kit ? 'Sell from my kit' : 'Post a listing', sub: kit ? 'Pick an item and the listing fills itself from Inventory. Check the price before posting.' : 'Other creatives on LensTrybe see it and message you. No fee, no cut.', cta: 'Post listing', working: 'Posting', center: true, fields: fields(g0 ? { ...fromGear(g0), gear: String(g0.id) } : {}, kit),
    submit: async v => { if ((v.photos || []).length > 5) { toast('Up to 5 photos.'); return false } try { const id = await live.saveListing(P.id, recOf(v)); await load(); setTab('mine'); setSel(id); toast('Listing posted. It is live in the marketplace.') } catch (e) { toast(e.message); return false } } }) }
  const edit = x => F.open({ title: 'Edit listing', cta: 'Save changes', working: 'Saving', center: true, fields: fields(x),
    submit: async v => { if ((v.photos || []).length > 5) { toast('Up to 5 photos.'); return false } try { await live.saveListing(P.id, recOf(v), x.id); await load(); toast('Listing updated.') } catch (e) { toast(e.message); return false } } })
  const remove = x => F.confirm({ title: 'Delete this listing?', body: x.t + '. Its photos go with it. Conversations about it stay in your threads.', cta: 'Delete', danger: true, onYes: () => run(x.id, async () => { await live.deleteListing(x); setSel(null); await load(); toast('Listing deleted.') }) })
  const markSold = x => F.confirm({ title: 'Mark as sold?', body: x.t + ' comes off the marketplace. You can relist it any time.', cta: 'Mark sold', onYes: () => run(x.id, async () => { await live.setListingStatus(x.id, 'sold'); await load(); toast('Marked sold.') }) })
  const relist = x => run(x.id, async () => { if (liveMine.length >= limit) throw new Error('You have ' + liveMine.length + ' live listings, the most ' + plan + ' allows.'); await live.setListingStatus(x.id, 'active'); await load(); toast('Back in the marketplace.') })
  const save = x => run('sv' + x.id, async () => { const on = !savedIds.includes(x.id); await live.toggleSaved(P.id, x.id, on); await load(); toast(on ? 'Saved.' : 'Removed from saved.') })
  const send = async (x, text, ok) => { try { await live.messageSeller(me, x, text); await load(); toast(ok) } catch (e) { toast(e.message); return false } }
  const first = x => x.seller.n.split(' ')[0]
  const contact = x => F.open({ title: 'Message ' + x.seller.n, sub: x.t + ' · ' + fmt(x.p) + (x.seller.c ? ' · ' + x.seller.c : ''), cta: 'Send message', working: 'Sending', fields: [{ k: 'msg', l: 'Message', type: 'textarea', rows: 4, required: true, value: 'Hi ' + first(x) + ", I'm interested in your " + x.t + '. Is it still available?' }], submit: v => send(x, v.msg, 'Sent to ' + first(x) + '. Replies show on My messages and by email.') })
  const offer = x => F.open({ title: 'Make an offer', sub: x.t + ' · asking ' + fmt(x.p), cta: 'Send offer', working: 'Sending', fields: [{ k: 'p', l: 'Your offer', type: 'money', required: true, half: true, value: Math.round(x.p * 0.9) }, { k: 'when', l: 'Pick up', half: true, placeholder: 'Thursday, Noosa' }, { k: 'note', l: 'A line to go with it', type: 'textarea', rows: 2, placeholder: 'Cash on pick up, can do this week.' }],
    submit: v => send(x, 'Offer: ' + fmt(v.p) + ' for ' + x.t + (v.when ? '\nPick up: ' + v.when : '') + (v.note ? '\n' + v.note : ''), 'Offer of ' + fmt(v.p) + ' sent to ' + first(x) + '.') })
  const swapOffer = x => { if (!s.gear.length) return toast('Add gear to your Inventory first, then offer it as a swap.'); F.open({ title: 'Propose a swap', sub: x.t + ' · ' + first(x) + ' is open to swaps', cta: 'Send swap', working: 'Sending', fields: [{ k: 'gear', l: 'From your kit', type: 'chips', required: true, value: [], options: s.gear.map(g => [String(g.id), g.n]) }, { k: 'top', l: 'Plus cash', type: 'money', half: true, value: 0, hint: 'Optional, either way' }, { k: 'note', l: 'A line to go with it', type: 'textarea', rows: 2 }],
    submit: v => { const names = (v.gear || []).map(g => s.gear.find(y => String(y.id) === g)?.n).filter(Boolean); if (!names.length) { toast('Pick at least one item.'); return false } return send(x, 'Swap offer for ' + x.t + ': ' + names.join(', ') + (v.top > 0 ? ' plus ' + fmt(v.top) : '') + (v.note ? '\n' + v.note : ''), 'Swap proposed to ' + first(x) + '.') } }) }
  const replyConv = t => F.open({ title: 'Reply to ' + t.sn, sub: t.t, cta: 'Send', working: 'Sending', fields: [{ k: 'msg', l: 'Message', type: 'textarea', rows: 4, required: true }], submit: async v => { try { await live.messageSeller(me, { t: t.t, seller: { id: t.seller } }, v.msg, t.id); await load(); toast('Sent.') } catch (e) { toast(e.message); return false } } })
  const onListing = x => d.selling.filter(t => t.t === x.t)
  return (
    <section className="view mkt">
      <div className="vh">
        <div><h1>Marketplace</h1><p>Buy, sell and swap gear with other creatives. No fee, no cut, you deal directly.</p></div>
        <div className="acts"><button className="btn g" onClick={() => post(true)}><Icon name="box" size={15} />Sell from my kit</button><button className="btn w" onClick={() => post(false)}><Icon name="plus" size={15} />Post listing</button></div>
      </div>
      <div className="grid">
        <div className="s12"><div className="kp">
          {[['Live listings', String(d.browse.length), d.browse.length ? 'from ' + new Set(d.browse.map(x => x.seller.id)).size + ' creatives' : 'none right now', ''], ['Your listings', String(liveMine.length), limit === 0 ? 'selling is on Pro and above' : limit === Infinity ? 'no limit on Elite' : 'of ' + limit + ' on ' + plan, ''], ['Messages', String(unread), unread ? 'unread from buyers' : d.selling.length ? d.selling.length + ' conversations' : 'nothing waiting', unread ? 'w' : 'n'], ['Sold', String(sold.length), sold.length ? fmt(sold.reduce((t, x) => t + x.p, 0)) + ' listed value' : 'nothing yet', 'n']].map(([lb, v, e, w]) => <div key={lb} className="k lg"><small>{lb}</small><b>{v}</b><em className={w}>{e}</em></div>)}
        </div></div>
        <div className={'card lg ' + (l || conv ? 's8' : 's12')}>
          <div className="h">
            <div className="tfilt" style={{ padding: 0 }}>{[['browse', 'Browse', d.browse.length], ['mine', 'My listings', d.mine.length], ['saved', 'Saved', d.saved.length], ['messages', 'My messages', d.buying.length]].map(([k, lb, n]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); setSel(null) }}>{lb}<i>{n}</i></button>)}</div>
            {tab !== 'messages' && <label className="tsearch" style={{ margin: 0, height: 34, width: 240 }}><Icon name="search" size={14} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search listings" aria-label="Search listings" /></label>}
          </div>
          {tab === 'messages' ? <div className="need">{d.buying.map(t => <div key={t.id} className={'r' + (conv?.id === t.id ? ' on' : '')} onClick={() => setSel(t.id)} style={conv?.id === t.id ? { borderColor: 'var(--sig-rim)', boxShadow: '0 0 0 3px var(--sig-bg)' } : undefined}><span className="av" style={{ background: 'var(--bg-3)', display: 'grid', placeItems: 'center' }}><Icon name="chat" size={14} /></span><div><b>{t.t}</b><small>{t.sn} · {t.msgs.length} {t.msgs.length === 1 ? 'message' : 'messages'} · {ago(t.at)}</small></div><div className="do">{t.msgs.length && !t.msgs[t.msgs.length - 1].me ? <span className="st ok">Replied</span> : <span className="st viewed">Waiting</span>}</div></div>)}{!d.buying.length && <div className="tempty">No conversations yet. Message a seller from any listing and it shows here.</div>}</div> : <>
          <div className="mfilt">
            <select value={cat} onChange={e => setCat(e.target.value)} aria-label="Category"><option value="all">All categories</option>{cats.map(c => <option key={c}>{c}</option>)}</select>
            <select value={cond} onChange={e => setCond(e.target.value)} aria-label="Condition"><option value="all">Any condition</option>{F.MCOND.map(c => <option key={c}>{c}</option>)}</select>
            <select value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort">{LSORT.map(([k, lb]) => <option key={k} value={k}>{lb}</option>)}</select>
            <button type="button" className={'chip' + (swap ? ' p' : '')} onClick={() => setSwap(!swap)}>Open to swaps</button>
          </div>
          <div className={'mgrid' + (l ? ' narrow' : '')}>
            {list.map(x => <button key={x.id} type="button" className={'ml' + (sel === x.id ? ' on' : '') + (x.st === 'sold' ? ' sold' : '')} onClick={() => setSel(x.id)}>
              <span className="ph"><LPhoto l={x} />{x.swap ? <em className="tag">Swap</em> : null}{x.st === 'sold' && <em className="tag sold">Sold</em>}{!x.mine && <i className={'sv' + (savedIds.includes(x.id) ? ' on' : '')} onClick={e => { e.stopPropagation(); save(x) }} role="button" aria-label="Save"><Icon name="star" size={13} /></i>}</span>
              <b>{x.t}</b>
              <span className="pr">{fmt(x.p)}<small>{x.cond}</small></span>
              <small className="mt">{[x.loc.split(',')[0], x.mine ? 'You' : x.seller.n.split(' ')[0], ago(x.posted)].filter(Boolean).join(' · ')}</small>
            </button>)}
            {!list.length && <div className="tempty" style={{ gridColumn: '1/-1' }}>{tab === 'mine' ? <>Nothing listed yet. <button className="lnk" onClick={() => post(false)}>Post your first listing</button></> : tab === 'saved' ? 'Nothing saved. Tap the star on a listing to keep it here.' : q || cat !== 'all' || cond !== 'all' || swap ? 'No listings match. Try another category or clear the search.' : 'Nothing listed yet. Be the first: sell something from your kit.'}</div>}
          </div></>}
        </div>
        {l && <div className="s4 side">
          <div className="card lg mdet">
            <div className="mph"><LPhoto l={l} w={900} />{l.photos.length > 1 && <div className="thumbs">{l.photos.slice(0, 5).map((u, i) => <a key={i} href={u} target="_blank" rel="noopener noreferrer"><img src={imageUrl(u, 160)} alt="" /></a>)}</div>}<button className="ic2 x" aria-label="Close" onClick={() => setSel(null)}><Icon name="x" size={14} /></button></div>
            <div className="mtop"><div><b>{l.t}</b><small>{[l.cat, l.cond, l.loc].filter(Boolean).join(' · ')}</small></div><span className="mpr">{fmt(l.p)}</span></div>
            <div className="mtags">{l.swap ? <span className="st ok">Open to swaps</span> : null}{l.st === 'sold' && <span className="st grey">Sold</span>}<span className="st grey">Posted {nice(l.posted)}</span></div>
            <p className="mdesc" style={{ whiteSpace: 'pre-line' }}>{l.d || 'No description.'}</p>
            {!l.mine && <div className="seller"><span className="av" style={l.seller.av ? { backgroundImage: 'url(' + imageUrl(l.seller.av, 80) + ')', backgroundSize: 'cover' } : { background: 'linear-gradient(135deg,#472657,#c6a5e5)' }} /><div><b>{l.seller.n}</b><small>{[l.seller.c, l.seller.state].filter(Boolean).join(', ') || 'On LensTrybe'}</small></div><Link className="lnk" to={'/creatives/' + l.seller.id} target="_blank" rel="noopener noreferrer">Profile</Link></div>}
            <div className="ctas">
              {l.mine ? (l.st === 'sold' ? <><button className="btn w sm" disabled={!!busy} onClick={() => relist(l)}>Relist</button><button className="btn g sm" disabled={!!busy} onClick={() => remove(l)}>Delete</button></>
                : <><button className="btn w sm" disabled={!!busy} onClick={() => markSold(l)}>Mark sold</button><button className="btn g sm" onClick={() => edit(l)}>Edit</button><button className="btn g sm" disabled={!!busy} onClick={() => remove(l)}>Delete</button></>)
                : <><button className="btn w sm" onClick={() => contact(l)}>Contact seller</button><button className="btn g sm" onClick={() => offer(l)}>Make an offer</button>{l.swap ? <button className="btn g sm" onClick={() => swapOffer(l)}>Propose a swap</button> : null}<button className={'btn g sm' + (savedIds.includes(l.id) ? ' on' : '')} disabled={!!busy} onClick={() => save(l)}>{savedIds.includes(l.id) ? 'Saved' : 'Save'}</button></>}
            </div>
          </div>
          {l.mine && <div className="card lg"><div className="h"><b>Messages on this listing</b><small className="lumi-by">{onListing(l).length}</small></div>
            {onListing(l).length ? onListing(l).map(t => <Link key={t.id} className="kv" to={'/app/thread/' + t.id} style={{ textDecoration: 'none' }}><span>{t.who}{t.unread ? <small className="sub"> · {t.unread} new</small> : null}</span><b>Open <Icon name="arrow" size={12} /></b></Link>) : <div className="tempty">No messages yet. Buyers' messages land in your Threads and show here.</div>}
          </div>}
          {!l.mine && <div className="tlumi"><span className="lm" /><div>Meet somewhere public and test it before paying. LensTrybe never holds the money.</div></div>}
        </div>}
        {conv && <div className="s4 side">
          <div className="card lg"><div className="h"><b>{conv.t}</b><small className="lumi-by">with {conv.sn}</small></div>
            <div className="mthread">{conv.msgs.map(m => <div key={m.id} className={'om' + (m.me ? ' me' : '')}><small>{m.me ? 'You' : conv.sn.split(' ')[0]} · {nice(live.dayOfIso(m.at))}</small><p style={{ whiteSpace: 'pre-line' }}>{m.body}</p></div>)}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}><button className="btn w sm" onClick={() => replyConv(conv)}>Reply</button><Link className="btn g sm" to={'/creatives/' + conv.seller} target="_blank" rel="noopener noreferrer">Their profile</Link></div>
          </div>
        </div>}
      </div>
    </section>
  )
}
