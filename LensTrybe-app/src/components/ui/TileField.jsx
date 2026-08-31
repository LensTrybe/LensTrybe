import { useState, useEffect } from 'react'

/* Full-bleed drifting pastel mosaic — the same field used on the hero.
   Drop it as an absolute background inside a position:relative; overflow:hidden
   container, then put page content above it (zIndex >= 2). */

const TILE_GRADS = [
  'linear-gradient(135deg,#a9c8f0,#7fa8e8)',
  'linear-gradient(135deg,#f3bcd6,#e894bd)',
  'linear-gradient(135deg,#cdbcf3,#a98be8)',
  'linear-gradient(135deg,#aee6cb,#7fd0aa)',
  'linear-gradient(135deg,#f6ccb0,#efab82)',
]

const TILE_GRADS_DARK = [
  'linear-gradient(135deg,#2c3a5e,#1c2742)',
  'linear-gradient(135deg,#3d2450,#26163a)',
  'linear-gradient(135deg,#1c452f,#123020)',
  'linear-gradient(135deg,#472657,#2c1838)',
  'linear-gradient(135deg,#283047,#1a2033)',
]

const TILE_GAP = 10
const TILE_SINGLE_H = 210
const TILE_PAIR_H = 100
const TILE_PATTERN = ['s', 'p', 's', 'p', 'p', 's']
const TILE_REPEATS = 10
const TILE_LOOP = TILE_PATTERN.reduce((sum, c) => sum + (c === 's' ? TILE_SINGLE_H : TILE_PAIR_H) + TILE_GAP, 0)

function MosaicColumn({ index, animated, twinkle, grads }) {
  const dir = index % 2 === 0 ? 'up' : 'down'
  const dur = 44 + (index % 5) * 7
  const rot = index % TILE_PATTERN.length
  const rotated = [...TILE_PATTERN.slice(rot), ...TILE_PATTERN.slice(0, rot)]
  const reps = twinkle ? 2 : TILE_REPEATS
  const cells = Array.from({ length: reps }).flatMap(() => rotated)
  let g = index * 2
  let t = index * 3
  const twk = () => {
    const n = t++
    return twinkle
      ? { animation: `ltTwinkle ${(2.6 + (n % 6) * 0.5).toFixed(2)}s ease-in-out ${((n * 0.47) % 4).toFixed(2)}s infinite`, willChange: 'opacity' }
      : null
  }
  return (
    <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexDirection: 'column', willChange: animated && !twinkle ? 'transform' : 'auto', animation: animated && !twinkle ? `${dir === 'up' ? 'ltHeroUp' : 'ltHeroDown'} ${dur}s linear infinite` : 'none' }}>
        {cells.map((c, i) => {
          if (c === 's') {
            const bg = grads[g++ % grads.length]
            return <div key={i} style={{ height: `${TILE_SINGLE_H}px`, marginBottom: `${TILE_GAP}px`, borderRadius: '12px', background: bg, ...twk() }} />
          }
          const a = grads[g++ % grads.length]
          const b = grads[g++ % grads.length]
          return (
            <div key={i} style={{ display: 'flex', gap: `${TILE_GAP}px`, marginBottom: `${TILE_GAP}px` }}>
              <div style={{ flex: 1, height: `${TILE_PAIR_H}px`, borderRadius: '12px', background: a, ...twk() }} />
              <div style={{ flex: 1, height: `${TILE_PAIR_H}px`, borderRadius: '12px', background: b, ...twk() }} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function TileField({ animated = true, opacity = 1, twinkle = false, dark = false }) {
  const grads = dark ? TILE_GRADS_DARK : TILE_GRADS
  const [colCount, setColCount] = useState(() => (typeof window !== 'undefined' ? Math.max(6, Math.ceil(window.innerWidth / 240)) : 8))
  useEffect(() => {
    function onResize() { setColCount(Math.max(6, Math.ceil(window.innerWidth / 240))) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return (
    <>
      <div aria-hidden style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: `repeat(${colCount}, 1fr)`, gap: `${TILE_GAP}px`, padding: `${TILE_GAP}px`, zIndex: 0, opacity }}>
        {Array.from({ length: colCount }).map((_, i) => <MosaicColumn key={i} index={i} animated={animated} twinkle={twinkle} grads={grads} />)}
      </div>
      <style>{`
        @keyframes ltHeroUp { from { transform: translateY(0); } to { transform: translateY(-${TILE_LOOP}px); } }
        @keyframes ltHeroDown { from { transform: translateY(-${TILE_LOOP}px); } to { transform: translateY(0); } }
        @keyframes ltTwinkle {
          0%, 30% { opacity: 0.2; filter: saturate(0.55) brightness(1.1); }
          50% { opacity: 1; filter: saturate(1.75) brightness(0.9); }
          70%, 100% { opacity: 0.2; filter: saturate(0.55) brightness(1.1); }
        }
      `}</style>
    </>
  )
}
