import { useEffect, useMemo, useRef, useState } from 'react'

export default function CinematicEntrance({ onComplete }) {
  const containerRef = useRef(null)
  const timeoutsRef = useRef([])
  const completedRef = useRef(false)
  const [shouldRender, setShouldRender] = useState(true)
  const [entered, setEntered] = useState(false)
  const [fadingOut, setFadingOut] = useState(false)
  const [shimmerRun, setShimmerRun] = useState(false)
  const [scanRun, setScanRun] = useState(false)

  const particles = useMemo(
    () =>
      Array.from({ length: 28 }, (_, idx) => ({
        id: idx,
        size: Math.floor(Math.random() * 4) + 1,
        top: Math.random() * 100,
        left: Math.random() * 100,
        color: Math.random() > 0.5 ? 'rgba(29,185,84,0.3)' : 'rgba(255,255,255,0.15)',
        delay: 800 + Math.floor(Math.random() * 1200),
      })),
    [],
  )

  const schedule = (fn, ms) => {
    const id = window.setTimeout(fn, ms)
    timeoutsRef.current.push(id)
    return id
  }

  const clearAllTimeouts = () => {
    for (const id of timeoutsRef.current) window.clearTimeout(id)
    timeoutsRef.current = []
  }

  const finish = (delayMs) => {
    if (completedRef.current) return
    completedRef.current = true
    setFadingOut(true)
    schedule(() => {
      try {
        sessionStorage.setItem('lt_entrance_played', '1')
      } catch {
        // Ignore storage errors.
      }
      onComplete?.()
      setShouldRender(false)
    }, delayMs)
  }

  useEffect(() => {
    const host = containerRef.current
    if (!host) return undefined

    const styleEl = document.createElement('style')
    styleEl.textContent =
      '@keyframes lt-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.7)} }'
    host.appendChild(styleEl)

    return () => {
      if (styleEl.parentNode === host) host.removeChild(styleEl)
    }
  }, [])

  useEffect(() => {
    try {
      if (sessionStorage.getItem('lt_entrance_played')) {
        onComplete?.()
        setShouldRender(false)
        return undefined
      }
    } catch {
      // No-op.
    }

    schedule(() => setEntered(true), 20)
    schedule(() => setShimmerRun(true), 1200)
    schedule(() => setScanRun(true), 1200)
    schedule(() => setFadingOut(true), 5800)
    schedule(() => finish(0), 6400)

    return () => {
      clearAllTimeouts()
    }
  }, [onComplete])

  useEffect(
    () => () => {
      clearAllTimeouts()
    },
    [],
  )

  if (!shouldRender) return null

  const baseStagger = (delay, y = 24) => ({
    opacity: entered ? 1 : 0,
    transform: entered ? 'translateY(0)' : `translateY(${y}px)`,
    transition: `opacity 0.9s ease ${delay}ms, transform 1.2s cubic-bezier(0.19, 1, 0.22, 1) ${delay}ms`,
  })

  const chips = [
    { text: 'Photography', top: '12%', left: '2%', delay: 1800, startX: -20 },
    { text: 'Videography', top: '28%', right: '2%', delay: 2000, startX: 20 },
    { text: 'Drone Pilots', top: '48%', left: '1%', delay: 2200, startX: -20 },
    { text: 'UGC Creators', top: '64%', right: '2%', delay: 2400, startX: 20 },
    { text: 'Video Editing', bottom: '16%', left: '2%', delay: 2600, startX: -20 },
  ]

  return (
    <div
      ref={containerRef}
      onClick={() => finish(400)}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#030308',
        fontFamily: 'Inter, sans-serif',
        cursor: 'pointer',
        opacity: fadingOut ? 0 : 1,
        transition: 'opacity 0.6s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          position: 'absolute',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(29,185,84,0.22) 0%, transparent 65%)',
          top: -100,
          left: -100,
          filter: 'blur(80px)',
          willChange: 'transform',
          opacity: entered ? 1 : 0,
          transition: 'opacity 2s ease',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,45,120,0.14) 0%, transparent 65%)',
          bottom: -80,
          right: -60,
          filter: 'blur(70px)',
          willChange: 'transform',
          opacity: entered ? 1 : 0,
          transition: 'opacity 2s ease',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 350,
          height: 350,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(29,185,84,0.1) 0%, transparent 65%)',
          top: '50%',
          left: '55%',
          filter: 'blur(90px)',
          willChange: 'transform',
          opacity: entered ? 1 : 0,
          transition: 'opacity 2s ease',
        }}
      />

      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: entered ? 1 : 0,
          transition: 'opacity 2s ease 300ms',
        }}
      >
        <line x1="20%" y1="0%" x2="20%" y2="100%" stroke="rgba(255,255,255,0.025)" strokeWidth="0.5" />
        <line x1="40%" y1="0%" x2="40%" y2="100%" stroke="rgba(255,255,255,0.025)" strokeWidth="0.5" />
        <line x1="60%" y1="0%" x2="60%" y2="100%" stroke="rgba(255,255,255,0.025)" strokeWidth="0.5" />
        <line x1="80%" y1="0%" x2="80%" y2="100%" stroke="rgba(255,255,255,0.025)" strokeWidth="0.5" />
        <line x1="0%" y1="25%" x2="100%" y2="25%" stroke="rgba(255,255,255,0.025)" strokeWidth="0.5" />
        <line x1="0%" y1="50%" x2="100%" y2="50%" stroke="rgba(255,255,255,0.025)" strokeWidth="0.5" />
        <line x1="0%" y1="75%" x2="100%" y2="75%" stroke="rgba(255,255,255,0.025)" strokeWidth="0.5" />
      </svg>

      {[
        { top: 18, left: 18, bt: true, bl: true, tx: -6, ty: -6 },
        { top: 18, right: 18, bt: true, br: true, tx: 6, ty: -6 },
        { bottom: 18, left: 18, bb: true, bl: true, tx: -6, ty: 6 },
        { bottom: 18, right: 18, bb: true, br: true, tx: 6, ty: 6 },
      ].map((c, idx) => (
        <div
          key={idx}
          style={{
            position: 'absolute',
            width: 20,
            height: 20,
            top: c.top,
            right: c.right,
            bottom: c.bottom,
            left: c.left,
            borderTop: c.bt ? '1.5px solid rgba(29,185,84,0.5)' : 'none',
            borderRight: c.br ? '1.5px solid rgba(29,185,84,0.5)' : 'none',
            borderBottom: c.bb ? '1.5px solid rgba(29,185,84,0.5)' : 'none',
            borderLeft: c.bl ? '1.5px solid rgba(29,185,84,0.5)' : 'none',
            transform: entered ? 'translate(0, 0)' : `translate(${c.tx}px, ${c.ty}px)`,
            transition: 'transform 0.6s cubic-bezier(0.19, 1, 0.22, 1) 400ms',
          }}
        />
      ))}

      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            top: `${p.top}%`,
            left: `${p.left}%`,
            background: p.color,
            opacity: entered ? 1 : 0,
            transition: `opacity 1.2s ease ${p.delay}ms`,
          }}
        />
      ))}

      <div
        style={{
          width: 440,
          maxWidth: 'calc(100vw - 40px)',
          background:
            'linear-gradient(135deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.02) 100%)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderTop: '1px solid rgba(255,255,255,0.22)',
          borderRadius: 32,
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          padding: '48px 52px 44px',
          boxShadow:
            '0 40px 120px rgba(0,0,0,0.6), inset 0 0 0 0.5px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.15)',
          position: 'relative',
          overflow: 'hidden',
          transform: entered ? 'translateY(0) scale(1)' : 'translateY(80px) scale(0.88)',
          opacity: entered ? 1 : 0,
          transition: 'transform 1.4s cubic-bezier(0.19, 1, 0.22, 1) 600ms, opacity 1.4s ease 600ms',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: shimmerRun ? '200%' : '-100%',
            width: '100%',
            height: 1,
            background:
              'linear-gradient(90deg, transparent, rgba(29,185,84,0.8), rgba(255,255,255,0.6), rgba(29,185,84,0.8), transparent)',
            transition: shimmerRun ? 'left 1s ease' : 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: 1,
            top: scanRun ? '100%' : -1,
            background:
              'linear-gradient(90deg, transparent 0%, rgba(29,185,84,0.6) 30%, rgba(255,255,255,0.4) 50%, rgba(29,185,84,0.6) 70%, transparent 100%)',
            transition: scanRun ? 'top 1.1s ease' : 'none',
          }}
        />

        <div style={{ ...baseStagger(1300), display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              border: '1.5px solid rgba(29,185,84,0.4)',
              background: 'rgba(29,185,84,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <div style={{ width: 12, height: 12, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.3)' }} />
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#1DB954', position: 'absolute' }} />
          </div>
          <div
            style={{
              fontSize: 9,
              letterSpacing: '0.22em',
              color: 'rgba(255,255,255,0.2)',
              textTransform: 'uppercase',
            }}
          >
            Australia&apos;s Creative Platform
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: '#1DB954',
                animation: 'lt-pulse 2s infinite',
              }}
            />
            <div style={{ fontSize: 9, color: 'rgba(29,185,84,0.6)' }}>Live</div>
          </div>
        </div>

        <div style={{ ...baseStagger(1400, 40), marginTop: 26, fontSize: 46, fontWeight: 800, letterSpacing: '-0.02em', color: '#fff', lineHeight: 1 }}>
          Lens<span style={{ color: '#1DB954' }}>Trybe</span>
        </div>

        <div
          style={{
            ...baseStagger(1650, 20),
            marginTop: 12,
            fontSize: 10,
            letterSpacing: '0.26em',
            color: 'rgba(255,255,255,0.22)',
            textTransform: 'uppercase',
          }}
        >
          Connect · Capture · Create
        </div>

        <div
          style={{
            margin: '26px 0',
            height: 1,
            background: 'linear-gradient(90deg, rgba(29,185,84,0.4), rgba(255,255,255,0.08), transparent)',
            width: entered ? '100%' : 0,
            transition: 'width 1s ease 1800ms',
          }}
        />

        <div style={{ ...baseStagger(2000), display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
          {[
            { valueStart: '0', valueAccent: '%', label: 'Commission' },
            { valueStart: '8', valueAccent: '', label: 'Creative types' },
            { valueStart: 'A', valueAccent: 'U', label: 'Platform' },
          ].map((item, idx) => (
            <div
              key={item.label}
              style={{
                textAlign: 'center',
                borderLeft: idx > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                paddingLeft: idx > 0 ? 14 : 0,
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 20, color: '#fff' }}>
                {item.valueStart}
                <span style={{ color: '#1DB954' }}>{item.valueAccent}</span>
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 8,
                  color: 'rgba(255,255,255,0.2)',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                }}
              >
                {item.label}
              </div>
            </div>
          ))}
        </div>

        <div style={{ ...baseStagger(2100), display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
          {[
            { text: 'Now live', active: true },
            { text: 'Australia-wide' },
            { text: 'Built for creatives' },
          ].map((pill) => (
            <div
              key={pill.text}
              style={{
                padding: '5px 12px',
                borderRadius: 20,
                fontSize: 9,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                border: pill.active
                  ? '1px solid rgba(29,185,84,0.3)'
                  : '1px solid rgba(255,255,255,0.07)',
                background: pill.active ? 'rgba(29,185,84,0.07)' : 'transparent',
                color: pill.active ? 'rgba(29,185,84,0.8)' : 'rgba(255,255,255,0.28)',
              }}
            >
              {pill.text}
            </div>
          ))}
        </div>

        <div style={{ ...baseStagger(2250), marginTop: 22 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 12,
              background: 'rgba(29,185,84,0.1)',
              border: '1px solid rgba(29,185,84,0.2)',
              borderRadius: 14,
              padding: '13px 22px',
              color: '#fff',
              fontSize: 13,
              letterSpacing: '0.02em',
            }}
          >
            Join as a creative
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'rgba(29,185,84,0.2)',
                border: '1px solid rgba(29,185,84,0.3)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#1DB954',
              }}
            >
              →
            </span>
          </div>
        </div>
      </div>

      {chips.map((chip) => (
        <div
          key={chip.text}
          style={{
            position: 'absolute',
            top: chip.top,
            right: chip.right,
            bottom: chip.bottom,
            left: chip.left,
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 10,
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            padding: '7px 13px',
            fontSize: 9,
            color: 'rgba(255,255,255,0.2)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            opacity: entered ? 1 : 0,
            transform: entered ? 'translateX(0)' : `translateX(${chip.startX}px)`,
            transition: `opacity 0.9s ease ${chip.delay}ms, transform 1s cubic-bezier(0.19, 1, 0.22, 1) ${chip.delay}ms`,
            pointerEvents: 'none',
          }}
        >
          {chip.text}
        </div>
      ))}
    </div>
  )
}
