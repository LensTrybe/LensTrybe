-- Google sign-up (28 Sep). Email sign-ups get their profile or client row from handle_new_user,
-- using the metadata the sign-up form sends. A Google sign-up has no such metadata, so the app
-- calls this once, after Google, to make the account the person chose. It only ever creates the
-- caller's own row, only when they have none yet, and always on the free plan (a paid plan still
-- goes through the card window afterwards).
create or replace function public.create_my_account(p_kind text, p_first text default '', p_last text default '', p_skills text[] default null, p_news boolean default false)
returns text
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_email text; v_name text; v_skills text[];
begin
  if v_uid is null then raise exception 'Please log in again.' using errcode = '42501'; end if;
  if exists (select 1 from public.profiles where id = v_uid) then return 'creative'; end if;
  if exists (select 1 from public.client_accounts where id = v_uid) then return 'client'; end if;
  select email into v_email from auth.users where id = v_uid and email_confirmed_at is not null;
  if v_email is null then raise exception 'Confirm your email first.' using errcode = 'P0001'; end if;
  v_name := left(nullif(btrim(coalesce(p_first, '') || ' ' || coalesce(p_last, '')), ''), 120);
  if p_kind = 'client' then
    insert into public.client_accounts (id, email, first_name, last_name)
    values (v_uid, lower(v_email), left(nullif(btrim(p_first), ''), 80), left(nullif(btrim(p_last), ''), 80))
    on conflict (id) do nothing;
  elsif p_kind = 'creative' then
    v_skills := array(select s from unnest(coalesce(p_skills, array['Photographer'])) s where s in ('Photographer', 'Videographer') limit 2);
    if cardinality(v_skills) = 0 then v_skills := array['Photographer']; end if;
    insert into public.profiles (id, business_name, subscription_tier, account_type, display_name_preference, country, skill_types)
    values (v_uid, v_name, 'basic', 'creative', 'business_only', 'Australia', v_skills)
    on conflict (id) do nothing;
  else
    raise exception 'Choose creative or client.' using errcode = 'P0001';
  end if;
  if p_news then
    insert into public.email_subscribers (email, user_id, status, source, consented_at)
    values (lower(v_email), v_uid, 'subscribed', 'signup', now())
    on conflict ((lower(email))) do update set user_id = excluded.user_id, status = 'subscribed', source = 'signup', consented_at = now(), unsubscribed_at = null, updated_at = now();
  end if;
  return p_kind;
end $$;
revoke all on function public.create_my_account(text, text, text, text[], boolean) from public, anon;
grant execute on function public.create_my_account(text, text, text, text[], boolean) to authenticated;
