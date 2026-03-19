import { Link } from 'react-router-dom'

function NotFoundPage() {
  return (
    <section className="not-found">
      <h2>Page not found</h2>
      <p>The page you requested does not exist.</p>
      <Link className="button-link" to="/dashboard">
        Return to dashboard
      </Link>
    </section>
  )
}

export default NotFoundPage
