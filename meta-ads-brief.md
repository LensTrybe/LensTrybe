# Brief: Meta ads for the Founding 100 campaign

Make the images and short videos for LensTrybe's first Meta (Facebook and Instagram) ad campaign. The campaign is already set up in Ads Manager as a draft; only the creative is missing.

## The most important rule: match the new website

The ads must look like **lenstrybe.com as it is now**, not the old brand kit.

- Take the look from this repo (LensTrybe Next / LensTrybe-app): the animated lens in `src/lib/lens.js` (used in the dark page openers), the styles in `src/styles/`, and the Home, Founding and How it works pages in `src/pages/public/`. Open lenstrybe.com in a browser and match it.
- That means the dark hero with the glowing lens ring, Inter for type with the italic serif accent word the site uses on some headings (like "find *them*" and "*your date.*"), and the light glass sections where they suit.
- **Do not** reuse the old carousel style, the old Branding/Brandkit files, or anything in neon green `#39ff14`. Brand green is `#1DB954`, pink `#FF2D78`, dark `#0a0a0f`, text on green `#04120a`.
- Use the real logo files in `LensTrybe Main/Branding/logo/` (on-dark versions on dark backgrounds). Never redraw or retype the logo.
- Real screens of the product are welcome (a profile page, a quote, gallery delivery). Use the demo/preview mode (for example `/app/today?preview`) so **no real user's data or client details appear**.

## Who it is for

Photographers and videographers in South East Queensland (Brisbane, Gold Coast, Sunshine Coast, Toowoomba). It recruits them for the Founding 100. Every ad sends people to lenstrybe.com/founding, where they ask for a code.

## Three ads (make each one as a video and as a still)

**A, no commission.** Idea: what a client pays is what you keep. Headline on screen: "Keep 100% of every job." Supporting idea: a flat monthly plan, never a cut of your work.

**B, the Founding 100.** Idea: 100 founding places in South East Queensland. Headline: "100 founding places. Be one." The offer: Trybe Complete free for 12 months, then $49 a month for life (normally $74.99). It must say, at least in small text, that this is for the **first 100 to join** and comes with three simple commitments, with terms at lenstrybe.com/founding.

**C, all in one place.** Idea: one login instead of five apps. Headline: "One login. Not five apps." Show the parts: your own page clients can find, enquiries, quotes and invoices, contracts signed on a phone, gallery delivery.

End every video and still on: the LensTrybe logo and "Ask for a founding code at lenstrybe.com/founding".

## Formats

For each of A, B and C:

- **Video, 9:16:** 1080 x 1920, MP4 (H.264), 30 fps, 6 to 12 seconds, under 30 MB. For Reels and Stories.
- **Video, 4:5:** 1080 x 1350, same specs. For feeds.
- **Still, 4:5:** 1080 x 1350 JPG or PNG.
- **Still, 9:16:** 1080 x 1920 JPG or PNG.

Video rules:

- The headline must be readable in the first 2 seconds. Most people scroll past by then.
- It must work with the sound off. No voiceover needed; text on screen carries it. Optional music must be royalty free.
- Keep motion smooth and premium (the lens animating in, screens sliding in), not busy.
- **Safe zones for 9:16:** keep text and the logo out of the top 270 px and the bottom 380 px, where Instagram puts its own buttons and captions.
- Keep on-image text short. The ad's caption carries the detail.

## Words: rules that must not be broken

- No em dashes anywhere.
- Australian English (colour, organise).
- No "free trial", it does not exist.
- Only photographers and videographers. Do not suggest drone pilots, editors or anyone else can join yet.
- Never promise the 12 months or the founding badge to everyone. It is the first 100 to join.
- No Michael's name on the ads. It is LensTrybe.

## Where to put the files

Save everything to `LensTrybe Main/Branding/meta-ads/v2/`, named like:
`lenstrybe-ad-a-video-9x16.mp4`, `lenstrybe-ad-a-video-4x5.mp4`, `lenstrybe-ad-a-still-4x5.jpg`, `lenstrybe-ad-a-still-9x16.jpg` (and the same for b and c).

Do not commit any of this to the app repo; it is marketing material, not website code. If it helps to build the animations as a small HTML page and record them (for example with Playwright plus ffmpeg), do that in a scratch folder outside `LensTrybe-app/src`.

When done, show Michael a contact sheet of the stills and list the video files, and check every frame against the rules above before handing over.
