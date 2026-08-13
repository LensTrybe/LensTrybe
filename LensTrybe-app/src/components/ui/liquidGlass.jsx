import { useState, useEffect, useRef } from 'react'
import { LIQUID_GLASS, LIQUID_FIELD } from '../../lib/glassTokensLight'

const FONT = "'Inter', sans-serif"
const TEXT_PRIMARY = '#14111a'
const TEXT_MUTED = '#8a8995'
const GREEN = '#1DB954'

/* The #liquidLens SVG displacement filter. Render ONCE on any page that uses a
   LIQUID_GLASS surface — it lenses/refracts whatever sits behind the glass. */
export function LiquidLensFilter() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
      <filter id="liquidLens" x="-25%" y="-25%" width="150%" height="150%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.006 0.011" numOctaves="2" seed="7" result="turb" />
        <feGaussianBlur in="turb" stdDeviation="2.2" result="soft" />
        <feDisplacementMap in="SourceGraphic" in2="soft" scale="22" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  )
}

/* Custom dropdown — glass trigger, frosted-white readable menu. */
export function LiquidSelect({ value, onChange, options, placeholder, ariaLabel, disabled, style }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])
  const selected = options.find(o => o.value === value)
  return (
    <div ref={ref} style={{ position: 'relative', flex: '1 1 150px', minWidth: 0, ...style }}>
      <button type="button" aria-label={ariaLabel} disabled={disabled} onClick={() => !disabled && setOpen(o => !o)}
        style={{ ...LIQUID_FIELD, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', cursor: disabled ? 'not-allowed' : 'pointer', textAlign: 'left', opacity: disabled ? 0.55 : 1 }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: selected && selected.value ? TEXT_PRIMARY : TEXT_MUTED }}>{selected ? selected.label : placeholder}</span>
        <span style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease', color: TEXT_MUTED, fontSize: '10px', flexShrink: 0 }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, zIndex: 30, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(22px) saturate(140%)', WebkitBackdropFilter: 'blur(22px) saturate(140%)', border: '1px solid rgba(20,17,26,0.08)', borderRadius: '16px', boxShadow: '0 24px 54px -16px rgba(40,30,60,0.32)', padding: '6px', maxHeight: '264px', overflowY: 'auto' }}>
          {options.map(o => (
            <div key={o.value || 'all'} onClick={() => { onChange(o.value); setOpen(false) }}
              style={{ padding: '10px 12px', borderRadius: '11px', cursor: 'pointer', fontSize: '14px', fontFamily: FONT, color: o.value === value ? GREEN : TEXT_PRIMARY, fontWeight: o.value === value ? 600 : 400, background: o.value === value ? 'rgba(29,185,84,0.12)' : 'transparent', transition: 'background 0.12s ease' }}
              onMouseEnter={(e) => { if (o.value !== value) e.currentTarget.style.background = 'rgba(20,17,26,0.06)' }}
              onMouseLeave={(e) => { if (o.value !== value) e.currentTarget.style.background = 'transparent' }}>
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* Liquid-glass pill button. `primary` = green-tinted. */
export function LiquidPill({ onClick, children, primary, style, type = 'button', disabled }) {
  const [hover, setHover] = useState(false)
  return (
    <button type={type} disabled={disabled} onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        ...LIQUID_GLASS,
        borderRadius: '999px',
        padding: '15px 22px',
        fontFamily: FONT, fontWeight: 600, fontSize: '14px', color: TEXT_PRIMARY, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        flex: '1 1 0', whiteSpace: 'nowrap',
        background: primary
          ? 'linear-gradient(125deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.06) 26%, rgba(255,255,255,0) 52%), linear-gradient(135deg, rgba(29,185,84,0.34) 0%, rgba(29,185,84,0.14) 100%)'
          : LIQUID_GLASS.background,
        transform: hover ? 'translateY(-2px)' : 'none',
        transition: 'transform 0.18s ease, box-shadow 0.18s ease',
        boxShadow: hover
          ? '0 30px 64px -18px rgba(40,30,60,0.5), inset 0 1px 1px rgba(255,255,255,0.95), inset 0 -12px 28px rgba(255,255,255,0.22)'
          : LIQUID_GLASS.boxShadow,
        ...style,
      }}>{children}</button>
  )
}
