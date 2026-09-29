// The living lens: the logo mark as a WebGL shader. Mint, rose and lilac ring,
// refractive glass centre, gel light in the room, film grain. Reacts to the pointer.
const VS = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`
const FS = `precision highp float;uniform vec2 uRes;uniform float uT;uniform vec2 uM;uniform float uPulse;uniform float uLive;uniform float uCy;uniform float uR;uniform vec2 uAim;uniform float uAimOn;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*noise(p);p*=2.03;a*=.5;}return v;}
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y;
  vec2 m=(uM-.5)*vec2(uRes.x/uRes.y,1.);
  // when a creative is under the pointer the whole lens leans toward them and the ring reaches out on that side
  vec2 c=uv-m*.06-uAim*.07*uAimOn; c=c-vec2(0.,0.5-uCy); float d=length(c); float ang=atan(c.y,c.x);
  float aimAng=atan(uAim.y,uAim.x); float face=pow(.5+.5*cos(ang-aimAng),3.);
  float R=uR+0.015*uPulse+.06*uAimOn*face;
  float t=fract(ang/6.2831+uT*.02);
  vec3 mint=vec3(.604,.769,.773),rose=vec3(.851,.588,.729),lilac=vec3(.776,.647,.898);
  vec3 col=t<.5?mix(mint,rose,t*2.):mix(rose,lilac,(t-.5)*2.); col=mix(col,mint,smoothstep(.86,1.,t));
  float sweep=pow(.5+.5*cos(ang-uT*.5-m.x*3.),10.)*(1.-uAimOn)+pow(.5+.5*cos(ang-aimAng),5.)*1.6*uAimOn;
  vec3 o=vec3(.027,.027,.043);
  // clean room: two soft, static tints, no noise
  o+=vec3(.114,.725,.329)*.06*(1.-smoothstep(.2,1.1,length(uv-vec2(-.7,.35))));
  o+=vec3(1.,.176,.47)*.05*(1.-smoothstep(.2,1.1,length(uv-vec2(.8,-.4))));
  float inner=1.-smoothstep(R-.11,R-.07,d);
  float g=smoothstep(-.3,.3,c.x+c.y*.6);
  vec3 glass=mix(vec3(.55,.9,.8),vec3(.98,.68,.82),g); glass=mix(glass,vec3(.85,.78,.98),smoothstep(.55,.9,g));
  vec2 sp=mix(vec2(-.09,.1),uAim*(R*.55),uAimOn); float spec=pow(max(0.,1.-length(c-sp)*6.),3.)*(1.+.6*uAimOn);
  o=mix(o,glass*.22+o*.55+spec*.28,inner);
  float ring=smoothstep(.06,0.,abs(d-R)-.014);
  float glow=exp(-abs(d-R)*8.)*.45;
  o+=col*(ring*.62+glow)*(.75+.35*sweep)*(1.-.5*uLive*(1.-.5*uAimOn*face));
  o*=1.-.6*smoothstep(.03,0.,abs(d-(R-.06))-.014);
  float halo=exp(-abs(d-R)*7.)*.06*(1.+uLive); o+=col*halo;
  // the reach toward a hovered creative stays tight to the ring so it never washes over their name
  o+=col*exp(-abs(d-R)*16.)*.14*uAimOn*face;
  o*=1.-.35*smoothstep(.6,1.4,length(uv));
  o+=(hash(gl_FragCoord.xy)-.5)/255.;
  gl_FragColor=vec4(o,1.);
}`
// Safari and Chrome drop a page's WebGL canvas when the tab sits in the background for a while or
// the laptop sleeps, and a dropped canvas stays black (29 Sep: the home page showed no lens until a
// reload). So: take the loss, rebuild when the browser gives the canvas back, and if it never does,
// swap in a fresh canvas beside the old one when the page is looked at again.
export function mountLens(cv0) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const coarse = matchMedia('(pointer:coarse)').matches
  const FALLBACK = 'radial-gradient(circle at 50% 50%,#16162a,#07070b 60%)'
  let cv = cv0, gl = null, U = null, lost = false, spare = null
  const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); return x }
  const scale = coarse ? .5 : .75
  const size = () => { if (!gl) return; const r = cv.getBoundingClientRect(); cv.width = Math.max(2, r.width * scale | 0); cv.height = Math.max(2, r.height * scale | 0); gl.viewport(0, 0, cv.width, cv.height) }
  const onLost = e => { e.preventDefault(); lost = true }
  const onRestored = () => { setup(); size() }
  function setup() {
    gl = cv.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' })
    if (!gl) { cv.style.background = FALLBACK; return false }
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); gl.useProgram(pr)
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    U = { res: gl.getUniformLocation(pr, 'uRes'), t: gl.getUniformLocation(pr, 'uT'), m: gl.getUniformLocation(pr, 'uM'), p: gl.getUniformLocation(pr, 'uPulse'), l: gl.getUniformLocation(pr, 'uLive'), cy: gl.getUniformLocation(pr, 'uCy'), r: gl.getUniformLocation(pr, 'uR'), aim: gl.getUniformLocation(pr, 'uAim'), aimOn: gl.getUniformLocation(pr, 'uAimOn') }
    lost = false
    return true
  }
  const listen = c => { c.addEventListener('webglcontextlost', onLost); c.addEventListener('webglcontextrestored', onRestored) }
  const unlisten = c => { c.removeEventListener('webglcontextlost', onLost); c.removeEventListener('webglcontextrestored', onRestored) }
  listen(cv)
  if (!setup()) return { think() {}, live() {}, layout() {}, aim() {}, destroy() { unlisten(cv) } }
  let mx = .5, my = .5, tx = .5, ty = .5, pulse = 0, live = 0, liveT = 0, raf = 0, visible = true
  let cy = .5, cyT = .5, R = .34, RT = .34
  let ax = 1, ay = 0, axT = 1, ayT = 0, aimOn = 0, aimOnT = 0
  size(); const ro = new ResizeObserver(size); ro.observe(cv)
  const onMove = e => { tx = e.clientX / innerWidth; ty = 1 - e.clientY / innerHeight }
  addEventListener('pointermove', onMove)
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting)); io.observe(cv)
  // The browser hasn't given the canvas back a moment after the page is visible again: use a new one.
  let wake = 0
  const replace = () => {
    if (!lost && gl && !gl.isContextLost()) return
    const n = cv.cloneNode(false); n.removeAttribute('id'); cv.style.display = 'none'
    cv.parentNode?.insertBefore(n, cv.nextSibling)
    unlisten(cv); ro.unobserve(cv); io.unobserve(cv)
    if (spare) spare.remove()
    spare = n; cv = n; listen(cv); ro.observe(cv); io.observe(cv)
    if (setup()) size()
  }
  const onVis = () => { clearTimeout(wake); if (document.visibilityState === 'visible') wake = setTimeout(replace, 1200) }
  document.addEventListener('visibilitychange', onVis); addEventListener('pageshow', onVis)
  const t0 = performance.now()
  let last = 0
  const frame = (now) => {
    if (visible && !lost && gl && now - last > 30) { last = now; mx += (tx - mx) * .05; my += (ty - my) * .05; live += (liveT - live) * .04; cy += (cyT - cy) * .06; R += (RT - R) * .06; ax += (axT - ax) * .12; ay += (ayT - ay) * .12; aimOn += (aimOnT - aimOn) * .1; const t = (performance.now() - t0) / 1000
      gl.uniform2f(U.res, cv.width, cv.height); gl.uniform1f(U.t, reduce ? 0 : t); gl.uniform2f(U.m, mx, my); gl.uniform1f(U.p, pulse ? (.5 + .5 * Math.sin(t * 6)) : 0); gl.uniform1f(U.l, live); gl.uniform1f(U.cy, cy); gl.uniform1f(U.r, R); gl.uniform2f(U.aim, ax, ay); gl.uniform1f(U.aimOn, aimOn); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4) }
    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)
  // layout({ cy, r }): ring centre as a fraction of the canvas height from the top, radius as a fraction of the height
  return { think: v => (pulse = v ? 1 : 0), live: v => (liveT = v ? 1 : 0), layout: ({ cy: c, r }) => { cyT = c; RT = r },
    // aim({x, y}) points the lens at a creative (unit direction, y up); aim(null) lets it settle
    aim: v => { if (v) { const l = Math.hypot(v.x, v.y) || 1; axT = v.x / l; ayT = v.y / l; aimOnT = 1 } else aimOnT = 0 },
    destroy() { cancelAnimationFrame(raf); clearTimeout(wake); ro.disconnect(); io.disconnect(); removeEventListener('pointermove', onMove); document.removeEventListener('visibilitychange', onVis); removeEventListener('pageshow', onVis); unlisten(cv); if (spare) spare.remove(); cv0.style.display = '' } }
}
