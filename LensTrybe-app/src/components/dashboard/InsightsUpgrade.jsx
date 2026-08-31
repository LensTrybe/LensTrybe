import { useNavigate } from 'react-router-dom'
import { FONT, TEXT, MUTED, GREEN, DANGER } from './widgetKit'

// Shown in an analytics widget's expanded view when the tier can see the KPI
// tile but not the deep breakdowns (full analytics are Expert/Elite).
export default function InsightsUpgrade({ value, sub, trend, accent = '#a855f7', feature = 'full analytics' }) {
  const navigate = useNavigate()
  const up = trend != null && trend >= 0
  return (
    <div style={{ fontFamily: FONT }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 40, fontWeight: 700, color: TEXT, letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</span>
        {trend != null ? <span style={{ fontSize: 14, fontWeight: 600, color: up ? GREEN : DANGER }}>{up ? '↑' : '↓'} {Math.abs(trend)}%</span> : null}
      </div>
      {sub ? <div style={{ fontSize: 13, color: MUTED, marginTop: 6 }}>{sub}</div> : null}

      <div style={{ marginTop: 20, background: `${accent}14`, border: `1px solid ${accent}3a`, borderRadius: 16, padding: '20px 18px', textAlign: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: TEXT }}>Unlock {feature}</div>
        <div style={{ fontSize: 13.5, color: MUTED, maxWidth: 380, margin: '8px auto 16px' }}>
          Upgrade to Expert to see trends over time, compare periods, break down by specialty and discipline, and spot your top clients and best months.
        </div>
        <button type="button" onClick={() => navigate('/dashboard/settings/subscription')} style={{ border: `1px solid ${accent}`, background: accent, color: '#0a0a0f', borderRadius: 10, padding: '10px 18px', fontSize: 13.5, fontWeight: 700, fontFamily: FONT, cursor: 'pointer' }}>Upgrade to Expert</button>
      </div>
    </div>
  )
}
