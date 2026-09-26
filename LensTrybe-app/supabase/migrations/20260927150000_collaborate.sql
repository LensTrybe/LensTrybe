-- Collaborate (LensTrybe Next): the collab board between creatives.
--  * collaborations: posted by Pro and up; owner, status and dates set here; lengths checked
--  * collaboration_invites: "I'm interested" (to the poster of an open collab, any plan) or a direct
--    invite (collaboration_id null, Pro and up). One pending request per pair per collab. Only the
--    recipient answers, through accept_collab_invite (opens a thread) or decline; nothing else changes
--  * bell notifications for new requests and accepted ones
-- The old site's post form writes columns that don't exist (timeline, budget_type), so posting there
-- was already failing; its accept/decline still work.

alter table public.collaboration_invites add column if not exists thread_id uuid references public.message_threads(id) on delete set null;

create unique index if not exists collaboration_invites_one_pending
  on public.collaboration_invites (from_creative_id, to_creative_id, coalesce(collaboration_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status = 'pending';

create or replace function public.collab_rate_ok(p_kind text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  if p_kind = 'post' then return coalesce(public.rate_limit_hit('collab-post:user:' || auth.uid(), 10, 86400), false); end if;
  if p_kind = 'invite' then return coalesce(public.rate_limit_hit('collab-invite:user:' || auth.uid(), 40, 86400), false); end if;
  return true;
end $$;
revoke all on function public.collab_rate_ok(text) from public, anon;
grant execute on function public.collab_rate_ok(text) to authenticated;

create or replace function public.guard_collaboration() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user not in ('anon', 'authenticated') then return NEW; end if;
  if auth.uid() is null then raise exception 'Please log in again.' using errcode = '42501'; end if;
  if TG_OP = 'INSERT' then
    if public.tier_of(auth.uid()) = 'basic' then raise exception 'Posting a collab is on Pro and above.' using errcode = 'P0001'; end if;
    if public.collab_rate_ok('post') is false then raise exception 'You''ve posted a lot today. Try again tomorrow.' using errcode = 'P0001'; end if;
    NEW.id := gen_random_uuid(); NEW.posted_by := auth.uid(); NEW.status := 'open'; NEW.created_at := now();
  else
    NEW.id := OLD.id; NEW.posted_by := OLD.posted_by; NEW.created_at := OLD.created_at;
  end if;
  NEW.updated_at := now();
  NEW.brief := left(btrim(coalesce(NEW.brief, '')), 1000);
  if NEW.brief = '' then raise exception 'Say a few words about the collab.' using errcode = 'P0001'; end if;
  NEW.roles_needed := (select coalesce(array_agg(left(btrim(r), 40)), '{}') from (select unnest(NEW.roles_needed) r limit 6) x where btrim(r) <> '');
  if cardinality(NEW.roles_needed) = 0 then raise exception 'Pick at least one role.' using errcode = 'P0001'; end if;
  NEW.location := left(NEW.location, 120);
  NEW.date_or_timeline := left(NEW.date_or_timeline, 120);
  if not NEW.is_paid then NEW.budget_amount := null; end if;
  if NEW.budget_amount is not null and (NEW.budget_amount < 0 or NEW.budget_amount > 1000000) then raise exception 'Check the amount.' using errcode = 'P0001'; end if;
  return NEW;
end $$;
drop trigger if exists a_guard_collaboration on public.collaborations;
create trigger a_guard_collaboration before insert or update on public.collaborations
  for each row execute function public.guard_collaboration();

create or replace function public.guard_collab_invite() returns trigger
language plpgsql set search_path = public as $$
declare v_poster uuid; v_status text;
begin
  if current_user not in ('anon', 'authenticated') then return NEW; end if;
  if auth.uid() is null then raise exception 'Please log in again.' using errcode = '42501'; end if;
  if TG_OP = 'INSERT' then
    NEW.id := gen_random_uuid(); NEW.from_creative_id := auth.uid(); NEW.status := 'pending'; NEW.created_at := now(); NEW.thread_id := null;
    NEW.message := left(btrim(coalesce(NEW.message, '')), 1000);
    if NEW.collaboration_id is not null then
      select posted_by, status into v_poster, v_status from public.collaborations where id = NEW.collaboration_id;
      if not found or v_status <> 'open' then raise exception 'This collab isn''t open any more.' using errcode = 'P0001'; end if;
      NEW.to_creative_id := v_poster;
      if v_poster = auth.uid() then raise exception 'That''s your own collab.' using errcode = 'P0001'; end if;
    else
      if public.tier_of(auth.uid()) = 'basic' then raise exception 'Inviting creatives directly is on Pro and above.' using errcode = 'P0001'; end if;
      if NEW.message = '' then raise exception 'Add a message.' using errcode = 'P0001'; end if;
    end if;
    if NEW.to_creative_id = NEW.from_creative_id then raise exception 'That''s you.' using errcode = 'P0001'; end if;
    if public.collab_rate_ok('invite') is false then raise exception 'Too many requests today. Try again tomorrow.' using errcode = 'P0001'; end if;
    return NEW;
  end if;
  -- only the answer changes, only from pending, only by the recipient; accepting goes through accept_collab_invite
  NEW.id := OLD.id; NEW.collaboration_id := OLD.collaboration_id; NEW.from_creative_id := OLD.from_creative_id; NEW.to_creative_id := OLD.to_creative_id;
  NEW.message := OLD.message; NEW.created_at := OLD.created_at; NEW.thread_id := OLD.thread_id;
  if NEW.status is distinct from OLD.status and not (OLD.status = 'pending' and NEW.status = 'declined' and auth.uid() = OLD.to_creative_id) then NEW.status := OLD.status; end if;
  return NEW;
end $$;
drop trigger if exists a_guard_collab_invite on public.collaboration_invites;
create trigger a_guard_collab_invite before insert or update on public.collaboration_invites
  for each row execute function public.guard_collab_invite();

create or replace function public.notify_collab_invite() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_from text; v_to text;
begin
  select coalesce(nullif(btrim(business_name), ''), 'A creative') into v_from from public.profiles where id = NEW.from_creative_id;
  select coalesce(nullif(btrim(business_name), ''), 'A creative') into v_to from public.profiles where id = NEW.to_creative_id;
  begin
    if TG_OP = 'INSERT' then
      insert into public.notifications (user_id, type, title, body, link, meta)
      values (NEW.to_creative_id, 'collab', case when NEW.collaboration_id is null then v_from || ' invited you to collaborate' else v_from || ' is interested in your collab' end,
              nullif(left(coalesce(NEW.message, ''), 140), ''), '/dashboard/collaborate', jsonb_build_object('invite_id', NEW.id));
    elsif NEW.status = 'accepted' and OLD.status is distinct from 'accepted' then
      insert into public.notifications (user_id, type, title, body, link, meta)
      values (NEW.from_creative_id, 'collab', v_to || ' said yes', 'You can message each other now.', '/dashboard/collaborate', jsonb_build_object('invite_id', NEW.id, 'thread_id', NEW.thread_id));
    end if;
  exception when others then null;
  end;
  return NEW;
end $$;
drop trigger if exists notify_collab_invite on public.collaboration_invites;
create trigger notify_collab_invite after insert or update on public.collaboration_invites
  for each row execute function public.notify_collab_invite();

-- The recipient accepts: a thread opens in the recipient's Threads with the requester as the other
-- side (client_user_id), starting with the request's message. The requester follows it on Collaborate.
create or replace function public.accept_collab_invite(p_invite uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_inv public.collaboration_invites; v_name text; v_email text; v_subject text; v_brief text; v_thread uuid; v_claims text; v_sub text;
begin
  if auth.uid() is null then raise exception 'Please log in again.' using errcode = '42501'; end if;
  select * into v_inv from public.collaboration_invites where id = p_invite for update;
  if not found or v_inv.to_creative_id <> auth.uid() then raise exception 'That request isn''t here any more.' using errcode = 'P0001'; end if;
  if v_inv.status = 'accepted' and v_inv.thread_id is not null then return v_inv.thread_id; end if;
  if v_inv.status <> 'pending' then raise exception 'That request has already been answered.' using errcode = 'P0001'; end if;
  select coalesce(nullif(btrim(business_name), ''), 'A creative') into v_name from public.profiles where id = v_inv.from_creative_id;
  select email into v_email from auth.users where id = v_inv.from_creative_id;
  if v_inv.collaboration_id is not null then select brief into v_brief from public.collaborations where id = v_inv.collaboration_id; end if;
  v_subject := left('Collab: ' || coalesce(nullif(btrim(split_part(coalesce(v_brief, ''), E'\n', 1)), ''), 'with ' || v_name), 150);
  insert into public.message_threads (creative_id, client_user_id, client_name, client_email, subject, sender_type, unread_count, last_message_at)
    values (auth.uid(), v_inv.from_creative_id, v_name, v_email, v_subject, 'client', 0, now()) returning id into v_thread;
  -- The first message is the requester's words. messages_stamp_sender labels a message by auth.uid(),
  -- so write it as the requester for this one insert, then put the caller back.
  v_claims := current_setting('request.jwt.claims', true); v_sub := current_setting('request.jwt.claim.sub', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_inv.from_creative_id, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_inv.from_creative_id::text, true);
  insert into public.messages (thread_id, sender_type, sender_name, sender_email, body)
    values (v_thread, 'client', v_name, v_email, coalesce(nullif(v_inv.message, ''), case when v_inv.collaboration_id is null then 'Hi, I''d like to collaborate.' else 'Hi, I''m interested in your collab.' end));
  perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(v_sub, ''), true);
  update public.collaboration_invites set status = 'accepted', thread_id = v_thread where id = v_inv.id;
  return v_thread;
end $$;
revoke all on function public.accept_collab_invite(uuid) from public, anon;
grant execute on function public.accept_collab_invite(uuid) to authenticated;
