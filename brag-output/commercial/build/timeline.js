// LensTrybe commercial. vol-10 at 109.96 BPM; beat-locked moments: 15.82 (send), 18.01/18.55 (accepted, signed), 20.19 (date locks), 24.01 (review).
var D = 38;
var tl = gsap.timeline({ paused: true });
function ss(a, b, t) { var x = Math.min(1, Math.max(0, (t - a) / (b - a))); return x * x * (3 - 2 * x); }
function lin(a, b, t) { return Math.min(1, Math.max(0, (t - a) / (b - a))); }
function C(r, dy) { return [r[0] + r[2] / 2, r[1] + r[3] / 2 + (dy || 0)]; }
var G = GEO;

// ---------- stand-in photography (lib/stills.js) ----------
var MOODS = {
  dusk: { base: ['#0b0d16', '#151a2b'], gels: [['29,185,84', .55], ['255,45,120', .35], ['198,165,229', .25]] },
  night: { base: ['#07070c', '#121018'], gels: [['255,45,120', .5], ['29,185,84', .4], ['74,158,255', .2]] },
  golden: { base: ['#120c0a', '#2a1a12'], gels: [['245,158,11', .5], ['255,45,120', .3], ['29,185,84', .28]] },
  cool: { base: ['#080c14', '#101a2a'], gels: [['74,158,255', .5], ['29,185,84', .35], ['217,150,186', .25]] },
  forest: { base: ['#070d0a', '#0f1f16'], gels: [['29,185,84', .6], ['154,196,197', .3], ['255,45,120', .2]] },
  rose: { base: ['#12080e', '#241019'], gels: [['255,45,120', .55], ['198,165,229', .3], ['29,185,84', .25]] }
};
function rng(seed) { var s = seed * 9301 + 49297; return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
function paintStill(cv, seed, moodName) {
  var W = cv.width, H = cv.height, mood = MOODS[moodName] || MOODS.dusk, R = rng(seed), ctx = cv.getContext('2d');
  var bg = ctx.createLinearGradient(0, 0, W, H); bg.addColorStop(0, mood.base[0]); bg.addColorStop(1, mood.base[1]); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  var hy = H * (.55 + R() * .25); ctx.fillStyle = 'rgba(255,255,255,.025)'; ctx.fillRect(0, hy, W, H - hy);
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 0, W, H * (.08 + R() * .1));
  mood.gels.forEach(function (g, i) { var x = W * (i === 0 ? .15 + R() * .3 : .55 + R() * .4), y = H * (R() * .7), rad = Math.max(W, H) * (.35 + R() * .35); var gr = ctx.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(' + g[0] + ',' + g[1] + ')'); gr.addColorStop(.5, 'rgba(' + g[0] + ',' + (g[1] * .25) + ')'); gr.addColorStop(1, 'rgba(' + g[0] + ',0)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H); });
  ctx.save(); ctx.translate(W * R(), H * R()); ctx.rotate((R() - .5) * 1.2); var st = ctx.createLinearGradient(-W, 0, W, 0); st.addColorStop(0, 'rgba(255,255,255,0)'); st.addColorStop(.5, 'rgba(255,255,255,.12)'); st.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = st; ctx.fillRect(-W, -H * .02, W * 2, H * .04); ctx.restore();
  var n = 5 + Math.floor(R() * 8);
  for (var i = 0; i < n; i++) { var x = W * R(), y = H * R(), rad = (6 + R() * 30) * 1.5, g = mood.gels[i % mood.gels.length]; var gr = ctx.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(' + g[0] + ',' + (.22 + R() * .25) + ')'); gr.addColorStop(.8, 'rgba(' + g[0] + ',.08)'); gr.addColorStop(1, 'rgba(' + g[0] + ',0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, rad, 0, 7); ctx.fill(); }
  var v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.max(W, H) * .75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.6)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}

// ---------- the constellation ----------
var CX = 960, CY = 590;
var ORBS = [
  { n: 'Mara Okafor', s: 'Wedding photography · Noosa', fit: 96, free: true, mood: 'golden', seed: 3, sz: 160, x: 1380, y: 450 },
  { n: 'Lena Hoang', s: 'Wedding photography · Sunshine Beach', fit: 91, free: true, mood: 'cool', seed: 29, sz: 140, x: 540, y: 450 },
  { n: 'Beck Halloran', s: 'Wedding films · Maleny', fit: 88, free: true, mood: 'dusk', seed: 13, sz: 140, x: 1660, y: 690 },
  { n: 'Priya Nair', s: 'Portraits · Maroochydore', fit: 72, free: true, mood: 'forest', seed: 9, sz: 120, x: 260, y: 690 },
  { n: 'Jono Reyes', s: 'Events · Brisbane', fit: 61, free: true, mood: 'rose', seed: 17, sz: 120, x: 1200, y: 800 },
  { n: 'Ari Castellano', s: 'Product photography · West End', fit: 49, free: false, mood: 'rose', seed: 23, sz: 120, x: 720, y: 800 }
];
(function () {
  var host = document.getElementById('orbs'), bg = document.getElementById('beamG');
  ORBS.forEach(function (o, j) {
    var el = document.createElement('div'); el.className = 'ad-orb' + (j === 0 ? ' best' : ''); el.id = 'orb' + j;
    el.style.left = o.x + 'px'; el.style.top = (o.y - o.sz / 2) + 'px';
    var cls = o.fit >= 80 ? '' : o.fit >= 55 ? ' mid' : ' low';
    el.innerHTML = '<div class="ph" style="width:' + o.sz + 'px;height:' + o.sz + 'px"><canvas width="' + (o.sz * 2) + '" height="' + (o.sz * 2) + '"></canvas><div class="fit' + cls + '"><span>' + (j === 0 ? 'Closest fit · ' : '') + o.fit + '%</span></div></div><b>' + o.n + '</b><small>' + o.s + '</small><span class="av' + (o.free ? '' : ' no') + '"><i></i>' + (o.free ? 'Free on the date' : 'Booked that day') + '</span>';
    host.appendChild(el); paintStill(el.querySelector('canvas'), o.seed, o.mood);
    var ang = Math.atan2(o.y - CY, o.x - CX), r0 = 160, rr = o.sz / 2 + 12;
    var x1 = CX + Math.cos(ang) * r0, y1 = CY + Math.sin(ang) * r0, x2 = o.x - Math.cos(ang) * rr, y2 = o.y - Math.sin(ang) * rr, len = Math.hypot(x2 - x1, y2 - y1);
    var ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    [['x1', x1], ['y1', y1], ['x2', x2], ['y2', y2]].forEach(function (a) { ln.setAttribute(a[0], a[1].toFixed(1)); });
    ln.setAttribute('stroke', j === 0 ? '#8DF3D6' : '#D996BA'); ln.setAttribute('stroke-opacity', j === 0 ? '0.85' : '0.45'); ln.setAttribute('stroke-width', '2');
    ln.setAttribute('stroke-dasharray', len.toFixed(1)); ln.setAttribute('stroke-dashoffset', len.toFixed(1)); ln.id = 'beam' + j; o.len = len; bg.appendChild(ln);
  });
})();
document.querySelectorAll('canvas[data-seed]').forEach(function (cv) { var w = cv.offsetWidth || 200, h = cv.offsetHeight || 120; cv.width = Math.round(w * 2); cv.height = Math.round(h * 2); paintStill(cv, +cv.dataset.seed, cv.dataset.mood); });
paintStill(document.getElementById('phAv'), 3, 'golden');
['#sc-final #fA canvas', '#sc-final #fB canvas', '#sc-deliver #dGal canvas', '#sc-deliver .gsel .cover canvas'].forEach(function (s) { var c = document.querySelector(s); if (c) paintStill(c, 3, 'golden'); });

// ---------- the living lens (lib/lens.js), seek-driven ----------
var FS = 'precision highp float;uniform vec2 uRes;uniform float uT;uniform float uPulse;uniform float uLive;uniform float uCy;uniform float uR;uniform vec2 uAim;uniform float uAimOn;uniform float uFade;' +
  'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}' +
  'void main(){vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y;vec2 c=uv-uAim*.07*uAimOn;c=c-vec2(0.,0.5-uCy);float d=length(c);float ang=atan(c.y,c.x);' +
  'float aimAng=atan(uAim.y,uAim.x);float face=pow(.5+.5*cos(ang-aimAng),3.);float R=uR+0.015*uPulse+.06*uAimOn*face;float t=fract(ang/6.2831+uT*.02);' +
  'vec3 mint=vec3(.604,.769,.773),rose=vec3(.851,.588,.729),lilac=vec3(.776,.647,.898);vec3 col=t<.5?mix(mint,rose,t*2.):mix(rose,lilac,(t-.5)*2.);col=mix(col,mint,smoothstep(.86,1.,t));' +
  'float sweep=pow(.5+.5*cos(ang-uT*.5),10.)*(1.-uAimOn)+pow(.5+.5*cos(ang-aimAng),5.)*1.6*uAimOn;' +
  'vec3 room=vec3(.027,.027,.043);room+=vec3(.114,.725,.329)*.06*(1.-smoothstep(.2,1.1,length(uv-vec2(-.7,.35))));room+=vec3(1.,.176,.47)*.05*(1.-smoothstep(.2,1.1,length(uv-vec2(.8,-.4))));' +
  'vec3 o=room;float inner=1.-smoothstep(R-.11,R-.07,d);float g=smoothstep(-.3,.3,c.x+c.y*.6);vec3 glass=mix(vec3(.55,.9,.8),vec3(.98,.68,.82),g);glass=mix(glass,vec3(.85,.78,.98),smoothstep(.55,.9,g));' +
  'vec2 sp=mix(vec2(-.09,.1),uAim*(R*.55),uAimOn);float spec=pow(max(0.,1.-length(c-sp)*6.),3.)*(1.+.6*uAimOn);o=mix(o,glass*.22+o*.55+spec*.28,inner);' +
  'float ring=smoothstep(.06,0.,abs(d-R)-.014);float glow=exp(-abs(d-R)*8.)*.45;o+=col*(ring*.62+glow)*(.75+.35*sweep)*(1.-.5*uLive*(1.-.5*uAimOn*face));' +
  'o*=1.-.6*smoothstep(.03,0.,abs(d-(R-.06))-.014);o+=col*exp(-abs(d-R)*7.)*.06*(1.+uLive);o+=col*exp(-abs(d-R)*16.)*.14*uAimOn*face;' +
  'vec3 v=mix(room,o,uFade);v*=1.-.35*smoothstep(.6,1.4,length(uv));v+=(hash(gl_FragCoord.xy)-.5)/255.;gl_FragColor=vec4(v,1.);}';
var cv = document.getElementById('gl'), gl = cv.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: true }), U = null;
if (gl) {
  var sh = function (t, s) { var x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); return x; };
  var pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}')); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); gl.useProgram(pr);
  var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  U = {}; ['uRes', 'uT', 'uPulse', 'uLive', 'uCy', 'uR', 'uAim', 'uAimOn', 'uFade'].forEach(function (k) { U[k] = gl.getUniformLocation(pr, k); });
  gl.viewport(0, 0, cv.width, cv.height);
}
var aimX = ORBS[0].x - CX, aimY = -(ORBS[0].y - CY), aL = Math.hypot(aimX, aimY); aimX /= aL; aimY /= aL;
function drawLens(t) {
  if (!U) return;
  var fade = ss(0.05, 1.4, t), cy = 0.5, R = 0.3, live = 0, pulse = 0;
  if (t > 6.0 && t < 6.9) pulse = (0.5 + 0.5 * Math.sin((t - 6.0) * 9)) * (1 - ss(6.5, 6.9, t));
  var k = ss(6.4, 7.2, t); cy += (CY / 1080 - cy) * k; R += (0.14 - R) * k; live = k;
  var aimOn = ss(6.5, 6.9, t) * (1 - ss(8.4, 9.0, t)) * 0.9;
  var p = ss(8.9, 9.7, t); R += (0.46 - R) * p; cy += (0.5 - cy) * p; fade *= 1 - 0.5 * p; live *= 1 - p;
  var q = ss(13.6, 14.4, t); R += (0.6 - R) * q; fade *= 1 - 0.45 * q;
  var e = ss(32.3, 33.2, t); R += (0.25 - R) * e; cy += (0.38 - cy) * e; fade += (1 - fade) * e;
  gl.uniform2f(U.uRes, cv.width, cv.height); gl.uniform1f(U.uT, t); gl.uniform1f(U.uPulse, pulse); gl.uniform1f(U.uLive, live);
  gl.uniform1f(U.uCy, cy); gl.uniform1f(U.uR, R); gl.uniform2f(U.uAim, aimX, aimY); gl.uniform1f(U.uAimOn, aimOn); gl.uniform1f(U.uFade, fade);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

// ---------- typing and Lumi's line (pure functions of time) ----------
var BRIEF = 'A wedding photographer in Maleny on 13 March, around $3,200';
var LUMI = '6 match. 5 are free on 13 March, 5 inside your budget. Mara is the closest fit.';
var typedTxt = document.getElementById('typedTxt'), typedPh = document.getElementById('typedPh'), caret = document.getElementById('caret'), lumiText = document.getElementById('lumiText');
function typeAt(t) {
  var n = Math.round(BRIEF.length * lin(3.9, 5.75, t));
  typedTxt.textContent = BRIEF.slice(0, n); typedPh.style.display = n ? 'none' : '';
  caret.style.opacity = (t > 3.85 && t < 5.8) || (t < 6.0 && Math.floor(t * 2.4) % 2 === 0) ? '1' : '0';
  var m = Math.round(LUMI.length * lin(6.9, 8.1, t)), s = LUMI.slice(0, m), cut = LUMI.indexOf('.') + 1;
  lumiText.innerHTML = m >= cut ? '<b>' + s.slice(0, cut) + '</b>' + s.slice(cut) : s;
}

// ---------- time-driven states ----------
var STATES = [], EL = {};
function st(t, sel, kind, val) { STATES.push([t, sel, kind, val]); }
function initStates() { STATES.forEach(function (s) { var k = s[1] + '|' + s[2]; if (EL[k]) return; var el = document.querySelector(s[1]); if (!el) { console.warn('missing', s[1]); return; } var init = s[2] === 'cls' ? el.className : s[2] === 'txt' ? el.textContent : s[2] === 'html' ? el.innerHTML : s[2] === 'pos' ? '0,0' : (el.style.display || ''); EL[k] = { el: el, kind: s[2], init: init, cur: init }; }); }
function applyStates(t) {
  var latest = {};
  for (var i = 0; i < STATES.length; i++) { var s = STATES[i], k = s[1] + '|' + s[2]; if (s[0] <= t && (!latest[k] || latest[k][0] <= s[0])) latest[k] = s; }
  for (var key in EL) { var e = EL[key], v = latest[key] ? latest[key][3] : e.init; if (e.cur === v) continue; e.cur = v; if (e.kind === 'cls') e.el.className = v; else if (e.kind === 'txt') e.el.textContent = v; else if (e.kind === 'html') e.el.innerHTML = v; else if (e.kind === 'pos') { var q = v.split(','); e.el.style.left = q[0] + 'px'; e.el.style.top = q[1] + 'px'; } else e.el.style.display = v; }
}

// ---------- helpers ----------
function pop(sel, at, dy) { tl.fromTo(sel, { opacity: 0, y: dy == null ? 14 : dy, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'power3.out' }, at); }
var capOn = false;
function caption(at, chip, n, txt) {
  if (capOn) tl.to('#cap', { opacity: 0, y: -8, duration: 0.2, ease: 'power2.in' }, at - 0.22);
  st(at, '#capChipT', 'txt', chip); st(at, '#capN', 'txt', n); st(at, '#capT', 'txt', txt);
  tl.fromTo('#cap', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out', immediateRender: !capOn }, at);
  capOn = true;
}
function toast(at, txt, dur) { st(at, '#toastT', 'txt', txt); tl.fromTo('#toast', { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power3.out', immediateRender: false }, at); tl.to('#toast', { opacity: 0, y: -14, duration: 0.3, ease: 'power2.in' }, at + (dur || 1.8)); }
function lcam(at, cx, cy, s, d) { var x = Math.min(0, Math.max(1440 - 1440 * s, 720 - s * cx)), y = Math.min(0, Math.max(810 - 810 * s, 405 - s * cy)); tl.to('#lcam', { x: x, y: y, scale: s, duration: d || 0.8, ease: 'power2.inOut' }, at); }
function lclick(at, p, target) {
  tl.set('#lring', { x: p[0], y: p[1] }, at - 0.01);
  tl.to('#lcursor', { scale: 0.82, duration: 0.07, ease: 'power2.in', yoyo: true, repeat: 1 }, at);
  tl.fromTo('#lring', { opacity: 0.9, scale: 0.4 }, { opacity: 0, scale: 1.6, duration: 0.45, ease: 'power2.out', immediateRender: false }, at + 0.02);
  if (target) tl.to(target, { scale: 0.95, duration: 0.07, ease: 'power2.in', yoyo: true, repeat: 1 }, at);
}
function ptap(at, x, y) { st(at - 0.07, '#touch', 'pos', x + ',' + y); tl.fromTo('#touch', { opacity: 0, scale: 0.6 }, { opacity: 0.95, scale: 1, duration: 0.12, ease: 'power2.out', immediateRender: false }, at - 0.06); tl.to('#touch', { opacity: 0, scale: 1.25, duration: 0.3 }, at + 0.12); }
function xf(o, i, T) { tl.to(o, { opacity: 0, duration: 0.4 }, T); tl.fromTo(i, { opacity: 0 }, { opacity: 1, duration: 0.4 }, T - 0.05); }

// ================= HOOK: both audiences in three seconds =================
tl.fromTo('#hl1', { yPercent: 110 }, { yPercent: 0, duration: 0.8, ease: 'expo.out' }, 0.27);
tl.fromTo('#hl2', { yPercent: 110 }, { yPercent: 0, duration: 0.8, ease: 'expo.out' }, 0.45);
tl.fromTo('#hr1', { yPercent: 110 }, { yPercent: 0, duration: 0.8, ease: 'expo.out' }, 1.37);
tl.to(['#hookL', '#hookR'], { opacity: 0, y: -30, filter: 'blur(8px)', duration: 0.4, ease: 'power2.in' }, 2.35);
tl.fromTo('#hook2', { opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1, duration: 0.6, ease: 'power3.out' }, 2.55);
tl.to('#hook2', { opacity: 0, y: -24, duration: 0.35, ease: 'power2.in' }, 3.4);

// ================= FOR CLIENTS =================
caption(3.7, 'For clients', '1', 'Say what you need, in one sentence.');
tl.fromTo('#barWrap', { opacity: 0, y: 40, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: 'power3.out' }, 3.65);
tl.fromTo('#miniLens', { rotation: 0 }, { rotation: 1440, duration: 5, ease: 'none' }, 3.7);
tl.to('#go', { scale: 0.94, duration: 0.07, ease: 'power2.in', yoyo: true, repeat: 1 }, 6.0);
caption(6.45, 'For clients', '2', 'See who fits, and who is free that day.');
tl.to('#barWrap', { y: -230, scale: 0.8, duration: 0.8, ease: 'power3.inOut' }, 6.35);
tl.fromTo('#lumiLine', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' }, 6.8);
var bloom = [6.62, 7.0, 7.17, 7.34, 7.51, 7.68];
ORBS.forEach(function (o, j) {
  tl.fromTo('#beam' + j, { attr: { 'stroke-dashoffset': o.len } }, { attr: { 'stroke-dashoffset': 0 }, duration: 0.4, ease: 'power2.out' }, bloom[j] - 0.2);
  tl.fromTo('#orb' + j, { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1, duration: j ? 0.65 : 0.85, ease: 'back.out(1.5)' }, bloom[j]);
});
tl.fromTo('#orb0 .ph', { scale: 1 }, { scale: 1.08, duration: 0.5, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 8.2);
// tap Mara, her thread opens on the client's phone
tl.to(['#orbs', '#beams', '#barWrap', '#lumiLine'], { opacity: 0, duration: 0.45, ease: 'power2.in' }, 9.05);
caption(9.3, 'For clients', '3', 'Book in a tap: quote, contract and deposit on your phone.');
tl.fromTo('#phone', { opacity: 0, y: 160, scale: 0.92 }, { opacity: 1, y: 0, scale: 1, duration: 0.75, ease: 'power3.out' }, 9.3);
pop('#p1', 9.85); pop('#p2', 10.15);
ptap(10.85, 200, 390); tl.to('#p2ok', { opacity: 1, duration: 0.2 }, 10.85); tl.to('#p2b', { opacity: 0, duration: 0.15 }, 10.85);
pop('#p3', 11.1, 6); pop('#p4', 11.3);
tl.fromTo('#sig', { strokeDasharray: 620, strokeDashoffset: 620 }, { strokeDashoffset: 0, duration: 0.55, ease: 'power1.inOut' }, 11.55);
ptap(12.2, 200, 600); tl.to('#p4ok', { opacity: 1, duration: 0.2 }, 12.2); tl.to('#p4b', { opacity: 0, duration: 0.15 }, 12.2);
tl.to('#pthread', { y: -185, duration: 0.45, ease: 'power2.inOut' }, 12.35);
pop('#p5', 12.5);
ptap(13.0, 200, 640); tl.to('#p5ok', { opacity: 1, duration: 0.2 }, 13.0); tl.to('#p5b', { opacity: 0, duration: 0.15 }, 13.0);
tl.fromTo('#p5ok', { scale: 0.9 }, { scale: 1, duration: 0.4, ease: 'back.out(2)', immediateRender: false }, 13.0);
tl.to('#phone', { opacity: 0, y: 120, scale: 0.94, duration: 0.5, ease: 'power2.in' }, 13.55);

// ================= FOR CREATIVES: the real dashboard =================
caption(14.05, 'For creatives', '1', 'Enquiries arrive with the reply already drafted.');
tl.fromTo('#laptop', { opacity: 0, y: 120 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }, 13.9);
var pSend = C(G.thread.send);
lcam(14.6, pSend[0] + 140, pSend[1] + 20, 1.35, 0.9);
tl.fromTo('#lcursor', { x: 1100, y: 640, opacity: 0 }, { opacity: 1, duration: 0.2, immediateRender: false }, 14.7);
tl.to('#lcursor', { x: pSend[0], y: pSend[1], duration: 0.85, ease: 'power2.inOut' }, 14.8);
lclick(15.82, pSend, '#rSend'); // beat-locked: 15.82
tl.to('#rLumiActs', { opacity: 0, duration: 0.2 }, 15.95);
st(15.95, '#rLumiA', 'disp', 'none'); st(15.95, '#rLumiB', 'disp', 'inline');
pop('#rMe', 16.05); pop('#rQ', 16.4);
st(16.1, '#rSt0', 'cls', 'd'); st(16.1, '#rSt1', 'cls', 'c'); st(16.1, '#rRowTxt', 'txt', 'Quote sent'); st(16.1, '#rDot0', 'cls', 'd'); st(16.1, '#rDot1', 'cls', 'c');
tl.to('#lcursor', { opacity: 0, duration: 0.25 }, 16.4);
caption(16.95, 'For creatives', '2', 'Contract, deposit and calendar, handled for you.');
lcam(16.7, 1004, 520, 1.3, 0.8);
function status(id, at) { tl.to('#' + id + 'A', { opacity: 0, duration: 0.2 }, at); tl.fromTo('#' + id + 'B', { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(2)' }, at); }
pop('#rThem2', 17.2);
status('rQ', 17.47); st(17.47, '#rSt1', 'cls', 'd'); st(17.47, '#rSt2', 'cls', 'c'); st(17.47, '#rRowTxt', 'txt', 'Accepted');
tl.to('#rLine', { y: -G.thread.scroll.rC, duration: 0.4, ease: 'power2.inOut' }, 17.6); pop('#rSys1', 17.7, 6); pop('#rC', 18.01); // beat-locked: 18.01
status('rC', 18.55); st(18.55, '#rSt2', 'cls', 'd'); st(18.55, '#rSt3', 'cls', 'c'); st(18.55, '#rRowTxt', 'txt', 'Signed');
tl.to('#rLine', { y: -G.thread.scroll.rI, duration: 0.4, ease: 'power2.inOut' }, 18.65); pop('#rI', 18.8);
status('rI', 19.1); st(19.1, '#rSt3', 'cls', 'd'); st(19.1, '#rSt4', 'cls', 'c'); st(19.1, '#rRowTxt', 'txt', 'Deposit paid');
toast(19.15, 'Ruby and Sol paid the $960 deposit.', 1.4);
// the date locks
xf('#sc-thread .ws', '#sc-calendar .ws', 19.85);
var p13 = C(G.calendar.c13);
tl.set('#lcam', { x: Math.min(0, Math.max(1440 - 1440 * 1.45, 720 - 1.45 * p13[0])), y: Math.min(0, Math.max(810 - 810 * 1.45, 405 - 1.45 * p13[1])), scale: 1.45 }, 19.85);
tl.fromTo('#cEv', { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(2)' }, 20.19); // beat-locked: 20.19
st(20.19, '#c13', 'cls', 'd b sel');
// deliver, get paid, get reviewed
xf('#sc-calendar .ws', '#sc-deliver .ws', 21.35);
caption(21.45, 'For creatives', '3', 'Deliver the gallery, get paid, get reviewed.');
var pG = C(G.deliver.dGal);
tl.set('#lcam', { x: Math.min(0, Math.max(1440 - 1440 * 1.35, 720 - 1.35 * (pG[0] + 80))), y: Math.min(0, Math.max(810 - 810 * 1.35, 405 - 1.35 * pG[1])), scale: 1.35 }, 21.35);
xf('#sc-deliver .ws', '#sc-reviews .ws', 23.35);
tl.set('#lcam', { x: 0, y: 0, scale: 1 }, 23.35);
tl.fromTo('#sc-reviews .vbelow', { y: -G.reviews.vShift }, { y: 0, duration: 0.55, ease: 'power2.inOut' }, 23.8);
pop('#vNew', 24.01, -20); // beat-locked: 24.01
var pV = C(G.reviews.vNew); lcam(24.2, pV[0], pV[1], 1.3, 0.8);
st(24.2, '#vMonth', 'txt', '5');

// ================= TOGETHER: same booking, both screens =================
xf('#sc-reviews .ws', '#sc-final .ws', 25.8);
tl.set('#lcam', { x: 0, y: 0, scale: 1 }, 25.8);
caption(26.0, 'Together', '✓', 'One booking. Two screens. Always in sync.');
tl.to('#laptop', { x: 570, y: 70, scale: 0.74, duration: 0.9, ease: 'power3.inOut' }, 25.9);
tl.set('#pthread', { opacity: 0 }, 26.0);
tl.fromTo('#phone', { opacity: 0, x: -560, y: 140, scale: 0.9 }, { opacity: 1, x: -560, y: 30, scale: 0.92, duration: 0.8, ease: 'power3.out', immediateRender: false }, 26.1);
tl.fromTo('#sync', { opacity: 0 }, { opacity: 1, duration: 0.4 }, 26.8);
pop('#g1', 26.7); pop('#g2', 27.2);
['#s1', '#s2', '#s3', '#s4', '#s5'].forEach(function (s, i) { var at = 27.65 + i * 0.18; st(at, s, 'cls', 'on'); tl.fromTo(s, { scale: 0.6 }, { scale: 1, duration: 0.3, ease: 'back.out(3)', immediateRender: false }, at); });
ptap(28.37, 312, 470);
pop('#g3', 28.7, 6);
function pulseDot(at) { tl.fromTo('#syncDot', { x: 0, opacity: 0 }, { x: 232, opacity: 1, duration: 0.55, ease: 'power2.inOut', immediateRender: false }, at); tl.to('#syncDot', { opacity: 0, duration: 0.15 }, at + 0.55); }
pulseDot(27.0); pulseDot(28.75);
var fA = C(G.final.fA), fB = C(G.final.fB);
tl.fromTo('#sc-final .fbelow', { y: -G.final.fShift }, { y: 0, duration: 0.5, ease: 'power2.inOut' }, 29.6);
tl.fromTo('#sc-final .fdbelow', { y: 0 }, { y: -G.final.fShift, duration: 0.5, ease: 'power2.inOut' }, 29.7);
tl.to('#fA', { scale: 1.04, rotation: 2, boxShadow: '0 30px 60px -20px rgba(0,0,0,0.9)', duration: 0.18 }, 29.3);
tl.to('#fA', { x: fB[0] - fA[0], y: fB[1] - fA[1], duration: 0.85, ease: 'power2.inOut' }, 29.45);
tl.to('#fA', { opacity: 0, duration: 0.12 }, 30.3);
tl.fromTo('#fB', { opacity: 0, scale: 1.04 }, { opacity: 1, scale: 1, duration: 0.3 }, 30.3);
tl.fromTo('#fB', { boxShadow: '0 0 0 0 rgba(141,243,214,0)' }, { boxShadow: '0 0 0 2px rgba(141,243,214,0.7), 0 0 40px rgba(141,243,214,0.35)', duration: 0.5, immediateRender: false }, 30.4);
pop('#fEmpty', 30.5, 6); st(30.3, '#fDelH', 'txt', '0');
caption(31.0, 'Together', '✓', 'Simple for clients. Simple for creatives.');

// ================= END =================
tl.to(['#laptop', '#phone', '#sync', '#cap'], { opacity: 0, duration: 0.5, ease: 'power2.in' }, 32.3);
tl.fromTo('#endLogo', { opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1, duration: 0.8, ease: 'power3.out' }, 32.75);
tl.fromTo('#endH', { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }, 33.25);
tl.fromTo('#endChips', { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }, 33.85);
tl.fromTo('#endU', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, 34.4);
tl.fromTo('#end', { scale: 1 }, { scale: 1.03, duration: 5, ease: 'sine.out' }, 32.75);
tl.fromTo('#bgm', { volume: 0.3 }, { volume: 0, duration: 1.6, ease: 'power1.in' }, 36.4);

// deliver upload, driven by time
var dArc = document.getElementById('dArc'), dPct = document.getElementById('dPct'), dX = document.getElementById('dX'), dGB = document.getElementById('dS3');
function progress(t) { if (!dArc) return; var p = lin(21.6, 22.9, t), e = p < 1 ? p * (2 - p) : 1; dArc.setAttribute('stroke-dashoffset', (113 * (1 - e)).toFixed(2)); dPct.textContent = Math.round(e * 100) + '%'; dX.textContent = e >= 1 ? '412 photos · 2 films · ready' : 'Uploading · ' + Math.round(412 * e) + ' of 412'; if (dGB) dGB.textContent = (19.6 * e).toFixed(1); }

initStates();
var drv = { v: 0 };
tl.to(drv, { v: 1, duration: D, ease: 'none', onUpdate: function () { var t = tl.time(); drawLens(t); typeAt(t); applyStates(t); progress(t); } }, 0);
window.__timelines['main'] = tl;
tl.seek(0);
