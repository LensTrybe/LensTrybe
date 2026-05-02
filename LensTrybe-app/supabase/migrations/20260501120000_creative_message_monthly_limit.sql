-- Monthly cap on creative-authored messages (sender_type = 'creative') per thread owner.
-- Basic: 5/month, Pro: 20/month, Expert/Elite: unlimited. Calendar month in UTC.

create or replace function public.count_creative_replies_this_utc_month(p_creative_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.messages m
  inner join public.message_threads t on t.id = m.thread_id
  where t.creative_id = p_creative_id
    and m.sender_type = 'creative'
    and m.created_at >= (date_trunc('month', timezone('utc', now())))::timestamptz;
$$;

comment on function public.count_creative_replies_this_utc_month(uuid) is
  'Count of messages sent as the creative (seller) in the current UTC calendar month.';

create or replace function public.enforce_creative_monthly_message_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread_creative uuid;
  v_tier text;
  v_limit integer;
  v_used integer;
begin
  if new.sender_type is distinct from 'creative' then
    return new;
  end if;

  select mt.creative_id
  into v_thread_creative
  from public.message_threads mt
  where mt.id = new.thread_id;

  if v_thread_creative is null then
    return new;
  end if;

  -- Only gate sends performed by the thread owner creative as themselves.
  if auth.uid() is null or auth.uid() is distinct from v_thread_creative then
    return new;
  end if;

  select lower(coalesce(p.subscription_tier, 'basic'))
  into v_tier
  from public.profiles p
  where p.id = v_thread_creative
    and coalesce(p.is_admin, false) = false;

  -- Missing profile row: treat as basic (strictest cap).
  if v_tier is null then
    v_tier := 'basic';
  end if;

  if v_tier in ('expert', 'elite', 'vip') then
    return new;
  end if;

  if v_tier not in ('basic', 'pro') then
    v_tier := 'basic';
  end if;

  v_limit := case v_tier when 'basic' then 5 when 'pro' then 20 else 999999 end;

  select public.count_creative_replies_this_utc_month(v_thread_creative) into v_used;

  if v_used >= v_limit then
    raise exception 'MONTHLY_MESSAGE_LIMIT'
      using message = 'You have reached your monthly message limit. Upgrade your plan to send more messages.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_messages_enforce_monthly_limit on public.messages;
create trigger trg_messages_enforce_monthly_limit
  before insert on public.messages
  for each row
  execute function public.enforce_creative_monthly_message_limit();

-- Authenticated creatives can read their own usage for UI (no cross-user reads).
create or replace function public.get_my_creative_message_reply_usage()
returns table(used integer, max_allowed integer, unlimited boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tier text;
  v_limit integer;
  v_used integer;
begin
  if v_uid is null then
    return query select 0, 0, true;
    return;
  end if;

  select lower(coalesce(p.subscription_tier, 'basic'))
  into v_tier
  from public.profiles p
  where p.id = v_uid
    and coalesce(p.is_admin, false) = false;

  if v_tier is null then
    v_tier := 'basic';
  end if;

  if v_tier in ('expert', 'elite', 'vip') then
    select public.count_creative_replies_this_utc_month(v_uid) into v_used;
    return query select v_used, 0, true;
    return;
  end if;

  v_limit := case v_tier when 'basic' then 5 when 'pro' then 20 else 5 end;
  select public.count_creative_replies_this_utc_month(v_uid) into v_used;

  return query select v_used, v_limit, false;
end;
$$;

comment on function public.get_my_creative_message_reply_usage() is
  'Returns used count this UTC month, max for Basic/Pro, or unlimited for Expert/Elite.';

grant execute on function public.count_creative_replies_this_utc_month(uuid) to service_role;
grant execute on function public.get_my_creative_message_reply_usage() to authenticated;
