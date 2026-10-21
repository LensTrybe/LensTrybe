import { Link, useLocation, useNavigate } from 'react-router-dom'
import Icon from './Icon'

// "Back" for The Lens. If the reader got here from another page on the site, it takes them
// straight back to it. If they landed here first (from Google, Instagram, an email), there
// is no page of ours to go back to, so it becomes a link to the fallback instead.
export default function BackLink({ fallback = '/blog', label = 'The Lens' }) {
  const location = useLocation()
  const navigate = useNavigate()
  if (location.key === 'default') {
    return <Link className="backl" to={fallback}><Icon name="back" size={14} />{label}</Link>
  }
  return <button type="button" className="backl" onClick={() => navigate(-1)}><Icon name="back" size={14} />Back</button>
}
