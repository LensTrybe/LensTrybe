# Brag Plan: LensTrybe Next

## What is this app?
The next LensTrybe: a client types one sentence and a living lens finds the right Australian photographer or videographer, then the whole booking (quote, contract, deposit) runs in one shared thread. No commissions, ever.

## The angle
"The lens wakes up." The Next hero is a dark room with the LensTrybe mark rendered as a living WebGL lens (mint, rose and lilac ring, glass centre). The video is that lens doing its job: it listens to one sentence, thinks, and the matches bloom around it as a constellation. Then the same booking plays out on two screens at once. A quiet premium product film, not an ad.

## Hook (first 2-3 seconds)
Black room. The ring of the lens fades up and breathes. "Tell us what you need." rises line by line, then "We'll *find them.*" in the serif italic gradient. The line is the product's own headline and the promise in five words.

## Key moments (the middle)
- The ask bar: "A wedding photographer in Noosa on 14 November, around $3,000" types itself into the glass bar, a cursor taps "Find them", the lens pulses while it thinks, and the brief chips appear: Wedding + Photo · Noosa · 14 November · Around $3,000.
- The constellation: the lens shrinks and six creatives bloom around it on beams of light. Mara Okafor lands first with the neon "Closest fit · 96%" badge and "Free on the date". Lumi's answer types along the bottom.
- One booking, two screens: the client's phone and the creative's workspace side by side, "Same thread, same second". The step rail ticks Quote → Accept → Sign → Deposit; the phone shows Accepted ✓, a signature drawing itself, then "Paid with Apple Pay ✓".

## Outro / punchline
The ring returns on its own, the LensTrybe wordmark settles under it, and "No commissions, ever." holds. lenstrybe.com underneath.

## User flow worth showing
1. Client types a one-sentence brief into the ask bar and taps Find them (Ask.jsx).
2. Matches bloom around the lens with fit scores, availability, and Lumi's typed answer (Ask.jsx orbs + lumi-line).
3. The booking runs in one thread seen from both sides: quote accepted, contract signed on a phone, deposit paid (SyncDemo.jsx).

## Tone
- Preset: cinematic
- Creative direction: the lens wakes up; a quiet, premium product film in a dark room
- Interpretation: fewer, bigger moments with room to breathe; big type; soft crossfades and slow push-ins; the WebGL lens is the recurring character; the music kicks in exactly when the brief starts typing.

## Format: landscape — 1920x1080
## Duration: 22s

## Visual identity (from the project)
- Background: #07070b (dark hero surface)
- Accent: #8DF3D6 neon (fit badges, availability), #1DB954 green, ring gradient mint #9AC4C5 → rose #D996BA → lilac #C6A5E5
- Text: #f4f2f7, secondary rgba(244,242,247,.62)
- Display font: Inter 600, tight tracking; Instrument Serif italic for the emphasis word
- Body font: Inter
- Strongest visual element: the living lens shader (lib/lens.js) and the constellation of orbs

## Share copy (draft)
Tell us what you need. We'll find them. The next LensTrybe: one sentence in, the right photographer or videographer out, and the whole booking in one thread. No commissions, ever.

## Audio direction
- Role: cinematic support
- Music: happy-beats-business-moves-vol-1 (unused so far; the first ~3s are an intro before the beat, which fits the quiet lens hook)
- Music treatment: 0.3 bed, beat drop at 3.02s lines up with the brief starting to type; fade out under the final lockup
- Music cue guidance: preset read (assets/music/cues/…vol-1…). 120.19 BPM, beats every ~0.5s from 3.02s. Strong cues to target: 3.02 (the ask begins), 13.02 (two-screen reveal), 18.02 (outro lockup). Beat-grid windows: orbs 8.52–10.52 (every other beat for names), sync steps 14.02 / 15.02 / 16.02 / 17.02.
- Audio-reactive treatment: subtle; music RMS lifts the lens ring glow and halo, not the text
- SFX posture: sparse, motion-matched, polished
- Audio-coupled moments: key ticks while the brief types, a click on Find them, soft drops as orbs bloom, a bright cue on "Paid", a soft impact on the lockup
- Restraint rule: no stingers over reading-heavy moments, no repeated hit on every orb

## Storyboard

### Scene 1 — The lens wakes — 3.0s
Black room, lens ring fades up centre and breathes. "Tell us what you need." then "We'll find them." rise in two lines (second line serif italic gradient). Sub line: "One sentence. Photographers and videographers across Australia."
Sequential/interaction: headline lines rise one after the other
Audio intent: hush; the track's intro carries it
Audio-coupled idea: none
Music: intro
Transition mood: soft → headline lifts and shrinks, bar arrives

### Scene 2 — The ask — 5.0s (3.0–8.0)
Glass ask bar with the spinning mini-lens. The brief types in character by character. Cursor taps "Find them" (~6.0s). Lens pulses (think). Brief chips land one by one and hold.
Sequential/interaction: typed text + simulated click + 4 chips
Audio intent: the beat arrives with the first keystroke
Audio-coupled idea: keyboard ticks, click on Find them
Transition mood: dramatic → lens shrinks, matches bloom

### Scene 3 — The constellation — 5.0s (8.0–13.0)
Lens shrinks upward; six orbs bloom around it on light beams. Mara Okafor first with "Closest fit · 96%" and "Free on the date", then Lena Hoang, Beck Halloran, Priya Nair, Jono Reyes, Tane Whitfield. Lumi line types at the bottom: "6 match. 5 are free on 14 November, 4 inside your budget. Mara is the closest fit."
Sequential/interaction: orbs bloom one by one (best first), Lumi answer types
Audio intent: lift and air
Audio-coupled idea: one soft drop for Mara, lighter touch for the rest
Transition mood: clean → slide to two screens

### Scene 4 — Same thread, same second — 5.0s (13.0–18.0)
Phone left, workspace right, dashed link between labelled "Same thread, same second". Step rail ticks through Quote, Accept, Sign, Deposit once a second. Phone cards: Quote #Q-0412 $3,200 → Accepted ✓ → signature draws → "Paid with Apple Pay ✓". Desk headline changes in step (Quote #Q-0412 / Contract #C-0412 / Paid $960).
Sequential/interaction: 4 steps on every other beat, 1.0s each (short labels, readable)
Audio intent: momentum
Audio-coupled idea: tick per step, bright cue on Paid
Transition mood: dramatic → lens returns

### Scene 5 — Lockup — 4.0s (18.0–22.0)
Ring returns small and bright, LensTrybe wordmark under it, "No commissions, ever." then "lenstrybe.com".
Sequential/interaction: none
Audio intent: resolve
Audio-coupled idea: soft impact on the lockup, music fades
Music: fade to silence

**Music mood for this video:** cinematic, upbeat underneath
**Audio summary:** quiet intro under the waking lens, the beat drops as the brief types, lifts through the matches and booking, resolves and fades on the logo.
