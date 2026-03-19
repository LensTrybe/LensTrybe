const analyticsData = [
  { channel: 'Organic Search', sessions: '4,210' },
  { channel: 'Paid Ads', sessions: '2,783' },
  { channel: 'Email', sessions: '1,129' },
]

function AnalyticsPage() {
  return (
    <section>
      <header className="page-header">
        <h2>Analytics</h2>
        <p>Monitor traffic channels and growth trends.</p>
      </header>

      <article className="panel">
        <h3>Top Acquisition Channels</h3>
        <ul className="data-list">
          {analyticsData.map((item) => (
            <li key={item.channel}>
              <span>{item.channel}</span>
              <strong>{item.sessions}</strong>
            </li>
          ))}
        </ul>
      </article>
    </section>
  )
}

export default AnalyticsPage
