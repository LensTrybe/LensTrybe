// Builds scenes.json for the dashboard walkthrough: loads each real workspace page from the local
// demo (VITE_LT_MODE=demo on :5191), rewrites it into one job's story (Ruby and Sol, Maleny,
// Sat 13 Mar 2027), adds the elements that appear later (hidden), and records the geometry the
// cursor and camera need. Also saves the app's own CSS. Run: node build-scenes.cjs
const puppeteer = require('/Users/michaelmanoli/.npm/_npx/4b4c857f6efdfb61/node_modules/puppeteer');
const fs = require('fs'), path = require('path');
const OUT = path.join(__dirname, 'scenes.json'), CSS = path.join(__dirname, 'app.css');
const BASE = 'http://localhost:5191/app/';

// ---- runs inside the page ----
function common() {
  window.$ = (s, r = document) => r.querySelector(s);
  window.$$ = (s, r = document) => [...r.querySelectorAll(s)];
  window.rep = (root, map) => { const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); const ns = []; while (w.nextNode()) ns.push(w.currentNode); ns.forEach(n => { let v = n.nodeValue; for (const [a, b] of map) v = v.split(a).join(b); n.nodeValue = v }) };
  window.byText = (sel, txt, r = document) => $$(sel, r).find(e => e.textContent.trim().startsWith(txt));
  window.mk = html => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild };
  window.hide = e => { e.style.opacity = '0'; return e };
  $$('.dock, .dockbtn, .tabbar, .toast, .tour, [class*="tour"]').forEach(e => { if (!e.closest('.rail')) e.remove() });
  let k = 0; const moods = ['golden', 'cool', 'dusk', 'rose', 'forest', 'night']; $$('canvas').forEach(c => { c.dataset.seed = 3 + (k * 7) % 29; c.dataset.mood = moods[k % 6]; k++ });
  window.geo = {}; window.g = (name, e) => { const r = e.getBoundingClientRect(); geo[name] = [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] };
}
const SCENES = {
  today() {
    const brief = $('.brief'); brief.id = 'tBrief'; g('brief', brief);
    const b = byText('.brief .chip', 'Reply to Ruby'); b.id = 'tReply'; g('reply', b);
    g('ruby', byText('.nl, a', 'Threads') || $('.rail'));
  },
  thread() {
    const tl = $('.tline'); tl.id = 'rLine'; tl.parentElement.id = 'rScroll'; tl.parentElement.style.overflow = 'hidden';
    const lumi = $('.tline .tlumi'); lumi.id = 'rLumi';
    const send = byText('.tline .tlumi button', 'Send reply'); send.id = 'rSend'; g('send', send);
    lumi.querySelector('.acts').id = 'rLumiActs';
    const lt = lumi.querySelector('div > div, div');
    // a done line that replaces the draft text once it is sent
    const txt = [...lumi.querySelectorAll('div')].find(d => d.childNodes[0] && d.childNodes[0].nodeType === 3);
    if (txt) { txt.childNodes[0].nodeValue = ''; txt.insertAdjacentHTML('afterbegin', '<span id="rLumiA">13 March 2027 is open. Drafted a reply and a Full day quote at $3,200 with your travel note. Nothing sent yet.</span><span id="rLumiB" style="display:none">Sent at 6:52 am. I\'ll tell you when they open the quote.</span>') }
    const doc = (id, t, s, st, st2cls, st2) => `<div class="tdoc" id="${id}" style="opacity:0"><span class="ic"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg></span><div><b>${t}</b><small>${s}</small></div><span style="position:relative;display:grid"><span class="st sent" id="${id}A">${st}</span><span class="st ${st2cls}" id="${id}B" style="position:absolute;right:0;top:0;opacity:0">${st2}</span></span></div>`;
    const add = [
      `<div class="tm me" id="rMe" style="opacity:0">Hi Ruby and Sol! 13 March is open and I'd love to. Full day is $3,200, quote attached.<span class="w">Today, 6:52 am</span></div>`,
      doc('rQ', 'Quote #Q-0431 · Full day', '$3,200 incl. GST · valid 14 days', 'Sent', 'ok', 'Accepted'),
      `<div class="tm them" id="rThem2" style="opacity:0">We love it, and we love your work. Accepting now!<span class="w">Thu 24 Sept, 7:10 pm</span></div>`,
      `<div class="tsys" id="rSys1" style="opacity:0">Accepted Thu 24 Sept, 7:12 pm · contract sent automatically</div>`,
      doc('rC', 'Contract #C-0431', '12 clauses, plain English', 'Sent', 'pink', 'Signed'),
      doc('rI', 'INV-0231 · Deposit', '$960 · 30% · secures Sat 13 Mar', 'Sent', 'ok', 'Paid'),
      `<div class="tsys" id="rSys2" style="opacity:0">Date locked on LensTrybe and Google calendars</div>`,
    ];
    add.forEach(h => tl.appendChild(mk(h)));
    // how far the timeline must scroll to keep each new item in view
    const view = $('.tpb').getBoundingClientRect(); const top0 = tl.getBoundingClientRect().top;
    geo.scroll = {}; ['rMe', 'rQ', 'rThem2', 'rSys1', 'rC', 'rI', 'rSys2'].forEach(id => { const r = document.getElementById(id).getBoundingClientRect(); geo.scroll[id] = Math.max(0, Math.round(r.bottom - view.bottom + 24)) });
    ['rQ', 'rC', 'rI'].forEach(id => g(id, document.getElementById(id)));
    // header, stages and the list row
    $('.tp .tph h2').id = 'rH2'; $('.tp .tph p').id = 'rSub';
    $$('.tp .stages button').forEach((b, i) => b.id = 'rSt' + i);
    const row = byText('.tli', 'Ruby'); row.id = 'rRow'; row.querySelector('.r3 i').id = 'rRowTxt'; $$('.stg i', row).forEach((e, i) => e.id = 'rDot' + i);
    g('line', tl); g('tp', $('.tp'));
  },
  calendar() {
    const v = $('.view'); $('.vh h1').innerHTML = 'March <em>2027</em>'; if ($('.vh p')) $('.vh p').textContent = 'Tap a day, drag a booking to move it. Everything here is on your Google Calendar too.'; 
    const cells = $$('.mcal > .d');
    cells.forEach((c, i) => { const n = i + 1, out = n > 31; c.className = 'd' + (out ? ' out' : ''); let nn = c.querySelector('.n'); if (!nn) { nn = mk('<span class="n"></span>'); c.prepend(nn) } nn.textContent = out ? n - 31 : n; let ev = c.querySelector('.evs'); if (!ev) { ev = mk('<span class="evs"></span>'); c.appendChild(ev) } ev.innerHTML = ''; });
    geo.ncells = cells.length;
    const d13 = cells[12]; d13.id = 'c13'; d13.querySelector('.evs').innerHTML = '<button class="ev b" id="cEv" style="opacity:0">Ruby and Sol</button>';
    g('c13', d13);
    const day = $('.side .card.day'); day.id = 'cDay';
    day.querySelector('.h b').textContent = 'Sat, 13 Mar'; day.querySelector('.dn').textContent = 'Ruby and Sol · wedding';
    day.querySelector('p').innerHTML = '9:30am to 7:30pm · Maleny<br><small>Ceremony 2:30 · reception at the barn</small>'; day.querySelector('.dv').textContent = '$3,200';
    const inv = byText('.side .card.day .ctas .btn', 'Invoice'); if (inv) inv.textContent = 'Call sheet';
    hide(day);
    const up = $$('.side .up .d'); const last = up[up.length - 1];
    last.innerHTML = '<div class="dt"><small>Sat</small><b>13</b></div><div><b>Ruby and Sol · wedding</b><small>9:30am to 7:30pm · Maleny</small></div><span class="st ok">Booked</span>'; last.id = 'cUp'; hide(last);
    const tab = byText('.mnav b, .mnav span', 'Sept'); if (tab) tab.textContent = 'Mar 2027';
  },
  projects() {
    const cols = $$('.board .bcol'); cols.forEach((c, i) => c.id = 'col' + i);
    const card = cols[0].querySelector('.pj'); card.id = 'pjA'; g('pjA', card);
    cols[0].querySelector('.bh span').id = 'h0'; cols[2].querySelector('.bh span').id = 'h2';
    const clone = card.cloneNode(true); clone.id = 'pjB'; clone.className = 'pj booked';
    clone.querySelector('em').lastChild.nodeValue = 'Send call sheet · due 11 Mar';
    clone.querySelector('.pv small').textContent = '$960 paid';
    clone.querySelector('.ft').insertAdjacentHTML('beforeend', '<span class="prog"><i style="width: 30%;"></i></span>');
    hide(clone); cols[2].querySelector('.bh').after(clone);
    g('pjB', clone); geo.shift = Math.round(clone.getBoundingClientRect().height + parseFloat(getComputedStyle(cols[2]).rowGap || getComputedStyle(cols[2]).gap || 8));
    $$('.pj', cols[2]).filter(e => e !== clone).forEach((e, i) => e.classList.add('below'));
    g('col2', cols[2]);
  },
  final() {
    const cols = $$('.board .bcol'); cols.forEach((c, i) => c.id = 'fcol' + i);
    cols[0].querySelector('.pj').remove(); cols[0].querySelector('.bh span').textContent = '0 · $0';
    const n = cols.length; geo.ncols = n; geo.names = cols.map(c => (c.querySelector('.bh b') || {}).textContent);
    const shift = cols[2].getBoundingClientRect().left - cols[0].getBoundingClientRect().left; geo.boardShift = Math.round(shift);
    $('.board').style.transform = `translateX(${-shift}px)`;
    // the job, delivered and paid, sitting in Delivered; a copy waits in Complete
    const del = cols.find(c => /Delivered/.test(c.querySelector('.bh b').textContent)); const com = cols.find(c => /Complete/.test(c.querySelector('.bh b').textContent));
    del.id = 'fDel'; com.id = 'fCom';
    const tpl = document.querySelector('.pj').cloneNode(true);
    const card = tpl; card.className = 'pj deliv'; card.id = 'fA';
    card.querySelector('b').textContent = 'Ruby and Sol · wedding'; card.querySelector('small').textContent = 'Sat, 13 Mar · Maleny';
    card.querySelector('em').lastChild.nodeValue = 'Five-star review in';
    card.querySelector('.pv').innerHTML = '$3,200<small>paid in full</small>';
    const pr = card.querySelector('.prog'); if (pr) pr.innerHTML = '<i style="width: 100%;"></i>'; else card.querySelector('.ft').insertAdjacentHTML('beforeend', '<span class="prog"><i style="width: 100%;"></i></span>');
    const cb = card.cloneNode(true); cb.id = 'fB'; cb.className = 'pj done'; hide(cb);
    const emptyDel = del.querySelector('.bempty, .empty, .drop');
    del.querySelector('.bh').after(card); com.querySelector('.bh').after(cb);
    const emp = [...del.querySelectorAll('*')].find(e => e.children.length === 0 && /Nothing here/.test(e.textContent)); if (emp) { const box = emp.closest('.bempty, .empty, div:not(.bcol)') || emp; box.id = 'fEmpty'; box.style.opacity = '0' }
    del.querySelector('.bh span').id = 'fDelH'; del.querySelector('.bh span').textContent = '1 · $3,200'; com.querySelector('.bh span').id = 'fComH';
    g('fA', card); g('fB', cb);
    geo.fShift = Math.round(cb.getBoundingClientRect().height + 8);
    $$('.pj', com).filter(e => e !== cb).forEach(e => e.classList.add('fbelow'));
    $$('.pj', del).filter(e => e !== card).forEach(e => e.classList.add('fdbelow'));
  },
  project() {
    const v = $('.view');
    rep(v, [['Harper and Leo', 'Ruby and Sol'], ['Harper Ellis', 'Ruby Moretti'], ['harper.ellis@gmail.com', 'Client · booked through LensTrybe'], ['Harper', 'Ruby'], ['Sat, 7 Nov 2026 · Maleny Manor · from Referral · Ana', 'Sat, 13 Mar 2027 · Maleny · from your LensTrybe profile'], ['Sat, 7 Nov', 'Sat, 13 Mar'], ['7 Nov', '6 Mar'], ['Maleny Manor', 'Maleny']]);
    $('.pdt h1').innerHTML = 'Ruby and Sol <em>wedding</em>';
    const note = $('.note2'); if (note) note.textContent = 'Full day, about 80 guests. Garden ceremony at 2:30, reception at the barn. Relaxed and natural, not too posed. Sol\'s nonna is flying in from Italy, so get plenty of her.';
    const cov = $('.cover .in small'); if (cov) cov.textContent = 'Shoot day · Sat, 13 Mar';
    $$('.stpick .st').forEach((b, i) => { b.id = 'pSt' + i; g('pSt' + i, b) });
    const labs = $$('.chk label').slice(0, 3); const T = [['Send call sheet', ' · sent 11 Mar'], ['Family groups list from Ruby', ' · in 10 Mar'], ['Charge batteries, format cards', ' · today']];
    labs.forEach((l, i) => { l.id = 'pChk' + i; l.querySelector('span').innerHTML = T[i][0] + '<small>' + T[i][1] + '</small>'; g('pChk' + i, l.querySelector('i')) });
    const kb = byText('.kp .k', 'Checklists'); if (kb) kb.querySelector('b').id = 'pChkN';
    const ko = byText('.kp .k', 'Outstanding'); if (ko) ko.querySelector('em').textContent = 'due 6 Mar';
  },
  deliver() {
    const v = $('.view');
    rep(document.body, [['Harper and Leo, 72%', 'Ruby and Sol'], ['Harper and Leo', 'Ruby and Sol'], ['harperandleo', 'rubyandsol'], ['Maleny Manor', 'Maleny'], ['Uploading · 297 of 412', 'Uploading · 0 of 412']]);
    const gal = $('.gal.on'); gal.id = 'dGal'; const ring = gal.querySelector('.ring'); ring.id = 'dRing'; ring.querySelectorAll('circle')[1].id = 'dArc'; ring.querySelector('b').id = 'dPct';
    gal.querySelector('.x').id = 'dX';
    const stats = $$('.gstats > div b'); stats.forEach((b, i) => b.id = 'dS' + i); stats[0].textContent = '0'; stats[1].textContent = '0'; stats[3].textContent = '0';
    const send = byText('.gsel .ctas .btn', 'Send link'); send.id = 'dSend'; g('dSend', send);
    const log = $('.glog'); log.id = 'dLog';
    log.innerHTML = '<div id="dLogA" style="opacity:0"><small>Just now</small><span>Ruby opened the gallery on her phone</span></div><div id="dLogB" style="opacity:0"><small>Just now</small><span>Gallery link sent to Ruby and Sol</span></div><div><small>Today, 9:12</small><span>Upload started · 412 photos, 2 films</span></div><div><small>15 Mar</small><span>Sneak peek sent · 20 photos</span></div><div><small>13 Mar</small><span>Gallery created from the thread</span></div>';
    const lu = $('.side .tlumi div'); if (lu) lu.textContent = 'Once the link goes out I will set the 90 day expiry reminder and ask for a review three days after they open it.';
    g('dGal', gal);
  },
  invoicing() {
    rep(document.body, [['INV-0220 · Balance · reminder 31 Oct', 'INV-0232 · Balance · reminder 20 Mar'], ['INV-0219 · Deposit', 'INV-0231 · Deposit'], ['Harper and Leo', 'Ruby and Sol'], ['INV-0220', 'INV-0232'], ['reminder 31 Oct', 'reminder 20 Mar']]);
    const row = $$('.lr').find(r => /INV-0232/.test(r.textContent)); row.id = 'iRow';
    const dt = row.querySelector('.dt'); if (dt) dt.textContent = '27 Mar';
    const st = row.querySelector('.st'); st.id = 'iSt'; st.style.position = 'relative';
    row.querySelector('.acts2').id = 'iActs';
    const dep = $$('.lr').find(r => /INV-0231/.test(r.textContent)); if (dep) { const d = dep.querySelector('.dt'); if (d) d.textContent = '24 Sept' }
    const paid = byText('.lr .act2', 'Paid', row) || row.querySelector('.act2'); paid.id = 'iPaidBtn';
    g('iRow', row); g('iSt', st);
    const owed = $$('.side .card, .s4 .card').find(c => /Owed to you/.test(c.textContent)); if (owed) { owed.id = 'iOwed'; const r = owed.querySelector('.tl .e'); if (r) { r.id = 'iOwedRow'; const t = r.querySelector('.t'); if (t) t.textContent = '27 Mar'; r.insertAdjacentHTML('afterend', '<p class="tempty" id="iOwedNone" style="opacity:0">Nothing owed. Every invoice is paid.</p>') } }
    const k = byText('.kp .k', 'Owed'); if (k) { k.querySelector('b').id = 'iOwedN'; k.querySelector('em').id = 'iOwedE' }
    const kp = byText('.kp .k', 'Paid this'); if (kp) { kp.querySelector('b').id = 'iPaidN' }
  },
  reviews() {
    const list = $('.rev').parentElement; list.id = 'vList';
    const src = $$('.rev').find(r => /Marcus Petrou/.test(r.textContent)) || $('.rev');
    const c = src.cloneNode(true); c.id = 'vNew';
    c.querySelector('.rh b').textContent = 'Ruby and Sol'; c.querySelector('.rh small').textContent = 'Wedding · 16 Mar';
    c.querySelector('.rh .av').style.background = 'linear-gradient(135deg, rgb(40, 48, 71), rgb(154, 196, 197))';
    c.querySelector('p').textContent = 'Mara was calm, funny and somehow everywhere at once. The sneak peek had us both in tears the next morning. Book her.';
    hide(c); list.prepend(c); g('vNew', c); geo.vShift = Math.round(c.getBoundingClientRect().height + 12);
    $$('.rev', list).filter(e => e !== c).forEach(e => e.classList.add('vbelow'));
    const k = byText('.kp .k', 'Rating'); if (k) { k.querySelector('b').id = 'vRate'; k.querySelector('em').id = 'vRateE' }
    const km = byText('.kp .k', 'This month'); if (km) { km.querySelector('b').id = 'vMonth' }
  },
};
const PLAN = [['today', 'today'], ['thread', 'thread/ruby'], ['calendar', 'bookings'], ['projects', 'projects'], ['project', 'project/harper'], ['deliver', 'deliver'], ['invoicing', 'invoicing'], ['reviews', 'reviews'], ['final', 'projects']];

(async () => {
  const b = await puppeteer.launch({ headless: true, defaultViewport: { width: 1440, height: 810, deviceScaleFactor: 1 } });
  const p = await b.newPage(); const out = {}; let css = '';
  for (const [name, route] of PLAN) {
    await p.goto(BASE + route, { waitUntil: 'networkidle0' }); await new Promise(x => setTimeout(x, 1200));
    await p.evaluate(() => { const s = [...document.querySelectorAll('button')].find(x => /Skip tour/.test(x.textContent)); if (s) s.click() });
    await new Promise(x => setTimeout(x, 900));
    await p.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
    await p.evaluate(common);
    await p.evaluate(`(${SCENES[name].toString().replace(/^[a-z]+\(\)/, 'function()')})()`);
    const r = await p.evaluate(() => ({ html: document.querySelector('.ws').outerHTML, filt: document.querySelector('#root > svg') ? document.querySelector('#root > svg').outerHTML : '', geo: window.geo }));
    out[name] = r; console.log(name, r.html.length, JSON.stringify(r.geo).slice(0, 300));
    if (!css) css = await p.evaluate(() => [...document.styleSheets].map(s => { try { return [...s.cssRules].map(r => r.cssText).join('\n') } catch (e) { return '' } }).join('\n'));
  }
  fs.writeFileSync(OUT, JSON.stringify(out)); fs.writeFileSync(CSS, css);
  await b.close();
})().catch(e => { console.error(e); process.exit(1) });
