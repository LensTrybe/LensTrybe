-- A creative who already has an account uses a founding code from inside the workspace
-- (Founding hub), instead of deleting the account and signing up again (2 Oct 2026).
-- Same grant as handle_new_user at sign-up: the first 100 founding places get 12 months free
-- and the badge, after that 6 months and no badge; a comped code grants its own tier.
-- Applied live as migration redeem_founding_code_existing_account.
create or replace function public.redeem_founding_code(p_code text, p_terms_version text default null, p_ua text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_prof record;
  v_inv record;
  v_months int;
  v_live boolean;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  if v_code = '' or length(v_code) > 64 then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if not public.rate_limit_hit('founding-redeem:' || v_uid::text, 10, 600) then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited');
  end if;

  select id, account_type, founding_member, comp_tier, pending_deletion into v_prof from public.profiles where id = v_uid for update;
  if v_prof.id is null or v_prof.account_type is distinct from 'creative' then return jsonb_build_object('ok', false, 'reason', 'not_creative'); end if;
  if v_prof.pending_deletion then return jsonb_build_object('ok', false, 'reason', 'deleting'); end if;
  if v_prof.founding_member then return jsonb_build_object('ok', false, 'reason', 'already_founding'); end if;

  -- someone already paying (or with a card saved for a trial) is moved over by hand, not here
  select exists (select 1 from public.subscriptions s where s.user_id = v_uid
                  and (s.status in ('active', 'past_due') or (s.status = 'trialing' and s.revolut_payment_method_id is not null))) into v_live;
  if v_live then return jsonb_build_object('ok', false, 'reason', 'has_subscription'); end if;

  select id, status, expires_at, grant_tier, grant_forever into v_inv from public.founding_invites where code = v_code for update;
  if v_inv.id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if v_inv.status <> 'unused' then return jsonb_build_object('ok', false, 'reason', v_inv.status); end if;
  if v_inv.expires_at is not null and v_inv.expires_at <= now() then return jsonb_build_object('ok', false, 'reason', 'expired'); end if;

  if v_inv.grant_tier is not null then
    update public.profiles set
      subscription_tier = v_inv.grant_tier, subscription_status = 'active',
      comp_tier = case when v_inv.grant_forever then v_inv.grant_tier else null end,
      next_billing_date = case when v_inv.grant_forever then null else (now() + interval '12 months')::date end
    where id = v_uid;
    v_months := case when v_inv.grant_forever then null else 12 end;
  else
    perform pg_advisory_xact_lock(hashtext('founding_places'));
    v_months := case when public.founding_places_used() < public.founding_cap() then 12 else 6 end;
    update public.profiles set
      subscription_tier = 'expert', subscription_status = 'active',
      founding_member = true, founding_member_since = now(),
      show_founding_badge = (v_months = 12),
      founding_free_months = v_months,
      next_billing_date = (now() + make_interval(months => v_months))::date
    where id = v_uid;
    insert into public.founding_terms_acceptances (user_id, invite_id, code, terms_version, accepted_at, user_agent)
    values (v_uid, v_inv.id, v_code, coalesce(nullif(p_terms_version, ''), 'unspecified'), now(), left(nullif(p_ua, ''), 400));
  end if;

  update public.founding_invites set status = 'redeemed', redeemed_by = v_uid, redeemed_at = now() where id = v_inv.id and status = 'unused';
  return jsonb_build_object('ok', true, 'tier', coalesce(v_inv.grant_tier, 'expert'), 'months', v_months, 'founding', v_inv.grant_tier is null, 'badge', v_inv.grant_tier is null and v_months = 12);
end
$$;
revoke all on function public.redeem_founding_code(text, text, text) from public, anon;
grant execute on function public.redeem_founding_code(text, text, text) to authenticated;
