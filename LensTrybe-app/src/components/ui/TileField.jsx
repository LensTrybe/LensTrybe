import { useState, useEffect, useRef } from 'react'

/* Full-bleed drifting pastel mosaic: the same field used on the hero.
   Drop it as an absolute background inside a position:relative; overflow:hidden
   container, then put page content above it (zIndex >= 2).

   NOTE: HomePage.jsx carries its own copy of this mosaic (MosaicColumn +
   DriftingTiles). The two have drifted apart, so a change here needs the same
   change there. Worth merging after launch, not before. */

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

// How many times the pattern repeats down a column, which decides how tall the
// animated layer is.
//
// This was 10, giving a 9,900px column. Eight of those is about 19 megapixels of
// compositing surface that Safari has to hold and repaint continuously, and when it
// runs past its layer budget it drops bands and re-rasterises them, which shows up as
// random horizontal rows flashing.
//
// Four is all that is needed. The pattern loops seamlessly every TILE_LOOP and the
// animation only ever travels TILE_LOOP, so a column just has to be taller than its
// container plus one loop. The animated field lives in a position:fixed wrapper, so its
// container is never taller than the viewport: 4 repeats is 3,960px against a worst case
// of roughly 1,600px of viewport plus 990px of loop. No visual change, 60% less layer.
const TILE_REPEATS = 4
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
  const moving = animated && !twinkle
  return (
    // The clipper is promoted to its own layer as well. Safari clipping a MOVING
    // composited child against a NON-composited ancestor is what makes bands of the
    // column flash: it re-rasterises the clip as the layer travels, and a band that is
    // not painted in time shows blank for a frame. translateZ(0) promotes it and
    // contain:paint tells the engine nothing escapes this box, so the clip is cheap.
    <div style={{ position: 'relative', height: '100%', overflow: 'hidden', ...(moving ? { willChange: 'transform', transform: 'translateZ(0)', contain: 'paint' } : null) }}>
      <div
        className={moving ? 'lt-tile-drift' : undefined}
        style={{
          display: 'flex',
          flexDirection: 'column',
          willChange: moving ? 'transform' : 'auto',
          // Classic Safari flicker mitigation on an animated composited layer.
          backfaceVisibility: 'hidden',
          animation: moving ? `${dir === 'up' ? 'ltHeroUp' : 'ltHeroDown'} ${dur}s linear infinite` : 'none',
        }}
      >
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

/**
 * How long the field drifts before it freezes where it stands.
 *
 * Perpetual motion behind glass is not affordable. Anything moving underneath a
 * backdrop-filter forces every glass element on the page to re-blur its backdrop on
 * every frame, and measurement on the homepage put that at 27fps with 102 of 106 frames
 * arriving late. It is not a question of how much is moving: cutting six drifting
 * columns to one moved it from 27fps to 29. Cutting to none gave a clean 60. One moving
 * pixel costs the same as the whole mosaic.
 *
 * Chromium absorbs a blown frame budget as slight jerkiness. Safari drops and
 * re-rasterises bands of the composited layers, which is the rows of tiles flashing.
 *
 * So the field drifts long enough to register as alive when someone arrives, then stops.
 * It freezes in place rather than snapping back, so nothing jumps.
 */
const SETTLE_AFTER_MS = 10000

export default function TileField({ animated = true, opacity = 1, twinkle = false, dark = false, settleAfterMs = SETTLE_AFTER_MS, settleFrom = 0 }) {
  const grads = dark ? TILE_GRADS_DARK : TILE_GRADS
  const fieldRef = useRef(null)
  const [colCount, setColCount] = useState(() => (typeof window !== 'undefined' ? Math.max(6, Math.ceil(window.innerWidth / 240)) : 8))
  useEffect(() => {
    // Only set state when the count actually changes. Writing the same number on every
    // resize event would re-render the whole field and restart every column animation,
    // which reads as the background jumping.
    function onResize() {
      const next = Math.max(6, Math.ceil(window.innerWidth / 240))
      setColCount((prev) => (prev === next ? prev : next))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Freeze the drift once it has had its moment. colCount and settleFrom are in the
  // deps so a re-render, or a caller telling us the intro has finished, restarts the
  // clock against the columns that are actually on screen now.
  useEffect(() => {
    if (!animated || twinkle || typeof window === 'undefined') return undefined
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const id = window.setTimeout(() => {
      const root = fieldRef.current
      if (!root) return
      for (const el of root.querySelectorAll('.lt-tile-drift')) {
        // Copy the live transform onto the element BEFORE removing the animation,
        // otherwise it snaps back to translateY(0) and the whole field jumps.
        const current = window.getComputedStyle(el).transform
        el.style.transform = current && current !== 'none' ? current : 'translateY(0)'
        el.style.animation = 'none'
        el.style.willChange = 'auto'
        const clip = el.parentElement
        if (clip) clip.style.willChange = 'auto'
      }
    }, reduced ? 0 : Math.max(0, settleAfterMs))
    return () => window.clearTimeout(id)
  }, [animated, twinkle, colCount, settleAfterMs, settleFrom])

  return (
    <>
      <div ref={fieldRef} aria-hidden style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: `repeat(${colCount}, 1fr)`, gap: `${TILE_GAP}px`, padding: `${TILE_GAP}px`, zIndex: 0, opacity }}>
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
        @media (prefers-reduced-motion: reduce) {
          .lt-tile-drift { animation: none !important; will-change: auto !important; }
        }
      `}</style>
    </>
  )
}
