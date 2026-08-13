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

const TILE_GAP = 10
const TILE_SINGLE_H = 210
const TILE_PAIR_H = 100
const TILE_PATTERN = ['s', 'p', 's', 'p', 'p', 's']
const TILE_REPEATS = 10
const TILE_LOOP = TILE_PATTERN.reduce((sum, c) => sum + (c === 's' ? TILE_SINGLE_H : TILE_PAIR_H) + TILE_GAP, 0)

function MosaicColumn({ index, animated }) {
  const dir = index % 2 === 0 ? 'up' : 'down'
  const dur = 44 + (index % 5) * 7
  const rot = index % TILE_PATTERN.length
  const rotated = [...TILE_PATTERN.slice(rot), ...TILE_PATTERN.slice(0, rot)]
  const cells = Array.from({ length: TILE_REPEATS }).flatMap(() => rotated)
  let g = index * 2
  return (
    <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexDirection: 'column', willChange: animated ? 'transform' : 'auto', animation: animated ? `${dir === 'up' ? 'ltHeroUp' : 'ltHeroDown'} ${dur}s linear infinite` : 'none' }}>
        {cells.map((c, i) => {
          if (c === 's') {
            const bg = TILE_GRADS[g++ % TILE_GRADS.length]
            return <div key={i} style={{ height: `${TILE_SINGLE_H}px`, marginBottom: `${TILE_GAP}px`, borderRadius: '12px', background: bg }} />
          }
          const a = TILE_GRADS[g++ % TILE_GRADS.length]
          const b = TILE_GRADS[g++ % TILE_GRADS.length]
          return (
            <div key={i} style={{ display: 'flex', gap: `${TILE_GAP}px`, marginBottom: `${TILE_GAP}px` }}>
              <div style={{ flex: 1, height: `${TILE_PAIR_H}px`, borderRadius: '12px', background: a }} />
              <div style={{ flex: 1, height: `${TILE_PAIR_H}px`, borderRadius: '12px', background: b }} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function TileField({ animated = true, opacity = 1 }) {
  const [colCount, setColCount] = useState(() => (typeof window !== 'undefined' ? Math.max(6, Math.ceil(window.innerWidth / 240)) : 8))
  useEffect(() => {
    function onResize() { setColCount(Math.max(6, Math.ceil(window.innerWidth / 240))) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return (
    <>
      <div aria-hidden style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: `repeat(${colCount}, 1fr)`, gap: `${TILE_GAP}px`, padding: `${TILE_GAP}px`, zIndex: 0, opacity }}>
        {Array.from({ length: colCount }).map((_, i) => <MosaicColumn key={i} index={i} animated={animated} />)}
      </div>
      <style>{`
        @keyframes ltHeroUp { from { transform: translateY(0); } to { transform: translateY(-${TILE_LOOP}px); } }
        @keyframes ltHeroDown { from { transform: translateY(-${TILE_LOOP}px); } to { transform: translateY(0); } }
      `}</style>
    </>
  )
}
