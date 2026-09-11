-- Broadcast messages from the admin panel.
--
--  * Audience: everyone, all creatives, all clients, one plan (basic/pro/expert/elite) or
--    founding creatives still on the deal. Accounts pending deletion are skipped.
--  * Style: 'banner' (slim bar across the top of the dashboard) or 'card' (a card in the
--    middle of the screen). Every broadcast also lands in the notification bell.
--  * Shown on the recipient's next dashboard visit (or within a minute if they're on it)
--    until they dismiss it, or until ends_at. Accounts created after a broadcast was sent
--    don't get it.
--  * Optional email, only to people subscribed to LensTrybe emails (email_subscribers),
--    with the unsubscribe link and one-click headers. Sent by the `broadcasts` Edge Function.
--  * Tables are service-role only. People read their broadcasts through my_broadcasts() and
--    get_broadcast(), and dismiss with dismiss_broadcast().

create table if not exists public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 2000),
  audience text not null check (audience in ('all', 'creatives', 'clients', 'basic', 'pro', 'expert', 'elite', 'founding')),
  style text not null default 'banner' check (style in ('banner', 'card')),
  cta_label text check (cta_label is null or char_length(cta_label) <= 40),
  cta_url text check (cta_url is null or cta_url ~ '^(/|https://)'),
  send_email boolean not null default false,
  recipients int not null default 0,
  emailed int not null default 0,
  email_error text,
  ends_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.broadcasts enable row level security;

create table if not exists public.broadcast_dismissals (
  broadcast_id uuid not null references public.broadcasts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (broadcast_id, user_id)
);
alter table public.broadcast_dismissals enable row level security;

-- Does this audience include this account?
create or replace function public.broadcast_matches(p_audience text, p_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when p_uid is null then false
    when p_audience in ('all', 'clients') and exists (
      select 1 from public.client_accounts c where c.id = p_uid and not coalesce(c.pending_deletion, false)) then true
    when p_audience = 'clients' then false
    else exists (
      select 1 from public.profiles p
      where p.id = p_uid and not coalesce(p.pending_deletion, false)
        and case p_audience
          when 'all' then true
          when 'creatives' then true
          when 'founding' then coalesce(p.founding_member, false) and coalesce(p.founding_deal_status, 'active') <> 'reverted'
          when 'basic' then lower(coalesce(p.subscription_tier, 'basic')) not in ('pro', 'expert', 'elite')
          else lower(coalesce(p.subscription_tier, 'basic')) = p_audience
        end)
  end
$$;
revoke all on function public.broadcast_matches(text, uuid) from public, anon, authenticated;
grant execute on function public.broadcast_matches(text, uuid) to service_role;

-- Everyone a broadcast would reach, with their email-subscription token when subscribed.
create or replace function public.broadcast_recipients(p_audience text)
returns table (user_id uuid, email text, name text, kind text, unsubscribe_token uuid)
language sql stable security definer set search_path = public, auth as $$
  with people as (
    select p.id, u.email, coalesce(nullif(trim(p.business_name), ''), '') as name, 'creative'::text as kind
    from public.profiles p join auth.users u on u.id = p.id
    where p_audience <> 'clients' and public.broadcast_matches(p_audience, p.id)
    union
    select c.id, u.email, coalesce(nullif(trim(c.first_name), ''), '') as name, 'client'::text as kind
    from public.client_accounts c join auth.users u on u.id = c.id
    where p_audience in ('all', 'clients') and not coalesce(c.pending_deletion, false)
  )
  select x.id, x.email, x.name, x.kind,
    (select es.token from public.email_subscribers es
      where es.status = 'subscribed' and (es.user_id = x.id or lower(es.email) = lower(x.email))
      order by (es.user_id = x.id) desc limit 1)
  from people x
$$;
revoke all on function public.broadcast_recipients(text) from public, anon, authenticated;
grant execute on function public.broadcast_recipients(text) to service_role;

-- Put a broadcast in everyone's bell. Returns how many were added.
create or replace function public.broadcast_fanout(p_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare b public.broadcasts; n int;
begin
  select * into b from public.broadcasts where id = p_id;
  if b.id is null then return 0; end if;
  insert into public.notifications (user_id, type, title, body, link, meta)
  select r.user_id, 'broadcast', b.title, left(b.body, 200),
         case when r.kind = 'client' then '/client-dashboard?broadcast=' || b.id else '/dashboard?broadcast=' || b.id end,
         jsonb_build_object('broadcast_id', b.id)
  from public.broadcast_recipients(b.audience) r;
  get diagnostics n = row_count;
  update public.broadcasts set recipients = n where id = b.id;
  return n;
end $$;
revoke all on function public.broadcast_fanout(uuid) from public, anon, authenticated;
grant execute on function public.broadcast_fanout(uuid) to service_role;

-- The signed-in person's live broadcasts that they haven't dismissed.
create or replace function public.my_broadcasts()
returns table (id uuid, title text, body text, style text, cta_label text, cta_url text, created_at timestamptz)
language sql stable security definer set search_path = public, auth as $$
  select b.id, b.title, b.body, b.style, b.cta_label, b.cta_url, b.created_at
  from public.broadcasts b
  where auth.uid() is not null
    and (b.ends_at is null or b.ends_at > now())
    and b.created_at >= (select u.created_at from auth.users u where u.id = auth.uid())
    and public.broadcast_matches(b.audience, auth.uid())
    and not exists (select 1 from public.broadcast_dismissals d where d.broadcast_id = b.id and d.user_id = auth.uid())
  order by b.created_at desc
  limit 10
$$;
revoke all on function public.my_broadcasts() from public, anon;
grant execute on function public.my_broadcasts() to authenticated;

-- One broadcast (to re-open it from the bell), even if dismissed or ended.
create or replace function public.get_broadcast(p_id uuid)
returns table (id uuid, title text, body text, style text, cta_label text, cta_url text, created_at timestamptz)
language sql stable security definer set search_path = public, auth as $$
  select b.id, b.title, b.body, b.style, b.cta_label, b.cta_url, b.created_at
  from public.broadcasts b
  where b.id = p_id and auth.uid() is not null
    and b.created_at >= (select u.created_at from auth.users u where u.id = auth.uid())
    and public.broadcast_matches(b.audience, auth.uid())
$$;
revoke all on function public.get_broadcast(uuid) from public, anon;
grant execute on function public.get_broadcast(uuid) to authenticated;

-- Dismiss (and mark its bell notification read).
create or replace function public.dismiss_broadcast(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if not exists (select 1 from public.broadcasts b where b.id = p_id) then return; end if;
  insert into public.broadcast_dismissals (broadcast_id, user_id) values (p_id, auth.uid())
    on conflict do nothing;
  update public.notifications set read = true
   where user_id = auth.uid() and type = 'broadcast' and meta->>'broadcast_id' = p_id::text and not read;
end $$;
revoke all on function public.dismiss_broadcast(uuid) from public, anon;
grant execute on function public.dismiss_broadcast(uuid) to authenticated;
