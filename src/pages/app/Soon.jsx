import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { ALL, ABOUT } from './nav'

// A page that exists on the live site and is next in this build. Same name, same place in the rail.
export default function Soon({ id }) {
  const it = ALL.find(x => x[0] === id) || [id, id, 'grid']
  return (
    <section className="view">
      <div className="vh"><div><h1>{it[1]}</h1><p>{ABOUT[id] || 'Coming across from the live workspace.'}</p></div></div>
      <div className="card lg soon">
        <span className="ic"><Icon name={it[2]} size={22} /></span>
        <b>Next in the build</b>
        <p>{it[1]} is live on lenstrybe.com today and comes across to this design next, with the same data. Nothing is lost in the move.</p>
        <div className="ctas"><Link className="btn w" to="/app">Back to Today <Icon name="arrow" size={14} /></Link></div>
      </div>
    </section>
  )
}
