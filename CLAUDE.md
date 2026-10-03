# LensTrybe Next: read this first

This repo is **the live LensTrybe website**: lenstrybe.com, hq.lenstrybe.com and the signed-in
workspace. The app is in `LensTrybe-app/`.

## This file wins

Older instructions describe the **previous app** (Vercel project `lens-trybe`, app.lenstrybe.com,
the "LensTrybe Website" folder, branch `main`). Wherever a project instruction, skill, memory,
brief or doc disagrees with this file on any of the points below, **follow this file**:

- Repo and deploy: this folder, branch **`next`**, Vercel project **`lenstrybe-next`**
  (`prj_9W6QUZJ8ry48LOkZp1a4h4MSkCKq`). Production deploys when Michael runs
  `git push origin next`. Never tell him to push `main`.
- Styling: CSS variables from `src/styles/tokens.css`, shared classes from `base.css`,
  `glass.css` and `public.css`, page styles scoped under `.pub` in `src/styles/pages.css`
  (workspace styles in `workspace.css`). Small one-off inline styles are fine. The old rule
  "inline styles only, no CSS files" and the old `--lt-*` / `glassTokens` / `DashboardLayout`
  token systems belong to the previous app and do not apply here.
- Brand: **the live website is the brand kit.** The full written record is
  [`docs/brand-kit.md`](docs/brand-kit.md). Read it before any design or copy work. The
  September 2026 brand guidelines PDF, the pastel tile mosaic, the "public site is light only"
  rule, the old carousel look and `#39ff14` are retired.
- Plan names in copy: Trybe Free, Trybe Essential ($24.99), Trybe Complete ($74.99), Trybe
  Studio ($149.99, the top plan). Basic, Pro, Expert and Elite survive only as internal
  database values.

## Brand in brief (details in docs/brand-kit.md)

- Every public page: a **dark opener** (`.dark`, `#07070b`) with the living lens
  (`src/lib/lens.js`) behind a white headline, then the **light body** (`.lt`, `#f6f5f3`) under
  the aurora, with **liquid glass** (`.lg`) cards. No hard dividers.
- **Inter** for everything. **Instrument Serif italic** (`var(--serif)`, in `<em>`) for one
  accent phrase at the end of a headline: the gradient `#9AC4C5 → #D996BA → #C6A5E5` on dark,
  muted ink on light. Never a whole heading or body text in serif.
- Green `#1DB954` with `#04120a` text on green, pink `#FF2D78`, neon `#8DF3D6`. Coloured text
  uses the contrast-safe tokens (`--green-t` and friends). No new tokens, no Tailwind, no
  hard-coded hex where a token exists.
- Buttons are the `.btn` pills. Emails use the shared shell in
  `supabase/functions/_email/email.ts`.
- Match existing pages (/, /pricing, /how-it-works, /founding, /edit) rather than inventing a
  new look. Check desktop and 390px wide, light and dark in the workspace.

## Words

- Never use em dashes. Australian English. Sentence case headings and buttons ("Join as a
  creative", "Find a creative").
- "No commission, ever." Never "free trial" (any paid plan is free for the first three
  months), never "vetted", never "app" for the platform in marketing.
- Photographers and videographers only can join for now.
- LensTrybe speaks as LensTrybe; Michael's first name only on founding invites.

## How we work

- Michael tests; Claude builds. Replace whole files, never hand him line edits. Never define a
  component inside another component's render function. One step at a time, tested between.
- Supabase project `lqafxisymvrazipaozfk`: run migrations and deploy Edge Functions live, and
  keep the repo copy identical to what is deployed. Secrets live in Supabase, never in code.
- Michael commits and pushes. Give him the commands one per code box:
  `cd "/Users/michaelmanoli/Documents/LensTrybe Next/LensTrybe-app"`, then
  `git add -A && git commit -m "..."`, then `git push origin next`.
- Keep Notion (LensTrybe HQ, `33a6feaf-ab29-819b-9c03-d7aeb549d46c`) updated with what shipped.
