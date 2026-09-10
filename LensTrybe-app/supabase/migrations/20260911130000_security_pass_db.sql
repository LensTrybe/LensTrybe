-- Security pass: database layer.
--  1. Signup can no longer self-assign a paid tier through signup metadata.
--  2. Bank details and credential document links move out of the publicly readable
--     profiles table into owner-only profile_private (writes are redirected).
--  3. client_accounts no longer readable by every signed-in user.
--  4. Reviews: no forged/flagged/hidden inserts, no self-reviews, creatives can't
--     edit or delete reviews about them (only flag, and delete their own imported
--     ones), duplicate/spam guard, reviewer emails hidden from the public.
--  5. Messages/threads: participants can't rewrite the other party's message or
--     move a thread to another creative.
--  6. Team seats: Elite comp removed when a member leaves their last team.
--  7. Marketplace: drop the "read every listing" policy (active + own remain).
--  8. Internal helper functions no longer callable anonymously.

-- ------------------------------------------------------------ 1. signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_account_type text := coalesce(nullif(meta->>'account_type', ''), nullif(meta->>'account_kind', ''));
  v_code text := upper(trim(coalesce(meta->>'founding_code', '')));
  v_chosen text := lower(coalesce(nullif(meta->>'subscription_tier', ''), 'basic'));
  v_granted boolean := false;
  v_invite_id uuid;
begin
  if v_account_type = 'creative' then
    -- Always start on Basic. A paid tier is granted by the server after payment
    -- (revolut-webhook) or by a founding code below, never by signup metadata.
    insert into public.profiles (
      id, business_name, subscription_tier, account_type,
      display_name_preference, country, city, state
    )
    values (
      new.id,
      nullif(meta->>'business_name', ''),
      'basic',
      'creative',
      coalesce(nullif(meta->>'display_name_preference', ''), 'business_only'),
      coalesce(nullif(meta->>'country', ''), 'Australia'),
      nullif(meta->>'city', ''),
      nullif(meta->>'state', '')
    )
    on conflict (id) do nothing;

    if v_code <> '' then
      select id into v_invite_id from public.founding_invites
       where code = v_code and status = 'unused' limit 1;
      if v_invite_id is not null then
        update public.profiles set
          subscription_tier = 'expert',
          subscription_status = 'active',
          founding_member = true,
          founding_member_since = now(),
          show_founding_badge = true,
          next_billing_date = (now() + interval '12 months')::date
        where id = new.id;
        update public.founding_invites set status = 'redeemed', redeemed_by = new.id, redeemed_at = now()
         where id = v_invite_id and status = 'unused';
        v_granted := true;
      end if;
    end if;

    -- The chosen paid plan only sets the trial start date; access comes with payment.
    if not v_granted and v_chosen in ('pro', 'expert', 'elite') then
      update public.profiles set next_billing_date = (now() + interval '3 months')::date
       where id = new.id and next_billing_date is null;
    end if;

  elsif v_account_type = 'client' then
    insert into public.client_accounts (id, email, first_name, last_name, company_name)
    values (new.id, new.email, nullif(meta->>'first_name', ''), nullif(meta->>'last_name', ''), nullif(meta->>'company_name', ''))
    on conflict (id) do nothing;
  end if;
  return new;
exception when others then
  raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ------------------------------------------------------------ 2. profile_private
create table if not exists public.profile_private (
  id uuid primary key references public.profiles(id) on delete cascade,
  bank_name text,
  bank_bsb text,
  bank_account text,
  bank_account_name text,
  insurance_url text,
  blue_card_url text,
  police_check_url text,
  wwvp_url text,
  drone_licence_url text,
  other_url text,
  updated_at timestamptz not null default now()
);
alter table public.profile_private enable row level security;
drop policy if exists profile_private_select_own on public.profile_private;
drop policy if exists profile_private_insert_own on public.profile_private;
drop policy if exists profile_private_update_own on public.profile_private;
drop policy if exists profile_private_admin_select on public.profile_private;
create policy profile_private_select_own on public.profile_private for select to authenticated using (id = auth.uid());
create policy profile_private_insert_own on public.profile_private for insert to authenticated with check (id = auth.uid());
create policy profile_private_update_own on public.profile_private for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

insert into public.profile_private (id, bank_name, bank_bsb, bank_account, bank_account_name,
  insurance_url, blue_card_url, police_check_url, wwvp_url, drone_licence_url, other_url)
select id, bank_name, bank_bsb, bank_account, bank_account_name,
  insurance_url, blue_card_url, police_check_url, wwvp_url, drone_licence_url, other_url
  from public.profiles
 where coalesce(bank_name, bank_bsb, bank_account, bank_account_name, insurance_url, blue_card_url,
                police_check_url, wwvp_url, drone_licence_url, other_url) is not null
on conflict (id) do update set
  bank_name = excluded.bank_name, bank_bsb = excluded.bank_bsb, bank_account = excluded.bank_account,
  bank_account_name = excluded.bank_account_name, insurance_url = excluded.insurance_url,
  blue_card_url = excluded.blue_card_url, police_check_url = excluded.police_check_url,
  wwvp_url = excluded.wwvp_url, drone_licence_url = excluded.drone_licence_url, other_url = excluded.other_url;

-- Redirect any non-null write of a private column on profiles into profile_private,
-- and never store it on the public row.
create or replace function public.profiles_redirect_private_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(NEW.bank_name, NEW.bank_bsb, NEW.bank_account, NEW.bank_account_name, NEW.insurance_url,
              NEW.blue_card_url, NEW.police_check_url, NEW.wwvp_url, NEW.drone_licence_url, NEW.other_url) is not null then
    insert into public.profile_private as pp (id, bank_name, bank_bsb, bank_account, bank_account_name,
      insurance_url, blue_card_url, police_check_url, wwvp_url, drone_licence_url, other_url, updated_at)
    values (NEW.id, NEW.bank_name, NEW.bank_bsb, NEW.bank_account, NEW.bank_account_name,
      NEW.insurance_url, NEW.blue_card_url, NEW.police_check_url, NEW.wwvp_url, NEW.drone_licence_url, NEW.other_url, now())
    on conflict (id) do update set
      bank_name = coalesce(excluded.bank_name, pp.bank_name),
      bank_bsb = coalesce(excluded.bank_bsb, pp.bank_bsb),
      bank_account = coalesce(excluded.bank_account, pp.bank_account),
      bank_account_name = coalesce(excluded.bank_account_name, pp.bank_account_name),
      insurance_url = coalesce(excluded.insurance_url, pp.insurance_url),
      blue_card_url = coalesce(excluded.blue_card_url, pp.blue_card_url),
      police_check_url = coalesce(excluded.police_check_url, pp.police_check_url),
      wwvp_url = coalesce(excluded.wwvp_url, pp.wwvp_url),
      drone_licence_url = coalesce(excluded.drone_licence_url, pp.drone_licence_url),
      other_url = coalesce(excluded.other_url, pp.other_url),
      updated_at = now();
  end if;
  NEW.bank_name := null; NEW.bank_bsb := null; NEW.bank_account := null; NEW.bank_account_name := null;
  NEW.insurance_url := null; NEW.blue_card_url := null; NEW.police_check_url := null;
  NEW.wwvp_url := null; NEW.drone_licence_url := null; NEW.other_url := null;
  return NEW;
end $$;
revoke execute on function public.profiles_redirect_private_columns() from public, anon, authenticated;

-- Needs the profile row to exist for the FK on insert, so run AFTER-insert style for
-- inserts via a separate path: on INSERT we stash, then write after the row exists.
drop trigger if exists c_profiles_redirect_private on public.profiles;
create trigger c_profiles_redirect_private
  before update on public.profiles
  for each row execute function public.profiles_redirect_private_columns();

create or replace function public.profiles_redirect_private_on_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(NEW.bank_name, NEW.bank_bsb, NEW.bank_account, NEW.bank_account_name, NEW.insurance_url,
              NEW.blue_card_url, NEW.police_check_url, NEW.wwvp_url, NEW.drone_licence_url, NEW.other_url) is not null then
    insert into public.profile_private (id, bank_name, bank_bsb, bank_account, bank_account_name,
      insurance_url, blue_card_url, police_check_url, wwvp_url, drone_licence_url, other_url)
    values (NEW.id, NEW.bank_name, NEW.bank_bsb, NEW.bank_account, NEW.bank_account_name,
      NEW.insurance_url, NEW.blue_card_url, NEW.police_check_url, NEW.wwvp_url, NEW.drone_licence_url, NEW.other_url)
    on conflict (id) do nothing;
    update public.profiles set bank_name = null, bank_bsb = null, bank_account = null, bank_account_name = null,
      insurance_url = null, blue_card_url = null, police_check_url = null, wwvp_url = null,
      drone_licence_url = null, other_url = null
     where id = NEW.id;
  end if;
  return null;
end $$;
revoke execute on function public.profiles_redirect_private_on_insert() from public, anon, authenticated;
drop trigger if exists z_profiles_redirect_private_insert on public.profiles;
create trigger z_profiles_redirect_private_insert
  after insert on public.profiles
  for each row execute function public.profiles_redirect_private_on_insert();

update public.profiles set bank_name = null, bank_bsb = null, bank_account = null, bank_account_name = null,
  insurance_url = null, blue_card_url = null, police_check_url = null, wwvp_url = null,
  drone_licence_url = null, other_url = null
 where coalesce(bank_name, bank_bsb, bank_account, bank_account_name, insurance_url, blue_card_url,
                police_check_url, wwvp_url, drone_licence_url, other_url) is not null;

-- ------------------------------------------------------------ 3. client_accounts
drop policy if exists "Authenticated users can read client accounts" on public.client_accounts;
do $$
declare r record;
begin
  for r in select policyname from pg_policies
            where schemaname = 'public' and tablename = 'client_accounts'
              and cmd = 'SELECT' and qual = '(auth.role() = ''authenticated''::text)'
  loop
    execute format('drop policy %I on public.client_accounts', r.policyname);
  end loop;
end $$;

-- A creative starting a conversation by email can link it to an existing client account.
create or replace function public.find_client_account_id(p_email text)
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.client_accounts
   where auth.uid() is not null and lower(email) = lower(btrim(p_email))
   limit 1
$$;
revoke execute on function public.find_client_account_id(text) from public, anon;
grant execute on function public.find_client_account_id(text) to authenticated;

-- ------------------------------------------------------------ 4. reviews
create table if not exists public.review_contacts (
  review_id uuid primary key,
  creative_id uuid not null,
  reviewer_email text not null,
  created_at timestamptz not null default now()
);
alter table public.review_contacts enable row level security;
drop policy if exists review_contacts_creative_select on public.review_contacts;
drop policy if exists review_contacts_admin_select on public.review_contacts;
create policy review_contacts_creative_select on public.review_contacts
  for select to authenticated using (creative_id = auth.uid());
create policy review_contacts_admin_select on public.review_contacts
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and (p.is_admin = true or p.role in ('admin', 'staff'))));

insert into public.review_contacts (review_id, creative_id, reviewer_email)
select id, creative_id, reviewer_email from public.reviews
 where reviewer_email is not null and creative_id is not null
on conflict (review_id) do nothing;
update public.reviews set reviewer_email = null where reviewer_email is not null;

create or replace function public.reviews_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_email text := lower(btrim(coalesce(NEW.reviewer_email, '')));
begin
  if current_user in ('anon', 'authenticated') then
    if coalesce(NEW.source, 'platform') = 'platform' then
      if v_email <> '' and exists (
        select 1 from public.review_contacts rc
         where rc.creative_id = NEW.creative_id and lower(rc.reviewer_email) = v_email
           and rc.created_at > now() - interval '90 days') then
        raise exception 'You have already reviewed this creative recently.';
      end if;
      if (select count(*) from public.reviews r
           where r.creative_id = NEW.creative_id and r.source = 'platform'
             and r.created_at > now() - interval '1 hour') >= 10 then
        raise exception 'Too many reviews right now. Please try again later.';
      end if;
    end if;
    NEW.flagged := false; NEW.flag_reason := null; NEW.flag_status := 'none'; NEW.flagged_at := null;
    NEW.hidden := false; NEW.notified_at := null; NEW.created_at := now();
    NEW.body := left(NEW.body, 3000); NEW.comment := left(NEW.comment, 3000);
    NEW.reviewer_name := left(NEW.reviewer_name, 120); NEW.client_name := left(NEW.client_name, 120);
  end if;
  if v_email <> '' then
    insert into public.review_contacts (review_id, creative_id, reviewer_email)
    values (NEW.id, NEW.creative_id, v_email) on conflict (review_id) do nothing;
  end if;
  NEW.reviewer_email := null;
  return NEW;
end $$;
revoke execute on function public.reviews_before_insert() from public, anon, authenticated;
drop trigger if exists a_reviews_before_insert on public.reviews;
create trigger a_reviews_before_insert before insert on public.reviews
  for each row execute function public.reviews_before_insert();

-- Creatives may only flag reviews about them; admins/staff keep full edit rights.
create or replace function public.reviews_guard_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_user not in ('anon', 'authenticated') then return NEW; end if;
  if exists (select 1 from public.profiles p where p.id = auth.uid() and (p.is_admin = true or p.role in ('admin', 'staff'))) then
    return NEW;
  end if;
  NEW.id := OLD.id; NEW.creative_id := OLD.creative_id; NEW.client_name := OLD.client_name;
  NEW.rating := OLD.rating; NEW.comment := OLD.comment; NEW.created_at := OLD.created_at;
  NEW.reviewer_name := OLD.reviewer_name; NEW.body := OLD.body; NEW.source := OLD.source;
  NEW.project_type := OLD.project_type; NEW.reviewer_email := OLD.reviewer_email;
  NEW.hidden := OLD.hidden; NEW.notified_at := OLD.notified_at;
  if NEW.flag_status not in ('none', 'pending') then NEW.flag_status := OLD.flag_status; end if;
  return NEW;
end $$;
revoke execute on function public.reviews_guard_update() from public, anon, authenticated;
drop trigger if exists a_reviews_guard_update on public.reviews;
create trigger a_reviews_guard_update before update on public.reviews
  for each row execute function public.reviews_guard_update();

drop policy if exists "Anyone can insert reviews" on public.reviews;
drop policy if exists "Anyone can view reviews" on public.reviews;
do $$
declare r record;
begin
  -- the owner catch-all (ALL using auth.uid() = creative_id) let creatives edit/delete reviews about them
  for r in select policyname from pg_policies
            where schemaname = 'public' and tablename = 'reviews' and cmd = 'ALL'
  loop
    execute format('drop policy %I on public.reviews', r.policyname);
  end loop;
end $$;
create policy reviews_insert_public on public.reviews for insert to anon, authenticated
  with check (
    coalesce(source, 'platform') = 'platform'
    and rating between 1 and 5
    and creative_id is not null
    and (auth.uid() is null or auth.uid() <> creative_id)
  );
create policy reviews_insert_imported on public.reviews for insert to authenticated
  with check (source = 'imported' and creative_id = auth.uid() and rating between 1 and 5);
create policy reviews_update_flag_own on public.reviews for update to authenticated
  using (creative_id = auth.uid()) with check (creative_id = auth.uid());
create policy reviews_delete_imported_own on public.reviews for delete to authenticated
  using (creative_id = auth.uid() and source = 'imported');
create policy reviews_admin_delete on public.reviews for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and (p.is_admin = true or p.role in ('admin', 'staff'))));

-- ------------------------------------------------------------ 5. messages / threads integrity
create or replace function public.messages_guard_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_user not in ('anon', 'authenticated') then return NEW; end if;
  -- participants may only change the read flag
  NEW.id := OLD.id; NEW.creative_id := OLD.creative_id; NEW.thread_id := OLD.thread_id;
  NEW.sender_name := OLD.sender_name; NEW.sender_email := OLD.sender_email; NEW.subject := OLD.subject;
  NEW.body := OLD.body; NEW.created_at := OLD.created_at; NEW.sender_type := OLD.sender_type;
  NEW.attachments := OLD.attachments; NEW.linked_doc_type := OLD.linked_doc_type; NEW.linked_doc_id := OLD.linked_doc_id;
  return NEW;
end $$;
revoke execute on function public.messages_guard_update() from public, anon, authenticated;
drop trigger if exists a_messages_guard_update on public.messages;
create trigger a_messages_guard_update before update on public.messages
  for each row execute function public.messages_guard_update();

create or replace function public.message_threads_guard_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_user not in ('anon', 'authenticated') then return NEW; end if;
  NEW.creative_id := OLD.creative_id;
  NEW.client_email := OLD.client_email;
  NEW.created_at := OLD.created_at;
  -- a client account can only be attached, never swapped
  if OLD.client_user_id is not null then NEW.client_user_id := OLD.client_user_id; end if;
  return NEW;
end $$;
revoke execute on function public.message_threads_guard_update() from public, anon, authenticated;
drop trigger if exists a_message_threads_guard_update on public.message_threads;
create trigger a_message_threads_guard_update before update on public.message_threads
  for each row execute function public.message_threads_guard_update();

-- ------------------------------------------------------------ 6. team seats
create or replace function public.team_members_release_comp()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_member uuid := coalesce(OLD.member_profile_id, NULL);
begin
  if v_member is null then return null; end if;
  if TG_OP = 'UPDATE' and coalesce(NEW.status, '') = 'active' then return null; end if;
  if not exists (select 1 from public.team_members tm
                  where tm.member_profile_id = v_member and tm.status = 'active'
                    and (TG_OP = 'DELETE' or tm.id <> OLD.id)) then
    update public.profiles set comp_tier = null, subscription_tier =
      case when exists (select 1 from public.subscriptions s where s.user_id = v_member and s.status in ('active','trialing','past_due'))
           then (select s.tier from public.subscriptions s where s.user_id = v_member and s.status in ('active','trialing','past_due') order by s.updated_at desc limit 1)
           else 'basic' end
     where id = v_member and comp_tier = 'elite' and coalesce(is_admin, false) = false;
  end if;
  return null;
end $$;
revoke execute on function public.team_members_release_comp() from public, anon, authenticated;
drop trigger if exists team_members_release_comp_trg on public.team_members;
create trigger team_members_release_comp_trg
  after delete or update of status on public.team_members
  for each row execute function public.team_members_release_comp();

-- ------------------------------------------------------------ 7. marketplace
drop policy if exists "Anyone can view active marketplace listings" on public.marketplace_listings;
create policy "Anyone can view active marketplace listings" on public.marketplace_listings
  for select to anon, authenticated using (status = 'active');

-- ------------------------------------------------------------ 8. helper function exposure
revoke execute on function public.count_creative_replies_this_utc_month(uuid) from public, anon, authenticated;
revoke execute on function public.founding_job_count(uuid) from public, anon;
revoke execute on function public.founding_listing_complete(uuid) from public, anon;
grant execute on function public.founding_job_count(uuid) to authenticated, service_role;
grant execute on function public.founding_listing_complete(uuid) to authenticated, service_role;
revoke execute on function public.founding_status_all() from public, anon;
grant execute on function public.founding_status_all() to authenticated;
