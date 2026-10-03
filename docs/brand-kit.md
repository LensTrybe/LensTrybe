# LensTrybe brand kit

**The live website is the brand kit.** lenstrybe.com, as built in the LensTrybe Next repo (`LensTrybe Next/LensTrybe-app`), is the final, approved look. This document is a written record of it, taken from the code on 4 October 2026. Where this document and the code disagree, the code wins and this document gets corrected.

The files that own the brand:

| What | Where |
|---|---|
| Colours, surfaces, fonts | `src/styles/tokens.css` |
| Buttons, chips, eyebrows, status pills, aurora, motion | `src/styles/base.css` |
| Liquid glass | `src/styles/glass.css` |
| Public pages (hero, sections, cards, nav, footer) | `src/styles/public.css` |
| The living lens (hero artwork) | `src/lib/lens.js` |
| Logos | `LensTrybe Main/Branding/logo/` (same artwork as the site's `public/logo-on-dark.svg`) |
| Approved marketing reference build | `LensTrybe Main/Branding/meta-ads/v2/_build/ad.html` (the Founding 100 Meta ads, Oct 2026) |
| Plans and prices | `src/data/edit.js` and `src/pages/public/Pricing.jsx` |
| Founding offer wording | `src/pages/public/Founding.jsx` |
| Email look | `supabase/functions/_email/email.ts` |

---

## 1. Identity

- **Name:** LensTrybe. One word, capital L, capital T.
- **Tagline:** Connect. Capture. Create.
- **Website:** lenstrybe.com. Always this, never app.lenstrybe.com.
- **What it is:** a no-commission platform and marketplace for Australian photographers and videographers. A flat monthly plan, never a cut of the work, and the whole business in one place: a page clients can find, enquiries, quotes, invoices, contracts, bookings and gallery delivery.
- **Speaks as:** LensTrybe. Michael's first name appears only on founding invites and the founding page ("Michael reads every one of these himself"). Never his full name.

## 2. The look in one line

**A dark opener with the living lens, then a light body washed in a soft aurora, with liquid glass cards, Inter headlines and one italic serif accent phrase.**

Every public page follows the same rhythm:

1. **Dark opener** (`.dark` surface, `#07070b`). The living lens fills it: a WebGL ring that shifts mint to rose to lilac, a refractive glass centre, two faint room tints (green top left, pink bottom right), a vignette and film grain. It reacts to the pointer. The headline sits over it in white.
2. **Light body** (`.lt`, `#f6f5f3`) under a fixed **aurora**: large blurred washes of mint `#9fd6cb`, pink `#f3b3cf`, lilac `#c9b3ee`, green `#addfbf` and peach `#f5c7ab`. A 260px fade from `#07070b` to clear at the top of the light body blends it into the dark opener above, with no hard divider.
3. **Liquid glass** panels and cards float over the aurora.

Marketing assets (ads, social, carousels, video) use the **dark opener** look: `#07070b`, the lens, white headline, gradient serif accent, glass cards, a white pill button.

## 3. Colour

### Brand colours

| Name | Hex | Use |
|---|---|---|
| Green | `#1DB954` | Primary buttons, success, focus rings, selection, live dots |
| Text on green | `#04120a` | Any text sitting on a green fill. Never white on green |
| Pink | `#FF2D78` | Accents, "late" and warning states, room tint in the lens |
| Brand black | `#0a0a0f` | Text on white pills, logo ground, emails |
| Night | `#07070b` | The dark opener background, hero and marketing artwork |

### The lens trio (the logo ring and the accent gradient)

| Name | Hex |
|---|---|
| Mint | `#9AC4C5` |
| Rose | `#D996BA` |
| Lilac | `#C6A5E5` |

The accent gradient is `linear-gradient(90deg, #9AC4C5, #D996BA 50%, #C6A5E5)`. It fills the serif accent word on dark, and runs round the logo ring.

### Neon (light on dark)

| Name | Hex | Use |
|---|---|---|
| Neon | `#8DF3D6` | Live dots, the active nav dot, tick circles, toast dot (with a soft glow) |
| Neon text | `#A9F5DF` | Eyebrows and highlighted numbers on dark artwork |

### Surfaces and text

| | Light surface | Dark surface |
|---|---|---|
| Background | `#f6f5f3` | `#07070b` |
| Raised background | `#ffffff` | `#0d0d14` |
| Ink (main text) | `#14111a` | `#f4f2f7` |
| Ink 2 (secondary) | `#5B5766` | `#f4f2f7` at 62% |
| Ink 3 (muted, eyebrows) | `#8b8a9a` | `#f4f2f7` at 42% |
| Lines | `#14111a` at 9% and 16% | white at 9% and 16% |

### Coloured text (contrast-safe versions)

Brand green and pink fail contrast as text on the light background, so coloured **text** uses these:

| | On light | On dark |
|---|---|---|
| Green text | `#0E7C3A` | `#7cf0a5` |
| Pink text | `#c11f5a` | `#ff9dc2` |
| Amber text | `#9A5B00` | `#ffcf6b` |
| Blue text | `#1b5fb3` | `#8cc2ff` |

Status colours for fills and tints: blue `#4A9EFF` (sent, new), amber `#f59e0b` (viewed), green (paid, done), pink (late, declined). Status pills are 99px rounded, 10.5px, weight 700, uppercase, on a 14 to 18% tint of the colour.

## 4. Type

- **Inter** for everything: headings, body, UI, buttons. Variable weight, loaded as `Inter:opsz,wght@14..32,100..900`.
- **Instrument Serif, italic, weight 400**: only for the **accent phrase**, the last words of a headline, in `<em>`. Loaded as `Instrument Serif:ital@1`.
  - On dark: filled with the mint, rose, lilac gradient (`background-clip: text`).
  - On light sections: the same serif italic in a muted ink colour (Ink 2 or Ink 3), not a gradient.
  - One accent phrase per headline, always at the end, usually two or three words with the full stop inside: "100 founding places. *Be one.*", "Keep 100% of *every job.*", "Pays for itself with *one booking.*", "The first hundred creatives *on LensTrybe.*", "Short answers, *no asterisks.*"
- **Hero headline (h1):** Inter 600, `clamp(40px, 7vw, 104px)`, letter spacing `-0.045em`, line height 1, white on the dark opener with a soft shadow. Written as two lines; each line rises into place on load.
- **Section headline (h2):** Inter 500, `clamp(34px, 5vw, 72px)`, letter spacing `-0.04em`.
- **All headings:** letter spacing about `-0.03em`, line height about 1.05, balanced wrapping, sentence case.
- **Eyebrow** above a headline: 11.5px, weight 600, letter spacing `0.16em`, uppercase, Ink 3 by default, or green text, pink text, or neon on dark artwork.
- **Body:** 16px, line height 1.55. Lede: 15 to 18px in Ink 2, max about 52 characters per line in the hero.
- Numbers in tables and prices: tabular figures.

## 5. Components

- **Buttons are pills.** Fully rounded, 44px tall (34 small, 52 large), weight 600, 14px. They lift 1px on hover with a springy ease.
  - Primary: green fill, `#04120a` text.
  - On dark: white pill with `#0a0a0f` text, turning green on hover.
  - On light: ink pill (`#14111a` with light text), or a ghost glass pill (translucent white, thin line, ink text).
- **Liquid glass card** (`.lg`): a diagonal white tint gradient, a 1px bright rim, inset highlights top and sides, a soft long shadow, `backdrop-filter: blur(10px) saturate(160%)`, a sheen across the top left, and a specular highlight that follows the pointer. Radius 24 to 30px. On dark the tint drops to about 13% white with a 22% white rim.
- **Content card** on light: 24px radius, translucent white, white rim, soft blue-grey shadow.
- **Chips:** pills, thin line, 12.5px; the selected chip is ink with light text.
- **The lens dot** (`.lm`): a small circle with a conic gradient of green, pink and lilac and a faint green glow. Used beside card titles and as a tiny mark.
- **Nav:** fixed, a dark-to-clear scrim on the opener that turns light over the body; one glass capsule glides between links, and a neon dot sits under the current page. The logo sits top left with "Connect. Capture. Create." beside it in small type.
- **Toast:** dark rounded panel with a neon dot.
- **Focus:** 2px green outline, 3px offset. Text selection: green at 35%.

## 6. Logo

The logo is **Option C, editorial caps, locked 15 September 2026**: the lens mark (the mint, rose and lilac ring with a glass centre) and the LENSTRYBE wordmark. It is the logo on the live site.

- Files: `LensTrybe Main/Branding/logo/` in `svg/`, `png/` and `favicon/`. Lockups: horizontal (default), stacked (narrow and square spaces), mark (only where LensTrybe is already named, or as an avatar or app icon).
- Pick the treatment by background, never by recolouring: `-on-dark`, `-on-light`, `-mono-ink`, `-mono-white`. The one-colour files are for print, embossing, foil and merchandise, where a gradient cannot work.
- Never stretch, rotate, recolour, outline, add effects to, or retype the logo. The mark and wordmark travel together, except the mark alone in the cases above.
- Never ask an image generator to draw the logo. The real file goes on in the edit.
- Emails carry the logo inside the lens band image at the top of every email (see section 10). Never a typed wordmark in an email.

## 7. Motion

- Ease: `cubic-bezier(.2, .75, .15, 1)`. Spring for buttons: `cubic-bezier(.34, 1.4, .4, 1)`.
- Headlines rise line by line (each line masked from above so descenders never clip). Sections fade up as they scroll in.
- The lens drifts slowly and leans toward the pointer. Nothing flashes or bounces.
- Everything respects reduced motion.

## 8. Marketing assets (ads, social, carousels, video)

Build them like the dark opener, as in the approved Founding 100 ads (`meta-ads/v2/_build/ad.html`):

- Background `#07070b` with the living lens (render `lens.js` or use a frame of it), optionally a left-to-right dark shade behind the text for legibility.
- Eyebrow in neon text `#A9F5DF`, uppercase, wide tracking.
- Headline in Inter 600, white, tight tracking, two lines, with the serif italic accent phrase in the mint, rose, lilac gradient.
- Supporting line in white at about 76%.
- Facts in dark liquid glass cards; ticks in neon circles; prices in neon text.
- Call to action as a white pill, or a closing frame with the stacked logo above one line of instruction, such as "Ask for a founding code at lenstrybe.com/founding".
- Real logo files only (`-on-dark` versions). Real product screens only from preview mode, never real client data.
- Formats: 1080 x 1350 (feed), 1080 x 1920 (Stories, Reels, TikTok). In 9:16 keep text out of the top 270px and bottom 380px.
- Photography and imagery: dark, cinematic, documentary, real Australian photographers and videographers at work. Lit to sit in the lens palette: mint, rose and lilac light with green and pink as small accents. No stock feel, no text or logos baked into generated images.

## 9. Words

- Never use em dashes. Commas, colons, or rewrite.
- Australian English: colour, organise, licence (noun), practise (verb). Australian dollars, GST included.
- Sentence case headings. Short, direct, warm, a little playful. No corporate speak.
- **Plans (public names):** Trybe Free (free), Trybe Essential ($24.99 a month), Trybe Complete ($74.99 a month), Trybe Studio ($149.99 a month). Annual is ten months for twelve. Trybe Studio is the top plan.
- **Offer:** any paid plan is free for the first three months. There is no free trial; never say "free trial". Clients use LensTrybe free, always.
- **Founding:** the first 100 creatives who redeem a founding code get Trybe Complete free for twelve months, then $49 a month for life, plus the permanent Founding Creative badge. After the first 100: six months free, the same $49 for life, no badge. Never promise the twelve months or the badge to everyone.
- **Who can join:** photographers and videographers only for now. Other disciplines can be named as coming later, never as able to join now.
- Never say "vetted". Never name or compare other platforms in marketing. Call it a platform or marketplace, not an app.
- Key lines: No commission, ever. Keep 100% of every job. One login, not five apps. Connect. Capture. Create.

## 10. Exceptions

- **Client documents** (invoices, quotes, contracts) are white pages in the creative's own brand colour, because they print and become the client's PDF.
- **Creatives' own pages and sites** use the creative's brand kit, not LensTrybe's.
- **The workspace** (signed in) uses the same tokens: light by default, dark when toggled (`:root[data-t="dark"]`).
- **Emails** are built on one shared shell, `supabase/functions/_email/email.ts`: the lens band image with the logo across the top (`email-band.jpg`), a dark page `#0a0a0f`, a `#14141c` card, a small uppercase eyebrow, a white heading, body text `#c9c9d4`, a green pill button with `#04120a` text, Inter with system fallbacks. Sent from `LensTrybe <noreply@mail.lenstrybe.com>`, reply-to `connect@lenstrybe.com`. Change the shell, not individual emails.

## 11. Retired, do not use

Kept short on purpose, so nothing old creeps back:

- The September 2026 brand guidelines PDF and anything built from it.
- The old public site look: the pastel tile mosaic, `PublicPageShell`, `glassTokensLight`, `LiquidPill`, and the "public site is light only" rule.
- The old carousel look: flat `#12111a` panels, noise overlay, ghost watermark text, Inter 800 to 900 headlines, left accent bars, green and pink glow blobs.
- Fonts other than Inter and Instrument Serif italic (no Bebas Neue, Space Grotesk, DM Sans or Playfair Display).
- Neon green `#39ff14`.
- Basic, Pro, Expert and Elite as public plan names (they survive only as internal database values).

## Known gaps on the site (fix in code, then update this file)

- `Founding.jsx` calls Trybe Complete "the top plan"; Trybe Studio is the top plan.
- `src/data/workspace.js` still uses the old plan names (Basic, Pro, Expert, Elite) in the workspace.
