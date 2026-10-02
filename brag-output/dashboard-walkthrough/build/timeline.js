// Dashboard walkthrough timeline. All coordinates are in the 1440x810 app frame (GEO from build-scenes.cjs).
var D = 64;
var tl = gsap.timeline({ paused: true });
function C(r, dy) { return [r[0] + r[2] / 2, r[1] + r[3] / 2 + (dy || 0)]; }
function ss(a, b, t) { var x = Math.min(1, Math.max(0, (t - a) / (b - a))); return x * x * (3 - 2 * x); }
function lin(a, b, t) { return Math.min(1, Math.max(0, (t - a) / (b - a))); }

// ---------- seeded stand-in photography on every canvas (lib/stills.js) ----------
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
document.querySelectorAll('canvas[data-seed]').forEach(function (cv) {
  var w = cv.offsetWidth || 200, h = cv.offsetHeight || 120; cv.width = Math.round(w * 2); cv.height = Math.round(h * 2);
  paintStill(cv, +cv.dataset.seed, cv.dataset.mood);
});
// the job's own cover: warm golden light
['#sc-projects #pjA canvas', '#sc-projects #pjB canvas', '#sc-final #fA canvas', '#sc-final #fB canvas', '#sc-project .cover canvas', '#sc-deliver #dGal canvas', '#sc-deliver .gsel .cover canvas'].forEach(function (s) { var c = document.querySelector(s); if (c) paintStill(c, 3, 'golden'); });

// ---------- time-driven states: class, text, html, display. Seek-safe (latest state wins) ----------
var STATES = [];
function st(t, sel, kind, val) { STATES.push([t, sel, kind, val]); }
var EL = {};
function applyStates(t) {
  var latest = {};
  for (var i = 0; i < STATES.length; i++) { var s = STATES[i], k = s[1] + '|' + s[2]; if (s[0] <= t && (!latest[k] || latest[k][0] <= s[0])) latest[k] = s; }
  for (var key in EL) {
    var e = EL[key], v = latest[key] ? latest[key][3] : e.init;
    if (e.cur === v) continue; e.cur = v;
    if (e.kind === 'cls') e.el.className = v; else if (e.kind === 'txt') e.el.textContent = v; else if (e.kind === 'html') e.el.innerHTML = v; else if (e.kind === 'disp') e.el.style.display = v;
  }
}
function initStates() {
  STATES.forEach(function (s) {
    var k = s[1] + '|' + s[2]; if (EL[k]) return; var el = document.querySelector(s[1]); if (!el) { console.warn('missing', s[1]); return; }
    var init = s[2] === 'cls' ? el.className : s[2] === 'txt' ? el.textContent : s[2] === 'html' ? el.innerHTML : (el.style.display || '');
    EL[k] = { el: el, kind: s[2], init: init, cur: init };
  });
}

// ---------- helpers ----------
function cam(at, cx, cy, s, d) {
  var x = Math.min(0, Math.max(1440 - 1440 * s, 720 - s * cx)), y = Math.min(0, Math.max(810 - 810 * s, 405 - s * cy));
  tl.to('#cam', { x: x, y: y, scale: s, duration: d || 1, ease: 'power2.inOut' }, at);
}
function camReset(at, d) { tl.to('#cam', { x: 0, y: 0, scale: 1, duration: d || 0.9, ease: 'power2.inOut' }, at); }
function cur(at, p, d, ease) { tl.to('#cursor', { x: p[0], y: p[1], duration: d || 0.8, ease: ease || 'power2.inOut' }, at); }
function curShow(at, p) { tl.fromTo('#cursor', { x: p[0], y: p[1], opacity: 0 }, { opacity: 1, duration: 0.2, immediateRender: false }, at); }
function curHide(at) { tl.to('#cursor', { opacity: 0, duration: 0.25 }, at); }
function click(at, target) {
  tl.to('#cursor', { scale: 0.82, duration: 0.07, ease: 'power2.in', yoyo: true, repeat: 1 }, at);
  tl.fromTo('#clickring', { opacity: 0.9, scale: 0.4 }, { opacity: 0, scale: 1.6, duration: 0.45, ease: 'power2.out', immediateRender: false }, at + 0.02);
  if (target) tl.to(target, { scale: 0.95, duration: 0.07, ease: 'power2.in', yoyo: true, repeat: 1 }, at);
}
function ringAt(at, p) { tl.set('#clickring', { x: p[0], y: p[1] }, at - 0.01); }
function tap(at, p, target) { ringAt(at, p); click(at, target); }
function pop(sel, at, dy) { tl.fromTo(sel, { opacity: 0, y: dy == null ? 12 : dy, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'power3.out' }, at); }
function xf(outSel, inSel, T) {
  tl.to(outSel, { opacity: 0, duration: 0.45, ease: 'power1.inOut' }, T);
  tl.fromTo(inSel, { opacity: 0 }, { opacity: 1, duration: 0.45, ease: 'power1.inOut' }, T - 0.05);
}
var capOn = false;
function caption(at, n, txt) {
  if (capOn) tl.to('#cap', { opacity: 0, y: 10, duration: 0.2, ease: 'power2.in' }, at - 0.22);
  st(at, '#capN', 'txt', n); st(at, '#capT', 'txt', txt);
  tl.fromTo('#cap', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out', immediateRender: !capOn }, at);
  capOn = true;
}
function chip(at, txt, dur) {
  st(at, '#tchipT', 'txt', txt);
  tl.fromTo('#tchip', { opacity: 0, y: -16, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: 'power3.out', immediateRender: false }, at);
  tl.to('#tchip', { opacity: 0, y: -10, duration: 0.3, ease: 'power2.in' }, at + (dur || 1.8));
}
function toast(at, txt, dur) {
  st(at, '#toastT', 'txt', txt);
  tl.fromTo('#toast', { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power3.out', immediateRender: false }, at);
  tl.to('#toast', { opacity: 0, y: -14, duration: 0.3, ease: 'power2.in' }, at + (dur || 2.1));
}

var G = GEO;
// ================= 0 · title over the Today screen =================
tl.fromTo('#sc-today .ws', { filter: 'blur(10px) brightness(0.55)' }, { filter: 'blur(0px) brightness(1)', duration: 0.9, ease: 'power2.inOut' }, 2.5);
tl.fromTo('#title', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }, 0.25);
tl.to('#title', { opacity: 0, y: -16, duration: 0.45, ease: 'power2.in' }, 2.45);

// ================= 1 · Today: the enquiry lands =================
caption(3.3, '1', 'An enquiry lands. Lumi has already drafted the reply.');
var pBrief = C(G.today.brief), pReply = C(G.today.reply);
cam(3.4, pBrief[0], pBrief[1] + 20, 1.28, 1.0);
curShow(4.5, [1150, 640]); cur(4.6, pReply, 1.1);
tap(5.95, pReply, '#tReply');
camReset(6.2, 0.6);

// ================= 2 · Thread: reply and quote =================
xf('#sc-today .ws', '#sc-thread .ws', 6.6);
caption(7.2, '2', 'Reply and quote in one click, from your own package.');
var pSend = C(G.thread.send);
cur(7.3, pSend, 0.9);
tap(8.45, pSend, '#rSend');
tl.to('#rLumiActs', { opacity: 0, duration: 0.2 }, 8.6);
st(8.6, '#rLumiA', 'disp', 'none'); st(8.6, '#rLumiB', 'disp', 'inline');
pop('#rMe', 8.8); pop('#rQ', 9.3);
st(8.9, '#rRowTxt', 'txt', 'Quote sent · waiting on Ruby');
st(8.9, '#rDot0', 'cls', 'd'); st(8.9, '#rDot1', 'cls', 'c');
st(8.9, '#rSt0', 'cls', 'd'); st(8.9, '#rSt1', 'cls', 'c');
cam(9.2, 1004, 470, 1.22, 1.0);
curHide(9.6);
// two days later: accepted, signed, paid
chip(10.6, 'Two days later');
caption(11.4, '3', 'Accepted, signed and paid, all from their phone.');
pop('#rThem2', 11.6);
function status(id, at) { tl.to('#' + id + 'A', { opacity: 0, duration: 0.2 }, at); tl.fromTo('#' + id + 'B', { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(2)' }, at); }
status('rQ', 12.6); st(12.6, '#rSt1', 'cls', 'd'); st(12.6, '#rSt2', 'cls', 'c'); st(12.6, '#rRowTxt', 'txt', 'Accepted · contract sent'); st(12.6, '#rDot1', 'cls', 'd'); st(12.6, '#rDot2', 'cls', 'c');
pop('#rSys1', 13.0, 6);
tl.to('#rLine', { y: -G.thread.scroll.rC, duration: 0.5, ease: 'power2.inOut' }, 13.45); pop('#rC', 13.6);
status('rC', 14.9); st(14.9, '#rSt2', 'cls', 'd'); st(14.9, '#rSt3', 'cls', 'c'); st(14.9, '#rRowTxt', 'txt', 'Signed · deposit sent'); st(14.9, '#rDot2', 'cls', 'd'); st(14.9, '#rDot3', 'cls', 'c');
tl.to('#rLine', { y: -G.thread.scroll.rI, duration: 0.5, ease: 'power2.inOut' }, 15.45); pop('#rI', 15.6);
status('rI', 16.9); st(16.9, '#rSt3', 'cls', 'd'); st(16.9, '#rSt4', 'cls', 'c'); st(16.9, '#rRowTxt', 'txt', 'Deposit paid · booked'); st(16.9, '#rDot3', 'cls', 'd'); st(16.9, '#rDot4', 'cls', 'c');
toast(17.0, 'Ruby and Sol paid the $960 deposit. Sat 13 Mar is yours.');
tl.to('#rLine', { y: -G.thread.scroll.rSys2, duration: 0.5, ease: 'power2.inOut' }, 17.45); pop('#rSys2', 17.6, 6);
st(17.6, '#rSub', 'txt', 'Wedding · Sat 13 Mar 2027 · Maleny · full day');
camReset(19.3, 0.9);

// ================= 4 · Calendar: the date locks =================
xf('#sc-thread .ws', '#sc-calendar .ws', 20.6);
caption(21.0, '4', 'The date locks itself, on every calendar you use.');
var p13 = C(G.calendar.c13);
cam(21.2, p13[0], p13[1], 1.45, 1.0);
tl.fromTo('#cEv', { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(2)' }, 22.3);
st(22.3, '#c13', 'cls', 'd b sel');
camReset(23.2, 0.8);
pop('#cDay', 23.6, 16); pop('#cUp', 24.1, 8);

// ================= 5 · Projects board: drag it along =================
xf('#sc-calendar .ws', '#sc-projects .ws', 26.0);
caption(26.4, '5', 'Every job on one board. Drag it along as it moves.');
var pA = C(G.projects.pjA), pB = C(G.projects.pjB);
tl.fromTo('#sc-projects .below', { y: -G.projects.shift }, { y: 0, duration: 0.55, ease: 'power2.inOut' }, 28.25);
curShow(27.0, [720, 660]); cur(27.05, [pA[0], pA[1] - 40], 0.8);
tl.to('#pjA', { scale: 1.04, rotation: 2, boxShadow: '0 30px 60px -20px rgba(0,0,0,0.9)', duration: 0.18, ease: 'power2.out' }, 27.95);
tl.to('#cursor', { scale: 0.86, duration: 0.1 }, 27.95);
tl.to('#pjA', { x: pB[0] - pA[0], y: pB[1] - pA[1], duration: 0.95, ease: 'power2.inOut' }, 28.1);
cur(28.1, [pB[0], pB[1] - 40], 0.95);
tl.to('#cursor', { scale: 1, duration: 0.1 }, 29.05);
tl.to('#pjA', { opacity: 0, duration: 0.12 }, 29.05);
tl.fromTo('#pjB', { opacity: 0, scale: 1.04 }, { opacity: 1, scale: 1, duration: 0.3, ease: 'power2.out' }, 29.05);
st(29.1, '#h0', 'txt', '0 · $0'); st(29.1, '#h2', 'txt', '4 · $11,400');
curHide(29.6);

// ================= 6 · Project page: shoot day =================
xf('#sc-projects .ws', '#sc-project .ws', 31.4);
chip(31.6, 'Sat 13 March 2027 · shoot day');
caption(31.9, '6', 'Shoot day: the brief, the checklist and the money in one place.');
var pS3 = C(G.project.pSt3);
curShow(32.2, [900, 520]); cur(32.25, pS3, 0.8);
tap(33.2, pS3, '#pSt3');
st(33.2, '#pSt2', 'cls', 'st stg mint'); st(33.2, '#pSt3', 'cls', 'st stg amber on');
tl.to('#sc-project .view', { y: -150, duration: 0.8, ease: 'power2.inOut' }, 33.7);
var k0 = C(G.project.pChk0, -150), k1 = C(G.project.pChk1, -150), k2 = C(G.project.pChk2, -150);
cur(33.9, k0, 0.8); tap(34.85, k0); st(34.85, '#pChk0', 'cls', 'on');
cur(35.05, k1, 0.45); tap(35.6, k1); st(35.6, '#pChk1', 'cls', 'on');
cur(35.8, k2, 0.45); tap(36.35, k2); st(36.35, '#pChk2', 'cls', 'on');
st(36.5, '#pChkN', 'txt', '6 of 10');
curHide(37.1);

// ================= 7 · Deliver: the gallery =================
xf('#sc-project .ws', '#sc-deliver .ws', 38.4);
chip(38.6, 'Two weeks later');
caption(38.9, '7', 'The gallery goes out behind one link. You can see when they open it.');
var pG = C(G.deliver.dGal), pSendL = C(G.deliver.dSend);
cam(39.3, pG[0] + 60, pG[1], 1.3, 1.0);
camReset(42.0, 0.8);
curShow(42.3, [700, 760]); cur(42.35, pSendL, 0.9);
tap(43.4, pSendL, '#dSend');
toast(43.5, 'Gallery link sent to Ruby and Sol.', 1.8);
pop('#dLogB', 43.6, 6);
st(44.4, '#dS0', 'txt', '1'); pop('#dLogA', 44.4, 6);
curHide(44.2);

// ================= 8 · Invoicing: the balance =================
xf('#sc-deliver .ws', '#sc-invoicing .ws', 45.2);
caption(45.5, '8', 'The balance lands. The reminder went out on its own.');
var pRow = C(G.invoicing.iRow);
cam(45.7, pRow[0] + 80, pRow[1], 1.4, 1.0);
st(46.9, '#iSt', 'cls', 'st ok'); st(46.9, '#iSt', 'txt', 'Paid');
st(46.9, '#iActs', 'html', '<button class="act2">Receipt</button>');
tl.fromTo('#iSt', { scale: 0.8 }, { scale: 1, duration: 0.35, ease: 'back.out(2.2)', immediateRender: false }, 46.9);
tl.fromTo('#iRow', { boxShadow: '0 0 0 0 rgba(141,243,214,0)' }, { boxShadow: '0 0 0 2px rgba(141,243,214,0.55), 0 0 30px rgba(141,243,214,0.25)', duration: 0.4, yoyo: true, repeat: 1, repeatDelay: 0.6 }, 46.9);
toast(47.0, 'Ruby and Sol paid the $2,240 balance. Paid in full.');
tl.to('#iOwedRow', { opacity: 0, duration: 0.3 }, 47.3); pop('#iOwedNone', 47.6, 6);
st(47.3, '#iOwedN', 'txt', '$0'); st(47.3, '#iOwedE', 'txt', 'nothing owed');
camReset(48.6, 0.9);

// ================= 9 · Reviews =================
xf('#sc-invoicing .ws', '#sc-reviews .ws', 50.2);
caption(50.5, '9', 'Three days later, a verified five-star review.');
tl.fromTo('#sc-reviews .vbelow', { y: -G.reviews.vShift }, { y: 0, duration: 0.6, ease: 'power2.inOut' }, 51.0);
pop('#vNew', 51.2, -20);
st(51.4, '#vMonth', 'txt', '5');
var pV = C(G.reviews.vNew);
cam(51.7, pV[0], pV[1], 1.32, 1.0);
camReset(54.0, 0.9);

// ================= 10 · Complete =================
xf('#sc-reviews .ws', '#sc-final .ws', 55.2);
caption(55.5, '✓', 'Complete. Paid in full, reviewed, and nothing chased by hand.');
var fA = C(G.final.fA), fB = C(G.final.fB);
tl.fromTo('#sc-final .fbelow', { y: -G.final.fShift }, { y: 0, duration: 0.5, ease: 'power2.inOut' }, 57.3);
tl.fromTo('#sc-final .fdbelow', { y: 0 }, { y: -G.final.fShift, duration: 0.5, ease: 'power2.inOut' }, 57.4);
curShow(56.0, [1150, 680]); cur(56.05, [fA[0], fA[1] - 40], 0.8);
tl.to('#fA', { scale: 1.04, rotation: 2, boxShadow: '0 30px 60px -20px rgba(0,0,0,0.9)', duration: 0.18, ease: 'power2.out' }, 57.0);
tl.to('#cursor', { scale: 0.86, duration: 0.1 }, 57.0);
tl.to('#fA', { x: fB[0] - fA[0], y: fB[1] - fA[1], duration: 0.9, ease: 'power2.inOut' }, 57.15);
cur(57.15, [fB[0], fB[1] - 40], 0.9);
tl.to('#cursor', { scale: 1, duration: 0.1 }, 58.05);
tl.to('#fA', { opacity: 0, duration: 0.12 }, 58.05);
tl.fromTo('#fB', { opacity: 0, scale: 1.04 }, { opacity: 1, scale: 1, duration: 0.3, ease: 'power2.out' }, 58.05);
tl.fromTo('#fB', { boxShadow: '0 0 0 0 rgba(141,243,214,0)' }, { boxShadow: '0 0 0 2px rgba(141,243,214,0.7), 0 0 40px rgba(141,243,214,0.35)', duration: 0.5, immediateRender: false }, 58.2);
curHide(58.5);
pop('#fEmpty', 58.3, 6); st(58.1, '#fDelH', 'txt', '0');

// ================= end card =================
tl.to('#cap', { opacity: 0, y: 10, duration: 0.3 }, 59.5);
tl.fromTo('#end', { opacity: 0 }, { opacity: 1, duration: 0.7, ease: 'power2.inOut' }, 59.8);
tl.fromTo('#endLogo', { opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1, duration: 0.8, ease: 'power3.out' }, 60.1);
tl.fromTo('#endH', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }, 60.5);
tl.fromTo('#endP', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }, 60.9);
tl.fromTo('#endU', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, 61.3);

// ---------- deliver upload progress, driven by time ----------
var dArc = document.getElementById('dArc'), dPct = document.getElementById('dPct'), dX = document.getElementById('dX'), dGB = document.getElementById('dS3');
function progress(t) {
  if (!dArc) return;
  var p = lin(39.4, 42.1, t), e = p < 1 ? p * (2 - p) : 1;
  dArc.setAttribute('stroke-dashoffset', (113 * (1 - e)).toFixed(2));
  dPct.textContent = Math.round(e * 100) + '%';
  dX.textContent = e >= 1 ? '412 photos · 2 films · ready' : 'Uploading · ' + Math.round(412 * e) + ' of 412';
  if (dGB) dGB.textContent = (19.6 * e).toFixed(1);
}

initStates();
var drv = { v: 0 };
tl.to(drv, { v: 1, duration: D, ease: 'none', onUpdate: function () { var t = tl.time(); applyStates(t); progress(t); } }, 0);
window.__timelines['main'] = tl;
tl.seek(0);
