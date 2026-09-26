-- Security pass (27 Sep): calendar feed tokens were readable by anyone, because profiles is
-- publicly readable and the column was granted to anon. The token is the whole of the calendar
-- feed's security (client names, dates, locations, notes), so it moves to its own owner-only
-- table, every token is replaced (the old ones were exposed), and the profiles column is emptied.
-- calendar-feed (v4) and reset_calendar_token read the new table; my_calendar_token() hands the
-- owner their link (creating it the first time).

create table if not exists public.calendar_feeds (
  creative_id uuid primary key references public.profiles(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);
alter table public.calendar_feeds enable row level security;
drop policy if exists calendar_feeds_select_own on public.calendar_feeds;
create policy calendar_feeds_select_own on public.calendar_feeds for select to authenticated using (creative_id = (select auth.uid()));
revoke all on public.calendar_feeds from anon;
revoke insert, update, delete, truncate on public.calendar_feeds from authenticated;
grant select on public.calendar_feeds to authenticated;

-- fresh tokens for everyone who had one
insert into public.calendar_feeds (creative_id)
  select id from public.profiles where calendar_token is not null
  on conflict (creative_id) do update set token = gen_random_uuid(), created_at = now();

alter table public.profiles alter column calendar_token drop default;
alter table public.profiles alter column calendar_token drop not null;
update public.profiles set calendar_token = null where calendar_token is not null;

create or replace function public.my_calendar_token() returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  select token into v from public.calendar_feeds where creative_id = auth.uid();
  if v is null then
    insert into public.calendar_feeds (creative_id) values (auth.uid())
      on conflict (creative_id) do nothing returning token into v;
    if v is null then select token into v from public.calendar_feeds where creative_id = auth.uid(); end if;
  end if;
  return v;
end $$;
revoke all on function public.my_calendar_token() from public, anon;
grant execute on function public.my_calendar_token() to authenticated;

create or replace function public.reset_calendar_token() returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  insert into public.calendar_feeds (creative_id, token) values (auth.uid(), gen_random_uuid())
    on conflict (creative_id) do update set token = gen_random_uuid(), created_at = now()
    returning token into v;
  return v;
end $$;
revoke all on function public.reset_calendar_token() from public, anon;
grant execute on function public.reset_calendar_token() to authenticated;
