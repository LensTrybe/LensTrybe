-- Peer invites (26 Oct 2026): every founding creative can pass on 3 founding places in their own
-- state. Each is an ordinary founding_invites row (no email, no expiry) marked notes = 'Peer invite'
-- and invited_by = the founding creative, so redeeming works exactly like an HQ invite and the
-- place counts in that state's 100. Created on first view, never more than 3 per creative ever
-- (cancelled ones included, so HQ cancelling a code does not hand out a fresh one).
-- Only founding creatives whose deal is active or at risk get them.
create or replace function public.my_peer_invites()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_prof record;
  v_have int;
  v_prefix text;
  v_code text;
  v_alpha constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_tries int;
  v_out jsonb;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'reason', 'signed_out'); end if;
  select id, business_name, founding_member, founding_state, founding_deal_status, pending_deletion
    into v_prof from public.profiles where id = v_uid;
  if v_prof.id is null or not coalesce(v_prof.founding_member, false) or v_prof.founding_state is null then
    return jsonb_build_object('ok', false, 'reason', 'not_founding');
  end if;
  if v_prof.pending_deletion or coalesce(v_prof.founding_deal_status, 'active') not in ('active', 'at_risk') then
    return jsonb_build_object('ok', false, 'reason', 'not_eligible');
  end if;

  perform pg_advisory_xact_lock(hashtext('peer_invites:' || v_uid::text));
  select count(*) into v_have from public.founding_invites where invited_by = v_uid and notes = 'Peer invite';
  v_prefix := left(regexp_replace(upper(split_part(btrim(coalesce(v_prof.business_name, '')), ' ', 1)), '[^A-Z]', '', 'g'), 8);
  if length(v_prefix) < 2 then v_prefix := 'TRYBE'; end if;

  while v_have < 3 loop
    v_tries := 0;
    loop
      v_code := v_prefix || '-' || (select string_agg(substr(v_alpha, 1 + floor(random() * length(v_alpha))::int, 1), '') from generate_series(1, 4));
      exit when not exists (select 1 from public.founding_invites where code = v_code);
      v_tries := v_tries + 1;
      if v_tries > 20 then raise exception 'PEER_CODE_FAILED'; end if;
    end loop;
    insert into public.founding_invites (code, full_name, state, status, invited_by, notes)
    values (v_code, 'Peer invite from ' || coalesce(nullif(btrim(v_prof.business_name), ''), 'a founding creative'),
            v_prof.founding_state, 'unused', v_uid, 'Peer invite');
    v_have := v_have + 1;
  end loop;

  select jsonb_agg(jsonb_build_object(
           'code', f.code, 'status', f.status, 'redeemed_at', f.redeemed_at,
           'joined', case when f.status = 'redeemed' then coalesce(nullif(btrim(p.business_name), ''), 'A new creative') end)
         order by f.created_at, f.code)
    into v_out
    from public.founding_invites f left join public.profiles p on p.id = f.redeemed_by
   where f.invited_by = v_uid and f.notes = 'Peer invite';

  return jsonb_build_object('ok', true, 'state', v_prof.founding_state,
    'months', case when public.founding_places_used(v_prof.founding_state) < public.founding_cap() then 12 else 6 end,
    'left', greatest(public.founding_cap() - public.founding_places_used(v_prof.founding_state), 0),
    'invites', coalesce(v_out, '[]'::jsonb));
end $$;

revoke all on function public.my_peer_invites() from public, anon;
grant execute on function public.my_peer_invites() to authenticated;
