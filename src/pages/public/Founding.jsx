import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon'
import { FoundingBand } from './Sections'

export default function Founding() {
  const nav = useNavigate(); const [code, setCode] = useState('')
  return (
    <main className="page"><div className="wrap">
      <div className="ph"><div><p className="eb p">Founding creative programme</p><h1>Expert, free for a year. <em>Then $49, for life.</em></h1></div><p>The first hundred creatives to redeem a code shape the platform and keep the price forever. A place is claimed when a code is redeemed, not when it is sent.</p></div>
      <FoundingBand />
      <div className="two" style={{ marginTop: 24, alignItems: 'start' }}>
        <div className="lg" style={{ borderRadius: 24, padding: 24 }}><h3 style={{ fontSize: 20, fontWeight: 600 }}>What is asked in return</h3>
          <p style={{ color: 'var(--ink-2)', marginTop: 10, fontSize: 15 }}>Finish your profile within seven days of joining. Run your next three jobs through the platform within six months. Send one line of feedback each month. Miss one and you get an email and fourteen days to fix it, not a cancellation. If the founding deal ends, your account stays, it just moves to the standard price.</p>
          <p style={{ color: 'var(--ink-2)', marginTop: 10, fontSize: 15 }}>Anyone redeeming after the first hundred: Expert free for six months, the same $49 a month for life, no badge.</p></div>
        <div className="lg" style={{ borderRadius: 24, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}><h3 style={{ fontSize: 20, fontWeight: 600 }}>Have a code?</h3>
          <div className="field"><label htmlFor="fc">Founding code</label><input id="fc" value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="LT-XXXX-XXXX" /></div>
          <button className="btn p" onClick={() => nav('/onboarding?code=' + (code || 'LT-DEMO-0037'))}>Redeem and start <Icon name="arrow" size={14} /></button>
          <p className="fine">No code yet? Apply below and we send codes in the order applications arrive.</p>
          <button className="btn g" onClick={() => nav('/join?founding=1')}>Apply for a code</button></div>
      </div>
    </div></main>
  )
}
