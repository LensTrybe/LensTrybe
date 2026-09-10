-- Group C security pass: messaging notifications, public forms, team joining.

-- 1. send-enquiry: notify at most once per thread.
alter table public.message_threads add column if not exists enquiry_notified_at timestamptz;

-- 2. send-welcome-email: send at most once per account.
create table if not exists public.welcome_emails (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sent_at timestamptz not null default now()
);
alter table public.welcome_emails enable row level security;
-- no policies: only service_role touches it.

-- 3. team_invitations: no public listing, no client-side creation or token edits.
drop policy if exists "Anyone can read invitation by token" on public.team_invitations;
drop policy if exists "Creatives can manage their own invitations" on public.team_invitations;
drop policy if exists team_invitations_owner_select on public.team_invitations;
drop policy if exists team_invitations_owner_update on public.team_invitations;
drop policy if exists team_invitations_owner_delete on public.team_invitations;
create policy team_invitations_owner_select on public.team_invitations
  for select to authenticated using (creative_id = auth.uid());
create policy team_invitations_owner_update on public.team_invitations
  for update to authenticated using (creative_id = auth.uid()) with check (creative_id = auth.uid());
create policy team_invitations_owner_delete on public.team_invitations
  for delete to authenticated using (creative_id = auth.uid());
-- Invitations are created only by the invite-team-member Edge Function (service role).
-- The token is never readable or writable from the browser: holding it proves inbox control.
revoke all on public.team_invitations from anon, authenticated;
grant select (id, creative_id, email, role, status, created_at, accepted_at) on public.team_invitations to authenticated;
grant update (status) on public.team_invitations to authenticated;
grant delete on public.team_invitations to authenticated;

-- Public lookup for the accept/join page: only what the page needs. Invitations expire after 14 days.
create or replace function public.get_team_invitation(p_token text)
returns table (business_name text, brand_primary_color text, email text, role text, status text, expires_at timestamptz, expired boolean)
language sql stable security definer set search_path = public as $$
  select p.business_name, p.brand_primary_color, i.email, i.role, i.status,
         i.created_at + interval '14 days' as expires_at,
         (i.created_at + interval '14 days') < now() as expired
    from public.team_invitations i
    left join public.profiles p on p.id = i.creative_id
   where p_token is not null and length(p_token) >= 16 and i.token = p_token
   limit 1
$$;
revoke all on function public.get_team_invitation(text) from public;
grant execute on function public.get_team_invitation(text) to anon, authenticated;

-- 4. team_invite_codes: no anonymous enumeration of active codes.
drop policy if exists "Anyone can read active codes" on public.team_invite_codes;
create or replace function public.validate_team_invite_code(p_code text)
returns table (valid boolean, business_name text)
language sql stable security definer set search_path = public as $$
  select true, p.business_name
    from public.team_invite_codes c
    left join public.profiles p on p.id = c.creative_id
   where c.active = true
     and c.code = btrim(coalesce(p_code, ''))
     and (c.max_uses is null or coalesce(c.uses, 0) < c.max_uses)
   limit 1
$$;
revoke all on function public.validate_team_invite_code(text) from public;
grant execute on function public.validate_team_invite_code(text) to anon, authenticated;
