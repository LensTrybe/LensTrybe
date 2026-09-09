create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_account_type text := meta->>'account_type';
  v_code text := upper(trim(coalesce(meta->>'founding_code', '')));
  v_tier text := coalesce(nullif(meta->>'subscription_tier', ''), 'basic');
  v_granted boolean := false;
  v_invite_id uuid;
begin
  -- Creative signup: build the profile from the signup metadata.
  if v_account_type = 'creative' then
    insert into public.profiles (
      id, business_name, subscription_tier, account_type,
      display_name_preference, country
    )
    values (
      new.id,
      nullif(meta->>'business_name', ''),
      v_tier,
      'creative',
      coalesce(nullif(meta->>'display_name_preference', ''), 'business_only'),
      coalesce(nullif(meta->>'country', ''), 'Australia')
    )
    on conflict (id) do nothing;

    -- Founding invite code: free Expert until 1 Oct 2027, badge + locked status.
    if v_code <> '' then
      select id into v_invite_id
      from public.founding_invites
      where code = v_code and status = 'unused'
      limit 1;

      if v_invite_id is not null then
        update public.profiles set
          subscription_tier = 'expert',
          subscription_status = 'active',
          founding_member = true,
          founding_member_since = now(),
          show_founding_badge = true,
          next_billing_date = date '2027-10-01'
        where id = new.id;

        update public.founding_invites set
          status = 'redeemed',
          redeemed_by = new.id,
          redeemed_at = now()
        where id = v_invite_id and status = 'unused';

        v_granted := true;
      end if;
    end if;

    -- Regular Expert signup (no valid code): free until 1 Jan 2027.
    if not v_granted and v_tier = 'expert' then
      update public.profiles set next_billing_date = date '2027-01-01'
      where id = new.id and next_billing_date is null;
    end if;

  -- Client signup: build the client account from the signup metadata.
  elsif v_account_type = 'client' then
    insert into public.client_accounts (
      id, email, first_name, last_name, company_name
    )
    values (
      new.id,
      new.email,
      nullif(meta->>'first_name', ''),
      nullif(meta->>'last_name', ''),
      nullif(meta->>'company_name', '')
    )
    on conflict (id) do nothing;
  end if;

  return new;
exception when others then
  -- Never block auth signup because of profile setup; log and continue.
  raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
  return new;
end;
$function$;
