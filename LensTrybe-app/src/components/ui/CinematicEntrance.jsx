import { useEffect, useRef, useState } from 'react'

const TILE_GRADS = [
  'linear-gradient(135deg,#3a4a5c,#6b8299)',
  'linear-gradient(135deg,#c9a48a,#8a6f5e)',
  'linear-gradient(135deg,#7a8b6f,#4d5f4a)',
  'linear-gradient(135deg,#d4a5b5,#a76d84)',
  'linear-gradient(135deg,#b0a89c,#847c70)',
]

const TILE_COLUMNS = [
  { dir: 'up', dur: 30, start: 0 },
  { dir: 'down', dur: 26, start: 3 },
  { dir: 'up', dur: 34, start: 1 },
  { dir: 'down', dur: 30, start: 4 },
  { dir: 'up', dur: 28, start: 2 },
]

export default function CinematicEntrance({ onComplete }) {
  const containerRef = useRef(null)
  const timeoutsRef = useRef([])
  const completedRef = useRef(false)
  const [shouldRender, setShouldRender] = useState(true)
  const [entered, setEntered] = useState(false)
  const [fadingOut, setFadingOut] = useState(false)
  const [shimmerRun, setShimmerRun] = useState(false)
  const [scanRun, setScanRun] = useState(false)

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
      '@keyframes lt-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.7)} }' +
      '@keyframes ltIntroUp { from{transform:translateY(0)} to{transform:translateY(-1008px)} }' +
      '@keyframes ltIntroDown { from{transform:translateY(-1008px)} to{transform:translateY(0)} }' +
      '@keyframes ltFloatA { 0%,100%{transform:translate(0,0)} 33%{transform:translate(9px,-13px)} 66%{transform:translate(-7px,-7px)} }' +
      '@keyframes ltFloatB { 0%,100%{transform:translate(0,0)} 33%{transform:translate(-10px,-9px)} 66%{transform:translate(8px,-15px)} }'
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
    { text: 'Photography', top: '9%', left: '3%', delay: 1800, startX: -20, float: 'A', dur: 9, dot: '#1DB954' },
    { text: 'Videography', top: '20%', right: '4%', delay: 2000, startX: 20, float: 'B', dur: 10.5, dot: '#D4537E' },
    { text: 'Drone Pilots', top: '46%', left: '2%', delay: 2200, startX: -20, float: 'A', dur: 11, dot: '#378ADD' },
    { text: 'UGC Creators', top: '40%', right: '3%', delay: 2400, startX: 20, float: 'B', dur: 8.5, dot: '#BA7517' },
    { text: 'Video Editing', bottom: '12%', left: '4%', delay: 2600, startX: -20, float: 'A', dur: 9.5, dot: '#7F77DD' },
    { text: 'Photo Editing', bottom: '9%', right: '5%', delay: 2500, startX: 20, float: 'B', dur: 10, dot: '#1D9E75' },
    { text: 'Social Media', top: '70%', left: '9%', delay: 2700, startX: -20, float: 'B', dur: 8, dot: '#D4537E' },
  ]

  return (
    <div
      ref={containerRef}
      onClick={() => finish(400)}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#f6f5f3',
        fontFamily: 'Inter, sans-serif',
        cursor: 'pointer',
        opacity: fadingOut ? 0 : 1,
        transition: 'opacity 0.6s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto',
        overflow: 'hidden',
      }}
    >
      {/* Moving pastel tiles — same as the hero */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 8,
          padding: 8,
          zIndex: 0,
          opacity: entered ? 1 : 0,
          transition: 'opacity 1.4s ease',
        }}
      >
        {TILE_COLUMNS.map((col, ci) => {
          const seq = Array.from({ length: 6 }, (_, i) => TILE_GRADS[(col.start + i) % TILE_GRADS.length])
          const tiles = [...seq, ...seq]
          return (
            <div key={ci} style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  willChange: 'transform',
                  animation: `${col.dir === 'up' ? 'ltIntroUp' : 'ltIntroDown'} ${col.dur}s linear infinite`,
                }}
              >
                {tiles.map((bg, i) => (
                  <div key={i} style={{ height: 160, marginBottom: 8, borderRadius: 10, background: bg }} />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Soft clearing so the card reads clearly */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          background:
            'radial-gradient(ellipse 44% 58% at 50% 50%, rgba(246,245,243,0.95), rgba(246,245,243,0.72) 58%, rgba(246,245,243,0.42))',
          opacity: entered ? 1 : 0.7,
          transition: 'opacity 1.5s ease',
        }}
      />

      {/* Corner brackets */}
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
            zIndex: 2,
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

      <div
        style={{
          zIndex: 2,
          width: 440,
          maxWidth: 'calc(100vw - 40px)',
          background:
            'linear-gradient(160deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.68) 100%)',
          border: '1px solid rgba(20,17,26,0.07)',
          borderTop: '1px solid rgba(255,255,255,0.9)',
          borderRadius: 32,
          backdropFilter: 'blur(30px) saturate(150%)',
          WebkitBackdropFilter: 'blur(30px) saturate(150%)',
          padding: '48px 52px 44px',
          boxShadow:
            '0 40px 100px -30px rgba(40,30,60,0.38), inset 0 1px 0 rgba(255,255,255,0.9)',
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
              'linear-gradient(90deg, transparent 0%, rgba(29,185,84,0.5) 30%, rgba(255,255,255,0.5) 50%, rgba(29,185,84,0.5) 70%, transparent 100%)',
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
              background: 'rgba(29,185,84,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <div style={{ width: 12, height: 12, borderRadius: '50%', border: '1px solid rgba(20,17,26,0.25)' }} />
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#1DB954', position: 'absolute' }} />
          </div>
          <div
            style={{
              fontSize: 9,
              letterSpacing: '0.22em',
              color: 'rgba(20,17,26,0.4)',
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
            <div style={{ fontSize: 9, color: '#0f7a37' }}>Live</div>
          </div>
        </div>

        <div style={{ ...baseStagger(1400, 40), marginTop: 26, fontSize: 46, fontWeight: 800, letterSpacing: '-0.02em', color: '#14111a', lineHeight: 1 }}>
          Lens<span style={{ color: '#1DB954' }}>Trybe</span>
        </div>

        <div
          style={{
            ...baseStagger(1650, 20),
            marginTop: 12,
            fontSize: 10,
            letterSpacing: '0.26em',
            color: 'rgba(20,17,26,0.4)',
            textTransform: 'uppercase',
          }}
        >
          Connect · Capture · Create
        </div>

        <div
          style={{
            margin: '26px 0',
            height: 1,
            background: 'linear-gradient(90deg, rgba(29,185,84,0.4), rgba(20,17,26,0.1), transparent)',
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
                borderLeft: idx > 0 ? '1px solid rgba(20,17,26,0.08)' : 'none',
                paddingLeft: idx > 0 ? 14 : 0,
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 20, color: '#14111a' }}>
                {item.valueStart}
                <span style={{ color: '#1DB954' }}>{item.valueAccent}</span>
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 8,
                  color: 'rgba(20,17,26,0.4)',
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
                  : '1px solid rgba(20,17,26,0.12)',
                background: pill.active ? 'rgba(29,185,84,0.08)' : 'transparent',
                color: pill.active ? '#0f7a37' : 'rgba(20,17,26,0.5)',
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
              background: '#14111a',
              border: 'none',
              borderRadius: 14,
              padding: '13px 22px',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: '0.02em',
              boxShadow: '0 8px 20px -8px rgba(20,17,26,0.4)',
            }}
          >
            Join as a creative
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'rgba(29,185,84,0.9)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
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
            zIndex: 2,
            top: chip.top,
            right: chip.right,
            bottom: chip.bottom,
            left: chip.left,
            opacity: entered ? 1 : 0,
            transform: entered ? 'translateX(0)' : `translateX(${chip.startX}px)`,
            transition: `opacity 0.9s ease ${chip.delay}ms, transform 1s cubic-bezier(0.19, 1, 0.22, 1) ${chip.delay}ms`,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              background: 'rgba(255,255,255,0.85)',
              border: '1px solid rgba(20,17,26,0.08)',
              borderTop: '1px solid rgba(255,255,255,0.9)',
              borderRadius: 999,
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              padding: '10px 18px',
              boxShadow: '0 14px 30px -12px rgba(40,30,60,0.32), inset 0 1px 0 rgba(255,255,255,0.9)',
              animation: `ltFloat${chip.float} ${chip.dur}s ease-in-out ${chip.delay + 1000}ms infinite`,
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: chip.dot, flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#14111a' }}>{chip.text}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
