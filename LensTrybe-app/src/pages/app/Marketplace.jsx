import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Still from '../../components/Still'
import Icon from '../../components/Icon'
import { useFlows } from '../../lib/flows'
import { TODAY, nice, daysBetween } from '../../lib/store'
import { fmt } from '../../lib/format'

// Marketplace: gear bought, sold and swapped between creatives on LensTrybe. Browse what others have
// listed, keep your own listings and the conversations on them, save things to come back to.
// No fee and no cut; the two creatives deal directly.
const SORT = [['new', 'Newest'], ['lo', 'Price, low to high'], ['hi', 'Price, high to low'], ['near', 'Nearest']]
const Stars = ({ r }) => <span className="stars2" style={{ fontSize: 11 }}>{[1, 2, 3, 4, 5].map(i => <i key={i} className={i <= Math.round(r) ? 'on' : ''}>★</i>)}</span>
const Photo = ({ l, big }) => l.photos?.[0]?.cover ? <img src={l.photos[0].cover} alt="" /> : <Still seed={l.s + (big ? 40 : 0)} mood={l.m} />

export default function Marketplace() {
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
