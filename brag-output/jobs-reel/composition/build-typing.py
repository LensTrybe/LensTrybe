# Builds assets/sfx/typing.wav: one keypress per character, timed to match the on-screen typing.
# The schedule below must match FIELDS in index.html (same text, same start and end times).
import glob, wave
import numpy as np

KEYS = '/Users/michaelmanoli/Documents/Lenstrybe/.claude/skills/brag/assets/sfx/keyboard'
FIELDS = [
    ('Wedding photographer, Maleny', 3.35, 5.0),
    ('Maleny, QLD', 5.45, 6.1),
    ('14/11/2026', 6.6, 7.3),
    ('3500', 8.15, 8.5),
    ('Full day', 8.85, 9.35),
    ('Garden ceremony at 3pm, about 80 guests. Relaxed, natural photos, not too posed.', 9.75, 12.55),
    ('Harper Ellis', 13.95, 14.55),
    ('harper@email.com', 14.8, 15.6),
]
SR, DUR = 44100, 31.0

def load(f):
    w = wave.open(f)
    a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    return a

keys = [load(f) for f in sorted(glob.glob(KEYS + '/keypress-*.wav'))]
out = np.zeros(int(SR * DUR) + SR, dtype=np.float32)
k = 0
for text, t0, t1 in FIELDS:
    n = len(text)
    for i, ch in enumerate(text):
        t = t0 + (i + 0.5) / n * (t1 - t0)
        s = keys[(k * 7 + 3) % len(keys)]; k += 1
        g = 0.55 if ch == ' ' else (0.85 if k % 3 else 0.7)
        p = int(t * SR); out[p:p + len(s)] += s * g
out = out[:int(SR * DUR)]
peak = np.max(np.abs(out)) or 1
out = out / peak * 0.8
w = wave.open('assets/sfx/typing.wav', 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((out * 32767).astype(np.int16).tobytes()); w.close()
print('typing.wav', len(out) / SR, 's,', k, 'keys')
