// Sparse pastel squares behind the dashboard content so the liquid-glass
// widgets have something to refract. Absolute to the content column (never
// under the sidebar). Dark mode = soft glowing HUD squares.

const LIGHT = [
  'linear-gradient(135deg,#a9c8f0,#7fa8e8)',
  'linear-gradient(135deg,#f3bcd6,#e894bd)',
  'linear-gradient(135deg,#cdbcf3,#a98be8)',
  'linear-gradient(135deg,#aee6cb,#7fd0aa)',
  'linear-gradient(135deg,#f6ccb0,#efab82)',
]
const DARK = [
  'linear-gradient(135deg,#1e6bd6,#38bdf8)',
  'linear-gradient(135deg,#7c3aed,#a855f7)',
  'linear-gradient(135deg,#0f766e,#22e39a)',
  'linear-gradient(135deg,#1d4ed8,#60a5fa)',
  'linear-gradient(135deg,#0891b2,#67e8f9)',
]

const SQUARES = [
  { top: '5%', left: '4%', size: 140, g: 0, o: 0.26 },
  { top: '14%', left: '86%', size: 170, g: 2, o: 0.2 },
  { top: '40%', left: '54%', size: 110, g: 3, o: 0.14 },
  { top: '58%', left: '8%', size: 150, g: 4, o: 0.2 },
  { top: '70%', left: '74%', size: 120, g: 1, o: 0.22 },
  { top: '30%', left: '24%', size: 90, g: 1, o: 0.14 },
  { top: '86%', left: '44%', size: 140, g: 0, o: 0.18 },
  { top: '50%', left: '92%', size: 100, g: 3, o: 0.18 },
]

export default function ScatteredSquares({ dark = false }) {
  const grads = dark ? DARK : LIGHT
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {SQUARES.map((s, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: s.top,
            left: s.left,
            width: s.size,
            height: s.size,
            borderRadius: 22,
            background: grads[s.g % grads.length],
            opacity: dark ? Math.min(0.55, s.o * 1.7) : s.o,
            filter: 'blur(1px)',
          }}
        />
      ))}
    </div>
  )
}
