import useSupabase from '../hooks/useSupabase'

const metricCards = [
  { title: 'Active Users', value: '2,430', trend: '+5.1%' },
  { title: 'Sessions', value: '9,102', trend: '+2.3%' },
  { title: 'Conversion', value: '18.7%', trend: '+1.2%' },
]

function DashboardPage() {
  const supabase = useSupabase()
  const isSupabaseConfigured = Boolean(supabase)

  return (
    <section>
      <header className="page-header">
        <h2>Dashboard Overview</h2>
        <p>Track the key product metrics at a glance.</p>
      </header>

      <div className="card-grid">
        {metricCards.map((card) => (
          <article className="metric-card" key={card.title}>
            <p className="metric-title">{card.title}</p>
            <p className="metric-value">{card.value}</p>
            <p className="metric-trend">{card.trend} this week</p>
          </article>
        ))}
      </div>

      <article className="panel">
        <h3>Supabase Connection</h3>
        {isSupabaseConfigured ? (
          <p>Supabase client is initialized and ready to use.</p>
        ) : (
          <p>
            Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>{' '}
            in your environment to connect your project.
          </p>
        )}
      </article>
    </section>
  )
}

export default DashboardPage
