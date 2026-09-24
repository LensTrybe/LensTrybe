// Cinematic stand-in photography, drawn on canvas. Dark room, green and pink gel
// lighting, bokeh, grain. Replace with real work when the shot library exists.
const MOODS = {
  dusk:   { base: ['#0b0d16', '#151a2b'], gels: [['29,185,84', .55], ['255,45,120', .35], ['198,165,229', .25]] },
  night:  { base: ['#07070c', '#121018'], gels: [['255,45,120', .5], ['29,185,84', .4], ['74,158,255', .2]] },
  golden: { base: ['#120c0a', '#2a1a12'], gels: [['245,158,11', .5], ['255,45,120', .3], ['29,185,84', .28]] },
  cool:   { base: ['#080c14', '#101a2a'], gels: [['74,158,255', .5], ['29,185,84', .35], ['217,150,186', .25]] },
  forest: { base: ['#070d0a', '#0f1f16'], gels: [['29,185,84', .6], ['154,196,197', .3], ['255,45,120', .2]] },
  rose:   { base: ['#12080e', '#241019'], gels: [['255,45,120', .55], ['198,165,229', .3], ['29,185,84', .25]] },
}
export const MOOD_NAMES = Object.keys(MOODS)
function rng(seed) { let s = seed * 9301 + 49297; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280 } }
let grainC
function grain() {
  if (grainC) return grainC
  const g = document.createElement('canvas'); g.width = g.height = 160
  const c = g.getContext('2d'); const id = c.createImageData(160, 160)
  for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() * 255 | 0; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 26 }
  c.putImageData(id, 0, 0); return (grainC = g)
}
export function paintStill(cv, seed = 1, moodName = 'dusk') {
  const r = cv.getBoundingClientRect(); if (r.width < 6 || r.height < 6) return false
  const dpr = Math.min(1.5, devicePixelRatio || 1)
  const W = cv.width = Math.round(r.width * dpr), H = cv.height = Math.round(r.height * dpr)
  const mood = MOODS[moodName] || MOODS.dusk, R = rng(seed), ctx = cv.getContext('2d')
  const bg = ctx.createLinearGradient(0, 0, W, H); bg.addColorStop(0, mood.base[0]); bg.addColorStop(1, mood.base[1]); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)
  const hy = H * (.55 + R() * .25); ctx.fillStyle = 'rgba(255,255,255,.025)'; ctx.fillRect(0, hy, W, H - hy)
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 0, W, H * (.08 + R() * .1))
  mood.gels.forEach((g, i) => { const x = W * (i === 0 ? .15 + R() * .3 : .55 + R() * .4), y = H * (R() * .7), rad = Math.max(W, H) * (.35 + R() * .35); const gr = ctx.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(${g[0]},${g[1]})`); gr.addColorStop(.5, `rgba(${g[0]},${g[1] * .25})`); gr.addColorStop(1, `rgba(${g[0]},0)`); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H) })
  ctx.save(); ctx.translate(W * R(), H * R()); ctx.rotate((R() - .5) * 1.2); const st = ctx.createLinearGradient(-W, 0, W, 0); st.addColorStop(0, 'rgba(255,255,255,0)'); st.addColorStop(.5, 'rgba(255,255,255,.12)'); st.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = st; ctx.fillRect(-W, -H * .02, W * 2, H * .04); ctx.restore()
  const n = 5 + Math.floor(R() * 8)
  for (let i = 0; i < n; i++) { const x = W * R(), y = H * R(), rad = (6 + R() * 30) * dpr, g = mood.gels[i % mood.gels.length]; const gr = ctx.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(${g[0]},${.22 + R() * .25})`); gr.addColorStop(.8, `rgba(${g[0]},.08)`); gr.addColorStop(1, `rgba(${g[0]},0)`); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, rad, 0, 7); ctx.fill() }
  const fg = ctx.createLinearGradient(0, hy, 0, H); fg.addColorStop(0, `rgba(${mood.gels[0][0]},.14)`); fg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = fg; ctx.fillRect(0, hy, W, H - hy)
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.max(W, H) * .75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.6)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H)
  return true
}
