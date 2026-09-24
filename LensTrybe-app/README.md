# LensTrybe Next

The next LensTrybe, as a local preview. A separate codebase from the live site: nothing in this folder
touches lenstrybe.com or the live database. Demo mode only, with sample data throughout.

## Run it

Double-click **Start LensTrybe Next.command**. The first run installs dependencies, then the site
opens at http://localhost:5180. Press Ctrl+C in the terminal window to stop it.

Or from a terminal in this folder:

    npm install
    npm run dev

## What is in it

Public site: home (the living lens, the ask, the constellation of matches, the in-place booking panel,
the two-screen synced booking, the micro-demo tiles, Lumi's queue, the calculator, pricing, founding),
Find a creative with filters and a map view, creative profiles with enquiry, pricing with comparison,
founding programme with code redemption, join, log in, upcoming features, support, legal shells.

Workspace at /app: Today, threads and thread detail, bookings, money, deliver, clients, profile and site,
Lumi with autonomy dials, the command bar (try: "invoice Coastline", "block 3 Dec", "how did August go",
Cmd+K) and the Lumi dock. Light by default, dark on the moon button.

Client portal at /portal/harper-leo: the same thread from the client's side, no login.

Onboarding at /onboarding: founding code to live profile.

## Stack

Vite, React 19, react-router 7. The same stack as the live site so real code can be ported across
feature by feature. No backend, no supabase-js yet. Phase two connects it, ideally through a Supabase
branch so the live database stays untouched.

## Where things live

    src/styles/      tokens, base, glass, public, pages, workspace
    src/lib/         lens shader, canvas stills, specular hook, reveal hook
    src/components/  Aurora, Still, Logo, Icon, Toast, Cursor, RefractFilter
    src/data/        sample creatives and workspace data (all invented)
    src/pages/public/      the public site
    src/pages/app/         the workspace
    src/pages/portal/      the client portal
    src/pages/onboarding/  onboarding

## Notes

Photography is synthetic (drawn on canvas) until a real shot library exists. The brand's fixed points
are kept: Inter, green #1DB954, hot pink #FF2D78, brand black, the locked logo files in /public,
Australian English, no em dashes. The public hero is dark on purpose, which the September 2026 brand
guide does not allow; that is a deliberate proposal, not an oversight.
