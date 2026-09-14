-- A promotional poster an Expert or Elite creative can show the first time a client opens
-- their public profile. A picture, or words, or both, with an optional button that drops the
-- client straight into the enquiry form while they are still interested.

create table if not exists public.profile_posters (
  creative_id  uuid primary key references public.profiles(id) on delete cascade,
  enabled      boolean not null default false,
  heading      text,
  body         text,
  image_path   text,
  cta_enabled  boolean not null default false,
  cta_label    text,
  starts_at    timestamptz,
  ends_at      timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- A poster with neither words nor a picture is an empty box popping up at a client.
  constraint profile_posters_has_content check (
    not enabled
    or coalesce(nullif(btrim(heading), ''), nullif(btrim(body), ''), nullif(btrim(image_path), '')) is not null
  ),
  constraint profile_posters_window check (ends_at is null or starts_at is null or ends_at > starts_at),
  constraint profile_posters_heading_len check (heading is null or char_length(heading) <= 80),
  constraint profile_posters_body_len check (body is null or char_length(body) <= 400),
  constraint profile_posters_cta_len check (cta_label is null or char_length(cta_label) <= 32)
);

alter table public.profile_posters enable row level security;

-- The creative owns their own poster and nobody else can read the table directly. Clients
-- see a poster only through profile_poster_public below, which applies the tier and date
-- rules, so an expired or switched off poster cannot be read by asking the table nicely.
drop policy if exists profile_posters_own on public.profile_posters;
create policy profile_posters_own on public.profile_posters
  for all to authenticated
  using (creative_id = auth.uid())
  with check (creative_id = auth.uid());

create or replace function public.profile_posters_touch()
returns trigger language plpgsql as $$
begin
  NEW.updated_at := now();
  NEW.creative_id := coalesce(OLD.creative_id, NEW.creative_id);
  return NEW;
end $$;

drop trigger if exists profile_posters_touch on public.profile_posters;
create trigger profile_posters_touch before update on public.profile_posters
  for each row execute function public.profile_posters_touch();

/**
 * What a client is allowed to see. Returns nothing unless the poster is switched on, the
 * creative is on a plan that includes it, and today falls inside the dates. Security
 * definer so an anonymous visitor can call it without any read access to the table.
 */
create or replace function public.profile_poster_public(p_creative uuid)
returns table (heading text, body text, image_path text, cta_enabled boolean, cta_label text, updated_at timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $$
  select p.heading, p.body, p.image_path, p.cta_enabled, p.cta_label, p.updated_at
  from public.profile_posters p
  where p.creative_id = p_creative
    and p.enabled
    and public.tier_of(p_creative) in ('expert', 'elite')
    and (p.starts_at is null or p.starts_at <= now())
    and (p.ends_at is null or p.ends_at > now())
$$;

revoke all on function public.profile_poster_public(uuid) from public;
grant execute on function public.profile_poster_public(uuid) to anon, authenticated;

-- Poster images. Public, because they are shown to anyone looking at the profile. Writes are
-- already limited to the owner's own folder by the storage_path_is_mine policies, and
-- account_storage_objects picks the folder up, so deleting an account clears these too.
insert into storage.buckets (id, name, public)
values ('posters', 'posters', true)
on conflict (id) do nothing;
