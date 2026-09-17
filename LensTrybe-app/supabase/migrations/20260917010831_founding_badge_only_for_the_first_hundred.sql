-- The Founding Creative badge belongs to the founding 100 and nobody else.
--
-- The second tier was built as "everything the same, half the free months", which handed
-- the badge to anyone redeeming after the places were claimed. That would have meant more
-- than 100 profiles wearing a badge that says founding 100, which empties it of meaning
-- for the people who earned it.
--
-- They keep founding_member, so the locked $49 rate, the section 4 commitments and the
-- founding-check cron all behave identically. Only the public badge differs.
-- check_founding_member never touches show_founding_badge, so this is not overwritten.

create or replace function public.handle_new_user()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_account_type text := coalesce(nullif(meta->>'account_type', ''), nullif(meta->>'account_kind', ''));
  v_code text := upper(trim(coalesce(meta->>'founding_code', '')));
  v_chosen text := lower(coalesce(nullif(meta->>'subscription_tier', ''), 'basic'));
  v_granted boolean := false;
  v_invite_id uuid;
  v_free_months integer;
begin
  if v_account_type = 'creative' then
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
       where code = v_code and status = 'unused' and (expires_at is null or expires_at > now())
       limit 1;
      if v_invite_id is not null then
        -- Same lock the invite cap guard takes, so two people redeeming at once cannot
        -- both read the last free place and both be given the full period.
        perform pg_advisory_xact_lock(hashtext('founding_places'));
        v_free_months := case
          when public.founding_places_used() < public.founding_cap() then 12
          else 6
        end;
        update public.profiles set
          subscription_tier = 'expert',
          subscription_status = 'active',
          founding_member = true,
          founding_member_since = now(),
          -- The badge is the founding 100's alone. The second tier keeps everything else.
          show_founding_badge = (v_free_months = 12),
          founding_free_months = v_free_months,
          next_billing_date = (now() + make_interval(months => v_free_months))::date
        where id = new.id;
        update public.founding_invites set status = 'redeemed', redeemed_by = new.id, redeemed_at = now()
         where id = v_invite_id and status = 'unused';
        insert into public.founding_terms_acceptances (user_id, invite_id, code, terms_version, accepted_at, user_agent)
        values (new.id, v_invite_id, v_code,
                coalesce(nullif(meta->>'founding_terms_version', ''), 'unspecified'),
                now(), left(nullif(meta->>'founding_terms_ua', ''), 400));
        v_granted := true;
      end if;
    end if;

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
end $function$;
