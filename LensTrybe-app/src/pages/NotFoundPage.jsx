import { Link } from 'react-router-dom'
import './NotFoundPage.css'

function NotFoundPage() {
  return (
    <section className="not-found-page">
      <h1 className="not-found-page__title">Page not found</h1>
      <p className="not-found-page__text">The page you requested does not exist.</p>
      <Link className="not-found-page__link" to="/dashboard">
        Return to dashboard
      </Link>
    </section>
  )
}

export default NotFoundPage
