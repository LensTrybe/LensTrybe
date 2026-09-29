import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { mountLens } from '../../lib/lens'

// Where an old "Add to calendar" link lands once the booking behind it has been moved or
// cancelled (calendar-feed sends people here). Same dark lens pane as Check your inbox.
export default function BookingGone() {
  const cv = useRef(null)
  useEffect(() => { const l = mountLens(cv.current); l.layout({ cy: .5, r: .34 }); return () => l.destroy() }, [])
  return (
    <section className="hiw login dark darkhero">
      <canvas className="gl" ref={cv} aria-hidden="true" />
      <div className="lpane lg d">
        <p className="eb">Add to calendar</p>
        <h1>That booking has <em>moved.</em></h1>
        <p className="hint">The date behind this link was changed or cancelled, so there is nothing to add. The newest email from your creative has the current details and a fresh link.</p>
        <p className="lfoot">Questions about the booking? Get in touch with your creative. <Link to="/">Go to LensTrybe</Link>.</p>
      </div>
    </section>
  )
}
