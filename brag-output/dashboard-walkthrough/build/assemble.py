# Assembles ../composition/index.html from scenes.json, app.css and timeline.js.
import json, re, os, collections
H = os.path.dirname(os.path.abspath(__file__))
S = json.load(open(os.path.join(H, 'scenes.json')))
css = open(os.path.join(H, 'app.css')).read()
tljs = open(os.path.join(H, 'timeline.js')).read()
# Google font imports are replaced by local files
css = re.sub(r'@import[^;]*;', '', css).replace('SFMono-Regular, ', '').replace('SFMono-Regular,', '')

ORDER = [('today', 0, 7.2), ('thread', 6.5, 14.7), ('calendar', 20.5, 6.1), ('projects', 25.9, 6.1), ('project', 31.3, 7.7),
         ('deliver', 38.3, 7.5), ('invoicing', 45.1, 5.7), ('reviews', 50.1, 5.7), ('final', 55.1, 5.5)]
# ids that repeat across scenes get a per-scene suffix
count = collections.Counter()
for n, _, _ in ORDER:
    for i in set(re.findall(r'\sid="([^"]+)"', S[n]['html'])): count[i] += 1
def fix(n, h):
    h = re.sub(r'\sid="([^"]+)"', lambda m: ' id="%s--%s"' % (m.group(1), n) if count[m.group(1)] > 1 else m.group(0), h)
    return h
scenes = ''.join('<div class="clip" id="sc-%s" data-start="%s" data-duration="%s" data-track-index="%d">%s</div>\n' % (n, s, d, i, fix(n, S[n]['html']).replace('src="/logo-on-dark.svg"', 'src="assets/brand/logo-on-dark.svg"')) for i, (n, s, d) in enumerate(ORDER))
filt = S['today']['filt']
geo = {n: S[n]['geo'] for n, _, _ in ORDER}

SFX = [  # id, file, start, duration, volume
    ('sIntro', 'impactSoft_medium_001.ogg', 0.2, 0.18, 0.5),
    ('c1', 'click2.ogg', 5.95, 0.055, 0.8), ('c2', 'click2.ogg', 8.45, 0.055, 0.8), ('c3', 'click2.ogg', 33.2, 0.055, 0.8), ('c4', 'click2.ogg', 43.4, 0.055, 0.8),
    ('k1', 'click_003.ogg', 34.85, 0.01, 0.9), ('k2', 'click_003.ogg', 35.6, 0.01, 0.9), ('k3', 'click_003.ogg', 36.35, 0.01, 0.9),
    ('d1', 'drop_002.ogg', 9.3, 0.19, 0.55), ('d2', 'drop_002.ogg', 13.6, 0.19, 0.5), ('d3', 'drop_002.ogg', 15.6, 0.19, 0.5), ('d4', 'drop_002.ogg', 23.6, 0.19, 0.45),
    ('g1', 'impactGlass_light_001.ogg', 11.6, 0.21, 0.55), ('g2', 'impactGlass_light_001.ogg', 44.4, 0.21, 0.5), ('g3', 'impactGlass_light_001.ogg', 51.2, 0.21, 0.55),
    ('x1', 'select_008.ogg', 12.6, 0.047, 0.8), ('x2', 'select_008.ogg', 14.9, 0.047, 0.8), ('x3', 'select_008.ogg', 22.3, 0.047, 0.8),
    ('b1', 'bong_001.ogg', 16.9, 0.12, 0.7), ('b2', 'bong_001.ogg', 46.9, 0.12, 0.7),
    ('p1', 'switch_002.ogg', 27.95, 0.6, 0.35), ('p2', 'switch_002.ogg', 57.0, 0.6, 0.35),
    ('q1', 'drop_001.ogg', 29.05, 0.11, 0.6), ('q2', 'drop_001.ogg', 58.05, 0.11, 0.6),
    ('w1', 'impactSoft_medium_001.ogg', 10.6, 0.18, 0.4), ('w2', 'impactSoft_medium_001.ogg', 31.6, 0.18, 0.4), ('w3', 'impactSoft_medium_001.ogg', 38.6, 0.18, 0.4),
    ('bell', 'impactBell_heavy_000.ogg', 58.15, 1.48, 0.38), ('sEnd', 'impactSoft_medium_001.ogg', 59.9, 0.18, 0.5),
]
audio = '\n'.join('<audio id="%s" src="assets/sfx/%s" data-start="%s" data-duration="%s" data-track-index="%d" data-volume="%s"></audio>' % (i, f, s, d, 20 + k % 6, v) for k, (i, f, s, d, v) in enumerate(SFX))

page = '''<!doctype html>
<html lang="en" data-resolution="landscape">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=1920, height=1080" />
<title>LensTrybe dashboard walkthrough</title>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
@font-face { font-family: "Inter"; src: url("assets/fonts/Inter-var.woff2") format("woff2"); font-weight: 100 900; font-style: normal; }
@font-face { font-family: "Instrument Serif"; src: url("assets/fonts/InstrumentSerif-400-normal.woff2") format("woff2"); font-weight: 400; font-style: normal; }
@font-face { font-family: "Instrument Serif"; src: url("assets/fonts/InstrumentSerif-400-italic.woff2") format("woff2"); font-weight: 400; font-style: italic; }
</style>
<style>
''' + css + '''
</style>
<style>
html, body { margin: 0; width: 1920px; height: 1080px; overflow: hidden; background: #07070b; }
#root { position: relative; width: 100%; height: 100%; overflow: hidden; background: #07070b; font-family: "Inter", system-ui, sans-serif; }
#stage { position: absolute; left: 0; top: 0; width: 1440px; height: 810px; transform-origin: 0 0; transform: scale(1.3333333); overflow: hidden; }
#cam { position: absolute; left: 0; top: 0; width: 1440px; height: 810px; transform-origin: 0 0; }
#cam > .clip { position: absolute; left: 0; top: 0; width: 1440px; height: 810px; overflow: hidden; }
.ws { width: 1440px; height: 810px !important; min-height: 0 !important; }
.ws .aurora { position: absolute !important; }
#pjA, #fA { position: relative; z-index: 40; background: #1c1c25 !important; }
.board, .bcol { overflow: visible !important; }
#cursor { position: absolute; left: 0; top: 0; width: 22px; height: 22px; margin: -2px 0 0 -3px; opacity: 0; z-index: 50; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.6)); }
#clickring { position: absolute; left: 0; top: 0; width: 40px; height: 40px; margin: -20px 0 0 -20px; border-radius: 50%; border: 2px solid #8DF3D6; background: rgba(141,243,214,0.18); opacity: 0; z-index: 49; }
.ov { position: absolute; font-family: "Inter", system-ui, sans-serif; color: #f4f2f7; }
#title { left: 0; right: 0; top: 380px; text-align: center; opacity: 0; }
#title .eb { font-size: 22px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: #A9F5DF; }
#title h1 { margin: 18px 0 0; font-size: 96px; font-weight: 600; letter-spacing: -0.045em; line-height: 1.02; color: #fff; text-shadow: 0 4px 40px rgba(0,0,0,0.7); }
#title h1 em, #end h2 em { font-family: "Instrument Serif", Georgia, serif; font-style: italic; font-weight: 400; background: linear-gradient(90deg, #9AC4C5, #D996BA 55%, #C6A5E5); -webkit-background-clip: text; background-clip: text; color: transparent; padding-right: 0.08em; }
#title p { margin: 22px 0 0; font-size: 32px; color: rgba(244,242,247,0.85); text-shadow: 0 2px 20px rgba(0,0,0,0.8); }
#cap { left: 44px; bottom: 40px; display: flex; align-items: center; gap: 18px; padding: 16px 30px 16px 16px; border-radius: 999px; background: rgba(10,10,15,0.88); border: 1.5px solid rgba(255,255,255,0.16); box-shadow: 0 20px 60px -20px rgba(0,0,0,0.9); opacity: 0; }
#capN { width: 50px; height: 50px; border-radius: 50%; display: grid; place-items: center; background: #8DF3D6; color: #0a0a0f; font-size: 24px; font-weight: 700; flex: none; box-shadow: 0 0 20px rgba(141,243,214,0.5); }
#capT { font-size: 29px; font-weight: 500; letter-spacing: -0.01em; white-space: nowrap; }
#tchip { left: 0; right: 0; top: 40px; display: flex; justify-content: center; opacity: 0; }
#tchip > div { display: flex; align-items: center; gap: 14px; padding: 16px 30px; border-radius: 999px; background: #f4f2f7; color: #0a0a0f; font-size: 30px; font-weight: 600; box-shadow: 0 20px 60px -10px rgba(0,0,0,0.8); }
#tchip svg { color: #0E7C3A; }
#toast { left: 0; right: 0; top: 40px; display: flex; justify-content: center; opacity: 0; }
#toast > div { display: flex; align-items: center; gap: 16px; padding: 20px 30px; border-radius: 22px; background: #14111a; color: #fff; font-size: 27px; font-weight: 500; box-shadow: 0 24px 60px -20px rgba(0,0,0,0.9), 0 0 0 1.5px rgba(255,255,255,0.14); }
#toast i { width: 14px; height: 14px; border-radius: 50%; background: #8DF3D6; box-shadow: 0 0 12px rgba(141,243,214,0.7); flex: none; }
#end { inset: 0; opacity: 0; background: radial-gradient(ellipse 900px 600px at 50% 45%, rgba(29,185,84,0.12), rgba(7,7,11,0) 70%), #07070b; text-align: center; }
#endLogo { display: block; width: 560px; height: 118px; margin: 330px auto 0; }
#end h2 { margin: 56px 0 0; font-size: 84px; font-weight: 600; letter-spacing: -0.045em; color: #fff; }
#endP { margin: 22px auto 0; max-width: 1300px; font-size: 30px; line-height: 1.45; color: rgba(244,242,247,0.8); }
#endU { display: inline-block; margin-top: 36px; padding: 14px 32px; border-radius: 999px; border: 2px solid rgba(141,243,214,0.6); font-size: 30px; font-weight: 600; color: #fff; }
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="64" data-width="1920" data-height="1080">
''' + filt + '''
<div id="stage"><div id="cam">
''' + scenes + '''
<div id="clickring"></div>
<svg id="cursor" viewBox="0 0 24 24"><path d="M4 2.5 L4 19.5 L8.6 15.2 L11.6 21.6 L14.6 20.2 L11.7 14 L18 14 Z" fill="#fff" stroke="#0a0a0f" stroke-width="1.4" stroke-linejoin="round"/></svg>
</div></div>
<div class="ov" id="title" data-layout-allow-overlap><p class="eb" data-layout-allow-overlap>Inside the LensTrybe dashboard</p><h1 data-layout-allow-overlap>One job, <em>start to finish.</em></h1><p data-layout-allow-overlap>Ruby and Sol's wedding, from the first message to a five-star review.</p></div>
<div class="ov" id="cap" data-layout-allow-overlap><span id="capN" data-layout-allow-overlap>1</span><span id="capT" data-layout-allow-overlap></span></div>
<div class="ov" id="tchip" data-layout-allow-overlap><div><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><span id="tchipT" data-layout-allow-overlap></span></div></div>
<div class="ov" id="toast" data-layout-allow-overlap><div><i></i><span id="toastT" data-layout-allow-overlap></span></div></div>
<div class="ov" id="end" data-layout-allow-overlap><img id="endLogo" src="assets/brand/logo-white.svg" alt="LensTrybe" /><h2 id="endH" data-layout-allow-overlap>Every job, <em>start to finish.</em></h2><p id="endP" data-layout-allow-overlap>Enquiry, quote, contract, deposit, calendar, shoot day, gallery, balance and review. One dashboard.</p><span id="endU" data-layout-allow-overlap>lenstrybe.com</span></div>
''' + audio + '''
</div>
<script>
window.GEO = ''' + json.dumps(geo) + ''';
''' + tljs + '''
</script>
</body>
</html>
'''
out = os.path.join(H, '..', 'composition', 'index.html')
open(out, 'w').write(page)
page = page.replace('id="rH2"', 'id="rH2" data-layout-allow-overflow')
open(out, 'w').write(page)
print('wrote', out, len(page) // 1024, 'KB; duplicate ids renamed:', sorted(k for k, v in count.items() if v > 1)[:12])
