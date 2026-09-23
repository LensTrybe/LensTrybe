import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'

// A glimpse of the creative workspace, on the pricing page, so a creative can see what the plan buys.
// Static glass mock of the Today screen: the morning brief and the overnight approvals.
export default function WorkspacePeek() {
  return (
    <Link className="peek lg d" to="/app" aria-label="Open the workspace preview">
      <div className="pk-top"><span className="dots"><i /><i /><i /></span><span className="url">app.lenstrybe.com/today</span><span className="live"><i />Live preview</span></div>
      <div className="pk-body">
        <div className="pk-main">
          <div className="pk-brief"><div className="h"><span>Monday, 7:02 am</span><i className="lm" /></div><p>Morning, Mara. <b>One shoot today at 10</b> for Coastline Realty. <b>Blackwood paid overnight</b>, so nothing is overdue. <b>23 Nov to 6 Dec is empty</b>. I have an offer ready if you want it.</p></div>
          <div className="pk-acts">
            <div className="h">Overnight, waiting for your yes <em>3 pending</em></div>
            {[['23:40', 'Held 14 Nov for Harper and Leo', 'Keep'], ['01:15', 'Drafted quote #Q-0418 for Coastline, $1,026', 'Send'], ['06:50', 'Found a gap: 23 Nov to 6 Dec. Offer drafted.', 'Post it']].map(([t, b, a]) => <div key={t} className="act"><span className="t">{t}</span><span className="b">{b}</span><span className="do">{a}</span></div>)}
          </div>
        </div>
      </div>
      <div className="pk-cta"><span><b>This is the workspace.</b> Lumi runs the admin, you approve in a tap. Every plan above Basic includes it.</span><span className="btn w sm">Open the workspace preview <Icon name="arrow" size={13} /></span></div>
    </Link>
  )
}
