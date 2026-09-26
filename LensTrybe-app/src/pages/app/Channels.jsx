import { LIVE } from '../../lib/mode'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useFlows } from '../../lib/flows'
import { TODAY, nice, daysBetween } from '../../lib/store'

// Channels: the accounts LensTrybe can post to and read numbers from. Connect, see what the token
// allows, reconnect before it lapses, disconnect any time. The same screen once the real OAuth lands.
const COL = { ig: '#E1306C', fb: '#4A9EFF', tt: '#f4f2f7', li: '#0A66C2', gm: '#34A853' }
export default function Channels() { return LIVE ? <SoonLive /> : <ChannelsDemo /> }
function SoonLive() {
  return (
    <section className="view">
      <div className="vh"><div><h1>Channels</h1><p>Connecting Instagram, Facebook, TikTok and LinkedIn is on the way.</p></div><div className="acts"><Link className="btn w" to="/app/content-calendar">Content calendar</Link></div></div>
      <div className="grid"><div className="card lg s7"><div className="h"><b>Coming soon</b></div><p className="note2">Posting for you and pulling reach, likes and saves needs each platform to approve LensTrybe first. Until then, plan posts on the content calendar, post them yourself on the day, and mark them as posted.</p><div className="acts" style={{ marginTop: 12, display: 'flex', gap: 8 }}><Link className="btn g" to="/app/content-calendar">Plan a post</Link><Link className="btn g" to="/app/content-ideas">Ideas</Link></div></div></div>
    </section>)
}
function ChannelsDemo() {
  const F = useFlows(); const { s, toast } = F; const CH = s.channels
  const on = CH.filter(c => c.on), expiring = on.filter(c => c.exp && daysBetween(TODAY, c.exp) <= 14)
  const posted = c => s.posts.filter(p => p.st === 'posted' && p.ch.includes(c.id)).length
  const reach = c => s.posts.filter(p => p.st === 'posted').reduce((t, p) => t + (p.metrics?.[c.id]?.reach || 0), 0)
  return (
    <section className="view">
      <div className="vh">
        <div><h1>Channels</h1><p>Where LensTrybe posts for you and pulls the numbers from. Your password never comes here; you sign in with the platform and can revoke it any time.</p></div>
        <div className="acts"><button className="btn g" onClick={F.syncInsights}><Icon name="chart" size={15} />Pull insights now</button><Link className="btn w" to="/app/content-calendar"><Icon name="plus" size={15} />New post</Link></div>
      </div>
      <div className="grid">
        <div className="s12"><div className="kp">
          {[['Connected', on.length + ' of ' + CH.length, on.map(c => c.n).join(', '), ''], ['Followers', (on.reduce((t, c) => t + c.followers, 0)).toLocaleString(), '▲ ' + on.reduce((t, c) => t + c.grow, 0) + ' this month', ''], ['Posted, 30 days', String(s.posts.filter(p => p.st === 'posted' && p.d >= '2026-08-24').length), 'across ' + on.filter(c => posted(c)).length + ' channels', 'n'], ['Needs attention', String(expiring.length + CH.filter(c => !c.on).length), expiring.length ? expiring[0].n + ' token expires ' + nice(expiring[0].exp) : CH.some(c => !c.on) ? CH.find(c => !c.on).n + ' not connected' : 'all good', expiring.length ? 'w' : 'n']].map(([l, v, e, w]) => <div key={l} className="k lg"><small>{l}</small><b>{v}</b><em className={w}>{e}</em></div>)}
        </div></div>
        <div className="s8">
          <div className="chans">
            {CH.map(c => { const left = c.exp ? daysBetween(TODAY, c.exp) : null; const [, acct, scopes, note] = F.CHN[c.id]; return (
              <div key={c.id} className={'chan card lg' + (c.on ? ' on' : '')} style={{ '--c': COL[c.id] }}>
                <div className="chh"><i className="dot" /><div><b>{c.n}</b><small>{c.on ? c.handle + ' · ' + c.kind : acct}</small></div>
                  {c.on ? <span className={'st ' + (left != null && left <= 14 ? 'viewed' : 'ok')}>{left != null && left <= 14 ? 'Expires in ' + left + ' d' : 'Connected'}</span> : <span className="st grey">Not connected</span>}</div>
                {c.on ? <>
                  <div className="chstats"><div><b>{c.followers ? c.followers.toLocaleString() : '—'}</b><small>{c.id === 'gm' ? 'reviews read' : 'followers'}</small></div><div><b>{posted(c)}</b><small>posted</small></div><div><b>{reach(c) ? reach(c).toLocaleString() : '—'}</b><small>reach</small></div><div><b>{c.since ? nice(c.since) : '—'}</b><small>since</small></div></div>
                  <div className="scopes small">{(c.scopes || []).map(x => <span key={x}><Icon name="check" size={11} />{{ publish: 'Publish', insights: 'Insights', comments: 'Comments', reviews: 'Reviews' }[x]}</span>)}</div>
                  {c.id === 'tt' && <p className="note2 warn2">Posts land as private drafts on TikTok until LensTrybe's app is approved. You publish them from the TikTok app.</p>}
                  <div className="ctas">{left != null && left <= 14 && <button className="btn w sm" onClick={() => F.connectChannel(c.id)}>Reconnect</button>}<button className="btn g sm" onClick={() => toast('Opens ' + c.n + ' in a new tab.')}>Open {c.n}</button><button className="btn g sm" onClick={() => F.disconnectChannel(c.id)}>Disconnect</button></div>
                </> : <>
                  <div className="scopes small">{scopes.map(x => <span key={x}><Icon name="check" size={11} />{x}</span>)}</div>
                  {note && <p className="note2">{note}</p>}
                  <div className="ctas"><button className="btn w sm" onClick={() => F.connectChannel(c.id)}>Connect {c.n}</button></div>
                </>}
              </div>) })}
          </div>
        </div>
        <div className="s4 side">
          <div className="card lg"><div className="h"><b>How it works</b></div>
            <div className="steps2">
              {[['Sign in with the platform', 'Instagram, Facebook and TikTok ask you to approve LensTrybe once. Nothing is stored except a token.'], ['We post at the time you set', 'Photos, carousels and Reels go out on their own. You get a note in Today when each lands.'], ['Numbers come back nightly', 'Reach, saves, comments and follower growth pull in every night, and after every post within the hour.'], ['Lumi reads them', 'Best times, what format works, which posts brought enquiries. It shows up on the Performance page and in your Monday note.']].map(([h, p], i) => <div key={h}><i>{i + 1}</i><div><b>{h}</b><small>{p}</small></div></div>)}
            </div>
          </div>
          <div className="tlumi"><span className="lm" /><div>{expiring.length ? expiring[0].n + '\'s token expires ' + nice(expiring[0].exp) + '. Reconnect now and nothing scheduled is missed.' : CH.some(c => !c.on) ? 'Your Reels do 3× the reach of stills. ' + CH.find(c => !c.on).n + ' is the same audience and it\'s not connected yet.' : 'Everything connected and current. Nothing to do here.'}{(expiring.length || CH.some(c => !c.on)) ? <div className="acts"><button className="y" onClick={() => F.connectChannel(expiring[0]?.id || CH.find(c => !c.on).id)}>{expiring.length ? 'Reconnect' : 'Connect ' + CH.find(c => !c.on).n}</button></div> : null}</div></div>
        </div>
      </div>
    </section>
  )
}
