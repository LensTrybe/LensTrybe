# Hyperframes Composition Brief: LensTrybe Next

## Objective
Create a short cinematic launch video introducing LensTrybe Next.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 22s

## Source Material
- Project root: `/Users/michaelmanoli/Documents/LensTrybe Next/LensTrybe-app`
- Primary files read: README.md, PARITY.md, index.html, src/styles/tokens.css, src/styles/public.css, src/pages/public/Ask.jsx, Sections.jsx, SyncDemo.jsx, src/pages/app/CommandBar.jsx, Lumi.jsx, src/lib/lens.js, src/lib/stills.js, src/data/creatives.js
- Product name: LensTrybe
- Tagline / strongest claim: "Tell us what you need. We'll find them." / "No commissions, ever."
- Key UI to recreate: the living lens shader, the glass ask bar, the orb constellation with fit badges and Lumi's answer line, the two-screen SyncDemo
- Copy that must appear verbatim:
  - Tell us what you need. We'll find them.
  - A wedding photographer in Noosa on 14 November, around $3,000
  - Find them
  - Closest fit · 96% / Free on the date
  - Same thread, same second
  - Quote #Q-0412 · Full day · $3,200 / Accepted ✓ / Signed ✓ / Paid with Apple Pay ✓
  - No commissions, ever.

## Creative Direction
- Tone preset: cinematic
- Creative direction: the lens wakes up; a quiet premium product film in a dark room
- Interpretation: big type, soft crossfades, slow push-ins, the lens as the recurring character; the beat drop lands on the first keystroke
- Angle: the Next hero's WebGL lens listens to one sentence and the matches bloom around it, then the booking runs on two screens at once
- Hook: black room, the ring breathes, "Tell us what you need. We'll find them."
- Outro / punchline: ring + wordmark + "No commissions, ever."
- Avoid: generic SaaS language, abstract filler, restyling away from the Next dark hero

## Visual Identity
- Background: #07070b with soft green (top left) and pink (bottom right) room tints, as in lens.js
- Text: #f4f2f7, secondary rgba(244,242,247,.62)
- Accent: neon #8DF3D6, green #1DB954, ring mint #9AC4C5 / rose #D996BA / lilac #C6A5E5
- Display font: Inter 600 (local woff2); Instrument Serif italic for emphasis (local woff2)
- Visual references: lens.js shader ported to a seek-driven WebGL canvas; stills.js painter (seeded) for orb photos; logo-white.svg

## Storyboard
Use `brag-plan.md` as the creative contract.
1. The lens wakes — 0–3.0s — ring + two-line headline
2. The ask — 3.0–8.0s — brief types, click Find them, lens thinks, 4 chips
3. The constellation — 8.0–13.0s — six orbs bloom, Mara first, Lumi line types
4. Same thread, same second — 13.0–18.0s — phone + workspace, 4 steps
5. Lockup — 18.0–22.0s — ring, wordmark, "No commissions, ever.", lenstrybe.com

## Audio
- Audio role: cinematic support
- Audio arc: intro hush → beat drops at 3.02 with typing → lift through matches and booking → resolve and fade on the lockup
- Music: `assets/music/happy-beats-business-moves-vol-1-by-ende-dot-app.mp3`, 0.3, fade from 20.6s
- Music cue guidance: `assets/music/cues/happy-beats-business-moves-vol-1-by-ende-dot-app.music-cues.json` (120.19 BPM). Beat-lock 3.02, 13.02, 18.02; beat-grid orbs and sync steps.
- Audio-reactive treatment: subtle; smoothed RMS lifts ring glow/halo in the shader
- SFX: sparse keypress ticks during typing, click on Find them, soft drop on Mara's bloom, switch tick per sync step, bong on Paid, soft impact on lockup
- SFX analysis guidance: `.claude/skills/brag/assets/sfx/sfx-analysis.md`; low-HF-risk files for repeats
