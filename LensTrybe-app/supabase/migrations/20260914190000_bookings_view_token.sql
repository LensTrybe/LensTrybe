-- A per booking secret so the Add to calendar link in a client's email can serve that one
-- event without a login. The same shape invoices and quotes already use, rather than
-- putting the booking's own id in a URL.
alter table public.bookings
  add column if not exists view_token uuid not null default gen_random_uuid();

create unique index if not exists bookings_view_token_idx
  on public.bookings (view_token);

comment on column public.bookings.view_token is
  'Secret in the Add to calendar link sent to the client. Serves this booking as a calendar file, nothing else.';
