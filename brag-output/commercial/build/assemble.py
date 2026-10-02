# Assembles ../composition/index.html: shell.html + the real dashboard scenes (scenes.json, app.css) + timeline.js.
import json, re, os, collections
H = os.path.dirname(os.path.abspath(__file__))
S = json.load(open(os.path.join(H, 'scenes.json')))
css = re.sub(r'@import[^;]*;', '', open(os.path.join(H, 'app.css')).read()).replace('SFMono-Regular, ', '').replace('SFMono-Regular,', '')
ORDER = [('thread', 13.8, 6.5), ('calendar', 19.75, 2.05), ('deliver', 21.25, 2.55), ('reviews', 23.25, 3.05), ('final', 25.7, 7.2)]
count = collections.Counter()
for n, _, _ in ORDER:
    for i in set(re.findall(r'\sid="([^"]+)"', S[n]['html'])): count[i] += 1
def fix(n, h):
    h = re.sub(r'\sid="([^"]+)"', lambda m: ' id="%s--%s"' % (m.group(1), n) if count[m.group(1)] > 1 else m.group(0), h)
    h = re.sub(r'<(div|button|a|span|small|b|em|p|aside)([ >])', lambda m: '<' + m.group(1) + ' data-layout-allow-occlusion' + m.group(2), h) if n == 'final' else h
    return h.replace('src="/logo-on-dark.svg"', 'src="assets/brand/logo-on-dark.svg"').replace('id="rH2"', 'id="rH2" data-layout-allow-overflow')
scenes = ''.join('<div class="clip" id="sc-%s" data-start="%s" data-duration="%s" data-track-index="%d">%s</div>\n' % (n, s, d, i, fix(n, S[n]['html'])) for i, (n, s, d) in enumerate(ORDER))
geo = {n: S[n]['geo'] for n, _, _ in ORDER}
SFX = [
    ('sOpen', 'impactSoft_medium_001.ogg', 0.25, 0.18, 0.45), ('sTitle', 'impactSoft_medium_001.ogg', 2.55, 0.18, 0.4),
    ('cGo', 'click2.ogg', 6.0, 0.055, 0.8), ('dM', 'drop_001.ogg', 6.62, 0.11, 0.55), ('dR', 'drop_002.ogg', 7.0, 0.19, 0.35),
    ('wPh', 'impactSoft_medium_001.ogg', 9.3, 0.18, 0.4),
    ('t1', 'click_003.ogg', 10.85, 0.01, 0.9), ('x1', 'select_008.ogg', 10.9, 0.047, 0.7),
    ('sg', 'switch_002.ogg', 11.55, 0.6, 0.25), ('t2', 'click_003.ogg', 12.2, 0.01, 0.9), ('x2', 'select_008.ogg', 12.25, 0.047, 0.7),
    ('t3', 'click_003.ogg', 13.0, 0.01, 0.9), ('b1', 'bong_001.ogg', 13.02, 0.12, 0.65),
    ('wLp', 'impactSoft_medium_001.ogg', 13.9, 0.18, 0.4),
    ('cSend', 'click2.ogg', 15.82, 0.055, 0.8), ('dQ', 'drop_002.ogg', 16.4, 0.19, 0.45),
    ('x3', 'select_008.ogg', 17.47, 0.047, 0.7), ('x4', 'select_008.ogg', 18.55, 0.047, 0.7), ('b2', 'bong_001.ogg', 19.1, 0.12, 0.65),
    ('x5', 'select_008.ogg', 20.19, 0.047, 0.75), ('g1', 'impactGlass_light_001.ogg', 22.9, 0.21, 0.5), ('g2', 'impactGlass_light_001.ogg', 24.01, 0.21, 0.55),
    ('wT', 'impactSoft_medium_001.ogg', 25.9, 0.18, 0.4),
    ('st1', 'click_003.ogg', 27.65, 0.01, 0.8), ('st2', 'click_003.ogg', 27.83, 0.01, 0.8), ('st3', 'click_003.ogg', 28.01, 0.01, 0.8), ('st4', 'click_003.ogg', 28.19, 0.01, 0.8), ('st5', 'click_003.ogg', 28.37, 0.01, 0.8),
    ('pk', 'switch_002.ogg', 29.3, 0.6, 0.3), ('dp', 'drop_001.ogg', 30.3, 0.11, 0.55), ('bell', 'impactBell_heavy_000.ogg', 30.35, 1.48, 0.32),
    ('sEnd', 'impactSoft_medium_001.ogg', 32.75, 0.18, 0.5),
]
audio = '<audio id="bgm" data-timeline-role="music" src="assets/music/happy-beats-business-moves-vol-10-by-ende-dot-app.mp3" data-start="0" data-duration="38" data-track-index="10" data-volume="0.3"></audio>\n'
audio += '<audio id="typing" src="assets/sfx/typing.wav" data-start="0" data-duration="38" data-track-index="11" data-volume="0.6"></audio>\n'
audio += '\n'.join('<audio id="%s" src="assets/sfx/%s" data-start="%s" data-duration="%s" data-track-index="%d" data-volume="%s"></audio>' % (i, f, s, d, 20 + k % 6, v) for k, (i, f, s, d, v) in enumerate(SFX))
page = open(os.path.join(H, 'shell.html')).read()
page = page.replace('{{APPCSS}}', css).replace('{{FILTER}}', S['thread']['filt']).replace('{{SCENES}}', scenes).replace('{{AUDIO}}', audio).replace('{{GEO}}', json.dumps(geo)).replace('{{TIMELINE}}', open(os.path.join(H, 'timeline.js')).read())
out = os.path.join(H, '..', 'composition', 'index.html'); open(out, 'w').write(page)
print('wrote', len(page) // 1024, 'KB')
