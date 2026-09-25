# Parity checklist: live site → LensTrybe Next

Every route and every edge function on the live site, with its home in Next and where the port is up to. Ticked as each one runs on real data through the real backend. Nothing on the live site is rebuilt; it is wired.

Status: `design` = screen exists on the sample store · `wired` = runs on the live project · `verified` = run through with the test accounts · `n/a` = deliberately not carried over (say why).

## Public routes

| Live route | Next route | Status | Notes |
|---|---|---|---|
| `/` | `/` | design | Ask hero. Live: `search-creatives` function (new) over `profiles` + availability |
| `/creatives` | `/creatives` | design | Directory on `profiles`, `get_public_portfolio_items`, `creative_unavailable_dates` |
| `/creatives/:id` | `/creatives/:id` | design | Profile / website (`website_is_live`, `site_pages`, `portfolio_*`, `reviews`) |
| `/pricing` | `/pricing` | design | Plan table from `tierFeatures.js` (ported) |
| `/support` | `/support` | design | `submit-support-ticket` |
| `/upcoming-features` | `/upcoming` | design | `feature_requests` |
| `/creator-partners` | — | n/a | Live redirects to `/`; `creator-partner-apply` stays available for the form on Founding if wanted |
| `/join`, `/join/creative`, `/signup` | `/join`, `/join/creative`, `/signup` | design | `supabase.auth.signUp`, `founding-code`, `moderate-content`, `send-welcome-email` |
| `/join/client` | `/join/client` | design | `signUp` + `client_accounts` insert |
| `/login` | `/login` | design | password, magic link, Google OAuth (`LT_GOOGLE_OAUTH_PENDING_KEY`) |
| `/forgot-password`, `/reset-password` | same | design | `resetPasswordForEmail`, `verifyOtp(token_hash)`, `updateUser` |
| `/check-email` | `/check-email` | design | `auth.resend` |
| `/onboarding` | `/onboarding` | design | Plan pick → `sync-profile`, `create-revolut-order` (card setup), `founding_terms_acceptances` |
| `/terms`, `/privacy`, `/cookies`, `/refunds`, `/founding-agreement` | `/legal/:doc` | design | Same content source as live; old URLs redirect |
| `/founding` | `/founding` | design | `founding_places_used`, `founding-apply` |
| `/unsubscribe`, `/unsubscribe/:token` | same | design | `email-preferences` |
| `/the-trybe-edit`, `/the-trybe-edit/issue-01` | `/edit`, `/edit/:slug` | design | `newsletter_issues`; old URLs redirect |
| `/waitlist` | `/waitlist` | design | `waitlist-signup`, `waitlist_stats`; area gate in `middleware.js` |
| `/jobs` | `/jobs`, `/jobs/:id` | design | `job_listings`, `job_applications`; client page needs a token link |
| `/check-email` | `/check-email` | design | |
| `/booking-unavailable` | — | pending | Needed by the booking flow when a date is gone |
| `*` (404) | `*` → `/` | pending | A real 404 page |

## Client and token pages

| Live route | Next route | Status | Notes |
|---|---|---|---|
| `/client-dashboard` | `/portal` (client home) | pending | `my_client_bookings`, `link_my_client_threads` |
| `/portal/:token` | `/portal/:token` | live | `portal_load_v2`, `portal_send_message_v2` (attachments), `portal_thread_messages`, `respond-quote`, `message-attachments` (new: private uploads + signed links, both sides) |
| `/sign/:token` | inside the thread | design | `contract_for_signing`, `sign_contract`, `notify-contract-signed` |
| `/meeting/:token` | inside the thread | design | `meeting-respond` |
| `/deliver/:token` | inside the thread | design | `deliver`, `delivery_events` |
| `/doc/:type/:token` | inside the thread | design | `document-pdf` |
| `/portfolio/:id` | `/creatives/:id` | design | |
| `/site/:slug` | `/creatives/:id` (Expert/Elite) | design | `website_is_live` |
| `/team/accept/:token` | pending | pending | `join-team` |
| `/review/:slug` (Next only) | `/review/:slug` | design | `notify-review`, `send-review-request` |
| `/brand/:slug` (Next only) | `/brand/:slug` | design | `brand_kit` |

## Workspace (live `/dashboard/...` → Next `/app/...`)

| Live | Next | Status | Notes |
|---|---|---|---|
| `/dashboard` | `today` | design | |
| `clients/messages` | `threads`, `thread/:id` | live | `my_threads`, `message_threads`, `messages` (+ `attachments`), `send-message-notification`, `message-attachments` |
| `my-work/my-bookings` | `bookings` | design | `bookings` function, `calendar_events`, `calendar-feed` |
| `projects`, `projects/:id` | `projects`, `project/:id` | design | `projects`, `pipeline_stages`, `project_checklists`, `creative_tasks` |
| `inventory` | `inventory` | design | `inventory_*` |
| `notes` | `notes` | design | `notes` |
| `content/calendar`, `content/ideas` | `content-calendar`, `content-ideas` | design | `content_posts`, `content_ideas`, `content_stages` |
| `clients/meetings` | `meetings` | design | `meetings`, `request-meeting`, `send-meeting`, `meeting-notify` |
| `clients/contacts` | `clients` | design | `contacts` |
| `clients/crm` | `crm` | design | `crm_contacts` (tier gated) |
| `finance/overview` | `money` | design | |
| `finance/invoicing` | `invoicing` | design | `invoices`, `send-invoice`, `document-pdf` |
| `finance/quotes` | `quotes` | design | `quotes`, `send-quote`, `respond-quote` |
| `finance/contracts` | `contracts` | design | `contracts`, `uploaded_contracts`, `send-contract`, `contract-file` |
| `finance/expenses` | `expenses` | design | `expenses` |
| `finance/tax` | `tax` | design | `finance_settings`, `financial_goals` |
| `portfolio-design/brand-kit` | `brand-kit` | design | `brand_kit`, `brand-kit` / `brand-logos` buckets |
| `portfolio-design/deliver` | `deliver` | design | `deliveries`, `send-delivery`, `deliveries` bucket |
| `portfolio-design/portfolio-website` | `website` | design | `site_pages`, `portfolio_website_*` |
| `business/insights` | `insights` | design | needs `enquiries` + `views` tables (new), `search_impressions`, `profile_views` |
| `business/reviews` | `reviews` | design | `reviews`, `review_contacts` |
| `business/marketplace` | `marketplace` | design | `marketplace_listings`, `gear_listings`, `saved_listings` |
| `collaborate` | `collaborate` | design | `collaborations`, `collaboration_*` |
| `founding` | `founding` | design | `founding_status_all`, `founding_feedback` |
| `business/team` | `team` | design | `team_members`, `team_invitations`, `invite-team-member` |
| `my-work/availability` | `availability` | design | `availability`, `availability_slots`, `creative_busy_times` |
| `my-work/jobs` | `jobs` | design | `job_listings`, `job_applications` |
| `profile/edit-profile` | `profile` | design | `profiles`, `profile_private`, `sync-profile`, `moderate-content`, `avatars` / `portfolio` buckets |
| `profile/view-profile` | `view-profile` | design | |
| `settings/subscription` | `subscription` | design | `subscriptions`, `change-subscription`, `update-payment-method`, `cancel-revolut-subscription` |
| `settings` | `settings` | design | `updateUser`, `email-preferences`, `export-account-data`, `delete-account`, `account_deletions` |
| `support` | `support` | design | `submit-support-ticket`, `support_tickets` |
| `referrals` | `referrals` | design | `generate-referral-code`, `validate-referral-code`, `referrals` |
| `lumi` | `lumi` | design | `lumi-chat`, `lumi_usage`, `lumi_conversations` |
| `admin` | pending | pending | `admin-users`, `admin_revenue_summary`, `broadcasts` |

## Edge functions (67 deployed)

| Function | Used by (Next) | Status |
|---|---|---|
| `bookings`, `send-booking-update`, `booking-nudges` (cron) | Bookings, thread | pending |
| `calendar-feed` | Availability (.ics subscribe) | pending |
| `create-revolut-order`, `revolut-webhook`, `revolut-charge-due` (cron), `cancel-revolut-subscription`, `update-payment-method`, `change-subscription`, `billing-reminders` (cron), `send-billing-email` | Onboarding, Subscription | pending |
| `create-checkout-session`, `stripe-webhook`, `create-stripe-portal`, `cancel-subscription`, `create-founding-checkout` | legacy Stripe fallback | n/a unless Stripe is revived |
| `send-invoice`, `send-quote`, `send-contract`, `respond-quote`, `document-pdf`, `notify-contract-signed`, `contract-file` | Money, thread | pending |
| `deliver`, `send-delivery`, `deliver-expiry-reminders` (cron) | Deliver, thread | pending |
| `receive-enquiry`, `send-enquiry`, `site-enquiry`, `send-reply-notification`, `send-message-notification`, `send-portal-link`, `enquiry-nudges` (cron) | Ask, profile, thread | pending |
| `request-meeting`, `send-meeting`, `meeting-respond`, `meeting-notify` | Meetings, thread | pending |
| `send-welcome-email`, `sync-profile`, `delete-account`, `export-account-data`, `purge-deleted-accounts` (cron), `email-preferences`, `admin-users` | Join, Settings, Admin | pending |
| `invite-team-member`, `join-team` | Team | pending |
| `founding-code`, `founding-apply`, `founding-check` (cron), `founding-invites` (cron), `waitlist-signup`, `creator-partner-apply`, `create-partner-codes`, `generate-referral-code`, `validate-referral-code`, `send-event-invite`, `broadcasts` | Founding, Waitlist, Referrals, Admin | pending |
| `poster-image` | Profile posters | pending |
| `notify-review`, `send-review-request`, `submit-support-ticket` | Reviews, Support | pending |
| `lumi-chat`, `moderate-content` | Lumi, every input the live site moderates | pending |
| `config-check` | ops only | n/a |
| `revolut-probe`, `revolut-webhook-check`, `resend-domains-setup` | retired (410) | n/a |

## New backend pieces Next needs (additive, old site keeps working)

- `search-creatives` function for the ask bar (hard filters in SQL, fit score in the function, sentence from `lumi-chat`).
- `threads` table linking bookings, quotes, contracts, invoices, messages, deliveries per client; backfilled from existing bookings.
- `enquiries` and daily `views` tables for Insights.
- Token link for the client's job page; job alerts as a nightly function.
- Waitlist rows carry the area (`region`) so each state's list can be opened separately.
