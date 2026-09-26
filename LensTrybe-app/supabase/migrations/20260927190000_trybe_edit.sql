-- The Trybe Edit: opt-in list, confirm-by-email subscribe, and the issues themselves.
--
-- email_subscribers is shared with the waitlist, signup consent, the settings toggle and the
-- founding invites. The founding invites added 100 people for the invite only, so they are not
-- Edit readers. edit_opt_in_at marks the people who actually chose The Edit; the sender only
-- emails rows that are 'subscribed' AND have edit_opt_in_at.

alter table public.email_subscribers
  add column if not exists edit_opt_in_at timestamptz,
  add column if not exists edit_confirm_token uuid,
  add column if not exists edit_confirm_sent_at timestamptz;

create unique index if not exists email_subscribers_edit_confirm_token_key
  on public.email_subscribers (edit_confirm_token) where edit_confirm_token is not null;

-- Everyone who subscribed any way other than a founding invite chose The Edit
-- (the waitlist, signup and settings wording all name it).
update public.email_subscribers
   set edit_opt_in_at = coalesce(consented_at, created_at)
 where edit_opt_in_at is null and coalesce(source, '') <> 'founding-invite';

-- Keep it that way for future rows: any opt-in that isn't a founding invite is an Edit opt-in.
create or replace function public.email_subscribers_edit_opt_in()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'subscribed' and coalesce(new.source, '') <> 'founding-invite'
     and (tg_op = 'INSERT' or old.status is distinct from 'subscribed' or old.source is distinct from new.source) then
    new.edit_opt_in_at := coalesce(new.consented_at, now());
  end if;
  return new;
end $$;

drop trigger if exists email_subscribers_edit_opt_in on public.email_subscribers;
create trigger email_subscribers_edit_opt_in before insert or update on public.email_subscribers
  for each row execute function public.email_subscribers_edit_opt_in();

-- The issues. Public can read an issue once it is approved and its publish time has passed.
create table if not exists public.edit_issues (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  n int not null,
  month text not null,
  title text not null,
  dek text not null default '',
  read text not null default '5 min',
  mood text not null default 'golden',
  seed int not null default 21,
  sections jsonb not null default '[]'::jsonb,
  publish_at timestamptz not null,
  approved boolean not null default false,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.edit_issues enable row level security;
drop policy if exists "Published issues are public" on public.edit_issues;
create policy "Published issues are public" on public.edit_issues for select to anon, authenticated
  using (approved and publish_at <= now());
revoke all on public.edit_issues from anon, authenticated;
grant select on public.edit_issues to anon, authenticated;

-- A new address that has asked for The Edit but not yet tapped the confirm link.
alter table public.email_subscribers drop constraint if exists email_subscribers_status_check;
alter table public.email_subscribers add constraint email_subscribers_status_check check (status = any (array['subscribed','unsubscribed','pending']));
