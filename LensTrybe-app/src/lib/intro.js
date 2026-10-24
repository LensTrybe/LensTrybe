// The site intro: the lens wakes up (24 Oct 2026). One WebGL shader paints the room, a polished
// floor, the living lens and the name seen through real refraction; a 2D canvas adds dust, sparks
// and the motes the name breaks into. Timeline, in seconds: a scan and a glint (0 to .6), the lens
// rolls in lighting each letter (to 2.2), rolls back to the crooked T (2.7), turns its head and the
// T snaps straight (3.25), rolls into place as the logo (4.05), the tagline (4.5), the name breaks
// into light and streams into the lens (5.5), the lens flies into the screen (6.3), cut to the page.
// A tap, a click or a key skips. Returns { skip, destroy }.
const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'
const FS = `precision highp float;
uniform vec2 uRes;uniform float uT;uniform vec2 uC;uniform float uR;uniform float uRoll;uniform vec2 uVel;uniform vec2 uGaze;uniform float uGlint;uniform vec2 uGlintP;uniform float uFly;uniform vec2 uM;uniform float uLand;uniform float uOn;uniform float uFloor;uniform float uFloorY;uniform float uStretch;
uniform sampler2D uTex;uniform vec3 uCam;uniform float uFlare;uniform float uHi;uniform float uZoomW;uniform float uWordA;uniform float uTilt;uniform float uPool;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
vec3 room(vec2 uv){
  vec3 o=vec3(.027,.027,.043);
  o+=vec3(.114,.725,.329)*.06*(1.-smoothstep(.2,1.1,length(uv-vec2(-.7,.35))));
  o+=vec3(1.,.176,.47)*.05*(1.-smoothstep(.2,1.1,length(uv-vec2(.8,-.4))));
  return o;
}
// the name, drawn into a texture each frame (so the T can turn and each letter can light up)
float txt(vec2 uv){
  vec2 tc=(uv*uRes.y+.5*uRes)/uRes;
  if(tc.x<0.||tc.x>1.||tc.y<0.||tc.y>1.) return 0.;
  return texture2D(uTex,tc).a;
}
vec2 centre(){ vec2 m=(uM-.5)*vec2(uRes.x/uRes.y,1.); return (uC-.5*uRes)/uRes.y+m*.025; }
// the name as light on the wall, refracted and magnified where it sits behind the glass
vec3 name(vec2 uv,vec3 o,float mirror){
  vec2 cc=centre(); float R=uR/uRes.y; float k=R/.34;
  vec2 c=uv-cc; float d=length(c); float rr=d/max(R,.001);
  float inside=(1.-smoothstep(R-.1*k,R-.06*k,d))*uOn;
  float mag=1.+.34*(1.-rr*rr)*inside;
  float ca=(.028*inside*rr+.07*uFly);
  float z=mag*uZoomW;
  float ar=txt(cc+c/(z*(1.+ca))), ag=txt(cc+c/z), ab=txt(cc+c/(z*(1.-ca)));
  float hx=(uv.x-cc.x)/max(R,.001); float band=exp(-hx*hx*1.1)*uHi;
  vec3 tint=mix(vec3(1.),vec3(.84,1.,.94),band*.55)+vec3(.12,0.,.06)*band*.3;
  tint*=1.-.55*mirror;
  // the fringes where the glass splits the light are the lens colours, not a rainbow
  vec3 mint=vec3(.604,.769,.773),rose=vec3(.851,.588,.729);
  float core=ag*uWordA;
  o=o*(1.-core)+tint*core;
  o+=mint*max(ar-ag,0.)*.85*uWordA*(1.-.55*mirror)+rose*max(ab-ag,0.)*.85*uWordA*(1.-.55*mirror);
  return o;
}
// everything the lens adds to the room at this point: ring, glass, trail, glint, flare
vec3 lens(vec2 uv,vec3 o,float mirror){
  vec2 m=(uM-.5)*vec2(uRes.x/uRes.y,1.);
  vec2 cc=centre();
  float R=uR/uRes.y; float k=R/.34;
  vec2 c=uv-cc; c.x/=1.+uStretch; c.x/=1.-.2*uTilt; float d=length(c); float ang=atan(c.y,c.x);
  float t=fract((ang+uRoll)/6.2831+uT*.02);
  // the barrel of the lens shows when it turns its head
  float d2=length(c+vec2(.11*R*uTilt,0.)); float rim=smoothstep(.05*k,0.,abs(d2-R)-.03*k)*uTilt;
  o=mix(o,vec3(.09,.09,.12),rim*.9);
  vec3 mint=vec3(.604,.769,.773),rose=vec3(.851,.588,.729),lilac=vec3(.776,.647,.898);
  vec3 col=t<.5?mix(mint,rose,t*2.):mix(rose,lilac,(t-.5)*2.); col=mix(col,mint,smoothstep(.86,1.,t));
  float gd=length(uv-uGlintP);
  o+=vec3(1.)*uGlint*pow(max(0.,1.-gd*9.),3.)*.55+mint*uGlint*exp(-gd*5.)*.3;
  float vl=length(uVel);
  if(vl>.0005){vec2 dir=uVel/vl;float along=dot(c,-dir);float side=dot(c,vec2(-dir.y,dir.x));
    float tr=smoothstep(0.,R*.2,along)*exp(-along/(R*2.4))*exp(-abs(abs(side)-R)*(14./k))*min(1.,vl*120.);
    o+=col*tr*.45;}
  float inner=1.-smoothstep(R-.11*k,R-.07*k,d);
  float g=smoothstep(-.3*k,.3*k,c.x+c.y*.6);
  vec3 glass=mix(vec3(.55,.9,.8),vec3(.98,.68,.82),g); glass=mix(glass,vec3(.85,.78,.98),smoothstep(.55,.9,g));
  vec2 sp=vec2(-.09,.1)*k+uGaze*R*.5; float spec=pow(max(0.,1.-length(c-sp)*6./k),3.);
  vec3 gl=glass*.16+o*.78+spec*.28;
  float rr=d/max(R,.001);
  float a60=floor((ang+3.1416)*22.)/22.; float st=pow(hash(vec2(a60,floor(uT*3.))),4.)*smoothstep(.05,.5,rr);
  gl+=uFly*(col*st*.45*(1.-rr*.6)+vec3(1.)*exp(-rr*4.)*.22+glass*.12*(1.-rr));
  o=mix(o,gl,inner*uOn*(1.-.6*mirror));
  float sweep=pow(.5+.5*cos(ang-uT*.5-m.x*3.),10.);
  float ring=smoothstep(.06*k,0.,abs(d-R)-.014*k);
  float glow=exp(-abs(d-R)*8./k)*.45;
  o+=col*(ring*.62+glow)*(.75+.35*sweep)*uOn;
  o*=1.-.6*smoothstep(.03*k,0.,abs(d-(R-.06*k))-.014*k)*uOn;
  o+=col*exp(-abs(d-R)*7./k)*.06*uOn;
  o+=col*uLand*exp(-abs(d-R)*4./k)*.45;
  // anamorphic flare: a thin horizontal streak of light through the glass
  float streak=exp(-abs(c.y)*(70./k))*exp(-abs(c.x)*(2.6/k))*uFlare*uOn;
  o+=(col*.7+vec3(.3))*streak*.9;
  return o;
}
void main(){
  vec2 uv0=(gl_FragCoord.xy-.5*uRes)/uRes.y;
  vec2 uv=uCam.xy+uv0/uCam.z;
  vec3 base=room(uv);
  vec3 o=name(uv,base,0.);
  o=lens(uv,o,0.);
  // a polished floor: the lens, the name and their light reflect below the horizon, fading with distance
  if(uFloor>0.&&uv.y<uFloorY){
    vec2 ruv=vec2(uv.x,2.*uFloorY-uv.y);
    float depth=uFloorY-uv.y;
    vec3 rn=name(ruv,base,1.); rn+=name(ruv+vec2(0.,.004),base,1.)+name(ruv-vec2(0.,.004),base,1.); rn/=3.;
    vec3 r=max(lens(ruv,rn,1.)-base,0.);
    float fade=exp(-depth*5.5);
    o+=r*fade*.5*uFloor;
    vec2 pc=centre(); float pk=uR/uRes.y/.34; float pdx=uv.x-pc.x;
    o+=vec3(.74,.7,.78)*uPool*uFloor*exp(-pdx*pdx/(2.4*pk*pk*.34*.34))*exp(-depth*(7./pk))*.4;
    o*=1.-.18*uFloor*smoothstep(0.,.25,depth);
    o+=vec3(.6,.9,.85)*.02*uFloor*exp(-depth*30.);
  }
  o*=1.-.35*smoothstep(.6,1.4,length(uv0));
  o+=(hash(gl_FragCoord.xy+fract(uT))-.5)*.024;
  gl_FragColor=vec4(o,1.);
}`

const LETTERS = 'LENSTRYBE'.split('')
const ease = t => 1 - Math.pow(1 - t, 3), easeIn = t => t * t * t
const easeIO = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
const back = t => { const s = 1.4; return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2) }
const snap = t => { const s = 2.2; return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2) }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, p) => a + (b - a) * p
export const INTRO_END = 6300

export function runIntro({ stage, gl: cv, fx, tag, scan, flash }, { onCut }) {
  const coarse = matchMedia('(pointer:coarse)').matches
  const gl = cv.getContext('webgl', { antialias: false, alpha: false })
  if (!gl) { onCut(); return { skip() {}, destroy() {} } }
  const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); return x }
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr)
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { onCut(); return { skip() {}, destroy() {} } }
  gl.useProgram(pr)
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
  const U = {}; 'uRes uT uC uR uRoll uVel uGaze uGlint uGlintP uFly uM uLand uOn uFloor uFloorY uStretch uTex uCam uFlare uHi uZoomW uWordA uTilt uPool'.split(' ').forEach(n => U[n] = gl.getUniformLocation(pr, n))
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.uniform1i(U.uTex, 0)
  const scale = coarse ? Math.min(1, 1200 / Math.max(innerWidth, innerHeight)) : .8
  let W = 0, H = 0
  const tc = document.createElement('canvas'), tctx = tc.getContext('2d'), fctx = fx.getContext('2d')
  function size() {
    const r = stage.getBoundingClientRect(); W = r.width; H = r.height
    cv.width = Math.max(2, W * scale | 0); cv.height = Math.max(2, H * scale | 0); gl.viewport(0, 0, cv.width, cv.height)
    tc.width = cv.width; tc.height = cv.height; fx.width = W; fx.height = H
  }

  let t0 = 0, raf = 0, lit = [], erase = [], geo = null, motes = [], roll = 0, lastX = 0, mx = .5, my = .5, tx = .5, ty = .5, parts = [], dust = [], done = false, tAng = 13, px0 = 0
  const onMove = e => { tx = e.clientX / innerWidth; ty = 1 - e.clientY / innerHeight }
  addEventListener('pointermove', onMove)

  function layout() {
    size()
    // portrait phones: a bigger name with tighter tracking, and the lens is bigger against it
    const narrow = W < 700
    const fs = narrow ? Math.max(30, Math.min(W * .112, 50)) : Math.max(30, Math.min(W * .064, 76)), sp = fs * (narrow ? .18 : .3)
    tctx.font = `500 ${fs}px Inter, sans-serif`
    const adv = LETTERS.map(l => tctx.measureText(l).width)
    const total = adv.reduce((a, b) => a + b, 0) + sp * (LETTERS.length - 1)
    let x = (W - total) / 2
    const cy = H * .5
    const ls = LETTERS.map((l, i) => { const o = { cx: x + adv[i] / 2, cy, w: adv[i] }; x += adv[i] + sp; return o })
    const R = fs * (narrow ? .92 : .7), left = ls[0].cx - adv[0] / 2, right = ls[8].cx + adv[8] / 2, floorY = cy + R * 2.05
    geo = { ls, R, cy, fs, left, right, floorY, xStart: -R * 2.2, xRight: right + R * 1.4, xT: ls[4].cx + R * 1.25, xLand: left - R * 1.35,
      // when lens plus name are wider than the screen (phones), the camera pulls back as the lens lands so both stay in frame
      zfit: Math.min(1, (W - 28) / (right - (left - R * 2.35))), cxw: ((left - R * 2.35) + right) / 2 }
    tag.style.top = (cy + R * 1.35) + 'px'
    lit = LETTERS.map(() => 0); erase = LETTERS.map(() => 0); tAng = 13
    const n = coarse ? 28 : 60
    dust = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, z: .3 + Math.random() * .7, vx: (Math.random() - .5) * 6, vy: -3 - Math.random() * 6, r: .6 + Math.random() * 1.4, ph: Math.random() * 6.28 }))
  }

  // paint the name into the texture: each letter at its own brightness, the T at its current tilt, a glow where the lens is lighting it
  function paintName(x, t) {
    const g = geo, s = scale
    tctx.clearRect(0, 0, tc.width, tc.height)
    tctx.font = `500 ${g.fs * s}px Inter, sans-serif`; tctx.textAlign = 'center'; tctx.textBaseline = 'middle'
    g.ls.forEach((l, i) => {
      const dx = Math.abs(x - l.cx), torch = clamp(1 - (dx - g.R * .3) / (g.R * 1.7), 0, 1)
      if (t >= 600 && t < 2200 && x > l.cx - g.R * .2) lit[i] = Math.max(lit[i], torch > .25 ? 1 : torch)
      if (t >= 2200) lit[i] = 1
      const a = (.05 + .95 * lit[i]) * (1 - erase[i]), near = t >= 600 && t < 4500 ? torch : 0
      tctx.save(); tctx.translate(l.cx * s, l.cy * s); if (i === 4) tctx.rotate(tAng * Math.PI / 180)
      tctx.fillStyle = `rgba(255,255,255,${a})`
      if (near > .03) { tctx.shadowColor = `rgba(169,245,223,${near * .9})`; tctx.shadowBlur = near * 26 * s }
      tctx.fillText(LETTERS[i], 0, 0)
      tctx.restore()
    })
    gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tc)
  }

  // the name breaks into light and is drawn into the lens: one mote per few pixels of the painted letters
  function gather() {
    const g = geo, s_ = scale, step = coarse ? 4 : 3
    const img = tctx.getImageData(0, 0, tc.width, tc.height).data
    motes = []
    for (let y = 0; y < tc.height; y += step) for (let x = 0; x < tc.width; x += step) {
      if (img[(y * tc.width + x) * 4 + 3] < 90) continue
      const px = x / s_, py = y / s_
      const delay = ((px - g.left) / (g.right - g.left)) * .5 + Math.random() * .12
      motes.push({ sx: px, sy: py, delay, spin: (Math.random() - .5) * 2, c: Math.random() < .5 ? '154,196,197' : (Math.random() < .5 ? '217,150,186' : '255,255,255'), r: .9 + Math.random() * 1.3 })
    }
  }
  function drawMotes(ct, lx, ly) {
    fctx.globalCompositeOperation = 'lighter'
    motes.forEach(m => {
      const p = clamp((ct - m.delay) / .75, 0, 1); if (p <= 0 || p >= 1) return
      const e = p * p * (3 - 2 * p), q = p * p
      const dx = lx - m.sx, dy = ly - m.sy, len = Math.hypot(dx, dy) || 1
      const nx = -dy / len, ny = dx / len, swirl = Math.sin(p * Math.PI) * 60 * m.spin
      const x = m.sx + dx * q + nx * swirl, y = m.sy + dy * q + ny * swirl - Math.sin(p * Math.PI) * 18
      fctx.fillStyle = `rgba(${m.c},${.9 * (1 - q * .6)})`
      fctx.beginPath(); fctx.arc(x, y, m.r * (1.6 - e), 0, 7); fctx.fill()
    })
    fctx.globalCompositeOperation = 'source-over'
  }
  function puff(x, y) {
    const cols = ['154,196,197', '217,150,186', '198,165,229', '255,255,255']
    for (let i = 0; i < 22; i++) { const a = Math.random() * Math.PI * 2, s = 40 + Math.random() * 160; parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, life: 0, max: .5 + Math.random() * .4, c: cols[i % 4], r: 1 + Math.random() * 2 }) }
  }
  function drawFx(dt, lx, ly, R, t) {
    fctx.save(); fctx.setTransform(1, 0, 0, 1, 0, 0); fctx.clearRect(0, 0, W, H); fctx.restore()
    fctx.globalCompositeOperation = 'lighter'
    const dim = t > 5500 ? clamp(1 - (t - 5500) / 500, 0, 1) : 1
    const px = (mx - .5) * 30, py = (.5 - my) * 20
    dust.forEach(p => {
      p.x += p.vx * dt * p.z; p.y += p.vy * dt * p.z
      if (p.y < -4) { p.y = H + 4; p.x = Math.random() * W } if (p.x < -4) p.x = W + 4; if (p.x > W + 4) p.x = -4
      const d = Math.hypot(p.x - lx, p.y - ly)
      const near = clamp(1 - d / (R * 4.5), 0, 1), tw = .55 + .45 * Math.sin(t / 700 + p.ph)
      const a = (.06 + near * .5) * tw * dim * p.z
      fctx.fillStyle = `rgba(${near > .5 ? '217,150,186' : '154,196,197'},${a})`
      fctx.beginPath(); fctx.arc(p.x + px * p.z, p.y + py * p.z, p.r * (1 + near), 0, 7); fctx.fill()
    })
    if (t >= 4500 && t < 5600) drawMotes((t - 4500) / 1000, lx, ly)
    parts = parts.filter(p => p.life < p.max)
    parts.forEach(p => { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .96; p.vy *= .96; const a = 1 - p.life / p.max; fctx.fillStyle = `rgba(${p.c},${a})`; fctx.beginPath(); fctx.arc(p.x, p.y, p.r * (1 + (1 - a)), 0, 7); fctx.fill() })
    fctx.globalCompositeOperation = 'source-over'
  }

  const fired = { fix: false, tag: false, gather: false, cut: false }
  let lastNow = 0
  function cut() {
    if (fired.cut) return
    fired.cut = true; done = true
    flash.style.transition = 'none'; flash.style.opacity = .55
    requestAnimationFrame(() => { flash.style.transition = 'opacity .9s cubic-bezier(.2,.75,.15,1)'; flash.style.opacity = 0 })
    onCut()
  }
  function frame(now) {
    const t = now - t0, dt = Math.min(.05, (now - lastNow) / 1000 || 0); lastNow = now
    const g = geo, R0 = g.R, cy = g.cy
    let x = g.xStart, y = cy, R = R0, gaze = [1, -.3], glint = 0, fly = 0, land = 0, on = 1, floor = 1, flare = 0, hi = 1, zoomW = 1, wordA = 1, tilt = 0
    const pool = t >= 350 && t < 5500 ? 1 : 0
    let cam = [0, 0, 1 + .05 * clamp(t / 4500, 0, 1)]
    let pan = t < 3250 ? 0 : t < 4050 ? ease(clamp((t - 3250) / 800, 0, 1)) : t < 5500 ? 1 : t < 6300 ? 1 - ease(clamp((t - 5500) / 800, 0, 1)) : 0
    if (t < 600) { on = t < 350 ? 0 : 1; const p = clamp(t / 600, 0, 1); scan.style.opacity = p < .9 ? .5 : 0; scan.style.top = (p * H) + 'px' }
    else scan.style.opacity = 0
    if (t >= 150 && t < 950) glint = Math.sin(clamp((t - 150) / 800, 0, 1) * Math.PI) * .8
    if (t >= 600 && t < 2200) { const p = easeIO((t - 600) / 1600); x = lerp(g.xStart, g.xRight, p) }
    else if (t >= 2200 && t < 2700) { const p = easeIO((t - 2200) / 500); x = lerp(g.xRight, g.xT, p) }
    else if (t >= 2700 && t < 3250) { x = g.xT; const p = ease(clamp((t - 2700) / 280, 0, 1)); gaze = [lerp(1, -1, p), lerp(-.3, -.15, p)]; tilt = p * (1 - ease(clamp((t - 3050) / 200, 0, 1)))
      const zp = ease(clamp((t - 2700) / 400, 0, 1)), z = cam[2] * (1 + .1 * zp); const Tx = (g.ls[4].cx - W / 2) / H, Ty = (H / 2 - cy) / H; cam = [Tx * (1 - 1 / z) * zp, Ty * (1 - 1 / z) * zp, z]
      if (t >= 2980) { const q = clamp((t - 2980) / 450, 0, 1); tAng = 13 * (1 - snap(q)); if (!fired.fix) { fired.fix = true; puff(g.ls[4].cx, g.ls[4].cy) } } }
    else if (t >= 3250 && t < 4050) { const p = back(clamp((t - 3250) / 800, 0, 1)); x = lerp(g.xT, g.xLand, p); gaze = [lerp(-1, .6, clamp(p, 0, 1)), -.3]; tAng = 0
      const zp = 1 - ease(clamp((t - 3250) / 500, 0, 1)), z = cam[2] * (1 + .1 * zp); const Tx = (g.ls[4].cx - W / 2) / H, Ty = (H / 2 - cy) / H; cam = [Tx * (1 - 1 / z) * zp, Ty * (1 - 1 / z) * zp, z] }
    else if (t >= 4050 && t < 4500) { x = g.xLand; gaze = [.6, -.3]; tAng = 0; const q = clamp((t - 4050) / 450, 0, 1); land = Math.sin(q * Math.PI) * .8; flare = Math.sin(q * Math.PI) * .9; if (!fired.tag) { fired.tag = true; tag.classList.add('on') } }
    else if (t >= 4500 && t < 5500) { x = g.xLand; gaze = [.6, -.3]; tAng = 0; const q = (t - 4500) / 1000
      if (!fired.gather) { fired.gather = true; gather() }
      for (let i = 0; i < 9; i++) { const d = (i / 8) * .5; erase[i] = clamp((q - d) / .22, 0, 1) }
      const intake = clamp((q - .25) / .6, 0, 1); land = .2 + intake * 1.1; flare = intake * .5; gaze = [lerp(.6, 0, intake), lerp(-.3, 0, intake)]
      tag.style.opacity = 1 - clamp(q * 2.5, 0, 1) }
    else if (t >= 5500 && t < 6300) { const q = (t - 5500) / 800, p = easeIn(q); x = lerp(g.xLand, W / 2, ease(q)); y = lerp(cy, H / 2, ease(q)); R = lerp(R0, Math.max(W, H) * 1.3, p); fly = clamp(q / .65, 0, 1); gaze = [0, 0]; floor = 1 - clamp(q * 2, 0, 1); tAng = 0; hi = 0
      erase.fill(1); wordA = 0; land = 1.3 * (1 - q); flare = .5 + q * .5; tag.style.opacity = 0 }
    else if (t >= 6300) { cut(); return }
    if (t < 4500) { roll += (x - lastX) / R0 } lastX = x
    const vx = t < 4500 ? (x - px0) / Math.max(1, dt * 1000) * 16 : 0; px0 = x
    mx += (tx - mx) * .06; my += (ty - my) * .06
    if (wordA > 0 && t < 5500) paintName(x, t)
    gl.uniform2f(U.uRes, cv.width, cv.height); gl.uniform1f(U.uT, t / 1000)
    gl.uniform2f(U.uC, x * scale, (H - y) * scale); gl.uniform1f(U.uR, R * scale); gl.uniform1f(U.uRoll, -roll)
    gl.uniform2f(U.uVel, vx / H, 0); gl.uniform2f(U.uGaze, gaze[0], gaze[1]); gl.uniform1f(U.uGlint, glint); gl.uniform2f(U.uGlintP, (g.xStart + R0 * 3 - W / 2) / H, (H / 2 - (g.floorY + R0 * .1)) / H)
    gl.uniform1f(U.uFly, fly); gl.uniform2f(U.uM, mx, my); gl.uniform1f(U.uLand, land); gl.uniform1f(U.uOn, on)
    gl.uniform1f(U.uFloor, floor); gl.uniform1f(U.uFloorY, (H / 2 - g.floorY) / H); gl.uniform1f(U.uStretch, clamp(Math.abs(vx) * .012, 0, .22))
    const fit = g.zfit < 1 ? pan : 0, zf = lerp(1, g.zfit, fit), cxe = lerp(W / 2, g.cxw, fit)
    cam[0] += (cxe - W / 2) / H; cam[2] *= zf
    gl.uniform3f(U.uCam, cam[0], cam[1], cam[2]); gl.uniform1f(U.uFlare, flare); gl.uniform1f(U.uHi, hi); gl.uniform1f(U.uZoomW, zoomW); gl.uniform1f(U.uWordA, wordA); gl.uniform1f(U.uTilt, tilt); gl.uniform1f(U.uPool, pool)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    fctx.setTransform(zf, 0, 0, zf, W / 2 - cxe * zf, H / 2 * (1 - zf)); drawFx(dt, x, y, R0, t); fctx.setTransform(1, 0, 0, 1, 0, 0)
    tag.style.left = (W / 2 + (W / 2 - cxe) * zf) + 'px'; tag.style.top = (H / 2 + (cy + R0 * 1.35 - H / 2) * zf) + 'px'
    raf = requestAnimationFrame(frame)
  }
  function start() {
    layout(); roll = 0; lastX = geo.xStart; px0 = geo.xStart
    t0 = performance.now(); lastNow = t0
    raf = requestAnimationFrame(frame)
  }
  let rt; const onResize = () => { clearTimeout(rt); rt = setTimeout(() => { if (!done) size() }, 150) }
  addEventListener('resize', onResize)
  const ready = document.fonts && document.fonts.load ? document.fonts.load('500 40px Inter').catch(() => {}) : Promise.resolve()
  let destroyed = false
  ready.then(() => { if (!destroyed) start() })
  return {
    skip() { if (!done) { cancelAnimationFrame(raf); cut() } },
    destroy() { destroyed = true; cancelAnimationFrame(raf); clearTimeout(rt); removeEventListener('pointermove', onMove); removeEventListener('resize', onResize); const ext = gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext() },
  }
}
